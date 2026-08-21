import type { CSSProperties, ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  FiFileText,
  FiMap,
  FiMessageSquare,
  FiSearch,
  FiTag,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { Mat, printFrame } from "./Mat";
import type { HomeCopy } from "@/i18n/home/types";

// Drive continuous product iteration — what feeds the work comes in on the
// left, in two groups: what arrives from outside, and the roadmap the team
// already holds. The board sits in the middle with work on it and what runs and
// stores that work under it, and product and release iteration come out on the
// right. The tiers are never named; vertical position says it.
//
// Nothing is framed and nothing casts a shadow, save the cards on the board,
// which cast the one the real board gives them. Every other edge is a change of
// fill: the print's ground, each column's wash, the paper the window and the
// nodes are cut from, and back to the wash for the tiles under the agent marks
// (near-black artwork that needs a ground of its own).
//
// Ember is spent on a ramp rather than spread flat. Ten identical ember tiles
// made the drawing one colour and left the eye nowhere to start; now the inputs
// are neutral and take ember only as the signal passes over them, and the
// outcomes are the only ember blocks in the drawing — they are the one tier the
// product produces. Cool in, worked in the middle, warm out.
//
// It is one SVG drawn at one size and scaled like a photograph, so every reader
// gets the drawing that was designed — and so it can be mounted on a mat the
// way `Loop.tsx` and `Memory.tsx` mount theirs. The cost is text layout: SVG
// `<text>` does not wrap, so the wrapping is done here off Inter's advance
// widths. Node height follows the line count, column height follows the nodes,
// and the viewBox follows the column — so each language gets its own viewBox.

// ── Text metrics ────────────────────────────────────────────────────────────
// Inter's advance widths in thousandths of an em at wght 400, read out of the
// variable font `next/font` ships, so these breaks are the browser's breaks.
// Covers exactly the characters the five translations use; anything else falls
// back to `WIDE`, which is wider than all but four glyphs in the face — an
// unknown character can only break a line early, never overflow one. A new
// language means re-running the dump and adding its letters.
const WIDE = 0.7;
const ADVANCE: Record<string, number> = Object.fromEntries(
  (
    [
      [242, "ijl"],
      [261, "’"],
      [269, "I"],
      [281, " "],
      [288, "."],
      [327, "t"],
      [370, "f"],
      [376, "r"],
      [528, "s"],
      [546, "x"],
      [549, "k"],
      [562, "avyáâ"],
      [571, "c"],
      [583, "eé"],
      [590, "F"],
      [591, "hnuñ"],
      [600, "oó"],
      [601, "EÉ"],
      [612, "bdpq"],
      [613, "g"],
      [639, "P"],
      [642, "S"],
      [644, "R"],
      [646, "4T"],
      [672, "K"],
      [690, "A"],
      [722, "D"],
      [730, "C"],
      [743, "H"],
      [744, "U"],
      [753, "N"],
      [765, "O"],
      [818, "w"],
      [876, "m"],
      [903, "M"],
      [1000, "—"],
    ] as const
  ).flatMap(([w, chars]) => [...chars].map((ch) => [ch, w / 1000] as const)),
);

// Unmeasured, but exact: we ship no CJK face, and these come full-width from
// the reader's system stack.
const CJK = /[⺀-鿿＀-｠]/;

// Kinsoku, the short version — these may not begin a line. Without it a small
// ゅ gets orphaned at the head of the second line.
const NEVER_STARTS_A_LINE =
  "ー・ャュョッァィゥェォヵヶゃゅょっぁぃぅぇぉ、。，．）」』】〕〉》！？：；";

// `--font-mono` is a system stack we can't measure, but every face in it is a
// 0.6em mono, so the eyebrow and the `Markdown` pill measure exactly too.
const MONO = 0.6;

function textWidth(s: string, size: number, mono: boolean, tracking = 0) {
  const chars = [...s];
  const ems = chars.reduce(
    (sum, ch) =>
      sum + (CJK.test(ch) ? 1 : mono ? MONO : (ADVANCE[ch] ?? WIDE)),
    0,
  );
  return ems * size + chars.length * tracking;
}

// The unit the greedy fill works in: a run of Latin, or one CJK character.
function atoms(text: string) {
  const out: string[] = [];
  let word = "";
  for (const ch of text) {
    if (ch === " " || CJK.test(ch)) {
      if (word) out.push(word);
      word = "";
      if (ch !== " ") out.push(ch);
    } else {
      word += ch;
    }
  }
  if (word) out.push(word);
  return out;
}

function wrap(
  text: string,
  max: number,
  size: number,
  mono = false,
  tracking = 0,
) {
  const lines: string[] = [];
  let line = "";
  for (const atom of atoms(text)) {
    const joined = line && !CJK.test(atom[0]) ? `${line} ${atom}` : line + atom;
    if (line && textWidth(joined, size, mono, tracking) > max) {
      // The break falls before `atom`. If that leaves a character that may not
      // open a line, pull the one before it down too.
      let head = line;
      let tail = atom;
      if (NEVER_STARTS_A_LINE.includes(atom[0]) && [...head].length > 1) {
        tail = head.slice(-1) + tail;
        head = head.slice(0, -1);
      }
      lines.push(head);
      line = tail;
    } else {
      line = joined;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ── The drawing's coordinate system ─────────────────────────────────────────
// One unit is one CSS pixel at the size the diagram was drawn — about the width
// `max-w-5xl` gives it, so on a desktop it renders roughly 1:1.
const PAD = 24; // the print's own margin, inside its edge
const GAP = 16; // between a column and the wire beside it
const FLANK = 216; // the two lists — sized for the longest noun in any language
const WIRE = 42;
const MID = 444;
const W = PAD * 2 + FLANK * 2 + WIRE * 2 + GAP * 4 + MID;

const X = {
  inputs: PAD,
  wireIn: PAD + FLANK + GAP,
  mid: PAD + FLANK + GAP + WIRE + GAP,
  wireOut: PAD + FLANK + GAP + WIRE + GAP + MID + GAP,
  outputs: PAD + FLANK + GAP + WIRE + GAP + MID + GAP + WIRE + GAP,
};

const CP = 16; // a column's own padding
const RADIUS = 12; // rounded-xl, on the columns and the nodes
const EB = { size: 12, tracking: 2.4, line: 15, below: 14 }; // the eyebrow
const FS = 15; // a node's label
const LH = 20;
const ICON = 32; // the block a glyph sits in
const GLYPH = 17;
const NODE = { py: 10, gap: 12 }; // inside a node
const ROW = 10; // between two nodes
const GROUP = 20; // between a group's last node and the next group's eyebrow
const TIER = { pad: 8, len: 18 }; // the upright wire between two tiers
const TIER_H = TIER.pad * 2 + TIER.len;
const BOTTOM_H = 68;
const STORAGE_W = 150;

const NODE_W = FLANK - CP * 2;
const LABEL_W = NODE_W - ICON - NODE.gap;

// ── The board at the centre ─────────────────────────────────────────────────
// Drawn from kanban-ui: `Queue.tsx` for the column headings and `BoardCard.tsx`
// for the card, at the two sizes this figure has room for. It is a drawing and
// not a capture, for the same reason `components/shots/nb.tsx` gives — a real
// window landed here would put its 11px card ids under 4px.
const BOARD = {
  chrome: 26, // the window's title bar
  pad: 12, // inside the window, around the columns
  colGap: 12,
  head: 22, // a column's heading bar
  headGap: 10,
  rowGap: 9, // between two cards
  card: { pad: 9, radius: 8, stroke: 1.3, drop: 2, gap: 7 },
  id: 11.5, // `#67`, the size the real card sets it
  pill: { h: 15, fs: 9, pad: 7, radius: 7.5 },
  title: { h: 7, line: 13 }, // a line of the title, drawn rather than set
  tag: { fs: 9.5, tracking: 1.1 }, // the mono heading, and the card's count
};
const BOARD_W = MID - CP * 2;
const BOARD_COL_W = (BOARD_W - BOARD.pad * 2 - BOARD.colGap) / 2;

// The four cards on it, in reading order: two ready, two not. All of it is the
// board's own numbers and shapes, so none of it is copy.
//
// `title` is the title drawn rather than written: one bar per line, each a
// share of the card's width. Four real titles here were four sentences to read
// in a picture whose subject is that cards move, and in five languages they
// re-wrapped the whole board. The bars say "a card has a title on it", which is
// all this figure needs them to say — and it is the same reason the path field
// in the chrome above is a shape and not a string.
const BOARD_CARDS = [
  { id: 67, todo: "0/13", ready: true, title: [1, 0.54] },
  { id: 50, todo: "0/9", ready: false, title: [0.86] },
  { id: 77, todo: "1/3", ready: true, title: [1, 0.72] },
  { id: 116, todo: "0/3", ready: false, title: [1, 0.41] },
];
// The real board's tallies, not the four drawn — two cards showing out of a
// column of eleven is what a column looks like.
// A card is as tall as its own title, the way the real column stacks them —
// one height for all four left a short card with an inch of nothing under it,
// which on the real board is where its priority and ROI row sits.
const cardHeight = (lines: number) =>
  BOARD.card.pad * 2 +
  BOARD.pill.h +
  BOARD.card.gap +
  lines * BOARD.title.line -
  (BOARD.title.line - BOARD.title.h);

// Two cards to a column, so a column is its two and the gap between them, and
// the board is the taller of the two columns.
const columnHeight = (c: number) =>
  cardHeight(BOARD_CARDS[c].title.length) +
  BOARD.rowGap +
  cardHeight(BOARD_CARDS[c + 2].title.length);
const BOARD_H =
  BOARD.chrome +
  BOARD.pad * 2 +
  BOARD.head +
  BOARD.headGap +
  Math.max(columnHeight(0), columnHeight(1));

const BOARD_COUNTS = ["11", "19"];

// A baseline sits 72% of the way down its line box. One rule for every string
// in the drawing, Latin and CJK alike, so nothing needs a face-specific metric
// to be placed — only to be measured.
const baseline = (top: number, lineHeight: number) => top + lineHeight * 0.72;

// ── Motion ──────────────────────────────────────────────────────────────────
// One signal crosses the diagram every 6.4 seconds, and every moving part is
// that same signal at a different point on its way: the inputs light in turn as
// they arrive, the wire into the board carries a pulse, the four cards
// light as the work lands on them, a pulse drops out of the board into what
// runs it, the files it writes light, the wire out carries it, and the two
// outcomes light.
//
// That is the whole reason there is motion here at all. A diagram animated part
// by part is twenty things twitching and no sentence; one packet crossing it is
// the sentence, and the schedule below is the sentence's word order. It is why
// every rule shares one period and differs only in `--d`, the delay that places
// it on the timeline — the parts cannot drift out of order because none of them
// owns a clock.
//
// Each keyframe puts its active moment at the very start of the period and idles
// for the rest, so `--d` alone says *when*. `both` fill matters: during the
// delay the element has to hold the 0% frame, or every wire would sit drawn on
// screen until its first turn came round.
//
// Standing still the picture says the same thing — which is what it does under
// `prefers-reduced-motion`, where the rules never apply: a wire's resting style
// is the whole line drawn.
//
// The one thing the SVG changed is what `itr-lit` animates. On an HTML block it
// was `background-color`; a `<rect>` has none, so it is the fill.
const CYCLE = 6.4;

// Where each part of the diagram sits on that circuit, in seconds. Reading this
// list top to bottom is watching the animation.
const T = {
  input: (i: number) => 0 + i * 0.15, // signals arrive, top to bottom
  railIn: 1.1, // …and travel the wire into the board
  card: (i: number) => 1.9 + i * 0.18, // the work lands on the board, card by card
  drop: 3.1, // and drops into what runs it
  store: 3.5, // …which writes the files
  railOut: 4.2, // the wire out carries the result
  output: (i: number) => 4.8 + i * 0.2, // outcomes light
} as const;

// How long each moving part is actually moving, in seconds. Everything else in
// its period is the part sitting still — which is what lets one delay place it.
const D = {
  lit: 0.58, // a tile up to ember and back
  pulse: 0.64, // a pulse over a wire
} as const;

// Keyframe stops are written in seconds and converted here, so the schedule
// above is the only place the timing lives. Change `CYCLE` and every part keeps
// the duration it was given.
const pct = (seconds: number) => `${(seconds / CYCLE) * 100}%`;

// A wire is drawn by a dash exactly as long as the path it lies on: offset at
// +length parks it before the start, 0 lays it over the whole path, -length
// carries it off the end. Running those three in order grows a segment in from
// one end and shrinks it out of the other, which is a pulse travelling the wire
// and not a line blinking on. `--w` is that length, so one keyframe serves the
// horizontal wires between the columns and the short upright one alike.

// `--rest` and `--lit` are the tile's own two fills, set on the node: a wash
// tile lights to ember, and an ember tile presses to `accent-deep`. The rule
// stays one line either way.
const MOTION = `
@keyframes itr-lit {
  0%, 100% { fill: var(--rest) }
  ${pct(D.lit * 0.45)} { fill: var(--lit) }
  ${pct(D.lit)} { fill: var(--rest) }
}
@keyframes itr-pulse {
  0% { stroke-dashoffset: var(--w) }
  ${pct(D.pulse / 2)} { stroke-dashoffset: 0 }
  ${pct(D.pulse)}, 100% { stroke-dashoffset: calc(var(--w) * -1) }
}
@media (prefers-reduced-motion: no-preference) {
  .itr-lit { animation: itr-lit ${CYCLE}s ease-in-out var(--d, 0s) infinite both }
  .itr-pulse { animation: itr-pulse ${CYCLE}s ease-in-out var(--d, 0s) infinite both }
}
`;

// `--d` is set on whatever wraps the animated element and inherits down to it,
// which is what lets the delay be data on a node while the rule that reads it
// stays one line of CSS.
const at = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

// One icon per node, in the order the copy lists them. Icons aren't language.
const INPUT_ICONS: IconType[] = [
  FiMessageSquare,
  FiSearch,
  FiFileText,
  FiUsers,
];
const INTERNAL_ICONS: IconType[] = [FiMap];
const OUTPUT_ICONS: IconType[] = [FiTrendingUp, FiTag];

// The agents the board can run, each with its own mark. No names in the block —
// the logos carry it.
const AGENT_LOGOS = [
  { src: "/agents/claude.svg", alt: "Claude Code" },
  { src: "/agents/codex.svg", alt: "Codex" },
  { src: "/agents/cursor.svg", alt: "Cursor" },
  { src: "/agents/opencode.svg", alt: "OpenCode" },
  { src: "/agents/dsh.svg", alt: "DeepSeek Harness" },
  { src: "/agents/zcode.svg", alt: "ZCode" },
];

// One washed tile per agent, on a strip that runs slowly behind a window
// narrower than the block. Laid out flat the row outgrew the block it sits in,
// and the trailing ellipsis that stood for the agents past the end read as
// something cut off. Moving, the row is short, every mark gets its turn, and
// the loop itself is what says the list is open.
const TILE = 30;
const TILE_ICON = 14;
const TILE_GAP = 12;
const STRIP = AGENT_LOGOS.length * (TILE + TILE_GAP); // one full turn
const MARQUEE_W = 168; // the window, well inside the block's 252
const STILL = 5; // marks shown when the strip can't move

// The one part of the drawing that doesn't run on the circuit's clock: it never
// starts or stops, so there is nothing to place on that timeline. It takes four
// turns of the circuit to come back round, which is slow enough to read as drift
// rather than as a thing demanding attention.
//
// Standing still it can't be endless, so the strip is swapped for a short
// centred row — the block says "these run the work" either way.
const MARQUEE = `
@keyframes itr-marquee {
  to { transform: translateX(-${STRIP}px) }
}
.itr-marquee { display: none }
@media (prefers-reduced-motion: no-preference) {
  .itr-marquee { display: inline; animation: itr-marquee ${CYCLE * 4}s linear infinite }
  .itr-still { display: none }
}
`;

// The mark in the window's title bar, drawn to `components/ui/Logo.tsx` — the
// same three board columns, shared top, stepping down as work leaves the board,
// in their own 60×60 box so they keep their proportions at any size. Change one
// and change the other, and `public/logo-mark.svg` with them.
//
// It sits where the real app puts it, which is the only place a logo earns in a
// diagram of what the product does: a mark floating in the middle of the flow
// said nothing, and a mark on the window says the board is ours.
const LOGO_COLUMNS = [
  { x: 5, h: 44 },
  { x: 24, h: 35 },
  { x: 43, h: 26 },
];
// The drawn extent of those three inside that box, which is what has to be
// centred — the box itself has air on every side.
const LOGO_BOX = { x: 5, y: 8, w: 50, h: 44 };

// ── The parts ───────────────────────────────────────────────────────────────

const nodeHeight = (lines: number) => NODE.py * 2 + Math.max(ICON, lines * LH);

// The two weights a node comes in, and the only place in the drawing that
// decides ember. `paper` is the inputs — neutral, and ember only for the moment
// the signal is standing on them; `ember` is the outcomes, which rest lit and
// press instead, because they have nowhere hotter to go.
//
// The pairing of tile and glyph is the constraint: a tile always sits one step
// off whatever it is drawn on, and its glyph always clears 3:1 against the tile
// in both of the tile's states — ink on paper, ink on the ember it flashes to,
// paper on ember, paper on the deep ember it presses to.
const TONE = {
  paper: { tile: "fill-elev", rest: "elev", lit: "accent", glyph: "ink" },
  ember: { tile: "fill-accent", rest: "accent", lit: "accent-deep", glyph: "elev" },
} as const;
type Tone = keyof typeof TONE;

// The node the flanks are built from: icon block left, noun right, sitting
// straight on the column's wash. It wears no card — a signal from outside and a
// result that leaves are not objects the product owns, and ten identical cards
// across the drawing were the reason nothing in here led the eye.
function Node({
  x,
  y,
  icon: Icon,
  lines,
  delay,
  tone,
}: {
  x: number;
  y: number;
  icon: IconType;
  lines: string[];
  delay: number;
  tone: Tone;
}) {
  const t = TONE[tone];
  const h = nodeHeight(lines.length);
  const iconY = y + (h - ICON) / 2;
  const textTop = y + (h - lines.length * LH) / 2;
  const labelX = x + ICON + NODE.gap;
  return (
    <g
      style={
        {
          ...at(delay),
          "--rest": `var(--color-${t.rest})`,
          "--lit": `var(--color-${t.lit})`,
        } as CSSProperties
      }
    >
      <rect
        x={x}
        y={iconY}
        width={ICON}
        height={ICON}
        rx={8}
        className={`itr-lit ${t.tile}`}
      />
      <Icon
        x={x + (ICON - GLYPH) / 2}
        y={iconY + (ICON - GLYPH) / 2}
        size={GLYPH}
        color={`var(--color-${t.glyph})`}
        aria-hidden="true"
      />
      <text x={labelX} className="fill-ink font-sans" fontSize={FS}>
        {lines.map((line, i) => (
          <tspan key={line} x={labelX} y={baseline(textTop + i * LH, LH)}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

// The wire between two columns: a faint dashed track that says where the signal
// goes, and a solid pulse that travels it when the signal actually goes there.
// It replaced a plain arrow glyph, which could say *direction* and nothing more.
// Drawn in its own 36×12 box and scaled into place, so the stroke, the dash and
// the arrowhead keep the proportions they were drawn at.
function FlowWire({ x, cy, delay }: { x: number; cy: number; delay: number }) {
  const s = WIRE / 36;
  return (
    <g
      transform={`translate(${x} ${cy - 6 * s}) scale(${s})`}
      className="stroke-accent-deep"
      style={{ ...at(delay), "--w": "27" } as CSSProperties}
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M1 6 H28" strokeDasharray="0.1 4" opacity="0.4" />
      <path className="itr-pulse" d="M1 6 H28" strokeDasharray="27 27" />
      <path d="M28.5 2 l4 4 l-4 4" strokeLinejoin="round" />
    </g>
  );
}

// ── The board ───────────────────────────────────────────────────────────────
// What the middle column holds: the app, drawn small. It replaced four tiles
// naming what the board knows and a logo bar under them — a list of parts and a
// badge, where the section is about work moving. A board with cards on it says
// what arrives here and what it turns into, and it is the same board the reader
// will open.
//
// Faithful to kanban-ui at the parts that identify it and silent everywhere
// else: the window chrome, the two heading bars with their dot and count, the
// outlined card with its hard shadow, the ember id, the ready pill, the todo
// count. The priority and ROI row every real card carries is left off — at this
// size it is two more chips of noise on a card whose job here is to be legibly
// a card.

// One card on that board. `nb-panel-sm`: paper, a full ink outline, and a hard
// shadow — the board's own grammar, and the reason the cards read as cards on a
// page that otherwise frames nothing.
function BoardCard({
  x,
  y,
  w,
  card,
  ready,
  delay,
}: {
  x: number;
  y: number;
  w: number;
  card: (typeof BOARD_CARDS)[number];
  ready: string;
  delay: number;
}) {
  const { pad, radius, stroke, drop, gap } = BOARD.card;
  const h = cardHeight(card.title.length);
  const rowY = y + pad;
  const titleTop = rowY + BOARD.pill.h + gap;
  const pillW = textWidth(ready, BOARD.pill.fs, false) + BOARD.pill.pad * 2;
  // What the todo count needs at the right end of the meta row, so the pill
  // beside it never has to guess.
  const todoW = textWidth(card.todo, BOARD.tag.fs, true) + 8;
  return (
    <g
      style={
        {
          ...at(delay),
          "--rest": "var(--color-elev)",
          "--lit": "var(--color-code)",
        } as CSSProperties
      }
    >
      <rect
        x={x + drop}
        y={y + drop}
        width={w}
        height={h}
        rx={radius}
        className="fill-border"
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={radius}
        className="itr-lit fill-elev stroke-border"
        strokeWidth={stroke}
      />
      <text
        x={x + pad}
        y={baseline(rowY, BOARD.pill.h)}
        className="fill-accent-deep font-sans"
        fontSize={BOARD.id}
        fontWeight={800}
      >
        #{card.id}
      </text>
      {/* The ready pill, in the site's own positive signal rather than the
          board's paler mint — a word on a pigment the site does not own is the
          one thing artwork here may not carry. */}
      {card.ready && (
        <>
          <rect
            x={x + w - pad - pillW - todoW}
            y={rowY}
            width={pillW}
            height={BOARD.pill.h}
            rx={BOARD.pill.radius}
            className="fill-growth"
          />
          <text
            x={x + w - pad - pillW / 2 - todoW}
            y={baseline(rowY, BOARD.pill.h)}
            textAnchor="middle"
            className="fill-elev font-mono"
            fontSize={BOARD.pill.fs}
          >
            {ready}
          </text>
        </>
      )}
      <text
        x={x + w - pad}
        y={baseline(rowY, BOARD.pill.h)}
        textAnchor="end"
        className="fill-muted font-mono"
        fontSize={BOARD.tag.fs}
      >
        {card.todo}
      </text>
      {/* The title, as the lines it takes rather than the words on them. Ink
          at a sixth: the weight a run of 12px type actually leaves on paper,
          where a solid bar would read as a filled field. */}
      {card.title.map((share, i) => (
        <rect
          key={i}
          x={x + pad}
          y={titleTop + i * BOARD.title.line}
          width={(w - pad * 2) * share}
          height={BOARD.title.h}
          rx={BOARD.title.h / 2}
          className="fill-border"
          opacity="0.17"
        />
      ))}
    </g>
  );
}

// The board itself: a window on the middle column's wash, chrome across the
// top, two of its columns under that. Paper on wash is the whole edge — the
// drawing frames nothing, and the cards inside are the only outlined thing in
// it because that is what a card is.
function Board({
  x,
  y,
  headings,
  ready,
}: {
  x: number;
  y: number;
  headings: string[][];
  ready: string;
}) {
  const { chrome, pad, colGap, head, headGap, rowGap } = BOARD;
  const dotY = y + chrome / 2;
  const mark = 15; // the ember square the glyph sits in, at the app's own ratio
  const markScale = (mark * 0.62) / 60;
  const colsY = y + chrome + pad;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={BOARD_W}
        height={BOARD_H}
        rx={10}
        className="fill-elev"
      />

      {/* Chrome. `band` and not the wash: the wash is what the column behind
          this window is painted in, so a chrome bar in it had no title bar at
          all — the window appeared to start at the board. Column wash, then
          chrome, then the paper the board is on, is three steps of one ramp,
          which is the order the real app's cream chrome and white body sit in.

          The rounded rect gets its bottom corners squared off by a second one,
          which is cheaper than a clip path for two corners. */}
      <rect
        x={x}
        y={y}
        width={BOARD_W}
        height={chrome}
        rx={10}
        className="fill-band"
      />
      <rect
        x={x}
        y={y + chrome - 10}
        width={BOARD_W}
        height={10}
        className="fill-band"
      />
      {/* The window's own three, in the system's colours. Artwork pigment: it
          belongs to macOS, carries no text, and is the fastest thing on the
          page to read as "an application window". */}
      {["#ff5f57", "#febc2e", "#28c840"].map((fill, i) => (
        <circle key={fill} cx={x + 13 + i * 11} cy={dotY} r={3.2} fill={fill} />
      ))}
      <rect
        x={x + 48}
        y={dotY - mark / 2}
        width={mark}
        height={mark}
        rx={4}
        className="fill-accent"
      />
      <g
        transform={`translate(${x + 48 + mark / 2 - (LOGO_BOX.x + LOGO_BOX.w / 2) * markScale} ${dotY - (LOGO_BOX.y + LOGO_BOX.h / 2) * markScale}) scale(${markScale})`}
        className="fill-elev"
        aria-hidden="true"
      >
        {LOGO_COLUMNS.map((col) => (
          <rect key={col.x} x={col.x} y={8} width={12} height={col.h} rx={3.5} />
        ))}
      </g>
      {headings.map((lines, c) => {
        const cx = x + pad + c * (BOARD_COL_W + colGap);
        return (
          <g key={BOARD_COUNTS[c]}>
            <rect
              x={cx}
              y={colsY}
              width={BOARD_COL_W}
              height={head}
              rx={7}
              className="fill-code"
            />
            <circle
              cx={cx + 11}
              cy={colsY + head / 2}
              r={3}
              className="fill-accent"
            />
            <text
              x={cx + 20}
              y={baseline(colsY, head)}
              className="fill-ink font-mono"
              fontSize={BOARD.tag.fs}
              fontWeight={600}
              letterSpacing={BOARD.tag.tracking}
            >
              {lines[0]}
            </text>
            <text
              x={cx + BOARD_COL_W - 9}
              y={baseline(colsY, head)}
              textAnchor="end"
              className="fill-muted font-mono"
              fontSize={BOARD.tag.fs}
            >
              {BOARD_COUNTS[c]}
            </text>
            {[0, 1].map((r) => {
              const i = r * 2 + c;
              return (
                <BoardCard
                  key={BOARD_CARDS[i].id}
                  x={cx}
                  y={
                    colsY +
                    head +
                    headGap +
                    (r ? cardHeight(BOARD_CARDS[c].title.length) + rowGap : 0)
                  }
                  w={BOARD_COL_W}
                  card={BOARD_CARDS[i]}
                  ready={ready}
                  delay={T.card(i)}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

// The same wire, upright and short, between two tiers of the middle column.
// Without these the three tiers were three strips stacked with a gap; with them
// the column is a thing with something running through it, which is the claim.
function TierWire({ cx, y, delay }: { cx: number; y: number; delay: number }) {
  return (
    <g
      transform={`translate(${cx} ${y + TIER.pad})`}
      className="stroke-accent-deep"
      style={{ ...at(delay), "--w": "18" } as CSSProperties}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <path d="M0 0 V18" strokeDasharray="0.1 3.55" opacity="0.45" />
      <path className="itr-pulse" d="M0 0 V18" strokeDasharray="18 18" />
    </g>
  );
}

// A run of agent marks from `x`. Each mark keeps its own brand colors, so it
// gets a washed tile of its own rather than being dropped straight onto the
// paper — the step down to the wash is what holds unrelated marks together as
// one row.
function AgentTiles({
  x,
  y,
  logos,
}: {
  x: number;
  y: number;
  logos: typeof AGENT_LOGOS;
}) {
  return logos.map((logo, i) => (
    <g key={logo.src} transform={`translate(${x + i * (TILE + TILE_GAP)} ${y})`}>
      <rect width={TILE} height={TILE} rx={8} className="fill-code" />
      <image
        href={logo.src}
        x={(TILE - TILE_ICON) / 2}
        y={(TILE - TILE_ICON) / 2}
        width={TILE_ICON}
        height={TILE_ICON}
      >
        <title>{logo.alt}</title>
      </image>
    </g>
  ));
}

// The label over a group of nodes, set straight on the wash the group sits in.
// A column may hold more than one: the inputs column names its two kinds of
// input, and each name has to sit with the nodes it names.
function Eyebrow({
  x,
  y,
  lines,
  tone = "muted",
}: {
  x: number;
  y: number;
  lines: string[];
  tone?: "muted" | "ember";
}) {
  return (
    <text
      className={`font-mono ${tone === "ember" ? "fill-accent-deep" : "fill-muted"}`}
      fontSize={EB.size}
      fontWeight={600}
      letterSpacing={EB.tracking}
    >
      {lines.map((line, i) => (
        <tspan key={line} x={x} y={baseline(y + i * EB.line, EB.line)}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

// One column of the diagram: the wash its groups sit in, which is what makes
// the three read as three grounds.
//
// Each takes its own height and is centred on the line the wires run along,
// rather than all three being stretched to the tallest. Two outcomes held at
// arm's length in a box built for six were two blocks adrift in a wash; sized
// to what they hold, the middle is plainly the machine and the flanks are
// plainly its two ends.
function Column({
  x,
  y,
  w,
  h,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children: ReactNode;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={RADIUS} className="fill-code" />
      {children}
    </g>
  );
}

export function Iterate({ c }: { c: HomeCopy["iterate"] }) {
  // Every label's lines, measured first, because the height of everything below
  // is a function of how many of them there are.
  const inputs = c.inputs.map((s) => wrap(s, LABEL_W, FS));
  const internal = c.internal.map((s) => wrap(s, LABEL_W, FS));
  const outputs = c.outputs.map((s) => wrap(s, LABEL_W, FS));
  const eyebrow = (s: string) =>
    wrap(s.toUpperCase(), FLANK - CP * 2, EB.size, true, EB.tracking);
  const inputsEyebrow = eyebrow(c.inputsLabel);
  const internalEyebrow = eyebrow(c.internalLabel);
  const outputsEyebrow = eyebrow(c.outputsLabel);

  // The board's own strings. Its headings are set in mono, which measures
  // exactly at any character, and clipped to one line — a column heading that
  // wraps is a column heading that no longer fits its bar.
  const headings = c.board.columns.map((s) =>
    wrap(s.toUpperCase(), BOARD_COL_W - 42, BOARD.tag.fs, true, BOARD.tag.tracking),
  );
  // One node height and one eyebrow band for the whole drawing. A node is the
  // same object at every stop, so it is the same size at every stop, and the
  // three eyebrows sit the same distance inside their own column.
  const nodeH = nodeHeight(
    Math.max(...[...inputs, ...internal, ...outputs].map((l) => l.length)),
  );
  const ebH =
    Math.max(
      inputsEyebrow.length,
      internalEyebrow.length,
      outputsEyebrow.length,
    ) * EB.line;

  // A group is an eyebrow and the nodes it names; a column is its groups inside
  // its own padding. Both flanks measure the same way, so the two groups on the
  // left stack the way one group does.
  const groupH = (n: number) => ebH + EB.below + n * nodeH + (n - 1) * ROW;
  const nodeAt = (top: number, i: number) =>
    top + ebH + EB.below + i * (nodeH + ROW);

  const midH =
    CP + ebH + EB.below + BOARD_H + TIER_H + BOTTOM_H + CP;
  const inputsH =
    CP + groupH(inputs.length) + GROUP + groupH(internal.length) + CP;
  const outputsH = CP + groupH(outputs.length) + CP;

  // Every column hangs off the line the wires run along, and the drawing is as
  // tall as the tallest of them.
  const contentH = Math.max(midH, inputsH, outputsH);
  const cy = PAD + contentH / 2;
  const h = PAD * 2 + contentH;

  const midTop = cy - midH / 2;
  const boardY = midTop + CP + ebH + EB.below;
  const bottomY = boardY + BOARD_H + TIER_H;

  const inputsTop = cy - inputsH / 2;
  const internalTop = inputsTop + CP + groupH(inputs.length) + GROUP;
  const outputsTop = cy - outputsH / 2;

  // The row under the board: what runs the work, and where the work is stored.
  // The two are separate blocks so Markdown never reads as an agent.
  const agentsW = BOARD_W - ROW - STORAGE_W;
  const agentsX = X.mid + CP;
  const storageX = agentsX + agentsW + ROW;
  const tileY = bottomY + (BOTTOM_H - TILE) / 2;
  const marqueeX = agentsX + (agentsW - MARQUEE_W) / 2;
  const stillW = STILL * TILE + (STILL - 1) * TILE_GAP;
  const chipW = textWidth("Markdown", 12, true) + 24;

  return (
    <section className="mt-28">
      <SectionTitle num="04" title={c.title} />
      <p
        data-reveal
        data-delay="1"
        className="max-w-3xl text-[1.05rem] leading-relaxed text-muted"
      >
        {c.lead}
      </p>

      {/* The mat is bare and the diagram is the print on it — the same mounting
          `Loop.tsx` gives its shots and `Memory.tsx` gives its file tree. The
          print's own ground is the page's neutral, so the four-step ramp the
          drawing is built on starts where the page does. */}
      {/* The drawing's own circuit runs on its own clock; the reveal only
          brings the print onto the page. */}
      <Mat wash="peachEmber" data-reveal data-delay="2" className="mt-9 p-3 sm:p-5">
        <div className={printFrame}>
          <svg
            viewBox={`0 0 ${W} ${h}`}
            className="block h-auto w-full"
            role="group"
            aria-label={c.title}
          >
            <style>{MOTION + MARQUEE}</style>

            <rect width={W} height={h} className="fill-bg" />

            {/* What feeds the work: the signals that arrive from outside, and
                under them the plan the team already holds. Two groups on one
                wash and not two columns — they are one end of the flow, and the
                wire leaves the column once. */}
            <Column x={X.inputs} y={inputsTop} w={FLANK} h={inputsH}>
              <Eyebrow
                x={X.inputs + CP}
                y={inputsTop + CP}
                lines={inputsEyebrow}
              />
              {inputs.map((lines, i) => (
                <Node
                  key={c.inputs[i]}
                  x={X.inputs + CP}
                  y={nodeAt(inputsTop + CP, i)}
                  icon={INPUT_ICONS[i]}
                  lines={lines}
                  delay={T.input(i)}
                  tone="paper"
                />
              ))}
              <Eyebrow
                x={X.inputs + CP}
                y={internalTop}
                lines={internalEyebrow}
              />
              {internal.map((lines, i) => (
                <Node
                  key={c.internal[i]}
                  x={X.inputs + CP}
                  y={nodeAt(internalTop, i)}
                  icon={INTERNAL_ICONS[i]}
                  lines={lines}
                  delay={T.input(inputs.length + i)}
                  tone="paper"
                />
              ))}
            </Column>

            <FlowWire x={X.wireIn} cy={cy} delay={T.railIn} />

            <Column x={X.mid} y={midTop} w={MID} h={midH}>
              <Eyebrow
                x={X.mid + CP}
                y={midTop + CP}
                lines={["AI4KANBAN"]}
                tone="ember"
              />

              {/* The board, with work on it. */}
              <Board
                x={X.mid + CP}
                y={boardY}
                headings={headings}
                ready={c.board.ready}
              />

              <TierWire
                cx={X.mid + CP + BOARD_W / 2}
                y={boardY + BOARD_H}
                delay={T.drop}
              />

              {/* What runs it, and what it writes. */}
              {/* Tier three: the agents, and the files. */}
              <rect
                x={agentsX}
                y={bottomY}
                width={agentsW}
                height={BOTTOM_H}
                rx={10}
                className="fill-elev"
              />
              {/* The window the strip runs behind: it ends in a fade rather
                  than an edge, so a mark leaving is never a mark cut off. The
                  mask does the clipping too — outside its rect is black. */}
              <defs>
                <linearGradient
                  id="itr-agents-fade"
                  gradientUnits="userSpaceOnUse"
                  x1={marqueeX}
                  x2={marqueeX + MARQUEE_W}
                >
                  <stop offset="0" stopColor="#000" />
                  <stop offset="0.16" stopColor="#fff" />
                  <stop offset="0.84" stopColor="#fff" />
                  <stop offset="1" stopColor="#000" />
                </linearGradient>
                <mask
                  id="itr-agents-window"
                  maskUnits="userSpaceOnUse"
                  x={marqueeX}
                  y={bottomY}
                  width={MARQUEE_W}
                  height={BOTTOM_H}
                >
                  <rect
                    x={marqueeX}
                    y={bottomY}
                    width={MARQUEE_W}
                    height={BOTTOM_H}
                    fill="url(#itr-agents-fade)"
                  />
                </mask>
              </defs>
              <g mask="url(#itr-agents-window)">
                {/* Two copies of the one strip, the second parked a full turn
                    to the right: at the end of the turn it stands exactly where
                    the first began, so the loop has no seam. */}
                <g className="itr-marquee">
                  <AgentTiles x={marqueeX} y={tileY} logos={AGENT_LOGOS} />
                  <g aria-hidden>
                    <AgentTiles
                      x={marqueeX + STRIP}
                      y={tileY}
                      logos={AGENT_LOGOS}
                    />
                  </g>
                </g>
              </g>
              <g className="itr-still">
                <AgentTiles
                  x={agentsX + (agentsW - stillW) / 2}
                  y={tileY}
                  logos={AGENT_LOGOS.slice(0, STILL)}
                />
              </g>

              <rect
                x={storageX}
                y={bottomY}
                width={STORAGE_W}
                height={BOTTOM_H}
                rx={10}
                className="fill-elev"
              />
              <text
                x={storageX + STORAGE_W / 2}
                y={baseline(bottomY + 14, 17)}
                textAnchor="middle"
                className="fill-muted font-sans"
                fontSize={13}
              >
                {c.storage}
              </text>
              <rect
                x={storageX + (STORAGE_W - chipW) / 2}
                y={bottomY + 38}
                width={chipW}
                height={22}
                rx={11}
                className="itr-lit fill-accent-deep"
                style={
                  {
                    ...at(T.store),
                    "--rest": "var(--color-accent-deep)",
                    "--lit": "var(--color-accent)",
                  } as CSSProperties
                }
              />
              <text
                x={storageX + STORAGE_W / 2}
                y={baseline(bottomY + 38, 22)}
                textAnchor="middle"
                className="fill-elev font-mono"
                fontSize={12}
              >
                Markdown
              </text>
            </Column>

            <FlowWire x={X.wireOut} cy={cy} delay={T.railOut} />

            <Column x={X.outputs} y={outputsTop} w={FLANK} h={outputsH}>
              <Eyebrow
                x={X.outputs + CP}
                y={outputsTop + CP}
                lines={outputsEyebrow}
              />
              {outputs.map((lines, i) => (
                <Node
                  key={c.outputs[i]}
                  x={X.outputs + CP}
                  y={nodeAt(outputsTop + CP, i)}
                  icon={OUTPUT_ICONS[i]}
                  lines={lines}
                  delay={T.output(i)}
                  tone="ember"
                />
              ))}
            </Column>
          </svg>
        </div>
      </Mat>
    </section>
  );
}
