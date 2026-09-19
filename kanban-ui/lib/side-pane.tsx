"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePanelRef, type Layout, type LayoutChangedMeta } from "react-resizable-panels";
import { CHAT_W } from "./chat-rail";

// A page's own pane in the window's right rail (#904) — the Triage detail. It shares the
// right side with the chat and the bell, one at a time, and the window draws it the way it
// draws those two: beside the body on a wide window, over it on a narrow one.

const WIDTH_KEY = "kanban-ui.side-width";

export interface SidePane {
  node: ReactNode;
  /** The rail is taking the right side for something else: the page lets go of its item. */
  close(): void;
}

interface SideSlot {
  show(pane: SidePane | null): void;
  /** A phone tab screen is drawn over the page. */
  covered: boolean;
}

const Slot = createContext<SideSlot | null>(null);
export const SideSlotProvider = Slot.Provider;

/** Puts `children` in the right rail while there are any. Drawn inside the window: `onClose`
 *  is called when the window takes the rail back, `onCovered` when a phone tab screen is
 *  drawn over the page. */
export function SidePane({
  children,
  onClose,
  onCovered,
}: {
  children: ReactNode;
  onClose: () => void;
  onCovered: () => void;
}) {
  const slot = useContext(Slot);
  const close = useRef(onClose);
  const cover = useRef(onCovered);
  useEffect(() => {
    close.current = onClose;
    cover.current = onCovered;
  }, [onClose, onCovered]);
  const show = slot?.show;
  useEffect(() => {
    show?.(children ? { node: children, close: () => close.current() } : null);
  }, [show, children]);
  useEffect(() => () => show?.(null), [show]);
  const covered = slot?.covered ?? false;
  useEffect(() => {
    if (covered) cover.current();
  }, [covered]);
  return null;
}

/** The window's side of it: what is in the pane, and how wide the user left it. */
export function useSideRail() {
  const [pane, setPane] = useState<SidePane | null>(null);
  const panel = usePanelRef();
  const open = pane !== null;
  // Read as the pane opens: the panel takes it as its starting size.
  const width = useMemo(() => (open ? saved() : CHAT_W), [open]);
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
  // The divider puts the panel back to where it opened; the default is further back.
  const onDoubleClick = useCallback(() => {
    save(CHAT_W);
    requestAnimationFrame(() => panel.current?.resize(CHAT_W));
  }, [panel]);
  return { pane, show: setPane, panel, width, onLayoutChanged, onDoubleClick };
}

function saved(): number {
  try {
    const px = Number(window.localStorage.getItem(WIDTH_KEY));
    return px > 0 ? px : CHAT_W;
  } catch {
    return CHAT_W;
  }
}

function save(px: number) {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(Math.round(px)));
  } catch {
    // storage unavailable — the width lasts as long as the window does
  }
}
