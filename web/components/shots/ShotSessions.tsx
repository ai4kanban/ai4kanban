import type { CSSProperties } from "react";
import { FaPauseCircle } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { CROP, HAIR, Inset, LogBar, MONO, NB, Panel, Shot, em } from "./nb";

// Step 03 推进执行 — four runs going at once, and the one being read streaming
// its events. Mirrors kanban-ui/components/sessions.tsx (`SessionsDialog`: the
// 240px rail of jobs, each threading its own sessions on a timeline, and the
// selected-run pane) and agent-shared.tsx's `SessionLog` in its live form: the
// tail is the agent's event stream, so it reads mono, and the title bar carries
// Stop, the pulse, and the model the agent named.
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
  live?: boolean;
  active?: boolean;
}[] = [
  { action: "Refine", card: "#374", when: "1m ago", live: true, active: true },
  { action: "Implement", card: "#357", when: "1m ago", live: true },
  { action: "Implement", card: "#314", when: "2m ago", live: true },
  { action: "Implement", card: "#388", when: "4m ago", live: true },
  {
    action: "Review",
    card: "#378",
    when: "8 sessions · 1d ago",
    steps: ["Review", "Clarify", "Writing"],
  },
  { action: "Resolve", card: "#383", when: "2 sessions · 1d ago", steps: ["Resolve", "Writing"] },
];

// The tail the selected run is writing, as the log shows it: the agent's turn
// text, then one line per tool call, each cut to the width of the pane the way
// the real log cuts them.
const TAIL = [
  "I'll load the kanban skill and the qa-loop guide.",
  "",
  "● Skill",
  "● Bash(node cli/bin/ai4kanban.mjs guide qa-loop)",
  "● Bash(ls docs/kanban/todo/ && find docs/kanban…)",
  "● Read(docs/kanban/todo/374-render-board-off-m…)",
  "● Read(kanban-ui/components/Board.tsx)",
  "● Bash(wc -l app/page.tsx app/actions.ts lib/…)",
  "● Grep(from \"@/app/actions\" in components/ app/)",
  "● Read(kanban-ui/app/actions.ts)",
  "● Bash(grep -rn \"release\" app/*.tsx | head -20)",
  "● Edit(docs/kanban/todo/374-render-board-off-m…)",
];

// The log types itself out once a cycle: a line is revealed a character at a
// time, in the steps of its own length, and the caret sits at the end of
// whichever line is being written. Standing still — the resting frame,
// `prefers-reduced-motion`, a capture of /shots/ — the whole tail is there.
const CHAR = 0.012; // seconds a character takes
const GAP = 0.1; // between one line and the next
const START = 0.5; // after the log has faded in
const HOLD = 2.2; // the finished tail, before it starts over

// When each line starts and ends, in seconds. A blank line is a beat, not a
// wait: there is nothing to type.
const SCHEDULE = TAIL.reduce<{ start: number; end: number }[]>((rows, line) => {
  const start = rows.length === 0 ? START : rows[rows.length - 1].end + GAP;
  return [...rows, { start, end: start + Math.max(line.length, 3) * CHAR }];
}, []);
const TYPED = SCHEDULE[SCHEDULE.length - 1].end;
const CYCLE = TYPED + HOLD;

const pct = (seconds: number) => `${(seconds / CYCLE) * 100}%`;

// One keyframe per line, because each has its own length and its own turn, and
// they all have to share the one cycle to stay in step.
const TYPING = TAIL.map((line, i) => {
  const { start, end } = SCHEDULE[i];
  return `
@keyframes ex-type-${i} {
  0%, ${pct(start)} { width: 0; border-right-color: transparent }
  ${pct(start + 0.02)} { border-right-color: ${NB.inkSoft} }
  ${pct(end)} { width: ${line.length}ch }
  ${pct(end + 0.02)}, 100% { border-right-color: transparent }
}`;
}).join("");

const MOTION = `${TYPING}
@keyframes ex-fade {
  0% { opacity: 0 }
  ${pct(START * 0.6)}, ${pct(TYPED + HOLD * 0.7)} { opacity: 1 }
  100% { opacity: 0 }
}
@keyframes ex-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.85) }
  50% { opacity: 1; transform: scale(1) }
}
@media (prefers-reduced-motion: no-preference) {
${TAIL.map(
  (line, i) =>
    `  .ex-line-${i} { animation: ex-type-${i} ${CYCLE}s steps(${Math.max(line.length, 1)}) infinite both }`,
).join("\n")}
  .ex-fade { animation: ex-fade ${CYCLE}s linear infinite both }
  /* Four runs that started at four different moments don't breathe together. */
  .ex-pulse { animation: ex-pulse 1.1s ease-in-out var(--pd, 0s) infinite both }
}
`;

/** The list's status dot — a pulsing ember while the run is live, mint once it
 *  passed (`SessionDot`). */
function Dot({ live, delay = 0 }: { live?: boolean; delay?: number }) {
  return (
    <span
      aria-hidden
      className={live ? "ex-pulse" : undefined}
      style={
        {
          width: em(8),
          height: em(8),
          flex: "0 0 auto",
          borderRadius: em(999),
          background: live ? NB.accentDeep : NB.mint,
          "--pd": `${delay}s`,
        } as CSSProperties
      }
    />
  );
}

export function ShotSessions() {
  return (
    <Shot crop={CROP}>
      <div style={{ padding: em(14) }}>
        <style>{MOTION}</style>
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
            {/* left: every job, newest first — the four in flight lead it */}
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
                    <Dot live={r.live} delay={-0.27 * i} />
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
                      {r.steps.map((step, k) => (
                        <div
                          key={step}
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            gap: em(8),
                            padding: `${em(6)} ${em(12)} ${em(6)} ${em(28)}`,
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
                          <span style={{ fontSize: em(11.5), color: NB.inkSoft }}>
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* right: the selected run, still writing */}
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
                  Refine
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
                  #374
                </span>
                <span style={{ fontSize: em(11), color: NB.inkSoft }}>
                  Sep 1, 6:21 PM
                </span>
              </div>

              {/* SessionLog, flush form: a hairline window on paper, wash well.
                  A live run's bar carries Stop, the pulse and the model — the
                  duration and the cost aren't in yet. */}
              <Inset>
                <LogBar
                  facts={["claude-opus-5"]}
                  tool={
                    <FaPauseCircle
                      aria-hidden
                      style={{ width: em(13), height: em(13), color: NB.inkSoft }}
                    />
                  }
                  mark={<Dot live />}
                />
                <div
                  className="ex-fade"
                  style={{
                    padding: `${em(12)} ${em(16)}`,
                    background: NB.wash,
                    borderBottomLeftRadius: em(13),
                    borderBottomRightRadius: em(13),
                    boxShadow: `inset 0 1px 3px color-mix(in srgb, #24231f 8%, transparent)`,
                  }}
                >
                  {TAIL.map((line, i) => (
                    <div
                      key={i}
                      className={`ex-line-${i}`}
                      style={{
                        width: "max-content",
                        maxWidth: "100%",
                        overflow: "hidden",
                        whiteSpace: "pre",
                        borderRight: `${em(6, 12)} solid transparent`,
                        fontFamily: MONO,
                        fontSize: em(12),
                        lineHeight: em(19, 12),
                        color: NB.inkSoft,
                      }}
                    >
                      {line || " "}
                    </div>
                  ))}
                </div>
              </Inset>
            </div>
          </div>
        </Panel>
      </div>
    </Shot>
  );
}
