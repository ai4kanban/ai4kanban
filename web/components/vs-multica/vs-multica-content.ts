import type {
  VsMulticaKanbanWinKey,
  VsMulticaRowKey,
  VsMulticaStageKey,
  VsMulticaWinKey,
} from "@/i18n/vs-multica/types";

export type MulticaEdge = "kanban" | "multica" | "neutral";

export const compareRows: { key: VsMulticaRowKey; edge: MulticaEdge }[] = [
  { key: "startingPoint", edge: "kanban" },
  { key: "backlog", edge: "kanban" },
  { key: "refinement", edge: "kanban" },
  { key: "memory", edge: "kanban" },
  { key: "execution", edge: "multica" },
  { key: "teams", edge: "multica" },
  { key: "storage", edge: "neutral" },
  { key: "license", edge: "kanban" },
];

export const stageOrder: VsMulticaStageKey[] = [
  "discover",
  "refine",
  "prioritize",
  "assign",
  "run",
  "review",
];

export const kanbanWinOrder: VsMulticaKanbanWinKey[] = [
  "upstream",
  "rejectionMemory",
  "repoNative",
];

export const kanbanWinIcons: Record<VsMulticaKanbanWinKey, string> = {
  upstream: "✦",
  rejectionMemory: "↩",
  repoNative: "⌘",
};

export const multicaWinOrder: VsMulticaWinKey[] = [
  "operations",
  "teams",
  "runtimeReach",
];

export const multicaWinIcons: Record<VsMulticaWinKey, string> = {
  operations: "↻",
  teams: "◎",
  runtimeReach: "20",
};
