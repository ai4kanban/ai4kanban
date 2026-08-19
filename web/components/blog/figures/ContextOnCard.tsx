import type { IconType } from "react-icons";
import {
  FiFileText,
  FiList,
  FiMessageSquare,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import {
  CARD_HEADER_H,
  Connector,
  Figure,
  Panel,
  TaskCard,
  toward,
} from "./kit";

// "A Kanban board can provide that structure by keeping planning information
// attached to the work it affects."
//
// The same card in both panels, at the same x and the same top edge. On the
// left the planning context is real but loose — a scrap per place it actually
// lives, tilted, with the connector leaving the card and stopping in the air.
// A line that goes nowhere is the whole of the left-hand claim: the context
// exists, and nothing links it to the work.
//
// On the right the card has grown downward and the scraps are its fields. The
// growth is the argument, which is the one thing a pair is allowed to change
// between its panels; everything else about the card is identical.
//
// The right-hand rows carry words and the left-hand scraps carry words, because
// here *which* context it is, is the point — unlike `PlanningLoad`, where the
// count was. A panel is ~320px wide at every viewport, so 8.8px in a 300-unit
// viewBox is 8.8px on the reader's screen.

const CARD = { x: 58, y: 14, w: 184 };
// The left panel's card is the header and nothing else — it holds no context,
// which is what that panel is about.
const ANCHOR = [CARD.x + CARD.w / 2, CARD.y + CARD_HEADER_H + 3] as const;
const HEIGHT = 196;

// Where planning context actually sits when nothing is holding it.
//
// On a tidy grid, not a heap: two rows on shared baselines, the top row parted
// so nothing stands under the card and the stubs have clear air to stop in. The
// scatter is carried by the tilt and by the links that go nowhere; letting the
// scraps drift as well made a mess and read as *this drawing* being disordered
// rather than the thing it is drawing. A degree or two each, alternating, is
// the whole of it.
const SCRAPS: {
  icon: IconType;
  label: string;
  x: number;
  y: number;
  w: number;
  rotate: number;
}[] = [
  { icon: FiMessageSquare, label: "chat", x: 24, y: 104, w: 66, rotate: -2.5 },
  { icon: FiFileText, label: "docs", x: 210, y: 104, w: 64, rotate: 2.5 },
  { icon: FiList, label: "trackers", x: 17, y: 150, w: 78, rotate: 2 },
  { icon: FiUsers, label: "meetings", x: 107, y: 150, w: 82, rotate: -2 },
  { icon: FiUser, label: "one person", x: 201, y: 150, w: 82, rotate: 2 },
];

const SCRAP_H = 26;
// How far a link gets before it stops. One length for all five, so the fan
// reads as five reaches of equal effort — and short enough that none of them
// lands on the scrap it was reaching for and looks connected after all.
const STUB = 30;

// What the card holds once the context is on it — the board's own fields, in
// the order the post lists them.
const FIELDS = [
  "Scope",
  "Requirements",
  "Dependencies",
  "Open questions",
  "Decisions",
  "Progress",
];

// The rule under the header, and the rows below it. The card is then as tall as
// what it holds plus its own margin, rather than a height picked by eye — which
// is what left the last row sitting on the card's bottom edge.
const RULE = CARD.y + CARD_HEADER_H - 6;
const ROW = { top: RULE + 16, pitch: 18, bar: 46 };
const CARD_H = ROW.top + (FIELDS.length - 1) * ROW.pitch + 10 - CARD.y;

function Scattered() {
  return (
    <>
      {/* A stub per scrap: the link leaves the card and stops. Nothing about
          the context is wrong — it is simply not attached to anything. */}
      {SCRAPS.map((s) => {
        const to = [s.x + s.w / 2, s.y + SCRAP_H / 2] as const;
        return (
          <Connector key={s.label} from={ANCHOR} to={toward(ANCHOR, to, STUB)} />
        );
      })}

      <TaskCard {...CARD} h={CARD_HEADER_H} id="#128" bars={[132, 88]} />
      <circle cx={ANCHOR[0]} cy={ANCHOR[1]} r={3} className="fill-accent" />

      {SCRAPS.map((s) => {
        const Icon = s.icon;
        const cx = s.x + s.w / 2;
        const cy = s.y + SCRAP_H / 2;
        return (
          <g key={s.label} transform={`rotate(${s.rotate} ${cx} ${cy})`}>
            <rect
              x={s.x}
              y={s.y}
              width={s.w}
              height={SCRAP_H}
              rx={6}
              className="fill-code stroke-muted"
              strokeWidth={1}
              opacity={0.95}
            />
            <Icon
              x={s.x + 9}
              y={cy - 6}
              size={12}
              color="var(--color-muted)"
              aria-hidden="true"
            />
            <text
              x={s.x + 26}
              y={cy + 3.2}
              className="fill-muted font-sans"
              fontSize={8.8}
            >
              {s.label}
            </text>
          </g>
        );
      })}
    </>
  );
}

function Attached() {
  return (
    <TaskCard {...CARD} h={CARD_H} id="#128" bars={[132, 88]}>
      <path
        d={`M${CARD.x} ${RULE} H${CARD.x + CARD.w}`}
        className="stroke-border"
        strokeWidth={1}
        opacity={0.18}
      />
      {FIELDS.map((field, i) => {
        const cy = ROW.top + i * ROW.pitch;
        return (
          <g key={field}>
            <rect
              x={CARD.x + 12}
              y={cy - 2.5}
              width={5}
              height={5}
              rx={1.5}
              className="fill-accent"
            />
            <text
              x={CARD.x + 24}
              y={cy + 3.2}
              className="fill-ink font-sans"
              fontSize={8.8}
            >
              {field}
            </text>
            <rect
              x={CARD.x + CARD.w - 12 - ROW.bar}
              y={cy - 2.5}
              width={ROW.bar}
              height={5}
              rx={2.5}
              className="fill-border"
              opacity={0.17}
            />
          </g>
        );
      })}
    </TaskCard>
  );
}

export function ContextOnCard() {
  return (
    <Figure
      wash="peachEmber"
      caption="The same task, twice. Scattered across chat, meetings, documents and trackers, its planning context has to be found and reassembled before the next decision. Recorded on the card, it is already where the work is — and it is still there the next time anything touches it."
    >
      <Panel
        title="Context spread across tools"
        alt="A task card with dashed connectors that leave it and stop short of loose notes labelled chat, meetings, docs, trackers and one person"
        height={HEIGHT}
      >
        <Scattered />
      </Panel>
      <Panel
        title="Context kept on the card"
        alt="The same task card, grown to hold rows for scope, requirements, dependencies, open questions, decisions and progress"
        height={HEIGHT}
      >
        <Attached />
      </Panel>
    </Figure>
  );
}
