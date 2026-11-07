/**
 * The only bridge between the UI and the main process.
 * The UI can read app state and listen for changes. Nothing else.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { AppState } from "@control-room/contracts";
import type { ControlRoomBridge } from "./api";

const api: ControlRoomBridge = {
  getState: () => ipcRenderer.invoke("state:get") as Promise<AppState | undefined>,
  onState: (callback) => {
    const listener = (_e: IpcRendererEvent, state: AppState) => callback(state);
    ipcRenderer.on("state:changed", listener);
    return () => ipcRenderer.removeListener("state:changed", listener);
  },
};

contextBridge.exposeInMainWorld("controlRoom", api);
