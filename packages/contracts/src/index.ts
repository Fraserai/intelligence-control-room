/**
 * Control Room contracts.
 *
 * Every part of the app (LLM, coding agent, provider, site, memory, key store,
 * theme, panel, system agent) is a module. A module depends only on this file,
 * never on another module, so any module can be swapped without touching the rest.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export const MODULE_KINDS = [
  "theme",
  "web-space",
  "coding-agent",
  "system-agent",
  "memory",
  "key-store",
  "connector",
  "panel",
] as const;
export type ModuleKind = (typeof MODULE_KINDS)[number];

export interface ModuleManifest {
  /** Unique id, e.g. "theme-colors-toml". Used in modules.json. */
  id: string;
  kind: ModuleKind;
  name: string;
  version: string;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Everything a module is given. Modules get nothing global beyond this. */
export interface ModuleContext {
  /** The config folder, e.g. ~/.config/control-room */
  configDir: string;
  log: Logger;
}

export interface ControlRoomModule<Api> {
  manifest: ModuleManifest;
  activate(ctx: ModuleContext): Promise<Api & { dispose?(): Promise<void> }>;
}

// ---------------------------------------------------------------------------
// Theme modules
// ---------------------------------------------------------------------------

/**
 * A palette in Omarchy's colors.toml format, so Omarchy themes work as-is.
 * https://github.com/omacom/omarchy (MIT)
 */
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a colour like #1a1b26");
export const PaletteSchema = z.object({
  mode: z.enum(["dark", "light"]).default("dark"),
  accent: hex,
  selection: hex,
  muted: hex,
  background: hex,
  dark_background: hex,
  darker_background: hex,
  lighter_background: hex,
  foreground: hex,
  dark_foreground: hex,
  light_foreground: hex,
  bright_foreground: hex,
  red: hex,
  yellow: hex,
  orange: hex,
  green: hex,
  cyan: hex,
  blue: hex,
  magenta: hex,
  brown: hex.optional(),
  bright_red: hex,
  bright_yellow: hex,
  bright_green: hex,
  bright_cyan: hex,
  bright_blue: hex,
  bright_magenta: hex,
});
export type Palette = z.infer<typeof PaletteSchema>;

export interface ResolvedTheme {
  name: string;
  mode: "dark" | "light";
  palette: Palette;
  /** CSS custom properties the UI uses, e.g. { "--cr-bg": "#0c0c12" } */
  cssVars: Record<string, string>;
}

export interface ThemeApi {
  /** Names of the themes in <configDir>/themes */
  list(): Promise<string[]>;
  /** Load and validate one theme. Throws with a readable message if invalid. */
  load(name: string): Promise<ResolvedTheme>;
}

// ---------------------------------------------------------------------------
// Config files (all live in the config folder and hot-reload)
// ---------------------------------------------------------------------------

/** theme.json */
export const ThemeConfigSchema = z.object({
  current: z.string().min(1),
});
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

/** modules.json: which module fills each slot. */
export const ModulesConfigSchema = z.object({
  theme: z.string().min(1),
});
export type ModulesConfig = z.infer<typeof ModulesConfigSchema>;

/** spaces.json: what's in the sidebar. */
export const SpaceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "use lowercase letters, numbers and dashes"),
  title: z.string().min(1),
  kind: z.enum(["web", "coding-agent", "local-app"]),
  url: z.string().url().optional(),
});
export type Space = z.infer<typeof SpaceSchema>;

export const SpaceGroupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  spaces: z.array(SpaceSchema),
});
export type SpaceGroup = z.infer<typeof SpaceGroupSchema>;

export const SpacesConfigSchema = z.object({
  groups: z.array(SpaceGroupSchema),
});
export type SpacesConfig = z.infer<typeof SpacesConfigSchema>;

// ---------------------------------------------------------------------------
// What the main process sends to the UI
// ---------------------------------------------------------------------------

export interface ConfigError {
  file: string;
  message: string;
}

export interface AppState {
  configDir: string;
  theme: ResolvedTheme;
  themes: string[];
  spaces: SpacesConfig;
  /** Problems with the latest edit. The last good config stays in use. */
  errors: ConfigError[];
}
