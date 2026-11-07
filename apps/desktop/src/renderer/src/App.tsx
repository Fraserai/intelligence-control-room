import { useEffect, useState, type CSSProperties } from "react";
import { Globe, MessagesSquare, Palette, Server, SquareTerminal, TriangleAlert } from "lucide-react";
import type { AppState, Space, SpaceGroup } from "@control-room/contracts";

/** Which build step (PLAN.md section 4) makes each kind of space work. */
function plannedStep(group: SpaceGroup, space: Space): string {
  if (space.kind === "coding-agent") return "build step 3 (coding agents)";
  if (space.kind === "local-app") return "build step 7 (HuggingChat)";
  if (group.id === "llms") return "build step 2 (LLMs)";
  return "build step 4 (providers and sites)";
}

const groupLook: Record<string, { icon: typeof Globe; tint: string }> = {
  llms: { icon: MessagesSquare, tint: "var(--cr-accent)" },
  "coding-agents": { icon: SquareTerminal, tint: "var(--cr-green)" },
  providers: { icon: Server, tint: "var(--cr-orange)" },
  sites: { icon: Globe, tint: "var(--cr-cyan)" },
};
const fallbackLook = { icon: Globe, tint: "var(--cr-blue)" };

function useAppState(): AppState | undefined {
  const [state, setState] = useState<AppState>();
  useEffect(() => {
    void window.controlRoom.getState().then((s) => s && setState(s));
    return window.controlRoom.onState(setState);
  }, []);
  // Apply the theme's colours to the whole page.
  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    for (const [name, value] of Object.entries(state.theme.cssVars)) root.style.setProperty(name, value);
    root.dataset.mode = state.theme.mode;
    root.dataset.theme = state.theme.name;
  }, [state]);
  return state;
}

export function App() {
  const state = useAppState();
  const [selected, setSelected] = useState<{ group: SpaceGroup; space: Space }>();

  if (!state) return null;

  return (
    <div className="theme-fade flex h-full">
      <Sidebar state={state} selectedId={selected?.space.id} onSelect={setSelected} />
      <main
        className="relative m-2 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-bg shadow-2xl"
        style={{ borderColor: "color-mix(in oklab, var(--cr-fg) 9%, transparent)" }}
      >
        <header className="drag flex h-12 shrink-0 items-center px-5 text-[13px] font-medium text-fg-dim">
          {selected ? selected.space.title : "Home"}
        </header>
        {selected ? <SpacePlaceholder {...selected} /> : <Home />}
        <ErrorToasts state={state} />
      </main>
    </div>
  );
}

function Sidebar(props: {
  state: AppState;
  selectedId?: string;
  onSelect: (s: { group: SpaceGroup; space: Space } | undefined) => void;
}) {
  const { state, selectedId, onSelect } = props;
  return (
    <aside
      className="flex w-[260px] shrink-0 flex-col"
      style={{ background: "color-mix(in oklab, var(--cr-bg-dark) 88%, transparent)" }}
    >
      {/* Room for the macOS window buttons. */}
      <div className="drag h-[52px] shrink-0" />
      <button
        className="no-drag mx-3 mb-3 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-[color-mix(in_oklab,var(--cr-fg)_6%,transparent)]"
        onClick={() => onSelect(undefined)}
      >
        <span
          className="grid size-6 place-items-center rounded-md text-[11px] font-bold text-bg"
          style={{ background: "linear-gradient(135deg, var(--cr-accent), var(--cr-magenta))" }}
        >
          CR
        </span>
        <span className="text-[14px] font-semibold tracking-tight text-fg-bright">Control Room</span>
      </button>

      <nav className="no-drag flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {state.spaces.groups.map((group) => {
          const look = groupLook[group.id] ?? fallbackLook;
          const Icon = look.icon;
          return (
            <section key={group.id}>
              <h2 className="mb-1 px-2 text-[11px] font-medium tracking-wide text-fg-dim uppercase">
                {group.title}
              </h2>
              <ul className="space-y-px">
                {group.spaces.map((space) => {
                  const active = space.id === selectedId;
                  return (
                    <li key={space.id}>
                      <button
                        data-space={space.id}
                        onClick={() => onSelect({ group, space })}
                        className="group flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition-colors"
                        style={
                          active
                            ? {
                                background: "color-mix(in oklab, var(--cr-fg) 10%, transparent)",
                                color: "var(--cr-fg-bright)",
                              }
                            : { color: "var(--cr-fg)" }
                        }
                      >
                        <span
                          className="grid size-5 shrink-0 place-items-center rounded-md"
                          style={{
                            background: `color-mix(in oklab, ${look.tint} 18%, transparent)`,
                            color: look.tint,
                          }}
                        >
                          <Icon size={12} strokeWidth={2.2} />
                        </span>
                        <span className="truncate">{space.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </nav>

      <footer className="no-drag flex items-center gap-2 px-5 py-3 text-[11px] text-fg-dim">
        <Palette size={12} />
        <span data-testid="theme-name">{state.theme.name}</span>
      </footer>
    </aside>
  );
}

function Home() {
  const glow: CSSProperties = {
    background:
      "radial-gradient(60% 50% at 50% 35%, color-mix(in oklab, var(--cr-accent) 22%, transparent), transparent 70%)",
  };
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0" style={glow} />
      <h1
        className="relative bg-clip-text text-6xl font-semibold tracking-tighter text-transparent"
        style={{
          backgroundImage: "linear-gradient(180deg, var(--cr-fg-bright), color-mix(in oklab, var(--cr-fg) 55%, transparent))",
        }}
      >
        Control Room
      </h1>
      <p className="relative mt-3 text-[15px] text-fg-dim">The single command centre for your AI world.</p>
    </div>
  );
}

function SpacePlaceholder({ group, space }: { group: SpaceGroup; space: Space }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-tight text-fg-bright">{space.title}</p>
        <p className="mt-2 text-[13px] text-fg-dim">
          Not built yet. It opens here in {plannedStep(group, space)}.
        </p>
      </div>
    </div>
  );
}

function ErrorToasts({ state }: { state: AppState }) {
  if (state.errors.length === 0) return null;
  return (
    <div className="absolute right-4 bottom-4 max-w-md space-y-2" data-testid="config-errors">
      {state.errors.map((err) => (
        <div
          key={err.file + err.message}
          className="flex gap-3 rounded-lg border p-3 text-[12px] shadow-xl"
          style={{
            background: "var(--cr-bg-lighter)",
            borderColor: "color-mix(in oklab, var(--cr-red) 45%, transparent)",
          }}
        >
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-red" />
          <div>
            <p className="font-medium text-fg-bright">{err.file}</p>
            <p className="mt-0.5 break-words text-fg-dim">{err.message}</p>
            <p className="mt-1 text-fg-dim">Still using the last good version.</p>
          </div>
        </div>
      ))}
    </div>
  );
}
