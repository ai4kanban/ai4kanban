// English copy for agent runs — the source of truth a second language mirrors key
// for key. Writing rules: `i18n/index.ts`.
import type { RunsCopy } from "./types";

const en: RunsCopy = {
  action: {
    implement: "implement",
    review: "review",
    conflict: "conflict",
    run: "run",
    edit: "edit",
    clarify: "clarify",
    resolve: "resolve",
    writing: "writing",
    reject: "reject",
    archive: "archive",
    create: "create",
    propose: "propose",
    "plan-release": "plan-release",
    changelog: "changelog",
    setup: "setup",
    spec: "spec",
    channel: "channel",
  },
  verb: {
    implement: "implementing",
    review: "reviewing",
    conflict: "resolving a conflict",
    run: "running",
    edit: "editing",
    clarify: "clarifying",
    resolve: "resolving",
    writing: "rewriting",
    reject: "rejecting",
    archive: "archiving",
    create: "creating",
    propose: "proposing",
    "plan-release": "planning",
    changelog: "writing the changelog",
    setup: "setting up",
    spec: "drafting a spec",
    channel: "repurposing",
  },
  step: {
    implement: "Implement",
    review: "Review",
    conflict: "Conflict",
    run: "Run",
    edit: "Edit",
    clarify: "Clarify",
    resolve: "Resolve",
    writing: "Writing",
    reject: "Reject",
    archive: "Archive",
    create: "Create",
    propose: "Propose",
    "plan-release": "Plan release",
    changelog: "Changelog",
    setup: "Setup",
    spec: "Spec",
    channel: "Channel",
  },
  flow: {
    edit: "Revise",
    clarify: "Refine",
    writing: "Refine",
  },
  badge: {
    running: "running",
    watch: "watch the run log",
    doing: (label) => `${label} — running`,
    idle: "agent running",
  },
  log: {
    title: "run log",
    expand: "Expand run log",
    collapse: "Collapse run log",
    events: "intermediate events",
    noOutput: "(no output)",
    waiting: "…",
    stopped: "stopped",
    interrupted: "interrupted",
    done: "done",
    exited: (code) => `exited ${code}`,
    blocked: "blocked",
    running: "running",
    seconds: (s) => `${s}s`,
    minutes: (m, s) => `${m}m ${s}s`,
    hours: (h, m) => `${h}h ${m}m`,
    costTiny: "est. <$0.01",
    cost: (usd) => `est. $${usd}`,
    costHint:
      "Worked out from this run's tokens at list prices. It's what the run would cost to buy — not what you were billed; on a subscription plan a run isn't charged on its own.",
    modelHint: "The model this run reported it was working with.",
    tokens: (input, cacheWrite, cacheRead, output) =>
      `tokens · ${input} input · ${cacheWrite} cache write · ${cacheRead} cache read · ${output} output`,
    tokensHint:
      "This run's token counts, as the agent reported them: fresh input, prompt-cache writes and reads, and output.",
    stoppedShort:
      "This run stopped short, so the card may be part-built — whatever it wrote is sitting in your working tree.",
    stoppedShortResume: " Resume carries it on from where it stopped.",
    blocker: {
      heading: "implementation blocked",
      step: "Step",
      cause: "Cause",
      unblock: "To continue",
    },
  },
  stop: {
    label: "Stop run",
    stopping: "stopping…",
    title: "Stop this run",
    confirm: "Stop this run?",
    body: "It ends where it is. Anything it half-wrote stays in your working tree.",
    failed: "couldn't stop that run",
  },
  resume: {
    label: "Resume",
    resuming: "Resuming…",
    hint: "Continue where this run failed — the coding agent picks its own session back up",
    failed: "couldn't resume that run",
  },
  panel: {
    open: "Run history",
    openRunning: (n) => `${n} running — run history`,
    heading: "Runs",
    empty: "No runs yet.",
    pick: "Select a run to see its input and log.",
    note: "note",
    resumed: "resumed",
    cancelled: "cancelled",
    steps: (n) => `${n} sessions`,
    justNow: "just now",
    minutesAgo: (m) => `${m}m ago`,
    hoursAgo: (h) => `${h}h ago`,
    daysAgo: (d) => `${d}d ago`,
  },
  cardless: {
    planning: (release) => `Planning${release}`,
    plan: (release) => `Plan${release}`,
    writingChangelog: (release) => `Writing the changelog for${release}`,
    changelog: (release) => `Changelog${release}`,
    proposing: "Proposing tasks",
    propose: "Propose tasks",
    finishingSetup: "Finishing setup",
    finishSetup: "Finish setup",
    creating: "Creating task",
    create: "Create task",
  },
  dialog: {
    cancel: "Cancel",
    implement: {
      title: (id) => `Implement #${id}`,
      autoBranch: (branch) =>
        `One click carries this card all the way: the agent builds it, then a fresh run reviews and fixes it, and the board lands it as one commit on \`${branch}\`.`,
      autoHere:
        "One click carries this card all the way: the agent builds it, then a fresh run reviews and fixes it, and the board lands it as one commit on the branch you are on.",
      needsApproval:
        " It waits for you to approve the tree before that, because this board requires diff approval.",
      thenArchives: " Then it ticks the todos, writes the shipped line, and archives the card.",
      manualFolder:
        "One click carries this card all the way: the agent builds it here in your project folder, then a fresh run reviews and fixes it, and it stops. Nothing is committed for you: commit what review passed, and the card is archived then.",
      manual:
        "One click carries this card all the way: the agent builds it, then a fresh run reviews and fixes it, and it stops. **Manual commit mode** is on, so nothing is committed for you: commit what review passed, and the card is archived then.",
      manualWhy: (why) =>
        `One click carries this card all the way: the agent builds it, then a fresh run reviews and fixes it, and it stops. Nothing is committed for you — ${why}. Commit what review passed, and the card is archived then.`,
      ownBranch: "Build this on a branch of its own",
      ownBranchOn:
        "The agent works in a separate copy of the project — a git worktree — so your own files are left exactly as they are.",
      ownBranchOff:
        "The agent works right here, in this folder, and nothing else can be built until you commit what it leaves.",
      aiReview: "Have a second agent review it",
      aiReviewOn: "A fresh session judges the build against this card and fixes what it finds. It costs a second run.",
      aiReviewOff: "Nothing reads the code after the build but your own checks. Turn on **Approve diffs before landing** to read it yourself.",
      autoBranchNoReview: (branch) =>
        `One click carries this card all the way: the agent builds it, and the board lands it as one commit on \`${branch}\`. Nothing reviews it in between.`,
      autoHereNoReview:
        "One click carries this card all the way: the agent builds it, and the board lands it as one commit on the branch you are on. Nothing reviews it in between.",
      manualFolderNoReview:
        "One click carries this card all the way: the agent builds it here in your project folder, and it stops. Nothing reviews it, and nothing is committed for you: commit what it built, and the card is archived then.",
      manualNoReview:
        "One click carries this card all the way: the agent builds it, and it stops. Nothing reviews it, and **manual commit mode** is on, so nothing is committed for you: commit what it built, and the card is archived then.",
      manualWhyNoReview: (why) =>
        `One click carries this card all the way: the agent builds it, and it stops. Nothing reviews it, and nothing is committed for you — ${why}. Commit what it built, and the card is archived then.`,
      questionsOne:
        "This card has **1 open question**. It will be built, then hold at landing until you answer it — or press **Resolve & implement** to answer it first.",
      questionsMany: (n) =>
        `This card has **${n} open questions**. It will be built, then hold at landing until you answer them — or press **Resolve & implement** to answer them first.`,
      ackQuestionsOne: "I know a question is still open.",
      ackQuestionsMany: (n) => `I know ${n} questions are still open.`,
      blockedOne: (ids) =>
        `This card is blocked by ${ids}, still open on the board. Finish that card first.`,
      blockedMany: (ids) =>
        `This card is blocked by ${ids}, still open on the board. Finish those cards first.`,
      blockedOneSchedule: (ids) =>
        `This card is blocked by ${ids}, still open on the board. Finish that card first — or **Schedule** the build and the board will start it by itself once that card is done.`,
      blockedManySchedule: (ids) =>
        `This card is blocked by ${ids}, still open on the board. Finish those cards first — or **Schedule** the build and the board will start it by itself once those cards are done.`,
      ackBlockedOne: (ids) => `I know ${ids} isn't done yet.`,
      ackBlockedMany: (ids) => `I know ${ids} aren't done yet.`,
      notReady:
        "This card isn't marked **ready** yet — its plan may still be rough. Press **Refine** on its page to take it to ready first.",
      ackNotReady: "I know the plan may still be rough.",
      notes: "Optional extra notes for the agent…",
      confirm: "Implement",
      confirmAnyway: "Implement anyway",
      resolveFirst: "Resolve & implement",
      resolveFirstHint:
        "Answer the open questions first, and build the card once nothing is left to decide",
      schedule: "Schedule",
      scheduleHint:
        "Build this card by itself, once nothing is in its way — following the repository's commit setting, not the box here.",
    },
    run: {
      title: (id) => `Run #${id}`,
      blurb:
        "The agent works through this card's **Process** in order, records the run, and rewrites a step or two so the next run needs less of you. The card stays on the board — a recurring task is never finished.",
      unattended:
        "Nobody watches a run, so a step that needs your judgment is left undone and written into this run's open-questions file for you to answer later.",
      lastRun: (when) => `Last run ${when}.`,
      neverRun: "This card has never run.",
      notes: "Optional extra notes for this run…",
      confirm: "Run",
    },
    refine: {
      title: (id) => `Refine #${id}`,
      blurb:
        "The agent takes this card one step forward: it answers the open questions it can settle itself, leaves the ones only you can decide for you, and sharpens the plan. It works on the card, not the code.",
      blockedOne: (ids) =>
        `This card is blocked by ${ids}, still open on the board. The plan may change once that card is done.`,
      blockedMany: (ids) =>
        `This card is blocked by ${ids}, still open on the board. The plan may change once those cards are done.`,
      blockedOneSchedule: (ids) =>
        `This card is blocked by ${ids}, still open on the board. The plan may change once that card is done — **Schedule** it and the board refines it by itself once that card is off the board.`,
      blockedManySchedule: (ids) =>
        `This card is blocked by ${ids}, still open on the board. The plan may change once those cards are done — **Schedule** it and the board refines it by itself once they are off the board.`,
      confirm: "Refine",
      confirmAnyway: "Refine anyway",
      schedule: "Schedule",
      scheduleHint: "Refine this card by itself, once nothing is in its way",
    },
    reject: {
      title: (id) => `Reject #${id}`,
      blurb: "The agent adds a one-line note to rejected.md and removes the card.",
      placeholder: "Why are you rejecting this?",
      confirm: "Reject",
    },
    archive: {
      title: (id) => `Archive #${id}`,
      blurb:
        "All todos are done. The agent writes the “what you can now do” note into readme.md and moves the card off the board into .archive/.",
      placeholder: "Optional note for the agent…",
      confirm: "Archive",
    },
    edit: {
      title: (id) => `Edit #${id}`,
      blurb:
        "Tell the agent how to change this task. It re-reads the card and rewrites the plan — summary, scope, and todos — to match. The card body is only ever edited by the agent.",
      placeholder: "What should change about this task? e.g. narrow the scope to…, add a todo for…",
      confirm: "Save edit",
    },
    create: {
      title: "Create task",
      tabDescribe: "Describe a task",
      tabPropose: "Propose tasks",
      describeBlurb:
        "Describe what you want. The agent turns it into one or more cards and figures out which modules they touch.",
      proposeBlurb:
        "The agent walks one module of the product as a user and proposes new tasks inside it — nothing to describe.",
      shipsIn: (release) => `They ship in **${release}**, the release on screen.`,
      describePlaceholder: "What do you want to happen?",
      confirm: "Create task",
      proposeOne: "Propose 1 task",
      proposeMany: (n) => `Propose ${n} tasks`,
      module: {
        label: "Focus module",
        blurb:
          "Pick the part of the product you want new tasks in — they all land inside it. Leave it on “auto-pick” and the agent chooses the part that needs work most.",
        auto: "auto-pick",
      },
      count: {
        label: "How many",
        blurb: "Tasks this run writes. More tasks means a longer run and a thinner idea each.",
      },
      boldness: {
        label: "Boldness",
        blurb: "How big a move each task is.",
        safe: "safe",
        safeBlurb:
          "Small moves — polish a rough edge, fill a gap in something that already works.",
        normal: "normal",
        normalBlurb:
          "A feature each — one card a run can finish. This is what a propose run does on its own.",
        bold: "bold",
        boldBlurb:
          "A big leap each — a capability the module doesn't have at all, still sized so one run can finish it.",
      },
    },
  },
};

export default en;
