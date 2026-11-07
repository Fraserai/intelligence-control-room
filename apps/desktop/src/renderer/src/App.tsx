import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sidebar } from "./Sidebar";
import { WebSpaceView } from "./WebSpaceView";
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
        className="relative m-2 ml-0 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-bg shadow-2xl"
        style={{ borderColor: hairline }}
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
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden">
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(45% 40% at 40% 35%, color-mix(in oklab, var(--cr-accent) 24%, transparent), transparent 70%), radial-gradient(40% 35% at 65% 60%, color-mix(in oklab, var(--cr-magenta) 16%, transparent), transparent 70%)",
        }}
        animate={{ opacity: [0.75, 1, 0.75], scale: [1, 1.04, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <h1
        className="relative bg-clip-text text-6xl font-semibold tracking-tighter text-transparent"
        style={{
          backgroundImage:
            "linear-gradient(180deg, var(--cr-fg-bright), color-mix(in oklab, var(--cr-fg) 55%, transparent))",
        }}
      >
        Control Room
      </h1>
      <p className="relative mt-3 text-[15px] text-fg-dim">The single command centre for your AI world.</p>
    </div>
  );
}
