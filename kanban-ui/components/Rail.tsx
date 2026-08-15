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
// be found. The Memory panel at the foot (#129) doesn't scroll with them either —
// see MemoryPanel below.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiChevronRight, FiColumns, FiFileText, FiSearch, FiX } from "react-icons/fi";
import { searchCardsAction } from "@/app/actions";
import { memoryKey, memoryModuleOf, useMemoryPanel, useOpenModules } from "@/lib/memory-panel";
import type { OpenCard } from "@/lib/open-cards";
import { MEMORY_FILES, type CardRef, type MemoryModule } from "@/lib/types";
import { HAIRLINE, PULSE_DOT } from "./chrome";

/** How long the typing has to stop before the board is searched. Long enough that a
 *  word is one search and not six, short enough that it lands while the finger is
 *  still coming off the key. */
const SEARCH_PAUSE = 120;

export function Rail({
  rows,
  activeId,
  activeMemory = null,
  memoryModules = [],
  total,
  running,
  onClose,
}: {
  /** The open cards, in the order they were opened. */
  rows: OpenCard[];
  /** The card this window is showing, or null for the board. */
  activeId: number | null;
  /** The memory file this window is showing, as a memory key, or null (#129). */
  activeMemory?: string | null;
  /** The modules the memory panel offers, in the map's order (#130). */
  memoryModules?: MemoryModule[];
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
        {/* A memory page is neither a card nor the board, so All cards is not where
            you are while one is open. */}
        <RailRow href="/" label="All cards" active={activeId === null && !activeMemory} count={total} />
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
      <MemoryPanel active={activeMemory} modules={memoryModules} />
    </div>
  );
}

/** The board's memory, at the foot of the rail (#129, #130) — what shipped, what was
 *  settled, what to avoid, what was turned down, for the project and for each module the map
 *  names. It sits below the cards and outside the list that scrolls, so it stays put however
 *  many cards are open and whatever is typed in the search box: it is not one of the cards,
 *  and a search is no reason to lose it.
 *
 *  Collapsed it is one section label with an arrow, and the whole row is the button — a
 *  10px arrow is not something to have to hit. Expanded it grows with its rows to half the
 *  rail and scrolls past that, so the cards you were reading are never pushed off.
 *
 *  It slides rather than appears: the rows push the cards up from under the label, so where
 *  they came from is visible instead of guessed at. The height is animated with a grid row
 *  going 0fr → 1fr, which needs no measuring and so keeps working when the list grows. */
function MemoryPanel({ active, modules }: { active: string | null; modules: MemoryModule[] }) {
  const { open, toggle, animate } = useMemoryPanel(active);
  const { isOpen, toggle: toggleModule } = useOpenModules(memoryModuleOf(active));
  const slide = animate ? "transition-[grid-template-rows,opacity] duration-200 ease-out" : "";
  // The two halves are only worth naming when there is a second half to name. A board whose
  // map has no modules keeps the four rows it had.
  const split = modules.length > 0;
  return (
    <div className="flex max-h-[50%] shrink-0 flex-col">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="memory-files"
        title={open ? "Hide the project's memory" : "What the agent remembers about this project"}
        className="mt-2.5 flex w-full shrink-0 cursor-pointer items-center justify-between px-2.5 pb-1.5 pt-2.5 text-nb-ink-soft hover:text-nb-ink"
        style={{ borderTop: `1px solid ${HAIRLINE}` }}
      >
        <span className="text-[10px] font-[800] uppercase tracking-[0.12em]">Memory</span>
        <FiChevronRight
          size={13}
          aria-hidden
          className={`${animate ? "transition-transform duration-200 ease-out" : ""} ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>
      {/* The rows stay mounted while closed — a slide has to have something to slide — so
          they are taken out of the tab order and off the screen reader until they are open. */}
      <div
        className={`grid min-h-0 overflow-hidden ${slide} ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <nav id="memory-files" inert={!open} className="min-h-0 overflow-y-auto" aria-label="Memory">
          {/* The rows' own breathing room is inside the scroller, not padding on it: padding
              is floor a 0fr track can't shrink past, and closed has to close all the way. */}
          <div className="flex flex-col gap-0.5 py-1">
            {split && <PanelLabel text="Project" />}
            <MemoryFileRows module="" active={active} />
            {split && <PanelLabel text="Modules" divider />}
            {modules.map((module) => (
              <div key={module.name}>
                <button
                  type="button"
                  onClick={() => toggleModule(module.name)}
                  aria-expanded={isOpen(module.name)}
                  title={`docs/kanban/memory/${module.name}/`}
                  className="flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-[8px] px-2.5 text-left text-[12.5px] font-[600] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)] hover:text-nb-ink"
                >
                  <FiChevronRight
                    size={13}
                    aria-hidden
                    className={`shrink-0 transition-transform duration-150 ease-out ${
                      isOpen(module.name) ? "rotate-90" : ""
                    }`}
                  />
                  <span className="truncate">{module.name}</span>
                </button>
                {/* Indented under the row that opened them, so the panel reads as a tree
                    rather than as a flat list with a heading in it. */}
                {isOpen(module.name) && (
                  <div className="flex flex-col gap-0.5 pl-3.5 pt-0.5">
                    {module.hasMemory ? (
                      <MemoryFileRows module={module.name} active={active} />
                    ) : (
                      // Four rows that all lead nowhere would read as four empty files
                      // rather than as a module nothing has been written about yet.
                      <p className="px-2.5 pb-1 text-[12px] leading-snug text-nb-ink-soft">
                        Nothing remembered about this module yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

/** The four memory rows of one set — the project's, or a module's (#130). The same four
 *  names in the same order either way, so a module's set is read the way the project's is. */
function MemoryFileRows({ module, active }: { module: string; active: string | null }) {
  const folder = module ? `docs/kanban/memory/${module}` : "docs/kanban/memory";
  return (
    <>
      {MEMORY_FILES.map((file) => (
        <RailRow
          key={file.name}
          href={`/memory/${memoryKey(module, file.name)}`}
          label={file.label}
          // The path is what a hover says, not the row's own words back at it: the words
          // are already on screen, the file they open is not.
          title={`${folder}/${file.name}.md`}
          icon={<FiFileText size={13} className="shrink-0" aria-hidden />}
          active={active === memoryKey(module, file.name)}
        />
      ))}
    </>
  );
}

/** Project / Modules — the two halves of the Memory panel, in the rail's own section-label
 *  look at panel scale. No count: the project's half is always four, and the panel's rows
 *  are what say how many modules there are. */
function PanelLabel({ text, divider = false }: { text: string; divider?: boolean }) {
  return (
    <div
      className={`px-2.5 pb-1 ${divider ? "mt-1.5 pt-2" : ""}`}
      style={divider ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}
    >
      <span className="text-[10px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft">
        {text}
      </span>
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
  icon,
  title,
  active,
  running = false,
  onClose,
}: {
  href: string;
  label: string;
  id?: number;
  count?: number;
  /** What leads the row when it carries no card number. The board's own row is columns; a
   *  memory row is a file. */
  icon?: React.ReactNode;
  /** What a hover says, when the label isn't it. */
  title?: string;
  active: boolean;
  running?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="group relative">
      <Link
        href={href}
        title={running ? `${label} — running` : (title ?? label)}
        className={`flex h-[30px] w-full items-center gap-2 rounded-[8px] pl-2.5 text-left text-[12.5px] ${
          onClose ? "pr-7" : "pr-2"
        } ${
          active
            ? "bg-nb-paper font-[700] shadow-[inset_0_0_0_1.5px_var(--color-nb-ink)]"
            : "font-[600] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)]"
        }`}
      >
        {id === undefined ? (
          (icon ?? <FiColumns size={13} className="shrink-0" aria-hidden />)
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
