import { useSyncExternalStore } from "react";

// Asking the header's Create task for its sheet, from somewhere else on the screen (#437).
//
// The empty board offers the first card in the middle of the page, where the reader is,
// rather than pointing at the button in the top row. The button and the sheet belong to the
// header (components/CreateTask.tsx) and the board screen may not import it — the screens
// draw for a caller that has no coding agent at all (lib/screen.ts) — so the two meet on
// this store, which imports nothing.
//
// The same shape as the runs panel's and the Configuration dialog's, for the same reason.

let request: { at: number } | null = null;
const subs = new Set<() => void>();

export const createSheet = {
  /** Open the header's create sheet. A fresh object every time, so asking twice still
   *  reaches a sheet the user closed in between. */
  open() {
    request = { at: request ? request.at + 1 : 1 };
    for (const fn of subs) fn();
  },
};

/** The last ask, for whoever draws the sheet. */
export function useCreateSheetRequest(): { at: number } | null {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => request,
    () => request,
  );
}
