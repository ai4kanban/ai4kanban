// English copy for a card's own page — the source of truth a second language
// mirrors key for key. Writing rules: `i18n/index.ts`.
import type { CardDeliveryState } from "@/lib/types";
import type { CardCopy } from "./types";

// One file is named, more are counted.
const some = (files: string[] = []): string => (files.length === 1 ? `\`${files[0]}\`` : `${files.length} files`);
const starts = (s: CardDeliveryState): string => (s.retryIn ? `in ${s.retryIn}s` : "now");
const resume = (s: CardDeliveryState): string => `Run \`${s.command}\` to carry on from that hook.`;
// With no card there is no Build again to press, so the way out is the command.
const wayOut = (s: CardDeliveryState): string =>
  s.command ? `Run \`${s.command}\` to end it; the branch is kept.` : "Fix it, then `Build again`.";
const toLand = (s: CardDeliveryState): string => (s.branch ? `, to land on \`${s.branch}\`` : "");

const en: CardCopy = {
  partOf: (id, title) => `Part of #${id} ${title}`,
  working: (verb) => `${verb} this card…`,
  workingUnknown: "working…",
  landed: (commit) => `Landed as ${commit}`,
  landedNothing: "Landed — nothing to commit",
  ended: "Ended",
  offBoard: { line: "This card left the board.", open: "Open in archive" },
  hold: (handle, until) => `@${handle} is holding this card until ${until}. A save now is refused.`,
  cloudBand: {
    actionable: "Actionable",
    accepted: "Starting",
    waitingForServer: "Waiting for a machine",
    running: "Running",
    stale: "No longer waiting",
  },
  supersedes:
    "Earlier approved work no longer matched this card, so this run started fresh from the current version.",
  waitingOnYou: "waiting on you",
  state: {
    pill: {
      working: "In progress",
      stopped: "Waiting on you",
      commit: "Waiting for your commit",
      held: "Waiting for answers",
      retry: "Waiting to retry",
      conflict: "Resolving a conflict",
      queued: "In line to land",
      refused: "Can't land yet",
    },
    line: {
      landed: (s) =>
        s.branch
          ? `On \`${s.branch}\` as \`${s.commit}\`. The board is completing the card.`
          : `Landed as \`${s.commit}\`. The board is completing the card.`,
      "landed-nothing": () => "It changed nothing, so nothing was committed. The board is completing the card.",
      "hook-failed": (s) => `The \`${s.hook}\` hook failed after the build, so nothing was delivered. ${resume(s)}`,
      "hook-stopped": (s) =>
        `The \`${s.hook}\` hook was stopped after the build, so nothing was delivered. ${resume(s)}`,
      "hook-unstarted": (s) =>
        `The \`${s.hook}\` hook could not start after the build, so nothing was delivered. ${resume(s)}`,
      uncommitted: (s) => `The build's work could not be committed, for the reason below. ${wayOut(s)}`,
      stopped: (s) => `This delivery stopped, for the reason below. ${wayOut(s)}`,
      commit: () => "The build is done. Commit these changes yourself, and the delivery carries on.",
      questions: (s) =>
        s.questions === 1
          ? "Landing waits on this card's 1 open question. Answer it and it carries on."
          : `Landing waits on this card's ${s.questions} open questions. Answer them and it carries on.`,
      "conflict-wait": (s) =>
        `Attempt ${(s.attempt ?? 2) - 1} left ${some(s.files)} conflicted with ${s.branch ? `\`${s.branch}\`` : "the target branch"}. ` +
        `Attempt ${s.attempt} starts ${starts(s)}; other deliveries can land meanwhile.`,
      conflict: (s) =>
        `Attempt ${s.attempt}: resolving ${some(s.files)} against ${s.branch ? `\`${s.branch}\`` : "the target branch"}. ` +
        "It lands by itself afterwards; nothing is asked of you.",
      "target-moved": (s) =>
        `${s.branch ? `\`${s.branch}\`` : "The target branch"} moved on while this was landing. ` +
        `Attempt ${s.attempt} starts ${starts(s)}; other deliveries can land meanwhile.`,
      queued: (s) => `In line behind ${s.behind}. One build lands at a time, and this one carries on by itself.`,
      "worktree-gone": (s) => `Its worktree \`${s.worktree}\` is gone, so there is nothing to land.`,
      "no-base": () => "It has no base commit to land against.",
      "target-gone": (s) => `\`${s.branch}\` is gone. Put the branch back, or discard the delivery.`,
      "worktree-dirty": (s) =>
        `Its worktree still holds ${some(s.files)}. Clear ${s.files?.length === 1 ? "it" : "them"}.`,
      interrupted: () => "A landing was interrupted and has been put back. It will be tried again.",
      refused: () => "Couldn't land, for the reason below. It retries by itself once that is cleared.",
      "hook-running": (s) =>
        `The build is done. Running the \`${s.hook}\` hook before it is delivered${toLand(s)}.`,
      building: (s) => `Building this card as it was approved when work started${toLand(s)}.`,
      "building-typed": (s) => `Building what you typed${toLand(s)}.`,
    },
  },
  filesOutside: (paths) =>
    `Files outside the board changed during the run: ${paths}. Nothing was reverted. Sort them out, then build again.`,
  filesMissing: (paths) => `These finished files are missing: ${paths}. Make them, then build again.`,
  filesNone: "The task lists no finished files. Add them, then build again.",
  landWait: {
    overwrite: (files) =>
      files.length === 1
        ? `Merging would overwrite your changes to \`${files[0]}\`. Commit or stash them.`
        : `Merging would overwrite your changes to ${files.length} files. Commit or stash them.`,
    untracked: (files) =>
      files.length === 1
        ? `\`${files[0]}\` is not in git, and merging would overwrite it. Move or delete it.`
        : `${files.length} files are not in git, and merging would overwrite them. Move or delete them.`,
  },
  interrupted: {
    line: "The machine building this stopped before it finished. Nothing picks it up on its own.",
    resume: "Resume it here",
    resuming: "Resuming…",
    cancel: "Cancel it",
    cancelling: "Cancelling…",
    resumeFailed: "couldn't take this up again",
    cancelFailed: "couldn't cancel it",
  },
  heldPaused: "Discard ends the delivery and takes the card back.",
  heldRunning: "Stop the run, then Discard takes the card back.",
  toolbar: {
    implement: "Implement",
    run: "Run",
    runHint: "Do one pass of this recurring task now",
    refine: "Refine",
    refineHint: "Take this card's plan one step forward now",
    alreadyRunning: (verb) => `Already ${verb} this card`,
    edit: "Revise",
    editHint: "Open this card's chat — say what to change, and the agent rewrites the card",
    discussing: "Discussing",
    discussingWhy: "Its chat is writing a reply. It frees itself the moment that reply lands.",
    buildAgain: "Build again",
    buildAgainHint: "Build this card again in the same delivery, once what stopped it is sorted out",
    archive: "Archive",
    reject: "Remove",
    startFailed: "could not start the agent",
    scheduleFailed: "could not schedule the action",
    unscheduleFailed: "could not take the schedule off",
    editFailed: "revise failed",
    backTo: (column) => `Back to ${column}`,
    more: "More",
    fewer: "Fewer",
    resolve: "Resolve",
  },
  delivery: {
    fold: "Fold this away",
    unfold: "Open this up",
    tabDiff: "Diff",
    tabLog: "Log",
    noLog: "No session has written anything yet — the first one is starting.",
    projectFolder: "Project folder",
    projectFolderHint: "Changes are in your project folder",
    autoCommit: "Auto-commit",
    manualCommits: "Manual commits",
    landedAs: "Landed",
    finished: "Finished",
    stopped: "stopped",
    interrupted: "interrupted",
    done: "done",
    exited: (code) => `exited ${code}`,
    running: "running",
    stop: {
      label: "Stop run",
      stopping: "Stopping…",
      title: "Stop this run?",
      body: "It ends where it is, and whatever it half-wrote stays in your working tree. The delivery keeps the card — then Resume carries it on, or Discard ends it.",
      keep: "Keep running",
      failed: "could not stop that run",
    },
    resume: {
      label: "Resume",
      resuming: "Resuming…",
      pickUpHint:
        "Carry this delivery on from where it stopped — the agent picks its own session back up",
      failed: "could not resume that run",
      carryOnHint: "Finish this delivery from where it stopped — its work is kept, nothing is rebuilt",
      carryOnFailed: "could not carry that delivery on",
    },
    discard: {
      label: "Discard",
      titleActive: "Discard this delivery?",
      titleSaved: "Discard saved work?",
      unlocks: "The card unlocks and Implement starts a fresh delivery. ",
      deletes: (what) => `Deletes \`${what}\`. This cannot be undone.`,
      nothingToLose: "Whatever it wrote in your project folder stays where it is.",
      keep: "Keep it",
      failed: "could not discard the delivery",
    },
    conflict: {
      resolving: (attempt) => `Resolving the landing conflict · attempt ${attempt}`,
      waiting: (seconds, attempt) => `Retrying in ${seconds}s · attempt ${attempt}`,
      starting: (attempt) => `Starting attempt ${attempt}`,
      stuck: (files, waiting) =>
        (files.length === 1 ? `\`${files[0]}\` is still conflicted.` : `${files.length} files are still conflicted.`) +
        (waiting ? " It holds no landing slot while it waits — another delivery can land." : ""),
    },
    moved: {
      waiting: (seconds, attempt) => `Retrying in ${seconds}s · attempt ${attempt}`,
      starting: (attempt) => `Starting attempt ${attempt}`,
      body: (branch) =>
        `${branch ? `\`${branch}\`` : "The target branch"} moved on while this was landing, so it starts over on ` +
        "the new code. It holds no landing slot while it waits — another delivery can land.",
    },
    working: "Working…",
  },
  meta: {
    workflow: "Workflow",
    noLead: (stages) => `No available lead agent: ${stages.join(", ")}`,
    deletedWorkflow: "Deleted workflow",
    deletedHint: "This workflow was deleted, so the task can't start",
    modules: "Modules",
    release: "Release",
    priority: "Priority",
    roi: "ROI",
    todos: "Todos",
    lastRun: "Last run",
    neverRun: "Never run",
    cadence: "Cadence",
    nextRun: "Next run",
    dueNow: "Due now",
    blockedBy: "Blocked by",
    scheduled: "Scheduled",
    unschedule: "cancel",
    unscheduleHint: "Take the schedule off — nothing will start on its own",
    related: "Related",
    source: "Source",
    sourcePlan: "Plan",
    sourceLink: "Link",
  },
  subtasks: {
    heading: "subtasks",
    running: "running",
    waitingOutside: (ids) => `waiting on ${ids}, outside this group`,
    list: (n) => `${n} cards`,
  },
  questions: {
    heading: "open questions",
    recommended: "recommended",
    decide: "decide",
    answerPlaceholder: "Your answer…",
    optionsPlaceholder: "In your own words…",
    close: "Close",
    resolve: "Resolve",
    pageTitle: (id) => `Resolve #${id}`,
    pageBlurb: "Answer what this card is waiting on. Anything you leave blank stays open.",
    skip: "Skip",
    undo: "Undo",
    skipFailed: "Couldn't update this question",
  },
  agentHalf: "what the agent worked out",
  diff: {
    uncommitted: "uncommitted",
    truncated: "· cut off",
    truncatedHint: "Too long to show in full — this is the first part",
    hideTree: "Hide the file list",
    showTree: "Show the file list",
    added: "new",
    deleted: "deleted",
    renamed: "moved",
    binary: "Binary file — nothing to show in lines.",
    noLines: "No lines changed.",
    lineAdded: "added ",
    lineRemoved: "removed ",
  },
  opening: { reading: "Reading the card…", failed: "The card could not be read.", retry: "Retry" },
  mockup: {
    play: "Play",
    pause: "Pause",
    replay: "Replay",
    seek: "Playback position",
    mute: "Mute",
    unmute: "Unmute",
    loadingPreview: "Loading preview…",
    previewFailed: "Preview couldn't load. Reopen it to try again.",
    openFull: "View at full size",
    screen: "Screen",
    code: "Code",
    frame: (label) => `Asset ${label}`,
    back: (id) => `Back to #${id}`,
    unplayable: "Can't play this file: the browser doesn't support its format. Use MP4 (H.264), WebM or MP3.",
    download: "Download",
  },
  storyboard: {
    heading: "Storyboard",
    summary: (shots, seconds) => `${shots} ${shots === 1 ? "shot" : "shots"} · ${seconds}s`,
    sketch: "Sketch · Not final footage",
    timeline: "Shots",
    voiceover: "Voiceover",
    noVoiceover: "No voiceover",
    action: "Action",
    details: "Production details",
    captions: "Captions",
    start: "Start",
    end: "End",
    noFrame: "No frame",
    empty: "No shots yet",
    needsFixing: "Storyboard needs fixing",
    fixHint: "Copy the diagnostics to the agent that wrote it, then reload once it's fixed.",
    copyDiagnostics: "Copy diagnostics",
    copied: "Copied",
    diagnostics: "Diagnostics",
    reload: "Reload",
    unavailable: "Open this card in the app to see its storyboard.",
    slidesHeading: "Slides",
    pages: (n) => `${n} ${n === 1 ? "slide" : "slides"}`,
    slidesTimeline: "Slides",
    notes: "Speaker notes",
    noPreview: "No preview",
    emptySlides: "No slides yet",
  },
};

export default en;
