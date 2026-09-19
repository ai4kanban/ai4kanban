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
    tooOldForMemory: "The board's rules this board runs are too old to read its memory.",
    tooOldForArchive: "The board's rules this board runs are too old to read its archive.",
    tooOldForSignals: "The board's rules this board runs are too old to use triage.",
    updateIt: "Run `npm install -g ai4kanban` to update it.",
  },
  tooOld: {
    autoDelivery: "this board's rules are older than auto-delivery — run `npm install -g ai4kanban`.",
    diffApproval: "this board's rules are older than diff approval — run `npm install -g ai4kanban`.",
    aiReview: "this board's rules are older than the review setting — run `npm install -g ai4kanban`.",
    silenceLimit: "this board's rules are older than the silence limit — run `npm install -g ai4kanban`.",
    deliveries: "this board's rules are older than deliveries — run `npm install -g ai4kanban`.",
    worktrees:
      "this board's rules are older than delivery worktrees — run `npm install -g ai4kanban`.",
    resumeDelivery:
      "this board's rules are older than carrying a delivery on — run `npm install -g ai4kanban`.",
    agents: "the board's rules in this project are too old to read and write this board's agents",
    language:
      "this board's rules are older than the language setting — run `npm install -g ai4kanban`.",
    skillInstall: "the board's rules in this project are too old to install the skill",
    specAgentSwitch: "the board's rules in this project are too old to switch a spec agent",
    specAgentSetting: "the board's rules in this project are too old to set a spec agent",
    runtimes:
      "this board's rules are older than named runtimes — run `npm install -g ai4kanban`.",
    usageReporting:
      "this board's rules are older than the usage-reporting setting — run `npm install -g ai4kanban`.",
    memoryPruner:
      "this board's rules are older than the memory pruner — run `npm install -g ai4kanban`.",
    cardSweeper:
      "this board's rules are older than sweeping stalled cards — run `npm install -g ai4kanban`.",
    dismissalReviewer:
      "this board's rules are older than learning from dismissals — run `npm install -g ai4kanban`.",
  },
  actions: {
    noSuchCard: "that is not a card on this board.",
    emptyChat: "say something to send.",
    noPlan: "this discussion has no plan to write cards from yet.",
    onePlan: "Build now takes one plan; start planning to use them all.",
  },
  run: { noProcess: "couldn't start a process for that run" },
  chat: {
    busy: "this conversation is still answering the last message.",
    sendFailed: "the message could not be sent.",
    clearFailed: "the conversation could not be cleared.",
    pickFailed: "what this conversation runs on could not be changed.",
  },
  mockup: {
    notAMockup: (src, exts) => `${src} — an asset is named .assets/<card id>/<name>, ending in ${exts}`,
    outside: (src) => `${src} — an asset is read from this card's asset folder, and this points outside it`,
    missing: (src) => `${src} — this file is not on this computer`,
    notDrawn: (src, why) => `${src} — this asset could not be shown: ${why}`,
    cannotImport: (id) =>
      `it imports "${id}", which is not available here — copy it into the asset's folder, or draw that part without it`,
    noSuchFile: (id) => `it imports "${id}", and there is no such file in the asset's folder`,
    outsideFolder: (id) => `it imports "${id}", and an asset only reads the files in its own folder`,
    tooManyFiles: (files) => `it pulls in more than ${files} files`,
    noDefault: "it exports no component as its default",
    tooSlow: (seconds) => `it did not finish drawing inside ${seconds} seconds`,
    noStylesheet: "the styles needed to draw this screen are missing",
  },
};

export default en;
