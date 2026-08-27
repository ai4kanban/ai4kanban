/** The frame every screen is drawn in: the window itself, the top row, the
 *  projects list behind the folder badge, the notice strip, and the screen a dead
 *  card link lands on. */
export type ChromeCopy = {
  /** The window's own title and description (`app/layout.tsx`). */
  window: { title: string; description: string };
  header: {
    /** The mark that leads home — its tooltip and what a screen reader reads. */
    home: string;
  };
  /** Only read out loud: the two drag handles that widen a pane. */
  resize: { rail: string; chat: string };
  projects: {
    heading: string;
    reading: string;
    /** The list when this board is the only one opened so far. */
    onlyThisOne: string;
    openFolder: string;
    /** The folder badge's tooltip in the app, where it opens the list. Takes the
     *  board's own folder. */
    badge: (boardDir: string) => string;
    /** A remembered folder that has been moved or deleted: its row's tooltip, and
     *  the words beside its name. */
    missing: (path: string) => string;
    missingLabel: string;
    /** The dot on the project this window is showing. */
    openHere: string;
    /** The dot on a project an agent is still working in. */
    runningHere: string;
    forget: string;
  };
  update: {
    available: (version: string) => string;
    download: string;
    skip: string;
  };
  app: {
    notice: string;
    get: string;
    hide: string;
  };
  /** The two buttons on the "no board here" screen that only the app can offer. */
  noBoard: {
    pickAnother: string;
    make: string;
    making: string;
    /** Shown when the app couldn't scaffold the board and said nothing about why. */
    makeFailed: string;
  };
  /** Putting `akb` on the PATH, in Configuration → Setup. */
  command: {
    heading: string;
    install: string;
    repair: string;
    writeAgain: string;
    writing: string;
    /** Shown when the install failed and the app said nothing about why. */
    failed: string;
    /** Where the command now is, on a system that puts a folder on the PATH. */
    donePath: string;
    /** The same, where the command is a symlink the app can also be launched by. */
    doneSymlink: string;
    state: {
      installed: (path: string) => string;
      dangling: (path: string, points: string) => string;
      /** Something else holds the path. `holder` names it; `holderUnknown` stands
       *  in when the app couldn't tell. */
      foreign: (path: string, holder: string) => string;
      /** The same, where npm's own global `akb` would land at that very path. */
      foreignNpm: (path: string, holder: string) => string;
      holderUnknown: string;
      absent: string;
    };
  };
  notFound: {
    title: string;
    leaving: (seconds: number) => string;
    back: string;
  };
  guide: {
    /** The drawer couldn't fetch the guide: the sentence, the link that ends it,
     *  and the stop after the link. */
    failed: string;
    readOnGitHub: string;
    failedEnd: string;
    reading: string;
  };
};
