import {
  BottomCaption,
  BOX,
  BrandImage,
  Head,
  KEY,
  LINE,
  March,
  MUT,
  OursBlock,
  PAPER,
  Robot,
  TheirsBlock,
  TopCaption,
  VsDiagram,
} from "@/components/vs/diagram";
import type { VsVibeCopy } from "@/i18n/vs-vibe-kanban/types";

// The two products sit at different points on the same timeline, and the pair
// is drawn so you can see where one stops and the other starts.
//
// Ours is the board before anything runs: one card crossing three columns and
// getting more definite in each, until the last one says what "done" means.
// Theirs is what happens after: the same task given to several agents at once,
// and several versions of the work coming back to be compared.
//
// Theirs is the only side with robots on it, and it has three, which is the
// difference stated in objects rather than in words.

// Ours: get the work definite enough to build.
export function KanbanHeroDiagram({ c }: { c: VsVibeCopy["hero"] }) {
  // The card gains a line per column, and the last one gains a tick. That
  // progression — a title, then detail, then what "done" means — is the whole
  // drawing, so the columns themselves aren't boxed: three cards of growing
  // height say it, and column dividers would only add furniture.
  const cards = [
    { x: 110, rows: 1 },
    { x: 167, rows: 2 },
    { x: 224, rows: 3 },
  ];

  return (
    <VsDiagram alt={c.oursDiagramAlt}>
      <TopCaption ours>{c.oursDiagramTop}</TopCaption>

      <OursBlock x={24} y={42} />
      <March d="M64 60 H78" w={1.3} />
      <Head x={78} y={60} />

      <rect
        x="96"
        y="30"
        width="180"
        height="60"
        rx="6"
        fill={PAPER}
        stroke={MUT}
        strokeWidth="1.4"
      />
      {/* the same card, three times, three states */}
      {cards.map(({ x, rows }) => {
        const ready = rows === 3;
        return (
          <g key={x}>
            <rect
              x={x}
              y="40"
              width="42"
              height={14 + rows * 7}
              rx="4"
              fill={BOX}
              stroke={ready ? KEY : MUT}
              strokeWidth={ready ? 1.4 : 1}
            />
            <rect x={x + 6} y="46" width="16" height="2.5" rx="1.25" fill={MUT} />
            {Array.from({ length: rows }, (_, i) => {
              // the last row of the finished card is what "done" means, so it
              // is a tick rather than one more line of description
              const tick = ready && i === rows - 1;
              return (
                <g key={i}>
                  {tick && (
                    <path
                      d={`M${x + 6} ${54 + i * 7} l2.2 2.2 l4.4 -4.8`}
                      fill="none"
                      stroke={KEY}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  <rect
                    x={x + (tick ? 16 : 6)}
                    y={53 + i * 7}
                    width={tick ? 20 : 30}
                    height="2.5"
                    rx="1.25"
                    fill={LINE}
                  />
                </g>
              );
            })}
          </g>
        );
      })}

      <BottomCaption>{c.oursDiagramBottom}</BottomCaption>
    </VsDiagram>
  );
}

// Theirs: one task, several agents at once, several versions back.
export function VibeHeroDiagram({ c }: { c: VsVibeCopy["hero"] }) {
  const attempts = [20, 47, 74];

  return (
    <VsDiagram alt={c.theirsDiagramAlt}>
      <TopCaption>{c.theirsDiagramTop}</TopCaption>

      {/* the task, already defined — this side starts where ours stops */}
      <rect
        x="24"
        y="46"
        width="44"
        height="28"
        rx="4"
        fill={BOX}
        stroke={LINE}
        strokeWidth="1.2"
      />
      <rect x="31" y="54" width="18" height="2.5" rx="1.25" fill={LINE} />
      <rect x="31" y="61" width="30" height="6" rx="2" fill={PAPER} stroke={MUT} strokeWidth="1" />

      <March d="M74 60 H86" w={1.3} />
      <Head x={86} y={60} />

      <TheirsBlock x={96} y={42}>
        <BrandImage href="/vibe-kanban-logo.png" cx={114} cy={60} size={20} />
      </TheirsBlock>

      {/* three at once */}
      <path d="M154 31 V85" fill="none" stroke={LINE} strokeWidth="1.3" />
      <March d="M134 60 H154" w={1.3} />
      {attempts.map((y) => (
        <g key={y}>
          <March d={`M154 ${y + 11} H166`} w={1.3} />
          <Head x={166} y={y + 11} />
        </g>
      ))}

      {/* and three versions of the same work to compare */}
      {attempts.map((y, index) => (
        <g key={y}>
          <rect x="172" y={y} width="104" height="22" rx="5" fill={BOX} />
          <Robot cx={185} cy={y + 11} s={1.35} />
          {[0, 1, 2].map((row) => (
            <rect
              key={row}
              x={200 + (row === 1 ? 6 : 0)}
              y={y + 5 + row * 6}
              width={[68, 44, 56][(row + index) % 3]}
              height="2.6"
              rx="1.3"
              fill={LINE}
            />
          ))}
        </g>
      ))}

      <BottomCaption>{c.theirsDiagramBottom}</BottomCaption>
    </VsDiagram>
  );
}
