// The site's one block: paper on the page, an ink outline, and a hard offset
// shadow in the same ink. Shared by every card on the site.

// The frame alone. Kept separate because the fill is the one thing a caller
// overrides, and appending `bg-code` to a string that already says `bg-elev`
// does nothing — two utilities of the same property, decided by their order in
// the generated stylesheet and not by the order you wrote them.
const frame =
  "rounded-xl border-2 border-border shadow-[4px_4px_0_0_var(--color-ink)]";

// On hover the card lifts and the shadow grows by exactly the translate, which
// pins the block's bottom-right edge while the face lifts off it. The outline
// does not change: it is ink in every state, on every block, so a card and a
// button carry the same weight. It used to turn `accent` on hover and grow an
// accent-colored shadow, which read as a glow rather than as a block.
export const panel =
  `${frame} bg-elev ` +
  "transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 " +
  "hover:shadow-[6px_6px_0_0_var(--color-ink)]";

// Same block, no hover lift — for panels that aren't meant to feel interactive.
export const panelStatic = `${frame} bg-elev`;

// Filled with the wash instead of the paper — for a panel that reads as sunk
// into the page rather than laid on it: a terminal, a screenshot frame, a
// diagram whose own cards need paper to sit on.
export const panelInset = `${frame} bg-code`;
