import { FiChevronRight, FiTarget } from "react-icons/fi";
import { printFrame } from "@/components/home/Mat";
import { Figure, Panel, PANEL_W } from "./kit";

// "Loop engineering structures the cycle an agent repeats. Graph engineering
// coordinates multiple agents or steps. Both address how work runs; neither
// determines which requirements matter."
//
// Three layers, weighted the way the post is. The two ideas it credits and
// moves past get one small print each — a shape and a single line of type,
// because they are being named, not explained. The layer it is about gets the
// wide print underneath and is the only one drawn in any detail.
//
// That bottom print is HTML rather than SVG, for the reason `BottleneckShift`
// is: a board is boxes with words in them, and boxes with words in them reflow.
// A 300-unit viewBox stretched across the full mat would land its labels at
// twice their size on a laptop and half of it on a phone.

const MINI_H = 112;

/** A point on a ring, measured clockwise from the top. */
function on(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;
}

// An arrowhead pointing along `deg`, which for a point on a ring is the same
// number as the point's own angle: the clockwise tangent there.
function Head({ at, deg }: { at: readonly [number, number]; deg: number }) {
  return (
    <path
      d="M-3.5 -3.5 L3 0 L-3.5 3.5 Z"
      className="fill-muted"
      opacity={0.7}
      transform={`translate(${at[0]} ${at[1]}) rotate(${deg})`}
    />
  );
}

function Node({ at }: { at: readonly [number, number] }) {
  return (
    <circle
      cx={at[0]}
      cy={at[1]}
      r={7}
      className="fill-code stroke-muted"
      strokeWidth={1}
    />
  );
}

function Legend({ children }: { children: string }) {
  return (
    <text
      x={PANEL_W / 2}
      y={100}
      textAnchor="middle"
      className="fill-muted font-sans"
      fontSize={9}
    >
      {children}
    </text>
  );
}

const RING = { cx: PANEL_W / 2, cy: 46, r: 28 };

function Loop() {
  return (
    <>
      <circle
        cx={RING.cx}
        cy={RING.cy}
        r={RING.r}
        fill="none"
        className="stroke-border"
        strokeWidth={1.2}
        opacity={0.25}
      />
      {[60, 180, 300].map((d) => (
        <Head key={d} at={on(RING.cx, RING.cy, RING.r, d)} deg={d} />
      ))}
      {[0, 120, 240].map((d) => (
        <Node key={d} at={on(RING.cx, RING.cy, RING.r, d)} />
      ))}
      <Legend>one agent&rsquo;s cycle, run and checked again</Legend>
    </>
  );
}

const DAG = [
  [PANEL_W / 2, 16],
  [PANEL_W / 2 - 40, 46],
  [PANEL_W / 2 + 40, 46],
  [PANEL_W / 2, 78],
] as const;
const EDGES = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
] as const;

function Graph() {
  return (
    <>
      {EDGES.map(([a, b]) => {
        const [fx, fy] = DAG[a];
        const [tx, ty] = DAG[b];
        const len = Math.hypot(tx - fx, ty - fy);
        const [ux, uy] = [(tx - fx) / len, (ty - fy) / len];
        const p1 = [tx - ux * 12, ty - uy * 12] as const;
        return (
          <g key={`${a}-${b}`}>
            <path
              d={`M${fx + ux * 9} ${fy + uy * 9} L${p1[0]} ${p1[1]}`}
              className="stroke-border"
              strokeWidth={1.2}
              opacity={0.25}
            />
            <Head at={p1} deg={(Math.atan2(uy, ux) * 180) / Math.PI} />
          </g>
        );
      })}
      {DAG.map((at) => (
        <Node key={`${at[0]}-${at[1]}`} at={at} />
      ))}
      <Legend>several agents, in an order</Legend>
    </>
  );
}

// The board. Column names rather than planning stages: this print has to read
// as *a kanban board* on sight, and what makes it the planning layer is the two
// things a tracker does not have — the goal the columns serve, and the memory
// they leave behind.
const COLUMNS = [
  { name: "Next", cards: [[92, 58], [78, 0]] },
  { name: "Doing", cards: [[86, 52]] },
  { name: "Done", cards: [[80, 0]] },
];

function MiniCard({ bars }: { bars: number[] }) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-elev px-1.5 py-1.5">
      {bars
        .filter((w) => w > 0)
        .map((w, i) => (
          <div
            key={i}
            className="h-1 rounded-full bg-code"
            style={{ width: `${w}%` }}
          />
        ))}
    </div>
  );
}

function BoardPrint() {
  return (
    <div className={`${printFrame} bg-elev px-3 py-3 sm:px-4`}>
      <p className="mb-2.5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">
        Kanban engineering
      </p>

      <div className="flex items-stretch gap-1.5 sm:gap-2">
        <div className="flex shrink-0 flex-col items-center gap-1 self-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-deep text-elev">
            <FiTarget size={14} aria-hidden="true" />
          </span>
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.08em] text-muted">
            Goal
          </span>
        </div>

        <FiChevronRight
          className="shrink-0 self-center text-muted"
          size={14}
          aria-hidden="true"
        />

        <div className="flex flex-1 items-stretch gap-1.5 rounded-lg border border-border p-1.5">
          {COLUMNS.map((column) => (
            <div
              key={column.name}
              className="min-w-0 flex-1 rounded-md bg-band p-1.5"
            >
              <p className="mb-1.5 font-mono text-[0.55rem] uppercase tracking-[0.08em] text-muted">
                {column.name}
              </p>
              <div className="space-y-1.5">
                {column.cards.map((bars, i) => (
                  <MiniCard key={i} bars={bars} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What the board sends back to the goal it started from. */}
      <svg
        viewBox="0 0 300 12"
        className="mt-2 block h-3 w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M10 6 H294"
          className="stroke-muted"
          strokeWidth={1.2}
          strokeDasharray="4 3"
          strokeLinecap="round"
          opacity={0.55}
        />
        <path d="M13 2 L5 6 L13 10 Z" className="fill-muted" opacity={0.7} />
      </svg>
      <p className="mt-1 text-center text-[0.62rem] leading-snug text-muted">
        memory: decisions, rejected ideas, and what shipped
      </p>
    </div>
  );
}

export function ThreeLayers() {
  return (
    <Figure
      single
      wash="mintSky"
      caption="Loop engineering runs one agent's cycle; graph engineering puts several of them in an order. Both describe how the work runs. Neither says which work should exist — that is decided above them, against a goal, and remembered afterwards."
    >
      <div className="space-y-3 sm:space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <Panel
            title="Loop engineering"
            alt="Three nodes on a ring with arrows running clockwise between them"
            height={MINI_H}
          >
            <Loop />
          </Panel>
          <Panel
            title="Graph engineering"
            alt="Four nodes joined by arrows that branch from one node and converge on another"
            height={MINI_H}
          >
            <Graph />
          </Panel>
        </div>
        <BoardPrint />
      </div>
    </Figure>
  );
}
