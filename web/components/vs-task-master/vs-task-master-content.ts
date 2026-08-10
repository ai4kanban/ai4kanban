import type {
  VsTaskMasterKanbanWinKey,
  VsTaskMasterRowKey,
  VsTaskMasterWinKey,
} from "@/i18n/vs-task-master/types";

export type TaskMasterEdge = "kanban" | "taskMaster" | "neutral";

// Row order and which side each row goes to — structure, not words, so it stays
// out of `i18n/`. The two rows this page is really about come first; the rows
// Task Master takes are not buried at the bottom.
export const compareRows: { key: VsTaskMasterRowKey; edge: TaskMasterEdge }[] = [
  { key: "startingPoint", edge: "kanban" },
  { key: "vagueRequest", edge: "kanban" },
  { key: "board", edge: "kanban" },
  { key: "setup", edge: "kanban" },
  { key: "execution", edge: "taskMaster" },
  { key: "memory", edge: "kanban" },
  { key: "reach", edge: "taskMaster" },
  { key: "teams", edge: "taskMaster" },
  { key: "license", edge: "neutral" },
];

export const kanbanWinOrder: VsTaskMasterKanbanWinKey[] = [
  "asksFirst",
  "diffablePlan",
  "moduleMemory",
  "nothingToWire",
];

export const kanbanWinIcons: Record<VsTaskMasterKanbanWinKey, string> = {
  asksFirst: "❓",
  diffablePlan: "📝",
  moduleMemory: "🧠",
  nothingToWire: "📦",
};

export const taskMasterWinOrder: VsTaskMasterWinKey[] = [
  "everywhere",
  "research",
  "batchRuns",
  "proven",
];

export const taskMasterWinIcons: Record<VsTaskMasterWinKey, string> = {
  everywhere: "🔌",
  research: "🔍",
  batchRuns: "🌙",
  proven: "⭐",
};
