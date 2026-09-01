"use client";

// The phone shell (#357) — everything the board grows at phone width and nothing it has at
// window width.
//
// A window keeps its ways into the board down the left, in the rail: the board, the search
// box, the open cards, the memory panel. A phone has no room for a rail, so those ways in
// become a bottom tab bar and three screens of their own — Find, Memory and More — drawn
// over the same body the board and a card page are drawn in. The tab bar says which of the
// four you are on, and it is on every screen the phone reaches.
//
// It is one app, not two: nothing here re-implements a card, a memory file or a search.
// Find and Memory are the rail's own two panels laid out for the width, and More is where
// the rest of the top row went — the board's folder, the goal and Insights, plus the plain
// statement that Runs, diffs, Configuration and chat are done at the computer.
//
// Everything you press here is 44px or taller. That is the whole of the sizing rule: a
// thumb is not a cursor, and this is the one screen with no cursor on it.

import Link from "next/link";
import { useRef } from "react";
import {
  FiBookOpen,
  FiChevronRight,
  FiColumns,
  FiFileText,
  FiFolder,
  FiGitBranch,
  FiMessageSquare,
  FiMoreHorizontal,
  FiPlay,
  FiSearch,
  FiSettings,
  FiX,
} from "react-icons/fi";
import type { RailCopy } from "@/i18n/rail/types";
import { useCopy } from "@/i18n/use-copy";
import { armAgentHalf } from "@/lib/agent-half";
import { useCardSearch } from "@/lib/card-search";
import { memoryKey, memoryModuleOf, useOpenModules } from "@/lib/memory-panel";
import type { OpenCard } from "@/lib/open-cards";
import { MEMORY_FILES, type MemoryModule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HAIRLINE, PHONE_ROW } from "./chrome";
import { Goal } from "./Goal";
import { Insights } from "./Insights";

/** Which of the four ways into the board the phone is on. */
export type PhoneTab = "board" | "find" | "memory" | "more";

/** The tab bar's own height, so anything laid over the body (the bell, the chat) can stop
 *  above it rather than covering the way off the screen it opened on. The 58px row plus the
 *  1.5px rule over it — leave that rule out and a cover paints over the line. */
export const PHONE_TABS_H = 59.5;

/** The bar at the foot of every screen the phone reaches. Buttons rather than links: three
 *  of the four are screens drawn over this page, not pages of their own, and only the one
 *  you are on is marked. */
export function PhoneTabs({ tab, onTab }: { tab: PhoneTab; onTab: (tab: PhoneTab) => void }) {
  const c = useCopy().chrome.phone;
  const tabs = [
    { key: "board", label: c.tabs.board, Icon: FiColumns },
    { key: "find", label: c.tabs.find, Icon: FiSearch },
    { key: "memory", label: c.tabs.memory, Icon: FiBookOpen },
    { key: "more", label: c.tabs.more, Icon: FiMoreHorizontal },
  ] as const;
  return (
    <nav
      aria-label={c.tabs.nav}
      className="flex shrink-0 items-stretch border-t-[1.5px] border-nb-ink bg-nb-paper"
    >
      {tabs.map(({ key, label, Icon }) => {
        const live = key === tab;
        return (
          <button
            key={key}
            type="button"
            aria-current={live ? "page" : undefined}
            onClick={() => onTab(key)}
            className="flex h-[58px] flex-1 cursor-pointer flex-col items-center justify-center gap-1 transition-colors duration-100 active:bg-[color-mix(in_srgb,var(--color-nb-ink)_6%,transparent)]"
            style={{
              color: live ? "var(--color-nb-accent-deep)" : "var(--color-nb-ink-soft)",
            }}
          >
            <Icon size={20} strokeWidth={live ? 2.4 : 2} aria-hidden />
            <span className="text-[10.5px] font-[800] uppercase tracking-[0.06em]">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** The board's own screen, for the three the phone adds: a title that stays put, and one
 *  scrolling column under it. Nothing here scrolls sideways. */
function Screen({
  title,
  head,
  children,
}: {
  title: string;
  /** Drawn under the title and outside the scroll — the search box, so typing never
   *  scrolls away from what it found. */
  head?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-nb-paper">
      <div className="shrink-0 px-4 pb-2 pt-4">
        <h1 className="truncate text-[20px] font-[800] leading-tight tracking-[-0.02em]">{title}</h1>
        {head}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
    </div>
  );
}

/** A section label on one of these screens — the rail's own, at phone scale. */
function GroupLabel({ text, divider = false }: { text: string; divider?: boolean }) {
  return (
    <p
      className={`text-[10.5px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft ${
        divider ? "mt-4 pt-4" : "mt-1"
      } mb-1.5`}
      style={divider ? { borderTop: `1px solid ${HAIRLINE}` } : undefined}
    >
      {text}
    </p>
  );
}

/** One card, as a row of a phone list: the id, the title, and the arrow that says the row
 *  opens a page. */
function CardRow({ id, title, onOpen }: { id: number; title: string; onOpen?: () => void }) {
  return (
    <Link href={`/${id}`} onClick={onOpen} className={PHONE_ROW}>
      <span className="shrink-0 font-mono text-[12px] tabular-nums text-nb-accent-deep">{id}</span>
      <span className="min-w-0 flex-1 leading-snug">{title}</span>
      <FiChevronRight className="shrink-0 text-nb-ink-soft" size={16} aria-hidden />
    </Link>
  );
}

/** The rail's search, as a screen (#357). The box is the first thing under the title and
 *  does not scroll; the matches do.
 *
 *  With nothing typed it shows the cards this window has open — the rail's own list, which
 *  on a phone has nowhere else to be. An empty screen under a box would be the one screen
 *  here that answers nothing until it is asked. */
export function FindScreen({ rows }: { rows: OpenCard[] }) {
  const c = useCopy().rail;
  const { query, setQuery, matches } = useCardSearch();
  const box = useRef<HTMLInputElement>(null);
  const searching = query.trim().length > 0;
  return (
    <Screen
      title={c.search}
      head={
        <div className="relative mt-3">
          <FiSearch
            size={16}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-nb-ink-soft"
          />
          <input
            ref={box}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
            placeholder={c.search}
            aria-label={c.search}
            spellCheck={false}
            autoComplete="off"
            className={`h-11 w-full rounded-[10px] bg-nb-paper pl-10 text-[14px] font-[600] text-nb-ink placeholder:font-[600] placeholder:text-nb-ink-soft/70 focus:outline-none ${
              query ? "pr-11" : "pr-3"
            } shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)]`}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                box.current?.focus();
              }}
              title={c.clearSearch}
              aria-label={c.clearSearch}
              className="absolute right-0 top-0 grid h-11 w-11 cursor-pointer place-items-center rounded-[10px] text-nb-ink opacity-60 active:opacity-100"
            >
              <FiX size={16} aria-hidden />
            </button>
          )}
        </div>
      }
    >
      {!searching ? (
        rows.length > 0 && (
          <>
            <GroupLabel text={c.openCards} />
            <nav aria-label={c.openCards} className="flex flex-col gap-1">
              {rows.map((card) => (
                <CardRow key={card.id} id={card.id} title={card.title} />
              ))}
            </nav>
          </>
        )
      ) : matches === null ? null : matches.length === 0 ? (
        <p className="pt-3 text-[13px] leading-snug text-nb-ink-soft">{c.noMatches}</p>
      ) : (
        <>
          <GroupLabel text={c.matches} />
          <nav aria-label={c.matching} className="flex flex-col gap-1">
            {matches.map((card) => (
              // The word that found the card travels with the click, the way it does in the
              // rail (#262), so a match sitting only in the agent half opens that half.
              <CardRow
                key={card.id}
                id={card.id}
                title={card.title}
                onOpen={() => armAgentHalf(card.id, query)}
              />
            ))}
          </nav>
        </>
      )}
    </Screen>
  );
}

/** The rail's Memory panel, as a screen (#357). The same four files in the same order for
 *  the project and for each module — nothing here folds away, because the screen is the
 *  panel rather than a foot under a list of cards. */
export function MemoryScreen({
  active,
  modules,
}: {
  /** The memory file this window is showing, as a memory key, or null. */
  active: string | null;
  modules: MemoryModule[];
}) {
  const c = useCopy().rail.memory;
  const { isOpen, toggle } = useOpenModules(memoryModuleOf(active));
  const split = modules.length > 0;
  return (
    <Screen title={c.heading}>
      {split && <GroupLabel text={c.project} />}
      <div className="flex flex-col gap-1">
        <MemoryRows module="" active={active} />
      </div>
      {split && <GroupLabel text={c.modules} divider />}
      {modules.map((module) => (
        <div key={module.name} className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => toggle(module.name)}
            aria-expanded={isOpen(module.name)}
            className={PHONE_ROW}
          >
            <FiChevronRight
              size={16}
              aria-hidden
              className={`shrink-0 text-nb-ink-soft transition-transform duration-150 ease-out ${
                isOpen(module.name) ? "rotate-90" : ""
              }`}
            />
            <span className="min-w-0 flex-1 truncate">{module.name}</span>
          </button>
          {isOpen(module.name) &&
            (module.hasMemory ? (
              <div className="flex flex-col gap-1 pl-6">
                <MemoryRows module={module.name} active={active} />
              </div>
            ) : (
              <p className="px-3 pb-1 text-[13px] leading-snug text-nb-ink-soft">{c.empty}</p>
            ))}
        </div>
      ))}
    </Screen>
  );
}

function MemoryRows({ module, active }: { module: string; active: string | null }) {
  const c = useCopy().rail.memory;
  return (
    <>
      {MEMORY_FILES.map((file) => {
        const key = memoryKey(module, file.name);
        return (
          <Link
            key={file.name}
            href={`/memory/${key}`}
            aria-current={active === key ? "page" : undefined}
            className={cn(PHONE_ROW, active === key && "border-nb-ink bg-nb-paper")}
          >
            <FiFileText size={15} className="shrink-0 text-nb-ink-soft" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              {c.files[file.name as keyof RailCopy["memory"]["files"]] ?? file.label}
            </span>
            <FiChevronRight className="shrink-0 text-nb-ink-soft" size={16} aria-hidden />
          </Link>
        );
      })}
    </>
  );
}

/** What the top row could not hold at phone width, plus the plain answer to "where is
 *  everything else": at the computer. Naming the four rather than offering them is the
 *  point — a run log, a diff, the agent settings and a conversation all want a window, and
 *  a row that opened one of them on a phone would be a promise the screen can't keep. */
export function MoreScreen({
  projectRoot,
  goalWritten,
}: {
  projectRoot: string;
  goalWritten: boolean;
}) {
  const p = useCopy().chrome.phone;
  const c = p.more;
  const elsewhere = [
    { label: c.runs, Icon: FiPlay },
    { label: c.diffs, Icon: FiGitBranch },
    { label: c.configuration, Icon: FiSettings },
    { label: c.chat, Icon: FiMessageSquare },
  ];
  return (
    <Screen title={p.tabs.more}>
      <GroupLabel text={c.board} />
      <div className="nb-section flex items-center gap-2.5 bg-nb-sheet px-3 py-3">
        <FiFolder size={15} className="shrink-0 text-nb-ink-soft" aria-hidden />
        <span className="min-w-0 break-all font-mono text-[12.5px] leading-snug text-nb-ink-soft">
          {projectRoot}
        </span>
      </div>

      {/* The two things from the top row that a phone can still do: read what the board is
          for, and read how it is going. Both open the very dialogs the window opens. */}
      <div className="mt-2 flex flex-col gap-1">
        <Goal written={goalWritten} row />
        <Insights row />
      </div>

      <GroupLabel text={c.atTheComputer} divider />
      <p className="mb-2.5 text-[13px] leading-relaxed text-nb-ink-soft">{c.atTheComputerBlurb}</p>
      <ul className="grid grid-cols-2 gap-2">
        {elsewhere.map(({ label, Icon }) => (
          <li
            key={label}
            className="nb-section flex items-center gap-2 bg-nb-sheet px-3 py-2.5 text-[13px] font-[700] text-nb-ink-soft"
          >
            <Icon size={15} className="shrink-0" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </Screen>
  );
}
