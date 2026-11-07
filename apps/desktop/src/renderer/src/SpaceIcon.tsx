import type { Space, SpaceGroup } from "@control-room/contracts";
import { fallbackLook, groupLook } from "./state";

/** The site's real favicon once known, otherwise a tinted icon for its group. */
export function SpaceIcon(props: { group: SpaceGroup; space: Space; favicon?: string; size?: number }) {
  const { group, favicon, size = 20 } = props;
  const look = groupLook[group.id] ?? fallbackLook;
  const Icon = look.icon;
  if (favicon) {
    return (
      <span
        className="grid shrink-0 place-items-center overflow-hidden rounded-md bg-white/90 shadow-sm"
        style={{ width: size, height: size }}
      >
        <img src={favicon} alt="" className="object-contain" style={{ width: size * 0.72, height: size * 0.72 }} />
      </span>
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-md"
      style={{
        width: size,
        height: size,
        background: `color-mix(in oklab, ${look.tint} 18%, transparent)`,
        color: look.tint,
      }}
    >
      <Icon size={Math.round(size * 0.6)} strokeWidth={2.2} />
    </span>
  );
}
