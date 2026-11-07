import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sidebar } from "./Sidebar";
import { WebSpaceView } from "./WebSpaceView";
import { QUOTES, shuffledIndices } from "./quotes";
import { findSelection, hairline, plannedStep, useAppState, useWebStatuses, type Selection } from "./state";

export function App() {
  const state = useAppState();
  const statuses = useWebStatuses();
  const [selected, setSelected] = useState<Selection>();

  // ⌘0–9 from the app menu.
  useEffect(
    () => window.controlRoom.onSelect((id) => setSelected(id && state ? findSelection(state, id) : undefined)),
    [state],
  );

  if (!state) return null;
  const isWeb = selected?.space.kind === "web" && !!selected.space.url;

  return (
    <div className="theme-fade flex h-full">
      <Sidebar state={state} statuses={statuses} selectedId={selected?.space.id} onSelect={setSelected} />
      <main
        className="relative m-2 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-2xl"
        style={{
          borderColor: hairline,
          // Full Liquid Glass: the window is translucent end to end (websites
          // stay opaque native surfaces — they never get the glass).
          background: "color-mix(in oklab, var(--cr-bg) 60%, transparent)",
        }}
      >
        {isWeb ? (
          <WebSpaceView key={selected!.space.id} {...selected!} status={statuses[selected!.space.id]} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selected?.space.id ?? "home"}
              className="flex flex-1 flex-col"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <header className="drag h-12 shrink-0" />
              {selected ? (
                <div className="flex flex-1 items-center justify-center text-center">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-fg-bright">{selected.space.title}</p>
                    <p className="mt-2 text-[13px] text-fg-dim">
                      Not built yet. It opens here in {plannedStep(selected.space)}.
                    </p>
                  </div>
                </div>
              ) : (
                <Home />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

function Home() {
  // Fresh shuffle on every launch, and a fresh shuffle each time the deck runs
  // out. The interval is created once and drives a functional setState, so it
  // can never hold a stale closure or depend on effect re-subscription.
  const [{ order, index }, setState] = useState(() => ({ order: shuffledIndices(QUOTES.length), index: 0 }));
  const advance = () =>
    setState(({ order, index }) =>
      index + 1 < order.length
        ? { order, index: index + 1 }
        : { order: shuffledIndices(QUOTES.length), index: 0 },
    );
  useEffect(() => {
    const timer = setInterval(advance, 120_000);
    return () => clearInterval(timer);
  }, []);
  const quote = QUOTES[order[index]];

  return (
    <button
      className="relative flex flex-1 cursor-default flex-col items-center justify-center overflow-hidden text-center"
      onClick={advance}
      aria-label="Next quote"
      data-testid="home"
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(45% 40% at 40% 35%, color-mix(in oklab, var(--cr-accent) 24%, transparent), transparent 70%), radial-gradient(40% 35% at 65% 60%, color-mix(in oklab, var(--cr-magenta) 16%, transparent), transparent 70%)",
        }}
        animate={{ opacity: [0.75, 1, 0.75], scale: [1, 1.04, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <AnimatePresence mode="wait">
        <motion.blockquote
          key={index}
          className="relative max-w-3xl px-8"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p
            className="bg-clip-text text-4xl font-medium tracking-tight text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(180deg, var(--cr-fg-bright), color-mix(in oklab, var(--cr-fg) 60%, transparent))",
            }}
          >
            {quote.text}
          </p>
          <footer className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-dim">
            — {quote.author}
          </footer>
        </motion.blockquote>
      </AnimatePresence>
    </button>
  );
}
