"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCopy } from "@/i18n/use-copy";
import { usePhone } from "@/lib/media";
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
//
// A phone fits one column and no more (#357), so it shows one: the columns become pages of
// a swipe, under a band naming the one you are on. That band is the same band the columns
// wear at window width, moved above them and carrying the dots that say which of the two or
// three this is. Sideways movement here is paging, not reading — nothing on a column has to
// be scrolled sideways to be read.

// `ready` and `implementing` are both work already vetted — the second is just
// already in flight — so they share the first column, ready first. Everything
// else (`todo`, and a card carrying no status at all) is not ready to start.
//
// Exported because a card page has to name the column it came from (#357), and there is
// only one answer to which column a card is in.
export const isReadyHalf = (card: Card) => card.status === "ready" || card.status === "implementing";

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

// Two cards across (265px each) plus the bands' own padding, and one card
// across for Recurring. `min()` keeps a column inside a window narrower than it
// rather than hanging it off the edge; below `sm` the grid inside falls back to
// one card per row on its own. Neither is used at phone width — there a column
// is the screen (SwipedColumns).
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
  /** Tick or untick one. Left out draws no ticks at all — a screen that cannot write a
   *  card's release has nothing to tick them for (#374). */
  onSelect?: (id: number, next: boolean) => void;
}) {
  const c = useCopy().board.queue;
  const phone = usePhone();
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

  // Every column, once — the same list the window lays side by side and the phone pages
  // through, so neither shape can grow a column the other doesn't have.
  //
  // Recurring is a reserved folder, not a track someone named, and not part of the
  // ready/not-ready question at all — so it stands as its own column, narrower because it
  // is a list you glance at rather than the work you came here to pick from. The faint
  // lilac cast the board gives a schedule rides on the header band, which is the only
  // surface the column has left. Absent when nothing recurs: an empty column teaching a
  // feature nobody on this board uses is just noise.
  const cols: QueueCol[] = [
    {
      key: "ready",
      title: c.ready,
      count: c.readyCount(readyCount, implementingCount),
      width: HALF_W,
      body: (
        <Bands
          bands={ready}
          sessions={sessions}
          onOpenLog={onOpenLog}
          selected={selected}
          onSelect={onSelect}
        />
      ),
    },
    {
      key: "notReady",
      title: c.notReady,
      count: `${notReadyCount}`,
      width: HALF_W,
      body: (
        <Bands
          bands={notReady}
          sessions={sessions}
          onOpenLog={onOpenLog}
          selected={selected}
          onSelect={onSelect}
        />
      ),
    },
    ...(recurring.length > 0
      ? [
          {
            key: "recurring",
            title: c.recurring,
            count: `${recurring.length}`,
            width: NARROW_W,
            tint: "color-mix(in srgb, var(--color-nb-lilac) 16%, var(--color-nb-wash))",
            dot: "var(--color-nb-lilac-ink)",
            body: (
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
            ),
          } satisfies QueueCol,
        ]
      : []),
  ];

  if (phone) return <SwipedColumns cols={cols} />;

  return (
    // 16px all round, at every width. The queue sits on the window's paper now,
    // inside a body the rail has already taken 216px out of (components/Window)
    // — and this row scrolls sideways, so padding it wider on a wide screen
    // spends the width the rail was paid for.
    //
    // The gutter is 32px rather than 16: a column no longer has a fill marking
    // where it ends, so the gap is the only thing keeping two 2-up grids from
    // reading as one 4-up grid.
    <div className="flex min-h-0 flex-1 items-stretch gap-8 overflow-x-auto p-4">
      {cols.map((col) => (
        <QueueColumn
          key={col.key}
          title={col.title}
          count={col.count}
          width={col.width}
          tint={col.tint}
          dot={col.dot}
        >
          {col.body}
        </QueueColumn>
      ))}
    </div>
  );
}

/** One column of the queue, drawn either way. */
interface QueueCol {
  key: string;
  title: string;
  count: string;
  /** The fixed width the window lays it out at. A phone gives it the screen instead. */
  width: string;
  tint?: string;
  dot?: string;
  body: React.ReactNode;
}

/** The columns at phone width (#357): one on screen, swiped, under the band that names it.
 *
 *  The swipe is CSS — a scroll-snap strip of full-width pages — so it is the platform's own
 *  gesture with the platform's own momentum and rubber-banding, and it needs no gesture
 *  code to go wrong. Which page you are on is read back off the scroll rather than driven
 *  from state: a finger can leave the strip anywhere, and the band must say where it
 *  actually is.
 *
 *  The dots are buttons, not decoration. A swipe is not reachable from a keyboard, and a
 *  column you cannot get to is a column that isn't there. */
function SwipedColumns({ cols }: { cols: QueueCol[] }) {
  const c = useCopy().board.queue;
  const strip = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const onScroll = useCallback(() => {
    const el = strip.current;
    if (!el || el.clientWidth === 0) return;
    const page = Math.round(el.scrollLeft / el.clientWidth);
    setAt((was) => (was === page ? was : page));
  }, []);
  const go = (i: number) => {
    const el = strip.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  // Where a card page's way back leads (#357): it names the column the card sits in, so the
  // board has to open on that column and not on the first page of the swipe. Read straight
  // off the address rather than through `useSearchParams`, which the strip would need a
  // Suspense boundary for and which this — one read, after mount, at phone width only —
  // has no use for. Taken off the address once it is spent: a swipe away from that column
  // would otherwise leave the URL naming a column nobody is on.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const key = new URLSearchParams(window.location.search).get("column");
    if (!key) return;
    window.history.replaceState(null, "", window.location.pathname);
    const i = cols.findIndex((col) => col.key === key);
    const el = strip.current;
    if (i <= 0 || !el) return;
    el.scrollTo({ left: i * el.clientWidth });
    setAt(i);
  }, [cols]);
  // A column can go — the last recurring card is archived while the strip sits on it — and
  // the band must not name a column that is no longer there.
  const here = cols[Math.min(at, cols.length - 1)] ?? cols[0];
  if (!here) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="mx-2.5 mb-2.5 mt-2.5 flex h-10 shrink-0 items-center justify-between gap-2 rounded-[11px] pl-3 pr-1.5"
        style={{ background: here.tint ?? "var(--color-nb-wash)" }}
      >
        {/* The column's name never gives: it is what the band is for. The count gives
            first, then the dots — which stay a thumb's height however narrow the row
            gets, because that is the part you press. */}
        <h2 className="nb-tag shrink-0 whitespace-nowrap">
          <span style={{ color: here.dot ?? "var(--color-nb-accent)" }}>●</span>
          {here.title}
        </h2>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1">
          <span className="min-w-0 truncate text-[12px] text-nb-ink-soft">{here.count}</span>
          <span className="flex shrink-0 items-center">
            {cols.map((col, i) => (
              <button
                key={col.key}
                type="button"
                onClick={() => go(i)}
                aria-label={c.goToColumn(col.title)}
                aria-current={col === here ? "true" : undefined}
                className="grid h-10 w-5 cursor-pointer place-items-center"
              >
                <span
                  aria-hidden
                  className="block size-[6px] rounded-full"
                  style={{
                    background:
                      col === here
                        ? "var(--color-nb-ink)"
                        : "color-mix(in srgb, var(--color-nb-ink) 22%, transparent)",
                  }}
                />
              </button>
            ))}
          </span>
        </span>
      </div>
      {/* `overscroll-x-contain` so paging past the last column doesn't hand the swipe to
          the browser's own back gesture. */}
      <div
        ref={strip}
        onScroll={onScroll}
        aria-label={c.columns}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {cols.map((col) => (
          <section
            key={col.key}
            aria-label={col.title}
            className="min-h-0 w-full shrink-0 snap-center overflow-y-auto px-2.5 pb-3"
          >
            {col.body}
          </section>
        ))}
      </div>
    </div>
  );
}

// One column: no surface of its own, only a header band — a wash chip the width
// of the column, with the cards below it on the window's paper. The column used
// to be a rounded wash panel, which put a box inside the body's paper panel and
// a framed card inside that, three edges deep for two levels of meaning. The
// band keeps what the fill was actually for — a place for the column's name and
// its colour — and gives the cards the paper back (/design/layouts).
//
// It still scrolls on its own, so filling one column never pushes the others off.
function QueueColumn({
  title,
  count,
  width,
  tint,
  dot,
  children,
}: {
  title: string;
  count: string;
  width: string;
  tint?: string;
  /** The bullet's colour. It follows the band: on a lilac band an ember dot is
   *  the only ember left in the column, and it reads as a warning. */
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`flex min-h-0 shrink-0 flex-col ${width}`}>
      <div
        className="mb-3 flex h-8 shrink-0 items-center justify-between gap-3 rounded-[10px] px-2.5"
        style={{ background: tint ?? "var(--color-nb-wash)" }}
      >
        <h2 className="nb-tag">
          <span style={{ color: dot ?? "var(--color-nb-accent)" }}>●</span>
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
  onSelect?: (id: number, next: boolean) => void;
}) {
  const c = useCopy().board.queue;
  if (bands.length === 0) return <p className="text-[12px] italic text-nb-ink-soft">{c.empty}</p>;
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
// bands sit on the same paper, so a line and a name are all it takes.
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
  onSelect?: (id: number, next: boolean) => void;
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
