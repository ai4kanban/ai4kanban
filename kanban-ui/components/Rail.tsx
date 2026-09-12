"use client";

// The rail down the left of the window: the board at the top, a box to find a
// card by typing, then the conversations this board is holding (see
// app/design/layouts).
//
// All cards is the first row and never goes away: it is the board, and the way back out of
// anything the rail opened.
//
// The rail has no surface of its own. It sits on the window's cream with the top
// row, so the two read as one L-shaped chrome rather than as two regions that
// each need an edge drawn to say where they stop.
//
// It doesn't own its width or its scrolling: it is the contents of a panel the
// window makes resizable (components/Window.tsx, lib/rail-width.ts), and that
// panel is also what drops the rail under `md` — at phone width it would take
// most of the window (app/globals.css hides `#rail`). What its two panels become
// there is the bottom tab bar's Find and Memory screens (#357,
// components/Phone.tsx), so nothing here is a second, narrow design: this one is
// the window's. Rows are only kept tall enough to be aimed at with a trackpad.
//
// The rows scroll and the box above them does not: a one-letter search matches
// most of the board, and a window is not tall enough to be the limit on what can
// be found. The Memory panel at the foot (#129) doesn't scroll with them either —
// see MemoryPanel below.
//
// The list is every subject being talked through (#496, #633): the board's discussions, and
// one row per card with a chat going. A discussion has no page of its own, so its row opens
// it in the Create task sheet; a card's row opens that card's page with its conversation up.
// A search never takes either away. At phone width there is no rail at all, so there is no
// list there either — see ChatRow and lib/discussion-list.ts.
//
// A marketing board has no such list (#507): every row here opens the create sheet, and that
// sheet is the planning step a topic does not take. Nothing is polled for it either.

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  FiArchive,
  FiChevronRight,
  FiColumns,
  FiFileText,
  FiInbox,
  FiMessageSquare,
  FiMoreHorizontal,
  FiScissors,
  FiSearch,
  FiX,
} from "react-icons/fi";
import type { RailCopy } from "@/i18n/rail/types";
import { useCopy } from "@/i18n/use-copy";
import { memoryKey, memoryModuleOf, useMemoryPanel, useOpenModules } from "@/lib/memory-panel";
import {
  MEMORY_FILES,
  isDiscussion,
  type ChatTarget,
  type DiscussionTarget,
  type MemoryModule,
} from "@/lib/types";
import { armAgentHalf } from "@/lib/agent-half";
import { useCardSearch } from "@/lib/card-search";
import { cardChat } from "@/lib/chat-open";
import { createSheet } from "@/lib/create-open";
import { useDiscussions } from "@/lib/discussion-list";
import { Button } from "./button";
import { HAIRLINE, PULSE_DOT } from "./chrome";
import { configDialog, PRUNER } from "./Configuration";
import { useSolution } from "./solution";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export function Rail({
  activeId,
  activeMemory = null,
  activeArchive = false,
  activeSignals = false,
  signals = { show: false, count: 0 },
  memoryModules = [],
  total,
  running,
}: {
  /** The card this window is showing, or null for the board. */
  activeId: number | null;
  /** The memory file this window is showing, as a memory key, or null (#129). */
  activeMemory?: string | null;
  /** True while this window is showing the archive — the list, or one card in it (#380). */
  activeArchive?: boolean;
  /** True while this window is showing the inbox (#453, #499). */
  activeSignals?: boolean;
  /** Whether to offer the Inbox row at all, and how much is waiting in it. A board the
   *  inbox is not open to answers `show: false`, and the row is not drawn. */
  signals?: { show: boolean; count: number };
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
}) {
  const c = useCopy().rail;
  const { query, setQuery, matches } = useCardSearch();
  const searching = query.trim().length > 0;
  // Every conversation this board is holding (#496, #633). What is typed in the box above
  // never takes one away — it searches cards. A marketing board holds none to draw (#507).
  const discussions = useDiscussions(useSolution() === "marketing");
  // A refused archive left the row where it was, so it says why rather than looking like a
  // press that did nothing (#610). Click it away; the next archive replaces it.
  const [archiveFailed, setArchiveFailed] = useState<string | null>(null);
  const { archive } = discussions;
  const archiveRow = useCallback(
    async (target: ChatTarget) => {
      setArchiveFailed(null);
      const done = await archive(target);
      // A discussion has no page of its own to stay on, so the screen holding it hears about
      // it and goes back to a fresh Create task. A card's conversation has one, and the page
      // it is on is left exactly where it was.
      if (!done.ok) setArchiveFailed(done.error || c.discussions.archiveFailed);
      else if (isDiscussion(target)) createSheet.archived(target);
    },
    [archive, c],
  );

  return (
    <div className="flex h-full flex-col py-2 pl-3 pr-1">
      <SearchBox value={query} onChange={setQuery} />
      {/* What is typed puts the matches where the conversations sit. All cards stays:
          it is the board rather than a row of the list, and taking it away would
          be taking away the way out of a search. */}
      <nav
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
        aria-label={searching ? c.matching : c.discussions.heading}
      >
        {/* A memory page is neither a card nor the board, so All cards is not where
            you are while one is open. */}
        <RailRow
          href="/"
          label={c.allCards}
          active={activeId === null && !activeMemory && !activeArchive && !activeSignals}
          count={total}
        />
        {searching ? (
          <>
            {matches !== null && <RailLabel text={c.matches} count={matches.length} />}
            {/* The word that found the card travels with the click, so a match sitting
                only in the card's agent half opens that half rather than landing the
                reader on a page with nothing the search found on it (#262). */}
            {matches?.map((card) => (
              <RailRow
                key={card.id}
                href={`/${card.id}`}
                label={card.title}
                id={card.id}
                active={card.id === activeId}
                running={running.has(card.id)}
                onOpen={() => armAgentHalf(card.id, query)}
              />
            ))}
            {matches?.length === 0 && (
              <p className="px-2.5 pt-1 text-[12px] leading-snug text-nb-ink-soft">
                {c.noMatches}
              </p>
            )}
          </>
        ) : null}
        {/* Left where they are by a search: what is typed finds cards, and hiding the subject
            somebody is in the middle of talking through would be the search answering a
            question nobody asked. */}
        {discussions.rows.length > 0 && (
          <>
            <RailLabel text={c.discussions.heading} count={discussions.rows.length} />
            {discussions.rows.map((row) => (
              <ChatRow
                key={row.id}
                name={row.name || c.discussions.unnamed}
                cardId={row.cardId}
                active={row.cardId !== undefined && row.cardId === activeId}
                answering={row.answering}
                onOpen={() =>
                  row.cardId === undefined
                    ? createSheet.open(row.target as DiscussionTarget)
                    : cardChat.open(row.cardId)
                }
                onArchive={() => void archiveRow(row.target)}
              />
            ))}
            {archiveFailed && (
              <p
                role="alert"
                onClick={() => setArchiveFailed(null)}
                className="mx-2.5 mt-1 cursor-pointer break-words rounded-[8px] bg-nb-peach-soft px-2.5 py-[6px] text-[11.5px] leading-[16px] text-nb-peach-ink"
              >
                {archiveFailed}
              </p>
            )}
          </>
        )}
      </nav>
      {/* The two ways out of the list, at the foot with Memory and outside what scrolls:
          neither is one of the open cards, and no amount of typing above should take either
          away. The inbox (#453, #499) sits over the archive (#380) — what has not become a
          card yet, over the cards that are finished with.

          The archive carries no count: nothing archived is anywhere on the board until it is
          asked for. The inbox carries one, because how much is waiting is the whole reason
          to look. */}
      <div className="mt-0.5 flex shrink-0 flex-col gap-0.5">
        {signals.show && (
          <RailRow
            href="/inbox"
            label={c.signals.row}
            icon={<FiInbox size={13} className="shrink-0" aria-hidden />}
            active={activeSignals}
            count={signals.count}
          />
        )}
        <RailRow
          href="/archive"
          label={c.archive.row}
          icon={<FiArchive size={13} className="shrink-0" aria-hidden />}
          active={activeArchive}
        />
      </div>
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
  const c = useCopy().rail.memory;
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
        title={open ? c.hide : c.show}
        className="mt-2.5 flex w-full shrink-0 cursor-pointer items-center justify-between px-2.5 pb-1.5 pt-2.5 text-nb-ink-soft hover:text-nb-ink"
        style={{ borderTop: `1px solid ${HAIRLINE}` }}
      >
        <span className="text-[10px] font-[800] uppercase tracking-[0.12em]">{c.heading}</span>
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
        <nav id="memory-files" inert={!open} className="min-h-0 overflow-y-auto" aria-label={c.heading}>
          {/* The rows' own breathing room is inside the scroller, not padding on it: padding
              is floor a 0fr track can't shrink past, and closed has to close all the way. */}
          <div className="flex flex-col gap-0.5 py-1">
            <PruneButton />
            {split && <PanelLabel text={c.project} />}
            <MemoryFileRows module="" active={active} />
            {split && <PanelLabel text={c.modules} divider />}
            {modules.map((module) => (
              <div key={module.name}>
                <button
                  type="button"
                  onClick={() => toggleModule(module.name)}
                  aria-expanded={isOpen(module.name)}
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
                        {c.empty}
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

/** Prune memory (#514) — the one thing you DO to the memory, over the files you read.
 *
 *  It is a button rather than a row: the rows below open a file, and this opens the Memory
 *  Pruner's page in Configuration, where a pass is started and a cadence is set. So it wears
 *  the button family's ink frame and hard shadow instead of a row's flat corner, and a
 *  hairline parts it from the files.
 *
 *  It does not prune. A pass rewrites every memory file, so the second click — **Run now**,
 *  on the agent's own page — is where that is asked for. */
function PruneButton() {
  const c = useCopy().rail.memory;
  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        title={c.pruneTitle}
        onClick={() => configDialog.open("agents", PRUNER)}
        className="mx-2.5 mb-1 h-[32px] w-[calc(100%-1.25rem)] font-[700] text-nb-accent-deep"
      >
        <FiScissors size={13} aria-hidden />
        {c.prune}
      </Button>
      <div className="mx-2.5 mb-1" style={{ borderTop: `1px solid ${HAIRLINE}` }} />
    </>
  );
}

/** The four memory rows of one set — the project's, or a module's (#130). The same four
 *  names in the same order either way, so a module's set is read the way the project's is. */
function MemoryFileRows({ module, active }: { module: string; active: string | null }) {
  const c = useCopy().rail.memory;
  return (
    <>
      {MEMORY_FILES.map((file) => (
        <RailRow
          key={file.name}
          href={`/memory/${memoryKey(module, file.name)}`}
          label={c.files[file.name as keyof RailCopy["memory"]["files"]] ?? file.label}
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

/** The box at the top of the rail. It is a rail row's own geometry — same height,
 *  same corner, same 13px icon in the same place — so it reads as the row you type
 *  in rather than as a control parked above the list. The outline is inset like the
 *  open row's, since the rail has no surface to hang a border off.
 *
 *  The ✕ appears only with something to clear, and clearing is also Escape: the
 *  search is a detour off the rail's own list and both ways back are cheap. */
function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const c = useCopy().rail;
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
        placeholder={c.search}
        aria-label={c.search}
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
          title={c.clearSearch}
          aria-label={c.clearSearch}
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
 *  The pulse dot goes at the far end of the link's own content, so a hover never hides the
 *  run. */
function RailRow({
  href,
  label,
  id,
  count,
  icon,
  title,
  active,
  running = false,
  onOpen,
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
  /** Run just before the row opens what it points at. */
  onOpen?: () => void;
}) {
  const c = useCopy().rail;
  return (
    <div className="group relative">
      <Link
        href={href}
        onClick={onOpen}
        title={running ? c.runningRow(label) : (title ?? label)}
        className={`flex h-[30px] w-full items-center gap-2 rounded-[8px] pl-2.5 pr-2 text-left text-[12.5px] ${
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
            <span className="sr-only">{c.running}</span>
          </>
        )}
        {count !== undefined && (
          <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-nb-ink-soft">
            {count}
          </span>
        )}
      </Link>
    </div>
  );
}

/** One conversation (#496, #633), in the rail row's own geometry — same height, same corner,
 *  same truncation — so the list reads as one rail rather than as a second design that
 *  happens to sit under the board's row.
 *
 *  A card's row is a link: its card page is where the conversation is carried on, and it
 *  wears the open state every other row in the rail wears. A discussion's is a button — it
 *  has no page of its own, and pressing it opens the Create task sheet, which covers the
 *  window an open state would be marked in.
 *
 *  The ⋯ is a sibling of the row, not a child of it — a button inside an anchor is neither
 *  valid nor reachable — and holds the one thing there is to do from here: end the
 *  discussion, which takes the row off the list and nothing else. */
function ChatRow({
  name,
  cardId,
  active,
  answering,
  onOpen,
  onArchive,
}: {
  name: string;
  /** The card this conversation is about, or undefined for a discussion. */
  cardId?: number;
  /** This window is showing that card. */
  active: boolean;
  /** Its agent is writing a reply — the same pulse a card's row carries while a run is
   *  inside it. */
  answering: boolean;
  onOpen: () => void;
  onArchive: () => void;
}) {
  const c = useCopy().rail;
  const inside = (
    <>
      {cardId === undefined ? (
        <FiMessageSquare size={13} className="shrink-0" aria-hidden />
      ) : (
        <span
          className="shrink-0 font-mono text-[11px] tabular-nums"
          style={{ color: active ? "var(--color-nb-accent)" : "inherit", opacity: active ? 1 : 0.6 }}
        >
          {cardId}
        </span>
      )}
      <span className="truncate">{name}</span>
      {answering && (
        <>
          <span className={`ml-auto ${PULSE_DOT}`} aria-hidden />
          <span className="sr-only">{c.discussions.answering}</span>
        </>
      )}
    </>
  );
  const shape = `flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-[8px] pl-2.5 pr-7 text-left text-[12.5px] ${
    active
      ? "bg-nb-paper font-[700] shadow-[inset_0_0_0_1.5px_var(--color-nb-ink)]"
      : "font-[600] text-nb-ink-soft hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)]"
  }`;
  const hover = answering ? c.discussions.answeringRow(name) : name;
  return (
    <div className="group relative">
      {cardId === undefined ? (
        <button type="button" onClick={onOpen} title={hover} className={shape}>
          {inside}
        </button>
      ) : (
        <Link href={`/${cardId}`} onClick={onOpen} title={hover} className={shape}>
          {inside}
        </Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={c.discussions.menu(name)}
            aria-label={c.discussions.menu(name)}
            className="absolute right-1 top-1/2 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-[5px] text-nb-ink opacity-0 hover:bg-[color-mix(in_srgb,var(--color-nb-ink)_10%,transparent)] focus-visible:opacity-100 group-hover:opacity-60 group-hover:hover:opacity-100 data-[state=open]:opacity-100"
          >
            <FiMoreHorizontal size={13} aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onArchive}>{c.discussions.archive}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
