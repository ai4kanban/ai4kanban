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
  /** The discussions this board is holding (#496), listed under the open cards. */
  discussions: {
    heading: string;
    /** One that has said nothing the board could name it by yet. */
    unnamed: string;
    /** Its agent is writing a reply — the hover, and the word a screen reader gets. */
    answeringRow: (name: string) => string;
    answering: string;
    /** The ⋯ on a row, and its one item. */
    menu: (name: string) => string;
    archive: string;
  };
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
  archive: {
    /** The row at the foot of the rail, and the heading of the page it opens. */
    row: string;
    title: string;
    /** Under the heading: the folder the cards are in, and how many of them. */
    meta: (folder: string, count: number) => string;
    /** A board that has archived nothing yet. */
    empty: string;
    /** Read out loud as the name of the list. */
    list: string;
    /** The point where the archived dates run out — every card below it left the board
     *  before the board stamped one. */
    undated: string;
    /** One archived card: the label over its title, and what its two meta chips are. */
    card: { label: string; release: string; archived: string };
  };
  signals: {
    /** The row above Archive, and the heading of the page it opens. */
    row: string;
    title: string;
    /** Under the heading: where the inbox is, how much is in it, and when the newest of it
     *  arrived. The stamp is left off an inbox with nothing in it. */
    meta: (folder: string, count: number) => string;
    latestImport: (when: string) => string;
    /** One line under the heading: what the inbox is for, and what it is not. */
    lead: string;
    /** Nothing in it yet. */
    empty: string;
    /** No endpoint configured: the heading, and the one line each missing setting gets.
     *  An offer, not a demand — an unconfigured board still takes what is dropped in. */
    connect: string;
    needEndpoint: (file: string) => string;
    needToken: (file: string) => string;
    /** Read out loud as the name of the list. */
    list: string;
    /** The three things an item offers. Dismissing cannot be undone, which is why the
     *  word is the plain one. Open is left off one with nothing to open. */
    viewSummary: string;
    hideSummary: string;
    viewOriginal: string;
    dismiss: string;
    /** A dismissal the board refused. */
    dismissFailed: string;
    /** Add to inbox (#499): the box that takes a dropped file, a pasted link, or text. */
    add: {
      title: string;
      placeholder: string;
      /** The second half of the offer, and what the box says while a file is over it. */
      drop: string;
      dropping: string;
      button: string;
      /** An add the board refused for a reason it cannot put in the reader's language. */
      failed: string;
    };
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
    /** The same control on an empty goal: the offer to write one, and never a demand. */
    write: string;
    writeHint: string;
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
