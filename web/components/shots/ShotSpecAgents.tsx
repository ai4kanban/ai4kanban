import { CROP, Cap, Code, HAIR, Inset, MONO, NB, Shot, Tag, em } from "./nb";

// Step 05 在实施前完成关键决策 — the layouts the ui-design agent leaves on the
// card, mirroring screenshots/card-mockups.png: each option is a real file, two
// screens of it, and the agent's argument for it underneath. The dependency
// research the same step does is left to the step's body text; one card section
// is what the picture can hold.
//
// The previews are drawn abstract — blocks, not readable UI. A mockup is a whole
// screen, and a legible one inside a shot this size would be a screen grab of a
// screen grab. What the step needs is that there are SEVERAL of them, each a
// real file with code behind it, and a reason written beside each.

/** One layout option: its letter, the file it lives in, and its screens. */
function Option({
  letter,
  file,
  children,
}: {
  letter: string;
  file: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: em(16) }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: em(8),
          paddingBottom: em(8),
          borderBottom: `1px solid ${HAIR}`,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: em(18),
            height: em(18),
            borderRadius: em(999),
            background: NB.accentSoft,
            color: NB.accentDeep,
            fontSize: em(10.5),
            fontWeight: 800,
          }}
        >
          {letter}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: em(12),
            fontWeight: 700,
            color: NB.accentDeep,
          }}
        >
          {file}
        </span>
        <span style={{ marginLeft: "auto" }}>
          <Tag>code</Tag>
        </span>
      </div>
      <div style={{ display: "flex", gap: em(12), marginTop: em(12) }}>
        {children}
      </div>
    </div>
  );
}

/** A block inside a preview — the drawn stand-in for a pane, a row, a button. */
function Bar({
  w,
  h = 6,
  fill = "rgba(36,35,31,0.12)",
  radius = 3,
}: {
  w: string;
  h?: number;
  fill?: string;
  radius?: number;
}) {
  return (
    <span
      style={{
        display: "block",
        width: w,
        height: em(h),
        borderRadius: em(radius),
        background: fill,
      }}
    />
  );
}

/** One screen of an option: the moment it shows, then the window itself. */
function Screen({
  when,
  children,
  tint,
}: {
  when: string;
  children: React.ReactNode;
  tint?: boolean;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ paddingBottom: em(7) }}>
        <Cap>{when}</Cap>
      </div>
      <Inset
        style={{
          position: "relative",
          height: em(120),
          overflow: "hidden",
          background: tint ? NB.wash : NB.paper,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: em(5),
            padding: `${em(7)} ${em(8)}`,
            borderBottom: `1px solid ${HAIR}`,
          }}
        >
          <span
            aria-hidden
            style={{
              width: em(6),
              height: em(6),
              borderRadius: em(999),
              background: NB.accent,
            }}
          />
          <Bar w="34%" h={4} />
        </div>
        {children}
      </Inset>
    </div>
  );
}

/** The agent's case for the option it just built — why this one, and its cost. */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: `${em(12)} 0 0`,
        fontSize: em(13),
        lineHeight: 1.6,
        color: NB.inkSoft,
      }}
    >
      {children}
    </p>
  );
}

export function ShotSpecAgents() {
  return (
    <Shot crop={CROP}>
      <div style={{ padding: em(20) }}>
        <h2 style={{ margin: 0, fontSize: em(16), fontWeight: 800 }}>
          By <Code>ui-design</Code> agent
        </h2>

        <Option letter="A" file=".mockups/293/a.tsx">
          {/* a panel over the board the user already has */}
          <Screen when="first open after the update" tint>
            <div style={{ position: "relative", padding: em(8) }}>
              <div style={{ display: "flex", gap: em(6) }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: em(5),
                    }}
                  >
                    <Bar w="60%" h={4} />
                    <Bar w="100%" h={12} />
                    <Bar w="100%" h={12} />
                  </span>
                ))}
              </div>
              <div
                style={{
                  position: "absolute",
                  left: "12%",
                  right: "12%",
                  top: em(14),
                  display: "flex",
                  flexDirection: "column",
                  gap: em(6),
                  padding: em(9),
                  border: `${em(1.5)} solid ${NB.ink}`,
                  borderRadius: em(9),
                  background: NB.paper,
                  boxShadow: `${em(2)} ${em(2)} 0 0 ${NB.ink}`,
                }}
              >
                <Bar w="62%" h={5} fill="rgba(36,35,31,0.5)" />
                <Bar w="100%" h={4} />
                <Bar w="84%" h={4} />
                <span
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: em(5),
                  }}
                >
                  <Bar w={em(26)} h={9} radius={4} />
                  <Bar w={em(34)} h={9} radius={4} fill={NB.accent} />
                </span>
              </div>
            </div>
          </Screen>
          {/* where the same switch lives every day after */}
          <Screen when="configuration → privacy">
            <div style={{ display: "flex", height: "100%" }}>
              <span
                style={{
                  width: "30%",
                  display: "flex",
                  flexDirection: "column",
                  gap: em(6),
                  padding: em(8),
                  borderRight: `1px solid ${HAIR}`,
                  background: NB.wash,
                }}
              >
                <Bar w="80%" h={4} />
                <Bar w="65%" h={4} />
                <Bar w="72%" h={4} fill={NB.accentSoft} />
              </span>
              <span
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: em(6),
                  padding: em(8),
                }}
              >
                <Bar w="52%" h={5} fill="rgba(36,35,31,0.5)" />
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: em(6),
                    padding: em(6),
                    borderRadius: em(6),
                    background: NB.wash,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: em(4),
                    }}
                  >
                    <Bar w="70%" h={4} />
                    <Bar w="90%" h={4} />
                  </span>
                  <Bar w={em(18)} h={10} radius={5} fill={NB.accent} />
                </span>
                <Bar w="88%" h={4} />
              </span>
            </div>
          </Screen>
        </Option>
        <Note>
          A panel over the board the user already has. The scrim does not dismiss
          it, so the two buttons are the only way on — least to build, at the cost
          of a modal that ignores Esc.
        </Note>

        <Option letter="B" file=".mockups/293/b.tsx">
          {/* the whole window is the question — no board behind it */}
          <Screen when="first open after the update">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: em(6),
                padding: `${em(16)} ${em(16)}`,
              }}
            >
              <Bar w="54%" h={6} fill="rgba(36,35,31,0.5)" />
              <Bar w="86%" h={4} />
              <Bar w="72%" h={4} />
              <span style={{ display: "flex", gap: em(5), marginTop: em(4) }}>
                <Bar w={em(26)} h={9} radius={4} />
                <Bar w={em(34)} h={9} radius={4} fill={NB.accent} />
              </span>
            </div>
          </Screen>
          {/* the switch, reached from a row in the board's own settings */}
          <Screen when="configuration → privacy">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: em(7),
                padding: em(9),
              }}
            >
              <Bar w="44%" h={5} fill="rgba(36,35,31,0.5)" />
              {[0, 1].map((i) => (
                <span
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: em(6),
                    padding: em(5),
                    borderRadius: em(6),
                    background: i === 0 ? NB.wash : undefined,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      gap: em(4),
                    }}
                  >
                    <Bar w={i === 0 ? "58%" : "44%"} h={4} />
                    <Bar w={i === 0 ? "82%" : "66%"} h={4} />
                  </span>
                  <Bar
                    w={em(18)}
                    h={10}
                    radius={5}
                    fill={i === 0 ? NB.accent : "rgba(36,35,31,0.18)"}
                  />
                </span>
              ))}
            </div>
          </Screen>
        </Option>
      </div>
    </Shot>
  );
}
