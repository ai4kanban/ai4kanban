// English copy for the rail, the memory pages, the goal and Insights — the source
// of truth a second language mirrors key for key. Writing rules: `i18n/index.ts`.
import type { RailCopy } from "./types";

const en: RailCopy = {
  search: "Find a card",
  clearSearch: "Clear the search",
  matching: "Matching cards",
  openCards: "Open cards",
  allCards: "All cards",
  matches: "Matches",
  noMatches: "No card matches.",
  runningRow: (label) => `${label} — running`,
  running: "running",
  close: (label) => `Close ${label}`,
  memory: {
    heading: "Memory",
    show: "What the agent remembers about this project",
    hide: "Hide the project's memory",
    project: "Project",
    modules: "Modules",
    empty: "Nothing remembered about this module yet.",
    files: {
      readme: "What shipped",
      decisions: "Settled decisions",
      redesign: "Design mistakes",
      rejected: "Rejected ideas",
    },
  },
  archive: {
    row: "Archive",
    title: "Archive",
    meta: (folder, count) => `${folder} · ${count === 1 ? "1 card" : `${count} cards`}`,
    empty: "Nothing archived yet. A card is moved here when it is finished, and this is where it is read.",
    list: "Archived cards",
    undated: "Archived before the board kept a record",
    card: { label: "Archive", release: "Release", archived: "Archived" },
  },
  memoryPage: {
    unwritten:
      "Nothing has been written here yet. The agent adds a line as work is finished, decided, or turned down — this file fills in as the board is used.",
    menu: "What to do with this file",
    copyPath: "Copy path",
    copyRelative: "Copy relative path",
    copied: (what) => `${what} copied`,
    path: "Path",
    relativePath: "Relative path",
  },
  goal: {
    open: "Goal",
    openHint: "What this board is for",
    title: "Goal",
    reading: "Reading goal.md…",
    editTitle: "Write the goal",
    guideTitle: "What makes a good goal",
    guideLine:
      "Where the project is headed, in your own words: what you want, how far out, and roughly what comes next. Rough and short is fine, and you can change it later — the agent never drafts the goal for you.",
    saveFailed: "could not save the goal",
  },
  insights: {
    open: "Insights",
    title: "Insights",
    tabDaily: "Daily progress",
    tabQuality: "Planning quality",
    daily: {
      reading: "Reading metrics.csv…",
      empty:
        "No activity recorded yet. The board writes a row to `metrics.csv` the first time a card is created, archived, or rejected.",
      completed: "Completed",
      created: "Created",
      rejected: "Rejected",
      totals: (days, completed, created, rejected) =>
        `Last ${days} days — **${completed} completed**, **${created} created**, **${rejected} rejected**.`,
      chart: (days) =>
        `Daily board activity over the last ${days} days: completed, created, and rejected cards.`,
    },
    quality: {
      reading: "Reading record.csv…",
      empty:
        "No planning evidence yet. The board writes a row to `record.csv` as it settles a question, proposes a card, or closes a release — the three scores are worked out from those rows.",
      chart:
        "Planning quality by release. Use the left and right arrow keys to move from release to release; the readout below gives that release's three scores.",
      stillOpen: " · still open",
      axisOpen: " · open",
      notEnough: "not enough yet",
      needed: (floor) => ` — ${floor} needed`,
      percent: (value) => `${value}%`,
      cards: (ids) => `Cards ${ids}`,
      noCards: "No cards yet",
    },
  },
};

export default en;
