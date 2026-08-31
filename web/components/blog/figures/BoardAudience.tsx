import { FiCpu, FiFileText, FiUser } from "react-icons/fi";
import { Connector, Figure, Panel, TaskCard } from "./kit";

const HEIGHT = 188;

function Person({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={18} className="fill-code stroke-muted" />
      <FiUser x={x - 8} y={y - 8} size={16} color="var(--color-muted)" aria-hidden="true" />
    </g>
  );
}

function Agent({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={18} className="fill-code stroke-muted" />
      <FiCpu x={x - 8} y={y - 8} size={16} color="var(--color-accent-deep)" aria-hidden="true" />
    </g>
  );
}

function Board({ x }: { x: number }) {
  return (
    <g>
      <TaskCard x={x} y={12} w={88} h={54} id="#12" bars={[58]} />
      <TaskCard x={x} y={70} w={88} h={54} id="#13" bars={[48]} />
      <TaskCard x={x} y={128} w={88} h={54} id="#14" bars={[62]} />
    </g>
  );
}

export function BoardAudience() {
  return (
    <Figure
      wash="peachEmber"
      caption="A traditional board asks a person to maintain the work. An AI kanban is maintained by agents; the person receives a compact brief only when direction or judgment is needed."
    >
      <Panel
        title="Board operated by a person"
        alt="A person connected directly to three task cards they must maintain"
        height={HEIGHT}
      >
        <Person x={46} y={94} />
        <Connector from={[66, 94]} to={[112, 94]} />
        <Board x={126} />
      </Panel>
      <Panel
        title="Board operated by agents"
        alt="An AI agent maintains task cards and sends one brief to a person"
        height={HEIGHT}
      >
        <Agent x={34} y={94} />
        <Connector from={[54, 94]} to={[78, 94]} />
        <Board x={84} />
        <Connector from={[174, 94]} to={[218, 94]} />
        <g>
          <rect x={222} y={57} width={66} height={74} rx={8} className="fill-elev stroke-border" strokeWidth={1.2} />
          <FiFileText x={231} y={68} size={13} color="var(--color-accent-deep)" aria-hidden="true" />
          <rect x={231} y={88} width={45} height={5} rx={2.5} className="fill-border" opacity={0.2} />
          <rect x={231} y={101} width={34} height={5} rx={2.5} className="fill-border" opacity={0.14} />
          <circle cx={255} cy={146} r={14} className="fill-code stroke-muted" />
          <FiUser x={249} y={140} size={12} color="var(--color-muted)" aria-hidden="true" />
        </g>
      </Panel>
    </Figure>
  );
}
