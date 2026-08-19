import type { IconType } from "react-icons";
import {
  FiAlertTriangle,
  FiCheckSquare,
  FiClock,
  FiCode,
  FiFileText,
  FiFlag,
  FiGitBranch,
  FiMessageSquare,
  FiTarget,
} from "react-icons/fi";
import {
  CARD_HEADER_H,
  Connector,
  Figure,
  Panel,
  PANEL_W,
  TaskCard,
} from "./kit";

// "Planning becomes harder as a product matures."
//
// The same proposal, in the same place, at the same size in both panels — and
// underneath it, everything that proposal has to be reconciled with before it
// can be scoped. On a first version that is a goal and a short set of
// assumptions. After a few releases it is eight standing things, and the fan of
// connectors crosses itself.
//
// The count is the argument, so the tiles carry glyphs and no words: eight
// labels at this size would be eight things to read in a picture whose subject
// is *how many there are*. The caption names them once, in prose, at the size
// prose is set in — and each tile carries its own `<title>` for anyone reading
// the drawing rather than the page.

const CARD = { x: 100, y: 14, w: 100, h: CARD_HEADER_H };
const ANCHOR = [CARD.x + CARD.w / 2, CARD.y + CARD.h + 3] as const;

const TILE = 28;
const GLYPH = 14;
const TILE_Y = 142;
const HEIGHT = 182;

type PanelSpec = {
  title: string;
  alt: string;
  gap: number;
  tiles: { icon: IconType; name: string }[];
};

const PANELS: PanelSpec[] = [
  {
    title: "Version 1",
    alt: "A proposal card with two dashed connectors, to a goal and a short specification",
    gap: 8,
    tiles: [
      { icon: FiTarget, name: "The goal" },
      { icon: FiFileText, name: "A short set of assumptions" },
    ],
  },
  {
    title: "After several releases",
    alt: "The same proposal card, now with eight dashed connectors fanning out to existing behaviour, constraints, feedback, priorities, dependencies, work in progress, and acceptance criteria",
    gap: 6,
    tiles: [
      { icon: FiTarget, name: "The goal" },
      { icon: FiCode, name: "Existing behaviour" },
      { icon: FiAlertTriangle, name: "Technical constraints" },
      { icon: FiMessageSquare, name: "User feedback" },
      { icon: FiFlag, name: "Current priorities" },
      { icon: FiGitBranch, name: "Dependencies" },
      { icon: FiClock, name: "Work already in progress" },
      { icon: FiCheckSquare, name: "Acceptance criteria" },
    ],
  },
];

export function PlanningLoad() {
  return (
    <Figure
      wash="skyLilac"
      caption="Each proposal has to be reconciled with what already exists: the goal, current behaviour, technical constraints, user feedback, priorities, dependencies, work already in progress, and what counts as done. That list grows with every release; the proposal does not."
    >
      {PANELS.map((panel) => {
        const row = panel.tiles.length * TILE + (panel.tiles.length - 1) * panel.gap;
        const x0 = (PANEL_W - row) / 2;
        return (
          <Panel
            key={panel.title}
            title={panel.title}
            alt={panel.alt}
            height={HEIGHT}
          >
            {panel.tiles.map((tile, i) => {
              const x = x0 + i * (TILE + panel.gap);
              return (
                <Connector
                  key={tile.name}
                  from={ANCHOR}
                  to={[x + TILE / 2, TILE_Y]}
                />
              );
            })}

            <TaskCard {...CARD} id="#128" bars={[76, 48]} />
            <circle cx={ANCHOR[0]} cy={ANCHOR[1]} r={3} className="fill-accent" />

            {panel.tiles.map((tile, i) => {
              const x = x0 + i * (TILE + panel.gap);
              const Icon = tile.icon;
              return (
                <g key={tile.name}>
                  <title>{tile.name}</title>
                  <rect
                    x={x}
                    y={TILE_Y}
                    width={TILE}
                    height={TILE}
                    rx={7}
                    className="fill-code"
                  />
                  <Icon
                    x={x + (TILE - GLYPH) / 2}
                    y={TILE_Y + (TILE - GLYPH) / 2}
                    size={GLYPH}
                    color="var(--color-muted)"
                    aria-hidden="true"
                  />
                </g>
              );
            })}
          </Panel>
        );
      })}
    </Figure>
  );
}
