/**
 * Theme module: Omarchy-style themes.
 *
 * Idea borrowed from Omarchy (MIT, https://github.com/omacom/omarchy): one
 * colors.toml palette per theme restyles everything. Themes live in
 * <configDir>/themes/<name>/colors.toml, so Omarchy's own themes drop straight in.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "smol-toml";
import {
  PaletteSchema,
  type ControlRoomModule,
  type Palette,
  type ResolvedTheme,
  type ThemeApi,
} from "@control-room/contracts";

/** Palette -> the CSS variables the UI is styled with. */
export function toCssVars(p: Palette): Record<string, string> {
  return {
    "--cr-bg": p.background,
    "--cr-bg-dark": p.dark_background,
    "--cr-bg-darker": p.darker_background,
    "--cr-bg-lighter": p.lighter_background,
    "--cr-fg": p.foreground,
    "--cr-fg-dim": p.dark_foreground,
    "--cr-fg-light": p.light_foreground,
    "--cr-fg-bright": p.bright_foreground,
    "--cr-accent": p.accent,
    "--cr-selection": p.selection,
    "--cr-muted": p.muted,
    "--cr-red": p.red,
    "--cr-yellow": p.yellow,
    "--cr-orange": p.orange,
    "--cr-green": p.green,
    "--cr-cyan": p.cyan,
    "--cr-blue": p.blue,
    "--cr-magenta": p.magenta,
  };
}

/** Parse and validate the text of a colors.toml. Throws a readable error. */
export function parsePalette(tomlText: string): Palette {
  let raw: unknown;
  try {
    raw = parse(tomlText);
  } catch (e) {
    throw new Error(`colors.toml is not valid TOML: ${(e as Error).message}`);
  }
  const result = PaletteSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "(file)"}: ${i.message}`)
      .join("; ");
    throw new Error(`colors.toml has problems: ${issues}`);
  }
  return result.data;
}

const themeModule: ControlRoomModule<ThemeApi> = {
  manifest: {
    id: "theme-colors-toml",
    kind: "theme",
    name: "Omarchy-style colors.toml themes",
    version: "0.1.0",
  },
  async activate(ctx) {
    const themesDir = join(ctx.configDir, "themes");
    return {
      async list() {
        const entries = await readdir(themesDir, { withFileTypes: true });
        return entries
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
          .sort();
      },
      async load(name): Promise<ResolvedTheme> {
        if (!/^[a-z0-9._-]+$/i.test(name)) {
          throw new Error(`"${name}" is not a valid theme name`);
        }
        const file = join(themesDir, name, "colors.toml");
        let text: string;
        try {
          text = await readFile(file, "utf8");
        } catch {
          throw new Error(`theme "${name}" not found (looked for ${file})`);
        }
        const palette = parsePalette(text);
        return { name, mode: palette.mode, palette, cssVars: toCssVars(palette) };
      },
    };
  },
};

export default themeModule;
