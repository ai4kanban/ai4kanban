// Two surface styles and nothing between them — no 1px grey border anywhere:
//
//   1. Raised — a 4px hard ink shadow, no outline. For a block that is an
//      *object* on the page: a card, the surface a section is built around.
//   2. Bare — a step on the ramp and nothing else. Everything that belongs to
//      the page: parts of a composite, blocks read by their own fill, artwork.
//
// `framed` puts the 2px ink outline back on a raised block. It's the loudest
// thing the theme owns, so it's the exception: buttons always, panels only when
// one has to outrank its neighbour.

// The lift alone, kept separate from the fill — the fill is what callers
// override, and two utilities of the same property resolve by stylesheet order,
// not by the order you concatenated them.
const raise = "rounded-xl shadow-[4px_4px_0_0_var(--color-ink)]";

// On hover the card lifts and the shadow grows by exactly the translate, which
// pins the block's bottom-right edge while the face lifts off it.
export const panel =
  `${raise} bg-elev ` +
  "transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 " +
  "hover:shadow-[6px_6px_0_0_var(--color-ink)]";

// Same block, no hover lift — for panels that aren't meant to feel interactive.
export const panelStatic = `${raise} bg-elev`;

// Filled with the wash instead of the paper — for a panel that reads as sunk
// into the page rather than laid on it: a terminal, a screenshot frame, a
// diagram whose own cards need paper to sit on.
export const panelInset = `${raise} bg-code`;

// Composed onto a raised panel: `${panelStatic} ${framed}`. One block at a time
// — the moment two panels in a section are framed, neither is the one being
// pointed at.
export const framed = "border-2 border-border";

// Style 2. What separates a bare block is the ramp step it takes, so put it on
// the neighbouring step: bare paper on the page, or bare paper on the wash.
// Bare paper on paper is not a block, it's a paragraph.
//
// Only the `rounded-xl` case — any other radius is just `rounded-lg bg-elev`.
export const panelBare = "rounded-xl bg-elev";
export const panelBareInset = "rounded-xl bg-code";

// The content column. A page that never bands can put this on its `<main>`; one
// that does puts it on each stretch between bands, because a band is full-bleed
// and has to break out of it (`Band.tsx`).
export const column = "mx-auto max-w-6xl px-6";

// Not a surface — the air between the header and the first thing on a page, so
// every hero opens at the same height. It counts the header's own row: at the
// top of a page the header draws no fill and no rule (`Header.tsx`), so it is
// part of the band rather than chrome the band has to clear.
export const heroTop = "mt-10 lg:mt-16";
