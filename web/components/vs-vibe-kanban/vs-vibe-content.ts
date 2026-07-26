// Content for the /vs-vibe-kanban/ page — ai4kanban vs. Vibe Kanban.
// Kept apart from the other vs pages' content so each evolves independently.
//
// The honest framing this page is built on: Vibe Kanban is an agent-
// orchestration cockpit (a local web app that runs many coding agents in
// parallel, each in its own git worktree, with inline diff review). The kanban
// skill is a planning board an agent edits as plain Markdown in your repo. They
// fix different bottlenecks — the page says so plainly so we don't pull in
// people who came for parallel orchestration.

export type Edge = "kanban" | "vibe" | "neutral";

// The side-by-side matrix. `edge` marks the winning cell with a check and the
// other with a cross; a "neutral" row is a deliberate trade-off — both sides get
// a dash, because it comes down to what you need rather than one being worse.
// Vibe Kanban genuinely wins the orchestration and review rows; we say so.
export const compareRows: {
  dimension: string;
  kanban: string;
  vibe: string;
  edge: Edge;
}[] = [
  {
    dimension: "What it's for",
    kanban: "A planning board your agent edits in the repo — line up and sharpen the work.",
    vibe: "A cockpit to run many coding agents in parallel and review what they produce.",
    edge: "neutral",
  },
  {
    dimension: "Parallel-agent orchestration",
    kanban: "None — you drive one agent; the board doesn't run agents.",
    vibe: "Its core strength — many agents at once, each in an isolated git worktree.",
    edge: "vibe",
  },
  {
    dimension: "Review of agent output",
    kanban: "Not its job — your harness shows the diffs.",
    vibe: "Built in — inline diff review, live preview, and pull-request handling.",
    edge: "vibe",
  },
  {
    dimension: "Planning & refinement",
    kanban: "A refine loop turns a rough idea into a ready, concrete task.",
    vibe: "Minimal — the board mostly queues and tracks agent runs.",
    edge: "kanban",
  },
  {
    dimension: "What it is on disk",
    kanban: "Plain Markdown in your repo, in git.",
    vibe: "A local SQLite database in a config directory.",
    edge: "kanban",
  },
  {
    dimension: "Runs as",
    kanban: "Just files — no server, nothing to keep alive.",
    vibe: "A local web app (Rust backend + web UI) you start and keep running.",
    edge: "kanban",
  },
  {
    dimension: "Setup",
    kanban: "One prompt: a skill file and a small script.",
    vibe: "npx vibe-kanban, plus each agent CLI installed and signed in.",
    edge: "kanban",
  },
  {
    dimension: "Which agents run it",
    kanban: "Any agent that can read files — Claude Code, Codex, Cursor, more.",
    vibe: "The agent CLIs it wires up — Claude Code, Codex, Gemini, and others.",
    edge: "neutral",
  },
  {
    dimension: "Vendor lock-in",
    kanban: "None — the board is files that travel with the repo.",
    vibe: "Apache-2.0 and self-hosted, and a data export shipped before shutdown.",
    edge: "kanban",
  },
  {
    dimension: "Who maintains it",
    kanban: "Actively maintained.",
    vibe: "Bloop shut down in April 2026; the original repo has since stalled.",
    edge: "kanban",
  },
];

// "Where each wins" cards.
export const kanbanWins: { icon: string; title: string; body: string }[] = [
  {
    icon: "📦",
    title: "Nothing to keep running",
    body: "The board is plain Markdown in your repo — no web app, no database, no server. Nothing to install past the agent you already run, and nothing that can go offline.",
  },
  {
    icon: "🎯",
    title: "Planning, not just queuing",
    body: "A refine loop digs into the missing pieces and turns a rough idea into a ready, concrete card you approve before any code is written. Vibe Kanban's board mostly queues agent runs.",
  },
  {
    icon: "🔓",
    title: "Outlives any company",
    body: "No SaaS, no bundled runtime, no repo that can stall. The board is files in git — clone the repo and it comes with you. Bloop shutting down is exactly the risk this avoids.",
  },
  {
    icon: "🔀",
    title: "Any agent, any time",
    body: "It's just files, so any file-reading agent can drive it — Claude Code, Codex, Cursor, whatever you switch to next. You're not tied to one tool's list of supported CLIs.",
  },
];

export const vibeWins: { icon: string; title: string; body: string }[] = [
  {
    icon: "⚡",
    title: "Runs many agents at once",
    body: "Its whole reason to exist: fan work out to several coding agents in parallel, each isolated in its own git branch and worktree so they never collide. ai4kanban doesn't run agents at all.",
  },
  {
    icon: "🔎",
    title: "Execute-and-review in one place",
    body: "Inline diff review, a built-in browser to preview the app, and pull-request handling — all in the cockpit. You watch and steer agent output without leaving the board.",
  },
  {
    icon: "🖥️",
    title: "A real board UI",
    body: "A web board built to drive agent runs — spin up a task, watch it work, switch between workspaces. Purpose-built for orchestration, not a plain file you grep.",
  },
  {
    icon: "🧩",
    title: "Broad agent support",
    body: "First to market on multi-agent orchestration, with many agent CLIs wired up out of the box — Claude Code, Codex, Gemini, and more.",
  },
];

// The two decision columns.
export const decisionKanban: string[] = [
  "You want a planning board your agent edits right in the repo.",
  "You want zero infrastructure — files in git, nothing to run or keep alive.",
  "You'd rather not tie your board to a product that can shut down.",
  "You drive one agent at a time and value a clear plan over parallelism.",
];

export const decisionVibe: string[] = [
  "You want to run many coding agents in parallel, each isolated.",
  "You want inline diff review and live preview in one cockpit.",
  "Orchestrating and reviewing agent runs is your real bottleneck.",
  "You're fine depending on a community fork now that Bloop has shut down.",
];
