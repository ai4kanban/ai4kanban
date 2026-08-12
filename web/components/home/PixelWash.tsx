"use client";

import { useEffect, useRef } from "react";

// The hero's watercolour, painted instead of downloaded.
//
// It replaces `bg-hero-v1.webp` and does not reproduce it: that banner put a
// bloom in each top corner, and this is a diagonal — one wash in the top right,
// one in the bottom left, white through the middle where the print sits. The
// mat is no longer laid out around a banner's proportions, so the geometry here
// is in the mat's own space (see `UNIT` below) rather than in a 2.33 band, and
// `Mat.tsx`'s `fit="width"` no longer applies to this one.
//
// The pair breathes: each bloom swells on a slow clock and its centre drifts a
// little around its corner. Two objects and no third — an extra lobe crossing
// the middle reads as a stray blob rather than as weather, and the middle
// staying empty is the composition.
//
// Painted as pixels rather than as a smooth gradient. The field is sampled on a
// coarse grid — one canvas pixel per 7 CSS px, upscaled by the browser with
// `image-rendering: pixelated` — and resolved to six tones. That is the site's
// own pixel vocabulary (the footer wordmark is a pixel font).
//
// Two things do the work of making six tones a wash rather than six layers, and
// both matter — the first version had neither and read as a stack of flat rings
// with a staircase between them:
//
// - **An ordered dither** (`BAYER`) picks between adjacent tones by position, so
//   a value between two steps comes out as one woven into the other instead of
//   as a flat band with an edge. Depth comes from the weave, not the palette.
// - **Value noise** (`mottle`) multiplies into the field, so the contours are
//   irregular stains rather than concentric ellipses. Dithering alone fixes the
//   fill and leaves perfect arcs behind, which still reads as a machine's idea
//   of a bloom.
//
// It is also cheap, which is the point — see `HeroWash.tsx` for why none of this
// is allowed near the critical path. ~23k cells at the widest, ~1.5ms a frame,
// repainted ~9 times a second into one `ImageData`, and the loop stops dead when
// the hero scrolls off or the tab is hidden. No shader, no animation library: a
// tween engine here would be a bundle download to move four numbers this
// component already computes per frame.
//
// Under `prefers-reduced-motion` it paints one frame and stops. The resting
// picture is the whole picture — the motion is the wash settling, never the
// thing you have to see (design.md §2).

// The ground the wash is painted on: `--color-elev` #ffffff, the site's paper —
// the fill under a panel and under the hero's own second CTA. The mat used to
// take the warm off-white the banner was painted on; on a ground the page draws
// itself there is nothing to match, and the white the buttons sit on is the one
// the section is already made of. `Mat.tsx` names the token for the CSS ground
// under this canvas, and the two have to agree: the canvas covers the mat edge
// to edge, so any drift between them shows up as a seam while it fades in.
const WHITE = [255, 255, 255];
// `--color-accent` #2f7ff5, the site's one azure. Every pixel is that white
// mixed toward this and nothing else.
const AZURE = [47, 127, 245];

// Six steps of wash plus bare white. It stays this coarse *because* of the
// dither below: six flat rings is a posterised gradient, but six tones woven
// into each other is a wash with a hundred, and the weave is the drawing.
const LEVELS = 6;
// How far the darkest step is mixed toward the azure — the one knob for how
// vibrant the wash is, since every step is a share of it. Mixing with white
// costs saturation as fast as it costs depth, so a pale peak reads washed out
// rather than delicate: this is set where the core of a bloom is a colour and
// the outer rings are still a breath. Past ~0.7 it stops being pigment on paper
// and starts being a blue panel, which is the one thing the mat must not be.
const PEAK = 0.58;

// The steps as flat RGB, read straight into the pixel buffer.
const PALETTE = Array.from({ length: LEVELS + 1 }, (_, i) => {
  const t = (i / LEVELS) * PEAK;
  return WHITE.map((p, k) => Math.round(p + (AZURE[k] - p) * t));
});

// CSS px per painted pixel. Small enough that a bloom's edge is a curve rather
// than a staircase, large enough that the dither reads as woven pixels and not
// as film grain.
const PIXEL = 11;

// ~9 repaints a second. Pixel art has no business running at 60: the steps are
// the animation, and a slower clock makes them read as steps.
const FRAME_MS = 110;
// Radians per millisecond. One full breath is about forty seconds — slow enough
// that you never catch it moving, only notice it has moved.
const SPEED = 0.00016;

// The ordered dither, and the whole reason this doesn't read as layers.
//
// Rounding a smooth field to six levels fills each ring with one flat colour and
// puts a clean staircase between rings — you see the quantiser, not a wash.
// Adding this threshold before truncating makes the choice between two adjacent
// tones depend on *where* the cell sits in a 4×4 tile, so a value four-tenths of
// the way between two steps comes out as four cells of the darker tone woven
// into six of the lighter one. The ring boundaries stop existing; what is left
// is a weave that gets denser toward the core. Six tones then carry the depth of
// about a hundred.
//
// Ordered rather than random. Random thresholds give the same average and look
// like dust on the pale end — every cell an independent coin flip — where a
// repeating tile puts the dark cells as far from each other as they go, which is
// what makes a halftone read as a tone instead of as noise. 4×4 over 8×8 because
// the tile repeats every `PIXEL × 4` — 28px here, small enough to read as
// texture; an 8×8 tile is 56px and starts reading as a pattern in the wash.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v + 0.5) / 16,
);

// A fixed field of random values, built once from a seeded generator so the
// painting is the same on every visit rather than a different one per reload.
const SEEDS = new Uint8Array(256);
for (let i = 0, s = 1337; i < 256; i++) {
  s = (s * 1664525 + 1013904223) >>> 0;
  SEEDS[i] = s >>> 24;
}
const seed = (x: number, y: number) => SEEDS[(SEEDS[x & 255] + y) & 255] / 255;

// Value noise: the seed field sampled on a lattice and smoothed between the four
// corners. Table lookups rather than a hash function per sample, because this
// runs on every cell that has any wash in it.
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  // Smoothstep the interpolation, or the lattice shows up as diamonds.
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = seed(xi, yi);
  const b = seed(xi + 1, yi);
  const c = seed(xi, yi + 1);
  const d = seed(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Two octaves of it — a broad one for where the pigment pools and a finer one
// for the mottle inside a pool. This is what the dither alone can't do: dithering
// breaks the flat fill, but the *boundaries* are still concentric ellipses, and
// a real wash doesn't have those. Multiplied into the field, it pushes the whole
// contour in and out, so what reaches the edge is an irregular stain.
const NOISE = 2;
const NOISE_LO = 0.55;
const NOISE_HI = 1.45;
function mottle(x: number, y: number) {
  const n =
    0.65 * vnoise(x * NOISE, y * NOISE) +
    0.35 * vnoise(x * NOISE * 2.7 + 11.3, y * NOISE * 2.7 + 7.1);
  return NOISE_LO + (NOISE_HI - NOISE_LO) * n;
}

// One bloom: an ellipse of falloff, zero outside it. The box test before the
// distance is what makes the whole thing cheap — most of a mat this tall is
// outside both blooms, and those cells cost four comparisons instead of a
// `hypot` and a `pow`.
function bloom(dx: number, dy: number, rx: number, ry: number) {
  if (dx < -rx || dx > rx || dy < -ry || dy > ry) return 0;
  const d = Math.hypot(dx / rx, dy / ry);
  return d >= 1 ? 0 : Math.pow(1 - d, 1.7);
}

export default function PixelWash() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    // `alpha: false` — the canvas paints the paper too, so it is opaque, and an
    // opaque context is the cheaper one to composite.
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !host || !ctx) return;

    let cols = 0;
    let rows = 0;
    // The mat's own space: one unit is the mat's width, so a cell's height in
    // those units is `UNIT` and the mat's bottom edge is at `matH`. Everything
    // the painting is composed from is expressed this way, which is what keeps a
    // bloom round instead of stretching it into a lens on a tall mat — and what
    // lets the bottom-left one be anchored to a bottom edge that moves.
    let unit = 0;
    let matH = 0;
    // The frame, written cell by cell and pushed in one `putImageData`. Once
    // every cell can differ from the one beside it there are no runs left to
    // coalesce, and a `fillRect` per cell would be twenty thousand draw calls
    // for a picture that is exactly a pixel buffer.
    let buffer: ImageData | null = null;
    // The phase the canvas is currently showing, so a repaint that isn't driven
    // by the clock (a resize) redraws the picture that was there rather than
    // jumping the wash back to its opening frame.
    let lastPhase = 0;

    // The canvas is sized in painted pixels — one backing pixel per cell — and
    // stretched to the mat by CSS. That is why device pixel ratio never enters
    // into it: upscaling is the look, so there is nothing to correct for.
    function measure() {
      const w = host!.clientWidth;
      const h = host!.clientHeight;
      if (!w || !h) return false;
      cols = Math.max(16, Math.round(w / PIXEL));
      unit = 1 / cols;
      rows = Math.max(8, Math.round(h / (w * unit)));
      matH = rows * unit;
      canvas!.width = cols;
      canvas!.height = rows;
      buffer = ctx!.createImageData(cols, rows);
      return true;
    }

    function paint(phase: number) {
      // Nothing measured yet, so there is nothing to paint.
      if (!cols || !rows || !buffer) return;
      lastPhase = phase;
      const px = buffer.data;

      // Where each bloom is this frame, hoisted: both are the same for every
      // cell in it. Each centre sits just outside its own corner and drifts a
      // couple of percent around it on a clock of its own, so the two never
      // swing together and the pair never reads as one object being scaled.
      const topX = 0.98 + 0.025 * Math.sin(phase * 0.45);
      const topY = -0.04 + 0.02 * Math.cos(phase * 0.6);
      const botX = 0.02 + 0.025 * Math.cos(phase * 0.5);
      const botY = matH + 0.04 + 0.02 * Math.sin(phase * 0.4);

      let i = 0;
      for (let cy = 0; cy < rows; cy++) {
        // Distance down the mat, in mat widths.
        const y = (cy + 0.5) * unit;
        const dithRow = (cy & 3) * 4;

        for (let cx = 0; cx < cols; cx++) {
          const x = (cx + 0.5) * unit;
          // One wobble drives both blooms, applied to one and inverted on the
          // other, so they breathe out of step. It stays small because the
          // composition is the middle staying empty, and a swing big enough to
          // see is a swing big enough to close the diagonal.
          const wob =
            0.055 * Math.sin(x * 4.6 + phase * 0.7) +
            0.045 * Math.cos(y * 3.4 - phase * 0.5);
          // How far each wash reaches in from its corner, in mat widths — the
          // size of the whole thing. `mottle` below multiplies this by up to
          // `NOISE_HI`, so the loosest edge lands about half again as far out as
          // these numbers say.
          let v =
            bloom(
              x - topX,
              y - topY,
              0.34 * (1 + wob),
              0.36 * (1 - wob * 0.5),
            ) +
            bloom(x - botX, y - botY, 0.36 * (1 - wob), 0.37 * (1 + wob * 0.5));

          let level = 0;
          if (v > 0) {
            // Pigment pools unevenly. Only where there is wash to pool: on the
            // bare white it would do nothing anyway, and skipping it there is
            // what keeps eight table lookups off most of the mat.
            v *= mottle(x, y);
            // Truncate *with* the tile's threshold rather than rounding — see
            // `BAYER`. This is the line that turns rings into a weave.
            level = Math.floor(v * LEVELS + BAYER[dithRow + (cx & 3)]);
            if (level < 0) level = 0;
            else if (level > LEVELS) level = LEVELS;
          }

          const c = PALETTE[level];
          px[i++] = c[0];
          px[i++] = c[1];
          px[i++] = c[2];
          px[i++] = 255;
        }
      }
      ctx!.putImageData(buffer, 0, 0);
      // First frame lands: fade the painting up over whatever CSS ground the
      // mat was showing while this chunk loaded, so the swap is a wash settling
      // rather than a flash.
      canvas!.style.opacity = "1";
    }

    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let t0 = 0;
    let last = 0;
    let onScreen = true;

    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame);
      if (!t0) t0 = ts;
      if (ts - last < FRAME_MS) return;
      last = ts;
      paint((ts - t0) * SPEED);
    };

    // The one place that decides whether the clock runs: off-screen, hidden
    // tab, or a reader who asked for no motion all stop it the same way, and
    // stopping means the hero costs nothing at all while you read the rest of
    // the page.
    function sync() {
      const run = onScreen && !document.hidden && !still.matches;
      if (run && !raf) raf = requestAnimationFrame(frame);
      if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        // A stopped clock still owes a picture: repaint the resting frame so
        // the reduced-motion state is the drawing, not a blank canvas.
        if (still.matches) paint(0);
      }
    }

    if (measure()) paint(0);
    sync();

    const io = new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting;
        sync();
      },
      { rootMargin: "120px" },
    );
    io.observe(host);

    // Repaint on every resize, running clock or not. Setting `canvas.width`
    // clears the context, and on an opaque one "cleared" is black — waiting up
    // to a frame interval for the loop to come round would be a black flash
    // through the mat on every drag of a window edge.
    const ro = new ResizeObserver(() => {
      if (measure()) paint(lastPhase);
    });
    ro.observe(host);

    document.addEventListener("visibilitychange", sync);
    still.addEventListener("change", sync);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      still.removeEventListener("change", sync);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
