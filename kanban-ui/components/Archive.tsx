"use client";

// The archive, read (#380) — the finished cards in `docs/kanban/.archive`, and any one of
// them opened in full. Until this the only way to read one was a file browser: archiving is
// a rename, and nothing on the board opened the folder again.
//
// It is drawn in the memory page's frame, for the same reason that page is: a rail row is a
// couple of hundred pixels wide and these are whole cards. And it is a page rather than a
// view held in the rail, so Back, Forward and a reload keep you where you were.
//
// Everything here is read-only. Nothing un-archives, edits or starts a run — archiving is
// the end state, and anything acting on an archived card would be a second lifecycle.

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiArchive, FiTag } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import type { AgentInfo, ArchiveList, ArchivedCard, ArchivedCardFile, MemoryModule } from "@/lib/types";
import { CardBody } from "./CardBody";
import { HAIRLINE } from "./chrome";
import { RunningNotice } from "./desktop";
import { Header } from "./Header";
import { OpenIdsProvider } from "./open-ids";
import { runningCardIds, useAgentSessions, useOnTabFocus } from "./sessions";
import { Window } from "./Window";

/** What every archive page is drawn in. The page keeps up on the two triggers a card page
 *  uses — a run finishing, and the window being focused again — because a run is what
 *  archives a card, and it does so at the end of its own pass. */
function ArchiveFrame({
  projectRoot,
  openIds,
  agent,
  goalWritten,
  memoryModules,
  desktop,
  children,
}: {
  projectRoot: string;
  openIds: number[];
  agent: AgentInfo;
  goalWritten: boolean;
  memoryModules: MemoryModule[];
  desktop: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const noRunsOfOurOwn = useCallback(() => {}, []);
  const { sessions } = useAgentSessions(noRunsOfOurOwn);
  const prevRunning = useRef<Set<string>>(new Set());
  useEffect(() => {
    const now = new Set(sessions.filter((r) => r.status === "running").map((r) => r.sessionId));
    let finished = false;
    for (const id of prevRunning.current) if (!now.has(id)) finished = true;
    prevRunning.current = now;
    if (finished) refresh();
  }, [sessions, refresh]);
  useOnTabFocus(refresh);

  return (
    // An archived card's body names other cards — `#129` — and only the ones still open
    // become links, the way they do everywhere else the board sets prose.
    <OpenIdsProvider ids={openIds}>
      <Window
        projectRoot={projectRoot}
        openIds={openIds}
        currentArchive
        memoryModules={memoryModules}
        goalWritten={goalWritten}
        running={runningCardIds(sessions)}
        header={
          <Header
            agent={agent}
            projectRoot={projectRoot}
            goalWritten={goalWritten}
            desktop={desktop}
          />
        }
      >
        <div className="h-full overflow-y-auto">
          <RunningNotice desktop={desktop} />
          <main className="mx-auto w-full max-w-[840px] px-6 py-6 max-md:px-4 max-md:py-4">
            {children}
          </main>
        </div>
      </Window>
    </OpenIdsProvider>
  );
}

/** Where the archived dates run out: every card from here down left the board before the
 *  board stamped one. Read off the list rather than claimed — it is the last row carrying a
 *  date, so the sentence is true of everything under it whatever order the dates fell in.
 *  `-1` when nothing is dated and `cards.length` when everything is, which is the same
 *  answer either way: there is no line to draw. */
function undatedFrom(cards: ArchivedCard[]): number {
  let last = -1;
  cards.forEach((card, i) => {
    if (card.archived) last = i;
  });
  return last + 1;
}

export function ArchivePage({
  archive,
  openIds,
  agent,
  projectRoot,
  goalWritten,
  memoryModules,
  desktop,
}: {
  archive: ArchiveList;
  openIds: number[];
  agent: AgentInfo;
  projectRoot: string;
  goalWritten: boolean;
  memoryModules: MemoryModule[];
  desktop: boolean;
}) {
  const c = useCopy().rail.archive;
  const { cards } = archive;
  const undated = undatedFrom(cards);
  const showLine = undated > 0 && undated < cards.length;

  return (
    <ArchiveFrame
      projectRoot={projectRoot}
      openIds={openIds}
      agent={agent}
      goalWritten={goalWritten}
      memoryModules={memoryModules}
      desktop={desktop}
    >
      <h1 className="text-[20px] font-[800] leading-tight tracking-[-0.02em]">{c.title}</h1>
      {/* Where the cards are and how many — the memory page's own meta line. Nothing here
          searches or filters them: the archive is read, not worked. */}
      <p className="mt-1 break-all font-mono text-[11.5px] text-nb-ink-soft">
        {c.meta(archive.relPath, cards.length)}
      </p>

      {cards.length === 0 ? (
        // A blank panel would read as a failed read rather than as a board that has
        // finished nothing yet.
        <div className="nb-panel-sm mt-4 p-5 max-md:p-4">
          <p className="text-[13px] leading-relaxed text-nb-ink-soft">{c.empty}</p>
        </div>
      ) : (
        <nav
          aria-label={c.list}
          className="mt-4 flex flex-col"
          style={{ borderTop: `1px solid ${HAIRLINE}` }}
        >
          {cards.map((card, i) => (
            <div key={card.id}>
              {showLine && i === undated && (
                <RecordEndsHere label={c.undated} count={cards.length - undated} />
              )}
              <div style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <CardRow card={card} />
              </div>
            </div>
          ))}
        </nav>
      )}
    </ArchiveFrame>
  );
}

/** One archived card: its number, its title, the release it shipped in and the day it was
 *  archived — and nothing that acts on it. The two meta cells are fixed-width so the list
 *  reads down a column, and a card missing either leaves its cell empty rather than filling
 *  it with a dash or a guessed date. The row is the whole target; hover is the transparent
 *  border colouring in, so nothing shifts. */
function CardRow({ card }: { card: ArchivedCard }) {
  return (
    <Link
      href={`/archive/${card.id}`}
      className="flex h-[36px] w-full items-center gap-3 rounded-[9px] border-[1.5px] border-transparent px-2.5 hover:border-nb-ink hover:bg-nb-paper"
    >
      <span className="w-[34px] shrink-0 font-mono text-[11.5px] tabular-nums text-nb-ink-soft">
        {card.id}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-[600]">{card.title}</span>
      <span className="flex w-[62px] shrink-0 justify-end">
        {card.release && <ReleaseChip release={card.release} />}
      </span>
      <span className="w-[78px] shrink-0 text-right font-mono text-[11px] tabular-nums text-nb-ink-soft">
        {card.archived}
      </span>
    </Link>
  );
}

/** The version a card shipped in, in the sky fill every release wears on this board. */
function ReleaseChip({ release }: { release: string }) {
  const c = useCopy().rail.archive.card;
  return (
    <span
      className="nb-chip max-w-full"
      title={`${c.release} ${release}`}
      style={{ background: "var(--color-nb-sky-soft)", color: "var(--color-nb-sky-ink)" }}
    >
      <FiTag aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
      <span className="truncate">{release}</span>
    </span>
  );
}

/** The point where the stamp runs out. Said once, quietly, so the empty date cells below it
 *  read as history the board never kept rather than as a column that failed to load. */
function RecordEndsHere({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 px-2.5 pb-1.5 pt-4">
      <span className="text-[10px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft">
        {label}
      </span>
      <span aria-hidden className="h-px flex-1" style={{ background: HAIRLINE }} />
      <span className="font-mono text-[10.5px] tabular-nums text-nb-ink-soft opacity-70">
        {count}
      </span>
    </div>
  );
}

/** One archived card, whole. The body is drawn the way a card page draws one — the human
 *  half open, the agent half folded under it — and nothing else on the page acts on it. */
export function ArchivedCardPage({
  card,
  openIds,
  agent,
  projectRoot,
  goalWritten,
  memoryModules,
  desktop,
}: {
  card: ArchivedCardFile;
  openIds: number[];
  agent: AgentInfo;
  projectRoot: string;
  goalWritten: boolean;
  memoryModules: MemoryModule[];
  desktop: boolean;
}) {
  const c = useCopy().rail.archive;
  return (
    <ArchiveFrame
      projectRoot={projectRoot}
      openIds={openIds}
      agent={agent}
      goalWritten={goalWritten}
      memoryModules={memoryModules}
      desktop={desktop}
    >
      {/* Which list this card came out of, over its title — the same label the memory page
          wears when it is showing a module's copy rather than the project's. Without it a
          finished card reads as an open one. */}
      <p className="mb-0.5 text-[11px] font-[800] uppercase tracking-[0.12em] text-nb-ink-soft">
        {c.card.label}
      </p>
      <h1 className="text-[20px] font-[800] leading-tight tracking-[-0.02em]">{card.title}</h1>
      <p className="mt-1 break-all font-mono text-[12px] text-nb-ink-soft">{card.relPath}</p>
      {(card.release || card.archived) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {card.release && <ReleaseChip release={card.release} />}
          {card.archived && (
            <span
              className="nb-chip"
              title={`${c.card.archived} ${card.archived}`}
              style={{ background: "var(--color-nb-sheet)", color: "var(--color-nb-ink-soft)" }}
            >
              <FiArchive aria-hidden style={{ width: 10, height: 10, flex: "0 0 auto" }} />
              {card.archived}
            </span>
          )}
        </div>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <CardBody body={card.body} title={card.title} cardId={card.id} />
      </div>
    </ArchiveFrame>
  );
}
