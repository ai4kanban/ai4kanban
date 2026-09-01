import type { CSSProperties } from "react";
import {
  FiCheckCircle,
  FiCircle,
  FiEdit2,
  FiPlay,
  FiUser,
  FiXCircle,
} from "react-icons/fi";
import { Btn, CROP, ChipIcon, HAIR, NB, Section, Shot, Tag, em } from "./nb";

// Step 02 澄清需求 — the card hands back only the calls it can't make from the
// code and the memory: a product trade-off tagged NEEDS YOU, with the choices
// the agent found and the one it recommends. Mirrors
// kanban-ui/components/questions.tsx (`OpenQuestions`, its `QuestionOptions`
// read-only list and the `OptionPicker` it opens into) and chips.tsx's
// `QuestionTagBadge`, with card #48's real question.
//
// The panel IS the control on the real card, so the drawing shows it being
// used: pointed at, it takes the double offset shadow and the DECIDE way in;
// clicked, every choice becomes a tick — the recommended one already on — with
// Resolve under the list. That is why the toolbar here has no Resolve button:
// there isn't one any more.
//
// Nothing is framed. The panel is a `.nb-section` on the ember wash, which is one
// of exactly two grounds a card page spends colour on: ember where an answer is
// wanted, mint where the work is already done.
//
// The real card puts its meta box between the toolbar and the questions, and
// asks #48 two questions rather than one. Neither is drawn: track/priority/roi
// are what step 01 is about, and the open panel — which is a third taller than
// the closed one — only fits the crop with one question in it.

// Card #48's first question, and the answer that settled it.
const QUESTION = {
  text: "When does the work merge into main — as soon as the run finishes, or only after you have read the diff?",
  options: [
    "Only after you read it — the run leaves the change in your tree",
    "As soon as the run finishes — main moves with nobody looking",
  ],
  recommend: 1,
};

// The last choice on every options question, added by the UI rather than written
// onto the card (lib/questions.ts) — so "none of these" is a tick like the rest.
const FREE_TEXT_CHOICE = "Something else — I'll type it";

// The pointer walks the panel once a cycle: it arrives, the panel says it can be
// clicked, it clicks, and the read turns into the decision. Standing still — the
// resting frame, `prefers-reduced-motion`, a capture of /shots/ — the pointer is
// gone and the panel is the plain read it has always been.
const CYCLE = 9.5;
const T = {
  in: 0.4, // the pointer enters
  arrive: 1.3, // …and is over the panel: shadow up, DECIDE up
  press: 2.0,
  open: 2.2, // the tick list, and the page scrolling the panel into view
  reach: 2.7, // the pointer follows the answer to the button under it
  close: 7.0,
  out: 7.3,
  gone: 8.1,
};
const SWAP = 0.32; // opening, and closing again

// What `scrollIntoView({ block: "nearest" })` does on the real card once the
// panel outgrows the window: enough to put the open panel and its Resolve row
// where the head and the toolbar were.
const SCROLL = 134;

const pct = (seconds: number) => `${(seconds / CYCLE) * 100}%`;

// Every state animation runs on these four stops: closed, open, closed.
const shut = `0%, ${pct(T.open)}`;
const wide = `${pct(T.open + SWAP)}, ${pct(T.close)}`;
const back = `${pct(T.close + SWAP)}, 100%`;

// Where the pointer starts, the question line it clicks, and the button the
// answer leaves under it once the panel has come up the page.
const FROM = { x: 610, y: 430 };
const OVER = { x: 300, y: 205 };
const ONTO = { x: 556, y: 243 };
const at = (p: { x: number; y: number }) => `translate(${em(p.x)}, ${em(p.y)})`;

const F = 12.5; // an option row's own type size — its paddings are `em` of this

const MOTION = `
@keyframes q-decide {
  0%, ${pct(T.arrive)} {
    border-color: transparent;
    box-shadow: 0 0 0 0 transparent, 0 0 0 0 transparent;
  }
  ${pct(T.arrive + 0.14)}, ${pct(T.close)} {
    border-color: ${NB.ink};
    box-shadow: ${em(3)} ${em(3)} 0 0 ${NB.accentSoft}, ${em(6)} ${em(6)} 0 0 ${NB.ink};
  }
  ${pct(T.close + 0.2)}, 100% {
    border-color: transparent;
    box-shadow: 0 0 0 0 transparent, 0 0 0 0 transparent;
  }
}
@keyframes q-badge {
  0%, ${pct(T.arrive)} { opacity: 0 }
  ${pct(T.arrive + 0.14)}, ${pct(T.press)} { opacity: 1 }
  ${pct(T.open)}, 100% { opacity: 0 }
}
@keyframes q-scroll {
  ${shut} { transform: none }
  ${wide} { transform: translateY(${em(-SCROLL)}) }
  ${back} { transform: none }
}
@keyframes q-pill {
  ${shut} { padding: 0; background: transparent; font-weight: 400 }
  ${wide} {
    padding: ${em(5, F)} ${em(9, F)};
    background: var(--pill);
    font-weight: var(--pw, 400);
  }
  ${back} { padding: 0; background: transparent; font-weight: 400 }
}
@keyframes q-bold {
  ${shut} { font-weight: 400 }
  ${wide} { font-weight: 700 }
  ${back} { font-weight: 400 }
}
@keyframes q-rec {
  ${shut} { color: inherit }
  ${wide} { color: ${NB.inkSoft} }
  ${back} { color: inherit }
}
@keyframes q-foot {
  ${shut} { height: 0; opacity: 0 }
  ${wide} { height: ${em(59)}; opacity: 1 }
  ${back} { height: 0; opacity: 0 }
}
@keyframes q-cursor {
  0%, ${pct(T.in)} { transform: ${at(FROM)}; opacity: 0 }
  ${pct(T.in + 0.2)} { opacity: 1 }
  ${pct(T.arrive)}, ${pct(T.press)} { transform: ${at(OVER)} }
  ${pct(T.press + 0.09)} { transform: ${at(OVER)} scale(0.86) }
  ${pct(T.press + 0.2)}, ${pct(T.reach)} { transform: ${at(OVER)} }
  ${pct(T.reach + 0.55)}, ${pct(T.out)} { transform: ${at(ONTO)}; opacity: 1 }
  ${pct(T.gone)}, 100% { transform: ${at(FROM)}; opacity: 0 }
}
@keyframes q-ring {
  0%, ${pct(T.press)} { transform: scale(0.3); opacity: 0 }
  ${pct(T.press + 0.05)} { opacity: 0.5 }
  ${pct(T.press + 0.55)}, 100% { transform: scale(1.6); opacity: 0 }
}
@media (prefers-reduced-motion: no-preference) {
  .q-decide { animation: q-decide ${CYCLE}s ease-in-out infinite both }
  .q-badge { animation: q-badge ${CYCLE}s ease-in-out infinite both }
  .q-scroll { animation: q-scroll ${CYCLE}s ease-in-out infinite both }
  .q-pill { animation: q-pill ${CYCLE}s ease-in-out infinite both }
  .q-bold { animation: q-bold ${CYCLE}s ease-in-out infinite both }
  .q-rec { animation: q-rec ${CYCLE}s ease-in-out infinite both }
  .q-foot { animation: q-foot ${CYCLE}s ease-in-out infinite both }
  .q-cursor { animation: q-cursor ${CYCLE}s ease-out infinite both }
  .q-ring { animation: q-ring ${CYCLE}s ease-out infinite both }
}
`;

// The `needs you` marker leads its question inline rather than sitting in a
// column, so the text wraps back underneath it. Its line box matches the
// question's so it centres on the first line instead of floating above it.
function NeedsYou() {
  const S = 10;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: em(4, S),
        marginRight: em(6, S),
        whiteSpace: "nowrap",
        fontSize: em(S),
        fontWeight: 700,
        lineHeight: em(18, S),
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: NB.accentDeep,
      }}
    >
      <ChipIcon>
        <FiUser style={{ width: "100%", height: "100%" }} />
      </ChipIcon>
      needs you
    </span>
  );
}

// The question's choices. Read, the marker's SHAPE says how many may be picked —
// round for one, square for as many as you like — and the recommended line wears
// it filled, in ember, and says so in words. Clicked, the same list is the tick
// list, each row on its own ground and the recommended one already ticked: a
// whole card of these is one confirm.
function Options() {
  return (
    <ul
      style={{
        display: "flex",
        flexDirection: "column",
        gap: em(4, 13),
        margin: 0,
        marginTop: em(6, 13),
        padding: 0,
        listStyle: "none",
      }}
    >
      {[...QUESTION.options, FREE_TEXT_CHOICE].map((option, i) => {
        const lit = i + 1 === QUESTION.recommend;
        const Icon = lit ? FiCheckCircle : FiCircle;
        return (
          <li
            key={option}
            className="q-pill"
            style={
              {
                display: "flex",
                alignItems: "baseline",
                gap: em(6, F),
                borderRadius: em(10, F),
                fontSize: em(F, 13),
                lineHeight: em(18, F),
                color: lit ? NB.accentDeep : undefined,
                // The ticked row takes the ember ground; the rest take the
                // paper the picker lays every choice on.
                "--pill": lit ? NB.accentSoft : "rgba(255, 255, 255, 0.6)",
                "--pw": lit ? 700 : 400,
              } as CSSProperties
            }
          >
            <Icon
              aria-hidden
              style={{
                position: "relative",
                top: em(2, F),
                width: em(12, F),
                height: em(12, F),
                flex: "0 0 auto",
              }}
            />
            <span>
              {option}
              {lit && (
                <span
                  className="q-rec"
                  style={{
                    marginLeft: em(6, F),
                    fontSize: em(10.5, F),
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  recommended
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** The pointer, and the ring its click leaves. Hidden until the animation moves
 *  it, so a still of this shot is the card alone. */
function Pointer() {
  const SIZE = 20;
  return (
    <span
      className="q-cursor"
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        opacity: 0,
        transform: at(FROM),
      }}
    >
      <span
        className="q-ring"
        style={{
          position: "absolute",
          left: em(-13),
          top: em(-13),
          width: em(26),
          height: em(26),
          borderRadius: "50%",
          border: `${em(1.5)} solid ${NB.accent}`,
          opacity: 0,
        }}
      />
      <svg
        viewBox="0 0 24 24"
        style={{
          display: "block",
          width: em(SIZE),
          height: em(SIZE),
          filter: `drop-shadow(0 ${em(1)} ${em(2)} rgba(36, 35, 31, 0.35))`,
        }}
      >
        <path
          d="M5 2.5 L5 19 L9.2 15 L11.8 21 L14.6 19.8 L12 14 L18 14 Z"
          fill={NB.paper}
          stroke={NB.ink}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function ShotCardQuestions() {
  return (
    <Shot crop={CROP}>
      {/* The pointer sits outside the scrolled page, the way a real one does:
          the panel comes to it. */}
      <div style={{ position: "relative" }}>
        <style>{MOTION}</style>
        <div className="q-scroll" style={{ padding: em(20) }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              columnGap: em(10),
              rowGap: em(8),
              marginBottom: em(32),
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
              #48
            </span>
            {/* keeps the title on the id's line — see ShotTaskGraph */}
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
              Run each implement in its own git worktree and merge it back to main
            </h1>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: em(8),
              marginBottom: em(16),
            }}
          >
            <Btn variant="accent" icon={<FiPlay style={{ width: "100%", height: "100%" }} />}>
              Implement
            </Btn>
            <Btn icon={<FiEdit2 style={{ width: "100%", height: "100%" }} />}>Edit</Btn>
            <Btn
              ink={NB.accentDeep}
              style={{ marginLeft: "auto" }}
              icon={<FiXCircle style={{ width: "100%", height: "100%" }} />}
            >
              Reject
            </Btn>
          </div>

          {/* the section this shot exists for */}
          <Section
            className="q-decide"
            style={{
              padding: em(14),
              background: NB.accentWash,
              marginBottom: em(16),
              // `.nb-decide` carries the border at rest so colouring it in on
              // hover moves nothing.
              border: `${em(1.5)} solid transparent`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: em(8),
                minHeight: em(22),
                marginBottom: em(8),
              }}
            >
              <Tag mark={<span style={{ color: NB.accent }}>?</span>}>open questions</Tag>
              {/* The affordance in words: the shadow says a block can be
                  clicked, this says what clicking it does. */}
              <span
                className="q-badge"
                style={{
                  marginLeft: "auto",
                  borderRadius: em(8, 10.5),
                  border: `1px solid color-mix(in srgb, ${NB.accentDeep} 40%, transparent)`,
                  padding: `${em(3, 10.5)} ${em(8, 10.5)}`,
                  fontSize: em(10.5),
                  fontWeight: 700,
                  lineHeight: em(14, 10.5),
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: NB.accentDeep,
                  opacity: 0,
                }}
              >
                decide
              </span>
            </div>
            <div style={{ fontSize: em(13), lineHeight: em(19, 13) }}>
              <span className="q-bold" style={{ display: "block" }}>
                <NeedsYou />
                {QUESTION.text}
              </span>
              <Options />
            </div>
            {/* Resolve, or resolve and keep going into implement in the same
                session. Closed, the row isn't there at all. */}
            <div
              className="q-foot"
              style={{ height: 0, opacity: 0, overflow: "hidden" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: em(8),
                  marginTop: em(14),
                  paddingTop: em(12),
                  borderTop: `1px solid ${HAIR}`,
                }}
              >
                <Btn>Close</Btn>
                <Btn>Resolve</Btn>
                <Btn variant="accent">Resolve &amp; implement</Btn>
              </div>
            </div>
          </Section>

          <Section style={{ padding: em(20) }}>
            <p style={{ margin: 0, fontSize: em(14), lineHeight: 1.65 }}>
              Give each implement run its own git worktree so two runs never write
              the same files, and merge the work back into main when the task is
              done.
            </p>
          </Section>
        </div>
        <Pointer />
      </div>
    </Shot>
  );
}
