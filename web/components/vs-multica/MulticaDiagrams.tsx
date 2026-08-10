import {
  BottomCaption,
  Board,
  BOX,
  BrandImage,
  Head,
  LINE,
  March,
  MUT,
  OursBlock,
  PAPER,
  Person,
  Robot,
  TheirsBlock,
  TopCaption,
  VsDiagram,
} from "@/components/vs/diagram";
import type { VsMulticaCopy } from "@/i18n/vs-multica/types";

// Same three objects on both sides — you, the product, and what it hands back —
// so the only thing left to compare is the third one.
//
// Ours hands back a board that moves on its own. There is no agent in it. That
// is the claim, not an omission: AI4Kanban runs on agents, but you never stand
// one up, name one, or hand one a task, so an agent is no more a thing you see
// here than a thread is.
//
// Theirs hands back the agents themselves — on the same rectangle, in the same
// three slots. Multica ships the plant; the staff are yours to hire, so two
// slots are filled, the third is an agent-shaped hole, and every run walks back
// out to the person.

// Ours: you say what you want, the board does the rest.
export function KanbanHeroDiagram({ c }: { c: VsMulticaCopy["hero"] }) {
  return (
    <VsDiagram alt={c.oursDiagramAlt}>
      <TopCaption ours>{c.oursDiagramTop}</TopCaption>

      <Person />
      <March d="M56 52 H68" />
      <Head x={68} />

      <OursBlock x={86} y={34} />

      {/* the board is the product's own surface, so this arrow is solid */}
      <path d="M126 52 H150" fill="none" stroke={LINE} strokeWidth="1.4" />
      <Head x={150} />
      <Board />

      <BottomCaption>{c.oursDiagramBottom}</BottomCaption>
    </VsDiagram>
  );
}

// Theirs: you create every agent, then you are the one running them.
export function MulticaHeroDiagram({ c }: { c: VsMulticaCopy["hero"] }) {
  const bays = [
    { x: 161, staffed: true },
    { x: 199, staffed: true },
    { x: 237, staffed: false },
  ];

  return (
    <VsDiagram alt={c.theirsDiagramAlt}>
      <TopCaption>{c.theirsDiagramTop}</TopCaption>

      <Person />
      <March d="M56 52 H68" />
      <Head x={68} />

      <TheirsBlock x={86} y={34}>
        <BrandImage href="/multica-logo.svg" cx={104} cy={52} size={19} />
      </TheirsBlock>

      {/* ours draws this solid; here it marches, because work is handed out to
          a floor that has to be staffed before it can take any */}
      <March d="M126 52 H150" />
      <Head x={150} />

      {/* the floor: our board's rectangle to the pixel */}
      <rect
        x="156"
        y="29"
        width="120"
        height="46"
        rx="6"
        fill={PAPER}
        stroke={MUT}
        strokeWidth="1.4"
      />
      {bays.map(({ x, staffed }, index) => {
        const mid = x + 17;
        return staffed ? (
          <g key={x}>
            <rect x={x} y="34" width="34" height="36" rx="4" fill={BOX} />
            <Robot cx={mid} cy={48.5} s={1.75} />
            {/* the light you watch it by */}
            <circle
              className="vsd-blip"
              style={{ animationDelay: `${index * 0.6}s` }}
              cx={mid}
              cy="63.5"
              r="2.6"
              fill={MUT}
            />
          </g>
        ) : (
          <g key={x}>
            <rect
              x={x}
              y="34"
              width="34"
              height="36"
              rx="4"
              fill="none"
              stroke={LINE}
              strokeWidth="1.2"
              strokeDasharray="4 3"
            />
            <Robot cx={mid} cy={48.5} s={1.75} ghost />
            {/* where the light would be, once you have made the agent, cut to
                the light's own diameter so it stays a separate mark instead of
                growing out of the hollow head above it */}
            <path
              d={`M${mid} 60.9 v5.2 M${mid - 2.6} 63.5 h5.2`}
              fill="none"
              stroke={LINE}
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </g>
        );
      })}

      {/* and back out to you: a finished, blocked, or failed run has nowhere
          else to go, and the next move is the person's every time. It leaves
          from the gap between two bays, not from under one of them — what comes
          back is the floor's output, not one agent's. */}
      <March d="M197 75 V94 H40 V72" w={1.3} />
      <Head x={40} y={72} dir="up" />

      <BottomCaption>{c.theirsDiagramBottom}</BottomCaption>
    </VsDiagram>
  );
}
