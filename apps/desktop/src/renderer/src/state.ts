import { useEffect, useState } from "react";
import { Globe, MessagesSquare, Server, SquareTerminal } from "lucide-react";
import type { AppState, Space, SpaceGroup, WebSpaceStatus } from "@control-room/contracts";

export type Selection = { group: SpaceGroup; space: Space } | undefined;
export type Statuses = Record<string, WebSpaceStatus>;

/** App state from the main process, with the theme applied to the page. */
export function useAppState(): AppState | undefined {
  const [state, setState] = useState<AppState>();
  useEffect(() => {
    void window.controlRoom.getState().then((s) => s && setState(s));
    return window.controlRoom.onState(setState);
  }, []);
  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    for (const [name, value] of Object.entries(state.theme.cssVars)) root.style.setProperty(name, value);
    root.dataset.mode = state.theme.mode;
    root.dataset.theme = state.theme.name;
  }, [state]);
  return state;
}

/** Live status (title, loading, favicon) of every website. */
export function useWebStatuses(): Statuses {
  const [statuses, setStatuses] = useState<Statuses>({});
  useEffect(() => {
    void window.controlRoom.web
      .statuses()
      .then((list) => setStatuses((prev) => ({ ...Object.fromEntries(list.map((s) => [s.id, s])), ...prev })));
    return window.controlRoom.web.onStatus((s) => setStatuses((prev) => ({ ...prev, [s.id]: s })));
  }, []);
  return statuses;
}

export function findSelection(state: AppState, id: string): Selection {
  for (const group of state.spaces.groups) {
    const space = group.spaces.find((s) => s.id === id);
    if (space) return { group, space };
  }
  return undefined;
}

export const groupLook: Record<string, { icon: typeof Globe; tint: string }> = {
  llms: { icon: MessagesSquare, tint: "var(--cr-accent)" },
  "coding-agents": { icon: SquareTerminal, tint: "var(--cr-green)" },
  providers: { icon: Server, tint: "var(--cr-orange)" },
  sites: { icon: Globe, tint: "var(--cr-cyan)" },
};
export const fallbackLook = { icon: Globe, tint: "var(--cr-blue)" };

/** Which build step (PLAN.md section 4) makes each kind of space work. */
export function plannedStep(space: Space): string {
  if (space.kind === "local-app") return "build step 7 (HuggingChat)";
  return "a later step";
}

/** Subtle hairline colour that works in light and dark themes. */
export const hairline = "color-mix(in oklab, var(--cr-fg) 9%, transparent)";

/** Which coding agents are running in a terminal right now. */
export function useAgentsRunning(): Record<string, boolean> {
  const [running, setRunning] = useState<Record<string, boolean>>({});
  useEffect(() => {
    void window.controlRoom.term
      .sessions()
      .then((list) => setRunning((prev) => ({ ...Object.fromEntries(list.map((s) => [s.id, s.running])), ...prev })));
    return window.controlRoom.term.onSession((s) => setRunning((prev) => ({ ...prev, [s.id]: s.running })));
  }, []);
  return running;
}
