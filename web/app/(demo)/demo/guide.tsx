"use client";

// What /demo adds over the app: the ring on the one control that moves the script on, its
// one-line hint, and the step count in the corner. The ring is laid over the control rather
// than drawn by it, so the screens under it stay the app's own.
import { Button } from "ai4kanban-ui/components/button";
import { useEffect, useState } from "react";
import { FiRotateCcw } from "react-icons/fi";

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";

export interface Spot {
  /** The control, found again on every frame — the screens re-render under the ring. */
  find: () => Element | null;
  hint: string;
  side: Side;
  align?: Align;
  radius?: number;
  /** For a hint that has to fit the 16px between two blocks of the card page. */
  tight?: boolean;
}

/** Where the hint goes beside a box, as fixed-position styles. */
function hintAt(r: DOMRect, side: Side, align: Align, gap: number): React.CSSProperties {
  const along = (start: number, end: number, size: "X" | "Y") =>
    align === "start"
      ? { [size === "X" ? "left" : "top"]: start }
      : align === "end"
        ? { [size === "X" ? "right" : "bottom"]: (size === "X" ? innerWidth : innerHeight) - end }
        : { [size === "X" ? "left" : "top"]: (start + end) / 2, transform: `translate${size}(-50%)` };
  if (side === "bottom") return { top: r.bottom + gap, ...along(r.left, r.right, "X") };
  if (side === "top") return { bottom: innerHeight - r.top + gap, ...along(r.left, r.right, "X") };
  if (side === "right") return { left: r.right + gap, ...along(r.top, r.bottom, "Y") };
  return { right: innerWidth - r.left + gap, ...along(r.top, r.bottom, "Y") };
}

const ARROW: Record<Side, Record<Align, string>> = {
  bottom: { start: "-top-[4px] left-4", center: "-top-[4px] left-1/2 -ml-[4px]", end: "-top-[4px] right-4" },
  top: { start: "-bottom-[4px] left-4", center: "-bottom-[4px] left-1/2 -ml-[4px]", end: "-bottom-[4px] right-4" },
  right: { start: "-left-[4px] top-[10px]", center: "-left-[4px] top-1/2 -mt-[4px]", end: "-left-[4px] bottom-[10px]" },
  left: { start: "-right-[4px] top-[10px]", center: "-right-[4px] top-1/2 -mt-[4px]", end: "-right-[4px] bottom-[10px]" },
};

const same = (a: DOMRect | null, b: DOMRect | null) =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);

/** The accent ring around the step's control, and its hint. */
export function Ring({ spot }: { spot: Spot }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    let frame = 0;
    const follow = () => {
      const next = spot.find()?.getBoundingClientRect() ?? null;
      setRect((was) => (same(was, next) ? was : next));
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [spot]);
  if (!rect) return null;
  const align = spot.align ?? "center";
  return (
    <>
      <span
        aria-hidden
        data-demo-ring
        className="pointer-events-none fixed z-[60]"
        style={{
          left: rect.left - 3,
          top: rect.top - 3,
          width: rect.width + 6,
          height: rect.height + 6,
          borderRadius: (spot.radius ?? 8) + 3,
          boxShadow: "0 0 0 2.5px var(--color-nb-accent)",
        }}
      />
      <span
        role="status"
        className={`pointer-events-none fixed z-[60] whitespace-nowrap rounded-[8px] px-2.5 text-[12px] font-[700] leading-[16px] ${spot.tight ? "py-1" : "py-1.5"}`}
        style={{ ...hintAt(rect, spot.side, align, spot.tight ? 8 : 12), background: "var(--color-nb-ink)", color: "var(--color-nb-paper)" }}
      >
        <span aria-hidden className={`absolute size-2 rotate-45 ${ARROW[spot.side][align]}`} style={{ background: "var(--color-nb-ink)" }} />
        {spot.hint}
      </span>
    </>
  );
}

/** Bottom right of the body — clear of the chat rail when it is open. The last step offers
 *  Replay. */
export function Progress({ step, of, chat, replay }: { step: number; of: number; chat: boolean; replay?: React.ReactNode }) {
  return (
    <div
      className={`fixed bottom-4 ${chat ? "right-[444px]" : "right-4"} z-[70] flex items-center gap-3 rounded-[10px] border-[1.5px] border-nb-ink bg-nb-paper pl-3 shadow-[2px_2px_0_0_var(--color-nb-ink)]`}
      style={replay ? { height: 46, paddingRight: 9 } : { height: 36, paddingRight: 12 }}
    >
      <span className="text-[12px] font-[800] tabular-nums text-nb-ink">
        {step} <span className="text-nb-ink-soft">/ {of}</span>
      </span>
      {replay}
    </div>
  );
}

export function ReplayButton() {
  return (
    <Button size="xs" data-demo="replay">
      <FiRotateCcw className="text-[13px]" aria-hidden />
      Replay
    </Button>
  );
}
