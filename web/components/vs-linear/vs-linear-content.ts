import type {
  VsLinearKanbanWinKey,
  VsLinearRowKey,
  VsLinearWinKey,
} from "@/i18n/vs-linear/types";

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

// The Chinese page uses a shorter editorial path. These are the six decisions
// that materially distinguish the two products; the full matrix remains in
// place for every other locale.
const essentialRowKeys = new Set<VsLinearRowKey>([
  "bestFit",
  "sourceOfTruth",
  "refinement",
  "execution",
  "collaboration",
  "portfolio",
]);

export const essentialCompareRows = compareRows.filter(({ key }) =>
  essentialRowKeys.has(key),
);

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
