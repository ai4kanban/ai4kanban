import { useCallback, useEffect, useState } from "react";

/** Which way the board is laid out: `kanban` groups by track, `queue` splits
 *  ready cards from the rest. Both show every card. */
export type BoardViewMode = "kanban" | "queue";

const PREFIX = "kanban-ui.view:";

// The chosen view lives in the browser, keyed by project root, so one machine
// driving two boards remembers each one separately. Nothing goes to the board
// files: `ui.config.json` is in git and holds settings the agent reads, and how
// you like to look at the board is neither shared nor the agent's business.
//
// Seeded after mount, like the dialog drafts (see lib/draft.ts): localStorage is
// client-only, so reading it during the first render would desync SSR and
// hydration. The kanban view shows for that first frame.
export function useBoardView(projectRoot: string): [BoardViewMode, (v: BoardViewMode) => void] {
  const storageKey = PREFIX + projectRoot;
  const [view, setView] = useState<BoardViewMode>("kanban");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === "kanban" || saved === "queue") setView(saved);
    } catch {
      // storage unavailable (private mode / disabled) — just don't persist
    }
  }, [storageKey]);

  const choose = useCallback(
    (v: BoardViewMode) => {
      setView(v);
      try {
        window.localStorage.setItem(storageKey, v);
      } catch {}
    },
    [storageKey],
  );

  return [view, choose];
}
