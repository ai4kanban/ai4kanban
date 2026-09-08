import { useCallback, useEffect, useRef, useState } from "react";
import { readDiscussAction } from "@/app/actions";
import type { DiscussRead } from "./types";

// The plan card on the Discuss screen (#427): the file the conversation is writing, whether
// it is up, and whether the sheet has room to stand it beside the conversation.
//
// It is a CARD, not a rail. The window's rails are chrome — edge to edge, no surface of their
// own (components/Chat.tsx) — and a plan is not chrome: it is a file this conversation
// produced, so it is drawn the way this app draws content, inset on the paper with a border
// of its own. That is also why it has no drag: the two sizes are a button in the card's own
// corner, and whether it is up at all is the pill in the sheet's top row.
//
// Nothing here holds the plan. The file is on disk and the path is on the conversation, so
// closing the sheet mid-discussion loses none of it; this only reads.

/** The card's margin off the sheet's edge — the conversation's own gutter
 *  (components/CreateSheet.tsx), so a card over the exchange sits on the same edges as the
 *  box below it. */
export const PLAN_INSET = 20;

/** How wide the card stands beside the conversation. The conversation is served first, at
 *  its full reading column, and the plan takes what is left between these two: on a wide
 *  window that is most of the sheet's right half, which is what a document wants. */
const PLAN_MIN = 440;
const PLAN_MAX = 720;
/** The paper between the two, and what the conversation needs — its column and its gutters
 *  (COLUMN and GUTTER in components/CreateSheet.tsx). */
const PLAN_GAP = 32;
const CONVERSATION = 600 + 20 * 2;

function cardWidth(sheet: number): number {
  const spare = sheet - CONVERSATION - PLAN_GAP - PLAN_INSET;
  return Math.round(Math.min(PLAN_MAX, Math.max(PLAN_MIN, spare)));
}

/** How wide the plan reads once the card is enlarged — the width of the ENLARGED CARD itself,
 *  less its padding. A line of a document that runs the width of a window is a line nobody
 *  finishes, and a card wider than the words it holds is a tray, not a page. */
export const PLAN_READ = 840;

/** From this many pixels the sheet can hold both, so the conversation narrows and the card
 *  stands beside it. Under it the card lies over the exchange instead. It is the SHEET that
 *  is measured, not the window: the sheet is drawn on the body (components/Window.tsx), so
 *  the rail and the chat beside it are room the window counts and the sheet does not have. */
const BESIDE_FROM = 1024;

/** How often the plan is re-read while the screen is up. The agent rewrites the file mid
 *  reply, so this is quick enough to feel live and slow enough to cost nothing. */
const READ_MS = 1200;

export interface PlanPanel {
  /** The discussion as the server last read it — null until the first read lands. */
  read: DiscussRead | null;
  /** These rules can hold a discussion at all. False puts the create screen on Add task. */
  supported: boolean;
  /** The plan's words: the last text read for this file, so a rewrite never blanks the
   *  card. Empty before the file is first written. */
  text: string;
  /** The file is moving — the conversation names a plan and there is nothing to read at
   *  that path this second. The words above are the last ones written. */
  writing: boolean;
  /** There is a plan to show: a file that has been written at least once. */
  shown: boolean;
  /** The card is up. It comes up on its own the moment there is a plan — that the plan is
   *  being written is the thing this screen is for. */
  open: boolean;
  toggle(): void;
  /** The card has been enlarged: it leaves the right column and stands in the middle of the
   *  sheet, down to the box, at the width a plan reads at (PLAN_READ). Centred there it covers
   *  the conversation whole. Only ever true where there is a smaller size to go back to: under
   *  `beside` the card is at that width already, and an Enlarge that changes nothing is a
   *  button that lies. */
  full: boolean;
  toggleFull(): void;
  /** There is room to stand the card beside the conversation. Without it the card takes the
   *  sheet: half a column of sliced sentences beside a plan is worse than no column. */
  beside: boolean;
  /** How wide the card stands there, and the room the conversation gives up for it — the
   *  card, the paper between them, and the card's margin off the sheet's edge. */
  width: number;
  space: number;
  /** Put on the sheet's own box — what that width is read from. */
  measure(el: HTMLElement | null): void;
  /** Re-read now rather than waiting out the tick — after a send, or after an answer. */
  refresh(): void;
}

/** `discussion` is which discussion's plan this panel draws (#496) — the one the sheet is
 *  open on. Null is the board's own conversation, which is what a board too old to hold
 *  discussions still has. */
export function usePlanPanel(discussion: string | null = null): PlanPanel {
  const [read, setRead] = useState<DiscussRead | null>(null);
  const [supported, setSupported] = useState(false);
  // The last words read for the file on screen, and which file they are. A rewrite empties
  // the file for an instant; keeping both is what lets the card say so and go on showing
  // the plan, rather than blinking to nothing and back.
  const [held, setHeld] = useState<{ path: string; text: string } | null>(null);
  // Another discussion is another plan, so nothing of the last one is drawn while the first
  // read of this one lands. Done while rendering, the way the chat rail switches.
  const [showing, setShowing] = useState(discussion);
  if (showing !== discussion) {
    setShowing(discussion);
    setRead(null);
    setHeld(null);
  }
  const [hidden, setHidden] = useState(false);
  const [full, setFull] = useState(false);
  const { measure, width } = useSheetWidth();
  const kickRef = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const tick = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const next = await readDiscussAction(discussion);
        if (!alive) return;
        setSupported(next.supported);
        setRead(next);
        // Only real words are held. An empty read is a file mid-rewrite, and forgetting it
        // here is exactly the blank the card must never show.
        if (next.plan?.text.trim()) setHeld({ path: next.plan.path, text: next.plan.text });
        else if (!next.plan) setHeld(null);
      } catch {
        // transient — the next tick tries again
      } finally {
        inFlight = false;
      }
      if (!alive) return;
      clearTimeout(timer);
      timer = setTimeout(tick, READ_MS);
    };
    kickRef.current = () => {
      if (!alive) return;
      clearTimeout(timer);
      void tick();
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // The screen this belongs to is mounted only while it is up, so the loop's life is the
    // screen's: nothing to start and stop, and nothing left polling behind a shut sheet. A
    // sheet moved to another discussion restarts it: the plan it draws is that one's.
  }, [discussion]);

  const beside = width === 0 || width >= BESIDE_FROM;
  const card = cardWidth(width);
  const plan = read?.plan ?? null;
  const words = held && plan && held.path === plan.path ? held.text : "";
  const text = plan?.text.trim() ? plan.text : words;
  const shown = !!plan && !!text;
  const refresh = useCallback(() => kickRef.current(), []);
  const toggle = useCallback(() => setHidden((was) => !was), []);
  const toggleFull = useCallback(() => setFull((was) => !was), []);

  return {
    read,
    supported,
    text,
    writing: !!plan && !plan.text.trim() && !!words,
    shown,
    open: shown && !hidden,
    toggle,
    full: shown && !hidden && beside && full,
    toggleFull,
    beside,
    width: card,
    space: card + PLAN_GAP + PLAN_INSET,
    measure,
    refresh,
  };
}

// How wide the sheet itself is. Zero until the first read lands, which is read as room:
// beside is the shape this screen settles in, and a frame of the card lying over the
// conversation on the way there is a flash nobody asked for.
function useSheetWidth(): { measure: (el: HTMLElement | null) => void; width: number } {
  const [width, setWidth] = useState(0);
  const watching = useRef<ResizeObserver | null>(null);
  const measure = useCallback((el: HTMLElement | null) => {
    watching.current?.disconnect();
    watching.current = null;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    watching.current = observer;
  }, []);
  useEffect(() => () => watching.current?.disconnect(), []);
  return { measure, width };
}
