import type { ReactNode } from "react";
import { FiChevronDown } from "react-icons/fi";
import { Character, HAIR, NB, Shot, em } from "./nb";

// Step 06 — Configuration → Board, the pane every board opens on. The roster in
// the narrow column is the whole of that page, in its three groups; everything
// right of the rule is the page for the held row.
//
// Drawn from kanban-ui/components/Agents.tsx with `scope` = board; every word is
// from kanban-ui/i18n/configuration/en.ts, triggers at the default cadence.
//
// Only the roster's column is fixed; the instructions box takes whatever height
// is left, as in the real pane, so the drawing bottoms out level.

const GROUPS: [title: string, rows: [name: string, label: string, trigger: string][]][] =
  [
    [
      "You start",
      [
        ["discussion-helper", "Planning helper", "When you chat"],
        ["feedback", "Fix a plan that missed", "When you say a plan misread you"],
      ],
    ],
    [
      "On a schedule",
      [
        ["chat-reviewer", "Review chats", "Every day"],
        ["memory-pruner", "Tidy memory", "Every 7 days"],
        ["dismissal-reviewer", "Learn from dismissals", "Every day"],
      ],
    ],
    [
      "On an event",
      [["proposer", "Suggest follow-up work", "After a card is archived"]],
    ],
  ];

/** One row: the character, what the agent does, and what starts it. `held` is
 *  the ember wash marking the row the page beside the column belongs to. */
function PickRow({
  name,
  label,
  trigger,
  held,
}: {
  name: string;
  label: string;
  trigger: string;
  held?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: em(8),
        borderRadius: em(9),
        padding: `${em(7)} ${em(10)}`,
        background: held ? NB.accentSoft : undefined,
      }}
    >
      <Character name={name} size={26} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: em(12.5),
            fontWeight: 700,
            lineHeight: 16 / 12.5,
            color: NB.ink,
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginTop: em(1),
            fontSize: em(11),
            lineHeight: 14 / 11,
            color: NB.inkSoft,
          }}
        >
          {trigger}
        </span>
      </span>
    </div>
  );
}

/** A group of the roster under its own name, in soft ink so it does not compete
 *  with the names. */
function Roster({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4
        style={{
          margin: `0 0 ${em(6)}`,
          fontSize: em(12.5),
          fontWeight: 600,
          color: NB.inkSoft,
        }}
      >
        {title}
      </h4>
      {children}
    </section>
  );
}

/** `SettingRow` — the setting on the left, its control on the right. */
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
          flexShrink: 0,
          fontSize: em(13.5),
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {label}
      </p>
      {/* Wide enough for the whole of what the runtime resolves to — the model
          is half the answer, and "Codex · gpt-6-a…" gives the wrong one. It is
          the control that gives way when the drawing is narrow, never the label:
          a clipped "Runti" is a render nobody would ship, and the value inside
          still has its own ellipsis. */}
      <div style={{ width: em(176), minWidth: 0, flexShrink: 1 }}>{children}</div>
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
          <div
            style={{
              // 292, the pane's own column.
              width: em(292),
              flexShrink: 0,
              borderRight: `1px solid ${HAIR}`,
              paddingRight: em(16),
            }}
          >
            {GROUPS.map(([title, rows], i) => (
              <div
                key={title}
                style={
                  i > 0
                    ? {
                        marginTop: em(16),
                        paddingTop: em(16),
                        borderTop: `1px solid ${HAIR}`,
                      }
                    : undefined
                }
              >
                <Roster title={title}>
                  {rows.map(([name, label, trigger]) => (
                    <PickRow
                      key={name}
                      name={name}
                      label={label}
                      trigger={trigger}
                      held={name === "discussion-helper"}
                    />
                  ))}
                </Roster>
              </div>
            ))}
          </div>

          {/* The page for the held row. Everything above the box is
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
              <Character name="discussion-helper" size={44} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: em(14), fontWeight: 800 }}>
                  Planning helper
                </div>
                <p
                  style={{
                    margin: `${em(2, 12)} 0 0`,
                    fontSize: em(12),
                    lineHeight: 1.375,
                    color: NB.inkSoft,
                  }}
                >
                  Shapes an idea into a plan with you; planning picks up from
                  there.
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
                  it — New idea, or Discuss on a card.
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
