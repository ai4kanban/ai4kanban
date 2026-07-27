// Structure for the landing page — everything that *isn't* words.
//
// The words moved to `i18n/en.ts` (and its four translations). What stays here
// is the ordering and the language-independent bits each row carries: an emoji,
// a file name, a track weight. Copy is joined to these by key.
import type {
  BoardRowKey,
  FeatureKey,
  InputSourceKey,
  LadderKey,
  LearnFileKey,
  LoopStageKey,
  RecurringExampleKey,
  SoloTrackKey,
  UiActionKey,
} from "@/i18n/types";

export const GITHUB_URL = "https://github.com/dist0com/ai4kanban";

// The "What it does" checklist from the README — everything here is built and
// working today.
export const featureOrder: FeatureKey[] = [
  "breakDown",
  "clarify",
  "alwaysOn",
  "traceable",
  "proposes",
  "selfEvolving",
  "orders",
  "lifecycle",
];

export const featureIcons: Record<FeatureKey, string> = {
  breakDown: "🧩",
  clarify: "🔁",
  alwaysOn: "⏰",
  traceable: "🔍",
  proposes: "💡",
  selfEvolving: "🧠",
  orders: "🧭",
  lifecycle: "📦",
};

export const boardRowOrder: BoardRowKey[] = [
  "whatsNext",
  "addTask",
  "refine",
  "review",
  "done",
  "badIdea",
];

// The local board UI: each card carries buttons that hand the work to an agent,
// so common moves don't have to be re-typed into the chat every time.
export const uiActionOrder: UiActionKey[] = [
  "implement",
  "edit",
  "refine",
  "resolve",
  "archive",
  "reject",
];

export const uiActionIcons: Record<UiActionKey, string> = {
  implement: "🔨",
  edit: "✏️",
  refine: "📈",
  resolve: "❓",
  archive: "📦",
  reject: "❌",
};

// Recurring-task automation ladder: each run pushes a step up a rung. The tags
// are the literal markers used in a card, so they stay English everywhere.
export const ladderOrder: LadderKey[] = ["ask", "agent", "script"];

export const ladderTags: Record<LadderKey, string> = {
  ask: "[ask]",
  agent: "[agent]",
  script: "[script]",
};

// Concrete recurring jobs — the kind you'd put on a daily or weekly loop.
export const recurringExampleOrder: RecurringExampleKey[] = [
  "competitors",
  "listening",
  "boardReview",
];

// The three sources the board pulls from when it proposes new work.
export const inputSourceOrder: InputSourceKey[] = [
  "project",
  "outside",
  "you",
];

// The indie-hacker preset: growth-weighted tracks for a solo launch. The track
// names are the folder names under `todo/`, so they aren't translated.
export const soloTrackOrder: SoloTrackKey[] = [
  "growth",
  "validation",
  "building",
];

export const soloTrackWeights: Record<SoloTrackKey, string> = {
  growth: "50%",
  validation: "30%",
  building: "20%",
};

// The three stages of one loop. Propose reads the four files; Learn writes them
// back — so the next Propose builds on what happened instead of repeating it.
export const loopStageOrder: LoopStageKey[] = ["propose", "decide", "learn"];

export const loopStageNumbers: Record<LoopStageKey, string> = {
  propose: "1",
  decide: "2",
  learn: "3",
};

// How the board keeps itself from repeating work across loops — one file each.
export const learnFileOrder: LearnFileKey[] = [
  "memory",
  "archive",
  "rejected",
  "redesign",
];

export const learnFileNames: Record<LearnFileKey, string> = {
  memory: "memory.md",
  archive: "archive.md",
  rejected: "rejected.md",
  redesign: "redesign.md",
};

// ── Quickview terminal snapshot ──────────────────────────────────────────────
// Data behind the Hero's interactive task tree. Every row carries both a task
// name and its on-disk file path, so the same tree can render either way — the
// two views the card stack flips between.
//
// This is a literal capture of a real board in a terminal, so it stays English
// in every language, same as the code blocks and the Markdown mirrors.
export type QvTask = {
  id: number;
  task: string; // human task name (default view)
  file: string; // path under docs/kanban/ (file view)
  tracking?: boolean; // append a muted "(tracking task)" in task view
  meta?: string; // trailing "(2 subtasks · 1 high)" — muted, both views
};

// The "… N more  med 11 · low 3 · unset 3" summary that closes a stage group.
export type QvMore = { more: number; counts?: string };

// A workflow stage (building / growth / …) with its own nested task rows.
export type QvGroup = {
  name: string;
  meta?: string; // "(23 · 6 high)"
  tasks: QvTask[];
  tail?: QvMore;
};

export const quickview: {
  date: string;
  open: number;
  high: number;
  todo: QvTask[];
  groups: QvGroup[];
} = {
  date: "2026-07-14",
  open: 102,
  high: 43,
  todo: [
    { id: 74, task: "Digest runs fully automate themselves", file: "74-digest-automation/root.md", meta: "(2 subtasks · 1 high)" },
    { id: 82, task: "Activation on-ramp", file: "82-activation-on-ramp/root.md", meta: "(6 subtasks · 5 high)" },
    { id: 89, task: "The dist0 API", file: "89-public-api/root.md", meta: "(7 subtasks)" },
    { id: 105, task: "Concierge plan", file: "105-concierge-plan/root.md", meta: "(7 subtasks · 4 high)" },
    { id: 106, task: "Lifecycle emails", file: "106-lifecycle-emails/root.md", meta: "(4 subtasks · 3 high)" },
    { id: 114, task: "Content editor + framework", file: "114-content-editor/root.md", tracking: true, meta: "(2 subtasks)" },
    { id: 126, task: "Self-promo", file: "126-self-promo/root.md", meta: "(4 subtasks · 1 high)" },
    { id: 132, task: "Migrate snapulse free tools to dist0", file: "132-snapulse-free-tools/root.md", tracking: true, meta: "(4 subtasks)" },
    { id: 144, task: "v2 launch: the Reddit signal layer", file: "144-v2-launch/root.md", tracking: true, meta: "(5 subtasks · 5 high)" },
    { id: 156, task: 'Own "reddit market research" across our pages', file: "156-reddit-market-research/root.md", meta: "(6 subtasks · 3 high)" },
    { id: 163, task: "Free tool maker offer", file: "163-free-tool-maker/root.md", tracking: true, meta: "(2 subtasks)" },
  ],
  groups: [
    {
      name: "building",
      meta: "(23 · 6 high)",
      tasks: [
        { id: 19, task: "Capture Slack emoji feedback and feed it back into the project", file: "building/19-emoji-feedback-flywheel.md" },
        { id: 24, task: "Fill the empty help-guide bodies", file: "building/24-fill-help-guide-bodies.md" },
        { id: 46, task: "sweep every user-facing surface to pain-first positioning", file: "building/46-pain-first-surface-sweep.md" },
        { id: 64, task: "Consistent delivery across email, Slack, and the web app", file: "building/64-multi-channel-delivery-consistency.md" },
        { id: 86, task: "Let the user confirm their inferred business profile before t…", file: "building/86-confirm-inferred-profile-onboarding.md" },
        { id: 87, task: 'Show a "your first brief is on its way" state right after sig…', file: "building/87-first-brief-on-its-way-state.md" },
      ],
      tail: { more: 17, counts: "med 11 · low 3 · unset 3" },
    },
    {
      name: "growth",
      meta: "(12 · 3 high)",
      tasks: [
        { id: 10, task: "Run dist0 on dist0 and do the outreach by hand", file: "growth/10-dogfood-outreach-casestudy.md" },
        { id: 29, task: "Win-back campaign: re-grant trial + newsletter to dormant exi…", file: "growth/29-winback-trial-campaign.md" },
        { id: 30, task: 'Build-in-public blog: "I made Claude Code my project manager"', file: "growth/30-claude-code-as-pm-blog.md" },
      ],
      tail: { more: 9, counts: "med 9" },
    },
    {
      name: "validation",
      meta: "(5 · 4 high)",
      tasks: [
        { id: 25, task: "Does the ICP actually live in Slack?", file: "validation/25-slack-as-primary-ui-fit.md" },
        { id: 33, task: "Validate paid demand for buyer-pain briefs", file: "validation/33-buyer-pain-brief-positioning.md" },
        { id: 113, task: 'Check demand for a self-serve "pain → draft you edit"', file: "validation/113-self-serve-draft-generator-demand.md" },
        { id: 118, task: "Will marketers post the reply we draft, on Reddit themselves?", file: "validation/118-will-marketers-post-reddit-replies.md" },
      ],
      tail: { more: 1, counts: "med 1" },
    },
    {
      name: "recurring",
      meta: "(2 · 1 high)",
      tasks: [
        { id: 49, task: "stand up the weekly pattern-report publishing cadence (core S…", file: "recurring/49-pattern-report-publishing-cadence.md" },
        { id: 158, task: "competitor-analysis loop (clean the signal, mine the real one…", file: "recurring/158-competitor-analysis-loop/root.md" },
      ],
    },
  ],
};
