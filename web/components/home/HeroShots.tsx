"use client";

import { useState } from "react";
import { panelBareInset } from "../styles";
import type { HomeCopy } from "@/i18n/home/types";

// The two board views as a flip deck: the front shot sits top-left, the other
// peeks out from behind — click it to bring it forward. Keeps both screenshots
// full size instead of shrinking them side by side, and nothing is drawn on top
// of the capture.
//
// Both cards cast the same hard ink offset — they are two blocks of the same
// size lying on the same page, and a card that threw no shadow would read as
// printed onto it rather than stacked under the other. The outline is the only
// thing that separates them: the front card is framed, the back card isn't. One
// difference, carrying one meaning — this is the view you are looking at.
//
// The outline moves on the flip, so it is state and not decoration, and the
// front card's shadow lands on the back card's face rather than beside it,
// which is what stacking actually looks like.
//
// The back card still reserves its 2px, drawn in nothing. A border changes a
// box's size, and without this the pair would grow and shrink by 4px each way
// every time you flipped them.
const CARD_SHADOW = "shadow-[8px_8px_0_0_var(--color-ink)]";

type Mode = "board" | "queue";

const SRC: Record<Mode, string> = {
  board: "https://cdn.ai4kanban.dev/ai4kanban-ui-v4-board-view.jpg",
  queue: "https://cdn.ai4kanban.dev/ai4kanban-ui-v4-queue-view.jpg",
};

function Frame({
  mode,
  alt,
  eager,
  raised,
}: {
  mode: Mode;
  alt: string;
  eager: boolean;
  raised: boolean;
}) {
  return (
    // The outline is transitioned on the same 300ms the cards travel on, so it
    // moves with the flip instead of snapping to the new front card before it
    // has arrived.
    <div
      className={`${panelBareInset} ${CARD_SHADOW} overflow-hidden border-2 transition-[border-color] duration-300 ease-out ${
        raised ? "border-border" : "border-transparent"
      }`}
    >
      {/* Thin macOS title bar so the capture reads as a real app window. It
          names no fill and draws no rule: it is a strip of the card's own wash,
          and the capture's white underneath is the step that separates them. */}
      <div aria-hidden className="flex h-6 items-center gap-1.5 px-3">
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
        <Frame mode={front} alt={c[front].alt} eager={false} raised={false} />
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
            className="group absolute left-0 top-0 origin-top-left text-left transition-transform duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
            <Frame
              mode={mode}
              alt={c[mode].alt}
              eager={mode === "board"}
              raised={isFront}
            />
            {/* Washes the back card out toward the page; clears as it comes
                forward, thins on hover. */}
            <span
              aria-hidden
              className={
                "pointer-events-none absolute inset-0 rounded-xl bg-bg/75 transition-opacity duration-300 " +
                (isFront ? "opacity-0" : "opacity-100 group-hover:opacity-40")
              }
            />
          </button>
        );
      })}
    </div>
  );
}
