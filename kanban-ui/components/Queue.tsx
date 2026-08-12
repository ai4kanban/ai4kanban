"use client";

import type { Card, Column, SessionView } from "@/lib/types";
import { byQueueOrder } from "@/lib/pick-order";
import { BoardCard } from "./BoardCard";
import { runningSessionForCard } from "./sessions";

// The board's one layout (#70, and the kanban view's removal). It answers a
// single question — what can I start now? — by splitting every open card into
// two columns: work that is vetted, and work that isn't.
//
// It is not a filter. Every card the board holds appears here, blockers and
// group roots included: a group root shows while its subtasks stay on its own
// page, and a blocker splits by status like any other card. The split only
// regroups the same cards.
//
// That is why it takes the board's `columns` rather than the board: the release
// dropdown (#104) hides cards before this draws them, so what the columns hold
// and what is on screen can never disagree.
//
// Inside a column the cards keep their tracks, banded one under another in the
// board's own column order. The column is the answer to "can I start this", the
// band says "what kind of work is it" — so a card needs no track chip.
//
// The three columns are fixed width and the row scrolls sideways. A column that
// stretched to the window would rewrap its cards at every window size, and the
// board would look like a different board on a laptop and on a monitor; fixed
// widths mean two cards across in each half, one in Recurring, always. What a
// wider window buys is more of the row without scrolling, not wider cards.

// `ready` and `implementing` are both work already vetted — the second is just
// already in flight — so they share the first column, ready first. Everything
// else (`todo`, and a card carrying no status at all) is not ready to start.
const isReadyHalf = (card: Card) => card.status === "ready" || card.status === "implementing";

/** One track's cards within a column. Empty bands are dropped before drawing —
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

// Two cards across (260px each) plus the column's own padding, and one card
// across for Recurring. `min()` is what a phone gets: below the fixed width the
// column takes the window instead of hanging off it, and the grid inside falls
// back to one card per row on its own.
const HALF_W = "w-[min(560px,calc(100vw-2rem))]";
const NARROW_W = "w-[min(300px,calc(100vw-2rem))]";

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
  /** The cards ticked for the bulk release move (#114). */
  selected: Set<number>;
  onSelect: (id: number, next: boolean) => void;
}) {
  // A recurring card is pulled out before the split, not sorted by it: it is a
  // job on a cadence, never finished and never "ready to build", so leaving it
  // in would park every one of them at the bottom of Not ready — a pile of work
  // that is not late, next to work that is.
  const isRecurring = (c: Card) => c.recurring;
  const ready = bandsFor(columns, (c) => !isRecurring(c) && isReadyHalf(c));
  const notReady = bandsFor(columns, (c) => !isRecurring(c) && !isReadyHalf(c));
  const recurring = columns
    .flatMap((col) => col.cards)
    .filter(isRecurring)
    .sort(byQueueOrder);

  // The ready column carries two numbers, because only the first is work waiting
  // on you — an implementing card is already being built and needs nothing.
  const readyCards = ready.flatMap((b) => b.cards);
  const readyCount = readyCards.filter((c) => c.status === "ready").length;
  const implementingCount = readyCards.length - readyCount;
  const notReadyCount = notReady.reduce((n, b) => n + b.cards.length, 0);

  return (
    // 16px all round, at every width. The queue sits on the window's paper now,
    // inside a body the rail has already taken 216px out of (components/Window)
    // — and this row scrolls sideways, so padding it wider on a wide screen
    // spends the width the rail was paid for.
    <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto p-4">
      <QueueColumn
        title="Ready to build"
        count={`${readyCount} ready · ${implementingCount} implementing`}
        width={HALF_W}
      >
        <Bands
          bands={ready}
          sessions={sessions}
          onOpenLog={onOpenLog}
          selected={selected}
          onSelect={onSelect}
        />
      </QueueColumn>

      <QueueColumn title="Not ready" count={`${notReadyCount}`} width={HALF_W}>
        <Bands
          bands={notReady}
          sessions={sessions}
          onOpenLog={onOpenLog}
          selected={selected}
          onSelect={onSelect}
        />
      </QueueColumn>

      {/* Recurring is a reserved folder, not a track someone named, and not part
          of the ready/not-ready question at all — so it stands as its own
          column, narrower because it is a list you glance at rather than the
          work you came here to pick from. It carries the faint lilac cast the
          board gives a schedule. Absent when nothing recurs: an empty column
          teaching a feature nobody on this board uses is just noise. */}
      {recurring.length > 0 && (
        <QueueColumn
          title="Recurring"
          count={`${recurring.length}`}
          width={NARROW_W}
          tint="color-mix(in srgb, var(--color-nb-lilac) 16%, var(--color-nb-wash))"
        >
          <div className="flex flex-col gap-3">
            {recurring.map((card) => (
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
        </QueueColumn>
      )}
    </div>
  );
}

// One column: a wash panel of its own width, scrolling on its own so filling one
// never pushes the others off.
function QueueColumn({
  title,
  count,
  width,
  tint,
  children,
}: {
  title: string;
  count: string;
  width: string;
  tint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`flex min-h-0 shrink-0 flex-col rounded-[14px] p-3 ${width}`}
      style={{ background: tint ?? "var(--color-nb-wash)" }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="nb-tag">
          <span style={{ color: "var(--color-nb-accent)" }}>●</span>
          {title}
        </h2>
        <span className="shrink-0 text-[12px] text-nb-ink-soft">{count}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pl-px pr-1 pt-px pb-1">
        {children}
      </div>
    </section>
  );
}

function Bands({
  bands,
  sessions,
  onOpenLog,
  selected,
  onSelect,
}: {
  bands: Band[];
  sessions: SessionView[];
  onOpenLog: (sessionId: string) => void;
  selected: Set<number>;
  onSelect: (id: number, next: boolean) => void;
}) {
  if (bands.length === 0) return <p className="text-[12px] italic text-nb-ink-soft">no open cards</p>;
  return (
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
  );
}

// One track's cards inside a column: a rule carrying the track name and its
// count, then the grid. The rule is what cuts one track from the next — the
// bands sit on the same wash, so a line and a name are all it takes.
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
  return (
    <section className="rounded-[10px] px-2 pb-3 pt-2">
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
