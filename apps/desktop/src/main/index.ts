/**
 * Control Room: main process.
 *
 * Owns the window, the config folder (with live reload), the modules and the
 * websites. The UI gets data only through the small preload bridge, never Node.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from "electron";
import liquidGlass from "electron-liquid-glass";
import type {
  AppState,
  CodingAgentApi,
  Logger,
  Rect,
  Space,
  WebNavAction,
  WebSpaceHostApi,
  WebSpaceStatus,
} from "@control-room/contracts";
import { ConfigService, resolveConfigDir } from "./config";
import { activateAgentModule, activateWebModule } from "./registry";
import { TerminalHost } from "./terminals";

app.setName("Control Room");
// Checks on the running app use a throwaway data folder so real logins are never touched.
if (process.env.CONTROL_ROOM_USER_DATA) app.setPath("userData", process.env.CONTROL_ROOM_USER_DATA);

const log: Logger = {
  info: (m) => console.log(`[control-room] ${m}`),
  warn: (m) => console.warn(`[control-room] ${m}`),
  error: (m) => console.error(`[control-room] ${m}`),
};

// Shipped defaults live at the repo root in /defaults.
const defaultsDir = join(app.getAppPath(), "..", "..", "defaults");
const config = new ConfigService(resolveConfigDir(), defaultsDir, log);

let win: BrowserWindow | undefined;
let web: WebSpaceHostApi | undefined;
let terminals: TerminalHost | undefined;

// ---------------------------------------------------------------------------
// Favicons: remembered between launches so the sidebar shows real site icons.
// ---------------------------------------------------------------------------
const faviconFile = () => join(app.getPath("userData"), "favicons.json");
let favicons: Record<string, string> = {};
let faviconSaveTimer: NodeJS.Timeout | undefined;
function loadFavicons(): void {
  try {
    favicons = JSON.parse(readFileSync(faviconFile(), "utf8"));
  } catch {
    favicons = {};
  }
}
function rememberFavicon(id: string, dataUrl: string): void {
  if (favicons[id] === dataUrl) return;
  favicons[id] = dataUrl;
  clearTimeout(faviconSaveTimer);
  faviconSaveTimer = setTimeout(() => writeFileSync(faviconFile(), JSON.stringify(favicons)), 500);
}

function findSpace(id: string): Space | undefined {
  for (const g of config.getState()?.spaces.groups ?? []) {
    const s = g.spaces.find((x) => x.id === id);
    if (s) return s;
  }
  return undefined;
}

function allSpaces(): Space[] {
  return config.getState()?.spaces.groups.flatMap((g) => g.spaces) ?? [];
}

// ---------------------------------------------------------------------------
// Menu: standard Edit/View/Window menus (copy/paste in sites) plus Spaces (⌘1–9).
// ---------------------------------------------------------------------------
function buildMenu(): void {
  const spaces = allSpaces().slice(0, 9);
  const menu = Menu.buildFromTemplate([
    { role: "appMenu" },
    { role: "editMenu" },
    {
      label: "Spaces",
      submenu: [
        { label: "Home", accelerator: "CmdOrCtrl+0", click: () => win?.webContents.send("ui:select", null) },
        { type: "separator" },
        ...spaces.map((s, i) => ({
          label: s.title,
          accelerator: `CmdOrCtrl+${i + 1}`,
          click: () => win?.webContents.send("ui:select", s.id),
        })),
      ],
    },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ]);
  Menu.setApplicationMenu(menu);
  // Keep the test hook pointing at the live menu.
  const hook = (globalThis as Record<string, unknown>).__controlRoomTest as { menu?: Menu } | undefined;
  if (hook) hook.menu = menu;
}

function applyTheme(state: AppState): void {
  // Makes the frosted macOS sidebar match a light or dark theme.
  nativeTheme.themeSource = state.theme.mode;
  web?.setBackground(state.theme.palette.background);
}

function createWindow(): void {
  // Liquid Glass can't sit alongside vibrancy (it would override and look
  // blurry) — glass gets a transparent window, everyone else keeps the classic
  // vibrancy sidebar. theme.json's "glass" flag chooses; fixed at launch.
  const glass = config.getGlass();
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: "Control Room",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    ...(glass
      ? { transparent: true }
      : { vibrancy: "sidebar" as const, visualEffectState: "active" as const }),
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (glass) win.setWindowButtonVisibility(true);

  // The app UI never opens windows or navigates away; links go to the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.once("ready-to-show", () => win?.show());

  if (glass) {
    // Behind the web content, not over it. -1 = not supported here.
    const target = win;
    target.webContents.once("did-finish-load", () => {
      const id = liquidGlass.addView(target.getNativeWindowHandle(), { cornerRadius: 12 });
      log.info(id === -1 ? "liquid glass: not supported (staying classic)" : `liquid glass: view ${id}`);
    });
  }

  web?.attach(win);

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// ---------------------------------------------------------------------------
// Bridge handlers (inputs from the UI are checked before use)
// ---------------------------------------------------------------------------
const isRect = (r: unknown): r is Rect =>
  !!r && ["x", "y", "width", "height"].every((k) => Number.isFinite((r as Record<string, number>)[k]));
const NAV_ACTIONS: WebNavAction[] = ["back", "forward", "reload", "home"];

ipcMain.handle("state:get", () => config.getState());
ipcMain.handle("web:statuses", (): WebSpaceStatus[] => {
  const live = new Map((web?.statuses() ?? []).map((s) => [s.id, s]));
  return allSpaces()
    .filter((s) => s.kind === "web")
    .map((s) => live.get(s.id) ?? { id: s.id, url: s.url ?? "", title: s.title, loading: false, canGoBack: false, canGoForward: false, open: false })
    .map((s) => ({ ...s, favicon: s.favicon ?? favicons[s.id] }));
});
ipcMain.on("web:show", (_e, id: unknown, rect: unknown) => {
  if (typeof id !== "string" || !isRect(rect)) return;
  const space = findSpace(id);
  if (space?.kind === "web" && space.url) web?.show(space, rect);
});
ipcMain.on("web:hide", () => web?.hide());
ipcMain.on("web:nav", (_e, id: unknown, action: unknown) => {
  if (typeof id === "string" && NAV_ACTIONS.includes(action as WebNavAction)) web?.navigate(id, action as WebNavAction);
});

/** Send to the UI only while its window is alive (agents can still report while the app quits). */
function sendToUi(channel: string, ...args: unknown[]): void {
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, ...args);
}

// Coding agents in terminals ------------------------------------------------
const isId = (id: unknown): id is string => typeof id === "string" && !!terminals?.has(id);

ipcMain.handle("term:sessions", () => terminals?.sessions() ?? []);
ipcMain.handle("term:attach", (_e, id: unknown) => (isId(id) ? terminals!.attach(id) : undefined));
ipcMain.on("term:input", (_e, id: unknown, data: unknown) => {
  if (isId(id) && typeof data === "string") terminals!.write(id, data);
});
ipcMain.on("term:resize", (_e, id: unknown, cols: unknown, rows: unknown) => {
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) > 0 && (n as number) < 2000;
  if (isId(id) && ok(cols) && ok(rows)) terminals!.resize(id, cols as number, rows as number);
});
ipcMain.handle("term:restart", async (_e, id: unknown) => {
  if (isId(id)) await terminals!.restart(id);
});
ipcMain.handle("term:pickFolder", async (_e, id: unknown) => {
  if (!isId(id) || !win) return;
  const title = findSpace(id)?.title ?? id;
  const picked = await dialog.showOpenDialog(win, {
    title: `Folder for ${title}`,
    defaultPath: terminals!.folderOf(id),
    properties: ["openDirectory", "createDirectory"],
  });
  if (picked.canceled || !picked.filePaths[0]) return;
  const running = terminals!.sessions().find((s) => s.id === id)?.running;
  if (running) {
    const answer = await dialog.showMessageBox(win, {
      type: "question",
      buttons: ["Restart in new folder", "Cancel"],
      defaultId: 0,
      cancelId: 1,
      message: `Restart ${title} in ${picked.filePaths[0]}?`,
      detail: "The current session in this terminal will end.",
    });
    if (answer.response !== 0) return;
  }
  await terminals!.setFolder(id, picked.filePaths[0]);
  await terminals!.restart(id);
});

config.on("state", (state: AppState) => {
  applyTheme(state);
  buildMenu();
  win?.webContents.send("state:changed", state);
});

app.whenReady().then(async () => {
  log.info(`config folder: ${config.configDir}`);
  loadFavicons();
  await config.start();

  web = await activateWebModule(config.getModules().webSpaces, { configDir: config.configDir, log });
  web.onStatus((status) => {
    if (status.favicon) rememberFavicon(status.id, status.favicon);
    win?.webContents.send("web:status", { ...status, favicon: status.favicon ?? favicons[status.id] });
  });

  const agents: Record<string, CodingAgentApi> = {};
  for (const [spaceId, moduleId] of Object.entries(config.getModules().codingAgents)) {
    try {
      agents[spaceId] = await activateAgentModule(moduleId, { configDir: config.configDir, log });
    } catch (e) {
      log.error((e as Error).message);
    }
  }
  terminals = new TerminalHost(agents, config.configDir, log);
  await terminals.init();
  terminals.on("data", (id: string, data: string) => sendToUi("term:data", id, data));
  terminals.on("session", (session) => sendToUi("term:session", session));

  const state = config.getState();
  if (state) applyTheme(state);
  buildMenu();

  createWindow();
  if (process.env.CONTROL_ROOM_TEST) {
    (globalThis as Record<string, unknown>).__controlRoomTest = { web, win, terminals, menu: Menu.getApplicationMenu() };
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  terminals?.killAll();
  void config.stop();
});
