"use client";

// Feedback on a landed task (#603) — the block on New task that links the task a fix is
// about — and team feedback (#628, #679): the card a discussion links, and the switch that
// says ending this conversation shares it.
//
// Two things the whole file is built around:
//
//   - **Nothing is collected until it is ticked.** The block on New task is one collapsed
//     button; opening it collects nothing either. Sharing what was typed and attaching
//     diagnostics are separate ticks, both off, and both about this one submission. Cancel
//     folds the block and forgets every tick, keeping the description in the box.
//   - **The preview IS the submission.** The four attachments are listed with their sizes
//     and read in full before they go, and one taken out is one the sender never sees.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiChevronRight, FiPlus, FiSearch, FiX } from "react-icons/fi";
import {
  feedbackDiagnosticsAction,
  feedbackOfferedAction,
  partnerFeedbackAction,
  searchArchivedAction,
  searchLinkableAction,
  sendFeedbackAction,
  setChatCardAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { ShareSwitch } from "@/lib/chat-rail";
import type {
  ArchivedCard,
  DiscussionTarget,
  FeedbackAttachment,
  FeedbackPart,
  FeedbackSent,
} from "@/lib/types";
import { HAIRLINE } from "./chrome";
import { PartnerTerms } from "./Privacy";
import { Switch } from "./settings";

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

// ---- what a refusal reads as ------------------------------------------------

/** One line: what happened to the submission, and why. `lead` is what the surface it was
 *  written on says happened — on New task, that the task was created all the same. */
function failureLine(
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

// ---- the partner submission written in a discussion (#628) ------------------
//
// Same shape as the block above and a different thing entirely. That one takes feedback on a
// landed task and lists four attachments the user reads before they go. This one is somebody
// saying, mid-discussion, that a spec missed what they meant — the `feedback` agent works out
// where, gathers what would reproduce it, and sends it. Nothing is previewed, which is
// exactly what the terms behind **See what is shared** say.
//
// Two answers, and neither implies the other: this machine takes part (Configuration →
// General), and this one message was ticked to share. With the machine opted out there is
// nothing to tick — the block offers the way to opt in instead, because a tick that does
// nothing is worse than no tick.

/** What the Discuss block is holding. */
export interface DiscussFeedback {
  /** Whether this board's rules know about team feedback at all. */
  offered: boolean;
  open: boolean;
  /** Fold and unfold. Folding only hides — the link is still what the next message carries. */
  toggle: () => void;
  /** Forget the link, and take it off the discussion. What was typed is the box's, and it
   *  stays. */
  unlink: () => void;
  card: ArchivedCard | null;
  pick: (card: ArchivedCard | null) => void;
  /** What the send carries, or undefined when nothing is linked. */
  sending: { cardId: number } | undefined;
}

export function useDiscussFeedback(
  discussion: DiscussionTarget | null,
  /** The card this discussion's transcript already says it is about, from the rail's read.
   *  A link outlives the sitting it was made in (#679), so it has to be on screen in the
   *  next one — the ✕ on it is the only way to take it off again. */
  linked: number | null,
): DiscussFeedback {
  const [offered, setOffered] = useState(false);
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<ArchivedCard | null>(null);
  /** The discussion the link area has settled on its own: read back off the transcript, or
   *  picked by hand. Either way the read is not asked again, so a poll that is still
   *  carrying the old number cannot undo a fresh pick. */
  const settled = useRef<string | null>(null);

  // `null` is rules that predate team feedback, and the block is not drawn at all. Linking is
  // offered whichever way the machine's own switch is set: it is what hands the turn to the
  // `feedback` agent, and that happens opted out too. Sharing is the switch under the box.
  useEffect(() => {
    let live = true;
    void partnerFeedbackAction().then((held) => live && setOffered(held !== null));
    return () => {
      live = false;
    };
  }, []);

  // Another discussion is another problem: nothing of the last one's link carries over.
  useEffect(() => {
    setCard(null);
    settled.current = null;
  }, [discussion]);

  // …and then what this one's transcript still says, named by its number alone. Searched by
  // that number, which is how the box below finds a card too.
  useEffect(() => {
    if (!discussion || linked === null || settled.current === discussion) return;
    settled.current = discussion;
    void searchLinkableAction(String(linked)).then((found) => {
      if (!found.ok) return;
      const one = found.cards.find((match) => match.id === linked);
      if (one) setCard(one);
    });
  }, [discussion, linked]);

  // Written beside the transcript as it is picked, not only when a message goes: the end of a
  // shared conversation reads the card off that file, and it may come long after the last
  // message.
  const link = useCallback(
    (picked: ArchivedCard | null) => {
      setCard(picked);
      settled.current = discussion;
      if (discussion) void setChatCardAction(discussion, picked?.id ?? null);
    },
    [discussion],
  );

  const unlink = useCallback(() => link(null), [link]);
  const toggle = useCallback(() => setOpen((on) => !on), []);

  return useMemo(
    () => ({
      offered,
      open,
      toggle,
      unlink,
      card,
      pick: link,
      sending: card ? { cardId: card.id } : undefined,
    }),
    [offered, open, toggle, unlink, card, link],
  );
}

/**
 * The block under the box in Discuss: one collapsed button, and the card it links.
 *
 * Collapsed it says nothing but its own name. That is the whole of the default — a discussion
 * held without touching it links nothing and reports nothing. Sharing is not in here: it is
 * the switch on the row under the box (`ShareRow`), where a card conversation can reach it
 * too.
 */
export function DiscussFeedbackBlock({ feedback }: { feedback: DiscussFeedback }) {
  const c = useCopy().board.partner;
  if (!feedback.offered) return null;

  return !feedback.open ? (
    <button
      type="button"
      onClick={feedback.toggle}
      aria-expanded={false}
      className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-1 text-[12px] font-[700] text-nb-ink-soft transition-colors hover:bg-nb-ink/5 hover:text-nb-ink"
    >
      <FiChevronRight size={13} aria-hidden />
      {c.expand}
    </button>
  ) : (
    <div className="mt-2.5 rounded-[10px] bg-nb-sheet px-3.5 py-3">
      {/* The title folds it back up — the only control the header needs. Unlinking is the
          ✕ on the card below, where the link itself is. */}
      <button
        type="button"
        onClick={feedback.toggle}
        aria-expanded
        className="mb-2.5 -ml-1 flex cursor-pointer items-center gap-1.5 rounded-[8px] px-1 py-0.5 text-[12px] font-[700] transition-colors hover:bg-nb-ink/5"
      >
        <FiChevronDown size={13} aria-hidden />
        {c.expand}
      </button>

      {feedback.card ? (
        <PickedCard card={feedback.card} onClear={feedback.unlink} />
      ) : (
        <LinkSearch onPick={feedback.pick} />
      )}
    </div>
  );
}

/**
 * The switch on the row under the box (#679), on both the Discuss screen and a card's chat.
 *
 * Off on every new conversation, and what it says is the whole of what it does: ending this
 * conversation shares it with the AI4Kanban team. Nothing is collected while it is on, and
 * nothing of what came of a submission is ever drawn here — the conversation it was about is
 * over by then.
 */
export function ShareRow({ share }: { share: ShareSwitch }) {
  const c = useCopy().board.partner.team;
  if (!share.offered) return null;
  return (
    <>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className={share.on ? "font-[700] text-nb-accent-deep" : undefined}>
          {share.on ? c.on : c.off}
        </span>
        <Switch
          on={share.on}
          size="sm"
          label={c.label}
          onFlip={async (next) => share.flip(next)}
        />
      </span>
      {/* The first press reads the terms — the same page the Configuration switch opens, and
          the same yes. Saying yes here shares this one conversation and no other. */}
      {share.asking && (
        <PartnerTerms ask onClose={share.cancel} onConfirm={() => void share.agree()} />
      )}
    </>
  );
}

/** The cards this discussion can be linked to — open ones and archived ones. An open card
 *  says so instead of showing a date it does not have. */
function LinkSearch({ onPick }: { onPick: (card: ArchivedCard) => void }) {
  const c = useCopy().board.partner;
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ArchivedCard[] | null>(null);
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
      void searchLinkableAction(q).then((found) => {
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
                {card.archived || c.onBoard}
              </span>
              <FiPlus size={12} className="shrink-0 text-nb-ink-soft" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
