import type { ReactNode } from "react";
import { Mat, printFrame } from "@/components/home/Mat";
import type { WashName } from "@/components/home/washes";

// The vocabulary a blog figure is drawn in — the landing page's diagram
// grammar narrowed to what a 648px prose column can hold. (The page's own wide
// iteration diagram is gone; this kit is where that grammar still lives.)
//
// A wide SVG scaled like a photograph is right on a page that gives it the full
// width. A post's body is half that on a laptop and ~290px on a phone, so a
// single wide drawing would land its 12px labels at 6px. Every figure here is
// therefore a **pair of panels**: two prints on one mat, side by side from `sm`
// up and stacked below it. A panel is ~320px wide at every viewport, so its
// 300-unit viewBox renders at roughly 1:1 whatever the reader is on, and the
// words in it stay words.
//
// The pair is also the argument's shape. Both panels draw the same object in
// the same place at the same size, and only what the post claims changed is
// allowed to differ — the rule `components/vs/diagram.tsx` sets for the
// comparison pages, for the same reason: a reader compares two panels by what
// moved, and anything that moved for other reasons is a lie in the drawing.
//
// Colour comes from the tokens as Tailwind `fill-*`/`stroke-*` classes, never
// as hexes, so a figure follows the palette the way the rest of the page does.
// Ember is the one thing that means something here and it means one thing: the
// planning work. It is a shape in these drawings and never carries a word;
// where a word sits on ember it sits on `accent-deep`.

/** Every panel's viewBox width. Heights vary; a pair shares one. */
export const PANEL_W = 300;

// Motion, and the only motion in the set. It marches the dashes on a connector —
// something being read, fetched, or reached for — and nothing else moves,
// because nothing else in these figures flows. A bar chart is a measurement.
//
// Emitted by every SVG that needs it; the rules are identical, so the second
// and later copies are no-ops. Off under `prefers-reduced-motion`, where the
// resting state is a plain dashed line, which is all the drawing ever needed.
export const MARCH = `
@keyframes bfg-march { to { stroke-dashoffset: -14 } }
@media (prefers-reduced-motion: no-preference) {
  .bfg-march { animation: bfg-march 1.6s linear infinite }
}
`;

// The figure: a watercolour mat with the panels laid on it as prints, the way
// the landing page mounts every picture it has. The caption is the post's, not
// the drawing's — `blog-prose.css` sets `figcaption`.
export function Figure({
  wash,
  caption,
  single,
  children,
}: {
  wash: WashName;
  caption: ReactNode;
  /** One print filling the mat, for a drawing whose two halves must align. */
  single?: boolean;
  children: ReactNode;
}) {
  return (
    <figure>
      <Mat wash={wash} className="p-3 sm:p-4">
        {single ? (
          children
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">{children}</div>
        )}
      </Mat>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

// One print. The title is HTML rather than SVG `<text>` on purpose: it is the
// one line in a panel a reader must be able to read at any width, and HTML is
// the only thing here that reflows instead of scaling.
export function Panel({
  title,
  alt,
  height,
  children,
}: {
  title: string;
  alt: string;
  height: number;
  children: ReactNode;
}) {
  return (
    <div className={`${printFrame} bg-elev px-3 py-3 sm:px-4`}>
      <p className="mb-2.5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
        {title}
      </p>
      <svg
        viewBox={`0 0 ${PANEL_W} ${height}`}
        className="block h-auto w-full"
        role="img"
        aria-label={alt}
      >
        <style>{MARCH}</style>
        {children}
      </svg>
    </div>
  );
}

// A card off the board, drawn to `kanban-ui`'s own grammar: paper, a full ink
// outline, a hard shadow, an ember id, and a title that is the lines it takes
// rather than the words on them. Two figures below use it, and both need it to
// be recognisably the same object in both of their panels — so it lives here
// and not in either of them.

/** A card's own margin, and the air under its last row. */
const CARD_PAD = 12;
const TITLE = { top: 29, line: 8, h: 5 };

/**
 * How tall a card carrying nothing but its id and a two-line title has to be.
 * Every figure that draws a header-only card takes its height from here rather
 * than guessing one — the guesses came out a few units short and left the last
 * title bar sitting on the card's own bottom edge.
 */
export const CARD_HEADER_H = TITLE.top + TITLE.line + TITLE.h + CARD_PAD;

export function TaskCard({
  x,
  y,
  w,
  h,
  id,
  bars,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  id: string;
  /** Title lines, each a width in drawing units. */
  bars: number[];
  children?: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x + 2.5}
        y={y + 2.5}
        width={w}
        height={h}
        rx={8}
        className="fill-border"
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className="fill-elev stroke-border"
        strokeWidth={1.4}
      />
      <text
        x={x + CARD_PAD}
        y={y + 22}
        className="fill-accent-deep font-sans"
        fontSize={10.5}
        fontWeight={800}
      >
        {id}
      </text>
      {bars.map((width, i) => (
        <rect
          key={i}
          x={x + CARD_PAD}
          y={y + TITLE.top + i * TITLE.line}
          width={width}
          height={TITLE.h}
          rx={TITLE.h / 2}
          className="fill-border"
          opacity={0.17}
        />
      ))}
      {children}
    </g>
  );
}

// A pill with a word in it: one piece of planning work, named. Two figures put
// rows and rings of these together, and both need them to be the same object —
// so the width comes from the label rather than a number chosen by eye, and a
// caller can lay a row out without measuring anything twice.
//
// `lead` is the stage number, and it is the one thing on a chip drawn in ember:
// the chips are the planning work, and the number is which pass of it this is.
const CHIP = { h: 18, pad: 10, font: 8.8, per: 4.9, lead: 12 };

export const CHIP_H = CHIP.h;

export function chipWidth(label: string, lead = false) {
  return CHIP.pad * 2 + label.length * CHIP.per + (lead ? CHIP.lead : 0);
}

export function Chip({
  x,
  y,
  label,
  lead,
}: {
  x: number;
  y: number;
  label: string;
  lead?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={chipWidth(label, Boolean(lead))}
        height={CHIP.h}
        rx={CHIP.h / 2}
        className="fill-code"
      />
      {lead && (
        <text
          x={x + CHIP.pad}
          y={y + 12.4}
          className="fill-accent-deep font-sans"
          fontSize={CHIP.font}
          fontWeight={800}
        >
          {lead}
        </text>
      )}
      <text
        x={x + CHIP.pad + (lead ? CHIP.lead : 0)}
        y={y + 12.4}
        className="fill-ink font-sans"
        fontSize={CHIP.font}
      >
        {label}
      </text>
    </g>
  );
}

// A connector: the dashed track between the card and something it has to be
// reconciled with. It marches, so the drawing says the link is live; where a
// figure needs to say a link is *not* live it draws a stub that stops in the
// air, which is the same line cut short.
export function Connector({
  from,
  to,
  march = true,
}: {
  from: readonly [number, number];
  to: readonly [number, number];
  march?: boolean;
}) {
  return (
    <path
      className={march ? "bfg-march stroke-muted" : "stroke-muted"}
      d={`M${from[0]} ${from[1]} L${to[0]} ${to[1]}`}
      fill="none"
      strokeWidth={1.2}
      strokeDasharray="4 3"
      strokeLinecap="round"
      opacity={0.55}
    />
  );
}

/**
 * `distance` units from `from` in the direction of `to` — where a stub ends.
 * A fixed distance rather than a fraction of the way, so every stub in a fan is
 * the same length however far off its target sits, and none of them creeps far
 * enough to touch something and read as connected after all.
 */
export function toward(
  from: readonly [number, number],
  to: readonly [number, number],
  distance: number,
): readonly [number, number] {
  const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const len = Math.hypot(dx, dy) || 1;
  return [from[0] + (dx / len) * distance, from[1] + (dy / len) * distance];
}
