"use client";

import { useState } from "react";
import { panelStatic } from "../styles";
import type { HomeCopy } from "@/i18n/types";

// The two board views as a flip deck: the front shot sits top-left, the other
// peeks out from behind — click it to bring it forward. Keeps both screenshots
// full size instead of shrinking them side by side, and nothing is drawn on top
// of the capture.

type Mode = "board" | "queue";

const SRC: Record<Mode, string> = {
  board: "https://cdn.ai4kanban.dev/ai4kanban-ui-v4-board-view.jpg",
  queue: "https://cdn.ai4kanban.dev/ai4kanban-ui-v4-queue-view.jpg",
};

function Frame({ mode, alt, eager }: { mode: Mode; alt: string; eager: boolean }) {
  return (
    <div
      className={`${panelStatic} overflow-hidden bg-code shadow-[8px_8px_0_0_#010409]`}
    >
      {/* Thin macOS title bar so the capture reads as a real app window. */}
      <div
        aria-hidden
        className="flex h-6 items-center gap-1.5 border-b-2 border-border bg-elev px-3"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SRC[mode]}
        alt={alt}
        className="block w-full"
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
      />
    </div>
  );
}

// How far the back card juts out from behind the front one (px). The deck lives
// in half a hero row, not a full column, so the offset stays small.
const PEEK = 40;

export function HeroShots({ c }: { c: HomeCopy["hero"]["shots"] }) {
  const [front, setFront] = useState<Mode>("board");
  const back: Mode = front === "board" ? "queue" : "board";
  // Paint back-to-front so the front card wins the stacking order naturally.
  const order: Mode[] = [back, front];

  return (
    // The container reserves PEEK on the right/bottom so the offset stays in
    // bounds; each card is narrowed by the same amount.
    <div
      className="relative w-full"
      style={{ paddingRight: PEEK, paddingBottom: PEEK }}
    >
      {/* Invisible sizer sets the container height; the real cards float on top. */}
      <div aria-hidden className="pointer-events-none invisible">
        <Frame mode={front} alt={c[front].alt} eager={false} />
      </div>

      {order.map((mode) => {
        const isFront = mode === front;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setFront(mode)}
            aria-label={(isFront ? c.frontAria : c.flipAria).replace(
              "{view}",
              c[mode].label,
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
            <Frame mode={mode} alt={c[mode].alt} eager={mode === "board"} />
            {/* Dims the back card; fades as it comes forward, lightens on hover. */}
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
