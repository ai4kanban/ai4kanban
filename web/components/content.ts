export const GITHUB_URL = "https://github.com/dist0com/ai4kanban";

// The "What it does" checklist from the README — everything here is built and
// working today.
export const features: { icon: string; title: string; body: string }[] = [
  {
    icon: "🧩",
    title: "Breaks work down",
    body: "The agent reads an idea and splits it into subtasks. An unrelated ask tangled in gets pulled out as a task of its own.",
  },
  {
    icon: "🔁",
    title: "Clarifies in a loop",
    body: "The agent starts by questioning the idea. Whatever memory and common sense can settle, it settles on its own; the rest comes to you. It keeps looping until it runs out of questions.",
  },
  {
    icon: "⏰",
    title: "Runs 24/7",
    body: "Breakdown and clarification keep running in the background until the idea becomes a clear spec.",
  },
  {
    icon: "🔍",
    title: "Every decision is traceable",
    body: "You can always see how a spec took shape, step by step.",
  },
  {
    icon: "💡",
    title: "Proposes its own tasks",
    body: "The agent pitches features drawn from each module's memory. Veto one and that's recorded — it won't pitch that kind of idea again.",
  },
  {
    icon: "🧠",
    title: "Self-evolving",
    body: "Each time you step in, that call is recorded and steers the agent's later decisions. Memory is organized by project module.",
  },
  {
    icon: "🧭",
    title: "Orders the work",
    body: "It doesn't just split tasks — it identifies dependencies and weighs ROI against effort, so work runs in the right order.",
  },
  {
    icon: "📦",
    title: "Owns the whole lifecycle",
    body: "Its job doesn't end once the spec is clear. It runs a task's entire life — proposed, clarified, built, archived — so the board always shows where the project really stands.",
  },
];

export const boardRows: { say: string; does: string }[] = [
  { say: '"/kanban what\'s next?"', does: "reads the board + your sources, proposes 3 new tasks" },
  { say: '"/kanban add a task: …"', does: "reviews the idea, writes a card, adds it to the index" },
  { say: '"/kanban refine #4"', does: "reviews card #4, then pushes it one stage toward concrete" },
  { say: '"/kanban review the board"', does: "checks cards for clarity, duplication, done-ness" },
  { say: '"/kanban #4 is done"', does: "compresses it into the archive, removes the card" },
  { say: '"/kanban #4 was a bad idea"', does: "records why in rejected.md so it's never re-proposed" },
];

// The local board UI: each card carries buttons that hand the work to an agent,
// so common moves don't have to be re-typed into the chat every time. Kept as
// short one-liners — the buttons are self-explanatory once you see the board.
export const uiActions: { icon: string; label: string; body: string }[] = [
  { icon: "🔨", label: "Implement", body: "hand the card to Claude to build" },
  { icon: "✏️", label: "Edit", body: "revise the card, don't run it" },
  { icon: "📈", label: "Refine", body: "push a stuck card one step on" },
  { icon: "❓", label: "Resolve", body: "answer the card's open questions" },
  { icon: "📦", label: "Archive", body: "file a finished card away" },
  { icon: "❌", label: "Reject", body: "drop a card and note why" },
];

// Recurring-task automation ladder: each run pushes a step up a rung.
export const ladderSteps: { tag: string; label: string }[] = [
  { tag: "[ask]", label: "you do it by hand" },
  { tag: "[agent]", label: "Claude does it for you" },
  { tag: "[script]", label: "a command runs it, no human" },
];

// Concrete recurring jobs — the kind you'd put on a daily or weekly loop.
export const recurringExamples: { label: string; body: string }[] = [
  { label: "Competitor tracking", body: "See what rivals shipped or changed, and flag anything worth a response." },
  { label: "Social listening", body: "Pull fresh posts from Reddit or Slack and surface the ones that matter." },
  { label: "Board review", body: "Sweep the backlog for stale, duplicate, or already-done cards." },
];

// The three sources the board pulls from when it proposes new work.
export const inputSources: { label: string; body: string }[] = [
  {
    label: "Your project",
    body: "Codebase, board, docs, team chat — it connects what's already here into work worth doing.",
  },
  {
    label: "The outside",
    body: "Reddit, Slack, your CRM. Recurring jobs pull in fresh signal and drop the findings on the board.",
  },
  {
    label: "You",
    body: "Your own steer and feedback, kept in the board so a good call is never lost or asked twice.",
  },
];

// The indie-hacker preset: growth-weighted tracks for a solo launch.
export const soloTracks: { name: string; weight: string; body: string }[] = [
  {
    name: "growth",
    weight: "50%",
    body: "Get in front of users — posts, outreach, launches. Claude suggests methods worth trying and drafts them.",
  },
  {
    name: "validation",
    weight: "30%",
    body: "Check the market wants it before you build deep. Post an honest question, share a trial, save the verdict.",
  },
  {
    name: "building",
    weight: "20%",
    body: "Stay at MVP. Build when it scales your work, strengthens the product, or users clearly ask for it.",
  },
];

// ── Quickview terminal snapshot ──────────────────────────────────────────────
// Data behind the Hero's interactive task tree. Every row carries both a task
// name and its on-disk file path, so the same tree can render either way — the
// two views the card stack flips between.
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

// The three stages of one loop. Propose reads the four files; Learn writes them
// back — so the next Propose builds on what happened instead of repeating it.
export const loopStages: { step: string; label: string; body: string }[] = [
  { step: "1", label: "Propose", body: "Pulls from three sources for work that isn't already shipped or shelved:" },
  { step: "2", label: "You decide", body: "Ship it, skip it, or fix the plan. A few words back to Claude is enough." },
  { step: "3", label: "Learn", body: "Folds the outcome and your feedback into the hub, so the next round starts sharper." },
];

// How the board keeps itself from repeating work across loops.
export const learnItems: { file: string; title: string; body: string }[] = [
  {
    file: "memory.md",
    title: "Memory",
    body: "Notes from each scan carry to the next, with a watermark per source — so it re-reads only what changed.",
  },
  {
    file: "archive.md",
    title: "Archive",
    body: "Shipped work shrinks to a plain line. It reads this before proposing, so it won't re-suggest what's done.",
  },
  {
    file: "rejected.md",
    title: "Rejected",
    body: "Ideas you turned down are kept with the reason, so it never floats them at you again.",
  },
  {
    file: "redesign.md",
    title: "Redesign",
    body: "A design mistake you corrected becomes a note, so the next card doesn't repeat the wrong plan.",
  },
];
