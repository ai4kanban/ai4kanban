"use client";

// The phone shell (#357, #1198) — everything the board grows at phone width and nothing it has
// at window width.
//
// A phone has no room for the rail, so its ways in move: the card search becomes the top row's
// box, and the tab bar at the foot holds Board and More. Its matches, More and Memory are drawn
// over the same body the board and a card page are drawn in, so the page under them keeps its
// state. Memory is a row on More, as weak an entry as it is on the rail.
//
// Everything you press here is 44px or taller: a thumb is not a cursor.

import Link from "next/link";
import { createContext, useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FiBookOpen,
  FiChevronRight,
  FiClipboard,
  FiColumns,
  FiFileText,
  FiFolder,
  FiGitBranch,
  FiMoreHorizontal,
  FiPlay,
  FiScissors,
  FiSearch,
  FiSettings,
  FiX,
} from "react-icons/fi";
import { LuMessagesSquare } from "react-icons/lu";
import type { RailCopy } from "@/i18n/rail/types";
import { useCopy } from "@/i18n/use-copy";
import { armAgentHalf } from "@/lib/agent-half";
import type { useCardSearch } from "@/lib/card-search";
import { LEAVES_SHEET } from "@/lib/create-open";
import { memoryKey, memoryAgentOf, memoryTree, useOpenOwners } from "@/lib/memory-panel";
import { useMemoryOwnerName } from "./memory-owner";
import type { MemoryName, MemoryOwner } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { HAIRLINE, PHONE_ROW, SPINE } from "./chrome";
import { configDialog, PRUNER } from "./Configuration";
import { Insights } from "./Insights";

/** Which tab the phone lights: the board, or More — which Memory sits under. */
export type PhoneTab = "board" | "more";

/** The tab bar's own height, so anything laid over the body (the bell, the chat) can stop
 *  above it. The 58px row plus the 1.5px rule over it. */
export const PHONE_TABS_H = 59.5;

/** The bar at the foot of every screen the phone reaches. */
export function PhoneTabs({ tab, onTab }: { tab: PhoneTab; onTab: (tab: PhoneTab) => void }) {
  const c = useCopy().chrome.phone;
  const tabs = [
    { key: "board", label: c.tabs.board, Icon: FiColumns },
    { key: "more", label: c.tabs.more, Icon: FiMoreHorizontal },
  ] as const;
  return (
    <nav
      {...LEAVES_SHEET}
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

/** Where a page puts what stands in the tab bar's place — the triage pick bar. */
const FootSlot = createContext<{ slot: HTMLElement | null; take: (on: boolean) => void } | null>(null);
export const PhoneFootProvider = FootSlot.Provider;

/** Draws its children where the tab bar was, for as long as it is mounted. */
export function PhoneFoot({ children }: { children: React.ReactNode }) {
  const foot = useContext(FootSlot);
  const take = foot?.take;
  useEffect(() => {
    if (!take) return;
    take(true);
    return () => take(false);
  }, [take]);
  return foot?.slot ? createPortal(children, foot.slot) : null;
}

/** The card search the top row's box types into, held by the window so its matches can
 *  cover the page. `onFocus` clears the layers that would hide them. */
type PhoneFind = ReturnType<typeof useCardSearch> & { onFocus: () => void };
const FindContext = createContext<PhoneFind | null>(null);
export const PhoneFindProvider = FindContext.Provider;

/** The top row's box at phone width. Nothing outside a window that holds the search. */
export function HeaderFind() {
  const c = useCopy().rail;
  const find = useContext(FindContext);
  const box = useRef<HTMLInputElement>(null);
  if (!find) return null;
  const { query, setQuery, onFocus } = find;
  return (
    <label className="relative flex h-9 min-w-0 flex-1 items-center">
      <FiSearch
        size={15}
        aria-hidden
        className="pointer-events-none absolute left-3 text-nb-ink-soft"
      />
      <input
        ref={box}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQuery("");
            box.current?.blur();
          }
        }}
        placeholder={c.search}
        aria-label={c.search}
        spellCheck={false}
        autoComplete="off"
        className={`h-9 w-full rounded-[10px] bg-nb-paper pl-9 text-[14px] font-[600] text-nb-ink placeholder:font-[600] placeholder:text-nb-ink-soft/70 focus:outline-none ${
          query ? "pr-9" : "pr-3"
        } shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)]`}
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          title={c.clearSearch}
          aria-label={c.clearSearch}
          className="absolute right-0 grid size-9 cursor-pointer place-items-center rounded-[10px] text-nb-ink opacity-60 active:opacity-100"
        >
          <FiX size={15} aria-hidden />
        </button>
      )}
    </label>
  );
}

/** The board's own screen, for the ones the phone adds: a title that stays put, and one
 *  scrolling column under it. Nothing here scrolls sideways. */
function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-nb-paper">
      <div className="shrink-0 px-4 pb-2 pt-4">
        <h1 className="truncate text-[20px] font-[800] leading-tight tracking-[-0.02em]">{title}</h1>
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

/** What the top row's box found, drawn over the page. Opening one empties the box. */
export function FindMatches() {
  const c = useCopy().rail;
  const find = useContext(FindContext);
  if (!find) return null;
  const { query, setQuery, matches } = find;
  return (
    <div className="h-full overflow-y-auto bg-nb-paper px-4 pb-4 pt-3">
      {matches === null ? null : matches.length === 0 ? (
        <p className="text-[13px] leading-snug text-nb-ink-soft">{c.noMatches}</p>
      ) : (
        <>
          <GroupLabel text={c.matches} />
          <nav aria-label={c.matching} className="flex flex-col gap-1">
            {matches.map((card) => (
              // The word that found the card travels with the click (#262), so a match
              // sitting only in the agent half opens that half.
              <Link
                key={card.id}
                href={`/${card.id}`}
                onClick={() => {
                  armAgentHalf(card.id, query);
                  setQuery("");
                }}
                className={PHONE_ROW}
              >
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-nb-accent-deep">
                  {card.id}
                </span>
                <span className="min-w-0 flex-1 leading-snug">{card.title}</span>
                <FiChevronRight className="shrink-0 text-nb-ink-soft" size={16} aria-hidden />
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}

/** The rail's Memory panel, as a screen (#357, #805). One group per owner — the board's own
 *  record first, then every agent that keeps memory — each opening the files it holds.
 *
 *  Prune memory leads it, as it does in the rail (#514) — the same button, at a thumb's
 *  height, opening the same Memory Pruner page. */
export function MemoryScreen({
  active,
  owners,
}: {
  /** The memory file this window is showing, as a memory key, or null. */
  active: string | null;
  owners: MemoryOwner[];
}) {
  const c = useCopy().rail.memory;
  const written = owners.filter((o) => o.files.length > 0).map((o) => o.agent);
  const { isOpen, toggle } = useOpenOwners(memoryAgentOf(active), written);
  return (
    <Screen title={c.heading}>
      <Button
        variant="ghost"
        size="sm"
        title={c.pruneTitle}
        onClick={() => configDialog.open("upkeep", PRUNER)}
        className="mb-3 mt-1 h-11 w-full font-[700] text-nb-accent-deep"
      >
        <FiScissors size={15} aria-hidden />
        {c.prune}
      </Button>
      {owners.map((owner) => (
        <MemoryOwnerRows
          key={owner.agent || "board"}
          owner={owner}
          open={isOpen(owner.agent)}
          onToggle={() => toggle(owner.agent)}
          active={active}
        />
      ))}
    </Screen>
  );
}

function MemoryOwnerRows({
  owner,
  open,
  onToggle,
  active,
}: {
  owner: MemoryOwner;
  open: boolean;
  onToggle: () => void;
  active: string | null;
}) {
  const c = useCopy().rail.memory;
  const name = useMemoryOwnerName(owner);
  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={onToggle} aria-expanded={open} className={PHONE_ROW}>
        <FiChevronRight
          size={16}
          aria-hidden
          className={`shrink-0 text-nb-ink-soft transition-transform duration-150 ease-out ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="min-w-0 flex-1 truncate">{name}</span>
      </button>
      {open &&
        (owner.files.length > 0 ? (
          <div className="flex flex-col gap-1 pl-6">
            <MemoryRows agent={owner.agent} files={owner.files} active={active} />
          </div>
        ) : (
          <p className="px-3 pb-1 text-[13px] leading-snug text-nb-ink-soft">{c.empty}</p>
        ))}
    </div>
  );
}

function MemoryRows({
  agent,
  files,
  active,
}: {
  agent: string;
  files: MemoryName[];
  active: string | null;
}) {
  const c = useCopy().rail.memory;
  const row = (name: string, label: string) => {
    const key = memoryKey(agent, name);
    return (
      <Link
        key={name}
        href={`/memory/${key}`}
        aria-current={active === key ? "page" : undefined}
        className={cn(PHONE_ROW, active === key && "border-nb-ink bg-nb-paper")}
      >
        <FiFileText size={15} className="shrink-0 text-nb-ink-soft" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <FiChevronRight className="shrink-0 text-nb-ink-soft" size={16} aria-hidden />
      </Link>
    );
  };
  // The rail's tree (#959). The spine's centre sits on the entry file's icon centre: 12px
  // padding + the border (1.5px, drawn as 1px) + half of 15px.
  return (
    <>
      {memoryTree(files).map(({ name, kids }) => (
        <div key={name} className="flex flex-col gap-1">
          {row(name, c.files[name as keyof RailCopy["memory"]["files"]] ?? name)}
          {kids.length > 0 && (
            <div className="relative flex flex-col gap-1 pl-8">
              <span aria-hidden className="absolute bottom-1 left-[20px] top-0 w-px" style={{ background: SPINE }} />
              {kids.map((kid) => row(kid.name, kid.label))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/** What the top row could not hold at phone width, plus the plain answer to "where is
 *  everything else": at the computer. Naming the four rather than offering them is the
 *  point — a run log, a diff, the agent settings and a conversation all want a window, and
 *  a row that opened one of them on a phone would be a promise the screen can't keep. */
export function MoreScreen({
  projectRoot,
  onMemory,
  testCases,
}: {
  projectRoot: string;
  /** Open the Memory screen (#1198). */
  onMemory: () => void;
  /** Whether the project has test cases, and so their row (#1422). */
  testCases: boolean;
}) {
  const copy = useCopy();
  const p = copy.chrome.phone;
  const c = p.more;
  const elsewhere = [
    { label: c.runs, Icon: FiPlay },
    { label: c.diffs, Icon: FiGitBranch },
    { label: c.configuration, Icon: FiSettings },
    { label: c.chat, Icon: LuMessagesSquare },
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

      {/* The things from the top row that a phone can still do: read how the board is
          going, in the very dialog the window opens. */}
      <div className="mt-2 flex flex-col gap-1">
        <Insights row />
        <button type="button" onClick={onMemory} className={PHONE_ROW}>
          <FiBookOpen size={17} className="shrink-0 text-nb-ink-soft" aria-hidden />
          <span className="min-w-0 flex-1">{copy.rail.memory.heading}</span>
          <FiChevronRight className="shrink-0 text-nb-ink-soft" size={16} aria-hidden />
        </button>
        {testCases && (
          <Link href="/test-cases" className={PHONE_ROW}>
            <FiClipboard size={17} className="shrink-0 text-nb-ink-soft" aria-hidden />
            <span className="min-w-0 flex-1">{copy.rail.testCases.row}</span>
            <FiChevronRight className="shrink-0 text-nb-ink-soft" size={16} aria-hidden />
          </Link>
        )}
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
