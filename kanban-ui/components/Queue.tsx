"use client";

import type { Card, Column, SessionView } from "@/lib/types";
import { byQueueOrder } from "@/lib/pick-order";
import { BoardCard } from "./BoardCard";
import { runningSessionForCard } from "./sessions";

// The queue view (#70) — the board's second layout. The kanban view groups by
// track; this one answers a single question: what can I start now?
//
// It is not a filter. Every card the columns show appears here too — blockers
// and recurring cards are plain track folders, so they split by status like any
// other card, and a group root shows while its subtasks stay on its own page.
// The split only regroups the same cards.
//
// That is why it takes the board's `columns` rather than the board: the release
// dropdown (#104) hides cards before either view draws them, so both views
// regroup the very same set and can't disagree about what is on screen.

// `ready` and `implementing` are both work already vetted — the second is just
// already in flight — so they share the left half, ready first. Everything else
// (`todo`, and a card carrying no status at all, e.g. a recurring one) is not
// ready to start.
const isReadyHalf = (card: Card) => card.status === "ready" || card.status === "implementing";

export function QueueView({
  columns,
  sessions,
  onOpenLog,
}: {
  columns: Column[];
  sessions: SessionView[];
  onOpenLog: (sessionId: string) => void;
}) {
  const cards = columns.flatMap((col) => col.cards);
  const ready = cards.filter(isReadyHalf).sort(byQueueOrder);
  const notReady = cards.filter((c) => !isReadyHalf(c)).sort(byQueueOrder);

  // The ready half carries two numbers, because only the first is work waiting
  // on you — an implementing card is already being built and needs nothing.
  const readyCount = ready.filter((c) => c.status === "ready").length;
  const implementingCount = ready.length - readyCount;

  return (
    // Two halves side by side is a desktop shape. On a phone each one is far
    // narrower than a card, so below `md` they stack and the whole view scrolls
    // as one — ready first, which is the half you came here for.
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:flex-row md:items-stretch md:overflow-hidden md:p-6">
      <Half
        title="Ready to build"
        count={`${readyCount} ready · ${implementingCount} implementing`}
        cards={ready}
        sessions={sessions}
        onOpenLog={onOpenLog}
      />
      <Half
        title="Not ready"
        count={`${notReady.length}`}
        cards={notReady}
        sessions={sessions}
        onOpenLog={onOpenLog}
      />
    </div>
  );
}

// One half: the same wash panel a kanban column sits in, half the screen wide.
// The cards inside lay out as a grid that wraps to the width instead of a single
// stack — the half is wide enough for several across, and a one-card-wide column
// in half a screen would be mostly empty space. On a phone the grid falls back
// to one card per row, which is all that fits.
function Half({
  title,
  count,
  cards,
  sessions,
  onOpenLog,
}: {
  title: string;
  count: string;
  cards: Card[];
  sessions: SessionView[];
  onOpenLog: (sessionId: string) => void;
}) {
  return (
    <section
      // Stacked on a phone the half is as tall as its cards and the page
      // scrolls; side by side it takes half the width and scrolls on its own,
      // so filling one side never pushes the other off.
      className="flex min-w-0 shrink-0 flex-col rounded-[14px] p-3 md:min-h-0 md:shrink md:flex-1"
      style={{ background: "var(--color-nb-wash)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="nb-tag">
          <span style={{ color: "var(--color-nb-accent)" }}>●</span>
          {title}
        </h2>
        <span className="text-[12px] text-nb-ink-soft">{count}</span>
      </div>
      <div className="min-h-0 overflow-x-hidden pl-px pr-1 pt-px pb-1 md:flex-1 md:overflow-y-auto">
        {cards.length === 0 ? (
          <p className="text-[12px] italic text-nb-ink-soft">no open cards</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {cards.map((card) => (
              <BoardCard
                key={card.id}
                card={card}
                liveSession={runningSessionForCard(sessions, card.id)}
                onOpenLog={onOpenLog}
                // Every track is merged in here, so a card has to say where it
                // came from — otherwise a blocker at the top of the ready half
                // reads as just another card. Its release rides along in the
                // same row, on the cards that are in a version.
                showTrack
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
