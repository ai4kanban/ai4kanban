import Image from "next/image";
import type { ReactNode } from "react";
import { FiChevronDown, FiPlus } from "react-icons/fi";
import { HAIR, NB, Shot, em } from "./nb";

// Step 06 一支协同的 agent 团队 — Configuration → Agents, mirroring
// kanban-ui/components/Agents.tsx and screenshots/configuration-agents.png.
//
// The pane is two things side by side, and drawing them as two equal columns
// (which this shot used to do) says the wrong one: the narrow column on the left
// is the WHOLE roster — always-on roles over switchable specialists, one under
// the other — and everything to the right of its rule is the page for the row
// that is selected. That is the argument the step makes: a team you read in one
// list, and each member set on its own page.
//
// Only the roster's own column is fixed; the page beside it fills the rest, and
// the instructions box inside it takes whatever the page's fixed rows leave —
// the same growth the real pane has, so the drawing bottoms out level.
//
// Static, unlike the other shots in the Loop. The one motion this pane could
// honestly show is a row being selected, and the page beside it would have to
// change with it; a wash sliding down a list while the page holds still draws a
// board that does not exist.

/** The roles that run the board. Four rows, no switch — these cannot be off. */
const ALWAYS: [art: string, label: string][] = [
  ["discussion-helper", "Discussion helper"],
  ["planner", "Planner"],
  ["builder", "Builder"],
  ["base", "Memory pruner"],
];

/** Everything that can be switched, in the pane's own order. `base` is the
 *  character an agent with no art of its own wears — the real pane draws its
 *  initial on a card it holds, which at 26px here would be four grey pixels. */
const SPECIALISTS: [art: string, label: string, on: boolean][] = [
  ["reviewer", "Reviewer", true],
  ["base", "Gater", false],
  ["base", "Decider", false],
  ["base", "Proposer", false],
  ["tech-stack-advisor", "Tech stack advisor", true],
  ["ui-designer", "UI designer", true],
];

/** `Agents.tsx`'s `Character` — pixel art, bottom-aligned in a square box. A
 *  paused agent keeps its character, greyed. */
function Character({
  art,
  size,
  off,
}: {
  art: string;
  size: number;
  off?: boolean;
}) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        width: em(size),
        height: em(size),
        flexShrink: 0,
        opacity: off ? 0.3 : 1,
        filter: off ? "grayscale(1)" : undefined,
      }}
    >
      <Image
        src={`/agent-art/${art}.png`}
        alt=""
        width={size * 2}
        height={size * 2}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          imageRendering: "pixelated",
        }}
      />
    </span>
  );
}

/** The On/Off pill a switchable row carries. The same shape twice, filled or
 *  not — two words of different lengths down a column read as ragged text. */
function State({ on }: { on: boolean }) {
  const F = 10.5;
  return (
    <span
      style={{
        flexShrink: 0,
        borderRadius: em(999, F),
        padding: `${em(2, F)} ${em(8, F)}`,
        fontSize: em(F),
        fontWeight: 700,
        lineHeight: 1.4,
        background: on ? NB.mintSoft : "rgba(36,35,31,0.06)",
        color: on ? NB.mintInk : NB.inkSoft,
      }}
    >
      {on ? "On" : "Off"}
    </span>
  );
}

/** One row of the roster: the character, the name, and — only where there is a
 *  state to read — whether it is on. `held` is the ember wash, which is the
 *  whole of which row the page belongs to. */
function PickRow({
  art,
  label,
  on,
  held,
}: {
  art: string;
  label: string;
  /** Omitted on a row that cannot be switched. */
  on?: boolean;
  held?: boolean;
}) {
  const off = on === false;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: em(8),
        borderRadius: em(9),
        padding: `${em(5)} ${em(10)}`,
        background: held ? NB.accentSoft : undefined,
      }}
    >
      <Character art={art} size={26} off={off} />
      <span
        style={{
          minWidth: 0,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: em(12.5),
          fontWeight: 700,
          color: off ? NB.inkSoft : NB.ink,
        }}
      >
        {label}
      </span>
      {on !== undefined && <State on={on} />}
    </div>
  );
}

/** A half of the roster under its own name. Sentence case and soft ink: the
 *  column is a list of agents, and a caption shouting over each half would
 *  compete with the names. */
function Roster({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: em(12),
          marginBottom: em(6),
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: em(12.5),
            fontWeight: 600,
            color: NB.inkSoft,
          }}
        >
          {title}
        </h4>
        {action}
      </div>
      {children}
    </section>
  );
}

/** `SettingRow` — the setting on the left, its control on the right. The real
 *  row carries a line of help under the label; here the control IS the answer,
 *  and a sentence explaining what a runtime is takes a whole line of a drawing
 *  to say what the words either side of it already say. */
function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: em(14),
      }}
    >
      <p
        style={{
          margin: 0,
          minWidth: 0,
          fontSize: em(13.5),
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {label}
      </p>
      {/* Wide enough for the whole of what the runtime resolves to — the model
          is half the answer, and "Codex · gpt-6-a…" gives the wrong one. */}
      <div style={{ width: em(176), flexShrink: 0 }}>{children}</div>
    </div>
  );
}

export function ShotAgentTeam() {
  const F = 12.5;
  return (
    <Shot>
      <div style={{ padding: em(18) }}>
        {/* No title. The drawing opens on the roster, which is what the pane is
            — naming the pane over it only repeats the step's own heading beside
            it. */}
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: em(16),
          }}
        >
          {/* The whole roster in one narrow column, split the way the two halves
              are answered: who runs this board and cannot be switched off, then
              everything that can be. */}
          <div
            style={{
              // Wide enough for the longest name the board ships beside its
              // pill — a truncated "Tech stack adv…" is the one thing a roster
              // column cannot do.
              width: em(240),
              flexShrink: 0,
              borderRight: `1px solid ${HAIR}`,
              paddingRight: em(16),
            }}
          >
            <Roster title="Always on">
              {ALWAYS.map(([art, label]) => (
                <PickRow
                  key={label}
                  art={art}
                  label={label}
                  held={label === "Discussion helper"}
                />
              ))}
            </Roster>

            <div
              style={{
                marginTop: em(16),
                paddingTop: em(16),
                borderTop: `1px solid ${HAIR}`,
              }}
            >
              <Roster
                title="Specialists"
                action={
                  <span style={{ fontSize: em(11.5), color: NB.inkSoft }}>
                    3 enabled
                  </span>
                }
              >
                {SPECIALISTS.map(([art, label, on]) => (
                  <PickRow key={label} art={art} label={label} on={on} />
                ))}
              </Roster>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: em(6, 12),
                marginTop: em(10, 12),
                borderRadius: em(9, 12),
                background: NB.wash,
                padding: `${em(6, 12)} ${em(10, 12)}`,
                fontSize: em(12),
                fontWeight: 700,
              }}
            >
              <FiPlus aria-hidden />
              Add a specialist
            </div>
          </div>

          {/* The page for the selected row. Everything above the box is
              fixed-height — who the agent is, and what it runs — so the one part
              that is a workspace is the one part that grows. */}
          <div
            style={{
              display: "flex",
              minWidth: 0,
              flex: 1,
              flexDirection: "column",
              gap: em(16),
            }}
          >
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: em(12) }}
            >
              <Character art="discussion-helper" size={44} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: em(14), fontWeight: 800 }}>
                  Discussion helper
                </div>
                <p
                  style={{
                    margin: `${em(2, 12)} 0 0`,
                    fontSize: em(12),
                    lineHeight: 1.375,
                    color: NB.inkSoft,
                  }}
                >
                  Help decide what’s worth building.
                </p>
                {/* The first sentence of the trigger is the answer and stays on
                    the line; what the agent adds after it opens behind View
                    rules. */}
                <p
                  style={{
                    margin: `${em(4, 11.5)} 0 0`,
                    fontSize: em(11.5),
                    lineHeight: 1.375,
                    color: NB.inkSoft,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Runs when</span> you talk to
                  it — Discuss, or the chat beside a card.
                  <span
                    style={{
                      marginLeft: em(6, 11.5),
                      fontWeight: 600,
                      color: NB.ink,
                      whiteSpace: "nowrap",
                    }}
                  >
                    View rules{" "}
                    <FiChevronDown
                      size={11}
                      aria-hidden
                      style={{ display: "inline", verticalAlign: "-1px" }}
                    />
                  </span>
                </p>
              </div>
            </div>

            <hr
              style={{ margin: 0, border: 0, borderTop: `1px solid ${HAIR}` }}
            />

            <SettingRow label="Runtime">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: em(8, F),
                  height: em(34, F),
                  borderRadius: em(10, F),
                  background: NB.wash,
                  padding: `0 ${em(10, F)}`,
                  fontSize: em(F),
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Codex · gpt-6-astra
                </span>
                <FiChevronDown style={{ flexShrink: 0 }} />
              </div>
            </SettingRow>

            <section
              style={{
                display: "flex",
                minHeight: 0,
                flex: 1,
                flexDirection: "column",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: em(13.5),
                  fontWeight: 800,
                  lineHeight: 1.2,
                }}
              >
                Your instructions
              </h4>
              {/* Added to the end of every message this agent is sent. Drawn
                  written rather than empty: what the step is about is that the
                  words are yours. */}
              <div
                style={{
                  flex: 1,
                  minHeight: em(88, 12),
                  margin: `${em(8, 12)} 0 0`,
                  borderRadius: em(10, 12),
                  background: NB.wash,
                  padding: `${em(10, 12)} ${em(12, 12)}`,
                  fontSize: em(12),
                  lineHeight: 17 / 12,
                }}
              >
                Always end with the one question I have not thought about. Never
                propose work the goal does not cover.
              </div>
              <p
                style={{
                  margin: `${em(6, 11.5)} 0 0`,
                  fontSize: em(11.5),
                  color: NB.inkSoft,
                }}
              >
                Saved with this repository.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Shot>
  );
}
