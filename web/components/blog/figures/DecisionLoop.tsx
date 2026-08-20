import { FiUser } from "react-icons/fi";
import { Chip, CHIP_H, Connector, Figure, Panel, chipWidth, toward } from "./kit";

// "In AI4Kanban, we are implementing this discipline as a five-stage loop."
//
// The list beside this figure already gives the five stages in order. What a
// list cannot say is that stage 5 feeds stage 2, so the ring is the whole
// reason the drawing exists: it is one closed line with five stops on it and no
// end, and the numbers are there so the prose and the picture can be read in
// either order.
//
// The person sits in the middle rather than on the ring. They are not a sixth
// stage; they are what two of the five reach for — the goal at the top, and the
// question in stage 3 that the board is not entitled to answer on its own.
//
// It is the one figure in the set that is a single print instead of a pair,
// because a loop has no other half. The print is capped at roughly a panel's
// width and centred on the mat so the ring renders at about 1:1 wherever it is
// read, which is the rule the pairs get from their column.

const RING = { cx: 150, cy: 124, r: 84 };
const HEIGHT = 218;
const PERSON_R = 18;

const STAGES = ["Goal", "Proposal", "Clarification", "Release", "Memory"];

/** A point on the ring, measured clockwise from the top. */
function on(deg: number) {
  const a = (deg * Math.PI) / 180;
  return [
    RING.cx + RING.r * Math.sin(a),
    RING.cy - RING.r * Math.cos(a),
  ] as const;
}

const STEP = 360 / STAGES.length;

// Where a person touches the ring: they state the goal, and they answer what
// clarification escalates.
const TOUCHES = [0, 2];

function Reach({ deg }: { deg: number }) {
  const at = on(deg);
  // The chip edge that faces the centre.
  const edge = [
    at[0],
    at[1] + Math.sign(RING.cy - at[1]) * (CHIP_H / 2),
  ] as const;
  return (
    <Connector
      from={toward([RING.cx, RING.cy], edge, PERSON_R + 2)}
      to={toward(edge, [RING.cx, RING.cy], 4)}
    />
  );
}

export function DecisionLoop() {
  return (
    <Figure
      single
      wash="skyLilac"
      caption="A person states the goal and answers the questions that need judgment; the board carries the rest of the pass. What the loop learns on the way round — accepted decisions, corrections, rejected ideas, shipped work — is what stage 5 keeps and what the next stage 2 starts from."
    >
      <div className="mx-auto max-w-[360px]">
        <Panel
          title="One pass of the loop"
          alt="Five stages on a ring — goal, proposal, clarification, release, memory — with arrows running clockwise back to the start, and a person in the centre linked to the goal and to clarification"
          height={HEIGHT}
        >
          <circle
            cx={RING.cx}
            cy={RING.cy}
            r={RING.r}
            fill="none"
            className="stroke-border"
            strokeWidth={1.2}
            opacity={0.25}
          />

          {/* One arrowhead between each pair of stages. At a point on a ring
              the clockwise tangent runs at the point's own angle, so the head
              is drawn pointing right and turned by that number. */}
          {STAGES.map((_, i) => {
            const deg = i * STEP + STEP / 2;
            const at = on(deg);
            return (
              <path
                key={deg}
                d="M-4 -4 L3.5 0 L-4 4 Z"
                className="fill-muted"
                opacity={0.7}
                transform={`translate(${at[0]} ${at[1]}) rotate(${deg})`}
              />
            );
          })}

          {TOUCHES.map((i) => (
            <Reach key={i} deg={i * STEP} />
          ))}

          <g>
            <title>A person</title>
            <circle
              cx={RING.cx}
              cy={RING.cy}
              r={PERSON_R}
              className="fill-code stroke-muted"
              strokeWidth={1}
            />
            <FiUser
              x={RING.cx - 8}
              y={RING.cy - 8}
              size={16}
              color="var(--color-muted)"
              aria-hidden="true"
            />
          </g>

          {STAGES.map((label, i) => {
            const at = on(i * STEP);
            return (
              <Chip
                key={label}
                x={at[0] - chipWidth(label, true) / 2}
                y={at[1] - CHIP_H / 2}
                label={label}
                lead={String(i + 1)}
              />
            );
          })}
        </Panel>
      </div>
    </Figure>
  );
}
