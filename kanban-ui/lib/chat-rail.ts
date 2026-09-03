import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePanelRef, type Layout, type LayoutChangedMeta } from "react-resizable-panels";
import {
  clearChatAction,
  pickChatAgentAction,
  pickChatModelAction,
  readChatAction,
  sendChatAction,
  stopChatAction,
} from "@/app/actions";
import { useCopy } from "@/i18n/use-copy";
import type { ChatRead } from "./chat";
import { useMatches } from "./media";
import { overRail } from "./over-rail";

// The chat rail's own state (#242): whether it is up, how wide it is, and the conversation
// it is showing.
//
// It sits in the window rather than in the rail, for two reasons. The Chat button is in the
// top row and the conversation is down the right side, so something above both has to hold
// whether it is open. And the rail is drawn in two shapes — a panel on a wide window, an
// overlay on a narrow one — so what the user has typed lives here and survives the window
// being dragged across that line.
//
// What is kept in the browser is how the user likes the rail, not what was said: the fold
// and the width belong to the window (like lib/rail-width.ts), and the conversation itself
// is a file on this machine, read from the server.
//
// The same poll is what keeps the page under it honest (#243). A chat writes the board as
// it answers, so every read carries the board's fingerprint; when that moves, the page is
// told, and it re-reads. That is why a card archived mid-reply leaves the board in the same
// second rather than at the end of the reply — and why the poll runs fast for any reply
// being written on this machine, not only for one this window asked for.

const OPEN_KEY = "kanban-ui.chat-open";
const WIDTH_KEY = "kanban-ui.chat-width";
/** When a reply was last read, per project and per conversation — what the button's mark
 *  is worked out from. */
const SEEN_PREFIX = "kanban-ui.chat-seen:";

/** What the rail opens at: wide enough for a paragraph of reply without a line break every
 *  few words, narrow enough to leave the board the screen. Shared with the bell
 *  (lib/bell-rail.ts) — one side of the window, one width. */
export const CHAT_W = 420;
export const CHAT_MIN = 320;
export const CHAT_MAX = 680;

/** Under this the window cannot hold the board between two rails, so the chat covers it
 *  instead of squeezing it. */
const OVERLAY_UNDER = "(width < 60rem)";

// How often the conversation is re-read: fast while a reply is being written, slow while the
// rail is simply up, slower while it is folded — where the only thing a read can still say
// is that there is something new to come back to.
const LIVE_MS = 350;
const OPEN_MS = 2500;
const FOLDED_MS = 8000;

/** What a poll saw change on the board, handed to whoever is drawing the page. */
export interface BoardChange {
  /** This is a card's conversation and that card has gone — archived or rejected. The card's
   *  page has nothing left to draw, so it goes back to the board. */
  cardGone: boolean;
}

export interface ChatRail {
  /** The conversation on screen: a card id, or null for the board's own. */
  cardId: number | null;
  /** The card's title, when this is a card's conversation. */
  cardTitle: string;
  open: boolean;
  toggle(): void;
  fold(): void;
  /** The window is too narrow for the rail to stand beside the board, so it covers it. */
  overlay: boolean;
  /** A reply arrived while the rail was folded. */
  unread: boolean;
  /** The conversation as the server last read it — null until the first read lands. */
  read: ChatRead | null;
  /** The reply being written this second, as far as it has got — this server's own, so it
   *  is also the one that can be stopped. Null from the moment it is stopped. */
  live: string | null;
  /** A reply is coming, whoever started it: this window, another window, or a terminal
   *  (#268). Sending waits for it; the box does not. */
  answering: boolean;
  /** A stopped reply's words, held on screen until the transcript has them (#267). */
  stopped: string | null;
  /** End the reply being written, keeping what arrived. Nothing to stop is quietly
   *  ignored. */
  stop(): Promise<void>;
  /** What the user has typed and not yet sent. */
  draft: string;
  setDraft(text: string): void;
  /** Walk this conversation's own sent messages back into an empty box — `back` is
   *  up-arrow, and the answer is whether the key was taken (#268). */
  recall(back: boolean): boolean;
  /** Why the last send never got off the ground. Cleared by the next one. */
  error: string | null;
  send(): Promise<void>;
  /** Send a message that was already sent once, again (#269) — a reply that stopped short
   *  or came back empty. It lands at the foot; the box and what is typed in it are left
   *  alone. */
  resend(text: string): void;
  /** Put a message you sent back in the box to edit (#269). Answers false when something
   *  is already typed there and `force` was not given — what is typed is never
   *  overwritten, so the button asks once and calls again. */
  reword(text: string, force?: boolean): boolean;
  /** Run this conversation on another agent (#272), or on the board's again with `null`.
   *  It starts the conversation over — the caller asks first when there is something to
   *  lose. */
  pickAgent(harness: string | null): Promise<void>;
  /** Run it on another model, or on the board's again with `null`. The conversation carries
   *  on; the next message runs on it. */
  pickModel(model: string | null): Promise<void>;
  clear(): Promise<void>;
  /** The panel the rail is drawn in, so the window can make it draggable. */
  panel: ReturnType<typeof usePanelRef>;
  onLayoutChanged(layout: Layout, meta: LayoutChangedMeta): void;
  onDoubleClick(): void;
}

export function useChatRail({
  projectRoot,
  cardId,
  cardTitle = "",
  onBoardChanged,
}: {
  projectRoot: string;
  cardId: number | null;
  cardTitle?: string;
  /** Called when the board has moved since the last poll — by this chat, by a terminal one,
   *  or by anything else on this machine. The page re-reads itself on it. */
  onBoardChanged?(change: BoardChange): void;
}): ChatRail {
  const c = useCopy().messages.chat;
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<ChatRead | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState<string | null>(null);
  // How far back through this conversation's sent messages the arrows have walked, newest
  // at 0 — null while the box holds what the user typed rather than what they once sent.
  const [walked, setWalked] = useState<number | null>(null);

  // Another card's page is another conversation, and nothing of the last one carries over
  // to it: not its messages, not a half-typed message, not the error its last send left.
  // Done while rendering rather than in an effect, so the new page never paints a frame of
  // the old card's exchange before the first read of its own lands.
  const [showing, setShowing] = useState(cardId);
  if (showing !== cardId) {
    setShowing(cardId);
    setRead(null);
    setDraft("");
    setError(null);
    setHeld(null);
    setWalked(null);
  }

  const overlay = useMatches(OVERLAY_UNDER);
  const { panel, onLayoutChanged, onDoubleClick } = useWidth();
  const seen = useSeen(projectRoot, cardId);
  // A poll the actions can force, so a message and its answer don't wait out the tick that
  // was already running.
  const kickRef = useRef<() => void>(() => {});

  // Client-only, so it lands after the first paint: reading it during the render would
  // desync hydration, and the rail is folded by default anyway.
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(OPEN_KEY) === "1");
    } catch {
      // storage unavailable — the rail opens folded and stays open for this window only
    }
  }, []);

  // What the server says is being written, and what this window has stopped. A stop is
  // over from the click, so the words are held here for the beat before the read agrees —
  // long enough that the rail never blinks between the reply and its stopped self.
  const writing = read?.live ?? null;
  // Let go once the server holds nothing at all: the turn is done and the transcript has
  // the words, so holding them here too would draw them twice. Read at render as well as
  // dropped below, because an effect runs after the paint — and that paint is the reply
  // drawn twice. The effect is still what clears the words, so the next reply starts on an
  // empty hold.
  const settled = read !== null && read.live === null && read.stopped === null;
  const holding = settled ? null : held;
  const live = holding !== null ? null : writing;
  const stopped = read?.stopped ?? holding;
  const liveRef = useRef<string | null>(null);
  liveRef.current = writing;
  useEffect(() => {
    if (settled) setHeld(null);
  }, [settled]);
  // What the rail draws. For the beat between the click and the read that agrees with it,
  // this window still holds the read from before the stop — and its "this conversation is
  // still answering" is already untrue. Dropped here, so nothing goes on saying the
  // conversation is answering, and the box can send the next message rather than waiting.
  const shown =
    read !== null && holding !== null && read.stopped === null ? { ...read, answering: false } : read;

  // Any reply being written on this machine, not only one this window started: a
  // conversation carried on from a terminal writes this same board, and the page under the
  // rail has to keep up with it too. What sending waits for reads it off `shown`, so a
  // stopped reply frees the box from the click; the poll reads the raw one, so the seconds
  // that stop spends landing are still read at the fast cadence.
  const answering = live !== null || Boolean(shown?.answering);
  const anyFlight = live !== null || Boolean(read?.answering);

  // The board's fingerprint as this window last saw it, and the callback to fire when it
  // moves. Both in refs: they change what a poll DOES, never how often it runs, so neither
  // belongs in the poll effect's dependencies — restarting the loop on a fresh closure
  // would reset its cadence on every render.
  const stampRef = useRef<string | null>(null);
  const changedRef = useRef<typeof onBoardChanged>(onBoardChanged);
  changedRef.current = onBoardChanged;

  // A different conversation is a different page, freshly rendered from the board as it is,
  // so whatever the last one had seen says nothing about this one. Kept out of the poll
  // effect below, which also restarts when the cadence changes — losing the fingerprint
  // there would swallow the very change that started a reply.
  useEffect(() => {
    stampRef.current = null;
  }, [cardId]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let answeringNow = anyFlight;
    const tick = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const next = await readChatAction(cardId);
        if (!alive) return;
        answeringNow = next.live !== null || next.answering;
        setRead(next);
        // The first read only takes the fingerprint down — there is nothing to compare it
        // against yet, and firing on it would re-read a page that had only just rendered.
        if (next.stamp !== null && next.stamp !== stampRef.current) {
          const first = stampRef.current === null;
          stampRef.current = next.stamp;
          if (!first) changedRef.current?.({ cardGone: next.cardGone });
        }
      } catch {
        // transient — the next tick tries again
      } finally {
        inFlight = false;
      }
      if (!alive) return;
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        timer = setTimeout(tick, answeringNow ? LIVE_MS : open ? OPEN_MS : FOLDED_MS);
      }
    };
    kickRef.current = () => {
      if (!alive) return;
      clearTimeout(timer);
      void tick();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") kickRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // `anyFlight` restarts the loop when a reply starts or ends, so the cadence follows it
    // rather than waiting out a slow tick to notice.
  }, [cardId, open, anyFlight]);

  // Reading is what marks a reply read: the rail is up and the words are on screen. A
  // conversation this window has never looked at is adopted as read instead — one held in a
  // terminal last week is not news.
  const chat = read?.chat ?? null;
  useEffect(() => {
    if (!chat) return;
    if (open) seen.mark(chat.updatedAt);
    else seen.adopt(chat.updatedAt);
  }, [open, chat, seen]);

  const toggle = useCallback(() => {
    setOpen((was) => {
      const now = !was;
      try {
        window.localStorage.setItem(OPEN_KEY, now ? "1" : "0");
      } catch {
        // storage unavailable — the fold lasts as long as the window does
      }
      return now;
    });
  }, []);
  const fold = useCallback(() => {
    setOpen(() => {
      try {
        window.localStorage.setItem(OPEN_KEY, "0");
      } catch {}
      return false;
    });
  }, []);

  const stop = useCallback(async () => {
    // Nothing to stop is nothing to do — a reply that landed between the paint and the
    // click is quietly ignored.
    const words = liveRef.current;
    if (words === null) return;
    setHeld(words);
    try {
      await stopChatAction(cardId);
    } catch {
      // The stop never landed, so let the reply speak for itself again rather than showing
      // it frozen under a note that isn't true.
      setHeld(null);
    }
    kickRef.current();
  }, [cardId]);

  // Esc stops it too, and only then: the rail up, a reply of this window's coming, nothing
  // over the rail, and the key not pressed in a text box the chat's own box excepted — that
  // one is live while a reply comes (#268), and is where the hand already is.
  const writingNow = live !== null;
  useEffect(() => {
    if (!open || !writingNow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (overRail() || (inTextBox(e.target) && !isChatBox(e.target))) return;
      void stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The reply's words change every tick; whether there IS one is what binds the key.
  }, [open, writingNow, stop]);

  // This conversation's own sent messages, oldest first, read from the transcript — so the
  // walk survives a reload, takes in what a terminal sent, and is nobody else's.
  const sent = useMemo(
    () => (chat?.messages ?? []).filter((m) => m.role === "you").map((m) => m.text),
    [chat],
  );

  // Typing is what ends a walk: from there the box holds the user's words again.
  const type = useCallback((text: string) => {
    setDraft(text);
    setWalked(null);
  }, []);

  const recall = useCallback(
    (back: boolean) => {
      if (sent.length === 0) return false;
      // Only an empty box starts a walk; in a typed one the arrows belong to the caret.
      if (walked === null) {
        if (!back || draft !== "") return false;
        setWalked(0);
        setDraft(sent[sent.length - 1]);
        return true;
      }
      const step = back ? walked + 1 : walked - 1;
      // Past the oldest, stay on it. Past the newest, the box is the user's own again.
      if (step >= sent.length) return true;
      if (step < 0) {
        setWalked(null);
        setDraft("");
        return true;
      }
      setWalked(step);
      setDraft(sent[sent.length - 1 - step]);
      return true;
    },
    [sent, walked, draft],
  );

  // One message out of the door, whether it came from the box or from a "send again" on a
  // reply that stopped short. The answer is whether it left.
  const post = useCallback(
    async (text: string) => {
      setError(null);
      setHeld(null);
      const res = await sendChatAction(cardId, text);
      if (!res.ok) setError(res.error ?? c.sendFailed);
      kickRef.current();
      return res.ok;
    },
    [cardId, c],
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    setWalked(null);
    // The words go back in the box rather than being lost to a refusal.
    if (!(await post(text))) setDraft((typed) => (typed ? typed : text));
  }, [draft, post]);

  // Nothing of the box is touched: a half-typed message survives a "send again", and the
  // exchange above is left as it was — the message lands at the foot.
  const resend = useCallback((text: string) => void post(text), [post]);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const reword = useCallback((text: string, force?: boolean) => {
    if (!force && draftRef.current.trim() !== "") return false;
    setDraft(text);
    setWalked(null);
    // After the paint, so the caret lands past words the box does not have yet.
    requestAnimationFrame(() => {
      const box = chatBox();
      if (!box) return;
      box.focus();
      box.setSelectionRange(box.value.length, box.value.length);
    });
    return true;
  }, []);

  const pickAgent = useCallback(
    async (harness: string | null) => {
      setError(null);
      const res = await pickChatAgentAction(cardId, harness);
      if (!res.ok) setError(res.error ?? c.pickFailed);
      // Only where the switch really threw a transcript away: what the rail was still
      // holding of it goes too. A refused switch, and one to the agent it already runs,
      // cost nothing — least of all what is typed in the box.
      if (res.cleared) {
        setHeld(null);
        setDraft("");
        setWalked(null);
        seen.mark(0);
      }
      kickRef.current();
    },
    [cardId, seen, c],
  );

  const pickModel = useCallback(
    async (model: string | null) => {
      setError(null);
      const res = await pickChatModelAction(cardId, model);
      if (!res.ok) setError(res.error ?? c.pickFailed);
      kickRef.current();
    },
    [cardId, c],
  );

  const clear = useCallback(async () => {
    setError(null);
    const res = await clearChatAction(cardId);
    if (!res.ok) setError(res.error ?? c.clearFailed);
    seen.mark(0);
    kickRef.current();
  }, [cardId, seen, c]);

  const last = chat?.messages[chat.messages.length - 1];
  const unread = !open && !!chat && last?.role === "agent" && chat.updatedAt > seen.at;

  return {
    cardId,
    cardTitle,
    open,
    toggle,
    fold,
    overlay,
    unread,
    read: shown,
    live,
    answering,
    stopped,
    stop,
    draft,
    setDraft: type,
    recall,
    error,
    send,
    resend,
    reword,
    pickAgent,
    pickModel,
    clear,
    panel,
    onLayoutChanged,
    onDoubleClick,
  };
}

/** The chat's own box — the one text box that hands Esc back to the rail. Marked with
 *  `data-chat-box` in components/Chat.tsx. */
function isChatBox(target: EventTarget | null): boolean {
  return (target as HTMLElement | null)?.hasAttribute?.("data-chat-box") === true;
}

/** That same box, to put reworded words in front of the caret. */
function chatBox(): HTMLTextAreaElement | null {
  return document.querySelector<HTMLTextAreaElement>("textarea[data-chat-box]");
}

/** The key belongs to whatever is being typed in — the card rail's search, a name box —
 *  so the rail only ever sees one nothing else wanted. */
function inTextBox(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
}

// How wide the rail has been dragged, remembered across reloads — the left rail's rule,
// mirrored (lib/rail-width.ts): pixels rather than a share of the window, applied after
// mount, and only a real drag written down.
function useWidth() {
  const panel = usePanelRef();
  useEffect(() => {
    let saved = 0;
    try {
      saved = Number(window.localStorage.getItem(WIDTH_KEY));
    } catch {
      // storage unavailable — open at the default
    }
    if (saved > 0) panel.current?.resize(saved);
  }, [panel]);

  const onLayoutChanged = useCallback(
    (_layout: Layout, meta: LayoutChangedMeta) => {
      if (!meta.isUserInteraction) return;
      requestAnimationFrame(() => {
        const px = panel.current?.getSize().inPixels;
        if (px) save(WIDTH_KEY, px);
      });
    },
    [panel],
  );
  const onDoubleClick = useCallback(() => save(WIDTH_KEY, CHAT_W), []);
  return { panel, onLayoutChanged, onDoubleClick };
}

function save(key: string, px: number) {
  try {
    window.localStorage.setItem(key, String(Math.round(px)));
  } catch {
    // storage unavailable — the width lasts as long as the window does
  }
}

/** When this conversation was last read, per project. A conversation this window has never
 *  seen counts as read the first time it is looked at: a chat held in a terminal last week
 *  is not news. */
function useSeen(projectRoot: string, cardId: number | null) {
  const key = `${SEEN_PREFIX}${projectRoot}:${cardId === null ? "board" : cardId}`;
  const [at, setAt] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    started.current = false;
    let saved = 0;
    try {
      saved = Number(window.localStorage.getItem(key));
    } catch {
      // storage unavailable — nothing is marked, so nothing reads as new
    }
    setAt(Number.isFinite(saved) ? saved : 0);
    started.current = Number.isFinite(saved) && saved > 0;
  }, [key]);

  const mark = useCallback(
    (when: number) => {
      started.current = true;
      setAt(when);
      try {
        window.localStorage.setItem(key, String(when));
      } catch {}
    },
    [key],
  );

  const adopt = useCallback(
    (when: number) => {
      if (!started.current && when > 0) mark(when);
    },
    [mark],
  );

  return useMemo(() => ({ at, mark, adopt }), [at, mark, adopt]);
}

