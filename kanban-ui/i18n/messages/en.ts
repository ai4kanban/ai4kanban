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
    tooOldForNotifications: "The board's rules in this project are too old for Cloud notifications.",
    tooOldForPictures: "This board's command is too old to take a picture. Update it.",
    tooOldForSetup: "This board's rules are too old to hold the first-run conversation.",
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
    onePlan: "Start now takes one plan; use Plan tasks for them all.",
    exportFolder: "Name the folder to write the board into.",
  },
  run: { noProcess: "couldn't start a process for that run" },
  refusal: {
    dirty: () => "Commit or stash these changes first",
    busy: () => "A task is already being built in this folder",
    worktree: () => "The branch and working folder for this task could not be created",
    akb: () => "The folder this task works in could not be prepared",
    noPlan: () => "This discussion has no plan to start from yet",
    onePlan: () => "Start now takes one plan. Use Plan tasks for them all",
    noProcess: () => "The run could not be started",
    rules: () => "This board's rules are too old — update the ai4kanban command",
    runNotFound: (a) => `No run matches "${a.id}".`,
    runAmbiguous: (a) => `"${a.id}" matches more than one run. Use more of its ID.`,
    runGoing: () => "That run is still going.",
    runNotResumable: () => "Only a failed, interrupted or stopped run can be continued.",
    runNoSession: () => "This run left no session to continue from.",
    runContinued: () => "That run has already been continued.",
    runForeign: (a) => `This version can't continue a conversation ${a.agent} started.`,
    discardUnfinished: () => "A card discard did not finish. Retry discarding it before resuming creation.",
    creationHeld: () => "A card from this creation is already being worked on. Wait for that run to finish.",
    deliveryUnnamed: (a) =>
      ({
        cancel: "Name the delivery to cancel.",
        resume: "Name the delivery to carry on.",
        discard: "Name the delivery to discard.",
        approve: "Name the delivery to approve.",
      })[a.action] ?? "Name the delivery.",
    deliveryNotFound: (a) => `No delivery matches "${a.id}".`,
    deliveryActive: (a) => `Delivery ${a.id} hasn't ended — it is still working on ${a.task}.`,
    deliveryFinished: (a) => `Delivery ${a.id} finished. Only a delivery that ended abnormally can be carried on.`,
    deliveryCancelled: (a) => `Delivery ${a.id} was cancelled, so its work was given up. Start ${a.task} again.`,
    deliveryFiles: (a) =>
      `Delivery ${a.id} wrote its files straight into your project, so there is no branch to carry on. Start ${a.task} again.`,
    deliveryManual: (a) =>
      `Delivery ${a.id} committed in your own checkout, so there is no branch to carry on. Start ${a.task} again.`,
    deliveryWorktreeGone: (a) =>
      `The working folder of delivery ${a.id}, ${a.path}, is gone, so there is nothing to carry on. Discard it and start ${a.task} again.`,
    deliveryBranchGone: (a) =>
      `The branch of delivery ${a.id}, ${a.branch}, is gone, so there is nothing to carry on. Discard it and start ${a.task} again.`,
    deliveryCardGone: (a) => `#${a.card} is no longer on the board, so delivery ${a.id} has nothing left to finish.`,
    deliveryHeld: (a) => `Delivery ${a.other} is building #${a.card} now. Cancel that one first.`,
    deliveryTakenOver: (a) =>
      `Delivery ${a.other} took #${a.card} over after this one ended, so there is nothing left to carry on.`,
    deliveryRunGoing: (a) => `A run of delivery ${a.id} is still going.`,
    deliveryNone: (a) => `Nothing is being delivered on ${a.on}.`,
    deliveryEnded: (a) => `Delivery ${a.id} has already ended, so there is nothing to approve.`,
    deliveryNoApproval: (a) =>
      `Delivery ${a.id} needs no approval. Approve diffs before landing was off when it started, and the setting holds for the whole delivery.`,
    deliveryEndedApproving: (a) => `Delivery ${a.id} ended while it was being approved.`,
    planEmpty: (a) => `Nothing is written in ${a.path} yet, so there is nothing to build.`,
    cardBusy: (a) => `A run is already ${a.verb} #${a.card}. Wait for it to finish.`,
    cardDiscarded: (a) => `#${a.card} was discarded. Don't restore or recreate it.`,
    cardCreating: (a) => `Run ${a.run} is still creating #${a.card}. Once it finishes, you can ${a.act} it.`,
    cardUnfinished: (a) =>
      `#${a.card} was never finished — run ${a.run} stopped short. Continue that run from the board to finish creating it, or discard the card.`,
    cardDiscussed: (a) =>
      `The chat on #${a.card} is writing a reply, so you can't ${a.act} it yet. It frees up as soon as the reply lands or is stopped.`,
    workflowUnknown: (a) => `#${a.card} uses the "${a.workflow}" workflow, which this board doesn't have.`,
    previewUnapproved: () => "Shot previews are not approved yet.",
    workflowNoLead: (a) => `${a.name} has no agent leading its ${a.stage} stage. Assign one before it can run.`,
    workflowLeadMissing: (a) => `${a.name} has ${a.agent} leading its ${a.stage} stage, and this board has no such agent.`,
    workflowLeadStage: (a) =>
      `${a.name} has ${a.agent} leading its ${a.stage} stage, but ${a.agent} is a ${a.assigned} agent.`,
    noReviewers: () => "This delivery's workflow has no reviewers, so it is delivered as built with nothing to review.",
    cloudUnreachable: () =>
      "Cloud could not be reached, so the run was not started. A run works on the workspace, never on the copy left on this computer. Try again once the board is back.",
    cardHeld: (a) => `${a.details} Wait for that hold to end, or work on another card.`,
    runtimeUnnamed: () => "Enter a runtime name.",
    runtimeTaken: (a) => `This board already has a runtime called "${a.name}".`,
    runtimeNotFound: (a) =>
      a.runtimes
        ? `This board has no runtime called "${a.id}". It has: ${a.runtimes}.`
        : `This board has no runtime called "${a.id}".`,
    runtimeKey: (a) => `${a.name} doesn't take a "${a.key}" setting.`,
    harnessNotFound: (a) => `There is no agent tool called "${a.name}".`,
    globalRename: () => "Global default keeps its name — it is the runtime every agent falls back to.",
    globalDelete: () => "Global default can't be deleted — it is what an agent with no runtime of its own runs.",
    harnessUnused: (a) => `No runtime on this board runs "${a.name}". Add one, or move Global default onto it.`,
    workflowUnnamed: () => "Enter a workflow name.",
    workflowTaken: (a) => `This board already has a workflow called "${a.name}".`,
    workflowNotFound: (a) => `This board has no ${a.id} workflow.`,
    workflowBuiltInRename: (a) => `${a.name} is built in. Duplicate it to get one you can rename.`,
    workflowBuiltInChange: (a) => `${a.name} is built in. Duplicate it to get one you can change.`,
    workflowBuiltInDelete: (a) => `${a.name} is built in and can't be deleted.`,
    workflowBuiltInLeads: (a) => `${a.name} is built in, so its lead agents are fixed. Duplicate it to get one you can reassign.`,
    reviewNoLead: () => "The review stage has reviewers, not a lead.",
    agentNotFound: (a) => `This board has no ${a.agent} agent.`,
    agentCannotLead: (a) => `${a.agent} is a ${a.assigned} agent and can't lead ${a.stage}.`,
    agentNotLead: (a) => `${a.agent} can only help — it isn't declared as a lead.`,
    agentHelps: (a) => `${a.agent} already helps this stage. Remove it from the helpers first.`,
    agentCannotHelp: (a) => `${a.agent} is a ${a.assigned} agent and can't help ${a.stage}.`,
    agentLeadNotHelper: (a) => `${a.agent} is a lead, so it can't help — it would run the whole ${a.stage} stage a second time.`,
    agentLeads: (a) => `${a.agent} already leads this stage.`,
    agentNotHelping: (a) => `${a.agent} doesn't help the ${a.stage} stage of ${a.name}.`,
    minutes: () => "Enter a whole number of minutes, or 0 to switch it off.",
    fileParse: (a) => `Couldn't save: ${a.path} can't be read (${a.details}). Fix the file, then try again.`,
    fileWrite: (a) => `Couldn't write ${a.path}: ${a.details}`,
    fileRead: (a) => `Couldn't read ${a.path}: ${a.details}`,
    gitignoreWrite: (a) => `Couldn't write ${a.path}, so the key can't be kept out of Git: ${a.details}`,
    cadence: (a) => `"${a.cadence}" isn't a valid schedule. Use ${a.formats}.`,
    chatUnavailable: (a) => `${a.agent} can't hold a conversation. The agents that can: ${a.agents}.`,
    chatRuntimeGone: (a) =>
      `This conversation was held with ${a.previous}, and this board no longer has a runtime for it. Another agent can't pick it up — clear it to start fresh with ${a.agent}.`,
    chatNoImages: (a) => `${a.agent} can't see images. The agents that can: ${a.agents}.`,
    chatRuntime: (a) => `${a.runtime} can't hold a conversation. The runtimes that can: ${a.runtimes}.`,
    chatPicturesGone: () => "Those pictures are no longer on this computer.",
    chatEmpty: () => "Write something to send.",
    chatBusy: () => "This conversation is still answering the last message.",
    skillNotInstalled: () => "The kanban skill could not be installed.",
    chatForeign: (a) => `${a.agent} can't carry on a ${a.previous} conversation. Clear it to start fresh.`,
    planNotFound: (a) => `${a.path} is not a plan on this board.`,
  },
  theBuild: "the build",
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
