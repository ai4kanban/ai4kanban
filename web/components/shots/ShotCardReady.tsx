import { FiEdit2, FiPlay, FiTag, FiXCircle } from "react-icons/fi";
import {
  Btn,
  CROP,
  Chip,
  ChipIcon,
  Code,
  IdChip,
  MetaItem,
  NB,
  Outline,
  Panel,
  Shot,
  Todos,
  em,
} from "./nb";

// Step 01 明确任务 — a card the agent wrote and vetted: what it decided to do
// next, which module it lands in, how it ranked it, and why. Mirrors
// kanban-ui/components/CardPage.tsx (title band → toolbar → meta band → body
// panel) with card #67's real content.
//
// Two things the real card carries are left off, both because they belong to a
// later step and the crop only has room for what this one is about: the
// finished run-log bar between the toolbar and the meta band (step 03), and
// the mint "Ready to implement" pill beside the title, which is what step 02
// ends with rather than what step 01 produces. So this draws a card still
// sitting at `todo` — which is the honest state for "the agent decided this is
// next" anyway.

// `.nb-md` block rhythm: consecutive blocks take a gap, headings own the space
// above them and tighten the gap to whatever follows.
const P = { margin: 0, marginTop: em(14), lineHeight: 1.65 } as const;

export function ShotCardReady() {
  return (
    <Shot crop={CROP}>
      <div style={{ padding: em(20) }}>
        {/* title band — the decision, in words */}
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
            #67
          </span>
          {/* `flex: 1 1 0` keeps the title on the id's line and wraps it inside
              its own box. Without it the title's max-content width decides the
              wrap, and at this scale that drops the id onto a line of its own. */}
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
            Handle a failed agent run instead of just marking it red
          </h1>
        </div>

        {/* toolbar — visibleActions() for a ready, un-questioned card */}
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
          <Btn
            ink={NB.accentDeep}
            style={{ marginLeft: "auto" }}
            icon={<FiXCircle style={{ width: "100%", height: "100%" }} />}
          >
            Reject
          </Btn>
        </div>

        {/* meta band — where the card sits and how it was ranked */}
        <Outline
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            columnGap: em(28),
            rowGap: em(12),
            padding: `${em(12)} ${em(16)}`,
            background: NB.paper,
            marginBottom: em(16),
          }}
        >
          <MetaItem label="Track">
            <Chip bg={NB.lilacSoft} ink={NB.lilacInk}>
              features
            </Chip>
          </MetaItem>
          <MetaItem label="Modules">
            <Chip
              bg={NB.mintSoft}
              ink={NB.mintInk}
              icon={
                <ChipIcon>
                  <svg viewBox="0 0 24 24" style={{ width: "100%", height: "100%", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </ChipIcon>
              }
            >
              local-ui
            </Chip>
          </MetaItem>
          <MetaItem label="Release">
            <Chip
              bg={NB.wash}
              ink={NB.inkSoft}
              chevron
              icon={
                <ChipIcon>
                  <FiTag style={{ width: "100%", height: "100%" }} />
                </ChipIcon>
              }
            >
              —
            </Chip>
          </MetaItem>
          <MetaItem label="Priority">
            <Chip bg={NB.peachSoft} ink={NB.peachInk} chevron>
              high
            </Chip>
          </MetaItem>
          <MetaItem label="ROI">
            <Chip bg={NB.peachSoft} ink={NB.peachInk} chevron>
              high
            </Chip>
          </MetaItem>
          <MetaItem label="Todos">
            <Todos done={0} total={13} />
          </MetaItem>
          <MetaItem label="Related">
            <IdChip id={16} />
            <IdChip id={51} />
          </MetaItem>
        </Outline>

        {/* body — the agent's own reasoning for the card, then its scope */}
        <Panel style={{ padding: em(20) }}>
          <div style={{ fontSize: em(14), lineHeight: 1.65 }}>
            <p style={{ margin: 0, lineHeight: 1.65 }}>
              Say why an agent run failed, and stop the dispatcher from retrying
              a failure it can&apos;t fix.
            </p>
            <p style={P}>
              Right now every failure looks the same: the board marks a run
              failed when the exit code isn&apos;t 0, and that is all anyone
              learns. A run that hit the plan&apos;s usage limit, a run that
              crashed, and a run where <Code>claude</Code> isn&apos;t installed
              can&apos;t be told apart. Worse, auto-refine wakes a minute later
              and starts the same run again — this board once logged 12 runs in a
              row on one card, one a minute, every one of them the same limit.
            </p>
            <h2
              style={{
                margin: 0,
                marginTop: em(26),
                fontSize: em(17),
                fontWeight: 800,
                lineHeight: 1.22,
              }}
            >
              Scope
            </h2>
            <h3
              style={{
                margin: 0,
                marginTop: em(22),
                fontSize: em(15),
                fontWeight: 700,
                lineHeight: 1.3,
              }}
            >
              Name the reason
            </h3>
            <p style={{ margin: 0, marginTop: em(8), lineHeight: 1.65 }}>
              Read the run&apos;s output and record which of them it was: usage
              limit, crash, or a harness that isn&apos;t installed.
            </p>
          </div>
        </Panel>
      </div>
    </Shot>
  );
}
