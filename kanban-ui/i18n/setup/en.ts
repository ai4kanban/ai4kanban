// English copy for setup — the source of truth a second language mirrors key for
// key. Writing rules: `i18n/index.ts`.
import type { SetupCopy } from "./types";

const en: SetupCopy = {
  rail: {
    title: "Set up this board",
    blurb: "Answer three questions. The remaining setup is based on your repository.",
    steps: "Setup steps",
    exit: "Go to the board",
    projectSettledOne: (name) => `${name} · 1 track`,
    projectSettledMany: (name, tracks) => `${name} · ${tracks} tracks`,
    goalWritten: "Completed",
    goalSkipped: "Skipped",
  },
  stepTitles: { project: "Project", goal: "Goal", agent: "Agent" },
  reading: "Reading the board…",
  firstRun: {
    title: "Set up this board",
    step: (at, total) => `${at} of ${total}`,
    byHand: "Enter details manually",
    toBoard: "Go to the board",
    yourWords: "Enter your response",
    agent: {
      ask: "Choose an agent",
      blurb:
        "The selected agent will read your repository and complete the remaining setup. Nothing runs until you make a selection.",
      test: "Test and continue",
      testNote: (agent) => `Send a test request to ${agent}.`,
      answered: "Connection verified",
    },
    reading: {
      ask: "Reading your repository",
      blurb:
        "This usually takes less than a minute. You can review the suggested project details before they are saved.",
    },
    project: {
      tracks: (count) =>
        count === 1
          ? "Suggested track for organizing cards:"
          : `Suggested tracks for organizing cards (${count}):`,
      right: "Review these suggestions. Nothing is saved until you confirm.",
      hint: "Describe any changes",
      yes: "Confirm",
      send: "Request changes",
    },
    goal: {
      ask: "What is the project goal?",
      blurb:
        "This cannot be inferred from the repository. In your own words, describe what you want to achieve and what should come next. A brief outline is enough.",
      guide: "How to write a useful goal",
      save: "Save and finish",
      later: "Skip for now",
    },
    failed: {
      noAnswer: "The agent did not return a response.",
      nothingWritten: "No changes were saved.",
      backToAgent: "Choose another agent",
      retry: "Try again",
    },
  },
  project: {
    title: "Project details",
    blurb: "Add a name and a brief description. The agent uses this information when planning work.",
    name: "Name",
    what: "Description",
    whatPlaceholder: "A Markdown-based project management board.",
    tracks: "Work tracks",
    tracksBlurb:
      "Tracks organize cards by type of work. Each track is stored as a folder under `docs/kanban/todo/`.",
    trackName: (n) => `Track ${n}`,
    trackNote: (track) => `Purpose of ${track}`,
    thisTrack: "this track",
    trackNotePlaceholder: "Work included in this track",
    dropTrack: (track) => `Delete ${track}`,
    dropTrackHint: "Delete this track",
    trackLocked: (track) => `${track} contains cards. Move them before deleting this track.`,
    addTrack: "Add a track",
    keptOne: (tracks) =>
      `Changes saved. ${tracks} was not deleted because it contains cards. Move or archive them first.`,
    keptMany: (tracks) =>
      `Changes saved. ${tracks} were not deleted because they contain cards. Move or archive them first.`,
    saveFailed: "Could not save the project details",
    continue: "Continue",
  },
  goal: {
    title: "Project goal",
    blurb:
      "Describe the long-term outcome and the general order of priorities. The agent uses this goal to evaluate proposed work. You can update it at any time.",
    placeholder: "For example: First complete…, then…",
    guideTitle: "How to write a useful goal",
    guideLine: "Enter the project goal in your own words.",
    skip: "Skip for now",
    saveFailed: "Could not save the project goal",
  },
  agent: {
    title: "Choose an agent",
    blurb:
      "The agent runs board actions such as refining cards, proposing work, and implementing changes. Select an agent, then test the connection.",
    answered: "Setup details are complete.",
    testFirst: "Test the connection before continuing.",
    saveFailed: "Could not save the agent setting",
  },
  done: {
    title: "Setup details complete",
    blurb:
      "The agent is completing the remaining setup. You can view its progress or open the board while it continues.",
    goalFirst:
      "**Add a project goal first.** The remaining setup uses it to plan the next steps.",
    writeGoal: "Add project goal",
    finish: "Finish setup",
    starting: "Starting…",
    open: "Open the board",
    startFailed: "Could not start the setup run",
  },
  run: {
    watching: "Completing setup:",
    watch: "View progress",
    failed: "The previous setup run did not finish.",
    readLog: "View log",
    failedAfter: "Restarting continues from the first incomplete step.",
  },
  notice: {
    title: "Setup is incomplete.",
    working: "The agent is completing the remaining steps.",
    next: "Next:",
    lastStep: "Finishing the last step.",
    resume: "Continue setup",
    addSkill: "Add the skill",
    addSkillHint: "Allow the agent to access this board",
    meter: (done, total) => `Setup progress: ${done}/${total}`,
  },
  goalNotice: {
    tag: "Project goal",
    body: "**The project goal is missing or unclear.** Add a goal before planning new work.",
    write: "Add project goal",
    dismiss: "Dismiss",
    dismissHint: "Hide for now",
  },
  handover: {
    open: "Complete setup in your coding agent",
    close: "Return to setup",
    title: "Complete setup in your coding agent",
    blurb: "Copy the instructions below. The agent will continue from the current setup step.",
  },
  addSkillFirst:
    "**The board skill is not installed for your coding agent.** Run the command below in the repository, then copy the instructions that follow. You can also add the skill under Configuration → General.",
  copy: { hint: "Copy to your coding agent" },
  noBoard: {
    title: "No board found",
    where: (folder) =>
      `No \`docs/kanban/todo/\` directory was found in \`${folder}\` or its parent directories.`,
    startTitle: "Create a board",
    startApp: "Create a board and setup checklist in the current project.",
    startBrowser:
      "Run this command from the repository root. The board will be created under docs/kanban/.",
    wrongTitle: "Open another project",
    wrongApp: "Open a different folder in this window.",
    wrongBrowser: "Point the UI to the correct repository, or restart it from that repository root.",
    comeBack: "Return to this tab after running the command.",
    copy: "Copy",
  },
  noRules: {
    title: "Unable to read this board",
    installTitle: "Install the board rules",
    installApp: "Reopen the project to load the rules included with the app.",
    installBrowser:
      "Install the `akb` command once to make the rules available to every project.",
    comeBack: "Return to this tab after installation.",
  },
};

export default en;
