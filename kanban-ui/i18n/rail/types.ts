/** The rail down the left of the window, the memory pages it opens, the goal
 *  behind the header's star, and the Insights charts. */
export type RailCopy = {
  search: string;
  clearSearch: string;
  /** What a screen reader calls the list, in its two states. */
  matching: string;
  openCards: string;
  allCards: string;
  matches: string;
  noMatches: string;
  /** A row an agent is inside, and the word a screen reader gets for it. */
  runningRow: (label: string) => string;
  running: string;
  close: (label: string) => string;
  memory: {
    heading: string;
    show: string;
    hide: string;
    project: string;
    modules: string;
    /** A module the map names but nothing has been written about. */
    empty: string;
    /** The four memory files, keyed by the name the board's rules give each one. */
    files: { readme: string; decisions: string; redesign: string; rejected: string };
  };
  memoryPage: {
    /** The file exists on the board but has never been written to. */
    unwritten: string;
    menu: string;
    copyPath: string;
    copyRelative: string;
    /** The chip after a copy. Takes which of the two paths was copied. */
    copied: (what: string) => string;
    path: string;
    relativePath: string;
  };
  goal: {
    open: string;
    openHint: string;
    title: string;
    reading: string;
    editTitle: string;
    guideTitle: string;
    guideLine: string;
    saveFailed: string;
  };
  insights: {
    open: string;
    title: string;
    tabDaily: string;
    tabQuality: string;
    daily: {
      reading: string;
      empty: string;
      /** The three series, and the summary line over the chart. */
      completed: string;
      created: string;
      rejected: string;
      totals: (days: number, completed: number, created: number, rejected: number) => string;
      chart: (days: number) => string;
    };
    quality: {
      reading: string;
      empty: string;
      /** Only read out loud: how the chart is moved through. */
      chart: string;
      stillOpen: string;
      axisOpen: string;
      notEnough: string;
      needed: (floor: number) => string;
      percent: (value: number) => string;
      cards: (ids: string) => string;
      noCards: string;
    };
  };
};
