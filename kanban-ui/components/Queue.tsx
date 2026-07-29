"use client";

import type { Board, Card, SessionView } from "@/lib/types";
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

// `ready` and `implementing` are both work already vetted — the second is just
// already in flight — so they share the left half, ready first. Everything else
// (`todo`, and a card carrying no status at all, e.g. a recurring one) is not
// ready to start.
const isReadyHalf = (card: Card) => card.status === "ready" || card.status === "implementing";

export function QueueView({
  board,
  sessions,
  onOpenLog,
}: {
  board: Board;
  sessions: SessionView[];
  onOpenLog: (sessionId: string) => void;
}) {
  const cards = board.columns.flatMap((col) => col.cards);
  const ready = cards.filter(isReadyHalf).sort(byQueueOrder);
  const notReady = cards.filter((c) => !isReadyHalf(c)).sort(byQueueOrder);

  // The ready half carries two numbers, because only the first is work waiting
  // on you — an implementing card is already being built and needs nothing.
  const readyCount = ready.filter((c) => c.status === "ready").length;
  const implementingCount = ready.length - readyCount;

  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-hidden p-6">
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

// One half: the same wash panel a kanban column sits in, but half the screen
// wide and scrolling on its own, so filling one side never pushes the other off.
// The cards inside lay out as a grid that wraps to the width instead of a single
// stack — the half is wide enough for several across, and a one-card-wide column
// in half a screen would be mostly empty space.
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
      className="flex min-w-0 flex-1 flex-col rounded-[14px] p-3"
      style={{ background: "var(--color-nb-wash)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="nb-tag">
          <span style={{ color: "var(--color-nb-accent)" }}>●</span>
          {title}
        </h2>
        <span className="text-[12px] text-nb-ink-soft">{count}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pl-px pr-1 pt-px pb-1">
        {cards.length === 0 ? (
          <p className="text-[12px] italic text-nb-ink-soft">no open cards</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {cards.map((card) => (
              <BoardCard
                key={card.id}
                card={card}
                liveSession={runningSessionForCard(sessions, card.id)}
                onOpenLog={onOpenLog}
                // Every track is merged in here, so a card has to say where it
                // came from — otherwise a blocker at the top of the ready half
                // reads as just another card.
                showTrack
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
