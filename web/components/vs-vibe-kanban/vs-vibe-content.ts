// Structure for /vs-vibe-kanban — ordering and which side wins each row.
// The words live in `i18n/*.ts` under `vsVibe`, joined to these by key.
//
// The honest framing this page is built on: Vibe Kanban is an agent-
// orchestration cockpit (a local web app that runs many coding agents in
// parallel, each in its own git worktree, with inline diff review). The kanban
// skill is a planning board an agent edits as plain Markdown in your repo. They
// fix different bottlenecks — the page says so plainly so we don't pull in
// people who came for parallel orchestration.
import type {
  VsVibeKanbanWinKey,
  VsVibeRowKey,
  VsVibeWinKey,
} from "@/i18n/types";

export type Edge = "kanban" | "vibe" | "neutral";

// `edge` marks the winning cell with a check and the other with a cross; a
// "neutral" row is a deliberate trade-off — both sides get a dash, because it
// comes down to what you need rather than one being worse.
// Vibe Kanban genuinely wins the orchestration and review rows; we say so.
export const compareRows: { key: VsVibeRowKey; edge: Edge }[] = [
  { key: "whatFor", edge: "neutral" },
  { key: "orchestration", edge: "vibe" },
  { key: "review", edge: "vibe" },
  { key: "planning", edge: "kanban" },
  { key: "onDisk", edge: "kanban" },
  { key: "runsAs", edge: "kanban" },
  { key: "setup", edge: "kanban" },
  { key: "whichAgents", edge: "neutral" },
  { key: "lockIn", edge: "kanban" },
  { key: "maintenance", edge: "kanban" },
];

// "Where each wins" cards.
export const kanbanWinOrder: VsVibeKanbanWinKey[] = [
  "nothingRunning",
  "planning",
  "outlives",
  "anyAgent",
];

export const kanbanWinIcons: Record<VsVibeKanbanWinKey, string> = {
  nothingRunning: "📦",
  planning: "🎯",
  outlives: "🔓",
  anyAgent: "🔀",
};

export const vibeWinOrder: VsVibeWinKey[] = [
  "parallel",
  "reviewInPlace",
  "boardUi",
  "support",
];

export const vibeWinIcons: Record<VsVibeWinKey, string> = {
  parallel: "⚡",
  reviewInPlace: "🔎",
  boardUi: "🖥️",
  support: "🧩",
};
