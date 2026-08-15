import type { ReactNode } from "react";

// The vocabulary every comparison page's hero diagram pair is drawn in.
//
// A pair is two drawings that make one argument. They share this canvas, these
// margins, and this palette, so a reader compares them the way you compare two
// photographs of the same room — by what moved, not by what lens was used. Any
// figure that appears in both (the person, the board, a robot) is drawn at the
// same size in the same place in both, because a figure that shifts between
// them reads as a difference and spends the reader's attention on nothing.
//
// What must differ is the argument. If the two drawings could swap captions and
// still make sense, the pair is decoration: redraw it until one shows something
// the other cannot.
//
// See `.claude/skills/vs-diagram/SKILL.md` for how to design one.

// Palette — the site's tokens, restated as hexes an SVG attribute can take.
// Warm all the way through, like the page these drawings sit on: a cool grey
// ramp here is what made the comparison pages read as a different product.
export const INK = "#24231f";
export const MUT = "#635a4e";
// Hairline strokes and box outlines. Not a token, and the one stroke here that
// has to be lighter than `muted` and still hold its shape, so it is set to
// clear the 3:1 a non-text element needs against the wash (3.15:1).
export const LINE = "#8f8474";
export const BOX = "#f2ede4"; // a box on the paper canvas
export const KEY = "#b83a12"; // the ember — ours, and only ever ours
// The resting ember, for the one thing here that is the logo rather than a
// reference to it. `KEY` is the readable cut, because it also draws captions.
export const EMBER = "#dd4f1e";
export const PAPER = "#ffffff"; // a card, and a glyph on a filled block

// Motion carries the argument and nothing else: dashes march along what is
// handed over, read, or dispatched; a card steps across a board; a status light
// blinks on something you are made to watch. All of it is off under
// `prefers-reduced-motion`, and every pair says the same thing standing still.
//
// It lives in the SVG rather than in `globals.css`, which is tokens only, and
// rather than in a Tailwind class, which can't declare keyframes. Both drawings
// in a pair emit it; the rules are identical, so the second is a no-op.
//
// `vsd-step` moves a card one board column at a time, so its offsets are the
// 38px column pitch `Board` below lays out at.
const MOTION = `
@keyframes vsd-march { to { stroke-dashoffset: -7 } }
@keyframes vsd-step {
  0%, 16% { transform: translateX(0); opacity: 1 }
  30%, 46% { transform: translateX(38px); opacity: 1 }
  60%, 88% { transform: translateX(76px); opacity: 1 }
  98%, 100% { transform: translateX(76px); opacity: 0 }
}
@keyframes vsd-blip { 0%, 100% { opacity: 0.25 } 50% { opacity: 1 } }
@media (prefers-reduced-motion: no-preference) {
  .vsd-march { animation: vsd-march 1s linear infinite }
  .vsd-step { animation: vsd-step 3.4s ease-in-out infinite }
  .vsd-blip { animation: vsd-blip 1.8s ease-in-out infinite }
}
`;

// The canvas. One diagram fills one chip in the hero, and both drawings in a
// pair use this and nothing else, margins included: art at x < 24 or y > 108
// collides with the captions.
export function VsDiagram({ alt, children }: { alt: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-elev p-2.5">
      <svg
        viewBox="0 0 300 122"
        className="block h-auto w-full"
        role="img"
        aria-label={alt}
      >
        <style>{MOTION}</style>
        {children}
      </svg>
    </div>
  );
}

// The line above the art says what the product is; the line below says what it
// costs you. Ours takes the ember, theirs stays ink, so the eye can tell the two
// sides apart before it has read either.
export function TopCaption({ ours, children }: { ours?: boolean; children: string }) {
  return (
    <text x="24" y="13" fontSize="9" fill={ours ? KEY : INK}>
      {children}
    </text>
  );
}

export function BottomCaption({ children }: { children: string }) {
  return (
    <text x="24" y="115" fontSize="9" fill={MUT}>
      {children}
    </text>
  );
}

// A person. Neutral on purpose: they belong to neither side, so nothing about
// them changes between the two drawings except where the work leaves them.
export function Person({ cx = 40, cy = 52, s = 1 }: { cx?: number; cy?: number; s?: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      <circle r="11.5" fill={BOX} stroke={MUT} strokeWidth={1.4 / s} />
      <circle cy="-3.6" r="3.4" fill={MUT} />
      <path d="M-6.8 8.4 a7 7 0 0 1 13.6 0 z" fill={MUT} />
    </g>
  );
}

// An agent: a head, an antenna, two eyes, and nothing else. This is the glyph
// for an agent everywhere on the site — if a drawing needs to show one, it
// draws this, and if a drawing shows none, that is a claim being made.
//
// Placed by `translate` so `s` can size it to whatever it stands in. Strokes
// divide by `s` to come out the same weight as every other hairline in the
// pair; the antenna stem is a rect rather than a stroke so it thickens with the
// head instead of staying a thread.
//
// `ghost` is an agent that doesn't exist yet: the same silhouette, hollow, no
// eyes. Solid hairline rather than dashed — at this size a dash pattern breaks
// the head into three marks and stops reading as a shape at all.
export function Robot({
  cx,
  cy,
  s,
  ghost,
}: {
  cx: number;
  cy: number;
  s: number;
  ghost?: boolean;
}) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${s})`}>
      {ghost ? (
        <g fill="none" stroke={LINE} strokeWidth={1.3 / s}>
          <circle cx="0" cy="-4.6" r="1.05" />
          <path d="M0 -3.7 V-1.8" />
          <rect x="-4.6" y="-1.8" width="9.2" height="7" rx="2.2" />
        </g>
      ) : (
        <g fill={MUT}>
          <circle cx="0" cy="-4.6" r="1.05" />
          <rect x="-0.6" y="-4.2" width="1.2" height="2.6" />
          <rect x="-4.6" y="-1.8" width="9.2" height="7" rx="2.2" />
          <circle cx="-2.1" cy="1.4" r="1.1" fill={PAPER} />
          <circle cx="2.1" cy="1.4" r="1.1" fill={PAPER} />
        </g>
      )}
    </g>
  );
}

// The block that stands for a product. Every pair has exactly two of these,
// one per drawing, in the same place — they are what tells a reader at a glance
// which product they are looking at, so the middle of a drawing is never a
// generic icon standing in for a brand.
//
// It is square, at one size, on every page. A logo is a square on this site —
// the header's, the favicon's, and every rival's own mark — and a block that
// stretched to fit its drawing would stop reading as one.
export const BLOCK = 36;

// Ours is the mark itself: the ember block and the three descending board
// columns `LogoMark` draws, at the 62% of the block it sets them at.
export function OursBlock({ x, y }: { x: number; y: number }) {
  return (
    <>
      <rect x={x} y={y} width={BLOCK} height={BLOCK} rx="8" fill={EMBER} />
      <g transform={`translate(${x + 6.84} ${y + 6.82}) scale(0.372)`} fill={PAPER}>
        <rect x="5" y="8" width="12" height="44" rx="3.5" />
        <rect x="24" y="8" width="12" height="35" rx="3.5" />
        <rect x="43" y="8" width="12" height="26" rx="3.5" />
      </g>
    </>
  );
}

// Theirs is the same square, in paper with a hairline, carrying the rival's own
// mark at its own colours. Paper rather than ink because most of these marks
// are dark and would vanish reversed out — and because the filled ember block
// should stay the one solid object in a pair, on our side only.
export function TheirsBlock({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={BLOCK}
        height={BLOCK}
        rx="8"
        fill={PAPER}
        stroke={MUT}
        strokeWidth="1.4"
      />
      {children}
    </>
  );
}

// A rival mark that ships as a file in `public/`, centred in its block.
export function BrandImage({
  href,
  cx,
  cy,
  size,
}: {
  href: string;
  cx: number;
  cy: number;
  size: number;
}) {
  return (
    <image
      href={href}
      x={cx - size / 2}
      y={cy - size / 2}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
    />
  );
}

// The arrow heads the art draws by hand: one shape, so a marker definition
// would cost more than it saves. `dir` rotates it about its own anchor, and the
// tip lands four units along that direction.
const HEAD_ROTATION = { right: 0, down: 90, left: 180, up: 270 };

export function Head({
  x,
  y = 52,
  dir = "right",
}: {
  x: number;
  y?: number;
  dir?: keyof typeof HEAD_ROTATION;
}) {
  return (
    <path
      transform={`rotate(${HEAD_ROTATION[dir]} ${x} ${y})`}
      d={`M${x} ${y - 3} l4 3 l-4 3`}
      fill="none"
      stroke={LINE}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// A run of dashes that marches: something being handed over, read, or
// dispatched. Takes a path so a hand-off can turn corners.
export function March({ d, w = 1.4 }: { d: string; w?: number }) {
  return (
    <path
      className="vsd-march"
      d={d}
      fill="none"
      stroke={LINE}
      strokeWidth={w}
      strokeDasharray="4 3"
    />
  );
}

// Our board, at the one size and column pitch every pair draws it at, so the
// reader recognises it as the same object from page to page. `step` sends a
// card across the columns; `cards` fills each column with a resting card.
export function Board({ step = true }: { step?: boolean }) {
  return (
    <>
      <rect
        x="156"
        y="29"
        width="120"
        height="46"
        rx="6"
        fill={PAPER}
        stroke={MUT}
        strokeWidth="1.4"
      />
      {[161, 199, 237].map((x) => (
        <g key={x}>
          <rect x={x} y="34" width="34" height="36" rx="4" fill={BOX} />
          <rect x={x + 4} y="38" width="13" height="2.5" rx="1.25" fill={LINE} />
          <rect
            x={x + 4}
            y="45"
            width="26"
            height="7"
            rx="2"
            fill={PAPER}
            stroke={MUT}
            strokeWidth="1"
          />
        </g>
      ))}
      {step && (
        <rect
          className="vsd-step"
          x="165"
          y="56"
          width="26"
          height="7"
          rx="2"
          fill={PAPER}
          stroke={KEY}
          strokeWidth="1.4"
        />
      )}
    </>
  );
}
