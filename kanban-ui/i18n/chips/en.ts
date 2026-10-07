// English copy for the card chips — the source of truth a second language mirrors
// key for key. Writing rules: `i18n/index.ts`.
import type { ChipsCopy } from "./types";

const en: ChipsCopy = {
  level: { high: "high", med: "med", low: "low" },
  roi: (level) => `ROI ${level}`,
  status: {
    ready: "ready",
    readyLong: "Ready to build",
    implementing: "building",
    implementingLong: "Being built",
  },
  pending: "pending",
  schedule: {
    action: { implement: "build", refine: "refine", revise: "revise" },
    waiting: (action, ids) => `${action} · waiting on ${ids}`,
    queued: (action) => `${action} · queued`,
  },
  needsPro: "needs Pro",
  needsProHint: {
    upgrade: (action) => `${action[0]!.toUpperCase()}${action.slice(1)} is queued and starts once you upgrade to Pro`,
    signIn: (action) => `${action[0]!.toUpperCase()}${action.slice(1)} is queued and starts once you sign in with Pro`,
  },
  discussing: "discussing",
  discussingHint: "Its chat is writing a reply — the card is held until that reply lands.",
  failed: "unfinished",
  failedHint: "The last run on this card didn't finish. Open it to see what happened.",
  group: "Group task — open its page for subtasks",
  blockedOne: (ids) => `Blocked — ${ids} is still open`,
  blockedMany: (ids) => `Blocked — ${ids} are still open`,
  releaseStale: (version) => `${version} — not on the list`,
  question: { needsYou: "needs you", new: "new" },
};

export default en;
