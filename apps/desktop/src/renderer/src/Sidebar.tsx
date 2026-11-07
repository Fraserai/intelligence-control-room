import { motion } from "motion/react";
import { Palette, TriangleAlert } from "lucide-react";
import type { AppState } from "@control-room/contracts";
import { SpaceIcon } from "./SpaceIcon";
import type { Selection, Statuses } from "./state";

export function Sidebar(props: {
  state: AppState;
  statuses: Statuses;
  selectedId?: string;
  onSelect: (s: Selection) => void;
}) {
  const { state, statuses, selectedId, onSelect } = props;
  return (
    <aside
      className="flex w-[260px] shrink-0 flex-col"
      style={{ background: "color-mix(in oklab, var(--cr-bg-dark) 42%, transparent)" }}
    >
      {/* Room for the macOS window buttons. */}
      <div className="drag h-[52px] shrink-0" />

      <button
        className="no-drag mx-3 mb-4 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--cr-fg)_6%,transparent)]"
        onClick={() => onSelect(undefined)}
        data-testid="home-button"
      >
        <span
          className="relative grid size-7 place-items-center overflow-hidden rounded-lg text-[11px] font-bold tracking-tight text-white shadow-lg"
          style={{
            background: "linear-gradient(135deg, var(--cr-accent), var(--cr-magenta))",
            boxShadow: "0 6px 20px -6px color-mix(in oklab, var(--cr-accent) 70%, transparent)",
          }}
        >
          CR
        </span>
        <span className="text-[14px] font-semibold tracking-tight text-fg-bright">Control Room</span>
      </button>

      <nav className="no-drag flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {state.spaces.groups.map((group) => (
          <section key={group.id}>
            <h2 className="mb-1 px-2 text-[10.5px] font-semibold tracking-[0.08em] text-fg-dim uppercase">
              {group.title}
            </h2>
            <ul className="space-y-px">
              {group.spaces.map((space) => {
                const active = space.id === selectedId;
                const status = statuses[space.id];
                const open = !!status?.open;
                return (
                  <li key={space.id} className="relative">
                    {active && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute inset-0 rounded-lg"
                        style={{
                          background: "color-mix(in oklab, var(--cr-fg) 10%, transparent)",
                          boxShadow: `inset 0 0 0 1px color-mix(in oklab, var(--cr-fg) 7%, transparent)`,
                        }}
                        transition={{ type: "spring", stiffness: 520, damping: 40 }}
                      />
                    )}
                    <button
                      data-space={space.id}
                      onClick={() => onSelect({ group, space })}
                      className="relative flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition-colors hover:bg-[color-mix(in_oklab,var(--cr-fg)_5%,transparent)]"
                      style={{ color: active ? "var(--cr-fg-bright)" : "var(--cr-fg)" }}
                    >
                      <SpaceIcon group={group} space={space} favicon={status?.favicon} />
                      <span className="truncate">{space.title}</span>
                      {space.kind === "web" && open && (
                        <LiveDot loading={!!status?.loading} error={!!status?.error} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>

      {state.errors.length > 0 && (
        <div className="no-drag mx-3 mb-2 space-y-2" data-testid="config-errors">
          {state.errors.map((err) => (
            <div
              key={err.file + err.message}
              className="rounded-lg border p-2.5 text-[11.5px]"
              style={{
                background: "color-mix(in oklab, var(--cr-red) 10%, var(--cr-bg-lighter))",
                borderColor: "color-mix(in oklab, var(--cr-red) 40%, transparent)",
              }}
            >
              <p className="flex items-center gap-1.5 font-medium text-fg-bright">
                <TriangleAlert size={12} className="text-red" /> {err.file}
              </p>
              <p className="mt-1 break-words text-fg-dim">{err.message}</p>
              <p className="mt-1 text-fg-dim">Still using the last good version.</p>
            </div>
          ))}
        </div>
      )}

      <footer className="no-drag flex items-center gap-2 px-5 py-3 text-[11px] text-fg-dim">
        <Palette size={12} />
        <span data-testid="theme-name">{state.theme.name}</span>
        <span className="ml-auto font-mono text-[10px] opacity-70">⌘1–9</span>
      </footer>
    </aside>
  );
}

/** A small dot: this site is open in the background (pulses while loading, red if it failed). */
function LiveDot({ loading, error }: { loading: boolean; error: boolean }) {
  const tint = error ? "var(--cr-red)" : loading ? "var(--cr-accent)" : "color-mix(in oklab, var(--cr-green) 85%, transparent)";
  return (
    <span
      className="relative ml-auto grid size-2 place-items-center"
      data-testid="live-dot"
      data-state={error ? "error" : loading ? "loading" : "open"}
    >
      {loading && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: "var(--cr-accent)" }}
          animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      <span className="size-1.5 rounded-full" style={{ background: tint }} />
    </span>
  );
}
