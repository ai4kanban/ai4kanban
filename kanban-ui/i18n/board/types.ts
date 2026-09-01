/** The board screen: its columns, the cards in them, the notices above them, the
 *  bulk-move bar, Create task, and the release picker in the top row. */
export type BoardCopy = {
  reading: string;
  notice: {
    /** A release is being filled from its goal. Ends before the Watch-the-run link. */
    planning: (release: string) => string;
    watchRun: string;
    /** Making the release worked, starting the run that fills it did not. */
    planNotStarted: (release: string, why: string) => string;
    /** The changelog a close asked for never arrived. Ends before the command. */
    changelogMissing: (release: string, why: string) => string;
    changelogStopped: string;
    changelogUnfinished: string;
    /** Names the command that writes it after all. Ends before the Dismiss link. */
    changelogWriteIt: (command: string) => string;
    dismiss: string;
    /** The release pick has emptied the screen: on No release, and on a version. */
    allPlanned: string;
    releaseEmpty: (release: string) => string;
    showNoRelease: string;
  };
  queue: {
    ready: string;
    /** The ready column's two numbers: work waiting on you, and work already going. */
    readyCount: (ready: number, implementing: number) => string;
    notReady: string;
    recurring: string;
    /** A column with nothing on this side of the split. */
    empty: string;
    /** The columns as a swipe, at phone width (#357): what the row is, and the dot that
     *  jumps to one of them. */
    columns: string;
    goToColumn: (title: string) => string;
  };
  card: {
    tick: (id: number, title: string) => string;
    untick: (id: number, title: string) => string;
    tickHint: string;
    questionsOne: string;
    questionsMany: (n: number) => string;
    /** Of those, the ones waiting on the user. Joined after the count above. */
    needsYouOne: string;
    needsYouMany: (n: number) => string;
    /** Things the build left for the user to check by hand. */
    verify: (n: number) => string;
  };
  create: {
    button: string;
    /** Shown when the agent wouldn't start and said nothing about why. */
    startFailed: string;
  };
  bulk: {
    tickedOne: string;
    tickedMany: (n: number) => string;
    move: string;
    moving: string;
    noRelease: string;
    untickAll: string;
    failedOne: string;
    failedMany: (n: number) => string;
  };
  release: {
    which: string;
    whichHint: string;
    /** The first entry: the open cards not promised to a version. */
    none: (count: number) => string;
    noneHint: string;
    new: string;
    /** The ⋯ segment holding the verbs that end the version on screen. */
    menu: (release: string) => string;
    whatItIsFor: string;
    fillFromGoal: string;
    close: string;
    drop: string;
    goal: {
      title: (release: string) => string;
      blurb: string;
      placeholder: string;
      saveFailed: string;
    };
    plan: {
      title: (release: string) => string;
      blurb: (release: string) => string;
      background: string;
      start: string;
      starting: string;
      startFailed: string;
    };
    closing: {
      title: (release: string) => string;
      blurb: (release: string) => string;
      reading: string;
      shippedNone: string;
      shippedOne: string;
      shippedMany: (n: number) => string;
      changelogNone: string;
      changelog: string;
      /** Open cards with every todo ticked that were never archived. */
      unarchivedOne: string;
      unarchivedMany: (n: number) => string;
      leftNone: string;
      /** Ends with a colon; the cards follow. */
      leftOne: string;
      leftMany: (n: number) => string;
      confirm: string;
      closing: string;
      failed: string;
    };
    dropping: {
      title: (release: string) => string;
      blurb: (release: string) => string;
      reading: string;
      archivedNone: string;
      archivedOne: string;
      archivedMany: (n: number) => string;
      leftNone: string;
      leftOne: string;
      leftMany: (n: number) => string;
      confirm: string;
      dropping: string;
      failed: string;
    };
    make: {
      title: string;
      fromGoal: string;
      noGoal: string;
      blurb: string;
      idPlaceholder: string;
      goalAsk: string;
      goalPlaceholder: string;
      goalReady: string;
      goalMissing: string;
      confirm: string;
      making: string;
      failed: string;
    };
    /** The No-goal tab's switch: the plain high-priority rule, and what it comes
     *  to on this board. */
    autoFill: {
      reading: string;
      on: string;
      nothingToMove: string;
      goesInOne: string;
      goesInMany: (n: number) => string;
      /** Joined onto the line above, before the full stop. */
      skippedOne: string;
      skippedMany: (n: number) => string;
    };
  };
};
