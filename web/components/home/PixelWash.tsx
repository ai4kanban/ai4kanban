"use client";

import { useEffect, useRef } from "react";
import { WASHES, type Wash, type WashName } from "./washes";

// Every watercolour on the landing page, painted instead of downloaded.
//
// A painting is two blooms on a diagonal with the paper left empty through the
// middle where the print sits — `washes.ts` picks the corners and pigments. The
// field is sampled on a coarse grid (one canvas pixel per 11 CSS px, upscaled
// with `image-rendering: pixelated`) and resolved to six tones per pigment.
//
// Two things make six tones read as a wash rather than as six flat rings with a
// staircase between them: an ordered dither (`BAYER`) weaving adjacent tones,
// and value noise (`mottle`) pushing the contours off concentric ellipses.
//
// Only the hero's moves (design.md §2), and it repaints ~9 times a second into
// one `ImageData`, stopping dead off-screen or in a hidden tab. See `Wash.tsx`
// for how all of it is kept off the critical path.

// `--color-band` #f8f5ef — the same paper `Mat.tsx` puts under this canvas. Any
// drift between the two shows up as a seam while the canvas fades in.
const PAPER = [248, 245, 239];

// Six steps of wash plus bare paper, per pigment. This coarse *because* of the
// dither: the weave is the drawing, not the palette.
const LEVELS = 6;
// How far the darkest step mixes toward its pigment — the one knob for how
// vibrant a wash is. Past ~0.7 it stops being pigment on paper and starts being
// a coloured panel.
const PEAK = 0.68;

// The blooms are quantised separately and composited, so the table is square:
// paper mixed toward the top pigment by one level, then the bottom by the other.
const STRIDE = LEVELS + 1;
const palettes = new Map<WashName, Uint8Array>();
function paletteFor(name: WashName) {
  const cached = palettes.get(name);
  if (cached) return cached;
  const { top, bottom } = WASHES[name];
  const table = new Uint8Array(STRIDE * STRIDE * 3);
  for (let la = 0; la <= LEVELS; la++) {
    const ta = (la / LEVELS) * PEAK;
    for (let lb = 0; lb <= LEVELS; lb++) {
      const tb = (lb / LEVELS) * PEAK;
      for (let k = 0; k < 3; k++) {
        const a = PAPER[k] + (top[k] - PAPER[k]) * ta;
        table[(la * STRIDE + lb) * 3 + k] = Math.round(a + (bottom[k] - a) * tb);
      }
    }
  }
  palettes.set(name, table);
  return table;
}

// CSS px per painted pixel. Small enough that a bloom's edge is a curve rather
// than a staircase, large enough that the dither reads as pixels, not grain.
const PIXEL = 11;

// ~9 repaints a second. The steps are the animation, and a slow clock is what
// makes them read as steps.
const FRAME_MS = 110;
// Radians per ms — one full breath is about forty seconds.
const SPEED = 0.00016;

// The ordered dither. Added to the value before truncating, so the choice
// between two adjacent tones depends on where the cell sits in a 4×4 tile: the
// ring boundaries stop existing and six tones carry the depth of about a
// hundred. Ordered rather than random — random thresholds read as dust on the
// pale end. 4×4 over 8×8 because the tile repeats every `PIXEL × 4` = 44px,
// still texture; 88px starts reading as a pattern.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v + 0.5) / 16,
);

// Seeded, so a painting is the same on every visit.
const SEEDS = new Uint8Array(256);
for (let i = 0, s = 1337; i < 256; i++) {
  s = (s * 1664525 + 1013904223) >>> 0;
  SEEDS[i] = s >>> 24;
}
const seed = (x: number, y: number) => SEEDS[(SEEDS[x & 255] + y) & 255] / 255;

// Value noise: the seed field sampled on a lattice, smoothed between the four
// corners. Table lookups rather than a hash per sample — this runs on every
// cell that has any wash in it.
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

// Two octaves — a broad one for where the pigment pools, a finer one for the
// mottle inside a pool. Multiplied into the field, so the contour itself moves
// in and out; the dither alone leaves perfect ellipses behind.
const NOISE = 2;
const NOISE_LO = 0.55;
const NOISE_HI = 1.45;
function mottle(x: number, y: number) {
  const n =
    0.65 * vnoise(x * NOISE, y * NOISE) +
    0.35 * vnoise(x * NOISE * 2.7 + 11.3, y * NOISE * 2.7 + 7.1);
  return NOISE_LO + (NOISE_HI - NOISE_LO) * n;
}

// The second bloom reads the noise field elsewhere, so the two stains in one
// painting aren't the same stain twice.
const MOTTLE_OFFSET = 37.4;

// An ellipse of falloff, zero outside it. The box test before the distance is
// what makes this cheap — most cells are outside both blooms and cost four
// comparisons instead of a `hypot` and a `pow`.
function bloom(dx: number, dy: number, rx: number, ry: number) {
  if (dx < -rx || dx > rx || dy < -ry || dy > ry) return 0;
  const d = Math.hypot(dx / rx, dy / ry);
  return d >= 1 ? 0 : Math.pow(1 - d, 1.7);
}

export default function PixelWash({
  name,
  animated = false,
}: {
  name: WashName;
  animated?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    // The canvas paints the paper too, so it's opaque — the cheaper composite.
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !host || !ctx) return;

    const wash: Wash = WASHES[name];
    const table = paletteFor(name);

    let cols = 0;
    let rows = 0;
    // The mat's own space: one unit is the mat's width, `matH` its bottom edge.
    // Composing in these keeps a bloom round on a tall mat instead of
    // stretching it into a lens.
    let unit = 0;
    let matH = 0;
    // The frame, written cell by cell and pushed in one `putImageData` — every
    // cell can differ from its neighbour, so there is nothing to coalesce.
    let buffer: ImageData | null = null;
    // What the canvas is currently showing, so a resize repaints that picture
    // rather than jumping back to the opening frame.
    let lastPhase = wash.phase;

    // Sized in painted pixels — one backing pixel per cell — and stretched by
    // CSS. Upscaling is the look, so device pixel ratio never enters into it.
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
      if (!cols || !rows || !buffer) return;
      lastPhase = phase;
      const px = buffer.data;

      // Where each bloom is this frame, hoisted out of the cell loop. Each
      // centre sits just outside its corner and drifts on a clock of its own,
      // so the pair never reads as one object being scaled.
      const right = 0.98 + 0.025 * Math.sin(phase * 0.45);
      const left = 0.02 + 0.025 * Math.cos(phase * 0.5);
      const topX = wash.flip ? left : right;
      const botX = wash.flip ? right : left;
      const topY = -0.04 + 0.02 * Math.cos(phase * 0.6);
      const botY = matH + 0.04 + 0.02 * Math.sin(phase * 0.4);

      let i = 0;
      for (let cy = 0; cy < rows; cy++) {
        const y = (cy + 0.5) * unit;
        const dithRow = (cy & 3) * 4;

        for (let cx = 0; cx < cols; cx++) {
          const x = (cx + 0.5) * unit;
          // One wobble drives both blooms, inverted on the second so they
          // breathe out of step. Small, because a swing big enough to see is a
          // swing big enough to close the empty diagonal.
          const wob =
            0.055 * Math.sin(x * 4.6 + phase * 0.7) +
            0.045 * Math.cos(y * 3.4 - phase * 0.5);
          const dith = BAYER[dithRow + (cx & 3)];

          // How far each wash reaches in from its corner, in mat widths.
          // `mottle` multiplies by up to `NOISE_HI`, so the loosest edge lands
          // about half again as far out as these radii say.
          let la = 0;
          let lb = 0;
          let v = bloom(
            x - topX,
            y - topY,
            0.38 * (1 + wob),
            0.4 * (1 - wob * 0.5),
          );
          if (v > 0) {
            // Only where there is wash to pool — this keeps eight table
            // lookups off most of the mat.
            v *= mottle(x, y);
            // Truncate *with* the tile's threshold rather than rounding; this
            // is the line that turns rings into a weave.
            la = Math.min(LEVELS, Math.max(0, Math.floor(v * LEVELS + dith)));
          }
          v = bloom(x - botX, y - botY, 0.4 * (1 - wob), 0.41 * (1 + wob * 0.5));
          if (v > 0) {
            v *= mottle(x + MOTTLE_OFFSET, y + MOTTLE_OFFSET);
            lb = Math.min(LEVELS, Math.max(0, Math.floor(v * LEVELS + dith)));
          }

          const o = (la * STRIDE + lb) * 3;
          px[i++] = table[o];
          px[i++] = table[o + 1];
          px[i++] = table[o + 2];
          px[i++] = 255;
        }
      }
      ctx!.putImageData(buffer, 0, 0);
      // Fade up over the CSS ground the mat was showing, so the swap is a wash
      // settling rather than a flash.
      canvas!.style.opacity = "1";
    }

    if (measure()) paint(wash.phase);

    // Repaint on every resize, running clock or not: setting `canvas.width`
    // clears the context, and on an opaque one "cleared" is black.
    const ro = new ResizeObserver(() => {
      if (measure()) paint(lastPhase);
    });
    ro.observe(host);

    // A still painting is finished here. Everything below is the hero's clock.
    if (!animated) return () => ro.disconnect();

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
      paint(wash.phase + (ts - t0) * SPEED);
    };

    // The one place that decides whether the clock runs — off-screen, hidden
    // tab and reduced-motion all stop it the same way.
    function sync() {
      const run = onScreen && !document.hidden && !still.matches;
      if (run && !raf) raf = requestAnimationFrame(frame);
      if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        // Reduced motion still owes a picture — the resting frame.
        if (still.matches) paint(wash.phase);
      }
    }

    sync();

    const io = new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting;
        sync();
      },
      { rootMargin: "120px" },
    );
    io.observe(host);

    document.addEventListener("visibilitychange", sync);
    still.addEventListener("change", sync);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      still.removeEventListener("change", sync);
    };
  }, [name, animated]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
