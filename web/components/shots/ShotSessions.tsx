import { FiX } from "react-icons/fi";
import { CROP, Code, HAIR, Inset, LogBar, NB, Panel, Shot, Tag, em } from "./nb";

// Step 03 推进执行 — a finished implement run, read back from the run history:
// what the agent did, which files it touched, how long it took and what it ran
// on. Mirrors kanban-ui/components/sessions.tsx (`SessionsDialog`: the 240px
// rail of jobs, each threading its own sessions on a timeline, and the
// selected-run pane) and agent-shared.tsx's `SessionLog` in its `flush` form.
//
// The dialog is the one thing on the board still drawn as an object: ink frame,
// hard offset shadow. Everything inside it is parted by hairlines and fills.
//
// Drawn without the board behind it. The real dialog floats on a scrim over the
// board, and half a blurred board bleeding off the edges reads as a screen grab
// rather than the artwork this is mounted as.

// A row is a JOB, however many sessions it took (lib/run-flows.ts). A job of one
// session is that row alone; a job of several threads them under it on a rail, so
// where it has got to is the line's end.
const ROWS: {
  action: string;
  card: string;
  when: string;
  steps?: string[];
  active?: boolean;
}[] = [
  {
    action: "Implement",
    card: "#135",
    when: "2 sessions · 3d ago",
    steps: ["Implement", "Review"],
    active: true,
  },
  { action: "Resolve", card: "#135", when: "2 sessions · 3d ago", steps: ["Resolve", "Writing"] },
  { action: "Implement", card: "#139", when: "3d ago" },
  { action: "Implement", card: "#108", when: "4d ago" },
  { action: "Create", card: "—", when: "4d ago" },
];

const SHIPPED: { file: string; text: React.ReactNode }[] = [
  {
    file: "cli/src/lib/recurring.ts",
    text: (
      <>
        the seeded card&apos;s body no longer points at the recurring-task guide.
        It now says the one thing to do: <em>&ldquo;Set its cadence to </em>
        <Code>1d</Code>
        <em> and it prunes once a day on its own.&rdquo;</em>
      </>
    ),
  },
  {
    file: "skill/references/prune-memory.md",
    text: (
      <>
        new section &ldquo;The card that does this on a cadence&rdquo;: what the
        seeded card is, and that <Code>1d</Code> is how a board prunes daily.
      </>
    ),
  },
  {
    file: "skill/SKILL.md",
    text: (
      <>
        one line in Auto-pruning: a new board starts with a recurring card that
        does this, a <Code>1d</Code> cadence makes it daily.
      </>
    ),
  },
];

/** The list's status dot — mint for a run that finished clean. */
function Dot() {
  return (
    <span
      aria-hidden
      style={{
        width: em(8),
        height: em(8),
        flex: "0 0 auto",
        borderRadius: em(999),
        background: NB.mint,
      }}
    />
  );
}

export function ShotSessions() {
  return (
    <Shot crop={CROP}>
      <div style={{ padding: em(14) }}>
        {/* .nb-panel — the dialog frame. overflow-hidden clips the rail's fill
            to the radius, the way the real one does. */}
        <Panel style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* dialog title bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: `${em(12)} ${em(20)}`,
              borderBottom: `1px solid ${HAIR}`,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: em(15),
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              Runs
            </h2>
            <FiX
              aria-hidden
              style={{ width: em(18), height: em(18), color: NB.inkSoft }}
            />
          </div>

          <div style={{ display: "flex", minHeight: 0 }}>
            {/* left: every job, newest first */}
            <div
              style={{
                width: em(160),
                flex: "0 0 auto",
                borderRight: `1px solid color-mix(in srgb, #24231f 10%, transparent)`,
                background: "color-mix(in srgb, #f7f7f4 70%, transparent)",
              }}
            >
              {ROWS.map((r, i) => (
                <div
                  key={`${r.action}${r.card}${i}`}
                  style={{ borderBottom: `1px solid color-mix(in srgb, #24231f 8%, transparent)` }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: em(10),
                      padding: `${em(10)} ${em(12)}`,
                      background: r.active ? NB.paper : undefined,
                      boxShadow: r.active
                        ? `inset ${em(2.5)} 0 0 0 ${NB.accent}`
                        : undefined,
                    }}
                  >
                    <Dot />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: em(6),
                        }}
                      >
                        <span
                          style={{
                            fontSize: em(12.5),
                            fontWeight: 700,
                            color: r.active ? NB.ink : NB.inkSoft,
                          }}
                        >
                          {r.action}
                        </span>
                        <span style={{ fontSize: em(11), color: NB.inkSoft }}>
                          {r.card}
                        </span>
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: em(10.5),
                          color: NB.inkSoft,
                        }}
                      >
                        {r.when}
                      </span>
                    </span>
                  </div>
                  {/* the job's sessions, threaded on a rail through their own
                      dots. The rail stops at the last dot rather than running
                      past it. */}
                  {r.steps && (
                    <div style={{ paddingBottom: em(4) }}>
                      {r.steps.map((step, k) => {
                        const on = !!r.active && k === 0;
                        return (
                          <div
                            key={step}
                            style={{
                              position: "relative",
                              display: "flex",
                              alignItems: "center",
                              gap: em(8),
                              padding: `${em(6)} ${em(12)} ${em(6)} ${em(28)}`,
                              background: on ? NB.paper : undefined,
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                position: "absolute",
                                left: em(31.5),
                                width: 1,
                                top: 0,
                                bottom: k === r.steps!.length - 1 ? "50%" : 0,
                                background: "color-mix(in srgb, #24231f 15%, transparent)",
                              }}
                            />
                            <span style={{ position: "relative", display: "flex", zIndex: 1 }}>
                              <Dot />
                            </span>
                            <span
                              style={{
                                fontSize: em(11.5),
                                fontWeight: on ? 700 : 400,
                                color: on ? NB.ink : NB.inkSoft,
                              }}
                            >
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* right: the selected run's note and log */}
            <div style={{ minWidth: 0, flex: 1, padding: em(14) }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: em(8),
                  marginBottom: em(12),
                }}
              >
                {/* A session is titled by the JOB, not by its own action; which
                    step you are reading is the timeline's word, on the left. */}
                <span
                  style={{
                    fontSize: em(14),
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Implement
                </span>
                <span
                  style={{
                    fontSize: em(12),
                    fontWeight: 700,
                    color: NB.accentDeep,
                    textDecoration: "underline",
                    textUnderlineOffset: em(2, 12),
                  }}
                >
                  #135
                </span>
                <span style={{ fontSize: em(11), color: NB.inkSoft }}>
                  Aug 2, 11:15 PM
                </span>
              </div>

              {/* the free text the run was started with */}
              <div style={{ marginBottom: em(12) }}>
                <div style={{ marginBottom: em(6) }}>
                  <Tag>note</Tag>
                </div>
                <p style={{ margin: 0, fontSize: em(13), lineHeight: 1.6 }}>
                  #139 is done.
                </p>
              </div>

              {/* SessionLog, flush form: a hairline window on paper, wash well */}
              <Inset>
                {/* The real bar also carries what the run cost. It is left off:
                    it pushes the facts row onto a second line at this width, and
                    it is not what this step is about. */}
                <LogBar facts={["done", "7m 46s", "claude-opus-5"]} />
                <div
                  style={{
                    padding: `${em(12)} ${em(16)}`,
                    background: NB.wash,
                    borderBottomLeftRadius: em(13),
                    borderBottomRightRadius: em(13),
                    boxShadow: `inset 0 1px 3px color-mix(in srgb, #24231f 8%, transparent)`,
                  }}
                >
                  {/* the fold the intermediate events live behind */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: em(6),
                      marginBottom: em(9),
                      fontSize: em(10),
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: NB.inkSoft,
                    }}
                  >
                    <span aria-hidden>▸</span>
                    intermediate events
                  </div>

                  {/* .nb-sessionlog-md — the agent's final message */}
                  <div style={{ fontSize: em(13), lineHeight: 1.6 }}>
                    <p style={{ margin: 0 }}>#135 is done and archived.</p>
                    <p
                      style={{
                        margin: 0,
                        marginTop: em(14, 13),
                        fontSize: em(14, 13),
                        fontWeight: 800,
                      }}
                    >
                      What shipped
                    </p>
                    <ul
                      style={{
                        margin: 0,
                        marginTop: em(9, 13),
                        paddingLeft: em(16, 13),
                        listStyle: "disc",
                      }}
                    >
                      {SHIPPED.map((s, i) => (
                        <li
                          key={s.file}
                          style={{
                            paddingLeft: em(4, 13),
                            marginTop: i === 0 ? 0 : em(6, 13),
                          }}
                        >
                          <Code>{s.file}</Code> — {s.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Inset>
            </div>
          </div>
        </Panel>
      </div>
    </Shot>
  );
}
