import { useSyncExternalStore } from "react";

import type { DiscussionTarget } from "./types";

// Asking the header's Create task for its sheet, from somewhere else on the screen (#437),
// and saying which discussion to open it on (#496). It reports back the same way: the
// discussion it ends up showing, for the rail's mark (#722), and the ones whose last start
// was refused while the reader was somewhere else (#706).
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
let shown: DiscussionTarget | null = null;
// The discussions whose last start never came up (#706), and why. This window's own and
// nothing more: it says what the last press did, not what the discussion is, so it is not
// worth a field on disk to persist and then have to clear.
let failed: Readonly<Record<string, string>> = {};
const subs = new Set<() => void>();

function tell() {
  for (const fn of subs) fn();
}

/** Drop one discussion's failed-start mark. True when there was one to drop. */
function unmark(discussion: DiscussionTarget | null): boolean {
  if (!discussion || !(discussion in failed)) return false;
  failed = Object.fromEntries(Object.entries(failed).filter(([at]) => at !== discussion));
  return true;
}

export const createSheet = {
  /** Open the header's create sheet. A fresh object every time, so asking twice still
   *  reaches a sheet the user closed in between. Told a discussion, it opens on that one;
   *  told none, the press opens a fresh one. */
  open(discussion: DiscussionTarget | null = null) {
    request = { at: request ? request.at + 1 : 1, discussion };
    tell();
  },

  /** The discussion the sheet is showing this second, or null while no sheet is up (#722).
   *  The sheet covers the page under it, so it — not that page — is what the reader is in,
   *  and the rail marks its row instead. Only the screen holding the sheet knows which one
   *  that is. */
  showing(discussion: DiscussionTarget | null) {
    if (shown === discussion) return;
    shown = discussion;
    tell();
  },

  /** A run this discussion asked for never started (#706), and the reader is not on it to be
   *  told: the rail marks its row instead, and the row's hover says `why`. Cleared by opening
   *  that discussion again, which is where the reader can read it in full and press again. */
  startFailed(discussion: DiscussionTarget, why: string) {
    if (failed[discussion] === why) return;
    failed = { ...failed, [discussion]: why };
    tell();
  },

  /** Take the mark off — the discussion is on screen again, or a new start is going. */
  startCleared(discussion: DiscussionTarget | null) {
    if (unmark(discussion)) tell();
  },

  /** This discussion has left the list (#610). A discussion has no page of its own, so a
   *  row archived from the rail would leave the sheet reading a subject that is over — the
   *  screen holding this one closes and goes back to a fresh Create task. */
  archived(discussion: DiscussionTarget) {
    dropped = { at: dropped ? dropped.at + 1 : 1, discussion };
    // Its row is gone, so a mark on it has nowhere left to be read.
    unmark(discussion);
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

/** The discussions whose last start was refused, for the rail's mark (#706). */
export function useStartFailures(): Readonly<Record<string, string>> {
  return useSyncExternalStore(
    subscribe,
    () => failed,
    () => failed,
  );
}

/** The discussion on screen, for the row the rail marks. A fresh one that has not been
 *  spoken to yet is not in the list, and matches no row — which is the list saying so,
 *  rather than the mark landing on a neighbour. */
export function useShownDiscussion(): DiscussionTarget | null {
  return useSyncExternalStore(
    subscribe,
    () => shown,
    () => shown,
  );
}
