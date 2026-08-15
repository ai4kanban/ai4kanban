import { useCallback, useEffect, useState } from "react";
import { NO_RELEASE, type Card, type Column } from "./types";

/** Which release the board is showing (#104). A version id, or `null` for No
 *  release — the open cards not promised to a version yet, and where a board
 *  that plans no versions always sits.
 *
 *  There is no whole-board view. A card already planned into a version is
 *  reviewed in that version; the screen worth having by default is the one
 *  holding what nobody has decided about, which is the work the picks are made
 *  out of. On a board that plans nothing this shows every card, as it always
 *  did. */
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
// so reading it during the first render would desync SSR and hydration. No
// release shows for that first frame.
//
// The pick and the release list drift apart on their own — the pick is in the
// browser, the list is a file in git that a close or a hand edit rewrites — so a
// pick the list no longer holds falls back to No release rather than hiding the
// board behind a version that is gone. That is also where a close or a drop
// leaves the board: the cards it let go are exactly the ones No release shows.
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
  // A board with no releases at all lands here too, on the one view it can show.
  // The effect only cleans the stored value up afterwards.
  const known = pick !== null && releases.includes(pick);
  useEffect(() => {
    if (pick !== null && !known) choose(null);
  }, [pick, known, choose]);

  return [known ? pick : null, choose];
}

/** Is this card on screen while `pick` is the release being shown? A blocker
 *  always shows. Otherwise the card's own release has to be the picked one — the
 *  empty string being the pick No release is made of, so the same comparison
 *  answers both. A group root shows when the root or any of its subtasks is in
 *  the pick: neither view draws a subtask, so hiding the root would hide every
 *  subtask under it — including an unplanned subtask of a planned group, which
 *  No release is the only screen that can offer. */
export function inPick(card: Card, pick: ReleasePick): boolean {
  if (card.track === BLOCKERS) return true;
  const want = pick ?? NO_RELEASE;
  if (card.release === want) return true;
  return (card.subtasks ?? []).some((s) => s.release === want);
}

/** The board's columns with everything outside the pick taken out. Every column
 *  stays — an emptied one says "no open cards" the way it always has, rather
 *  than the board losing a track while a release is picked. */
export function filterColumns(columns: Column[], pick: ReleasePick): Column[] {
  return columns.map((col) => ({ ...col, cards: col.cards.filter((c) => inPick(c, pick)) }));
}

/** Does this set of columns hold a card of its own? Blockers don't count: they
 *  show whatever is picked, and a blocker belongs to whoever it blocks — so a
 *  screen holding only blockers is still an empty pick, and saying so is what
 *  keeps it from reading as a broken board. Asked of the filtered columns it
 *  says whether the pick has anything; asked of the board's, whether there is
 *  anything for a pick to have. */
export function hasOwnCards(columns: Column[]): boolean {
  return columns.some((col) => col.track !== BLOCKERS && col.cards.length > 0);
}
