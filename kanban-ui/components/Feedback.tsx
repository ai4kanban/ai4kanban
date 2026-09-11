"use client";

// Feedback on a landed task (#603) — the board's standing Feedback button, and the block on
// New task that links the task a fix is about.
//
// Two things the whole file is built around:
//
//   - **Nothing is collected until it is ticked.** The block on New task is one collapsed
//     button; opening it collects nothing either. Sharing what was typed and attaching
//     diagnostics are separate ticks, both off, and both about this one submission. Cancel
//     folds the block and forgets every tick, keeping the description in the box.
//   - **The preview IS the submission.** The four attachments are listed with their sizes
//     and read in full before they go, and one taken out is one the sender never sees.
//
// The standing button is not about a task at all: it takes feedback on the install, the
// screens, anything. It carries no card, no conversation and no run log, and it works with
// usage reporting off — that switch is about the anonymous numbers, and this is a thing the
// user did on purpose.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiChevronRight, FiFlag, FiPlus, FiSearch, FiX } from "react-icons/fi";
import {
  feedbackDiagnosticsAction,
  feedbackOfferedAction,
  searchArchivedAction,
  sendFeedbackAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type {
  ArchivedCard,
  FeedbackAttachment,
  FeedbackPart,
  FeedbackSent,
  FeedbackSource,
} from "@/lib/types";
import { Button } from "./button";
import { HAIRLINE, PHONE_ROW } from "./chrome";
import { Dialog } from "./Dialog";

/** How long the typing has to stop before the archive is searched — the card search's own
 *  pause, so the two boxes answer at the same speed. */
const SEARCH_PAUSE = 120;

// ---- the block on New task --------------------------------------------------

/** What the block is holding. `submit` is called after the task has been created, so a
 *  submission that fails reaches nothing but its own sentence. */
export interface LandedFeedback {
  /** Whether this board's rules can take feedback at all. */
  offered: boolean;
  open: boolean;
  expand: () => void;
  /** Fold it and forget every tick. The description in the box is not the block's. */
  cancel: () => void;
  card: ArchivedCard | null;
  pick: (card: ArchivedCard | null) => void;
  share: boolean;
  setShare: (on: boolean) => void;
  diagnostics: boolean;
  setDiagnostics: (on: boolean) => void;
  /** What the linked card has to attach. Null while it is still being read, and on a card
   *  with nothing to attach. */
  attachments: FeedbackAttachment[] | null;
  dropped: FeedbackPart[];
  drop: (part: FeedbackPart, out: boolean) => void;
  /** Send what was typed, if sharing was ticked. Null when there is nothing to send. */
  submit: (text: string) => Promise<FeedbackSent | null>;
  /** Back to one collapsed button — what a sent submission leaves behind. */
  reset: () => void;
}

export function useLandedFeedback(): LandedFeedback {
  const [offered, setOffered] = useState(false);
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<ArchivedCard | null>(null);
  const [share, setShare] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const [attachments, setAttachments] = useState<FeedbackAttachment[] | null>(null);
  const [dropped, setDropped] = useState<FeedbackPart[]>([]);

  useEffect(() => {
    let live = true;
    void feedbackOfferedAction().then((can) => live && setOffered(can));
    return () => {
      live = false;
    };
  }, []);

  // What the picked card has to attach, read when it is picked rather than when the tick
  // goes on: the sizes are what the tick is decided on.
  useEffect(() => {
    if (!card) {
      setAttachments(null);
      return;
    }
    let live = true;
    void feedbackDiagnosticsAction(card.id).then((read) => {
      if (live) setAttachments(read?.attachments.length ? read.attachments : null);
    });
    return () => {
      live = false;
    };
  }, [card]);

  const reset = useCallback(() => {
    setOpen(false);
    setCard(null);
    setShare(false);
    setDiagnostics(false);
    setAttachments(null);
    setDropped([]);
  }, []);

  const drop = useCallback((part: FeedbackPart, out: boolean) => {
    setDropped((was) => (out ? [...was.filter((p) => p !== part), part] : was.filter((p) => p !== part)));
  }, []);

  // Read after an await, so a submission started before Cancel is not sent by what the
  // screen says afterwards.
  const held = useRef({ share, card, diagnostics, attachments, dropped });
  useEffect(() => {
    held.current = { share, card, diagnostics, attachments, dropped };
  }, [share, card, diagnostics, attachments, dropped]);

  const submit = useCallback(async (text: string): Promise<FeedbackSent | null> => {
    const now = held.current;
    if (!now.share || !text.trim()) return null;
    const parts =
      now.diagnostics && now.attachments
        ? now.attachments
            .filter((a) => !now.dropped.includes(a.part))
            .map((a) => ({ part: a.part, text: a.text }))
        : undefined;
    return sendFeedbackAction({
      text,
      source: "task",
      ...(now.card ? { cardId: now.card.id } : {}),
      ...(parts?.length ? { parts } : {}),
    });
  }, []);

  const expand = useCallback(() => setOpen(true), []);

  // One object, remade only when what it holds changes: Create task keeps it across renders
  // and hangs callbacks off it, and a fresh one every render would re-run every effect that
  // reads it.
  return useMemo(
    () => ({
      offered,
      open,
      expand,
      cancel: reset,
      card,
      pick: setCard,
      share,
      setShare,
      diagnostics,
      setDiagnostics,
      attachments,
      dropped,
      drop,
      submit,
      reset,
    }),
    [offered, open, expand, reset, card, share, diagnostics, attachments, dropped, drop, submit],
  );
}

/**
 * The block itself: one collapsed button, and everything it holds once it is opened.
 *
 * Collapsed it says nothing but its own name — no placeholder, no note, no hint that
 * anything would be sent. That is the whole of the default: a task created without touching
 * it is an ordinary task, linked to nothing and reported nowhere.
 */
export function LandedFeedbackBlock({ feedback }: { feedback: LandedFeedback }) {
  const c = useCopy().board.feedback;
  if (!feedback.offered) return null;

  if (!feedback.open) {
    return (
      <button
        type="button"
        onClick={feedback.expand}
        className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-[700] text-nb-ink-soft transition-colors hover:bg-nb-ink/5 hover:text-nb-ink"
      >
        <FiChevronRight size={13} aria-hidden />
        {c.link.expand}
      </button>
    );
  }

  return (
    <div className="mt-2.5 rounded-[10px] bg-nb-sheet px-3.5 py-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[12px] font-[700]">
          <FiChevronDown size={13} aria-hidden />
          {c.link.expand}
        </span>
        {/* One way out that undoes everything — the fold, the link and both ticks. What was
            typed is the box's, and it stays. */}
        <button
          type="button"
          onClick={feedback.cancel}
          className="cursor-pointer text-[12px] text-nb-ink-soft transition-colors hover:text-nb-ink"
        >
          {c.link.cancel}
        </button>
      </div>

      {feedback.card ? (
        <PickedCard card={feedback.card} onClear={() => feedback.pick(null)} />
      ) : (
        <ArchiveSearch onPick={feedback.pick} />
      )}

      <div className="mt-3.5 flex flex-col gap-2.5">
        <Tick
          on={feedback.share}
          onFlip={feedback.setShare}
          label={c.link.share}
          note={c.link.shareNote}
        />
        {/* Off while nothing is shared: an attachment with no submission to ride on is a
            tick that does nothing. */}
        {feedback.share && feedback.attachments && (
          <div>
            <Tick
              on={feedback.diagnostics}
              onFlip={feedback.setDiagnostics}
              label={c.link.diagnostics}
              note={feedback.diagnostics ? c.link.diagnosticsNote : undefined}
            />
            {feedback.diagnostics && (
              <div className="mt-2 flex flex-col" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                {feedback.attachments.map((attachment) => (
                  <Attachment
                    key={attachment.part}
                    attachment={attachment}
                    out={feedback.dropped.includes(attachment.part)}
                    onDrop={(dropOut) => feedback.drop(attachment.part, dropOut)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The archived cards matching what is typed. Nothing here blocks the task being created:
 *  an empty archive, no match and an archive that would not read all say so in the block and
 *  leave the box above it alone. */
function ArchiveSearch({ onPick }: { onPick: (card: ArchivedCard) => void }) {
  const c = useCopy().board.feedback.link;
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ArchivedCard[] | null>(null);
  // The board could not be read — a different answer from "nothing matches", and the one
  // worth a Try again. `attempt` is what that button bumps to run the search over.
  const [unread, setUnread] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const q = query.trim();

  useEffect(() => {
    if (!q) {
      setMatches(null);
      setUnread(false);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      void searchArchivedAction(q).then((found) => {
        if (!live) return;
        setUnread(!found.ok);
        setMatches(found.ok ? found.cards : null);
      });
    }, SEARCH_PAUSE);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, attempt]);

  return (
    <div>
      <label className="flex items-center gap-2 rounded-[8px] bg-nb-paper px-2.5 py-2 text-[12.5px] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]">
        <FiSearch size={13} className="shrink-0 text-nb-ink-soft" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={c.search}
          aria-label={c.search}
          className="w-full bg-transparent outline-none placeholder:text-nb-ink-soft"
        />
      </label>
      {unread && (
        <p className="mt-2 flex items-center gap-2 text-[12px] text-nb-ink-soft">
          {c.failed}
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="cursor-pointer font-[700] text-nb-accent-deep underline-offset-2 hover:underline"
          >
            {c.retry}
          </button>
        </p>
      )}
      {!unread && matches !== null && matches.length === 0 && (
        <p className="mt-2 text-[12px] text-nb-ink-soft">{c.empty}</p>
      )}
      {matches !== null && matches.length > 0 && (
        <div className="mt-1.5 flex flex-col">
          {matches.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => onPick(card)}
              className="flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-nb-ink/5"
              style={{ borderBottom: `1px solid ${HAIRLINE}` }}
            >
              <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-nb-ink-soft">
                #{card.id}
              </span>
              <span className="min-w-0 flex-1 truncate">{card.title}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-nb-ink-soft">
                {card.archived}
              </span>
              <FiPlus size={12} className="shrink-0 text-nb-ink-soft" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The linked card, once one is picked: its number, its title and the day it was archived —
 *  and the one control that takes it back off. */
function PickedCard({ card, onClear }: { card: ArchivedCard; onClear: () => void }) {
  const c = useCopy().board.feedback.link;
  return (
    <div className="flex items-center gap-2.5 rounded-[8px] bg-nb-paper px-2.5 py-2 text-[12.5px] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)]">
      <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-nb-ink-soft">#{card.id}</span>
      <span className="min-w-0 flex-1 truncate font-[600]">{card.title}</span>
      {card.archived && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-nb-ink-soft">{card.archived}</span>
      )}
      <button
        type="button"
        onClick={onClear}
        aria-label={c.clear}
        title={c.clear}
        className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-[5px] text-nb-ink-soft transition-colors hover:bg-nb-ink/10 hover:text-nb-ink"
      >
        <FiX size={13} />
      </button>
    </div>
  );
}

/** One authorisation. Both of them read the same and both start off. */
function Tick({
  on,
  onFlip,
  label,
  note,
}: {
  on: boolean;
  onFlip: (on: boolean) => void;
  label: string;
  note?: string;
}) {
  return (
    <label className="block cursor-pointer text-[12.5px] leading-relaxed">
      <span className="flex items-start gap-2 font-[700] text-nb-ink">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onFlip(e.target.checked)}
          className="mt-[3px] size-[14px] shrink-0 cursor-pointer accent-nb-accent-deep"
        />
        {label}
      </span>
      {note && <span className="mt-1 block pl-[22px] text-[12px] text-nb-ink-soft">{note}</span>}
    </label>
  );
}

/** One attachment: what it is, what it comes to, and the two things that can be done with
 *  it — read it, or take it out. Read in full, because what is shown is what is sent. */
function Attachment({
  attachment,
  out,
  onDrop,
}: {
  attachment: FeedbackAttachment;
  out: boolean;
  onDrop: (out: boolean) => void;
}) {
  const c = useCopy().board.feedback.link;
  const [open, setOpen] = useState(false);
  // What this row would actually upload — `bytes` is what the machine holds, which on a cut
  // part is larger than what goes. The row has to name the second: it is the size the tick
  // beside it is decided on.
  const going = useMemo(() => new TextEncoder().encode(attachment.text).length, [attachment.text]);
  return (
    <div style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
      <div className={`flex items-center gap-2 py-1.5 text-[12px] ${out ? "opacity-45" : ""}`}>
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          disabled={out}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left disabled:cursor-not-allowed"
        >
          <FiChevronRight
            size={12}
            aria-hidden
            className={`shrink-0 text-nb-ink-soft transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          />
          <span className="truncate font-[600]">{c.parts[attachment.part]}</span>
        </button>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-nb-ink-soft">
          {c.size(going)}
          {attachment.cut && ` · ${c.partCut}`}
        </span>
        <button
          type="button"
          onClick={() => onDrop(!out)}
          className="shrink-0 cursor-pointer text-[11.5px] text-nb-ink-soft transition-colors hover:text-nb-ink"
        >
          {out ? c.restore : c.drop}
        </button>
      </div>
      {open && !out && (
        <pre className="mb-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-[6px] bg-nb-paper p-2 font-mono text-[11px] leading-relaxed text-nb-ink-soft">
          {attachment.text}
        </pre>
      )}
    </div>
  );
}

// ---- the standing Feedback button -------------------------------------------

/**
 * Feedback about anything at all — the install, a screen, a word that reads wrong.
 *
 * It carries the sentence and nothing else: no card, no conversation, no run log, and no way
 * for us to write back. It is live whatever the usage-reporting switch says, because that
 * switch is about the anonymous numbers and this is a thing somebody chose to send.
 */
export function FeedbackButton({ row = false }: { row?: boolean }) {
  const c = useCopy().board.feedback;
  const [offered, setOffered] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void feedbackOfferedAction().then((can) => live && setOffered(can));
    return () => {
      live = false;
    };
  }, []);

  if (!offered) return null;
  return (
    <>
      {/* `row` is the same button on the phone's More screen (#357). Feedback belongs
          there, beside Goal and Insights, rather than among the four things that want a
          window: it is a box and a send, and a phone can do both. */}
      {row ? (
        <button type="button" className={PHONE_ROW} onClick={() => setOpen(true)}>
          <FiFlag size={17} className="shrink-0 text-nb-ink-soft" aria-hidden />
          <span className="min-w-0 flex-1">{c.button}</span>
          <FiChevronRight className="shrink-0 text-nb-ink-soft" size={16} aria-hidden />
        </button>
      ) : (
        <Button
          variant="ghost"
          size="xs"
          className="shrink-0"
          onClick={() => setOpen(true)}
          aria-label={c.button}
        >
          <FiFlag className="text-[13px]" aria-hidden />
          <span className="sr-only sm:not-sr-only">{c.button}</span>
        </Button>
      )}
      {open && <FeedbackSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const t = useCopy();
  const c = t.board.feedback;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    const res = await sendFeedbackAction({ text, source: "board" as FeedbackSource });
    setSending(false);
    if (res.ok) return setSent(true);
    setError(failureLine(c.failed.standing, c.failed, res));
  };

  return (
    <Dialog title={c.sheet.title} onClose={onClose} width={520}>
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-[13px] leading-relaxed">{c.sheet.sent}</p>
          <div className="flex justify-end">
            <Button onClick={onClose}>{t.shared.close}</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Who takes it, what goes, and how long the permission lasts — said before the
              box, not under the button. */}
          <p className="text-[12.5px] leading-relaxed text-nb-ink-soft">{c.sheet.blurb}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={c.sheet.placeholder}
            aria-label={c.sheet.placeholder}
            autoFocus
            rows={7}
            className="w-full resize-y rounded-[10px] bg-nb-paper p-3 text-[13px] leading-relaxed outline-none shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nb-ink)_18%,transparent)] focus:shadow-[inset_0_0_0_1.5px_var(--color-nb-accent)]"
          />
          {error && (
            <p className="nb-panel-sm break-words bg-nb-peach-soft p-2.5 text-[12px] leading-relaxed text-nb-peach-ink">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11.5px] text-nb-ink-soft">{c.sheet.noReply}</span>
            <Button disabled={!text.trim() || sending} onClick={() => void send()}>
              {sending ? c.sheet.sending : c.sheet.send}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

// ---- what a refusal reads as ------------------------------------------------

/** One line: what happened to the submission, and why. `lead` is what the surface it was
 *  written on says happened — on New task, that the task was created all the same. */
export function failureLine(
  lead: string,
  words: { tooLarge: string; refused: string; unreachable: string },
  sent: FeedbackSent,
): string {
  const why =
    sent.reason === "too-large"
      ? words.tooLarge
      : sent.reason === "refused"
        ? words.refused
        : words.unreachable;
  return `${lead} ${why}`;
}

/** The sentence New task shows under its own button when a submission did not go. */
export function useTaskFailureLine(): (sent: FeedbackSent) => string {
  const c = useCopy().board.feedback.failed;
  return useMemo(() => (sent: FeedbackSent) => failureLine(c.task, c, sent), [c]);
}
