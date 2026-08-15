import { useCallback, useEffect, useState } from "react";

const KEY = "kanban-ui.memory-open";

/** Where one memory file lives in the panel, and in an address: the file's own name for the
 *  project's copy, `<module>/<name>` for a module's (#130). It is what a row links to and
 *  what says which row is lit, so the two can never disagree. */
export function memoryKey(module: string, name: string): string {
  return module ? `${module}/${name}` : name;
}

/** The module a key belongs to, or "" for one of the project's four. */
export function memoryModuleOf(key: string | null): string {
  const at = key?.indexOf("/") ?? -1;
  return at > 0 ? key!.slice(0, at) : "";
}

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
  /** The memory file this page is showing, as a key, or null. */
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

/** Which module rows are expanded (#130). Any number can be open at once, and nothing is
 *  remembered across reloads: a remembered module goes stale the day it leaves the map, and
 *  the rail's own chrome — its width, the panel being open — is the only view state the
 *  board keeps.
 *
 *  The one exception is the module holding the file you landed on. A memory file is a page
 *  of its own, so a reload can land inside a module, and its row has to be on screen for the
 *  highlight to mean anything. That holds on a client navigation too, hence the effect
 *  beside the seeded initial state. */
export function useOpenModules(active: string): {
  isOpen: (module: string) => boolean;
  toggle: (module: string) => void;
} {
  const [open, setOpen] = useState<string[]>(() => (active ? [active] : []));

  useEffect(() => {
    if (active) setOpen((was) => (was.includes(active) ? was : [...was, active]));
  }, [active]);

  const toggle = useCallback((module: string) => {
    setOpen((was) => (was.includes(module) ? was.filter((m) => m !== module) : [...was, module]));
  }, []);

  return { isOpen: (module) => open.includes(module), toggle };
}
