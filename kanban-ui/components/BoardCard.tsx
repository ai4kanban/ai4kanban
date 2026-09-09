"use client";

import Link from "next/link";
import { useState } from "react";
import { FiClipboard, FiHelpCircle, FiPlay, FiSkipForward } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useActions } from "@/lib/screen";
import { type Card, type CardCreation, type SessionView } from "@/lib/types";
import { parseQuestion } from "@/lib/questions";
import { scheduleLabel } from "@/lib/schedule";
import { RunningBadge } from "./agent-shared";
import { useCardHref } from "./board-links";
import { ChannelRow } from "./channels";
import { useSolution } from "./solution";
import { Button } from "./button";
import {
  BlockedChip,
  CreatingChip,
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
// The channels ARE on the card, on a marketing board (#411) — a topic's whole state is
// where each of its channels has got to, and that is what the column is scanned for. They
// take the ranking's place there: a marketing card carries no priority and no ROI (#435),
// because a topic is picked by hand rather than ranked.
//
// The release is NOT on the card. The release picker at the top of the board is
// how you look at one version, and the card page is where a card says and
// changes which one it is in — a version stamped on every card as well is a
// third place saying the same thing, and it crowds out what the card is for.
export function BoardCard({
  card,
  liveSession,
  onOpenLog,
  creator,
  onResumed,
}: {
  card: Card;
  liveSession?: SessionView;
  onOpenLog: (sessionId: string) => void;
  /** The run that created this card, when it has not finished creating it (#564). What
   *  Resume creating picks back up; absent on every ordinary card. */
  creator?: SessionView;
  onResumed?: (sessionId: string) => void;
}) {
  // A group root's progress comes from its own todo checklist, not from counting
  // subtask files: a finished subtask gets archived and its file removed, so the
  // files on disk only cover the OPEN subtasks and would undercount done work.
  // The root's `## Todo` stays accurate across archives, so it drives the bar.
  // Group-ness is the reader's flag (the folder has a root.md), not a subtask
  // count — the count drops to zero once every subtask is finished, and the chip
  // would vanish right then.
  const t = useCopy();
  const c = t.board.card;
  const cardHref = useCardHref();
  const isGroup = card.isGroup;
  // The marketing face (#411): the same card, plus the channels this topic goes to. The
  // board's own solution decides it, not the card — a product card has no channels to draw
  // either way, and a marketing topic whose channels question is unanswered draws no row.
  const marketing = useSolution() === "marketing";
  // Not finished being created (#564): a different card entirely, and the branch is taken
  // before anything below reads a field the creator has not written yet.
  if (card.creation) {
    return <BeingCreatedCard card={card} creation={card.creation} creator={creator} onResumed={onResumed} />;
  }
  return (
    <Link
      href={cardHref(card.id)}
      // Column flex + `mt-auto` on the badge row: in the queue's grid the cards
      // in a row stretch to the tallest one, and a one-line title would leave
      // its badges floating mid-card. This pins them to the bottom edge. No
      // `h-full` — grid items stretch on their own, and in the kanban column
      // (a flex stack) it would blow one card up to the column's full height.
      className="nb-panel-sm nb-press flex cursor-pointer flex-col p-3 text-left"
    >
      {/* The meta row. A column can be dragged narrow and a status label can be
          as long as "resolving a conflict", so the row has to say which side
          gives: the id NEVER does (`shrink-0`) — it is how the card is named,
          and a shrunken id overflows its box and gets painted over by the chip
          beside it — and the mark side gives at its one elastic pill, whose
          words stay on hover. Everything else in here holds its size. */}
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <span
          className="shrink-0 text-[11.5px] font-[800]"
          style={{ color: "var(--color-nb-accent-deep)" }}
        >
          #{card.id}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {isGroup && <GroupChip />}
          {/* Something this card waits on is still open (#63). The card stays
              exactly where it is — this only says the work has an order to it. */}
          {card.openBlockers.length > 0 && <BlockedChip blockers={card.openBlockers} />}
          {liveSession ? (
            <RunningBadge
              label={t.runs.verb[liveSession.action]}
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
              // Two whole sentences joined, never a plural suffix: the branch
              // stays here and each side of it is its own key.
              const tip = [
                total === 1 ? c.questionsOne : c.questionsMany(total),
                userCount === 0
                  ? null
                  : userCount === 1
                    ? c.needsYouOne
                    : c.needsYouMany(userCount),
              ]
                .filter(Boolean)
                .join(" · ");
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
          {/* What the decider answered here in your place (#447). Sky, beside the clipboard
              and never the accent: nothing on this card is waiting on you — this is what
              was chosen while you were not asked. Its own mark, with the count in the
              hover, so it can't be read as an open question. */}
          {card.decided.length > 0 && (
            <span
              tabIndex={0}
              className="nb-tip inline-flex shrink-0"
              data-tip={c.decided(card.decided.length)}
              style={{ color: "var(--color-nb-sky-ink)" }}
            >
              <FiSkipForward aria-hidden style={{ width: 12.5, height: 12.5 }} />
            </span>
          )}
          {card.verify.length > 0 && (
            <span
              tabIndex={0}
              className="nb-tip inline-flex shrink-0"
              data-tip={c.verify(card.verify.length)}
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
      {/* The card's foot: the channels a topic goes to, or how a product card ranks. */}
      {marketing ? (
        <ChannelRow channels={card.channels} />
      ) : (
        <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <PriorityChip value={card.priority} />
          <RoiTag value={card.roi} />
        </div>
      )}
    </Link>
  );
}

// A card its creator has not finished writing (#564).
//
// It is a card that has sunk INTO the board rather than a card with a warning on it: the
// wash ground, a hairline instead of the ink frame, no shadow and no press. That is what
// says "not a thing to press" without a disabled cursor or a dimmed title — the title stays
// full ink and full weight, because reading which card this is is the one thing that still
// works on it.
//
// A `div`, never the `Link` an ordinary card is: nothing to click means no href to follow,
// no middle-click, no keyboard focus that leads somewhere refusing to draw.
//
// What it drops is everything the creator has not settled yet — the ranking, the todo bar,
// the questions. A plan half written has nothing true to say with them.
function BeingCreatedCard({
  card,
  creation,
  creator,
  onResumed,
}: {
  card: Card;
  creation: CardCreation;
  creator?: SessionView;
  onResumed?: (sessionId: string) => void;
}) {
  const c = useCopy().board.card.creating;
  const going = creation.state === "creating";
  return (
    <div
      className="nb-inset flex flex-col rounded-[13px] p-3"
      style={{ background: "var(--color-nb-wash)" }}
      aria-disabled
    >
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <span className="shrink-0 text-[11.5px] font-[800] text-nb-ink-soft">#{card.id}</span>
        <CreatingChip
          state={creation.state}
          label={going ? c.mark : c.unfinished}
          hint={going ? c.markHint : c.unfinishedHint}
        />
      </div>
      <p className="text-[13px] font-[700] leading-snug tracking-[-0.01em] break-words">{card.title}</p>
      {!going && <ResumeCreation creator={creator} onResumed={onResumed} />}
    </div>
  );
}

// The one thing you can press on such a card, and the reason it lives here: the card has no
// page, so the way to pick its creator back up has nowhere else to be (#564).
//
// Drawn only when the record still has that run to continue — a creator too old to resume,
// or one this board can no longer start, leaves the line and no button rather than a control
// that would refuse.
function ResumeCreation({
  creator,
  onResumed,
}: {
  creator?: SessionView;
  onResumed?: (sessionId: string) => void;
}) {
  const c = useCopy().board.card.creating;
  const actions = useActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canResume = !!actions && !!creator?.canResume;

  const resume = async () => {
    if (!actions || !creator || busy) return;
    setBusy(true);
    setError(null);
    const res = await actions.resumeSession(creator.sessionId);
    setBusy(false);
    if (res.ok && res.sessionId) onResumed?.(res.sessionId);
    else setError(res.error || c.resumeFailed);
  };

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      {canResume && (
        <Button
          size="sm"
          onClick={() => void resume()}
          disabled={busy}
          className="gap-1.5 rounded-[8px] px-2 py-1 text-[11.5px] font-[700]"
        >
          <FiPlay className="text-[12px]" aria-hidden />
          {busy ? c.resuming : c.resume}
        </Button>
      )}
      <span className="text-[10.5px] text-nb-ink-soft">{error ?? c.stopped}</span>
    </div>
  );
}
