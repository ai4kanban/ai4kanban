import type { ReactNode } from "react";
import { FiMaximize2 } from "react-icons/fi";
import { Btn, CROP, Code, MONO, NB, Shot, em } from "./nb";

// Step 04 Plan the way you think. — what the ui-designer agent leaves on the
// card: one proposal, one file per screen, drawn the way a card page frames a
// mockup (kanban-ui/components/Mockup.tsx) — the screen's name, the file behind
// it, the switch to its code, and no frame around the picture.
//
// Drawn legible, not as grey blocks: at this size the point is that these are
// real screens of one product, so the title, the primary button and the usage
// switch have to survive the scale.

/** The row over a screen: what it is, the file it lives in, and CODE. */
function Head({ name, file }: { name: string; file: string }) {
  const F = 11;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: em(11, F),
        height: em(22, F),
        fontSize: em(F),
        color: NB.inkSoft,
      }}
    >
      <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{name}</span>
      <span
        style={{
          display: "inline-flex",
          minWidth: 0,
          alignItems: "center",
          gap: em(4, 9.5),
          fontFamily: MONO,
          fontSize: em(9.5, F),
          textDecoration: "underline dotted",
          textUnderlineOffset: em(2, 9.5),
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {file}
        </span>
        <FiMaximize2
          aria-hidden
          style={{ width: em(9, 9.5), height: em(9, 9.5), flex: "0 0 auto" }}
        />
      </span>
      <span
        style={{
          marginLeft: "auto",
          fontSize: em(9.5, F),
          fontWeight: 700,
          letterSpacing: "0.08em",
        }}
      >
        CODE
      </span>
    </div>
  );
}

/** The nav both screens share — same app, two moments. */
function Rail({ active }: { active: string }) {
  const F = 11;
  return (
    <div
      style={{
        width: em(122, F),
        flex: "0 0 auto",
        padding: `${em(10, F)} ${em(8, F)}`,
        fontSize: em(F),
      }}
    >
      {["Welcome", "Board", "Configuration"].map((label) => {
        const on = label === active;
        return (
          <div
            key={label}
            style={{
              padding: `${em(7, F)} ${em(10, F)}`,
              borderRadius: em(4, F),
              background: on ? NB.paper : undefined,
              color: on ? NB.ink : NB.inkSoft,
              fontWeight: on ? 700 : 400,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

/** One screen of the proposal: the app's chrome, then the pane that changes. */
function Screen({
  height,
  active,
  children,
}: {
  height: number;
  active: string;
  children: ReactNode;
}) {
  const F = 11;
  return (
    <div style={{ height: em(height), background: NB.wash, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: em(7, F),
          height: em(23, F),
          padding: `0 ${em(12, F)}`,
          fontSize: em(F),
          fontWeight: 700,
        }}
      >
        <span
          aria-hidden
          style={{ width: em(7, F), height: em(7, F), background: NB.accent }}
        />
        Kanban
      </div>
      <div style={{ display: "flex", height: `calc(100% - ${em(23)})` }}>
        <Rail active={active} />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            marginRight: em(10),
            padding: `${em(10)} ${em(23)}`,
            background: NB.paper,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** The usage switch, on. */
function Toggle() {
  return (
    <span
      style={{
        display: "inline-flex",
        flex: "0 0 auto",
        alignItems: "center",
        justifyContent: "flex-end",
        width: em(38),
        height: em(22),
        padding: em(3),
        borderRadius: em(999),
        border: `${em(1)} solid ${NB.ink}`,
        background: NB.accent,
      }}
    >
      <span
        style={{
          width: em(14),
          height: em(14),
          borderRadius: em(999),
          background: NB.paper,
        }}
      />
    </span>
  );
}

export function ShotSpecAgents() {
  return (
    <Shot crop={CROP}>
      <div style={{ padding: em(20) }}>
        <h2 style={{ margin: 0, fontSize: em(16), fontWeight: 800 }}>
          By <Code>ui-designer</Code> agent
        </h2>

        <div style={{ marginTop: em(8) }}>
          <Head name="First run" file=".mockups/293/first-run.tsx" />
          <Screen height={154} active="Welcome">
            <h3
              style={{
                margin: 0,
                fontSize: em(27.5),
                lineHeight: 1.15,
                fontWeight: 750,
                letterSpacing: "-0.025em",
              }}
            >
              Welcome to Kanban
            </h3>
            <p
              style={{
                margin: `${em(7)} 0 ${em(8)}`,
                fontSize: em(14),
                color: NB.inkSoft,
              }}
            >
              Your next idea starts here.
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: em(14),
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: em(8, 12.4),
                  fontSize: em(12.4),
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: "inline-flex",
                    flex: "0 0 auto",
                    alignItems: "center",
                    justifyContent: "center",
                    width: em(16.5, 12.4),
                    height: em(16.5, 12.4),
                    borderRadius: em(3, 12.4),
                    border: `${em(1, 12.4)} solid ${NB.ink}`,
                    fontSize: em(11, 12.4),
                  }}
                >
                  ✓
                </span>
                Share usage data
              </span>
              <Btn variant="accent" style={{ fontSize: em(15) }}>
                Get started →
              </Btn>
            </div>
          </Screen>
        </div>

        <div style={{ marginTop: em(8) }}>
          <Head
            name="Configuration → Privacy"
            file=".mockups/293/configuration-privacy.tsx"
          />
          <Screen height={179} active="Configuration">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: em(16),
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: em(26),
                    lineHeight: 1.2,
                    fontWeight: 750,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Privacy
                </h3>
                <div
                  style={{
                    marginTop: em(8),
                    fontSize: em(14),
                    fontWeight: 600,
                  }}
                >
                  Share usage data
                </div>
              </div>
              <Toggle />
            </div>
            <p
              style={{
                margin: `${em(12)} 0 0`,
                fontSize: em(12.4),
                color: NB.inkSoft,
              }}
            >
              Help improve Kanban. Change this anytime.
            </p>
          </Screen>
        </div>
      </div>
    </Shot>
  );
}
