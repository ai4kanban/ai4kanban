/** A card's own page: the title band, the toolbar, the delivery block and its
 *  diff, the meta box, the body, and the mockups the body points at. */
export type CardCopy = {
  /** The line up to the group root this card is part of. */
  partOf: (id: number, title: string) => string;
  /** The badge beside the title while an agent is inside this card. `verb` is the
   *  action's own word — "refining", "implementing". */
  working: (verb: string) => string;
  workingUnknown: string;
  landed: (commit: string) => string;
  landedNothing: string;
  /** The last delivery on this card was ended before it landed. */
  ended: string;
  /** The card left the board while its page was open (#299) — a delivery that landed
   *  archived it, or a group root went with its last subtask. The page stays put and says
   *  so; the archive holds what it became. */
  offBoard: { line: string; open: string };
  /** The delivery started again from the current card rather than the approved copy. */
  supersedes: string;
  /** The heading over a delivery note that is waiting on the reader. */
  waitingOnYou: string;
  /** An approval taken elsewhere whose machine stopped before it finished (#318). Nothing
   *  picks it up on its own, so the two ways out are here beside the delivery. */
  interrupted: {
    line: string;
    resume: string;
    resuming: string;
    cancel: string;
    cancelling: string;
    resumeFailed: string;
    cancelFailed: string;
  };
  /** Why the card's own controls are off while a delivery holds it. Follows the
   *  delivery's own line, which is the board's words rather than the UI's. */
  heldPaused: string;
  heldRunning: string;
  toolbar: {
    implement: string;
    run: string;
    runHint: string;
    refine: string;
    refineHint: string;
    /** Another run already holds this card. `verb` is what it is doing. */
    alreadyRunning: (verb: string) => string;
    edit: string;
    reviewAgain: string;
    reviewAgainHint: string;
    archive: string;
    reject: string;
    startFailed: string;
    scheduleFailed: string;
    unscheduleFailed: string;
    editFailed: string;
    /** The stacked actions at phone width (#357): the way back to the column this card
     *  came from, and the fold the actions past the first three sit behind. */
    backTo: (column: string) => string;
    more: string;
    fewer: string;
    /** Resolve, which at window width is the questions panel itself. At phone width the
     *  panel is a page of its own, so the stack needs a button to push it. */
    resolve: string;
  };
  /** A marketing card's own page (#434) — the whole of it, since nothing a product card
   *  page says is drawn there. The tab names are file and channel names, not copy. */
  marketing: {
    /** The way back to the board, beside the title. */
    back: string;
    /** The `…` menu, and the three things in it that are this page's own. */
    more: string;
    rewrite: string;
    /** The two centred actions on a tab nothing is written for, and the line under them
     *  saying the other way is simply to type. */
    draft: string;
    rewriteFromSource: string;
    orJustWrite: string;
    startFailed: string;
    /** An agent is writing this card — a run, or its own conversation. */
    rewriting: string;
    /** How far this topic is published, beside the title. */
    publishedCount: (published: number, total: number) => string;
    /** The editor's corner: the file, and whether it holds what is on screen. */
    saved: string;
    unsaved: string;
    /** The `+` at the right of the tab strip. */
    addChannel: string;
    addChannelFailed: string;
    /** The repurpose panel (#457) — the one AI move the source tab has, and the same panel
     *  a single channel's Rewrite opens. It is the ask: nothing starts until it is
     *  confirmed, so what it says is what is about to happen. */
    repurpose: {
      /** The strip's button, and the panel's title in each of its two shapes. */
      action: string;
      titleAll: string;
      titleOne: (channel: string) => string;
      /** What this repurpose does: the channels it writes for the first time, and the
       *  drafts it replaces — whose edits are the only copy there is. */
      willWrite: (channels: string, count: number) => string;
      willReplace: (channels: string, count: number) => string;
      /** What two channel names are strung together with. */
      separator: string;
      /** The idea you had while asking, carried into every run this starts. Optional. */
      notePlaceholder: string;
      /** The language this one piece is written in. Unset means the channel's own. */
      language: string;
      followChannel: string;
      /** The confirm, and what it says while the runs are starting. */
      start: string;
      starting: string;
      failed: string;
    };
    /** Publish asks where the piece went up before it marks the channel. */
    publish: string;
    publishFailed: string;
    publishTitle: (channel: string) => string;
    publishIntro: string;
    publishUrlPlaceholder: string;
    publishConfirm: string;
    /** Commenting on a passage, and the batch of comments that goes to one polish (#458).
     *  A comment is saved on its lines, not sent — the whole read-through is submitted at
     *  once — so nothing here is worded as a message to an agent. */
    comment: {
      /** The box that floats up while a passage is selected. */
      placeholder: string;
      leave: string;
      /** The list under the editor: its heading, and the two things a row offers. */
      heading: string;
      edit: string;
      drop: string;
      save: string;
      /** The line beside Submit, and the button itself with the batch's count. */
      hint: string;
      submit: (n: number) => string;
      /** While the polish is running, in Submit's place. */
      polishing: (n: number) => string;
      failed: string;
    };
  };
  delivery: {
    /** The fold's own control, which is the whole tab strip. */
    fold: string;
    unfold: string;
    tabDiff: string;
    tabLog: string;
    tabApproval: string;
    /** The block before its first session has written anything. */
    noLog: string;
    /** The block's foot: where the code is, and how it commits. */
    projectFolder: string;
    projectFolderHint: string;
    autoCommit: string;
    manualCommits: string;
    /** Only said when this delivery froze AI review OFF (#416) — the default needs no line. */
    noReview: string;
    noReviewHint: string;
    landedAs: string;
    finished: string;
    /** What a session's own line says once it is not running. */
    stopped: string;
    interrupted: string;
    done: string;
    exited: (code: string) => string;
    running: string;
    stop: {
      label: string;
      stopping: string;
      title: string;
      body: string;
      keep: string;
      failed: string;
    };
    resume: {
      label: string;
      resuming: string;
      /** A dead conversation to pick back up, and a run that never started. */
      pickUpHint: string;
      startHint: string;
      failed: string;
    };
    discard: {
      label: string;
      /** The delivery is still in flight, and it isn't. */
      titleActive: string;
      titleSaved: string;
      unlocks: string;
      /** Names the worktree and branch a discard deletes. */
      deletes: (what: string) => string;
      /** A delivery working in the project folder has nothing of its own to lose. */
      nothingToLose: string;
      keep: string;
      failed: string;
    };
    approval: {
      approved: string;
      approvedBody: (covers: string) => string;
      required: string;
      /** Ends before the Approve button. `covers` is the board's own words. */
      readDiff: (covers: string) => string;
      approve: string;
      failed: string;
    };
    /** The confirm popover's busy label, shared by the controls above. */
    working: string;
  };
  meta: {
    modules: string;
    release: string;
    priority: string;
    roi: string;
    todos: string;
    lastRun: string;
    neverRun: string;
    cadence: string;
    nextRun: string;
    blockedBy: string;
    scheduled: string;
    unschedule: string;
    unscheduleHint: string;
    related: string;
  };
  subtasks: {
    heading: string;
    /** Only read out loud: a subtask an agent is inside. */
    running: string;
    /** A chip in the build-order map that waits on a card outside its own group. */
    waitingOutside: (ids: string) => string;
    /** The fold under the map that opens the rows: how many there are. */
    list: (n: number) => string;
  };
  /** The block the card's open questions are read in — and answered in. */
  questions: {
    heading: string;
    recommended: string;
    /** The way in, on the heading row: what the panel's hover shadow means, in words. */
    decide: string;
    answerPlaceholder: string;
    optionsPlaceholder: string;
    /** Put the panel back to a read, keeping whatever was ticked or typed. */
    close: string;
    resolve: string;
    /** The page the panel becomes at phone width (#357): its title, and the line under it
     *  saying what answering does. At window width the panel is read in place and needs
     *  neither. */
    pageTitle: (id: number) => string;
    pageBlurb: string;
  };
  /** What the decider chose here in your place (#447) — a read-only record, folded shut
   *  beside the hand-checks. */
  decided: {
    heading: string;
    /** Under the heading: these answers went nowhere but this card. */
    note: string;
    /** Before the file it went on. */
    from: string;
    /** Nothing settled it, so it took the question's own recommendation. */
    blind: string;
  };
  handChecks: {
    heading: string;
    crossOff: string;
    crossOffAria: (line: string) => string;
    crossOffHint: string;
    failed: string;
  };
  /** The fold over the half of the body the agent worked out. */
  agentHalf: string;
  diff: {
    uncommitted: string;
    truncated: string;
    truncatedHint: string;
    hideTree: string;
    showTree: string;
    /** What a file's header says when it is not a plain edit. */
    added: string;
    deleted: string;
    renamed: string;
    binary: string;
    noLines: string;
    /** Only read out loud: which side of the diff a line is on. */
    lineAdded: string;
    lineRemoved: string;
  };
  mockup: {
    openFull: string;
    screen: string;
    code: string;
    /** The frame's own title, for a screen reader. */
    frame: (label: string) => string;
    back: (id: number) => string;
  };
};
