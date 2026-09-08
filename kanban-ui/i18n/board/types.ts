/** The board screen: its columns, the cards in them, the notices above them,
 *  Create task, and the release picker in the top row. */
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
    /** Cloud is out of reach (#316). The board still reads — this is the copy — and nothing
     *  can be saved until it answers. Names how old the copy is, because that is the whole
     *  of what the reader has to judge. */
    offline: (lastRead: string) => string;
    /** A copy this machine has never read from the workspace. */
    offlineNeverRead: string;
  };
  queue: {
    ready: string;
    /** The ready column's two numbers: work waiting on you, and work already going. */
    readyCount: (ready: number, implementing: number) => string;
    notReady: string;
    /** The one card column a marketing board has (#435), and its two numbers: every topic
     *  on it, and how many of them are being written. */
    topics: string;
    topicsCount: (total: number, writing: number) => string;
    recurring: string;
    /** A column with nothing on this side of the split. */
    empty: string;
    /** A board holding no card at all (#437) — the panel that stands in for the columns,
     *  and the offer of the first card. */
    emptyBoard: { title: string; blurb: string; create: string };
    /** The columns as a swipe, at phone width (#357): what the row is, and the dot that
     *  jumps to one of them. */
    columns: string;
    goToColumn: (title: string) => string;
  };
  card: {
    questionsOne: string;
    questionsMany: (n: number) => string;
    /** Of those, the ones waiting on the user. Joined after the count above. */
    needsYouOne: string;
    needsYouMany: (n: number) => string;
    /** Things the build left for the user to check by hand. */
    verify: (n: number) => string;
    /** Questions the decider answered in the user's place (#447). */
    decided: (n: number) => string;
  };
  create: {
    button: string;
    /** Shown when the agent wouldn't start and said nothing about why. */
    startFailed: string;
    /** The full-screen sheet the button opens (#426): what it asks, what sending does,
     *  and the two short lines under the box. The headline holds across the whole mode
     *  row — Discuss (#427), Add task, Build now (#428). */
    sheet: {
      headlines: readonly string[];
      slogan: string;
      placeholder: string;
      /** What the mode row is, read out. */
      modes: string;
      /** The box once the discussion is going — it takes an answer, not a description. */
      answer: string;
      /** The mode that talks the idea through first (#427) — what the screen opens on,
       *  unless nothing on this board can hold a conversation. */
      discuss: string;
      /** The mode that writes a card. */
      addTask: string;
      /** The mode that builds what you typed, from a card the run writes itself (#470). */
      buildNow: string;
      /** The corner button. Its own word, so a reader isn't told "Add task" twice. */
      send: string;
      keys: string;
      /** Esc keeps a discussion rather than throwing it away, so it says so. */
      keysDiscuss: string;
      /** Which version a card written here ships in — in every mode, since Build now
       *  writes one too (#470). Nothing is said with no release on screen. */
      shipsIn: (release: string) => string;
      /** And, in Build now, the one thing that mode gives up, beside the release. */
      builds: string;
      /** The guard Send opens in Build now. Nothing starts until it is confirmed. */
      guard: {
        title: string;
        /** The card the run writes from what you typed — what this mode does, above what
         *  it skips (#470). */
        writes: string;
        /** One line per step this mode skips. */
        skips: readonly string[];
        cancel: string;
        confirm: string;
      };
      /** The plan the discussion is writing (#427) — the panel down the right, and the
       *  handoff to the run that turns it into cards. */
      plan: {
        label: string;
        /** The card's own size — it takes the sheet, or stands where it was. */
        enlarge: string;
        shrink: string;
        copyPath: string;
        /** The agent is rewriting the file. The words on screen are the last ones written. */
        rewriting: string;
        /** The three answers under the ask, and the line beside them (#481). */
        start: string;
        /** Build now off the plan: one card written from it, built in the same run. */
        build: string;
        notYet: string;
        startHint: string;
        /** The last run never wrote a card, so the offer stands again — said for whichever
         *  of the two answers started it. */
        tryAgain: string;
        buildAgain: string;
        /** That run is still working — no second answer is offered. */
        planning: string;
        building: string;
      };
    };
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
