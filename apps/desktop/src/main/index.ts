/**
 * Control Room: main process.
 *
 * Owns the window, the config folder (with live reload), the modules and the
 * websites. The UI gets data only through the small preload bridge, never Node.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, shell } from "electron";
import type { AppState, Logger, Rect, Space, WebNavAction, WebSpaceHostApi, WebSpaceStatus } from "@control-room/contracts";
import { ConfigService, resolveConfigDir } from "./config";
import { activateWebModule } from "./registry";

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
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: "Control Room",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: "sidebar",
    visualEffectState: "active",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // The app UI never opens windows or navigates away; links go to the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.once("ready-to-show", () => win?.show());

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
  const state = config.getState();
  if (state) applyTheme(state);
  buildMenu();

  createWindow();
  if (process.env.CONTROL_ROOM_TEST) {
    (globalThis as Record<string, unknown>).__controlRoomTest = { web, win, menu: Menu.getApplicationMenu() };
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => void config.stop());
