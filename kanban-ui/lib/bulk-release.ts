import { patchCard } from "./edit";
import { normalizeRelease } from "./frontmatter";
import { readReleases } from "./releases";
import { NO_RELEASE } from "./types";

// Move several ticked cards into one release, or back out of one (#114).
//
// Planning a version a card at a time is slow, and the fill that runs when a
// release is made only ever adds — so a version planned too full has no fast way
// back. "No release" is on the same list here, which makes taking cards out the
// same action as putting them in.
//
// Each card is written on its own, by the very call the card page's Release box
// makes (patchCard). Nothing here batches the write: one bad card must not cost
// the rest their move, and the card files stay the record either way.

/** The result of one bulk move. `failed` names the cards that did not move and
 *  why, so the bar can say so while the rest go through. `error` is the whole
 *  move refused before anything was written — the release isn't one a card can
 *  be moved onto — and then nothing was touched at all. */
export interface BulkReleaseResult {
  moved: number;
  failed: { id: number; error: string }[];
  error?: string;
}

export function setCardsRelease(ids: number[], release: string): BulkReleaseResult {
  const target = normalizeRelease(release);
  // The list is checked once, before any card is written, rather than card by
  // card inside patchCard: a release that isn't on the list would fail every
  // card for the same reason, and a bar listing the same message twenty times
  // says less than one line saying the release doesn't exist. Empty is always
  // allowed — that is a card coming back out of a release.
  if (target !== NO_RELEASE) {
    const known = readReleases();
    if (!known.includes(target)) {
      return {
        moved: 0,
        failed: [],
        error:
          `unknown release "${target}" — releases on the list: ` +
          `${known.join(", ") || "(none)"}.`,
      };
    }
  }

  const failed: { id: number; error: string }[] = [];
  let moved = 0;
  for (const id of ids) {
    // A group root is one card here like any other, and moves the way it does
    // on its own card page: patchCard writes its `root.md` and then the same
    // release down every subtask, nested groups included. Neither board view
    // draws a subtask, so ticking a root is the only way those cards move at
    // all — and a group is one piece of work, so it ships as one.
    const res = patchCard(id, { release: target });
    if (res.ok) moved += 1;
    else failed.push({ id, error: res.error || "could not be moved" });
  }
  return { moved, failed };
}
