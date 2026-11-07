/**
 * Module registry: the list of modules the app knows about.
 *
 * modules.json in the config folder picks which module fills each slot.
 * Swapping a module = add it here and change one line in modules.json.
 */
import type { ControlRoomModule, ModuleContext, ThemeApi } from "@control-room/contracts";
import themeColorsToml from "@control-room/theme-colors-toml";

const themeModules: Record<string, ControlRoomModule<ThemeApi>> = {
  [themeColorsToml.manifest.id]: themeColorsToml,
};

export function availableThemeModules(): string[] {
  return Object.keys(themeModules);
}

export async function activateThemeModule(id: string, ctx: ModuleContext): Promise<ThemeApi> {
  const mod = themeModules[id];
  if (!mod) {
    throw new Error(
      `modules.json asks for theme module "${id}", but the app only has: ${availableThemeModules().join(", ")}`,
    );
  }
  return mod.activate(ctx);
}
