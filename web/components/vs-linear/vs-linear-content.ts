import type {
  VsLinearKanbanWinKey,
  VsLinearRowKey,
  VsLinearWinKey,
} from "@/i18n/types";

export type LinearEdge = "kanban" | "linear" | "neutral";

export const compareRows: { key: VsLinearRowKey; edge: LinearEdge }[] = [
  { key: "bestFit", edge: "neutral" },
  { key: "sourceOfTruth", edge: "kanban" },
  { key: "refinement", edge: "kanban" },
  { key: "agentModel", edge: "neutral" },
  { key: "execution", edge: "linear" },
  { key: "collaboration", edge: "linear" },
  { key: "portfolio", edge: "linear" },
  { key: "setup", edge: "kanban" },
  { key: "portability", edge: "kanban" },
  { key: "pricing", edge: "neutral" },
];

export const kanbanWinOrder: VsLinearKanbanWinKey[] = [
  "roughToReady",
  "repoMemory",
  "anyHarness",
  "noSaas",
];

export const kanbanWinIcons: Record<VsLinearKanbanWinKey, string> = {
  roughToReady: "🎯",
  repoMemory: "📝",
  anyHarness: "🔀",
  noSaas: "📦",
};

export const linearWinOrder: VsLinearWinKey[] = [
  "teamSystem",
  "agentPlatform",
  "planningDepth",
  "integrations",
];

export const linearWinIcons: Record<VsLinearWinKey, string> = {
  teamSystem: "👥",
  agentPlatform: "🤖",
  planningDepth: "🗺️",
  integrations: "🔌",
};
