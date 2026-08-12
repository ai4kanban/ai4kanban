import type { CSSProperties, ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiBookmark,
  FiBox,
  FiFileText,
  FiList,
  FiMessageSquare,
  FiSearch,
  FiTag,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { SectionTitle } from "./SectionTitle";
import { Mat, printFrame } from "./Mat";
import { CDN } from "@/lib/site";
import type { HomeCopy } from "@/i18n/home/types";

// Drive continuous product iteration — an architecture diagram rather than a set
// of claims: outside information flows in on the left, AI4Kanban sits in the
// middle as a three-tier bento, product and release iteration come out on the
// right.
//
// The three tiers are context (top), the skill that plans and drives (middle),
// and what runs and stores the work (bottom). Those tier names are never drawn —
// vertical position already says it — so the diagram stays nouns and wires.
//
// All three columns are one surface each: a wash panel with its eyebrow set
// inside it, so the picture reads as three grounds with wiring between them
// rather than as one panel flanked by two loose lists. The nodes are paper cut
// on that wash — the same ramp step the middle already used, now applied on all
// three. The middle doesn't outrank the flanks by taking a rung of its own,
// because there isn't one above paper to give it; it outranks them by being the
// only column with a blue eyebrow, the only one two nodes wide, and the only one
// with the bar.
//
// Every node in the drawing is the same object — an icon block with a noun
// beside it — at every one of the three stops, and the middle's are two across
// so a label gets about twice the measure. The blue is an object here and never
// a tint: the bar is filled with it, and so is every icon block, each carrying a
// paper glyph. The two washed tiles holding the agent marks stay neutral on
// purpose — those are near-black artwork and need a ground of their own to be
// seen at all.
//
// Nothing in the diagram is framed and nothing casts a shadow. It is a drawing
// of about twenty parts, and the ink frame is for a block that is an object on
// the page — twenty of them nested three deep drew a grid of boxes over the top
// of the flow, which is the one thing the picture is for. So every edge here is
// a change of fill: the print's ground, the wash each column sits in, the paper
// every node is cut from, and back to the wash for the tiles under the agent
// marks. Four steps and each node lands on the one next to its ground, which is
// the whole reason the ramp is a ramp. The only thing that raises its voice is
// the blue bar at the middle where everything meets — filled, and unframed for
// exactly that reason.

// ── Why it is one SVG, and what that costs ──────────────────────────────────
// The diagram is drawn once, at one size, and scaled to whatever width it is
// given — the whole picture, type included, the way a photograph resizes. It
// used to be a responsive HTML grid that re-laid itself out at each breakpoint,
// which meant the drawing you designed was one of several the reader might get.
// This is the only one.
//
// It is mounted the way `Loop.tsx` and `Memory.tsx` mount their artwork: a
// watercolour mat with a print laid on it. That is what the change buys — once
// the diagram holds its proportions it *is* a print, so it can be mounted like
// one, and the rest of the page's pictures already are.
//
// What it costs is text layout. SVG `<text>` does not wrap: a line is a line,
// and a label too long for its box runs straight out through the side of it.
// So the wrapping a browser would have done is done here instead, off Inter's
// own advance widths — see `ADVANCE` below. Everything downstream of that
// follows: a node's height comes from how many lines its longest label needs,
// the column height comes from the nodes, and the viewBox comes from the
// column. Each language therefore gets a viewBox of its own, which is right —
// Spanish sets two lines in every node and English sets one in half of them.
//
// The trade the drawing does *not* make is a floor on the type size. At phone
// width the whole picture is about a third of its drawn size, labels included.
// That is the deal a print makes: it is a picture of the architecture, and the
// prose above it is what has to carry the argument at any width.

const MAT = `${CDN}/bloom-1.jpg`;

// ── Text metrics ────────────────────────────────────────────────────────────
// Inter's own advance widths, in thousandths of an em, at wght 400 — the weight
// the labels are set in. Read out of the variable font `next/font` ships (the
// woff2 files it emits into `.next/static/media`), so the breaks chosen below
// are the breaks a browser would choose.
//
// It covers exactly the characters the five translations of this diagram use.
// Anything else falls back to `WIDE`, which is wider than all but four glyphs
// in the face — an unknown character can then only ever break a line early,
// never overflow one. Adding a language means re-running the dump and adding
// its letters; the alternative, shipping the whole Latin-1 table, is 200 rows
// of data to serve five short lists of nouns.
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

// The one width that is not measured. CJK glyphs come from the reader's system
// stack — we ship no CJK face, on purpose — but they are full-width by
// definition, so one em each is exact rather than a guess.
const CJK = /[⺀-鿿＀-｠]/;

// Kinsoku, the short version: these may not begin a line. Without it the
// Japanese board module wrapped as プロジェクトモ|ジュール's worse cousin —
// a small ゅ orphaned at the head of the second line, which is the one break
// a Japanese reader is certain to notice.
const NEVER_STARTS_A_LINE =
  "ー・ャュョッァィゥェォヵヶゃゅょっぁぃぅぇぉ、。，．）」』】〕〉》！？：；";

// Monospace is one advance for every Latin glyph, and `--font-mono` is a system
// stack we can't measure — but every face in it is a 0.6em mono, so the eyebrow
// and the `Markdown` pill measure exactly too.
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

// A line breaks between words in Latin and between characters in CJK, so the
// unit the greedy fill works in is: a run of Latin, or one CJK character.
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
// One unit is one CSS pixel at the size the diagram was drawn — roughly the
// width the page's `max-w-5xl` column gives it, so on a desktop it renders
// about 1:1 and every number below can be read as the length it looks like.
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
const NODE = { px: 12, py: 10, gap: 12 }; // inside a node
const ROW = 10; // between two nodes
const TIER = { pad: 8, len: 18 }; // the upright wire between two tiers
const TIER_H = TIER.pad * 2 + TIER.len;
const BAR_H = 56;
const BOTTOM_H = 68;
const STORAGE_W = 150;

const NODE_W = { flank: FLANK - CP * 2, mid: (MID - CP * 2 - ROW) / 2 };
const LABEL_W = {
  flank: NODE_W.flank - NODE.px * 2 - ICON - NODE.gap,
  mid: NODE_W.mid - NODE.px * 2 - ICON - NODE.gap,
};

// A baseline sits 72% of the way down its line box. One rule for every string
// in the drawing, Latin and CJK alike, so nothing needs a face-specific metric
// to be placed — only to be measured.
const baseline = (top: number, lineHeight: number) => top + lineHeight * 0.72;

// ── Motion ──────────────────────────────────────────────────────────────────
// One signal makes one circuit of the diagram every 6.4 seconds, and every
// moving part is that same signal at a different point on its way round: the
// four inputs light in turn as they arrive, the wire into the panel carries a
// pulse, the four things the board knows light as they are read, a pulse drops
// into the bar, the bar takes a pass of light while it plans, a pulse drops out
// of it into the runtime, the wire out carries it, and the two outcomes light.
// Then it rests for the best part of a second and goes again.
//
// That is the whole reason there is motion here at all. A diagram animated part
// by part is twenty things twitching and no sentence; one packet on a circuit is
// the sentence, and the schedule below is the sentence's word order. It is why
// every rule shares one 6.4s period and differs only in `--d`, the delay that
// places it on the timeline — the parts cannot drift out of order because none
// of them owns a clock.
//
// Each keyframe puts its active moment at the very start of the period and idles
// for the rest, so `--d` alone says *when*. `both` fill matters: during the
// delay the element has to hold the 0% frame, or every wire would sit drawn on
// screen until its first turn came round.
//
// Standing still the picture says the same thing — which is what it does under
// `prefers-reduced-motion`, where the rules never apply: a wire's resting style
// is the whole line drawn, and the bar's sweep is parked off its left edge by
// the transform in its own attributes.
//
// The one thing the SVG changed is what `itr-lit` animates. On an HTML block it
// was `background-color`; a `<rect>` has none, so it is the fill.
const CYCLE = 6.4;

// Where each part of the diagram sits on that circuit, in seconds. Reading this
// list top to bottom is watching the animation.
const T = {
  input: (i: number) => 0 + i * 0.15, // signals arrive, top to bottom
  railIn: 1.1, // …and travel the wire into the panel
  context: (i: number) => 1.8 + i * 0.15, // the board reads what it knows
  dropIn: 2.75, // that drops into the skill
  // the bar's sweep is timed inside its own keyframe — it is the one part with
  // no second copy, so there is nothing for a delay to keep it in step with
  dropOut: 4.1, // the plan drops into the runtime
  railOut: 4.5, // …and travels the wire out
  output: (i: number) => 5.1 + i * 0.2, // outcomes light
} as const;

// A wire is drawn by a dash exactly as long as the path it lies on: offset at
// +length parks it before the start, 0 lays it over the whole path, -length
// carries it off the end. Running those three in order grows a segment in from
// one end and shrinks it out of the other, which is a pulse travelling the wire
// and not a line blinking on. `--w` is that length, so one keyframe serves the
// long horizontal wires and the short vertical ones alike.
//
// The sweep travels in user units, and exactly one bar width in each direction:
// that is the only distance where "off the left edge" and "off the right edge"
// need no arithmetic and no over-throw, at any width the drawing is rendered.
const BAR_W = MID - CP * 2;
const MOTION = `
@keyframes itr-lit {
  0%, 100% { fill: var(--color-accent-deep) }
  4% { fill: var(--color-accent) }
  9% { fill: var(--color-accent-deep) }
}
@keyframes itr-pulse {
  0% { stroke-dashoffset: var(--w) }
  5% { stroke-dashoffset: 0 }
  10%, 100% { stroke-dashoffset: calc(var(--w) * -1) }
}
@keyframes itr-sweep {
  0%, 49% { transform: translateX(-${BAR_W}px) }
  63%, 100% { transform: translateX(${BAR_W}px) }
}
@media (prefers-reduced-motion: no-preference) {
  .itr-lit { animation: itr-lit ${CYCLE}s ease-in-out var(--d, 0s) infinite both }
  .itr-pulse { animation: itr-pulse ${CYCLE}s ease-in-out var(--d, 0s) infinite both }
  .itr-sweep { animation: itr-sweep ${CYCLE}s ease-in-out infinite both }
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
const CONTEXT_ICONS: IconType[] = [FiBookmark, FiList, FiBox, FiActivity];
const OUTPUT_ICONS: IconType[] = [FiTrendingUp, FiTag];

// The agents the board can run. Claude Code and Codex use their own marks; the
// rest share one generic glyph. No names in the block — the logos carry it.
const AGENT_LOGOS = [
  { src: "/agents/claude.svg", alt: "Claude Code" },
  { src: "/agents/codex.svg", alt: "Codex" },
];

// The mark at the centre of the diagram, drawn to `components/ui/Logo.tsx` —
// the same three board columns, shared top, stepping down as work leaves the
// board, in their own 60×60 box so they keep their proportions at any size.
// Change one and change the other, and `public/logo-mark.svg` with them.
const LOGO_COLUMNS = [
  { x: 5, h: 44 },
  { x: 24, h: 35 },
  { x: 43, h: 26 },
];
// The drawn extent of those three inside that box, which is what has to be
// centred — the box itself has air on every side.
const LOGO_BOX = { x: 5, y: 8, w: 50, h: 44 };

// `AI4Kanban` set in the heaviest cut of the sans, measured the same way every
// label here is: 5.685em of advance at wght 900, less the eight gaps that
// `tracking-tight` closes up. It is the one string in the drawing that has to
// be centred rather than filled from the left, and the only one whose width is
// wanted as a number rather than as a line count.
const WORD = "AI4Kanban";
const WORD_FS = 24;
const WORD_TRACKING = -0.025 * WORD_FS;
const WORD_W = 5.685 * WORD_FS + (WORD.length - 1) * WORD_TRACKING;

// The glyph is set without its block. Everywhere else on the site the mark is a
// blue square carrying a paper glyph — here the bar already *is* that square,
// so repeating it inside would be a block in a block. What the bar carries is
// the mark's other half: the glyph and the word, both paper, at the mark's own
// proportions.
// Its own 60×60 box is set to 34, which puts the tallest column half again the
// word's cap height — the proportion the square block and the word hold in the
// header lockup. Drawn any smaller the three columns read as a barcode rather
// than as a board, because without the block around them nothing says how big
// the mark is meant to be.
const LOGO_H = 34;
const LOGO_SCALE = LOGO_H / 60;
const LOGO_GAP = 12;

// ── The parts ───────────────────────────────────────────────────────────────

const nodeHeight = (lines: number) => NODE.py * 2 + Math.max(ICON, lines * LH);

// The one node the whole diagram is built from: icon block left, noun right,
// paper on the column's wash. It lights when the signal reaches it.
function Node({
  x,
  y,
  w,
  icon: Icon,
  lines,
  delay,
}: {
  x: number;
  y: number;
  w: number;
  icon: IconType;
  lines: string[];
  delay: number;
}) {
  const h = nodeHeight(lines.length);
  const iconY = y + (h - ICON) / 2;
  const textTop = y + (h - lines.length * LH) / 2;
  return (
    <g style={at(delay)}>
      <rect x={x} y={y} width={w} height={h} rx={RADIUS} className="fill-elev" />
      <rect
        x={x + NODE.px}
        y={iconY}
        width={ICON}
        height={ICON}
        rx={8}
        className="itr-lit fill-accent-deep"
      />
      <Icon
        x={x + NODE.px + (ICON - GLYPH) / 2}
        y={iconY + (ICON - GLYPH) / 2}
        size={GLYPH}
        color="var(--color-elev)"
        aria-hidden="true"
      />
      <text
        x={x + NODE.px + ICON + NODE.gap}
        className="fill-ink font-sans"
        fontSize={FS}
      >
        {lines.map((line, i) => (
          <tspan key={line} x={x + NODE.px + ICON + NODE.gap} y={baseline(textTop + i * LH, LH)}>
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

// One column of the diagram: the wash it sits in, and the eyebrow set inside
// that wash with the nodes it names — which is what makes the three read as
// three grounds. `blue` is the middle one, and the only thing that marks it as
// ours at the top of the panel.
function Column({
  x,
  w,
  h,
  lines,
  tone = "muted",
  children,
}: {
  x: number;
  w: number;
  h: number;
  lines: string[];
  tone?: "muted" | "blue";
  children: ReactNode;
}) {
  return (
    <g>
      <rect
        x={x}
        y={PAD}
        width={w}
        height={h}
        rx={RADIUS}
        className="fill-code"
      />
      <text
        className={`font-mono ${tone === "blue" ? "fill-accent-deep" : "fill-muted"}`}
        fontSize={EB.size}
        fontWeight={600}
        letterSpacing={EB.tracking}
      >
        {lines.map((line, i) => (
          <tspan key={line} x={x + CP} y={baseline(PAD + CP + i * EB.line, EB.line)}>
            {line}
          </tspan>
        ))}
      </text>
      {children}
    </g>
  );
}

export function Iterate({ c }: { c: HomeCopy["iterate"] }) {
  // Every label's lines, measured first, because the height of everything below
  // is a function of how many of them there are.
  const inputs = c.inputs.map((s) => wrap(s, LABEL_W.flank, FS));
  const context = c.context.map((s) => wrap(s, LABEL_W.mid, FS));
  const outputs = c.outputs.map((s) => wrap(s, LABEL_W.flank, FS));
  const eyebrow = (s: string) =>
    wrap(s.toUpperCase(), FLANK - CP * 2, EB.size, true, EB.tracking);
  const inputsEyebrow = eyebrow(c.inputsLabel);
  const outputsEyebrow = eyebrow(c.outputsLabel);

  // One node height for the whole drawing, and one eyebrow band across all
  // three columns. A node is the same object at every stop, so it is the same
  // size at every stop; and three eyebrows that don't start on the same line
  // are three columns that don't look like a row.
  const nodeH = nodeHeight(
    Math.max(...[...inputs, ...context, ...outputs].map((l) => l.length)),
  );
  const ebH =
    Math.max(inputsEyebrow.length, outputsEyebrow.length) * EB.line;

  // The middle column sets the height, and the flanks take it: it is the one
  // with three tiers in it, and nothing else in the drawing is taller.
  const nodesTop = PAD + CP + ebH + EB.below;
  const contextH = nodeH * 2 + ROW;
  const barY = nodesTop + contextH + TIER_H;
  const bottomY = barY + BAR_H + TIER_H;
  const colH = bottomY + BOTTOM_H + CP - PAD;
  const h = colH + PAD * 2;
  const cy = PAD + colH / 2;

  // The flanks distribute what's left below their own eyebrow: four nodes sit
  // centred in it, two sit evenly spaced — so the space goes into the gaps
  // rather than into the cards, and every node on the diagram stays one size.
  const listH = colH - CP - ebH - EB.below - CP;
  const centred = (n: number, i: number) => {
    const stack = n * nodeH + (n - 1) * ROW;
    return nodesTop + (listH - stack) / 2 + i * (nodeH + ROW);
  };
  const evenly = (n: number, i: number) => {
    const space = (listH - n * nodeH) / (n + 1);
    return nodesTop + space * (i + 1) + i * nodeH;
  };

  // The bar's lockup: glyph, gap, word, centred as one object.
  const barCx = X.mid + CP + BAR_W / 2;
  const barCy = barY + BAR_H / 2;
  const lockupW = LOGO_BOX.w * LOGO_SCALE + LOGO_GAP + WORD_W;
  const lockupX = barCx - lockupW / 2;

  // The bottom tier: what runs the work, and where the work is stored. The two
  // are separate blocks so Markdown never reads as an agent.
  const agentsW = BAR_W - ROW - STORAGE_W;
  const agentsX = X.mid + CP;
  const storageX = agentsX + agentsW + ROW;
  const tileGap = 20;
  const tilesW = 3 * 40 + 2 * tileGap;
  const tilesX = agentsX + (agentsW - tilesW) / 2;
  const chipW = textWidth("Markdown", 12, true) + 24;

  return (
    <section className="mt-28">
      <SectionTitle num="04" title={c.title} />
      <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
        {c.lead}
      </p>

      {/* The mat is bare and the diagram is the print on it — the same mounting
          `Loop.tsx` gives its shots and `Memory.tsx` gives its file tree. The
          print's own ground is the page's neutral, so the four-step ramp the
          drawing is built on starts where the page does. */}
      <Mat src={MAT} className="mt-9 p-3 sm:p-5">
        <div className={printFrame}>
          <svg
            viewBox={`0 0 ${W} ${h}`}
            className="block h-auto w-full"
            role="group"
            aria-label={c.title}
          >
            <style>{MOTION}</style>
            <defs>
              {/* The pass of light across the bar is lighting, not a second
                  colour: paper feathered at both ends and clipped to the bar.
                  The rule against tinting the blue is about diluting it into a
                  grey — this leaves the fill exactly where it is and moves a
                  highlight over it, which is the only way to say *running*
                  without adding a part. 18% is where that highlight stops being
                  a contrast problem: the label is paper, and at the crest of the
                  gradient a quarter lit the ground to 4.22:1 under it, where 18%
                  holds 4.98:1 and is still plainly a sweep. */}
              <linearGradient id="itr-sweep-fill">
                <stop offset="0%" stopColor="var(--color-elev)" stopOpacity="0" />
                <stop offset="50%" stopColor="var(--color-elev)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--color-elev)" stopOpacity="0" />
              </linearGradient>
              <clipPath id="itr-bar">
                <rect x={X.mid + CP} y={barY} width={BAR_W} height={BAR_H} rx={10} />
              </clipPath>
            </defs>

            <rect width={W} height={h} className="fill-bg" />

            <Column
              x={X.inputs}
              w={FLANK}
              h={colH}
              lines={inputsEyebrow}
            >
              {inputs.map((lines, i) => (
                <Node
                  key={c.inputs[i]}
                  x={X.inputs + CP}
                  y={centred(inputs.length, i)}
                  w={NODE_W.flank}
                  icon={INPUT_ICONS[i]}
                  lines={lines}
                  delay={T.input(i)}
                />
              ))}
            </Column>

            <FlowWire x={X.wireIn} cy={cy} delay={T.railIn} />

            <Column
              x={X.mid}
              w={MID}
              h={colH}
              lines={["AI4KANBAN"]}
              tone="blue"
            >
              {/* Tier one: what the board already knows about the project. */}
              {context.map((lines, i) => (
                <Node
                  key={c.context[i]}
                  x={X.mid + CP + (i % 2) * (NODE_W.mid + ROW)}
                  y={nodesTop + Math.floor(i / 2) * (nodeH + ROW)}
                  w={NODE_W.mid}
                  icon={CONTEXT_ICONS[i]}
                  lines={lines}
                  delay={T.context(i)}
                />
              ))}

              <TierWire
                cx={barCx}
                y={nodesTop + contextH}
                delay={T.dropIn}
              />

              {/* Tier two: the one thing that plans and drives — the widest
                  filled block in the diagram, since everything above and below
                  meets here. Same fill as the primary button, `accent-deep`
                  with a paper mark. No outline: it is the only block here read
                  by its fill, and an ink frame would only put it back in the
                  same box as the nodes above.

                  It carries the logo rather than a name. "AI4Kanban Skill" was
                  a label for the reader to parse; the mark is the product, and
                  it is the one place in the drawing where the thing being
                  described is ours. */}
              <rect
                x={X.mid + CP}
                y={barY}
                width={BAR_W}
                height={BAR_H}
                rx={10}
                className="fill-accent-deep"
              />
              <g clipPath="url(#itr-bar)">
                <rect
                  className="itr-sweep"
                  x={X.mid + CP}
                  y={barY}
                  width={BAR_W}
                  height={BAR_H}
                  fill="url(#itr-sweep-fill)"
                />
              </g>
              <g
                transform={`translate(${lockupX - LOGO_BOX.x * LOGO_SCALE} ${barCy - (LOGO_BOX.y + LOGO_BOX.h / 2) * LOGO_SCALE}) scale(${LOGO_SCALE})`}
                className="fill-elev"
                aria-hidden="true"
              >
                {LOGO_COLUMNS.map((col) => (
                  <rect
                    key={col.x}
                    x={col.x}
                    y={8}
                    width={12}
                    height={col.h}
                    rx={3.5}
                  />
                ))}
              </g>
              <text
                x={lockupX + LOGO_BOX.w * LOGO_SCALE + LOGO_GAP}
                // Cap height rather than the 72% rule: this one is a mark, and
                // a mark is centred on its letters, not on its line box.
                y={barCy + 0.7275 * WORD_FS * 0.5}
                className="fill-elev font-sans"
                fontSize={WORD_FS}
                fontWeight={900}
                letterSpacing={WORD_TRACKING}
              >
                {WORD}
              </text>

              <TierWire cx={barCx} y={barY + BAR_H} delay={T.dropOut} />

              {/* Tier three: the agents, and the files. */}
              <rect
                x={agentsX}
                y={bottomY}
                width={agentsW}
                height={BOTTOM_H}
                rx={10}
                className="fill-elev"
              />
              {AGENT_LOGOS.map((logo, i) => (
                // Each mark keeps its own brand colors, so it gets a washed
                // tile of its own rather than being dropped straight onto the
                // paper — the same tile the ellipsis beside them sits in. The
                // step down to the wash is the whole tile: it is what holds
                // three unrelated marks together as one row.
                <g key={logo.src}>
                  <rect
                    x={tilesX + i * (40 + tileGap)}
                    y={bottomY + (BOTTOM_H - 40) / 2}
                    width={40}
                    height={40}
                    rx={8}
                    className="fill-code"
                  />
                  <image
                    href={logo.src}
                    x={tilesX + i * (40 + tileGap) + 12}
                    y={bottomY + (BOTTOM_H - 40) / 2 + 12}
                    width={16}
                    height={16}
                  >
                    <title>{logo.alt}</title>
                  </image>
                </g>
              ))}
              {/* An ellipsis, not a third mark. The board runs Claude Code and
                  Codex today, so anything logo-shaped here would claim an agent
                  that doesn't ship. Same washed tile as the two beside it. */}
              <rect
                x={tilesX + 2 * (40 + tileGap)}
                y={bottomY + (BOTTOM_H - 40) / 2}
                width={40}
                height={40}
                rx={8}
                className="fill-code"
              />
              <text
                x={tilesX + 2 * (40 + tileGap) + 20}
                y={bottomY + BOTTOM_H / 2 + 4}
                textAnchor="middle"
                className="fill-muted font-mono"
                fontSize={20}
              >
                <title>{c.otherAgents}</title>…
              </text>

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
                className="fill-accent-deep"
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

            <Column
              x={X.outputs}
              w={FLANK}
              h={colH}
              lines={outputsEyebrow}
            >
              {outputs.map((lines, i) => (
                <Node
                  key={c.outputs[i]}
                  x={X.outputs + CP}
                  y={evenly(outputs.length, i)}
                  w={NODE_W.flank}
                  icon={OUTPUT_ICONS[i]}
                  lines={lines}
                  delay={T.output(i)}
                />
              ))}
            </Column>
          </svg>
        </div>
      </Mat>
    </section>
  );
}
