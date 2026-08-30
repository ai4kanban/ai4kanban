// English copy for setup — the source of truth a second language mirrors key for
// key. Writing rules: `i18n/index.ts`.
import type { SetupCopy } from "./types";

const en: SetupCopy = {
  rail: {
    title: "Set up this board",
    blurb:
      "Three questions only you can answer. Everything else is worked out from your repo afterwards.",
    steps: "Setup steps",
    exit: "Go to the board",
    projectSettledOne: (name) => `${name} · 1 track`,
    projectSettledMany: (name, tracks) => `${name} · ${tracks} tracks`,
    goalWritten: "Written",
    goalSkipped: "Left for later",
  },
  stepTitles: { project: "Project", goal: "Goal", agent: "Harness" },
  reading: "Reading the board…",
  firstRun: {
    title: "Set up this board",
    step: (at, total) => `${at} of ${total}`,
    byHand: "I’ll fill it in myself",
    toBoard: "Go to the board",
    yourWords: "Your words",
    agent: {
      ask: "Which agent does the work?",
      blurb:
        "It reads your repo and does the talking from here. Nothing is run until you pick one.",
      test: "Test and continue",
      testNote: (agent) => `One call to ${agent}, to check it is logged in.`,
      answered: "Answered — carry on.",
    },
    reading: {
      ask: "Reading your repo.",
      blurb:
        "A minute at most. I will come back with what I think this project is — you tell me what is wrong with it.",
    },
    project: {
      tracks: "Its work falls into",
      right: "Right? Say what is wrong and I will fix it. Nothing is written until you say yes.",
      hint: "What I got wrong",
      yes: "Yes, that’s it",
      send: "Send",
    },
    goal: {
      ask: "Where is this headed?",
      blurb:
        "The one thing no repo can tell me. A year out, in your own words — what you want, and roughly what comes next. Rough and short is fine, and only you can write it.",
      guide: "What makes a good goal",
      save: "Save and finish",
      later: "I’ll write it later",
    },
    failed: {
      noAnswer: "the agent ended the turn without answering.",
      nothingWritten: "Nothing was written.",
      backToAgent: "Back to the agent",
      retry: "Try again",
    },
  },
  project: {
    title: "What is this project?",
    blurb:
      "The name and one line about it. The agent reads this whenever it plans work, so plain words beat a pitch.",
    name: "Name",
    what: "What it is",
    whatPlaceholder: "A board that plans itself, in plain markdown.",
    tracks: "The tracks work falls into",
    tracksBlurb:
      "One bucket per kind of work — every card lives in one. These are the board’s own folders, so a name here is a folder under `docs/kanban/todo/`.",
    trackName: (n) => `Track ${n} name`,
    trackNote: (track) => `What ${track} is for`,
    thisTrack: "this track",
    trackNotePlaceholder: "what belongs in it",
    dropTrack: (track) => `Drop ${track}`,
    dropTrackHint: "Drop this track",
    trackLocked: (track) => `${track} holds cards — move them before dropping it`,
    addTrack: "Add a track",
    keptOne: (tracks) =>
      `Saved, but ${tracks} holds cards, so it stays on the board. Move or archive the cards first if you really want it gone.`,
    keptMany: (tracks) =>
      `Saved, but ${tracks} hold cards, so they stay on the board. Move or archive the cards first if you really want them gone.`,
    saveFailed: "couldn't save the project",
    continue: "Continue",
  },
  goal: {
    title: "Where is this headed?",
    blurb:
      "Your own words: what you want, how far out, and roughly what comes next. Every proposal the agent makes is judged against this, and rough and short is fine — you can change it whenever.",
    placeholder: "In a year I want…",
    guideTitle: "What makes a good goal",
    guideLine: "The agent never drafts this for you.",
    skip: "Skip for now",
    saveFailed: "could not save the goal",
  },
  agent: {
    title: "Which harness runs the work?",
    blurb:
      "The coding tool that runs the board's work. Every button here starts a run on it — refine a card, propose work, implement it. Pick it, then press Test: it sends one tiny message through and says what came back.",
    answered: "That’s everything only you could answer.",
    testFirst: "Press Test above — every button on this board runs through it.",
    saveFailed: "couldn't save that answer",
  },
  done: {
    title: "Answered — the board is yours",
    blurb:
      "What is left reads your repo and thinks: the calls a planner needs settled, the map of what the project is made of, and the first cards.",
    goalFirst:
      "**The goal comes first.** Every step left is planned from it, so write it and the board can take the rest.",
    writeGoal: "Write the goal",
    offer:
      "**Let the board finish them.** It runs the agent you picked, here, and you can watch or stop it like any other run.",
    finish: "Finish setup",
    starting: "Starting…",
    handOver: "Or finish them in your own coding agent — paste this into it:",
    open: "Open the board",
    startFailed: "the setup run didn't start",
  },
  run: {
    watching: "Finishing setup —",
    watch: "watch the run",
    failed: "The last setup run stopped short —",
    readLog: "read its log",
    failedAfter: "for why. Starting one again picks up from the first step still left.",
  },
  notice: {
    title: "Setting up this board.",
    working: "The agent is working down what is left; the steps tick off as it goes.",
    next: "Next:",
    lastStep: "Finishing the last step.",
    resume: "Continue setup",
    addSkill: "Add the skill",
    addSkillHint: "A board arrives without the skill — this adds it",
    meter: (done, total) => `Setup: ${done} of ${total} steps done`,
  },
  goalNotice: {
    tag: "Project goal",
    body: "**The project goal is missing or unclear.** Every proposal the agent makes is judged against it — rough and short is fine.",
    write: "Write the goal",
    dismiss: "Dismiss",
    dismissHint: "Hide for now",
  },
  handover: {
    open: "Rather set this up from your coding agent?",
    close: "Never mind — keep going here",
    title: "Finish from your coding agent",
    blurb:
      "Paste this into it. It picks up wherever setup got to, so nothing you answered here is asked again.",
  },
  addSkillFirst:
    "**Your coding agent can’t see this board yet.** A board arrives without the skill — run this in the repo first, then paste the line below. (Configuration → General does the same from here.)",
  copy: { hint: "Copy for your coding agent" },
  noBoard: {
    title: "There is no board here.",
    where: (folder) => `Nothing at \`docs/kanban/todo/\` in \`${folder}\`, or in any folder above it.`,
    startTitle: "Start one here",
    startApp: "The board and a setup checklist — in this window.",
    startBrowser: "Scaffolds the board under docs/kanban/. Run it in the repo root.",
    wrongTitle: "Wrong project",
    wrongApp: "Open another folder in this window. Past ones are behind the name up top.",
    wrongBrowser: "Point the UI at the repo you meant, or restart it from that repo's root.",
    comeBack: "Run one, then come back to this tab — the board shows up on its own.",
    copy: "Copy",
  },
  noRules: {
    title: "This board can't be read.",
    installTitle: "Install the board's rules",
    installApp: "The app carries its own copy — reopening this project picks it up.",
    installBrowser: "The `akb` command carries them. Install it once, for every project.",
    comeBack: "Run it, then come back to this tab — the board shows up on its own.",
  },
};

export default en;
