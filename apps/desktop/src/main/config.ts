/**
 * Config service.
 *
 * All settings live as plain files in the config folder (default
 * ~/.config/control-room). The app watches the folder and reloads live.
 * A broken edit never crashes the app: the last good version stays in use
 * and the problem is shown in the UI.
 */
import { EventEmitter } from "node:events";
import { cp, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { watch, type FSWatcher } from "chokidar";
import type { z } from "zod";
import {
  ModulesConfigSchema,
  SpacesConfigSchema,
  ThemeConfigSchema,
  type AppState,
  type ConfigError,
  type Logger,
  type ModulesConfig,
  type ResolvedTheme,
  type SpacesConfig,
  type ThemeConfig,
} from "@control-room/contracts";
import { activateThemeModule } from "./registry";

export function resolveConfigDir(): string {
  return process.env.CONTROL_ROOM_CONFIG_DIR || join(homedir(), ".config", "control-room");
}

/** Copy any default file that is missing. Never overwrites an existing file. */
export async function ensureDefaults(defaultsDir: string, configDir: string): Promise<void> {
  await mkdir(configDir, { recursive: true });
  async function copyMissing(rel: string): Promise<void> {
    const src = join(defaultsDir, rel);
    const dest = join(configDir, rel);
    const info = await stat(src);
    if (info.isDirectory()) {
      await mkdir(dest, { recursive: true });
      for (const name of await readdir(src)) await copyMissing(join(rel, name));
      return;
    }
    try {
      await stat(dest);
    } catch {
      await cp(src, dest);
    }
  }
  for (const name of await readdir(defaultsDir)) await copyMissing(name);
}

async function readJson<T>(
  dir: string,
  file: string,
  schema: z.ZodType<T>,
): Promise<{ value?: T; error?: ConfigError }> {
  let text: string;
  try {
    text = await readFile(join(dir, file), "utf8");
  } catch {
    return { error: { file, message: "file is missing" } };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { error: { file, message: `not valid JSON: ${(e as Error).message}` } };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".") || "(file)"}: ${i.message}`)
      .join("; ");
    return { error: { file, message } };
  }
  return { value: result.data };
}

export class ConfigService extends EventEmitter {
  private watcher?: FSWatcher;
  private timer?: NodeJS.Timeout;
  private good: {
    theme?: ThemeConfig;
    modules?: ModulesConfig;
    spaces?: SpacesConfig;
    resolvedTheme?: ResolvedTheme;
  } = {};
  private state?: AppState;

  constructor(
    readonly configDir: string,
    private readonly defaultsDir: string,
    private readonly log: Logger,
  ) {
    super();
  }

  getState(): AppState | undefined {
    return this.state;
  }

  async start(): Promise<void> {
    await ensureDefaults(this.defaultsDir, this.configDir);
    await this.reload();
    this.watcher = watch(this.configDir, {
      ignoreInitial: true,
      ignored: (path) => path.includes("/.git"),
      awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 },
    });
    this.watcher.on("all", () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.reload(), 100);
    });
  }

  async stop(): Promise<void> {
    clearTimeout(this.timer);
    await this.watcher?.close();
  }

  /** Read every config file, keep the last good value for anything broken. */
  async reload(): Promise<void> {
    const errors: ConfigError[] = [];
    const dir = this.configDir;

    // For each file: use the new value if valid, else the last good one,
    // else the shipped default (so the very first launch always works).
    const pick = async <T>(file: string, schema: z.ZodType<T>, last: T | undefined): Promise<T> => {
      const r = await readJson(dir, file, schema);
      if (r.value) return r.value;
      if (r.error) errors.push(r.error);
      if (last) return last;
      const fallback = await readJson(this.defaultsDir, file, schema);
      if (!fallback.value) throw new Error(`shipped default ${file} is invalid`);
      return fallback.value;
    };

    const theme = await pick("theme.json", ThemeConfigSchema, this.good.theme);
    const modules = await pick("modules.json", ModulesConfigSchema, this.good.modules);
    const spaces = await pick("spaces.json", SpacesConfigSchema, this.good.spaces);
    this.good = { ...this.good, theme, modules, spaces };

    let themes: string[] = [];
    let resolvedTheme = this.good.resolvedTheme;
    try {
      const themeApi = await activateThemeModule(modules.theme, { configDir: dir, log: this.log });
      themes = await themeApi.list();
      resolvedTheme = await themeApi.load(theme.current);
      this.good.resolvedTheme = resolvedTheme;
    } catch (e) {
      errors.push({ file: `themes/${theme.current}/colors.toml`, message: (e as Error).message });
    }

    if (!resolvedTheme) {
      // Nothing good yet: fall back to the shipped default theme.
      const themeApi = await activateThemeModule("theme-colors-toml", {
        configDir: this.defaultsDir,
        log: this.log,
      });
      resolvedTheme = await themeApi.load("control-room");
    }

    this.state = { configDir: dir, theme: resolvedTheme, themes, spaces, errors };
    for (const err of errors) this.log.warn(`config: ${err.file}: ${err.message}`);
    this.emit("state", this.state);
  }
}
