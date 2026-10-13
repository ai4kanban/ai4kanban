/** The board screen: its columns, the cards in them, the notices above them, and
 *  Create task. */
export type BoardCopy = {
  reading: string;
  notice: {
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
    /** Cards untouched for over five days (#1640), and how long each has sat. */
    stale: string;
    staleEmpty: string;
    staleDays: (days: number) => string;
    staleDaysTip: (days: number) => string;
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
      /** An existing discussion before its first read lands (#1217) — read aloud only. */
      opening: string;
      /** …and when that read failed, or found the discussion gone. */
      openFailed: string;
      retry: string;
      /** The guard Start now opens under the plan. Nothing starts until it is confirmed. */
      guard: {
        title: string;
        /** Start all (#1442): one card and one build per plan. */
        titleMany: (count: number) => string;
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
        /** Start now off the plan: one card written from it, built in the same run. */
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
        /** Several plans (#1442): the pair under them all, and each row's own two. */
        planAll: string;
        buildAll: string;
        planOne: string;
        buildOne: string;
        /** One run writing the cards of several plans (#917). */
        planningMany: (count: number) => string;
        /** The box, closed, under the cards the run wrote (#1213). */
        closed: string;
        /** The answer that was pressed, while its run is being asked for (#706). The other
         *  two are down beside it and the box sends nothing. */
        starting: string;
        /** Start now went through Plan tasks: the connector can't take the discussion into a build (#1246). */
        rerouted: string;
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
  /** The corner office cheering a milestone (#1331): why, in bold, then what it names or
   *  counts. Says "done", never how the work got onto the branch. */
  cheer: {
    group: (count: number) => string;
    first: string;
  };
};
