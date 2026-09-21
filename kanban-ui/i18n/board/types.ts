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
    recurring: string;
    /** A column with nothing on this side of the split. */
    empty: string;
    /** A board holding no card at all (#437) — the panel that stands in for the columns,
     *  and the offer of the first card. */
    emptyBoard: {
      title: string;
      blurb: string;
      create: string;
    };
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
    /** A card its creator has not finished writing (#564). It stands in for the status
     *  pill, and the card does nothing when clicked. */
    creating: {
      mark: string;
      markHint: string;
      /** …and the same card once its creator stopped short. */
      unfinished: string;
      unfinishedHint: string;
      resume: string;
      resuming: string;
      resumeFailed: string;
      discard: string;
      discarding: string;
      discardTitle: (id: number) => string;
      discardBody: string;
      discardGroup: (count: number) => string;
      discardFailed: string;
      cancel: string;
      retry: string;
    };
  };
  create: {
    button: string;
    /** Shown when the agent wouldn't start and said nothing about why. */
    startFailed: string;
    /** The full-screen sheet the button opens (#426): a discussion (#427, #840). */
    sheet: {
      headlines: readonly string[];
      slogan: string;
      placeholder: string;
      /** The box once the discussion is going — it takes an answer, not a description. */
      answer: string;
      /** The workflow the plan's card runs through (#715), picked beside the plan's answers. */
      workflow: { label: string; manage: string };
      /** The corner button. */
      send: string;
      /** Esc keeps a discussion rather than throwing it away, so it says so. */
      keysDiscuss: string;
      /** The guard Build now opens under the plan. Nothing starts until it is confirmed. */
      guard: {
        title: string;
        /** The card the run writes from the plan, above what it skips (#470). */
        writes: string;
        /** One line per step it skips. */
        skips: readonly string[];
        cancel: string;
        confirm: string;
      };
      /** The plan the discussion is writing (#427) — the panel down the right, and the
       *  handoff to the run that turns it into cards. */
      plan: {
        label: string;
        /** The plan collapsed to one row, and opened back out over the conversation — what a
         *  sheet too narrow to stand it beside the conversation offers instead (#669). */
        expand: string;
        collapse: string;
        /** The card's own size — it takes the sheet, or stands where it was. */
        enlarge: string;
        shrink: string;
        copyPath: string;
        /** The agent is rewriting the file. The words on screen are the last ones written. */
        rewriting: string;
        /** The two answers under the ask (#481), and what each does on hover (#847). */
        start: string;
        /** Build now off the plan: one card written from it, built in the same run. */
        build: string;
        planHint: string;
        buildHint: string;
        /** The last run never wrote a card, so the offer stands again — said for whichever
         *  of the two answers started it. */
        tryAgain: string;
        buildAgain: string;
        /** That run is still working — no second answer is offered. */
        planning: string;
        building: string;
        /** Several open plans (#917): what Start planning takes, Build now down beside it, and
         *  the two lines above said of them all. */
        includes: (count: number) => string;
        buildOnlyOne: string;
        tryAgainMany: string;
        planningMany: (count: number) => string;
        /** The answer that was pressed, while its run is being asked for (#706). The other
         *  two are down beside it and the box sends nothing. */
        starting: string;
        /** Why the run never started, when the refusal has no sentence of its own (#706). Said
         *  under the three answers, which are live again — pressing the same one is the retry. */
        failed: {
          other: string;
        };
      };
    };
  };
  /** Team feedback (#628, #679) — the switch under the box, and the card a discussion says
   *  its problem is about. It says what the user did and what will happen; never an
   *  endpoint, a storage, a flow id or a run. */
  partner: {
    /** The heading over the link area, which opens with sharing and folds nowhere. */
    expand: string;
    search: string;
    /** Beside a card that has not been archived yet. */
    onBoard: string;
    empty: string;
    failed: string;
    retry: string;
    clear: string;
    /** The switch under the box: what it says — the same either way, because what it does
     *  does not change — and the name it is read out by. */
    team: {
      name: string;
      label: string;
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
