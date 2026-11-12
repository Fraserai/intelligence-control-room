/**
 * Terminal host: runs the coding agents' official CLIs in real terminals.
 *
 * The main process owns every terminal, so an agent keeps running while you
 * switch spaces or the UI reloads, and its recent output is kept to replay
 * when you come back (idea from T3 Code, MIT: the server owns PTYs and keeps
 * bounded scrollback).
 *
 * Agents start in the folder you pick (default: your home folder) and can
 * work across your Mac, inside each CLI's own permission prompts.
 */
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import * as pty from "node-pty";
import type { CodingAgentApi, Logger, TerminalSession } from "@control-room/contracts";

const MAX_BACKLOG_BYTES = 1024 * 1024;

interface Running {
  session: TerminalSession;
  proc?: pty.IPty;
  backlog: string[];
  backlogBytes: number;
  cols: number;
  rows: number;
}

/** The PATH your login shell would give a terminal (apps opened from Finder get a tiny one). */
export function loginShellPath(): Promise<string> {
  const shell = process.env.SHELL || "/bin/zsh";
  return new Promise((resolve) => {
    execFile(shell, ["-l", "-i", "-c", 'printf "__CR__%s__CR__" "$PATH"'], { timeout: 8000 }, (_err, stdout) => {
      const match = /__CR__(.*)__CR__/.exec(stdout ?? "");
      resolve(match?.[1] || process.env.PATH || "/usr/bin:/bin:/usr/sbin:/sbin");
    });
  });
}

/** Clean environment for agents: your normal one, minus anything Electron-specific. */
function agentEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (k.startsWith("ELECTRON_") || k.startsWith("CONTROL_ROOM_") || k === "NODE_OPTIONS") continue;
    env[k] = v;
  }
  return { ...env, PATH: path, TERM: "xterm-256color", COLORTERM: "truecolor", TERM_PROGRAM: "ControlRoom" };
}

export class TerminalHost extends EventEmitter {
  private terms = new Map<string, Running>();
  private path?: string;
  private folders: Record<string, string> = {};

  constructor(
    private readonly agents: Record<string, CodingAgentApi>,
    private readonly configDir: string,
    private readonly log: Logger,
  ) {
    super();
  }

  /** agents.json in the config folder remembers each agent's folder. */
  private get foldersFile(): string {
    return join(this.configDir, "agents.json");
  }

  async init(): Promise<void> {
    this.path = await loginShellPath();
    try {
      const raw = JSON.parse(await readFile(this.foldersFile, "utf8")) as Record<string, { cwd?: string }>;
      for (const [id, v] of Object.entries(raw)) if (typeof v?.cwd === "string") this.folders[id] = v.cwd;
    } catch {
      // first run: everything starts in your home folder
    }
  }

  folderOf(id: string): string {
    return this.folders[id] ?? homedir();
  }

  async setFolder(id: string, cwd: string): Promise<void> {
    this.folders[id] = cwd;
    const out = Object.fromEntries(Object.entries(this.folders).map(([k, v]) => [k, { cwd: v }]));
    await writeFile(this.foldersFile, `${JSON.stringify(out, null, 2)}\n`);
  }

  has(id: string): boolean {
    return id in this.agents;
  }

  sessions(): TerminalSession[] {
    return [...this.terms.values()].map((t) => ({ ...t.session }));
  }

  /** Start the agent if it isn't running, and return what's on screen so far. */
  async attach(id: string): Promise<{ session: TerminalSession; backlog: string }> {
    const existing = this.terms.get(id);
    if (existing?.session.running) return { session: { ...existing.session }, backlog: existing.backlog.join("") };
    const t = await this.start(id);
    return { session: { ...t.session }, backlog: t.backlog.join("") };
  }

  async restart(id: string): Promise<void> {
    this.kill(id);
    await this.start(id);
  }

  write(id: string, data: string): void {
    this.terms.get(id)?.proc?.write(data);
  }

  resize(id: string, cols: number, rows: number): void {
    const t = this.terms.get(id);
    if (!t) return;
    t.cols = cols;
    t.rows = rows;
    if (t.session.running) t.proc?.resize(cols, rows);
  }

  /** Close the agent like closing a terminal window; force it if it hasn't stopped after 1.5s. */
  kill(id: string): void {
    const t = this.terms.get(id);
    if (!t?.session.running || !t.proc) return;
    t.session.running = false;
    const pid = t.proc.pid;
    t.proc.kill();
    setTimeout(() => {
      try {
        process.kill(pid, 0);
        process.kill(pid, "SIGKILL");
      } catch {
        // already stopped
      }
    }, 1500).unref();
  }

  killAll(): void {
    for (const id of this.terms.keys()) this.kill(id);
  }

  private async start(id: string): Promise<Running> {
    const api = this.agents[id];
    const path = this.path ?? (await loginShellPath());
    const agent = await api.detect(path);
    const prev = this.terms.get(id);
    const t: Running = {
      session: { id, cwd: this.folderOf(id), running: false, agent },
      backlog: [],
      backlogBytes: 0,
      cols: prev?.cols ?? 100,
      rows: prev?.rows ?? 30,
    };
    this.terms.set(id, t);
    if (!agent.installed) {
      this.emit("session", { ...t.session });
      return t;
    }

    const launch = api.launch(agent);
    this.log.info(`terminal: starting ${id} (${launch.file}) in ${t.session.cwd}`);
    const proc = pty.spawn(launch.file, launch.args, {
      name: "xterm-256color",
      cols: t.cols,
      rows: t.rows,
      cwd: t.session.cwd,
      env: agentEnv(path),
    });
    t.proc = proc;
    t.session.running = true;

    proc.onData((data) => {
      t.backlog.push(data);
      t.backlogBytes += data.length;
      while (t.backlogBytes > MAX_BACKLOG_BYTES && t.backlog.length > 1) {
        t.backlogBytes -= t.backlog.shift()!.length;
      }
      this.emit("data", id, data);
    });
    proc.onExit(({ exitCode }) => {
      if (this.terms.get(id) !== t) return;
      t.session.running = false;
      t.session.exitCode = exitCode;
      this.emit("session", { ...t.session });
    });
    this.emit("session", { ...t.session });
    return t;
  }
}
