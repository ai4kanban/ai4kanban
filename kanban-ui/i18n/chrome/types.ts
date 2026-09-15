import type { UpdateFailure } from "@/components/desktop";

/** The frame every screen is drawn in: the window itself, the top row, the
 *  projects list behind the folder badge, the notice strip, and the screen a dead
 *  card link lands on. */
export type ChromeCopy = {
  /** The window's own title and description (`app/layout.tsx`). */
  window: { title: string; description: string };
  header: {
    /** The mark that leads home — its tooltip and what a screen reader reads. */
    home: string;
    /** The quiet mark that opens AI4Kanban's own repository in a browser — its
     *  tooltip and what a screen reader reads. Name the product: on a board that
     *  is itself a repo, "GitHub" alone reads as the user's own. */
    github: string;
  };
  /** Only read out loud: the drag handles that widen a pane. */
  resize: { rail: string; chat: string; bell: string };
  /** The card link a Slack message carries (#320), when it leads nowhere: the board it
   *  names has been moved off this machine. */
  cardLink: { notHere: string };
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
    /** Every other row: picking it opens that project in a window of its own (#570). */
    openWindow: string;
    /** The dot on a project an agent is still working in. */
    runningHere: string;
    forget: string;
  };
  /** The board badge inside the folder chip (#407): which of this project's boards is
   *  open, and the switcher onto the others. */
  boards: {
    heading: string;
    /** The badge's tooltip in the app, where it opens the list. Takes the board's folder. */
    badge: (boardDir: string) => string;
    /** The dot on the board this window is showing. */
    openHere: string;
    /** Every other row: picking it opens that board in a window of its own (#495). */
    openWindow: string;
    /** What each board's work is called, by solution. A board whose solution this copy
     *  does not know keeps the word the rules answered with. */
    work: Record<"product" | "marketing", string>;
    /** The marketing board is not finished yet — the tag beside its name, and its tooltip. */
    alpha: string;
    alphaHint: string;
  };
  /** The update chip (#701). The app downloads a new version on its own and says
   *  nothing while it does, so the chip has two states and each is one line. */
  update: {
    /** The chip's tooltip once the download is in place: the version, and what
     *  pressing it does. */
    ready: (version: string) => string;
    /** The word on the chip. It restarts the app, so it says so. */
    restart: string;
    /** The word on the chip when the update did not go in, and its tooltip when
     *  the cause is not one we can name. */
    failed: string;
    /** That tooltip with a named cause: the state, then the reason. */
    failedWhy: (reason: string) => string;
    /** One short phrase per cause, for the line above. Short because the tooltip
     *  is one line and must fit the narrowest window the chip is drawn in;
     *  `unknown` is empty, which is what leaves `failed` standing on its own. */
    reason: Record<UpdateFailure, string>;
  };
  app: {
    notice: string;
    get: string;
    hide: string;
  };
  /** The buttons about a board's own existence that only the app can offer: the two on the
   *  "no board here" screen, and the way back out of a folder opened by mistake (#372). */
  noBoard: {
    pickAnother: string;
    make: string;
    making: string;
    /** Shown when the app couldn't scaffold the board and said nothing about why. */
    makeFailed: string;
    /** On the setup rail, while the board is the app's own work and none of the user's. */
    discard: string;
    /** What the press does, since the button says only what it is for. */
    discardHint: string;
    discarding: string;
    discardFailed: string;
  };
  /** Putting `akb` on the PATH, from the command row of Configuration → General. */
  command: {
    install: string;
    repair: string;
    writing: string;
    /** Shown when the install failed and the app said nothing about why. */
    failed: string;
    /** Where the command now is, on a system that puts a folder on the PATH. */
    donePath: string;
    /** The same, where the command is a symlink the app can also be launched by. */
    doneSymlink: string;
  };
  /** The phone shell (#357): the tab bar every screen there carries, and the More screen
   *  the rest of the top row moved into. None of it is drawn at window width. */
  phone: {
    /** `nav` is only read out loud: the bar's own name. */
    tabs: { nav: string; board: string; find: string; memory: string; more: string };
    more: {
      /** The heading over the board's own folder. */
      board: string;
      /** What the phone doesn't offer, and where it is done instead. */
      atTheComputer: string;
      atTheComputerBlurb: string;
      runs: string;
      diffs: string;
      configuration: string;
      chat: string;
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
    readOnline: string;
    failedEnd: string;
    reading: string;
  };
};
