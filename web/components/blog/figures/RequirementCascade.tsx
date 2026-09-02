import { Connector, Figure, Panel, TaskCard } from "./kit";

const HEIGHT = 190;
const ROOT = { x: 72, y: 18, w: 156, h: 56, id: "IDEA", bars: [112, 74] };
const CHILDREN = [
  { x: 12, y: 118, id: "#1", bars: [45] },
  { x: 83, y: 118, id: "#2", bars: [44] },
  { x: 154, y: 118, id: "#3", bars: [47] },
  { x: 225, y: 118, id: "#4", bars: [42] },
];

function RootCard() {
  return <TaskCard {...ROOT} />;
}

const CAPTION =
  "One request becomes a task graph: scoped cards with boundaries the agent can work independently and relationships the project can coordinate.";

export function RequirementCascade({ caption = CAPTION }: { caption?: string }) {
  return (
    <Figure wash="skyLilac" caption={caption}>
      <Panel
        title="One specification"
        alt="One large card containing a rough product request"
        height={HEIGHT}
      >
        <RootCard />
        <path d="M150 88 V158" className="stroke-muted" strokeWidth={1.2} strokeDasharray="4 3" />
        <text x={150} y={176} textAnchor="middle" className="fill-muted font-sans" fontSize={9}>
          What does done mean?
        </text>
      </Panel>
      <Panel
        title="A coordinated task graph"
        alt="The same request card branching into four smaller executable task cards"
        height={HEIGHT}
      >
        <RootCard />
        {CHILDREN.map((card) => {
          const to = [card.x + 30, card.y] as const;
          return <Connector key={card.id} from={[150, 76]} to={to} />;
        })}
        {CHILDREN.map((card) => (
          <TaskCard key={card.id} {...card} w={60} h={54} />
        ))}
      </Panel>
    </Figure>
  );
}
