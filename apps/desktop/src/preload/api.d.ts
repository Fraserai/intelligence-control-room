import type { AppState } from "@control-room/contracts";

export interface ControlRoomBridge {
  getState(): Promise<AppState | undefined>;
  onState(callback: (state: AppState) => void): () => void;
}

declare global {
  interface Window {
    controlRoom: ControlRoomBridge;
  }
}
