import type { AppState, Rect, WebNavAction, WebSpaceStatus } from "@control-room/contracts";

export interface ControlRoomBridge {
  getState(): Promise<AppState | undefined>;
  onState(callback: (state: AppState) => void): () => void;
  web: {
    statuses(): Promise<WebSpaceStatus[]>;
    onStatus(callback: (status: WebSpaceStatus) => void): () => void;
    show(id: string, rect: Rect): void;
    hide(): void;
    navigate(id: string, action: WebNavAction): void;
  };
  /** The app menu (⌘0–9) asks the UI to select a space; null = Home. */
  onSelect(callback: (id: string | null) => void): () => void;
}

declare global {
  interface Window {
    controlRoom: ControlRoomBridge;
  }
}
