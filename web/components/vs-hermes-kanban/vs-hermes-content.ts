// Structure for /vs-hermes-kanban — ordering and which side wins each row.
// The words live in `i18n/vs-hermes-kanban/*.ts`, joined to these by key.
//
// Framing (important): compare like for like — ai4kanban on a harness
// (e.g. Claude Code) vs. the Hermes Kanban feature on the Hermes runtime. Both
// harnesses already give you parallel subagents, worktree isolation, fan-out /
// pipeline / voting, human-in-the-loop, transcripts, and a dashboard, so those
// wash out. What's genuinely specific to Hermes Kanban is the durable, shared
// SQLite work queue (many named agents + humans claim tasks; crash recovery) and
// dispatcher-run auto-decomposition. What's specific to the skill is being plain
// diffable files, agent-agnostic (it even runs on Hermes), and zero infra.
import type {
  VsHermesKanbanWinKey,
  VsHermesRowKey,
  VsHermesStopKey,
  VsHermesWinKey,
} from "@/i18n/vs-hermes-kanban/types";

export type HkEdge = "kanban" | "hermes" | "neutral";

// `edge` marks the winning cell with a check and the other with a cross; a
// "neutral" row is a deliberate trade-off — both sides get a dash, because it
// comes down to what you need rather than one being worse.
// Agent-runtime compatibility isn't a row here — it gets its own logo-bar
// section (HkHarness), which reads faster than prose in a table cell.
export const compareRows: { key: VsHermesRowKey; edge: HkEdge }[] = [
  { key: "whatItIs", edge: "neutral" },
  { key: "infrastructure", edge: "kanban" },
  { key: "whereBoardLives", edge: "kanban" },
  { key: "setup", edge: "kanban" },
  { key: "parallelRuns", edge: "neutral" },
  { key: "crashRecovery", edge: "hermes" },
  { key: "decomposition", edge: "neutral" },
  { key: "reviewMemory", edge: "neutral" },
  { key: "dashboard", edge: "neutral" },
  { key: "scale", edge: "hermes" },
];

// "Where each wins" cards. Titles are self-descriptive — the title alone should
// tell you what the card is about. Each side lists only what survives factoring
// out shared harness features.
export const kanbanWinOrder: VsHermesKanbanWinKey[] = [
  "noInfra",
  "diffable",
  "selfPruning",
  "onePrompt",
];

export const kanbanWinIcons: Record<VsHermesKanbanWinKey, string> = {
  noInfra: "⚡",
  diffable: "📦",
  selfPruning: "🧠",
  onePrompt: "🪶",
};

export const hermesWinOrder: VsHermesWinKey[] = [
  "manyAgents",
  "selfHealing",
  "autoDecompose",
  "fleetReach",
];

export const hermesWinIcons: Record<VsHermesWinKey, string> = {
  manyAgents: "🤝",
  selfHealing: "🔁",
  autoDecompose: "🧩",
  fleetReach: "📡",
};

// The autonomy spectrum: three stops from "you plan everything" (a traditional
// board) to "agent plans everything" (Hermes's "drop a one-liner, walk away").
// `left` is where the stop's knob sits on the slider.
export const autonomyStops: {
  key: VsHermesStopKey;
  left: string;
  ours?: boolean;
}[] = [
  { key: "traditional", left: "16.67%" },
  { key: "kanban", left: "50%", ours: true },
  { key: "hermes", left: "83.33%" },
];
