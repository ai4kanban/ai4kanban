// Structure for /vs-vibe-kanban — ordering and which side wins each row.
// The words live in `i18n/vs-vibe-kanban/*.ts`, joined to these by key.
//
// The comparison rests on a clear distinction: Vibe Kanban is a local app for
// running coding agents in parallel, isolating each one in a git worktree, and
// reviewing their output. AI4Kanban is a planning workflow an agent maintains
// as plain Markdown in the repository. They address different bottlenecks.
import type {
  VsVibeKanbanWinKey,
  VsVibeRowKey,
  VsVibeWinKey,
} from "@/i18n/vs-vibe-kanban/types";

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
