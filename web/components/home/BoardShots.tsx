"use client";

import { useState } from "react";
import { panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/types";

// The two board views, stacked as a flip deck like the Hero's Quickview: the
// front shot sits top-left, the other peeks out from behind — click it to bring
// it forward. Lets both screenshots stay large instead of shrinking side by side.

type Mode = "board" | "detail";

const SRC: Record<Mode, string> = {
  board: "https://cdn.ai4kanban.dev/kanban-skill-ui-v3.jpg",
  detail: "https://cdn.ai4kanban.dev/kanban-skill-ui-detail-v3.jpg",
};

// One browser-framed screenshot on localhost.
function Frame({ mode, alt }: { mode: Mode; alt: string }) {
  return (
    <div className={`${panelStatic} overflow-hidden bg-code shadow-[8px_8px_0_0_#010409]`}>
      <div className="flex items-center gap-1.5 border-b-2 border-border px-3 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-2 font-mono text-[0.7rem] text-muted">localhost:7420</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SRC[mode]} alt={alt} loading="lazy" className="w-full" />
    </div>
  );
}

// How far the back card peeks out from behind the front one (px).
const PEEK = 56;

export function BoardShots({ c }: { c: HomeCopy["ui"] }) {
  const [front, setFront] = useState<Mode>("board");
  const back: Mode = front === "board" ? "detail" : "board";
  // Paint back-to-front so the front card wins the stacking order naturally.
  const order: Mode[] = [back, front];

  return (
    <div
      className="relative w-full"
      style={{ paddingRight: PEEK, paddingBottom: PEEK }}
    >
      {/* Invisible sizer establishes the container height; real cards float on top. */}
      <div aria-hidden className="pointer-events-none invisible">
        <Frame mode={front} alt={c.shots[front].alt} />
      </div>

      {order.map((mode) => {
        const isFront = mode === front;
        const label = c.shots[mode].label;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setFront(mode)}
            aria-label={(isFront ? c.frontAria : c.flipAria).replace(
              "{view}",
              label,
            )}
            aria-pressed={isFront}
            className="group absolute left-0 top-0 origin-top-left text-left transition-transform duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            style={{
              width: `calc(100% - ${PEEK}px)`,
              zIndex: isFront ? 20 : 10,
              transform: isFront
                ? "translate(0px, 0px)"
                : `translate(${PEEK}px, ${PEEK}px)`,
              cursor: isFront ? "default" : "pointer",
            }}
            tabIndex={isFront ? -1 : 0}
          >
            <Frame mode={mode} alt={c.shots[mode].alt} />
            {/* Dim the back card; fades as it comes forward, lightens on hover. */}
            <span
              aria-hidden
              className={
                "pointer-events-none absolute inset-0 rounded-lg bg-black/60 transition-opacity duration-300 " +
                (isFront ? "opacity-0" : "opacity-100 group-hover:opacity-40")
              }
            />
          </button>
        );
      })}
    </div>
  );
}
