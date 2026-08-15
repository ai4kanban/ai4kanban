// The paintings the landing page mounts its screenshots on. A wash is two
// blooms on a diagonal with the paper left empty between them; `PixelWash.tsx`
// draws all five from the numbers here. The pigments and the diagonal vary per
// mat so a page of five doesn't read as one texture repeated.

type Rgb = readonly [number, number, number];

// The board's signal colours (kanban-ui/app/globals.css) at full strength — a
// wash mixes the mat's paper *toward* a pigment, so an already-pale one comes
// out as nothing. `EMBER` is `--color-accent` itself.
const EMBER: Rgb = [221, 79, 30];
const PEACH: Rgb = [242, 145, 60];
const MINT: Rgb = [67, 180, 131];
const SKY: Rgb = [63, 146, 210];
const LILAC: Rgb = [138, 107, 217];

export type Wash = {
  /** The bloom that sits outside the top corner. */
  top: Rgb;
  /** The bloom that sits outside the opposite bottom corner. */
  bottom: Rgb;
  /** false — top-right and bottom-left. true — top-left and bottom-right. */
  flip: boolean;
  /** Where on the breathing clock this painting is frozen; the animated one
   * starts here and runs on. */
  phase: number;
};

export const WASHES = {
  emberLilac: { top: EMBER, bottom: LILAC, flip: false, phase: 0 },
  mintSky: { top: MINT, bottom: SKY, flip: true, phase: 1.7 },
  peachEmber: { top: PEACH, bottom: EMBER, flip: false, phase: 3.1 },
  skyLilac: { top: SKY, bottom: LILAC, flip: true, phase: 4.6 },
  emberMint: { top: EMBER, bottom: MINT, flip: false, phase: 6.2 },
} as const satisfies Record<string, Wash>;

export type WashName = keyof typeof WASHES;

// The same composition as CSS, for the ground under the canvas — inline in the
// static HTML, and what stands if JS never runs. The radii are percentages of
// the mat's box where the canvas works in mat widths, so the two drift apart on
// a very tall mat; CSS gradients can't express a height as a share of a width.
export function washGround(name: WashName) {
  const w = WASHES[name];
  const top = w.flip ? "2%" : "98%";
  const bottom = w.flip ? "98%" : "2%";
  return [
    `radial-gradient(44% 40% at ${top} -4%, rgba(${w.top},0.64), rgba(${w.top},0) 72%)`,
    `radial-gradient(46% 42% at ${bottom} 104%, rgba(${w.bottom},0.64), rgba(${w.bottom},0) 72%)`,
  ].join(",");
}
