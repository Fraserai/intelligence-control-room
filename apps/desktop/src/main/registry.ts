/**
 * Module registry: the list of modules the app knows about.
 *
 * modules.json in the config folder picks which module fills each slot.
 * Swapping a module = add it here and change one line in modules.json.
 */
import type {
  CodingAgentApi,
  ControlRoomModule,
  ModuleContext,
  ThemeApi,
  WebSpaceHostApi,
} from "@control-room/contracts";
import themeColorsToml from "@control-room/theme-colors-toml";
import webElectron from "@control-room/web-electron";
import { claudeCode, codex, opencode } from "@control-room/agents-cli";

const themeModules: Record<string, ControlRoomModule<ThemeApi>> = {
  [themeColorsToml.manifest.id]: themeColorsToml,
};

const webModules: Record<string, ControlRoomModule<WebSpaceHostApi>> = {
  [webElectron.manifest.id]: webElectron,
};

const agentModules: Record<string, ControlRoomModule<CodingAgentApi>> = {
  [claudeCode.manifest.id]: claudeCode,
  [codex.manifest.id]: codex,
  [opencode.manifest.id]: opencode,
};

function pick<T>(slot: string, all: Record<string, ControlRoomModule<T>>, id: string): ControlRoomModule<T> {
  const mod = all[id];
  if (!mod) {
    throw new Error(`modules.json asks for ${slot} module "${id}", but the app only has: ${Object.keys(all).join(", ")}`);
  }
  return mod;
}

export async function activateThemeModule(id: string, ctx: ModuleContext): Promise<ThemeApi> {
  return pick("theme", themeModules, id).activate(ctx);
}

export async function activateWebModule(id: string, ctx: ModuleContext): Promise<WebSpaceHostApi> {
  return pick("webSpaces", webModules, id).activate(ctx);
}

export async function activateAgentModule(id: string, ctx: ModuleContext): Promise<CodingAgentApi> {
  return pick("codingAgents", agentModules, id).activate(ctx);
}
