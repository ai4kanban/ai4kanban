// The site's surfaces come in two styles, and there is deliberately nothing
// between them:
//
//   1. Raised — a 4px hard ink shadow and no outline at all. `panel`,
//               `panelStatic`, `panelInset`.
//   2. Bare   — a step on the ramp and nothing else. `panelBare`,
//               `panelBareInset`, or just a fill on whatever radius you need.
//
// Plus one modifier, `framed`, which puts the 2px ink outline back on a raised
// block. That is now the exception rather than the default: the outline is the
// loudest thing the theme owns, and a screen where every panel carries one is a
// grid of boxes. A button takes it always — it is the one thing on the page you
// are meant to hit — and a panel takes it only when it has to outrank the panel
// beside it.
//
// No middle. A 1px grey border is the compromise that makes a page look busy
// and undesigned at the same time: too faint to be the frame, too present to be
// nothing, and once it exists every block gets one. If a block needs an edge,
// it takes `framed`; if it doesn't, it takes the shadow or the ramp — the page,
// the paper laid on it, the wash inset back into that.
//
// Raised is for a block that is an *object* on the page: a card, the one
// surface a section is built around. Everything else is bare — every part of a
// composite (a node in a diagram, a tile in a grid, a row in a list), every
// block read by its own fill, and all artwork.

// The lift alone. Kept separate from the fill because the fill is the one thing
// a caller overrides, and appending `bg-code` to a string that already says
// `bg-elev` does nothing — two utilities of the same property, decided by their
// order in the generated stylesheet and not by the order you wrote them.
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

// The outline, composed onto a raised panel when that panel is the primary one
// on the screen: `${panelStatic} ${framed}`. It composes because none of the
// strings above set a border. Use it on one block at a time — the moment two
// panels in a section are framed, neither is the one being pointed at.
export const framed = "border-2 border-border";

// Style 2 — the same two fills with no shadow at all, for a block that belongs
// to the page rather than sitting on top of it. What separates it is the step
// it takes on the ramp, so put it on the neighbouring step and not on its own:
// bare paper on the page, or bare paper on the wash. Bare paper on paper is not
// a block, it's a paragraph.
//
// These are only the `rounded-xl` case. Anything on another radius needs no
// export at all — `rounded-lg bg-elev` is the whole style.
export const panelBare = "rounded-xl bg-elev";
export const panelBareInset = "rounded-xl bg-code";

// Not a surface — the one piece of spacing the whole site shares: the air
// between the header and the first thing on a page. Every hero takes it, so the
// landing page, the five comparisons and the two recipe pages all open at the
// same height rather than each guessing its own. It is deliberately more than a
// section gap: the top of a page is the one place where the empty band is doing
// work, and 3.5rem read as the header having been mis-cropped.
//
// It is half what it was because the header now merges into it. At the top of
// the page the header draws no fill and no rule (`Header.tsx`), so its row is
// no longer a strip of chrome the band has to clear — it *is* the top of the
// band, and the old value stacked one opening gap on another. What the reader
// sees is the same air as before; it is just that ~52px of it is now the row
// the logo sits in. That matters most on the landing page, whose hero stacks
// the headline over a full-column screenshot: every pixel spent above the
// headline is a pixel of the deck pushed under the fold.
export const heroTop = "mt-10 lg:mt-16";
