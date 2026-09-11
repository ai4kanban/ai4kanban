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
let dropped: { at: number; discussion: DiscussionTarget } | null = null;
const subs = new Set<() => void>();

function tell() {
  for (const fn of subs) fn();
}

export const createSheet = {
  /** Open the header's create sheet. A fresh object every time, so asking twice still
   *  reaches a sheet the user closed in between. Told a discussion, it opens on that one;
   *  told none, the press opens a fresh one. */
  open(discussion: DiscussionTarget | null = null) {
    request = { at: request ? request.at + 1 : 1, discussion };
    tell();
  },

  /** This discussion has left the list (#610). A discussion has no page of its own, so a
   *  row archived from the rail would leave the sheet reading a subject that is over — the
   *  screen holding this one closes and goes back to a fresh Create task. */
  archived(discussion: DiscussionTarget) {
    dropped = { at: dropped ? dropped.at + 1 : 1, discussion };
    tell();
  },
};

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};

/** The last ask, for whoever draws the sheet. */
export function useCreateSheetRequest(): { at: number; discussion: DiscussionTarget | null } | null {
  return useSyncExternalStore(
    subscribe,
    () => request,
    () => request,
  );
}

/** The last discussion taken out of the list, for whoever is holding one. */
export function useArchivedDiscussion(): { at: number; discussion: DiscussionTarget } | null {
  return useSyncExternalStore(
    subscribe,
    () => dropped,
    () => dropped,
  );
}
