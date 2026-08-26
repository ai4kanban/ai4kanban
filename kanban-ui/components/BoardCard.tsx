"use client";

import Link from "next/link";
import { FiCheck, FiClipboard, FiHelpCircle } from "react-icons/fi";
import { type Card, type SessionView } from "@/lib/types";
import { parseQuestion } from "@/lib/questions";
import { scheduleLabel } from "@/lib/schedule";
import { RUNNING_VERB, RunningBadge } from "./agent-shared";
import {
  BlockedChip,
  GroupChip,
  PendingPill,
  PriorityChip,
  RoiTag,
  StatusPill,
  TodoProgress,
} from "./chips";

// One card, as every column draws it. A card has to look the same wherever it
// sits — a queue column, the recurring column — so there is one component and
// the callers only differ in what they pass in.
//
// `liveSession` is the one live run on this card (if any); `onOpenLog`
// makes its badge open that run's log overlay, which the page owns.
//
// The track is NOT on the card. Both views band their cards by track and head
// each band with its name — the kanban column heading, the queue's rule — so a
// chip repeating it on every card says nothing the reader can't already see.
//
// The release is NOT on the card. The release picker at the top of the board is
// how you look at one version, and the card page is where a card says and
// changes which one it is in — a version stamped on every card as well is a
// third place saying the same thing, and it crowds out what the card is for.
//
// The tick (#114) is a target of its own at the head of the card, so several
// cards can be sent into a release at once while clicking the card itself still
// opens its page — the card is a link, and the whole point of ticking is to do
// something to a card without going to it. It draws only where the view passes
// `onSelect`, so a card page or any future reuse gets the plain card.
export function BoardCard({
  card,
  liveSession,
  onOpenLog,
  selected = false,
  onSelect,
}: {
  card: Card;
  liveSession?: SessionView;
  onOpenLog: (sessionId: string) => void;
  /** Ticked for the bulk move. Only meaningful with `onSelect`. */
  selected?: boolean;
  /** Tick or untick this card. Left out draws no tick at all. */
  onSelect?: (id: number, next: boolean) => void;
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
      // A ticked card wears the accent ring so the group being moved reads at a
      // glance across a full column, not one 16px box at a time.
      className={`nb-panel-sm nb-press flex cursor-pointer flex-col p-3 text-left ${
        selected ? "outline-2 outline-offset-2 outline-nb-accent" : ""
      }`}
    >
      {/* The meta row. A column can be dragged narrow and a status label can be
          as long as "resolving a conflict", so the row has to say which side
          gives: the id NEVER does (`shrink-0`) — it is how the card is named,
          and a shrunken id overflows its box and gets painted over by the chip
          beside it — and the mark side gives at its one elastic pill, whose
          words stay on hover. Everything else in here holds its size. */}
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <span className="flex shrink-0 items-center gap-1.5">
          {onSelect && (
            <button
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-label={`${selected ? "Untick" : "Tick"} #${card.id} ${card.title}`}
              title="Tick to move this card into a release"
              onClick={(e) => {
                // The card is a link; keep the click on the tick.
                e.preventDefault();
                e.stopPropagation();
                onSelect(card.id, !selected);
              }}
              // The negative margin buys a bigger hit area than the box it
              // draws, so the tick is easy to hit without pushing the id along.
              className={`-m-1 inline-flex cursor-pointer items-center justify-center p-1 ${
                selected ? "text-white" : "text-transparent hover:text-nb-ink-soft"
              }`}
            >
              <span
                className="inline-flex size-[14px] items-center justify-center rounded-[4px] border-[1.5px] border-nb-ink"
                style={{
                  background: selected ? "var(--color-nb-accent)" : "var(--color-nb-paper)",
                }}
              >
                <FiCheck aria-hidden style={{ width: 10, height: 10 }} strokeWidth={3} />
              </span>
            </button>
          )}
          <span className="text-[11.5px] font-[800]" style={{ color: "var(--color-nb-accent-deep)" }}>
            #{card.id}
          </span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
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
          ) : card.schedule ? (
            // Something is queued to run on this card the moment its blockers clear (#140).
            // It stands in for the status pill — one mark per card — and the card keeps its
            // place in the column: it is the same card, just not startable yet.
            <PendingPill label={scheduleLabel(card)} />
          ) : (
            <StatusPill status={card.status} />
          )}
          {card.questions.length > 0 &&
            (() => {
              const total = card.questions.length;
              const userCount = card.questions.filter(
                (q) => parseQuestion(q.text).tag === "user",
              ).length;
              // A `[user]` question waits on the human (accent); the rest a
              // refine can settle on its own (quieter).
              const tip =
                `${total} open question${total === 1 ? "" : "s"}` +
                (userCount > 0
                  ? ` · ${userCount} need${userCount === 1 ? "s" : ""} you`
                  : "");
              return (
                <span
                  tabIndex={0}
                  className="nb-tip inline-flex shrink-0"
                  data-tip={tip}
                  style={{
                    color:
                      userCount > 0 ? "var(--color-nb-accent)" : "var(--color-nb-ink-soft)",
                  }}
                >
                  <FiHelpCircle aria-hidden style={{ width: 13, height: 13 }} />
                </span>
              );
            })()}
          {/* Things the build left for the user to check by hand (#231). Sky, never
              the accent: the accent marks a question waiting on the user, and a
              verify line waits on nobody — the card is done, this is what to look
              at before accepting it. Its own mark, so it can't be read as one more
              open question. */}
          {card.verify.length > 0 && (
            <span
              tabIndex={0}
              className="nb-tip inline-flex shrink-0"
              data-tip={`${card.verify.length} to check by hand`}
              style={{ color: "var(--color-nb-sky-ink)" }}
            >
              <FiClipboard aria-hidden style={{ width: 12.5, height: 12.5 }} />
            </span>
          )}
          {card.todos.total > 0 && (
            <TodoProgress done={card.todos.done} total={card.todos.total} />
          )}
        </span>
      </div>
      {/* A board can hold hundreds of cards, so the title sits just one rung
          above the meta around it (13 vs 11.5) — still the loudest thing on the
          card, but small enough that a long column stays scannable. */}
      {/* `break-words`: a title can carry a path or an identifier with no space
          in it, and one of those is wider than any column. */}
      <p className="mb-2.5 text-[13px] font-[700] leading-snug tracking-[-0.01em] break-words">
        {card.title}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <PriorityChip value={card.priority} />
        <RoiTag value={card.roi} />
      </div>
    </Link>
  );
}
