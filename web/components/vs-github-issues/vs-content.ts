// Structure for /vs-github-issues — ordering and which side wins each row.
// The words live in `i18n/vs-github-issues/*.ts`, joined to these by key.
import type {
  VsGithubIssuesWinKey,
  VsGithubKanbanWinKey,
  VsGithubRowKey,
} from "@/i18n/vs-github-issues/types";

export type Edge = "kanban" | "issues" | "neutral";

// `edge` marks the winning cell with a check and the other with a cross; a
// "neutral" row is a deliberate trade-off — both sides get a dash, because it
// comes down to what you need rather than one being worse.
export const compareRows: { key: VsGithubRowKey; edge: Edge }[] = [
  { key: "storage", edge: "kanban" },
  { key: "offline", edge: "kanban" },
  { key: "agentReads", edge: "kanban" },
  { key: "tokenCost", edge: "kanban" },
  { key: "latency", edge: "kanban" },
  { key: "setup", edge: "kanban" },
  { key: "lockIn", edge: "kanban" },
  { key: "metadata", edge: "neutral" },
  { key: "concurrency", edge: "issues" },
  { key: "history", edge: "issues" },
  { key: "closing", edge: "neutral" },
  { key: "search", edge: "issues" },
  { key: "contributors", edge: "issues" },
  { key: "transparency", edge: "neutral" },
];

// "Where each wins" cards.
export const kanbanWinOrder: VsGithubKanbanWinKey[] = [
  "tokenLight",
  "agentsUseIt",
  "offline",
  "memory",
];

export const kanbanWinIcons: Record<VsGithubKanbanWinKey, string> = {
  tokenLight: "⚡",
  agentsUseIt: "🧠",
  offline: "📦",
  memory: "🎯",
};

export const issuesWinOrder: VsGithubIssuesWinKey[] = [
  "teams",
  "transparency",
  "fullContext",
  "integration",
];

export const issuesWinIcons: Record<VsGithubIssuesWinKey, string> = {
  teams: "👥",
  transparency: "🌐",
  fullContext: "🗂️",
  integration: "🔗",
};

// The agent-ergonomics terminal comparison: two transcripts of the same ask.
// The copy supplies the lines; this says what each line *is*, so the two arrays
// stay index-aligned with `ergonomics.issues.lines` / `.kanban.lines`.
export type ErgoKind = "you" | "call" | "out";

export const ergoIssuesKinds: ErgoKind[] = ["you", "call", "out", "call", "out"];
export const ergoKanbanKinds: ErgoKind[] = ["you", "call", "out", "out"];
