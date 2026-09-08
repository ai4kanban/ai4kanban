import { useSyncExternalStore } from "react";

import type { DiscussionTarget } from "./types";

// Asking the header's Create task for its sheet, from somewhere else on the screen (#437),
// and saying which discussion to open it on (#496).
//
// The empty board offers the first card in the middle of the page, where the reader is,
// rather than pointing at the button in the top row; a rail row picks a discussion back up
// the same way. The button and the sheet belong to the header (components/CreateTask.tsx) and
// neither the board screen nor the rail may import it — the screens draw for a caller that
// has no coding agent at all (lib/screen.ts) — so they meet on this store, which imports
// nothing but a type.
//
// The same shape as the runs panel's and the Configuration dialog's, for the same reason.

let request: { at: number; discussion: DiscussionTarget | null } | null = null;
const subs = new Set<() => void>();

export const createSheet = {
  /** Open the header's create sheet. A fresh object every time, so asking twice still
   *  reaches a sheet the user closed in between. Told a discussion, it opens on that one;
   *  told none, the press opens a fresh one. */
  open(discussion: DiscussionTarget | null = null) {
    request = { at: request ? request.at + 1 : 1, discussion };
    for (const fn of subs) fn();
  },
};

/** The last ask, for whoever draws the sheet. */
export function useCreateSheetRequest(): { at: number; discussion: DiscussionTarget | null } | null {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => request,
    () => request,
  );
}
