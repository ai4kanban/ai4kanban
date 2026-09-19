import { useSyncExternalStore } from "react";

import type { PlanAnswer } from "./format/agent/types";
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
let closing = 0;
let dropped: { at: number; discussion: DiscussionTarget } | null = null;
let shown: DiscussionTarget | null = null;
let sheetUp = false;
// The discussions whose last start never came up (#706), and why. This window's own and
// nothing more: it says what the last press did, not what the discussion is, so it is not
// worth a field on disk to persist and then have to clear.
let failed: Readonly<Record<string, string>> = {};
// The plan answer being asked for, per discussion, and the refusal said under the button at
// phone width (#706). Both outlive the header, which every page change mounts afresh (#888).
let starting: Readonly<Record<string, PlanAnswer>> = {};
let buttonError: string | null = null;
const subs = new Set<() => void>();

/** The discussion the header's button was holding, for the one the next page mounts — at
 *  phone width it is the only way back to it (#888). `unspoken` is the fresh one nothing has
 *  been sent into: it has no rail row, so the button is the only way back to its draft (#934). */
export const heldByButton: { discussion: DiscussionTarget | null; unspoken: DiscussionTarget | null } = {
  discussion: null,
  unspoken: null,
};

/** Regions whose presses lead away from the sheet: pressing a control in one closes it, and
 *  the press still does what it does (#888). */
export const LEAVES_SHEET = { "data-leaves-sheet": "" } as const;

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

  /** Close the sheet — the reader is going somewhere else (#888). Only hides it: the
   *  discussion, its draft and a reply on its way are all still there to go back to. */
  close() {
    closing++;
    tell();
  },

  /** A plan answer is out for this discussion (`answer`), or back (`null`). */
  starting(key: string, answer: PlanAnswer | null) {
    starting = Object.fromEntries(Object.entries(starting).filter(([at]) => at !== key));
    if (answer) starting = { ...starting, [key]: answer };
    tell();
  },

  /** What to say under the button, or null to take it down. */
  buttonError(why: string | null) {
    if (buttonError === why) return;
    buttonError = why;
    tell();
  },

  /** Whether the sheet is up — whatever opened it, on a board that may hold no discussion. */
  up(open: boolean) {
    if (sheetUp === open) return;
    sheetUp = open;
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

/** Whether the create sheet is up. */
export function useSheetUp(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => sheetUp,
    () => false,
  );
}

/** How many times the sheet has been asked to close. */
export function useCloseSheetRequest(): number {
  return useSyncExternalStore(
    subscribe,
    () => closing,
    () => 0,
  );
}

/** The plan answers out right now, by discussion. */
export function useStarting(): Readonly<Record<string, PlanAnswer>> {
  return useSyncExternalStore(
    subscribe,
    () => starting,
    () => starting,
  );
}

/** The refusal said under the button. */
export function useButtonError(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => buttonError,
    () => null,
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
