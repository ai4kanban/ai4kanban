// English copy for the card chips — the source of truth a second language mirrors
// key for key. Writing rules: `i18n/index.ts`.
import type { ChipsCopy } from "./types";

const en: ChipsCopy = {
  level: { high: "high", med: "med", low: "low" },
  roi: (level) => `ROI ${level}`,
  status: {
    ready: "ready",
    readyLong: "Ready to implement",
    implementing: "implementing",
    implementingLong: "Being implemented",
  },
  pending: "pending",
  group: "Group task — open its page for subtasks",
  blockedOne: (ids) => `Blocked — ${ids} is still open`,
  blockedMany: (ids) => `Blocked — ${ids} are still open`,
  releaseStale: (version) => `${version} — not on the list`,
  cadence: {
    every: "every",
    at: "at",
    count: "How many",
    time: "Time of day",
    minutes: "minutes",
    hours: "hours",
    days: "days",
    none: "No cadence",
  },
  question: { needsYou: "needs you", new: "new" },
};

export default en;
