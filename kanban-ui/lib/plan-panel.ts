import { useCallback, useEffect, useRef, useState } from "react";
import { usePanelRef, type Layout, type LayoutChangedMeta } from "react-resizable-panels";
import { readDiscussAction } from "@/app/actions";
import type { DiscussRead } from "./types";

// The plan panel down the right of the Discuss screen (#427): the file the conversation is
// writing, how wide the panel has been dragged, and whether there is room to stand it beside
// the conversation at all.
//
// It is the chat rail's own shape, and deliberately its own numbers (lib/chat-rail.ts): a
// pixel width remembered across reloads, and the same line under which a side panel stops
// being a panel and covers what it is beside. One behavior, whichever side.
//
// Nothing here holds the plan. The file is on disk and the path is on the conversation, so
// closing the sheet mid-discussion loses none of it; this only reads.

const WIDTH_KEY = "kanban-ui.plan-width";

/** What the panel opens at, and how far the drag goes. Wider than the chat rail's: a plan is
 *  read as a document, not followed a line at a time. */
export const PLAN_W = 440;
export const PLAN_MIN = 360;
export const PLAN_MAX = 640;

/** Under this many pixels the sheet cannot hold the reading column and the plan side by
 *  side, so the plan covers the conversation instead — the chat rail's 60rem, in the unit
 *  an element can be measured in. It is the SHEET that is measured, not the window: the
 *  sheet is drawn on the body (components/Window.tsx), so the rail and the chat beside it
 *  are room the window counts and the sheet does not have. */
const OVERLAY_UNDER = 960;

/** How often the plan is re-read while the screen is up. The agent rewrites the file mid
 *  reply, so this is quick enough to feel live and slow enough to cost nothing. */
const READ_MS = 1200;

export interface PlanPanel {
  /** The discussion as the server last read it — null until the first read lands. */
  read: DiscussRead | null;
  /** These rules can hold a discussion at all. False puts the create screen on Add task. */
  supported: boolean;
  /** The plan's words: the last text read for this file, so a rewrite never blanks the
   *  panel. Empty before the file is first written. */
  text: string;
  /** The file is moving — the conversation names a plan and there is nothing to read at
   *  that path this second. The words above are the last ones written. */
  writing: boolean;
  /** There is a panel to draw: a plan whose file has been written at least once. */
  shown: boolean;
  /** The sheet is too narrow for the plan to stand beside the conversation. */
  overlay: boolean;
  /** Put on the sheet's own box — what that width is read from. */
  measure(el: HTMLElement | null): void;
  /** On a narrow window: the plan is covering the conversation right now. */
  covering: boolean;
  toggleCover(): void;
  /** Re-read now rather than waiting out the tick — after a send, or after an answer. */
  refresh(): void;
  panel: ReturnType<typeof usePanelRef>;
  onLayoutChanged(layout: Layout, meta: LayoutChangedMeta): void;
  onDoubleClick(): void;
}

export function usePlanPanel(): PlanPanel {
  const [read, setRead] = useState<DiscussRead | null>(null);
  const [supported, setSupported] = useState(false);
  // The last words read for the file on screen, and which file they are. A rewrite empties
  // the file for an instant; keeping both is what lets the panel say so and go on showing
  // the plan, rather than blinking to nothing and back.
  const [held, setHeld] = useState<{ path: string; text: string } | null>(null);
  const [covering, setCovering] = useState(false);
  const { measure, width } = useSheetWidth();
  const overlay = width > 0 && width < OVERLAY_UNDER;
  const { panel, onLayoutChanged, onDoubleClick } = useWidth();
  const kickRef = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    const tick = async () => {
      if (!alive || inFlight) return;
      inFlight = true;
      try {
        const next = await readDiscussAction();
        if (!alive) return;
        setSupported(next.supported);
        setRead(next);
        // Only real words are held. An empty read is a file mid-rewrite, and forgetting it
        // here is exactly the blank the panel must never show.
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
    // screen's: nothing to start and stop, and nothing left polling behind a shut sheet.
  }, []);

  const plan = read?.plan ?? null;
  const words = held && plan && held.path === plan.path ? held.text : "";
  const text = plan?.text.trim() ? plan.text : words;
  const shown = !!plan && !!text;
  const refresh = useCallback(() => kickRef.current(), []);
  const toggleCover = useCallback(() => setCovering((was) => !was), []);

  return {
    read,
    supported,
    text,
    writing: !!plan && !plan.text.trim() && !!words,
    shown,
    overlay,
    measure,
    covering: covering && overlay && shown,
    toggleCover,
    refresh,
    panel,
    onLayoutChanged,
    onDoubleClick,
  };
}

// How wide the sheet itself is. Zero until the first read lands, which reads as wide
// enough: side by side is the shape this screen settles in, and a frame of cover on the way
// there is a flash nobody asked for.
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

// How wide the panel has been dragged, remembered across reloads — the chat rail's rule
// (lib/chat-rail.ts): pixels rather than a share of the window, applied after mount, and
// only a real drag written down.
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
        if (px) save(px);
      });
    },
    [panel],
  );
  const onDoubleClick = useCallback(() => save(PLAN_W), []);
  return { panel, onLayoutChanged, onDoubleClick };
}

function save(px: number) {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(Math.round(px)));
  } catch {
    // storage unavailable — the width lasts as long as the window does
  }
}
