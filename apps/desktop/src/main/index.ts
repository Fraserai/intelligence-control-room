/**
 * Control Room: main process.
 *
 * Owns the window, the config folder (with live reload) and the modules.
 * The UI gets data only through the small preload bridge, never Node access.
 */
import { join } from "node:path";
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from "electron";
import type { AppState, Logger } from "@control-room/contracts";
import { ConfigService, resolveConfigDir } from "./config";

const log: Logger = {
  info: (m) => console.log(`[control-room] ${m}`),
  warn: (m) => console.warn(`[control-room] ${m}`),
  error: (m) => console.error(`[control-room] ${m}`),
};

// Shipped defaults live at the repo root in /defaults.
const defaultsDir = join(app.getAppPath(), "..", "..", "defaults");
const config = new ConfigService(resolveConfigDir(), defaultsDir, log);

let win: BrowserWindow | undefined;

function applyNativeTheme(state: AppState): void {
  // Makes the frosted macOS sidebar match a light or dark theme.
  nativeTheme.themeSource = state.theme.mode;
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

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

ipcMain.handle("state:get", () => config.getState());

config.on("state", (state: AppState) => {
  applyNativeTheme(state);
  win?.webContents.send("state:changed", state);
});

app.whenReady().then(async () => {
  log.info(`config folder: ${config.configDir}`);
  await config.start();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => void config.stop());
