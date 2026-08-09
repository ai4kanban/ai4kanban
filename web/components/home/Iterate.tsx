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
import { Chip } from "../ui/Chip";
import { IconChip } from "../ui/IconChip";
import { panelBare, panelBareInset } from "../styles";
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
// beside it — at every one of the three stops. The middle used to stack its
// four the other way, glyph over centred label in a quarter-width cell, and a
// cell that narrow is one where the longest noun in any language has nowhere to
// go: English overflowed "Requirements" straight through the side of its tile.
// Two-across rows give a label about twice the measure, so nothing has to break
// mid-word to fit, and the diagram gains a vocabulary of exactly one node.
//
// The blue is an object here and never a tint: the skill bar is filled with it,
// and so is every icon block, each carrying a paper glyph. The two washed tiles
// holding the agent marks stay neutral on purpose — those are near-black
// artwork and need a ground of their own to be seen at all.
//
// Nothing in the diagram is framed and nothing casts a shadow. It is a drawing
// of about twenty parts, and the ink frame is for a block that is an object on
// the page — twenty of them nested three deep drew a grid of boxes over the top
// of the flow, which is the one thing the picture is for. So every edge here is
// a change of fill: the page, the wash each column sits in, the paper every
// node is cut from, and back to the wash for the tiles under the agent marks.
// Four steps and each node lands on the one next to its ground, which is the
// whole reason the ramp is a ramp. The only thing that raises its voice is the
// blue bar at the middle where everything meets — filled, and unframed for
// exactly that reason.

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
// the `-translate-x-full` in its class list.
//
// It lives here rather than in `globals.css`, which is tokens only, and rather
// than in a Tailwind class, which can't declare keyframes.
const CYCLE = 6.4;

// Where each part of the diagram sits on that circuit, in seconds. Reading this
// list top to bottom is watching the animation.
const T = {
  input: (i: number) => 0 + i * 0.15, // signals arrive, left to right
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
const MOTION = `
@keyframes itr-lit {
  0%, 100% { background-color: var(--color-accent-deep) }
  4% { background-color: var(--color-accent) }
  9% { background-color: var(--color-accent-deep) }
}
@keyframes itr-pulse {
  0% { stroke-dashoffset: var(--w) }
  5% { stroke-dashoffset: 0 }
  10%, 100% { stroke-dashoffset: calc(var(--w) * -1) }
}
@keyframes itr-sweep {
  0%, 49% { translate: -100% 0 }
  63%, 100% { translate: 100% 0 }
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

// The one node the whole diagram is built from: icon block left, noun right,
// paper on the column's wash. It lights when the signal reaches it.
//
// `break-words` is the guard that makes that safe in five languages. The
// columns are sized for the longest noun in any of them, but a browser will
// happily push one long word straight out through the side of its box rather
// than break it, so the last word on the measure has to be allowed to split.
function Node({
  icon,
  label,
  delay,
}: {
  icon: IconType;
  label: string;
  delay: number;
}) {
  return (
    <div
      className={`${panelBare} flex items-center gap-3 px-3 py-2.5`}
      style={at(delay)}
    >
      <IconChip icon={icon} className="itr-lit" />
      <span className="min-w-0 break-words text-[0.9rem] leading-snug text-ink">
        {label}
      </span>
    </div>
  );
}

// The wire between two columns: a faint dashed track that says where the signal
// goes, and a solid pulse that travels it when the signal actually goes there.
// It replaced a plain arrow glyph, which could say *direction* and nothing more.
// Points right once the diagram is laid out in a row; on a narrow screen the
// flow stacks and the whole wire turns to point down.
function FlowWire({ delay }: { delay: number }) {
  return (
    <span
      className="flex items-center justify-center self-center py-1.5 text-accent-deep lg:py-0"
      style={{ ...at(delay), "--w": "27" } as CSSProperties}
    >
      <svg
        viewBox="0 0 36 12"
        aria-hidden="true"
        className="h-3.5 w-10.5 rotate-90 lg:rotate-0"
      >
        <path
          d="M1 6 H28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="0.1 4"
          opacity="0.4"
        />
        <path
          className="itr-pulse"
          d="M1 6 H28"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="27 27"
        />
        <path
          d="M28.5 2 l4 4 l-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

// The same wire, upright and short, between two tiers of the middle column.
// Without these the three tiers were three strips stacked with a gap; with them
// the column is a thing with something running through it, which is the claim.
function TierWire({ delay }: { delay: number }) {
  return (
    <span
      className="flex justify-center py-2 text-accent-deep"
      style={{ ...at(delay), "--w": "18" } as CSSProperties}
    >
      <svg viewBox="0 0 4 18" aria-hidden="true" className="h-4.5 w-1">
        <path
          d="M2 0 V18"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="0.1 3.55"
          opacity="0.45"
        />
        <path
          className="itr-pulse"
          d="M2 0 V18"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="18 18"
        />
      </svg>
    </span>
  );
}

// One column of the diagram. The eyebrow sits inside the wash with the nodes it
// names, which is what makes the three read as three grounds; `blue` is the
// middle one, and the only thing that marks it as ours at the top of the panel.
//
// One padding for all three, and it is the flanks that set it: their inner
// width has to hold the longest noun in any language on one line, and Spanish
// ("Conversaciones") clears it by about six pixels. A wider gutter on the middle
// column only would have bought nothing and cost those six.
function FlowColumn({
  label,
  tone = "muted",
  children,
}: {
  label: string;
  tone?: "muted" | "blue";
  children: ReactNode;
}) {
  return (
    <div className={`${panelBareInset} flex flex-col p-4`}>
      <span
        className={`mb-3.5 block font-mono text-xs font-semibold uppercase tracking-[0.2em] ${
          tone === "blue" ? "text-accent-deep" : "text-muted"
        }`}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export function Iterate({ c }: { c: HomeCopy["iterate"] }) {
  return (
    <section className="mt-28">
      <SectionTitle num="04" title={c.title} />
      <p className="max-w-3xl text-[1.05rem] leading-relaxed text-muted">
        {c.lead}
      </p>

      {/* Both flanks are sized to their nouns — wide enough for the longest of
          them in any language on one line, plus the wash panel's own padding —
          so the middle keeps the width it needs for its two-across rows; the
          wire columns take what they ask for. The flanks stretch to the middle's
          height so all three eyebrows start on the same line, and each node
          group distributes in what's left below its own. */}
      <div className="mt-9 grid gap-3 lg:grid-cols-[minmax(0,13.5rem)_auto_minmax(0,1fr)_auto_minmax(0,13.5rem)] lg:gap-4">
        <style>{MOTION}</style>

        <FlowColumn label={c.inputsLabel}>
          <div className="grid flex-1 grid-cols-1 content-center gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {c.inputs.map((label, i) => (
              <Node
                key={label}
                icon={INPUT_ICONS[i]}
                label={label}
                delay={T.input(i)}
              />
            ))}
          </div>
        </FlowColumn>

        <FlowWire delay={T.railIn} />

        <FlowColumn label="AI4Kanban" tone="blue">
          {/* Tier one: what the board already knows about the project. */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            {c.context.map((label, i) => (
              <Node
                key={label}
                icon={CONTEXT_ICONS[i]}
                label={label}
                delay={T.context(i)}
              />
            ))}
          </div>

          <TierWire delay={T.dropIn} />

          {/* Tier two: the one thing that plans and drives — the widest filled
              block in the diagram, since everything above and below meets here.
              Same fill as the primary button, `accent-deep` with a paper label.
              It was `bg-accent/15`, which is the one thing it must not be: a
              blue diluted until it is a grey reads as a tile that failed to
              load, not as the piece the rest connect to. No outline: it is the
              only block here read by its fill, and an ink frame would only put
              it back in the same box as the nodes above.

              The pass of light across it is the diagram's one lit surface, and
              it is lighting rather than a second colour: paper feathered at both
              ends and clipped to the bar. The rule against tinting the blue is
              about diluting it into a grey — this leaves the fill exactly where
              it is and moves a highlight over it, which is the only way to say
              *running* without adding a part. 18% is where that highlight stops
              being a contrast problem: the label is paper, and at the crest of
              the gradient a quarter lit the ground to 4.22:1 under it, where 18%
              holds 4.98:1 and is still plainly a sweep.

              The band is the width of the bar and travels exactly its own width
              in each direction, which is the only sizing where "off the left
              edge" and "off the right edge" need no arithmetic. A narrower band
              pushed by a percentage of *itself* has to be over-thrown by some
              multiple to clear, and the multiple that cleared at one bar width
              parked two thirds of the highlight on the bar at another — a lit
              stripe down the right of the block, permanently, at every width
              the guess was not tuned for.

              It travels on `translate` and not on `transform`, because the
              resting position is the `-translate-x-full` in the class list and
              Tailwind v4 writes that to the independent `translate` property.
              A `transform` keyframe does not override it, it *composes* with
              it — the two stack, and the sweep comes to rest exactly one bar
              width to the right of where the keyframe says it does, which is
              on top of the bar. Animate whichever property the resting style
              set. */}
          <div className="relative overflow-hidden rounded-lg bg-accent-deep px-4 py-3.5 text-center font-mono text-[0.95rem] font-semibold text-elev">
            <span
              aria-hidden="true"
              className="itr-sweep pointer-events-none absolute inset-y-0 left-0 w-full -translate-x-full bg-gradient-to-r from-transparent via-elev/18 to-transparent"
            />
            <span className="relative">{c.skill}</span>
          </div>

          <TierWire delay={T.dropOut} />

          {/* Tier three: what runs the work, and where the work is stored. The
              two are separate blocks so Markdown never reads as an agent. */}
          <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-center justify-center gap-5 rounded-lg bg-elev px-4 py-3">
              {AGENT_LOGOS.map((logo) => (
                // Each mark keeps its own brand colors, so it gets a washed
                // tile of its own rather than being dropped straight onto the
                // paper — the same tile the ellipsis beside them sits in. The
                // step down to the wash is the whole tile: it is what holds
                // three unrelated marks together as one row.
                <span
                  key={logo.src}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-code"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    className="h-6 w-6"
                    loading="lazy"
                  />
                </span>
              ))}
              {/* An ellipsis, not a third mark. The board runs Claude Code and
                  Codex today, so anything logo-shaped here would claim an agent
                  that doesn't ship. It used to be dashed to say "open slot",
                  which is the one job the glyph inside it was already doing —
                  and a dashed outline in a diagram with no solid ones left is
                  just the odd tile out. Same washed tile as the two beside it. */}
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-code pb-1.5 font-mono text-xl leading-none text-muted"
                role="img"
                aria-label={c.otherAgents}
              >
                <span aria-hidden="true">…</span>
              </span>
            </div>
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg bg-elev px-4 py-3">
              <span className="text-[0.85rem] text-muted">{c.storage}</span>
              <Chip tone="solid">Markdown</Chip>
            </div>
          </div>
        </FlowColumn>

        <FlowWire delay={T.railOut} />

        {/* Two nouns against the left column's four, so the space goes into the
            gaps rather than into the cards: `content-evenly` sets the two rows
            at a quarter and three quarters of the wash, which fills the column
            while keeping every node on the diagram the same size. Centring them
            clustered both in the middle and left a third of the ground empty at
            each end; stretching them made two slabs with four words in them. */}
        <FlowColumn label={c.outputsLabel}>
          <div className="grid flex-1 grid-cols-1 content-evenly gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            {c.outputs.map((label, i) => (
              <Node
                key={label}
                icon={OUTPUT_ICONS[i]}
                label={label}
                delay={T.output(i)}
              />
            ))}
          </div>
        </FlowColumn>
      </div>
    </section>
  );
}
