import { useCallback, useEffect, useState } from "react";
import type { Card, Column } from "./types";

/** Which release the board is showing (#104). A version id, or `null` for All
 *  releases — the whole board, and where a board that plans no versions always
 *  sits. "No release" is not a pick: it isn't a version, so the unplanned cards
 *  are seen under All releases. */
export type ReleasePick = string | null;

/** The blockers track, which the pick never hides. A blocker is usually in the
 *  way of the very version being planned, and the point of the track is that a
 *  blocker is never out of sight. */
const BLOCKERS = "blockers";

const PREFIX = "kanban-ui.release:";

// The picked release lives in the browser, keyed by project root: it changes
// what one tab is looking at, not what the board says. Nothing is written to the files, so a pick never reaches
// the agent — background refining still works the whole board and the daily
// progress chart still counts every card.
//
// Seeded after mount, like the dialog drafts (see lib/draft.ts): localStorage is client-only,
// so reading it during the first render would desync SSR and hydration. All
// releases shows for that first frame.
//
// The pick and the release list drift apart on their own — the pick is in the
// browser, the list is a file in git that a close or a hand edit rewrites — so a
// pick the list no longer holds falls back to All releases rather than hiding the
// board behind a version that is gone. The same rule covers a board with no
// releases at all: nothing is pickable, so nothing is hidden.
export function useReleasePick(
  projectRoot: string,
  releases: string[],
): [ReleasePick, (r: ReleasePick) => void] {
  const storageKey = PREFIX + projectRoot;
  const [pick, setPick] = useState<ReleasePick>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setPick(saved);
    } catch {
      // storage unavailable (private mode / disabled) — just don't persist
    }
  }, [storageKey]);

  const choose = useCallback(
    (r: ReleasePick) => {
      setPick(r);
      try {
        if (r === null) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, r);
      } catch {}
    },
    [storageKey],
  );

  // A pick that no longer exists is dropped in the same render it stops being
  // real, so the board never draws one frame filtered by a version that is gone.
  // The effect only cleans the stored value up afterwards.
  const known = pick !== null && releases.includes(pick);
  useEffect(() => {
    if (pick !== null && !known) choose(null);
  }, [pick, known, choose]);

  return [known ? pick : null, choose];
}

/** Is this card on screen while `pick` is the release being shown? All releases
 *  (`null`) shows everything. A blocker always shows. A group root shows when the
 *  root or any of its subtasks names the release — neither view draws a subtask,
 *  so hiding the root would hide every subtask planned for that version. */
export function inPick(card: Card, pick: ReleasePick): boolean {
  if (pick === null) return true;
  if (card.track === BLOCKERS) return true;
  if (card.release === pick) return true;
  return (card.subtasks ?? []).some((s) => s.release === pick);
}

/** The board's columns with everything outside the picked release taken out.
 *  Every column stays — an emptied one says "no open cards" the way it always
 *  has, rather than the board losing a track while a release is picked. */
export function filterColumns(columns: Column[], pick: ReleasePick): Column[] {
  if (pick === null) return columns;
  return columns.map((col) => ({ ...col, cards: col.cards.filter((c) => inPick(c, pick)) }));
}

/** True when the picked release has nothing of its own on screen. Blockers don't
 *  count: they show whatever is picked, and a blocker belongs to whoever it
 *  blocks — so a screen holding only blockers is still an empty release, and
 *  saying so is what keeps it from reading as a broken board. */
export function pickIsEmpty(columns: Column[], pick: ReleasePick): boolean {
  if (pick === null) return false;
  return !columns.some((col) => col.track !== BLOCKERS && col.cards.length > 0);
}
