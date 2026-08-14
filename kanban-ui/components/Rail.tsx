"use client";

// The rail down the left of the window: the board at the top, a box to find a
// card by typing, then every card this window has open, each one closeable (see
// app/design/layouts).
//
// It exists because a desktop window has neither a back gesture nor a back
// button — a trackpad swipe does nothing in an Electron window — so opening a
// card has to leave a mark on screen that is also the way back. That mark is a
// row here. All cards is the first row and never closes: it is the board.
//
// The rail has no surface of its own. It sits on the window's cream with the top
// row, so the two read as one L-shaped chrome rather than as two regions that
// each need an edge drawn to say where they stop.
//
// It doesn't own its width or its scrolling: it is the contents of a panel the
// window makes resizable (components/Window.tsx, lib/rail-width.ts), and that
// panel is also what drops the rail under `md` — at phone width it would take
// most of the window, and a browser there has the back button the desktop window
// doesn't (app/globals.css hides `#rail`, so the search box goes with it and
// there is no second, narrow design to keep). Rows are only kept tall enough to
// be aimed at with a trackpad.
//
// The rows scroll and the box above them does not: a one-letter search matches
// most of the board, and a window is not tall enough to be the limit on what can
// be found.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiColumns, FiSearch, FiX } from "react-icons/fi";
import { searchCardsAction } from "@/app/actions";
import type { OpenCard } from "@/lib/open-cards";
import type { CardRef } from "@/lib/types";
import { HAIRLINE, PULSE_DOT } from "./chrome";

/** How long the typing has to stop before the board is searched. Long enough that a
 *  word is one search and not six, short enough that it lands while the finger is
 *  still coming off the key. */
const SEARCH_PAUSE = 120;

export function Rail({
  rows,
  activeId,
  total,
  running,
  onClose,
}: {
  /** The open cards, in the order they were opened. */
  rows: OpenCard[];
  /** The card this window is showing, or null for the board. */
  activeId: number | null;
  /** How many cards the board holds open — the count on All cards. */
  total: number;
  /** The cards an agent is inside right now. A row for one of them pulses, so a
   *  run you started and walked away from still says so from wherever you are —
   *  the card page you're reading is one card, and its own badge can only speak
   *  for that one. The set comes from the page (Board, CardPage), which already
   *  polls the registry; the rail doesn't open a poll of its own for a dot. */
  running: Set<number>;
  onClose: (id: number) => void;
}) {
  const router = useRouter();
  const { query, setQuery, matches } = useCardSearch();
  const searching = query.trim().length > 0;

  // Closing the row you are standing on has to say where to stand instead: the
  // card after it, else the one before, else the board. Closing a row you are
  // not on moves nothing.
  const close = (id: number) => {
    onClose(id);
    if (id !== activeId) return;
    const at = rows.findIndex((c) => c.id === id);
    const next = rows[at + 1] ?? rows[at - 1] ?? null;
    router.push(next ? `/${next.id}` : "/");
  };

  return (
    <div className="flex h-full flex-col py-2 pl-3 pr-1">
      <SearchBox value={query} onChange={setQuery} />
      {/* What is typed replaces the open cards and nothing else. All cards stays:
          it is the board rather than a row of the list, and taking it away would
          be taking away the way out of a search. */}
      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
        aria-label={searching ? "Matching cards" : "Open cards"}
      >
        <RailRow href="/" label="All cards" active={activeId === null} count={total} />
        {searching ? (
          <>
            {matches !== null && <RailLabel text="Matches" count={matches.length} />}
            {matches?.map((card) => (
              <RailRow
                key={card.id}
                href={`/${card.id}`}
                label={card.title}
                id={card.id}
                active={card.id === activeId}
                running={running.has(card.id)}
              />
            ))}
            {matches?.length === 0 && (
              <p className="px-2.5 pt-1 text-[12px] leading-snug text-nb-ink-soft">
                No card matches.
              </p>
            )}
          </>
        ) : (
          <>
            {rows.length > 0 && <RailLabel text="Open cards" count={rows.length} />}
            {rows.map((card) => (
              <RailRow
                key={card.id}
                href={`/${card.id}`}
                label={card.title}
                id={card.id}
                active={card.id === activeId}
                running={running.has(card.id)}
                onClose={() => close(card.id)}
              />
            ))}
          </>
        )}
      </nav>
    </div>
  );
}

// What is typed, and the cards it found. The board is searched on the server
// (app/actions) because neither page the rail is drawn in holds the words to
// search: the board page has the cards its columns show and not a group's
// subtasks, and a card page has the one card it is showing.
//
// `matches` is the answer to the LAST search that came back, not to what is in
// the box this instant. It is deliberately kept while the next one is in flight
// — dropping it would flash the rail empty on every keystroke — and it is null
// only until the first answer of a search arrives, which is the one moment there
// is nothing honest to draw. That is also why "No card matches" is tied to an
// empty answer rather than to an empty `matches`: a search still running must
// not read as a search that found nothing.
function useCardSearch(): {
  query: string;
  setQuery: (q: string) => void;
  matches: CardRef[] | null;
} {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<CardRef[] | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (!q) {
      setMatches(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      searchCardsAction(q)
        .then((found) => {
          if (live) setMatches(found);
        })
        .catch(() => {
          // The board couldn't be read. Nothing found is the honest answer, and
          // the pages that can explain why already do.
          if (live) setMatches([]);
        });
    }, SEARCH_PAUSE);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q]);

  return { query, setQuery, matches };
}

/** The box at the top of the rail. It is a rail row's own geometry — same height,
 *  same corner, same 13px icon in the same place — so it reads as the row you type
 *  in rather than as a control parked above the list. The outline is inset like the
 *  open row's, since the rail has no surface to hang a border off.
 *
 *  The ✕ appears only with something to clear, and clearing is also Escape: the
 *  search is a detour off the rail's own list and both ways back are cheap. */
function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mb-1.5 shrink-0">
      <FiSearch
        size={13}
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-nb-ink-soft"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onChange("");
        }}
        placeholder="Find a card"
        aria-label="Find a card"
        spellCheck={false}
        autoComplete="off"
        className={`h-[30px] w-full rounded-[8px] bg-nb-paper pl-[30px] text-[12.5px] font-[600] text-nb-ink placeholder:font-[600] placeholder:text-nb-ink-soft/70 focus:outline-none ${
          value ? "pr-7" : "pr-2"
        } shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)]`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Clear the search"
          aria-label="Clear the search"
          className="absolute right-1 top-1/2 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-[5px] text-nb-ink opacity-60 hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] hover:opacity-100"
        >
          <FiX size={13} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** One row. The open row is paper with an inset ink outline rather than a hard
 *  shadow: at row height a shadow reads as a lifted button instead of as where
 *  you are.
 *
 *  The ✕ is a sibling of the link and not a child of it — a button inside an
 *  anchor is neither valid nor reachable — so it is placed over the row's right
 *  edge, and the link keeps room for it. The pulse dot goes at the far end of
 *  the link's own content, which stops where that reserved room begins, so the
 *  two never sit on top of each other and a hover doesn't hide the run. */
function RailRow({
  href,
  label,
  id,
  count,
  active,
  running = false,
  onClose,
}: {
  href: string;
  label: string;
  id?: number;
  count?: number;
  active: boolean;
  running?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="group relative">
      <Link
        href={href}
        title={running ? `${label} — running` : label}
        className={`flex h-[30px] w-full items-center gap-2 rounded-[8px] pl-2.5 text-left text-[12.5px] ${
          onClose ? "pr-7" : "pr-2"
        } ${
          active
            ? "bg-nb-paper font-[700] shadow-[inset_0_0_0_1.5px_var(--color-nb-ink)]"
            : "font-[600] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)]"
        }`}
      >
        {id === undefined ? (
          <FiColumns size={13} className="shrink-0" aria-hidden />
        ) : (
          <span
            className="shrink-0 font-mono text-[11px] tabular-nums"
            style={{ color: active ? "var(--color-nb-accent)" : "inherit", opacity: active ? 1 : 0.6 }}
          >
            {id}
          </span>
        )}
        <span className="truncate">{label}</span>
        {/* The dot is the whole message — a row is 30px and has no room for the
            verb the board's badge carries, and the card's own page is one click
            away to read which run it is. */}
        {running && (
          <>
            <span className={`ml-auto ${PULSE_DOT}`} aria-hidden />
            <span className="sr-only">running</span>
          </>
        )}
        {count !== undefined && (
          <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-nb-ink-soft">
            {count}
          </span>
        )}
      </Link>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          title={`Close ${label}`}
          aria-label={`Close ${label}`}
          className={`absolute right-1 top-1/2 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-[5px] text-nb-ink hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] focus-visible:opacity-100 group-hover:opacity-60 group-hover:hover:opacity-100 ${
            active ? "opacity-40" : "opacity-0"
          }`}
        >
          <FiX size={13} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A rail section title: 10px, upper, and carrying the count on the same line so
 *  the label row is never spent on the label alone. The hairline above it is
 *  what separates the board from the cards opened off it. */
function RailLabel({ text, count }: { text: string; count: number }) {
  return (
    <div
      className="mb-1 mt-2.5 flex items-center justify-between px-2.5 pb-1.5 pt-2.5"
      style={{ borderTop: `1px solid ${HAIRLINE}` }}
    >
      <span className="text-[10px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft">
        {text}
      </span>
      <span className="font-mono text-[10.5px] tabular-nums text-nb-ink-soft opacity-70">
        {count}
      </span>
    </div>
  );
}
