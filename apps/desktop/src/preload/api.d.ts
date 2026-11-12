import type { AppState, Rect, TerminalSession, WebNavAction, WebSpaceStatus } from "@control-room/contracts";

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
  /** Coding agents running in terminals (owned by the main process). */
  term: {
    sessions(): Promise<TerminalSession[]>;
    /** Starts the agent if needed; returns its session and output so far. */
    attach(id: string): Promise<{ session: TerminalSession; backlog: string } | undefined>;
    input(id: string, data: string): void;
    resize(id: string, cols: number, rows: number): void;
    restart(id: string): Promise<void>;
    pickFolder(id: string): Promise<void>;
    onData(callback: (id: string, data: string) => void): () => void;
    onSession(callback: (session: TerminalSession) => void): () => void;
  };
  /** The app menu (⌘0–9) asks the UI to select a space; null = Home. */
  onSelect(callback: (id: string | null) => void): () => void;
}

declare global {
  interface Window {
    controlRoom: ControlRoomBridge;
  }
}
