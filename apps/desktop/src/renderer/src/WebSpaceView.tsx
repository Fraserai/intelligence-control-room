import { useLayoutEffect, useRef } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import type { Space, SpaceGroup, WebSpaceStatus } from "@control-room/contracts";
import { SpaceIcon } from "./SpaceIcon";

/**
 * A website inside the app. The page itself is a native view drawn by the
 * main process; this component just reports where it should sit.
 */
export function WebSpaceView(props: { group: SpaceGroup; space: Space; status?: WebSpaceStatus }) {
  const { group, space, status } = props;
  const slot = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = slot.current;
    if (!el) return;
    const send = () => {
      const r = el.getBoundingClientRect();
      window.controlRoom.web.show(space.id, { x: r.x, y: r.y, width: r.width, height: r.height });
    };
    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    window.addEventListener("resize", send);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", send);
      window.controlRoom.web.hide();
    };
  }, [space.id]);

  let host = "";
  try {
    host = new URL(status?.url || space.url || "").hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  const nav = (a: "back" | "forward" | "reload") => window.controlRoom.web.navigate(space.id, a);
  const btn =
    "no-drag grid size-7 place-items-center rounded-md text-fg-dim transition-colors hover:bg-[color-mix(in_oklab,var(--cr-fg)_8%,transparent)] hover:text-fg-bright disabled:opacity-30";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="drag relative flex h-12 shrink-0 items-center gap-1 px-3">
        <button className={btn} disabled={!status?.canGoBack} onClick={() => nav("back")} aria-label="Back">
          <ArrowLeft size={15} />
        </button>
        <button className={btn} disabled={!status?.canGoForward} onClick={() => nav("forward")} aria-label="Forward">
          <ArrowRight size={15} />
        </button>
        <button className={btn} onClick={() => nav("reload")} aria-label="Reload">
          <RotateCw size={14} />
        </button>
        <div className="ml-2 flex min-w-0 items-center gap-2">
          <SpaceIcon group={group} space={space} favicon={status?.favicon} size={18} />
          <span className="truncate text-[13px] font-medium text-fg-bright">{space.title}</span>
        </div>
        <span
          className="ml-auto rounded-md px-2 py-0.5 font-mono text-[11px] text-fg-dim"
          style={{ background: "color-mix(in oklab, var(--cr-fg) 6%, transparent)" }}
          title={status?.error}
        >
          {status?.error ? "can't reach site" : host}
        </span>
        {status?.loading && (
          <motion.div
            className="absolute right-0 bottom-0 left-0 h-[2px] origin-left"
            style={{ background: "linear-gradient(90deg, var(--cr-accent), var(--cr-magenta))" }}
            initial={{ scaleX: 0.05, opacity: 1 }}
            animate={{ scaleX: 0.85 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            data-testid="loading-bar"
          />
        )}
      </header>
      {/* The native website view is placed exactly over this box. */}
      <div ref={slot} className="mx-1.5 mb-1.5 min-h-0 flex-1 rounded-[10px]" data-testid="web-slot" />
    </div>
  );
}
