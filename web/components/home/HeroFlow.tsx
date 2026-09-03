import type { CSSProperties, ReactNode } from "react";
import { printFrame } from "./Mat";
import {
  Btn,
  Chip,
  HAIR,
  NB,
  SANS,
  Section,
  Tag,
  em,
} from "../shots/nb";
import type { HomeCopy } from "@/i18n/home/types";

// The hero picture: one rough idea becoming a plan, one decision coming back,
// and the rest of the work running on its own — four prints on the hero's mat,
// read 01 → 04. It replaced a flip deck of two board captures, which proved a
// board exists without telling that story.
//
// Drawn rather than captured, for the reason `shots/nb.tsx` gives: a capture of
// the real UI lands here at about half size and stops being readable. Every
// value inside comes from that kit, so these prints and the three in
// `Steps.tsx` are the same product.
//
// Each print carries its own caption on paper. The captions are copy, so they
// cannot sit on the mat's pigment (design.md §Illustration) — a strip at the
// top of the paper is where they read.

/** The type inside a print, as a share of the print's own width: floored so a
 *  phone-width cell stays legible, capped so a 500px cell doesn't turn a four
 *  line drawing into four headlines. */
const ROOT = "clamp(0.6875rem, 3.4cqw, 0.9rem)";

const MOTION = `
@keyframes hf-caret { 0%, 45% { opacity: 1 } 55%, 100% { opacity: 0 } }
@keyframes hf-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.85) }
  50% { opacity: 1; transform: scale(1) }
}
@media (prefers-reduced-motion: no-preference) {
  .hf-caret { animation: hf-caret 1.1s steps(1) infinite both }
  /* Runs that started at different moments don't breathe together. */
  .hf-pulse { animation: hf-pulse 1.1s ease-in-out var(--pd, 0s) infinite both }
}
`;

function Stage({
  step,
  label,
  children,
}: {
  step: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className={`${printFrame} flex flex-col bg-elev`}>
      <div
        className="flex items-baseline gap-2.5 px-4 py-3"
        style={{ borderBottom: `1px solid ${HAIR}` }}
      >
        <span
          aria-hidden
          className="font-mono text-[0.7rem] font-bold tracking-[0.2em] text-accent-deep"
        >
          {step}
        </span>
        <span className="text-[0.85rem] font-semibold leading-snug text-ink lg:text-[0.95rem]">
          {label}
        </span>
      </div>
      {/* The container the `cqw` above measures, and the one font-size every
          length inside is written against. */}
      <div
        aria-hidden
        className="flex flex-1 flex-col px-4 pb-4 pt-3.5"
        style={{
          containerType: "inline-size",
          fontSize: ROOT,
          fontFamily: SANS,
          lineHeight: 1.45,
          color: NB.ink,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// 01 — the box a task is typed into, mid-sentence.
function Idea() {
  return (
    // The cell's height is set by the drawing beside it, so the button takes
    // the slack rather than leaving it under the block.
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: em(10),
      }}
    >
      <Tag>new task</Tag>
      <div
        style={{
          border: `${em(1.5)} solid ${NB.ink}`,
          borderRadius: em(12),
          background: NB.paper,
          boxShadow: `${em(3)} ${em(3)} 0 0 ${NB.ink}`,
          padding: `${em(12)} ${em(14)}`,
          fontSize: em(14),
          fontWeight: 600,
          lineHeight: 1.5,
        }}
      >
        Let a team share one board without moving the codebase
        <span
          className="hf-caret"
          style={{
            display: "inline-block",
            width: em(1.5, 14),
            height: em(15, 14),
            marginLeft: em(3, 14),
            verticalAlign: em(-2, 14),
            background: NB.ink,
          }}
        />
      </div>
      <div
        style={{ marginTop: "auto", display: "flex", justifyContent: "flex-end" }}
      >
        <Btn variant="accent">Create task</Btn>
      </div>
    </div>
  );
}

// 02 — the subtask map off card #311, at the size a hero can carry: five cards
// wired by dependency, with the fork that says what runs at the same time.
//
// One SVG, labels included, so the arrows can never drift off the nodes: the
// viewBox scales the whole drawing with the print, where nodes laid out in `em`
// over an SVG would scale against a different unit.
const MAP = { w: 292, h: 80, node: { w: 58, h: 26 }, col: [0, 78, 156, 234] };
const ROW = [6, 48];

function MapNode({ id, x, y }: { id: number; x: number; y: number }) {
  const { w, h } = MAP.node;
  return (
    <g>
      <rect x={x + 2} y={y + 2} width={w} height={h} rx={9} fill={NB.ink} />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={9}
        fill={NB.paper}
        stroke={NB.ink}
        strokeWidth={1.5}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 4.6}
        textAnchor="middle"
        fontFamily={SANS}
        fontSize={13}
        fontWeight={800}
        fill={NB.accentDeep}
      >
        #{id}
      </text>
    </g>
  );
}

function Plan() {
  const { col, node } = MAP;
  const cy = ROW[0] + node.h / 2;
  const cy2 = ROW[1] + node.h / 2;
  const straight = [0, 1, 2].map(
    (i) => `M${col[i] + node.w + 4} ${cy} H${col[i + 1] - 4}`,
  );
  const fork = `M${col[2] + node.w + 4} ${cy} C${col[3] - 26} ${cy} ${col[3] - 34} ${cy2} ${col[3] - 4} ${cy2}`;

  return (
    <div
      style={{ flex: 1, display: "flex", flexDirection: "column", gap: em(10) }}
    >
      <Tag>subtasks · 5 cards</Tag>
      <svg
        viewBox={`0 0 ${MAP.w} ${MAP.h}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <defs>
          <marker
            id="hf-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill={NB.inkSoft} />
          </marker>
        </defs>
        {[...straight, fork].map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke={NB.inkSoft}
            strokeWidth={1.6}
            markerEnd="url(#hf-arrow)"
          />
        ))}
        <MapNode id={314} x={col[0]} y={ROW[0]} />
        <MapNode id={315} x={col[1]} y={ROW[0]} />
        <MapNode id={316} x={col[2]} y={ROW[0]} />
        <MapNode id={317} x={col[3]} y={ROW[0]} />
        <MapNode id={328} x={col[3]} y={ROW[1]} />
      </svg>
      <div style={{ marginTop: "auto", fontSize: em(12), color: NB.inkSoft }}>
        #317 and #328 wait for #316, then run in parallel.
      </div>
    </div>
  );
}

// 03 — card #48's real trade-off, on the ember ground a card page uses where an
// answer is wanted.
const OPTIONS = [
  { text: "Only after you read it — the run leaves the diff in your tree", pick: true },
  { text: "As soon as the run finishes — main moves with nobody looking", pick: false },
];

function Decision() {
  return (
    <Section style={{ flex: 1, background: NB.accentWash, padding: em(14) }}>
      <Tag mark={<span style={{ color: NB.accent }}>?</span>}>needs you</Tag>
      <p
        style={{
          margin: `${em(10)} 0 0`,
          fontSize: em(14),
          fontWeight: 700,
          lineHeight: 1.4,
        }}
      >
        When does a finished run merge into main?
      </p>
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: em(6),
          margin: `${em(12)} 0 0`,
          padding: 0,
          listStyle: "none",
        }}
      >
        {OPTIONS.map((option) => (
          <li
            key={option.text}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: em(8),
              fontSize: em(12.5),
              lineHeight: 1.4,
              color: option.pick ? NB.ink : NB.inkSoft,
              fontWeight: option.pick ? 700 : 400,
            }}
          >
            <span style={{ color: option.pick ? NB.accent : NB.inkSoft }}>
              {option.pick ? "◉" : "○"}
            </span>
            {/* The mark rides at the end of the sentence rather than beside it:
                in a narrow cell a chip in its own column squeezes the answer
                into three wrapped lines. */}
            <span style={{ flex: 1, minWidth: 0 }}>
              {option.text}
              {option.pick && (
                <>
                  {" "}
                  <Chip bg={NB.accentSoft} ink={NB.accentDeep}>
                    recommended
                  </Chip>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// 04 — the runs panel's rail: what is going on without you, and the one job
// that finished.
const RUNS = [
  { action: "Implement", card: "#314", when: "1m ago", live: true },
  { action: "Implement", card: "#357", when: "2m ago", live: true },
  { action: "Refine", card: "#374", when: "4m ago", live: true },
  { action: "Review", card: "#378", when: "landed", live: false },
];

function Running() {
  return (
    <Section style={{ flex: 1, padding: em(14) }}>
      <Tag>runs</Tag>
      <ul
        style={{
          display: "flex",
          flexDirection: "column",
          gap: em(2),
          margin: `${em(8)} 0 0`,
          padding: 0,
          listStyle: "none",
        }}
      >
        {RUNS.map((run, i) => (
          <li
            key={run.card}
            style={{
              display: "flex",
              alignItems: "center",
              gap: em(9),
              padding: `${em(7)} 0`,
              borderTop: i === 0 ? undefined : `1px solid ${HAIR}`,
            }}
          >
            <span
              className={run.live ? "hf-pulse" : undefined}
              style={
                {
                  width: em(7),
                  height: em(7),
                  flex: "0 0 auto",
                  borderRadius: "50%",
                  background: run.live ? NB.accent : NB.mint,
                  "--pd": `${i * 0.26}s`,
                } as CSSProperties
              }
            />
            <span style={{ fontSize: em(13), fontWeight: 700 }}>
              {run.action}
            </span>
            <span
              style={{ fontSize: em(13), fontWeight: 800, color: NB.accentDeep }}
            >
              {run.card}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: em(11),
                color: NB.inkSoft,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {run.when}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const STAGES = [<Idea key="idea" />, <Plan key="plan" />, <Decision key="decision" />, <Running key="running" />];

export function HeroFlow({ c }: { c: HomeCopy["hero"] }) {
  return (
    // The drawings are decoration; the sequence they spell out is the content,
    // so it is said once here rather than four times by four prints.
    <figure className="m-0">
      <style>{MOTION}</style>
      <figcaption className="sr-only">{c.flowAlt}</figcaption>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
        {c.flow.map((label, i) => (
          <Stage key={label} step={`0${i + 1}`} label={label}>
            {STAGES[i]}
          </Stage>
        ))}
      </div>
    </figure>
  );
}
