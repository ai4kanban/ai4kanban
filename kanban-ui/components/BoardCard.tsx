"use client";

import Link from "next/link";
import { useContext, useEffect, useRef, useState } from "react";
import { FiClipboard, FiHelpCircle, FiPlay, FiSkipForward, FiTrash2 } from "react-icons/fi";
import { useCopy } from "@/i18n/use-copy";
import { useActions } from "@/lib/screen";
import { type Card, type CardCreation, type SessionView } from "@/lib/types";
import { openOf, parseQuestion } from "@/lib/questions";
import { scheduleMark } from "@/lib/schedule";
import { RunningBadge } from "./agent-shared";
import { useCardHref } from "./board-links";
import { sessionsPanel } from "./sessions";
import { Button } from "./button";
import { Dialog } from "./Dialog";
import { BoardRefreshContext } from "@/lib/board-refresh";
import { cardOpen } from "@/lib/card-open";
import {
  BlockedChip,
  CreatingChip,
  DiscussingPill,
  FailedChip,
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
// `liveSession` is the one live run on this card (if any); its badge opens the runs dialog
// on that run (#753). `failedSession` is the run that stopped short on it and has not been
// dealt with (#809), and opens the same dialog on that run. The board draws no log of its
// own — the log is read in the one place every run is read.
//
// The two share one slot and live work wins it: a card that is running again says so, and
// the failure behind it is still on the Runs panel and still counted there.
//
// The track is NOT on the card. Both views band their cards by track and head
// each band with its name — the kanban column heading, the queue's rule — so a
// chip repeating it on every card says nothing the reader can't already see.
//
// The release is NOT on the card. The release picker at the top of the board is
// how you look at one version, and the card page is where a card says and
// changes which one it is in — a version stamped on every card as well is a
// third place saying the same thing, and it crowds out what the card is for.
export function BoardCard({
  card,
  liveSession,
  failedSession,
  creator,
}: {
  card: Card;
  liveSession?: SessionView;
  /** The run on this card that stopped short and is still waiting on somebody (#809). */
  failedSession?: SessionView;
  /** The run that created this card, when it has not finished creating it (#564). What
   *  Resume creating picks back up; absent on every ordinary card. */
  creator?: SessionView;
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
  // Not finished being created (#564): a different card entirely, and the branch is taken
  // before anything below reads a field the creator has not written yet.
  if (card.creation) {
    return <BeingCreatedCard card={card} creation={card.creation} creator={creator} liveSession={liveSession} />;
  }
  return (
    <Link
      href={cardHref(card.id)}
      onClick={() => cardOpen.rememberTitle(card.id, card.title)}
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
                sessionsPanel.select(liveSession.sessionId);
              }}
            />
          ) : failedSession ? (
            <FailedChip
              onClick={(e) => {
                // The card is a link; keep the click on the chip.
                e.preventDefault();
                e.stopPropagation();
                sessionsPanel.select(failedSession.sessionId);
              }}
            />
          ) : card.discussing ? (
            // Its own chat is writing a reply (#633), so the card is held. Ahead of the
            // schedule and the stage, and in their one slot: the freeze is the thing to know
            // about this card right now.
            <DiscussingPill />
          ) : card.schedule ? (
            // Something is queued to run on this card the moment its blockers clear (#140).
            // It stands in for the status pill — one mark per card — and the card keeps its
            // place in the column: it is the same card, just not startable yet.
            <PendingPill label={scheduleMark(card, t.chips)} />
          ) : (
            <StatusPill status={card.status} />
          )}
          {openOf(card.questions).length > 0 &&
            (() => {
              const total = openOf(card.questions).length;
              const userCount = openOf(card.questions).filter(
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
      {/* The card's foot: how it ranks. */}
      <div className="mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <PriorityChip value={card.priority} />
        <RoiTag value={card.roi} />
      </div>
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
// the questions. A plan half written has nothing true to say with them. While the creator
// is still going, two skeleton lines stand where they will land: the card keeps the height
// of the cards around it instead of sitting stubby, and the wait reads as "more coming"
// rather than as "this is all there is".
function BeingCreatedCard({
  card,
  creation,
  creator,
  liveSession,
}: {
  card: Card;
  creation: CardCreation;
  liveSession?: SessionView;
  creator?: SessionView;
}) {
  const c = useCopy().board.card.creating;
  const going = creation.state === "creating";
  return (
    <div
      className="nb-inset flex flex-col rounded-[13px] p-3"
      style={{ background: "var(--color-nb-wash)" }}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <span className="shrink-0 text-[11.5px] font-[800] text-nb-ink-soft">#{card.id}</span>
        <CreatingChip
          state={creation.state}
          label={going ? c.mark : c.unfinished}
          hint={going ? c.markHint : c.unfinishedHint}
        />
      </div>
      <p className="text-[13px] font-[700] leading-snug tracking-[-0.01em] break-words">
        {card.title}
      </p>
      {going ? (
        <div className="mt-2.5 flex flex-col gap-1.5" aria-hidden>
          <span className="a4k-creating-line w-full" />
          <span className="a4k-creating-line w-[58%]" />
        </div>
      ) : (
        <CreationActions card={card} creator={creator} liveSession={liveSession} />
      )}
    </div>
  );
}

function CreationActions({ card, creator, liveSession }: { card: Card; creator?: SessionView; liveSession?: SessionView }) {
  const c = useCopy().board.card.creating;
  const actions = useActions();
  const refresh = useContext(BoardRefreshContext);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [discardRun, setDiscardRun] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = busy || !!discardRun || !!liveSession;
  const canResume = !!actions && !!creator?.canResume;

  useEffect(() => {
    if (!actions || !discardRun) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const session = await actions.getSession(discardRun);
        const exists = await actions.cardOnBoard(card.id);
        if (cancelled) return;
        if (!exists) {
          await refresh();
          setConfirming(false);
          setDiscardRun(null);
        } else if (!session || session.status !== "running") {
          setError(c.discardFailed);
          setDiscardRun(null);
          await refresh();
        } else timer = setTimeout(() => void poll(), 750);
      } catch {
        if (!cancelled) timer = setTimeout(() => void poll(), 1500);
      }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [actions, card.id, discardRun, refresh, c.discardFailed]);

  const resume = async () => {
    if (!actions || !creator || locked || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.resumeSession(creator.sessionId);
      if (res.ok && res.sessionId) {
        sessionsPanel.select(res.sessionId);
        await refresh();
      } else setError(res.error || c.resumeFailed);
    } catch { setError(c.resumeFailed); }
    finally { submitting.current = false; setBusy(false); }
  };

  const discard = async () => {
    if (!actions || locked || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.startAgent({ action: "reject", id: card.id, discard: true });
      if (res.ok && res.sessionId) setDiscardRun(res.sessionId);
      else setError(c.discardFailed);
    } catch { setError(c.discardFailed); }
    finally { submitting.current = false; setBusy(false); }
  };

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-2">
      {canResume && <Button size="sm" onClick={() => void resume()} disabled={locked}
        className="gap-1.5 rounded-[8px] px-2 py-1 text-[11.5px] font-[700] max-md:min-h-11">
        <FiPlay className="text-[12px]" aria-hidden />{busy && !confirming ? c.resuming : c.resume}
      </Button>}
      {actions && <Button variant="ghost" size="sm" disabled={locked}
        onClick={() => { setError(null); setConfirming(true); }}
        className="gap-1.5 rounded-[8px] px-2 py-1 text-[11.5px] font-[700] text-nb-peach-ink max-md:min-h-11">
        <FiTrash2 className="text-[12px]" aria-hidden />{c.discard}
      </Button>}
      {error && !confirming && <p role="alert" className="w-full text-[12px] text-nb-peach-ink">{error}</p>}
      {confirming && <Dialog title={c.discardTitle(card.id)} onClose={() => { if (!locked) setConfirming(false); }} width={440}>
        <p className="text-[13px] font-[700] break-words">{card.title}</p>
        <p className="mt-2 text-[13px] text-nb-ink-soft">{card.isGroup ? c.discardGroup(card.subtasks?.length ?? 0) : c.discardBody}</p>
        {error && <p role="alert" className="mt-3 rounded-[8px] bg-nb-peach-soft p-3 text-[13px] text-nb-peach-ink">{error}</p>}
        <div className="mt-auto flex justify-end gap-2 pt-5">
          <Button variant="ghost" disabled={locked} onClick={() => setConfirming(false)}>{c.cancel}</Button>
          <Button variant="accent" disabled={locked} onClick={() => void discard()}>{locked ? c.discarding : error ? c.retry : c.discard}</Button>
        </div>
      </Dialog>}
    </div>
  );
}
