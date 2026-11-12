/**
 * The only bridge between the UI and the main process.
 * The UI can read app state, show/hide/navigate websites, and listen for changes.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { AppState, TerminalSession, WebSpaceStatus } from "@control-room/contracts";
import type { ControlRoomBridge } from "./api";

function listen<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, value: T) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: ControlRoomBridge = {
  getState: () => ipcRenderer.invoke("state:get") as Promise<AppState | undefined>,
  onState: (callback) => listen<AppState>("state:changed", callback),
  web: {
    statuses: () => ipcRenderer.invoke("web:statuses") as Promise<WebSpaceStatus[]>,
    onStatus: (callback) => listen<WebSpaceStatus>("web:status", callback),
    show: (id, rect) => ipcRenderer.send("web:show", id, rect),
    hide: () => ipcRenderer.send("web:hide"),
    navigate: (id, action) => ipcRenderer.send("web:nav", id, action),
  },
  term: {
    sessions: () => ipcRenderer.invoke("term:sessions") as Promise<TerminalSession[]>,
    attach: (id) => ipcRenderer.invoke("term:attach", id),
    input: (id, data) => ipcRenderer.send("term:input", id, data),
    resize: (id, cols, rows) => ipcRenderer.send("term:resize", id, cols, rows),
    restart: (id) => ipcRenderer.invoke("term:restart", id) as Promise<void>,
    pickFolder: (id) => ipcRenderer.invoke("term:pickFolder", id) as Promise<void>,
    onData: (callback) => {
      const listener = (_e: IpcRendererEvent, id: string, data: string) => callback(id, data);
      ipcRenderer.on("term:data", listener);
      return () => ipcRenderer.removeListener("term:data", listener);
    },
    onSession: (callback) => listen<TerminalSession>("term:session", callback),
  },
  onSelect: (callback) => listen<string | null>("ui:select", callback),
};

contextBridge.exposeInMainWorld("controlRoom", api);
