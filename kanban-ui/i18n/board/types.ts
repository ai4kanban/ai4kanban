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
     *  and the offer of the first card. A marketing board offers a topic instead, and the
     *  offer opens the editor rather than a planning sheet (#507). */
    emptyBoard: {
      title: string;
      blurb: string;
      create: string;
      topicTitle: string;
      topicBlurb: string;
      topicCreate: string;
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
      /** The one control such a card carries: pick its creator back up. There is no page
       *  to offer it on, so it lives on the card. */
      resume: string;
      resuming: string;
      resumeFailed: string;
      /** The line beside it, saying what went wrong. */
      stopped: string;
    };
  };
  create: {
    button: string;
    /** What the same control says on a marketing board (#507). It opens no sheet: one press
     *  writes the topic and lands in its editor. */
    topicButton: string;
    /** Shown when the topic could not be written and the board said nothing about why. */
    topicFailed: string;
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
      /** The runtime the run will spawn on (#518) — the picker beside Send, in Add task and
       *  in Build now. */
      runtime: {
        /** The control, read out. */
        label: string;
        /** What it is running, on hover. */
        hint: (runtime: string) => string;
        /** The row that is the flow's own agent's runtime — the way back to it. */
        agentsOwn: string;
        /** A row whose CLI is not on this machine. Offered all the same. */
        notInstalled: string;
        /** The one line under the list: what a pick here does, and does not, change. */
        cost: string;
      };
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
  /** Feedback on a landed task (#603): the board's standing Feedback button and the sheet
   *  behind it, and the block on New task that links the landed task a fix is about. */
  feedback: {
    /** The standing button in the top row. */
    button: string;
    sheet: {
      title: string;
      /** Who takes it, what goes with it, and how long the permission lasts. Said above the
       *  box rather than under the button. */
      blurb: string;
      placeholder: string;
      send: string;
      sending: string;
      /** Shown in place of the box once it has gone. Says the feedback is one way. */
      sent: string;
      /** Beside the send button, before it is pressed. */
      noReply: string;
    };
    link: {
      /** The collapsed button, and the heading it becomes when it is open. */
      expand: string;
      /** Folds it and forgets both ticks; what was typed stays in the box. */
      cancel: string;
      search: string;
      /** No archived card matches what was typed — including on a board that has archived
       *  nothing, which is the same answer to the same search. */
      empty: string;
      /** The archive could not be read — not the same answer as "nothing matches", and the
       *  one worth offering again. Neither stops an ordinary task being created. */
      failed: string;
      retry: string;
      /** Takes the linked card back off. */
      clear: string;
      /** The first authorisation, and what it costs. */
      share: string;
      shareNote: string;
      /** The second, given separately. */
      diagnostics: string;
      diagnosticsNote: string;
      /** Each attachment by name. */
      parts: { card: string; chat: string; trace: string; environment: string };
      /** How large one attachment is. */
      size: (bytes: number) => string;
      /** Marked on an attachment this machine held more of than could be sent. */
      partCut: string;
      /** Take one attachment out of this submission, and put it back. */
      drop: string;
      restore: string;
    };
    /** A submission that went, said on New task where the sheet has already closed. The
     *  standing sheet says its own in place of the box. */
    taskSent: string;
    /** A submission that did not go: what happened, then why. */
    failed: {
      /** On New task — the task was created all the same. */
      task: string;
      /** On the standing sheet, where nothing else was happening. */
      standing: string;
      tooLarge: string;
      refused: string;
      unreachable: string;
    };
  };
  /** The partner submission written in a discussion (#628) — the link area under the box,
   *  and what the send came to. It says what the user did and what came back; never an
   *  endpoint, a storage, a flow id or a run. */
  partner: {
    /** The collapsed button, and the heading it becomes when it is open. */
    expand: string;
    /** Folds it, forgets the link and the tick, and takes the submission off this
     *  discussion. What was typed stays in the box. */
    cancel: string;
    search: string;
    /** Beside a card that has not been archived yet. */
    onBoard: string;
    empty: string;
    failed: string;
    retry: string;
    clear: string;
    /** The one authorisation, off until it is ticked. */
    share: string;
    /** Under it, when partner feedback is on: what riding along with it means. */
    shareNote: string;
    /** …and when it is off: nothing is offered to tick, only the way to turn it on. */
    off: string;
    turnOn: string;
    /** Opens the same terms the switch does. */
    terms: string;
    /** While the agent is working out what went wrong and gathering the material. */
    working: string;
    sent: {
      title: string;
      /** The number, and the two things to do with it. */
      number: string;
      copy: string;
      copied: string;
      /** How to have it deleted — the one address, handed in. */
      erase: (email: string) => string;
    };
    notSent: {
      title: string;
      retry: string;
      /** The way out of a pack too large to send. */
      textOnly: string;
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
