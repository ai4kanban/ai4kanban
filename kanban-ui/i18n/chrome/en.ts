// English copy for the window's frame — the source of truth a second language
// mirrors key for key. Writing rules: `i18n/index.ts`.
import type { ChromeCopy } from "./types";

const en: ChromeCopy = {
  window: {
    title: "AI4Kanban",
    description: "Local kanban board — spawn agents to do the work.",
  },
  header: { home: "All cards" },
  resize: { rail: "Resize the rail", chat: "Resize the chat", bell: "Resize notifications" },
  projects: {
    heading: "Projects",
    reading: "Reading your projects…",
    onlyThisOne: "Only this one so far.",
    openFolder: "Open folder…",
    badge: (boardDir) => `${boardDir} — click for your projects`,
    missing: (path) => `${path} — the folder is gone`,
    missingLabel: "folder is gone",
    openHere: "Open in this window",
    runningHere: "A run is going here",
    forget: "Take this project off the list — nothing on disk is touched",
  },
  update: {
    available: (version) =>
      `**AI4Kanban ${version}** is out. The app never updates itself — get the new one when you want it.`,
    download: "Download",
    skip: "Don't mention this version again",
  },
  app: {
    notice:
      "**There’s a desktop app for this.** The same board in a window, with nothing to install first — no Node, no npx, no terminal to keep alive. Running it here works and stays supported.",
    get: "Get the app",
    hide: "Hide until this tab is reopened",
  },
  noBoard: {
    pickAnother: "Open another project…",
    make: "Make a board here",
    making: "Making the board…",
    makeFailed: "the board could not be made",
  },
  command: {
    heading: "Connect the akb command",
    install: "Install the akb command",
    repair: "Repair it",
    writeAgain: "Write it again",
    writing: "Writing…",
    failed: "the command was not installed",
    donePath: "Done. Open a new terminal and run `akb version`.",
    doneSymlink:
      "Done. Run `akb version` in a terminal — typing `akb` on its own opens this app on the project you are standing in.",
    state: {
      installed: (path) => `Installed at ${path}.`,
      dangling: (path, points) =>
        `Installed at ${path}, but it points at an app that is no longer there — ${points}.`,
      foreign: (path, holder) => `${path} is held by ${holder} — this is yours to sort out.`,
      foreignNpm: (path, holder) =>
        `${path} is held by ${holder} — an \`akb\` installed from npm lands at that same path, so this is yours to sort out.`,
      holderUnknown: "something the app didn't put there",
      absent: "Not installed — your terminal has no `akb` from this app.",
    },
  },
  notFound: {
    title: "This task is not on the board.",
    leaving: (seconds) => `Taking you to the board in ${seconds}s…`,
    back: "Go to the board",
  },
  guide: {
    failed: "The guide didn’t load —",
    readOnGitHub: "read it on GitHub",
    failedEnd: ".",
    reading: "Reading the guide…",
  },
};

export default en;
