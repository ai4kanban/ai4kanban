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
  /** The drafts block a marketing card's page draws where a product card draws its
   *  delivery (#411). The tab names are file and channel names, so they are not here. */
  drafts: {
    repurpose: string;
    repurposeHint: string;
    repurposeFailed: string;
    publish: string;
    publishHint: string;
    publishFailed: string;
    /** Why both are off while the source is the tab on screen. */
    notOnSource: string;
    /** The empty editor, before anything is written for this tab. */
    empty: string;
    unsaved: string;
    /** The draft was rewritten on disk while the reader was typing. Saving replaces it. */
    movedUnderneath: string;
    /** Repurposing over a draft that is already there. The body is the board's own
     *  sentence, so only the title and the confirm are here. */
    replaceTitle: string;
    replaceBody: string;
    replaceConfirm: string;
    /** Publish asks where the piece went up before it marks the channel. */
    publishTitle: (channel: string) => string;
    publishIntro: string;
    publishUrlPlaceholder: string;
    publishConfirm: string;
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
    andImplement: string;
    /** The page the panel becomes at phone width (#357): its title, and the line under it
     *  saying what answering does. At window width the panel is read in place and needs
     *  neither. */
    pageTitle: (id: number) => string;
    pageBlurb: string;
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
