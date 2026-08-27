// English copy for the sentences `lib/` renders — the source of truth a second
// language mirrors key for key. Writing rules: `i18n/index.ts`.
import type { MessagesCopy } from "./types";

const en: MessagesCopy = {
  rules: {
    none: "This board has no copy of the board's rules to read it with — there is no `akb` on the PATH.",
    noneLookedIn: (paths) =>
      `This board has no copy of the board's rules to read it with — there is no \`akb\` on the PATH, and nothing at ${paths}.`,
    tooOld: (path) => `The board's rules at ${path} are too old for this board.`,
    installIt: "Run `npm install -g ai4kanban` to install one.",
    tooOldForCloud: "The board's rules in this project are too old to sign in to Cloud.",
    tooOldForChat: "This board's copy of the board's rules is too old to hold a conversation.",
    tooOldForHandChecks: "This board's copy of the rules is older than editing hand-checks.",
    tooOldForScores: "This board's copy of the rules is older than the planning scores.",
    tooOldForMemory: "The board's rules this board runs are too old to read its memory.",
    updateIt: "Run `npm install -g ai4kanban` to update it.",
  },
  tooOld: {
    autoDelivery: "this board's rules are older than auto-delivery — run `npm install -g ai4kanban`.",
    diffApproval: "this board's rules are older than diff approval — run `npm install -g ai4kanban`.",
    deliveries: "this board's rules are older than deliveries — run `npm install -g ai4kanban`.",
    worktrees:
      "this board's rules are older than delivery worktrees — run `npm install -g ai4kanban`.",
    flowRule: "the board's rules in this project are too old to save a flow rule",
    language:
      "this board's rules are older than the language setting — run `npm install -g ai4kanban`.",
    skillInstall: "the board's rules in this project are too old to install the skill",
    specAgentSwitch: "the board's rules in this project are too old to switch a spec agent",
    specAgentSetting: "the board's rules in this project are too old to set a spec agent",
  },
  run: { noProcess: "couldn't start a process for that run" },
  chat: {
    busy: "this conversation is still answering the last message.",
    sendFailed: "the message could not be sent.",
    clearFailed: "the conversation could not be cleared.",
  },
  mockup: {
    notAMockup: (src) => `${src} — a mockup is a .tsx, .html or .txt file under docs/kanban/.mockups/`,
    outside: (src) =>
      `${src} — a mockup is read from docs/kanban/.mockups/, and this points outside it`,
    missing: (src) => `${src} — no such file on this machine (mockups are not in git)`,
    notDrawn: (src, why) => `${src} — this mockup could not be drawn: ${why}`,
    importsOther: (id) => `it imports "${id}", and a mockup may import React and nothing else`,
    cannotImport: (id) => `cannot import "${id}"`,
    noDefault: "it exports no component as its default",
    tooSlow: (seconds) => `it did not finish drawing inside ${seconds} seconds`,
    noStylesheet: "Tailwind's stylesheet is not beside the app — the board cannot style a mockup",
  },
};

export default en;
