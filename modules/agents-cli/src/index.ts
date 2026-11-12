/**
 * Coding-agent modules: the official CLIs, run as they are.
 *
 * Each agent is its own module (modules.json maps a sidebar space to one), so
 * any of them can be swapped without touching the others. Subscriptions are
 * used only through these official tools (AGENTS.md Rule 1): the app never
 * reads or passes on their logins. You sign in inside the terminal itself.
 */
import { execFile } from "node:child_process";
import { access, constants, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CodingAgentApi, CodingAgentInfo, ControlRoomModule } from "@control-room/contracts";

/** Find an executable on the given PATH. */
async function which(command: string, path: string): Promise<string | undefined> {
  for (const dir of path.split(":")) {
    if (!dir) continue;
    const candidate = join(dir, command);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return undefined;
}

function versionOf(file: string, path: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(file, ["--version"], { timeout: 8000, env: { ...process.env, PATH: path } }, (err, stdout) =>
      resolve(err ? undefined : stdout.trim().split("\n")[0]),
    );
  });
}

/** "codex-cli 0.167.0" -> [0, 167, 0] */
function versionNumbers(v: string | undefined): number[] {
  return (v?.match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1) ?? ["0", "0", "0"]).map(Number);
}
function newer(a: string | undefined, b: string | undefined): boolean {
  const [x, y] = [versionNumbers(a), versionNumbers(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

function cliAgent(opts: {
  id: string;
  name: string;
  command: string;
  installHint: string;
  /** Other places the same official CLI may be installed. The newest version wins. */
  otherCandidates?: () => Promise<string[]>;
}): ControlRoomModule<CodingAgentApi> {
  return {
    manifest: { id: opts.id, kind: "coding-agent", name: opts.name, version: "0.1.0" },
    async activate() {
      return {
        async detect(path): Promise<CodingAgentInfo> {
          const candidates = [await which(opts.command, path), ...((await opts.otherCandidates?.()) ?? [])];
          let best: CodingAgentInfo = { installed: false, installHint: opts.installHint };
          for (const file of candidates) {
            if (!file) continue;
            const version = await versionOf(file, path);
            if (!version) continue;
            if (!best.installed || newer(version, best.version)) {
              best = { installed: true, path: file, version, installHint: opts.installHint };
            }
          }
          return best;
        },
        launch(info) {
          return { file: info.path ?? opts.command, args: [] };
        },
      };
    },
  };
}

export const claudeCode = cliAgent({
  id: "agent-claude-code",
  name: "Claude Code (official CLI)",
  command: "claude",
  installHint: "npm install -g @anthropic-ai/claude-code",
});

export const codex = cliAgent({
  id: "agent-codex",
  name: "Codex (official CLI)",
  command: "codex",
  installHint: "npm install -g @openai/codex",
});

export const opencode = cliAgent({
  id: "agent-opencode",
  name: "OpenCode (official CLI)",
  command: "opencode",
  installHint: "npm install -g opencode-ai",
  // The OpenCode desktop app ships its own (often newer) official CLI. Both
  // share one data folder, so the older one can refuse to start once the newer
  // one has upgraded it; using the newest avoids that.
  otherCandidates: async () => {
    const dir = join(homedir(), "Library", "Application Support", "ai.opencode.desktop", "cli");
    try {
      return (await readdir(dir)).map((v) => join(dir, v, "opencode-cli"));
    } catch {
      return [];
    }
  },
});
