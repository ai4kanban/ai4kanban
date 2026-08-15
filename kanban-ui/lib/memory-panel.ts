import { useCallback, useEffect, useState } from "react";

const KEY = "kanban-ui.memory-open";

// Whether the rail's Memory panel is expanded, remembered across reloads (#129).
//
// Kept in the browser like the rail's width, and not keyed by project: whether you keep
// memory open is a habit about the window, not something one board says.
//
// Landing on a memory file opens it whatever it was left at, so the highlighted row is on
// screen however you got there — a reload, Back, a pasted address. That is tied to ARRIVING
// at a file rather than to being on one, so collapsing the panel while reading a memory page
// still collapses it; the next file you open expands it again.
export function useMemoryPanel(
  /** The memory file this page is showing, or null. */
  active: string | null,
): { open: boolean; toggle: () => void; animate: boolean } {
  // Closed for the first render, always: localStorage is client-only, so a remembered
  // `true` read during the render would desync hydration. It lands a frame later.
  const [open, setOpen] = useState(false);
  // Whether opening and closing should slide. The remembered state lands after the first
  // render, and a panel that was already open should be found open rather than watched
  // opening, so the slide is switched on the frame after that.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    let saved = false;
    try {
      saved = window.localStorage.getItem(KEY) === "1";
    } catch {
      // storage unavailable — the panel opens closed and lasts as long as the window does
    }
    if (saved) setOpen(true);
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  const toggle = useCallback(() => {
    setOpen((was) => {
      const next = !was;
      try {
        window.localStorage.setItem(KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, []);

  return { open, toggle, animate };
}
