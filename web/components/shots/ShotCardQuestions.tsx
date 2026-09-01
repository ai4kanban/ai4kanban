import {
  FiCheckCircle,
  FiCircle,
  FiEdit2,
  FiPlay,
  FiUser,
  FiXCircle,
} from "react-icons/fi";
import { Btn, CROP, ChipIcon, NB, Section, Shot, Tag, em } from "./nb";

// Step 02 澄清需求 — the card hands back only the calls it can't make from the
// code and the memory: two product trade-offs, each tagged NEEDS YOU, each with
// the choices the agent found and the one it recommends. Mirrors
// kanban-ui/components/questions.tsx (`OpenQuestions` at rest, plus its
// `QuestionOptions` read-only list) and chips.tsx's `QuestionTagBadge`, with card
// #48's real questions.
//
// The panel IS the control on the real card: clicking it turns every recommended
// line into a live tick and puts Resolve under the list, so the decision is made
// against the question rather than in a dialog over it. That is why the toolbar
// here has no Resolve button — there isn't one any more.
//
// Nothing is framed. The panel is a `.nb-section` on the ember wash, which is one
// of exactly two grounds a card page spends colour on: ember where an answer is
// wanted, mint where the work is already done.
//
// The real card puts its meta box between the toolbar and the questions. It isn't
// drawn: track/priority/roi are what step 01 is about, and at this crop the box
// pushed the second question and its choices under the fade.

// Card #48's real questions, and the answers that settled them — the ones
// ShotDecisions then shows written back into the module's memory file.
const QUESTIONS: { text: string; options: string[]; recommend: number }[] = [
  {
    text: "When does the work merge into main — as soon as the run finishes, or only after you have read the diff?",
    options: [
      "Only after you read it — the run leaves the change in your tree",
      "As soon as the run finishes — main moves with nobody looking",
    ],
    recommend: 1,
  },
  {
    text: "A run never commits today; a worktree merge needs commits. May the agent commit inside its own worktree?",
    options: [
      "No — it leaves the change unstaged and you commit what you read",
      "Yes, inside its own worktree only — and it writes the message",
    ],
    recommend: 1,
  },
];

// The last choice on every options question, added by the UI rather than written
// onto the card (lib/questions.ts) — so "none of these" is a tick like the rest.
const FREE_TEXT_CHOICE = "Something else — I'll type it";

// The `needs you` marker leads its question inline rather than sitting in a
// column, so the text wraps back underneath it. Its line box matches the
// question's so it centres on the first line instead of floating above it.
function NeedsYou() {
  const F = 10;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: em(4, F),
        marginRight: em(6, F),
        whiteSpace: "nowrap",
        fontSize: em(F),
        fontWeight: 700,
        lineHeight: em(18, F),
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

// One question's choices, read-only. The marker's SHAPE says how many may be
// picked — round for one, square for as many as you like — and the recommended
// line wears it filled, in ember, and says so in words. Untouched, that line is
// what a click on the panel opens on, so a whole card of these is one confirm.
function Options({ options, recommend }: { options: string[]; recommend: number }) {
  const F = 12.5;
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
      {[...options, FREE_TEXT_CHOICE].map((option, i) => {
        const lit = i + 1 === recommend;
        const Icon = lit ? FiCheckCircle : FiCircle;
        return (
          <li
            key={option}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: em(6, F),
              fontSize: em(F, 13),
              lineHeight: em(18, F),
              color: lit ? NB.accentDeep : undefined,
            }}
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

export function ShotCardQuestions() {
  return (
    <Shot crop={CROP}>
      <div style={{ padding: em(20) }}>
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
          {/* see ShotCardReady — keeps the title on the id's line */}
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
          style={{
            padding: em(14),
            background: NB.accentWash,
            marginBottom: em(16),
          }}
        >
          <div style={{ minHeight: em(22), marginBottom: em(8) }}>
            <Tag mark={<span style={{ color: NB.accent }}>?</span>}>open questions</Tag>
          </div>
          <ul
            style={{
              display: "flex",
              flexDirection: "column",
              gap: em(10),
              margin: 0,
              padding: 0,
              listStyle: "none",
              fontSize: em(13),
              lineHeight: em(19, 13),
            }}
          >
            {QUESTIONS.map((q) => (
              <li key={q.text}>
                <NeedsYou />
                {q.text}
                <Options options={q.options} recommend={q.recommend} />
              </li>
            ))}
          </ul>
        </Section>

        <Section style={{ padding: em(20) }}>
          <p style={{ margin: 0, fontSize: em(14), lineHeight: 1.65 }}>
            Give each implement run its own git worktree so two runs never write
            the same files, and merge the work back into main when the task is
            done.
          </p>
        </Section>
      </div>
    </Shot>
  );
}
