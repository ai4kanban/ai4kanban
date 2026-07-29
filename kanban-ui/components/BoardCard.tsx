"use client";

import Link from "next/link";
import { FiHelpCircle } from "react-icons/fi";
import type { Card, SessionView } from "@/lib/types";
import { parseQuestion } from "@/lib/questions";
import { RUNNING_VERB, RunningBadge } from "./agent-shared";
import { BlockedChip, GroupChip, PriorityChip, RoiTag, StatusPill, TodoProgress, TrackChip } from "./chips";

// One card as both board views draw it — the kanban columns and the queue's two
// halves. A card has to look the same wherever it sits, so there is one
// component and the views only differ in what they pass in.
//
// `liveSession` is the one running session on this card (if any); `onOpenLog`
// makes its badge open that session's log overlay, which each view owns. The
// track chip is opt-in: the queue view merges every track into one grid, so a
// card has to say which one it came from, while a kanban column's heading
// already does.
export function BoardCard({
  card,
  liveSession,
  onOpenLog,
  showTrack = false,
}: {
  card: Card;
  liveSession?: SessionView;
  onOpenLog: (sessionId: string) => void;
  showTrack?: boolean;
}) {
  // A group root's progress comes from its own todo checklist, not from counting
  // subtask files: a finished subtask gets archived and its file removed, so the
  // files on disk only cover the OPEN subtasks and would undercount done work.
  // The root's `## Todo` stays accurate across archives, so it drives the bar.
  // Group-ness is the reader's flag (the folder has a root.md), not a subtask
  // count — the count drops to zero once every subtask is finished, and the chip
  // would vanish right then.
  const isGroup = card.isGroup;
  return (
    <Link
      href={`/${card.id}`}
      // Column flex + `mt-auto` on the badge row: in the queue's grid the cards
      // in a row stretch to the tallest one, and a one-line title would leave
      // its badges floating mid-card. This pins them to the bottom edge. No
      // `h-full` — grid items stretch on their own, and in the kanban column
      // (a flex stack) it would blow one card up to the column's full height.
      className="nb-panel-sm nb-press flex cursor-pointer flex-col p-3.5 text-left"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
          #{card.id}
        </span>
        <span className="flex items-center gap-2">
          {isGroup && <GroupChip />}
          {/* Something this card waits on is still open (#63). The card stays
              exactly where it is — this only says the work has an order to it. */}
          {card.openBlockers.length > 0 && <BlockedChip blockers={card.openBlockers} />}
          {liveSession ? (
            <RunningBadge
              label={RUNNING_VERB[liveSession.action]}
              onClick={(e) => {
                // The card is a link; keep the click on the badge.
                e.preventDefault();
                e.stopPropagation();
                onOpenLog(liveSession.sessionId);
              }}
            />
          ) : (
            <StatusPill status={card.status} />
          )}
          {card.questions.length > 0 &&
            (() => {
              const total = card.questions.length;
              const userCount = card.questions.filter(
                (q) => parseQuestion(q).tag === "user",
              ).length;
              // A `[user]` question waits on the human (accent); the rest
              // auto-refine still works on its own (quieter).
              const tip =
                `${total} open question${total === 1 ? "" : "s"}` +
                (userCount > 0
                  ? ` · ${userCount} need${userCount === 1 ? "s" : ""} you`
                  : "");
              return (
                <span
                  tabIndex={0}
                  className="nb-tip inline-flex"
                  data-tip={tip}
                  style={{
                    color:
                      userCount > 0 ? "var(--color-nb-accent)" : "var(--color-nb-ink-soft)",
                  }}
                >
                  <FiHelpCircle aria-hidden style={{ width: 14, height: 14 }} />
                </span>
              );
            })()}
          {card.todos.total > 0 && (
            <TodoProgress done={card.todos.done} total={card.todos.total} />
          )}
        </span>
      </div>
      <p className="mb-3 text-[14px] font-[700] leading-snug tracking-[-0.01em]">{card.title}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {showTrack && <TrackChip track={card.track} />}
        <PriorityChip value={card.priority} />
        <RoiTag value={card.roi} />
      </div>
    </Link>
  );
}
