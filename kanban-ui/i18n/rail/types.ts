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
    /** The button over them (#514): it opens the Memory pruner's page in Configuration,
     *  which is where a pass is started and a cadence is set. */
    prune: string;
    pruneTitle: string;
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
    /** The row above Archive, and the name of the page it opens. */
    row: string;
    title: string;
    /** The two tabs and, under the ignored one, how far back it reaches. */
    pending: string;
    dismissed: string;
    window: (days: number) => string;
    /** The toolbar's search box and source picker, and what the picker calls every source. */
    search: string;
    allSources: string;
    /** How many of the total are showing, while a search or a source narrows the page. */
    hits: (shown: number, total: number) => string;
    /** The group that holds everything nothing named a source for. It is a heading and no
     *  more — an item under it is never given a source name or a mark of its own. */
    noSource: string;
    /** One source group: folding it, and the button that brings the next of it in. */
    fold: string;
    unfold: string;
    more: string;
    /** An empty page: a heading, and the line under it saying what fills it. Nothing this
     *  search and source found gets the heading alone. The ignored tab has a pair of its
     *  own: what lands there is not something you add. */
    empty: string;
    emptyHint: string;
    emptyDismissed: string;
    emptyDismissedHint: string;
    noHits: string;
    clear: string;
    /** No endpoint configured: one link to the docs that say how to serve and point at one.
     *  An offer, not a demand — an unconfigured board still takes what is dropped in. */
    connect: string;
    /** Read out loud as the name of the list. */
    list: string;
    /** One item opened in full: what the panel is called, when it was collected, and — for
     *  one already ignored — when and why it was. */
    detail: string;
    collected: string;
    dismissedAt: string;
    dismissedWhy: string;
    /** On an ignored card, in place of the values a waiting one draws: the agent's own
     *  reason, or this line when the user was the one who ignored it. */
    byYou: string;
    /** A record carried over from a board that kept only source ids and times (#559): its
     *  own words were never saved, so the id stands in for the title and this chip — with
     *  the judged time after it — stands in for the reason. */
    contentGone: string;
    /** The two things an item offers. Dismissing cannot be undone, which is why the word is
     *  the plain one. Open is left off one with nothing to open. */
    viewOriginal: string;
    dismiss: string;
    /** A dismissal the board refused. */
    dismissFailed: string;
    /** Add to triage (#499, #560): the popover under the button, and what it takes. */
    add: {
      /** The button, and the popover's own heading. */
      open: string;
      title: string;
      placeholder: string;
      /** Staging a file: the offer, the name of the one held, and taking it back off. */
      attach: string;
      remove: string;
      /** One file at a time, said where the second one was dropped. */
      oneFile: string;
      button: string;
      /** An add the board refused for a reason it cannot put in the reader's language. */
      failed: string;
      /** It landed somewhere this page is not showing — and the way to go to it. */
      hidden: string;
      show: string;
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
  };
};
