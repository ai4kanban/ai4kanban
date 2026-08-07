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

// Two flows, not one. These used to be a single 01→06 rail with a divider in
// the middle, which read as one pipeline handing off from our product to
// theirs — the opposite of what the section says. Each product numbers its own
// three steps from one.
export const oursStages: VsMulticaStageKey[] = [
  "discover",
  "refine",
  "prioritize",
];

export const theirsStages: VsMulticaStageKey[] = ["assign", "run", "review"];

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
