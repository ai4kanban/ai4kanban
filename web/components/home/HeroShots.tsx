"use client";

import { useState } from "react";
import { printFrame } from "./Mat";
import type { HomeCopy } from "@/i18n/home/types";

// The board and one card as a flip deck: the front shot sits top-left, the other
// peeks out from behind — click it to bring it forward. Keeps both screenshots
// full size instead of shrinking them side by side, and nothing is drawn on top
// of the capture.
//
// The deck is mounted on the hero's watercolour (`Hero.tsx`), so both cards are
// prints on a mat and take that treatment: `printFrame`'s soft shadow, and no
// outline on either. They used to carry the site's hard ink offset and a 2px
// ink frame on the front card, which is the right vocabulary on the page and
// the wrong one on pigment — an ink box on a painted ground is a frame drawn
// inside a frame, and the mat's own bleed is already the outer one.
//
// What separates the two is then the wash: the back card is dimmed toward the
// page and clears as it comes forward. One difference, carrying one meaning —
// this is the view you are looking at. It also means the pair never changes
// size on the flip, which the old border swap had to reserve 2px to avoid.

type Mode = "board" | "card";

const SRC: Record<Mode, string> = {
  board: "https://cdn.ai4kanban.dev/ai4kanban-ui-v5-board-view.jpg",
  card: "https://cdn.ai4kanban.dev/ai4kanban-ui-v5-card-view.jpg",
};

function Frame({
  mode,
  alt,
  eager,
}: {
  mode: Mode;
  alt: string;
  eager: boolean;
}) {
  return (
    // No title bar is drawn here. The deck used to carry a thin macOS strip so
    // the capture read as a real app window; these captures are of the desktop
    // app and bring their own — window buttons inline with the toolbar — and a
    // second strip above that reads as a window inside a window.
    <div className={`${printFrame} bg-code`}>
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

// How far the back card juts out from behind the front one (px). A fixed step
// rather than a share of the width: it is the ledge you click, so it has to
// stay a comfortable target on a phone, where a proportional offset would
// shrink to a sliver, and it must not grow into a shelf on a wide deck.
const PEEK = 40;

export function HeroShots({ c }: { c: HomeCopy["hero"]["shots"] }) {
  const [front, setFront] = useState<Mode>("board");
  const back: Mode = front === "board" ? "card" : "board";
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
            // The focus ring hugs the card: on the page it took a 2px offset in
            // the page ground, and on the mat that offset draws a neutral gap
            // through the pigment.
            className="group absolute left-0 top-0 origin-top-left text-left transition-transform duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep"
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
            {/* Washes the back card out toward the page; clears as it comes
                forward, thins on hover. Now that the outline is gone this is
                the whole of the front/back distinction, so it stays generous.
                `rounded-lg` to match `printFrame`. */}
            <span
              aria-hidden
              className={
                "pointer-events-none absolute inset-0 rounded-lg bg-bg/75 transition-opacity duration-300 " +
                (isFront ? "opacity-0" : "opacity-100 group-hover:opacity-40")
              }
            />
          </button>
        );
      })}
    </div>
  );
}
