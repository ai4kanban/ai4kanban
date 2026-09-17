"use client";

// Team feedback (#628, #679): the card a discussion links, and the switch that says ending
// this conversation shares it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiPlus, FiSearch, FiX } from "react-icons/fi";
import {
  partnerFeedbackAction,
  searchLinkableAction,
  setChatCardAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { ShareSwitch } from "@/lib/chat-rail";
import type { ArchivedCard, DiscussionTarget } from "@/lib/types";
import { HAIRLINE } from "./chrome";
import { PartnerTerms } from "./Privacy";
import { Switch } from "./settings";

/** How long the typing has to stop before the archive is searched — the card search's own
 *  pause, so the two boxes answer at the same speed. */
const SEARCH_PAUSE = 120;

/** The linked card, once one is picked: its number, its title and the day it was archived —
 *  and the one control that takes it back off. */
function PickedCard({ card, onClear }: { card: ArchivedCard; onClear: () => void }) {
  const c = useCopy().board.partner;
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
  /** Forget the link, and take it off the discussion. What was typed is the box's, and it
   *  stays. */
  unlink: () => void;
  /** Let go of the card on screen without writing anything — sharing going off has already
   *  taken it off the discussion (#659), and a second write would race that one. */
  forget: () => void;
  /** Whether this discussion has picked a card at all (#659) — which is the whole of what
   *  the end is allowed on. `card` is the row drawn for it, and a card that was rejected or
   *  is simply slow to come back leaves that null while the pick still stands. */
  linked: boolean;
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
  const [card, setCard] = useState<ArchivedCard | null>(null);
  /** The number this discussion is on, held apart from the row drawn for it: the end reads
   *  the pick, never the search that put a title on it (#659). */
  const [pickedId, setPickedId] = useState<number | null>(null);
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
    setPickedId(null);
    settled.current = null;
  }, [discussion]);

  // …and then what this one's transcript still says, named by its number alone. Searched by
  // that number, which is how the box below finds a card too.
  useEffect(() => {
    if (!discussion || linked === null || settled.current === discussion) return;
    settled.current = discussion;
    setPickedId(linked);
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
      setPickedId(picked?.id ?? null);
      settled.current = discussion;
      if (discussion) void setChatCardAction(discussion, picked?.id ?? null);
    },
    [discussion],
  );

  const unlink = useCallback(() => link(null), [link]);
  const forget = useCallback(() => {
    setCard(null);
    setPickedId(null);
  }, []);

  return useMemo(
    () => ({
      offered,
      unlink,
      forget,
      linked: pickedId !== null,
      card,
      pick: link,
      sending: pickedId !== null ? { cardId: pickedId } : undefined,
    }),
    [offered, unlink, forget, pickedId, card, link],
  );
}

/**
 * The block under the box in Discuss: the card this discussion shares under.
 *
 * It is what turning the switch on opens (#659), and there is nothing to fold: the switch is
 * the answer to whether any of this is wanted, and a second one under it would only be the
 * same question again. Off, the screen draws none of it — CreateSheet holds that.
 */
export function DiscussFeedbackBlock({ feedback }: { feedback: DiscussFeedback }) {
  const c = useCopy().board.partner;
  if (!feedback.offered) return null;

  return (
    <div className="mt-2.5 rounded-[10px] bg-nb-sheet px-3.5 py-3">
      <p className="mb-2.5 text-[12px] font-[700]">{c.expand}</p>
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
        <span className={share.on ? "font-[700] text-nb-accent-deep" : undefined}>{c.name}</span>
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
