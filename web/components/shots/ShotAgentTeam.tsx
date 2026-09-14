import Image from "next/image";
import type { ReactNode } from "react";
import { FiChevronDown } from "react-icons/fi";
import { HAIR, NB, Shot, em } from "./nb";

// Step 06 — Configuration → Board, the pane every board opens on. The roster in
// the narrow column is the WHOLE of that page: the agents you call yourself,
// then the ones the board may start on its own. Everything right of the rule is
// the page for the row that is held.
//
// Drawn from kanban-ui/components/Agents.tsx with `scope` = board, and every
// word taken from kanban-ui/i18n/configuration/en.ts: two group captions, seven
// names that say the JOB, and the few words under each that say what starts it.
//
// Auto-sort Triage is the eighth row the product can draw and is left out on
// purpose: it only appears for an invited Cloud account, so drawing it would put
// back the thing this shot exists to fix — a page most readers cannot find.
//
// Only the roster's own column is fixed; the page beside it fills the rest, and
// the instructions box inside it takes whatever the page's fixed rows leave —
// the same growth the real pane has, so the drawing bottoms out level.
//
// Static, unlike the other shots in the Loop. The one motion this pane could
// honestly show is a row being selected, and the page beside it would have to
// change with it; a wash sliding down a list while the page holds still draws a
// board that does not exist.

/** The agents you call yourself: no switch, because there is nothing to be off. */
const MANUAL: [name: string, label: string, trigger: string][] = [
  ["discussion-helper", "Discuss an idea", "When you chat"],
  ["memory-pruner", "Tidy memory", "By hand or on a cadence"],
  ["sweeper", "Tidy stalled cards", "When you sweep one"],
  ["feedback", "Fix a plan that missed", "When you say it missed"],
];

/** The ones the board may start by itself. All three ship off; one is drawn on,
 *  because a column of three identical off switches says the board cannot do any
 *  of it. */
const AUTOMATIC: [name: string, label: string, trigger: string, on: boolean][] =
  [
    ["gater", "Auto-approve builds", "When a card turns ready", false],
    ["decider", "Auto-answer questions", "When questions wait", false],
    ["proposer", "Suggest follow-up work", "After a card is archived", true],
  ];

/** The names with a PNG in `public/agent-art/`. The real pane discovers this by
 *  letting the image fail; a drawing captured server-side cannot wait for that,
 *  so the set is written down. */
const HAS_ART = new Set(["discussion-helper", "gater", "decider"]);

/** `Agents.tsx`'s `Character` — pixel art, bottom-aligned in a square box. A
 *  paused agent keeps its character, greyed. */
function Character({
  name,
  size,
  off,
}: {
  name: string;
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
      {HAS_ART.has(name) ? (
        <Image
          src={`/agent-art/${name}.png`}
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
      ) : (
        <Lettered name={name} size={size} />
      )}
    </span>
  );
}

/** The palette's five inks, picked by the agent's name — `Agents.tsx`'s own
 *  rule. Two of the four art-less rows land on the same ink; what tells them
 *  apart is the letter on the card, not its colour. */
const INKS = [NB.skyInk, NB.lilacInk, NB.mintInk, NB.peachInk, NB.accentDeep];

/** A 5x7 letter on the character's own pixel grid. Only the initials this pane
 *  draws — the product carries the whole alphabet because an agent you add can
 *  be called anything. */
const GLYPHS: Record<string, string> = {
  f: "11111 10000 10000 11110 10000 10000 10000",
  m: "10001 11011 11111 10101 10001 10001 10001",
  p: "11110 10001 10001 11110 10000 10000 10000",
  s: "01111 10000 10000 01110 00001 00001 11110",
};

/** The character with no prop, holding a card with the agent's initial — the
 *  card in the agent's own ink, the letter in the visor's cream. The rectangles
 *  are in the PNG's own 96x96 coordinates, where every bundled character carries
 *  its prop. */
function Lettered({ name, size }: { name: string; size: number }) {
  const rows = (GLYPHS[name[0]!.toLowerCase()] ?? GLYPHS.m!).split(" ");
  const ink =
    INKS[
      [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % INKS.length
    ]!;
  return (
    <span
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        height: "100%",
      }}
    >
      <Image
        src="/agent-art/base.png"
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
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 96 96"
        shapeRendering="crispEdges"
        aria-hidden
      >
        <rect x={22} y={48} width={35} height={37} fill="#12130f" />
        <rect x={25} y={51} width={29} height={31} fill={ink} />
        {rows.map((row, y) =>
          [...row].map((on, x) =>
            on === "1" ? (
              <rect
                key={`${x}-${y}`}
                x={29 + x * 4}
                y={52 + y * 4}
                width={4}
                height={4}
                fill="#fcf8ea"
              />
            ) : null,
          ),
        )}
      </svg>
    </span>
  );
}

/** `settings.tsx`'s `Switch` at its full size — a filled track either way, so it
 *  reads on the row's own ground, and no word beside it: the caption above the
 *  group already says which half of the roster this is. */
function Toggle({ on }: { on: boolean }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        flexShrink: 0,
        alignItems: "center",
        width: em(44),
        height: em(24),
        borderRadius: em(999),
        background: on ? NB.accent : "rgba(36,35,31,0.2)",
      }}
    >
      <span
        style={{
          width: em(18),
          height: em(18),
          marginLeft: on ? em(23) : em(3),
          borderRadius: em(999),
          background: NB.paper,
          boxShadow: `0 ${em(1)} ${em(2)} rgba(36,35,31,0.28)`,
        }}
      />
    </span>
  );
}

/** One row: the character, what the agent does, what starts it, and — only in
 *  the automatic half — whether it may. `held` is the ember wash, which is the
 *  whole of which row the page beside the column belongs to. */
function PickRow({
  name,
  label,
  trigger,
  on,
  held,
}: {
  name: string;
  label: string;
  trigger: string;
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
        padding: `${em(7)} ${em(10)}`,
        background: held ? NB.accentSoft : undefined,
      }}
    >
      <Character name={name} size={26} off={off} />
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
            color: off ? NB.inkSoft : NB.ink,
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
      {on !== undefined && <Toggle on={on} />}
    </div>
  );
}

/** A half of the roster under its own name. Sentence case and soft ink: the
 *  column is a list of agents, and a caption shouting over each half would
 *  compete with the names. */
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
          {/* The whole roster in one narrow column, split the way the two halves
              start: the ones you call yourself, then the ones the board may
              start on its own. */}
          <div
            style={{
              // 292, the pane's own column: a name that says the JOB plus the
              // switch beside it needs every unit of it, and the type renders
              // relatively wider at the phone's floor — a column with no slack
              // clips there first.
              width: em(292),
              flexShrink: 0,
              borderRight: `1px solid ${HAIR}`,
              paddingRight: em(16),
            }}
          >
            <Roster title="Manual">
              {MANUAL.map(([name, label, trigger]) => (
                <PickRow
                  key={name}
                  name={name}
                  label={label}
                  trigger={trigger}
                  held={name === "discussion-helper"}
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
              <Roster title="Automatic">
                {AUTOMATIC.map(([name, label, trigger, on]) => (
                  <PickRow
                    key={name}
                    name={name}
                    label={label}
                    trigger={trigger}
                    on={on}
                  />
                ))}
              </Roster>
            </div>
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
                  Discuss an idea
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
