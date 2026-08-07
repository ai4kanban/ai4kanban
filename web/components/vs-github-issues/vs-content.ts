// Structure for /vs-github-issues — ordering and which side wins each row.
// The words live in `i18n/vs-github-issues/*.ts`, joined to these by key.
import type { VsGithubRowKey } from "@/i18n/vs-github-issues/types";

export type Edge = "kanban" | "issues" | "neutral";

// `edge` marks the winning cell with a check and the other with a cross; a
// "neutral" row is a deliberate trade-off — both sides get a dash, because it
// comes down to what you need rather than one being worse.
export const compareRows: { key: VsGithubRowKey; edge: Edge }[] = [
  { key: "storage", edge: "kanban" },
  { key: "tokenCost", edge: "kanban" },
  { key: "concurrency", edge: "issues" },
  { key: "history", edge: "issues" },
  { key: "contributors", edge: "issues" },
];
