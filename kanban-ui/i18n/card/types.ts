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
  /** Somebody else is holding this card (#375) — a Cloud board only, and only while the
   *  hold is live. A hint, not a gate: what protects the card is the refusal a save meets,
   *  so this says who to wait for and until when, and nothing about asking them. */
  hold: (handle: string, until: string) => string;
  /** The mark beside the title for this card's live Cloud decision — the states no local
   *  mark has words for. Same terms the bell uses, one short word each. */
  cloudBand: {
    actionable: string;
    accepted: string;
    waitingForServer: string;
    running: string;
    stale: string;
  };
  /** The delivery started again from the current card rather than the approved copy. */
  supersedes: string;
  /** A delivery that makes files stopped on what it made (#874). */
  filesOutside: (paths: string) => string;
  filesMissing: (paths: string) => string;
  filesNone: string;
  /** Landing will not write over the user's own files (#958). A change of theirs is
   *  committed or stashed; a file of theirs git does not track is moved or deleted — two
   *  different ways out, so two sentences. One file is named, more are counted. */
  landWait: {
    overwrite: (files: string[]) => string;
    untracked: (files: string[]) => string;
  };
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
    /** Edit opens this card's own conversation (#633) — the hint says so, since the word
     *  alone reads as a form. */
    edit: string;
    editHint: string;
    /** Its chat is writing a reply (#633): the mark beside the title, and what every
     *  control the hold turns off says on hover. */
    discussing: string;
    discussingWhy: string;
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
      /** The same word for a delivery that ENDED (#639): the toolbar's control beside
       *  Discard, which finishes the job rather than throwing its work away. */
      carryOnHint: string;
      carryOnFailed: string;
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
    /** A landing conflict the board resolves by itself (#595): the attempt running, the
     *  countdown to the next one, and what is still conflicted. No denominator anywhere —
     *  the attempts do not run out. */
    conflict: {
      resolving: (attempt: number) => string;
      waiting: (seconds: number, attempt: number) => string;
      starting: (attempt: number) => string;
      /** The files still conflicted — one is named, more are counted — and, while the board
       *  is waiting, that the wait costs no other delivery its turn. */
      stuck: (files: string[], waiting: boolean) => string;
    };
    /** A target branch that moved while this was landing (#665). The board starts over on
     *  the new code by itself, so there is only ever a wait here — never a run. No
     *  denominator either: the attempts do not run out. */
    moved: {
      waiting: (seconds: number, attempt: number) => string;
      starting: (attempt: number) => string;
      /** What moved, and that the wait costs no other delivery its turn. */
      body: (branch?: string) => string;
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
    /** The workflow this card runs through (#715) — the first thing in the strip: it is what
     *  decides who plans, who builds and who reviews this card. Read-only: a card's
     *  workflow is fixed when it is created (#744). */
    workflow: string;
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
    /** Leave one of your questions unanswered (#831); the card stays as it is. */
    skip: string;
    /** Take a skip back: the question is open again. */
    undo: string;
    skipFailed: string;
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
  /** The page while the card is being read (#906). `reading` is for a screen reader only. */
  opening: { reading: string; failed: string; retry: string };
  mockup: {
    openFull: string;
    screen: string;
    code: string;
    /** The frame's own title, for a screen reader. */
    frame: (label: string) => string;
    back: (id: number) => string;
    /** In place of a player the browser cannot play the file in. */
    unplayable: string;
    download: string;
    play: string;
    pause: string;
    replay: string;
    seek: string;
    mute: string;
    unmute: string;
    loadingPreview: string;
    previewFailed: string;
  };
  /** A `<Storyboard>` script (#963). */
  storyboard: {
    heading: string;
    summary: (shots: number, seconds: string) => string;
    sketch: string;
    timeline: string;
    voiceover: string;
    noVoiceover: string;
    action: string;
    details: string;
    captions: string;
    start: string;
    end: string;
    noFrame: string;
    empty: string;
    needsFixing: string;
    fixHint: string;
    copyDiagnostics: string;
    copied: string;
    diagnostics: string;
    reload: string;
    unavailable: string;
    slidesHeading: string;
    pages: (slides: number) => string;
    slidesTimeline: string;
    onSlide: string;
    notes: string;
    noNotes: string;
    layout: string;
    noPreview: string;
    emptySlides: string;
  };
};
