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
//
// Inside a half the cards keep their tracks, banded one under another in the
// board's own column order. The half is the answer to "can I start this", the
// band says "what kind of work is it" — so a card needs no track chip, and a
// reserved folder can colour its whole band instead of every card in it.

// `ready` and `implementing` are both work already vetted — the second is just
// already in flight — so they share the left half, ready first. Everything else
// (`todo`, and a card carrying no status at all, e.g. a recurring one) is not
// ready to start.
const isReadyHalf = (card: Card) => card.status === "ready" || card.status === "implementing";

/** One track's cards within a half. Empty bands are dropped before drawing —
 *  a track with nothing on this side of the split has nothing to say. */
interface Band {
  track: string;
  title: string;
  cards: Card[];
}

const bandsFor = (columns: Column[], keep: (card: Card) => boolean): Band[] =>
  columns
    .map((col) => ({
      track: col.track,
      title: col.title,
      cards: col.cards.filter(keep).sort(byQueueOrder),
    }))
    .filter((band) => band.cards.length > 0);

export function QueueView({
  columns,
  sessions,
  onOpenLog,
  selected,
  onSelect,
}: {
  columns: Column[];
  sessions: SessionView[];
  onOpenLog: (sessionId: string) => void;
  /** The cards ticked for the bulk release move (#114). Both views tick — they
   *  draw the same cards, and someone planning a version in the queue should
   *  not have to switch to the board to move them. */
  selected: Set<number>;
  onSelect: (id: number, next: boolean) => void;
}) {
  const ready = bandsFor(columns, isReadyHalf);
  const notReady = bandsFor(columns, (c) => !isReadyHalf(c));

  // The ready half carries two numbers, because only the first is work waiting
  // on you — an implementing card is already being built and needs nothing.
  const readyCards = ready.flatMap((b) => b.cards);
  const readyCount = readyCards.filter((c) => c.status === "ready").length;
  const implementingCount = readyCards.length - readyCount;
  const notReadyCount = notReady.reduce((n, b) => n + b.cards.length, 0);

  return (
    // Two halves side by side is a desktop shape. On a phone each one is far
    // narrower than a card, so below `md` they stack and the whole view scrolls
    // as one — ready first, which is the half you came here for.
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:flex-row md:items-stretch md:overflow-hidden md:p-6">
      <Half
        title="Ready to build"
        count={`${readyCount} ready · ${implementingCount} implementing`}
        bands={ready}
        sessions={sessions}
        onOpenLog={onOpenLog}
        selected={selected}
        onSelect={onSelect}
      />
      <Half
        title="Not ready"
        count={`${notReadyCount}`}
        bands={notReady}
        sessions={sessions}
        onOpenLog={onOpenLog}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

// One half: the same wash panel a kanban column sits in, half the screen wide,
// holding one band per track. The cards inside a band lay out as a grid that
// wraps to the width instead of a single stack — the half is wide enough for
// two or more across, and a one-card-wide column in half a screen would be
// mostly empty space. On a phone the grid falls back to one card per row.
function Half({
  title,
  count,
  bands,
  sessions,
  onOpenLog,
  selected,
  onSelect,
}: {
  title: string;
  count: string;
  bands: Band[];
  sessions: SessionView[];
  onOpenLog: (sessionId: string) => void;
  selected: Set<number>;
  onSelect: (id: number, next: boolean) => void;
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
        {bands.length === 0 ? (
          <p className="text-[12px] italic text-nb-ink-soft">no open cards</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bands.map((band) => (
              <TrackBand
                key={band.track}
                band={band}
                sessions={sessions}
                onOpenLog={onOpenLog}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// One track's cards inside a half: a rule carrying the track name and its count,
// then the grid. The rule is what cuts one track from the next — the bands sit
// on the same wash, so a line and a name are all it takes.
//
// `recurring` is a reserved folder, not a track someone named: its cards repeat
// on a cadence and are never finished, so its band takes the same faint lilac
// cast the kanban view gives the recurring column. The band is tinted, not the
// cards — a card looks the same wherever it sits, and the colour belongs to the
// kind of work, not to each box.
function TrackBand({
  band,
  sessions,
  onOpenLog,
  selected,
  onSelect,
}: {
  band: Band;
  sessions: SessionView[];
  onOpenLog: (sessionId: string) => void;
  selected: Set<number>;
  onSelect: (id: number, next: boolean) => void;
}) {
  const recurring = band.track === "recurring";
  return (
    <section
      className="rounded-[10px] px-2 pb-3 pt-2"
      style={
        recurring
          ? { background: "color-mix(in srgb, var(--color-nb-lilac) 16%, var(--color-nb-wash))" }
          : undefined
      }
    >
      <div className="mb-2.5 flex items-center gap-2.5">
        <h3 className="nb-tag text-[10.5px] whitespace-nowrap">{band.title}</h3>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{ background: "color-mix(in srgb, var(--color-nb-ink) 14%, transparent)" }}
        />
        <span className="text-[11px] tabular-nums text-nb-ink-soft">{band.cards.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {band.cards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
            liveSession={runningSessionForCard(sessions, card.id)}
            onOpenLog={onOpenLog}
            selected={selected.has(card.id)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
