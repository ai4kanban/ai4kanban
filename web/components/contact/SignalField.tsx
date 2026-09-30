"use client";

import { useEffect, useState } from "react";

// A faint pixel grid in the top-right corner behind the form panel, where a few
// cells glow ember in turn. Cells are the PixelMark's own: 9px with a 3px gap.
// It fades out before the left column, and the opaque panel covers it.

const STEP = 12;
const CYCLE_S = 6;

// [column from the right, row from the top]: the strip above the panel and the
// gutter to its right. The phone keeps the first six, all above the heading row.
const LIT = [
  [3, 2], [12, 1], [22, 3], [5, 9], [31, 2], [2, 16], [17, 2], [6, 24], [40, 2], [3, 31], [27, 3], [4, 39],
];
const LIT_PHONE = [[3, 1], [8, 2], [14, 1], [5, 3], [19, 2], [11, 3]];

const MASK =
  "radial-gradient(ellipse 55% 80% at 100% 0%, #000 0%, rgba(0,0,0,.5) 45%, transparent 100%), linear-gradient(transparent, #000 40px)";
const MASK_PHONE =
  "radial-gradient(ellipse 65% 90px at 100% 0%, #000 0%, transparent 100%), linear-gradient(transparent, #000 24px)";

const CSS = `
@keyframes signal { 0%, 45%, 100% { opacity: 0 } 12%, 30% { opacity: 1 } }
.signal { opacity: 0 }
@media (prefers-reduced-motion: no-preference) {
  .signal { animation: signal ${CYCLE_S}s ease-in-out infinite both }
  [data-paused] .signal { animation-play-state: paused }
}`;

export function SignalField() {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const sync = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return (
    <div aria-hidden data-paused={paused || undefined} className="pointer-events-none absolute inset-0 -z-10">
      <style>{CSS}</style>
      <Grid lit={LIT} mask={MASK} className="hidden lg:block" />
      <Grid lit={LIT_PHONE} mask={MASK_PHONE} className="lg:hidden" />
    </div>
  );
}

function Grid({ lit, mask, className }: { lit: number[][]; mask: string; className: string }) {
  return (
    <div
      className={`absolute inset-0 ${className}`}
      style={{ maskImage: mask, WebkitMaskImage: mask, maskComposite: "intersect", WebkitMaskComposite: "source-in" }}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundColor: "var(--color-code)",
          backgroundImage:
            "linear-gradient(to right, var(--color-bg) 3px, transparent 3px), linear-gradient(to bottom, var(--color-bg) 3px, transparent 3px)",
          backgroundSize: `${STEP}px ${STEP}px`,
          backgroundPosition: "right top",
        }}
      />
      {lit.map(([col, row], i) => (
        <span
          key={i}
          className="signal absolute h-[9px] w-[9px] bg-accent"
          style={{ right: col * STEP, top: row * STEP + 3, animationDelay: `${(-i * CYCLE_S) / lit.length}s` }}
        />
      ))}
    </div>
  );
}
