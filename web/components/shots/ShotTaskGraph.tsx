import { FiCheckCircle, FiChevronRight, FiTag } from "react-icons/fi";
import {
  CROP,
  Chip,
  ChipIcon,
  HAIR,
  MetaItem,
  NB,
  Section,
  Shot,
  Tag,
  Todos,
  em,
} from "./nb";

// Step 01 明确任务与依赖 — a group card: what the agent decided to build next,
// and the subtasks it split the goal into, with the dependencies that decide
// what can run in parallel. Mirrors kanban-ui/components/CardPage.tsx and its
// subtask map, with card #311's real content (screenshots/card-group.jpg).
//
// The toolbar and the RELATED row of the real card are left off: the crop has
// room for the head, the meta band and the map, and the map is what this step
// is about.

const SUBTASKS = [
  { id: 314, title: "Build the Cloud control plane for team workspaces", total: 16 },
  { id: 315, title: "Store the shared board in Cloud without moving the codebase", total: 9 },
  { id: 316, title: "Use Cloud boards safely from the app and CLI", total: 13 },
  { id: 317, title: "Lead onboarding with Local and make Cloud an explicit choice", total: 13 },
  { id: 328, title: "Notify a workspace's owners and members about a card", total: 6 },
];

/** A node on the subtask map: the ink-framed `#nn` pill of the real graph.
 *
 *  The type sits on an inner span. A length in `em` resolves against the
 *  element's OWN font-size, so setting one on the positioned box would scale
 *  its coordinates by the chip's type size and slide every node off the arrows
 *  drawn under it. */
function MapChip({ id, left, top }: { id: number; left: number; top: number }) {
  return (
    <span
      style={{
        position: "absolute",
        left: em(left),
        top: em(top),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: em(CHIP_W),
        height: em(26),
        border: `${em(1.5)} solid ${NB.ink}`,
        borderRadius: em(9),
        background: NB.paper,
        boxShadow: `${em(2)} ${em(2)} 0 0 ${NB.ink}`,
      }}
    >
      <span style={{ color: NB.accentDeep, fontSize: em(12.5), fontWeight: 800 }}>
        #{id}
      </span>
    </span>
  );
}

// The map's geometry, in the design px every length in these shots is written
// in. The SVG is sized in the same unit and its viewBox matches that size, so
// one unit is one design px and the arrows meet the chips drawn over them —
// a percentage box would scale its x axis against the container instead and
// pull every arrow off its node.
const COL = [0, 172, 344, 516]; // the section is ~599 design px wide
const CHIP_W = 66;
const MAP_W = COL[3] + CHIP_W;
const MAP_H = 92;
const ROW1 = 11; // chip top; centre is ROW1 + 13
const ROW2 = 52;

export function ShotTaskGraph() {
  return (
    <Shot crop={CROP}>
      <div style={{ padding: em(20) }}>
        {/* head — the mark, then the goal in words */}
        <div style={{ marginBottom: em(22) }}>
          <Chip
            bg={NB.mintSoft}
            ink={NB.mintInk}
            icon={
              <ChipIcon>
                <FiCheckCircle style={{ width: "100%", height: "100%" }} />
              </ChipIcon>
            }
          >
            Ready to implement
          </Chip>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              columnGap: em(10),
              marginTop: em(10),
            }}
          >
            <span
              style={{
                fontSize: em(20),
                fontWeight: 800,
                lineHeight: 1.15,
                color: NB.accentDeep,
              }}
            >
              #311
            </span>
            <h1
              style={{
                margin: 0,
                flex: "1 1 0",
                minWidth: 0,
                fontSize: em(20),
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              Bring team collaboration to AI4Kanban Cloud
            </h1>
          </div>
        </div>

        {/* meta band — where the card sits and how it was ranked */}
        <Section
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            columnGap: em(24),
            rowGap: em(12),
            padding: `${em(12)} ${em(16)}`,
            marginBottom: em(14),
          }}
        >
          <MetaItem label="Track">
            <Chip bg={NB.lilacSoft} ink={NB.lilacInk}>
              features
            </Chip>
          </MetaItem>
          <MetaItem label="Modules">
            <Chip bg={NB.mintSoft} ink={NB.mintInk}>
              cloud
            </Chip>
            <Chip bg={NB.mintSoft} ink={NB.mintInk}>
              local-ui
            </Chip>
          </MetaItem>
          <MetaItem label="Release">
            <Chip
              bg={NB.skySoft}
              ink={NB.skyInk}
              chevron
              icon={
                <ChipIcon>
                  <FiTag style={{ width: "100%", height: "100%" }} />
                </ChipIcon>
              }
            >
              0.9.0
            </Chip>
          </MetaItem>
          <MetaItem label="Priority">
            <Chip bg={NB.peachSoft} ink={NB.peachInk} chevron>
              high
            </Chip>
          </MetaItem>
          <MetaItem label="Todos">
            <Todos done={3} total={8} width={70} />
          </MetaItem>
        </Section>

        {/* subtasks — the map first, then the cards it stands for */}
        <Section style={{ padding: em(14) }}>
          <div style={{ marginBottom: em(10) }}>
            <Tag>subtasks</Tag>
          </div>

          <div
            style={{
              position: "relative",
              height: em(MAP_H),
              borderBottom: `1px solid ${HAIR}`,
            }}
          >
            <svg
              aria-hidden
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              style={{ position: "absolute", left: 0, top: 0, width: em(MAP_W), height: em(MAP_H) }}
            >
              <defs>
                <marker
                  id="subtask-arrow-shot"
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
              {/* #314 → #315 → #316, then #316 forks to #317 and #328 */}
              {[0, 1, 2].map((i) => (
                <path
                  key={i}
                  d={`M${COL[i] + CHIP_W + 4} ${ROW1 + 13} H${COL[i + 1] - 4}`}
                  fill="none"
                  stroke={NB.inkSoft}
                  strokeWidth="1.6"
                  markerEnd="url(#subtask-arrow-shot)"
                />
              ))}
              <path
                d={`M${COL[2] + CHIP_W + 4} ${ROW1 + 13} C${COL[3] - 50} ${ROW1 + 13} ${COL[3] - 70} ${ROW2 + 13} ${COL[3] - 4} ${ROW2 + 13}`}
                fill="none"
                stroke={NB.inkSoft}
                strokeWidth="1.6"
                markerEnd="url(#subtask-arrow-shot)"
              />
            </svg>
            <MapChip id={314} left={COL[0]} top={ROW1} />
            <MapChip id={315} left={COL[1]} top={ROW1} />
            <MapChip id={316} left={COL[2]} top={ROW1} />
            <MapChip id={317} left={COL[3]} top={ROW1} />
            <MapChip id={328} left={COL[3]} top={ROW2} />
          </div>

          <ul
            style={{
              display: "flex",
              flexDirection: "column",
              gap: em(4),
              margin: `${em(10)} 0 0`,
              padding: 0,
              listStyle: "none",
            }}
          >
            {SUBTASKS.map((task) => (
              <li
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: em(10),
                  padding: `${em(7)} ${em(8)}`,
                }}
              >
                <span style={{ flex: "0 0 auto", color: NB.accentDeep, fontSize: em(12), fontWeight: 800 }}>
                  #{task.id}
                </span>
                <span
                  style={{
                    minWidth: 0,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: em(13.5),
                    fontWeight: 700,
                  }}
                >
                  {task.title}
                </span>
                <Todos done={0} total={task.total} width={46} />
                <FiChevronRight aria-hidden style={{ flex: "0 0 auto", width: em(14), height: em(14), color: NB.inkSoft }} />
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </Shot>
  );
}
