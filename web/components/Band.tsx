import type { ReactNode } from "react";
import { column } from "./styles";

// The warm ground under one section, full-bleed. A ground and not a surface —
// no outline, no shadow — so panels sit on a band the way they sit on the page.
// design.md §Surfaces says when a section earns one.
//
// Its edges dissolve rather than cut. A band that starts on a line draws a rule
// across the page that means nothing, and a CSS gradient would be the only soft
// edge on a site made of hard shadows. So the tone arrives in pixels instead —
// the same 11px pixel the mats are painted in — cells switching on at fixed
// random thresholds, dust at the white end and solid at the warm one.

// A smaller pixel than the mats' 11px, and enough rows that no single row is a
// step you can pick out: at ten rows the strip read as a chunky border rather
// than as a tone arriving. `COLS` is how wide the tile is before it repeats —
// under about 300px the same handful of blobs is legible across the page.
const CELL = 8;
const COLS = 48;
const STEPS = 14;
const TILE = COLS * CELL;
const HEIGHT = STEPS * CELL;

// The same ordered dither `PixelWash.tsx` paints the mats with: a 4×4 tile of
// thresholds, so two neighbouring levels weave into each other instead of
// meeting on a contour. Truncating *with* the tile's threshold is the whole
// trick — it is what makes a handful of levels read as a tone.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v + 0.5) / 16,
);

// How far the warm reaches up the strip, as a share of it, at column `c`. A
// flat ramp dithers into an even gauze with a level edge, which is a gradient
// drawn in pixels rather than a dissolve — the warm has to run further in some
// places than others. Harmonics rather than noise so the field is periodic and
// the tile still repeats seamlessly; the phases are arbitrary, they only have
// to be unrelated.
const SWELL = 0.45;
function reach(c: number) {
  const x = (2 * Math.PI * c) / COLS;
  return (
    0.46 * Math.sin(x + 0.7) +
    0.28 * Math.sin(2 * x + 2.3) +
    0.16 * Math.sin(3 * x + 5.1) +
    0.1 * Math.sin(5 * x + 1.2)
  );
}

// One tile of the ramp, as runs of filled cells. Drawn one unit per cell and
// scaled by `mask-size` — at cell coordinates the path is twice the bytes, and
// this string ships inline in the HTML.
function dissolvePath() {
  const runs: string[] = [];
  for (let r = 0; r < STEPS; r++) {
    const level = (r + 1) / (STEPS + 1);
    // The swell is strongest mid-strip and closes to nothing at both ends, so
    // the dust thins out evenly and the last row still meets the solid band.
    const swell = SWELL * 4 * level * (1 - level);
    let run = 0;
    for (let c = 0; c <= COLS; c++) {
      const on = c < COLS && level + swell * reach(c) > BAYER[(r % 4) * 4 + (c % 4)];
      if (on) {
        run++;
        continue;
      }
      if (run) {
        runs.push(`M${c - run} ${r}h${run}v1h-${run}z`);
        run = 0;
      }
    }
  }
  return runs.join("");
}

// A mask and not an image, so the warm stays `--color-band` rather than a hex
// repeated in here.
const MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COLS} ${STEPS}"><path d="${dissolvePath()}"/></svg>`,
)}")`;

const MASKED = {
  height: HEIGHT,
  maskImage: MASK,
  maskSize: `${TILE}px ${HEIGHT}px`,
  maskRepeat: "repeat-x",
} as const;

/** `flip` turns the ramp over for the bottom edge — dense first, dust last. */
function Dissolve({ flip }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className={`bg-band ${flip ? "rotate-180" : ""}`}
      style={MASKED}
    />
  );
}

// The band owns all of its air, so the section inside it carries no top margin
// of its own. `-mb-16` eats most of the next section's `mt-28`, leaving the same
// strip of clean white below the band as `mt-12` leaves above it.
//
// `flush` is the last band on a page: the warm runs straight into the ink
// footer, which is already the hardest edge on the site and does not need a
// dissolve announcing it. `-mb-28` takes the footer's own margin with it.
export function Band({
  children,
  flush,
}: {
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <div className={`mt-12 ${flush ? "-mb-28" : "-mb-16"}`}>
      <Dissolve />
      <div className="bg-band py-20">
        <div className={column}>{children}</div>
      </div>
      {!flush && <Dissolve flip />}
    </div>
  );
}
