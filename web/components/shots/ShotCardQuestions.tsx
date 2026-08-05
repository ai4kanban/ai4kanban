import { FiEdit2, FiHelpCircle, FiPlay, FiUser, FiXCircle } from "react-icons/fi";
import {
  Btn,
  CROP,
  ChipIcon,
  NB,
  Outline,
  Panel,
  Shot,
  Tag,
  em,
} from "./nb";

// Step 02 澄清需求 — the card hands back only the calls it can't make from the
// code and the memory: three product trade-offs, each tagged NEEDS YOU. Mirrors
// kanban-ui/components/CardPage.tsx's questions panel (the `open questions`
// block) and chips.tsx's `QuestionTagBadge`, with card #48's real questions.
//
// The real card puts its meta band between the toolbar and the questions. It
// isn't drawn: track/priority/roi are what step 01 is about, and at this crop
// the band pushed two of the three questions under the fade.

const QUESTIONS = [
  "When does the work merge into main — as soon as the run finishes, or only after you read the diff and click Archive?",
  "A run never commits today; a worktree merge needs commits. May the agent commit inside its own worktree, and who writes the commit message?",
  "What should happen when the merge into main conflicts — keep the worktree and tell the user, or something else?",
];

// The `needs you` marker leads its question inline rather than sitting in a
// column, so the text wraps back underneath it. Its line box matches the
// question's so it centres on the first line instead of floating above it.
function NeedsYou() {
  const F = 10.5;
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
            marginBottom: em(16),
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

        {/* Resolve joins the toolbar the moment a card has open questions */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: em(8),
            marginBottom: em(20),
          }}
        >
          <Btn variant="accent" icon={<FiPlay style={{ width: "100%", height: "100%" }} />}>
            Implement
          </Btn>
          <Btn icon={<FiEdit2 style={{ width: "100%", height: "100%" }} />}>Edit</Btn>
          <Btn icon={<FiHelpCircle style={{ width: "100%", height: "100%" }} />}>Resolve</Btn>
          <Btn
            ink={NB.accentDeep}
            style={{ marginLeft: "auto" }}
            icon={<FiXCircle style={{ width: "100%", height: "100%" }} />}
          >
            Reject
          </Btn>
        </div>

        {/* the section this shot exists for */}
        <Outline
          style={{
            padding: em(12),
            background: NB.accentSoft,
            marginBottom: em(12),
          }}
        >
          <div style={{ marginBottom: em(8) }}>
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
              <li key={q}>
                <NeedsYou />
                {q}
              </li>
            ))}
          </ul>
        </Outline>

        <Panel style={{ padding: em(20) }}>
          <p style={{ margin: 0, fontSize: em(14), lineHeight: 1.65 }}>
            Give each implement run its own git worktree so two runs never write
            the same files, and merge the work back into main when the task is
            done.
          </p>
        </Panel>
      </div>
    </Shot>
  );
}
