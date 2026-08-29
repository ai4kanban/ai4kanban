/** The Configuration dialog: its sidebar and every pane in it. The settings a
 *  harness declares — their labels, help and choices — are the board's own rules
 *  and never enter this file. */
export type ConfigurationCopy = {
  open: string;
  title: string;
  sections: string;
  section: {
    runtimes: string;
    agents: string;
    delivery: string;
    rules: string;
    skill: string;
    language: string;
    cloud: string;
  };
  /** Configuration → Runtimes (#344): the runtimes the BOARD names, and what THIS COMPUTER
   *  runs each of them as. The harness block below draws the second half — and, on a board
   *  that names no runtimes, the board's own harness on its own. */
  runtimes: {
    title: string;
    /** The list pane. Takes this computer's name. */
    blurb: (machine: string) => string;
    /** The pane on a board that names no runtimes: today's harness, said to be the board's. */
    boardsOwn: string;
    /** The list's two halves, each naming who reads it. */
    boardHalf: string;
    boardHalfNote: string;
    computerHalf: (machine: string) => string;
    computerHalfNote: string;
    global: string;
    /** One row's right-hand half: what this computer runs that runtime as. */
    runs: (harness: string, model: string) => string;
    /** Why a runtime isn't running its own binding: nothing bound here, or bound to a
     *  harness this build doesn't ship. */
    notBound: string;
    boundUnknown: (bound: string) => string;
    /** …and what ran instead — this computer's binding for the global runtime, or the
     *  board's own harness where this computer has bound nothing at all. */
    ranAsGlobal: (globalRuntime: string, harness: string) => string;
    ranAsBoard: (harness: string) => string;
    /** Naming a new runtime. */
    add: string;
    addBlurb: string;
    namePlaceholder: string;
    save: string;
    cancel: string;
    /** One runtime's view. */
    back: string;
    thisComputer: string;
    bindingBlurb: (runtime: string) => string;
    /** Nothing on the grid is pressed, because this computer isn't running its own binding.
     *  Takes the reason and what runs meanwhile, both built from the four above. */
    pickHarness: (why: string, instead: string) => string;
    unbind: string;
    rename: string;
    renameBlurb: string;
    makeGlobal: string;
    isGlobal: string;
    remove: string;
    /** Before a removal: what it moves, and where that assignment is changed. */
    removeBlurb: (runtime: string) => string;
    removeMoves: (names: string, globalRuntime: string) => string;
    removeNothing: string;
    /** The one removal that is refused. */
    removeGlobal: (runtime: string) => string;
    confirmRemove: string;
    /** Said where a key box is drawn on a runtime: the key is the board's, not this
     *  computer's, so two runtimes on one harness share it. */
    keyIsBoards: string;
    /** The board's server, read-only under this computer. */
    server: { label: string; notBound: string };
    addFailed: string;
    removeFailed: (runtime: string) => string;
    renameFailed: (runtime: string) => string;
    globalFailed: (runtime: string) => string;
    unbindFailed: (runtime: string) => string;
  };
  /** The harness picker, drawn on a runtime and — on a board that names none — as the
   *  Runtimes pane itself. Its heading is `runtimes` above. */
  harness: {
    /** A harness whose CLI this machine doesn't have. */
    notInstalled: string;
    notHere: (binary: string) => string;
    missingHint: (binary: string) => string;
    /** What the picked harness can't do that another on the grid can. */
    gaps: (harness: string) => string;
    override: (command: string) => string;
    saveFailed: string;
    saveSettingFailed: (setting: string) => string;
    saveSecretFailed: (setting: string) => string;
    /** The config asks for a harness this build doesn't ship, or still carries the
     *  old top-level key. */
    unknown: (asked: string, running: string) => string;
    staleCommand: string;
    /** A provider picked but not written until the boxes it needs are filled. */
    waitingFor: (boxes: string) => string;
    /** A value hand-written into the config that isn't one of the choices. */
    fromConfig: (value: string) => string;
    secret: { set: string; save: string; replace: string; clear: string; cancel: string };
    test: {
      run: string;
      running: string;
      blurb: (harness: string) => string;
      unsavedPick: string;
      trying: string;
      passed: (seconds: string) => string;
      seconds: (s: string) => string;
      failedMissing: (command: string) => string;
      failedTimeout: (seconds: string) => string;
      failed: string;
      install: string;
    };
  };
  specAgents: {
    title: string;
    blurb: string;
    loading: string;
    tooOld: string;
    enabled: string;
    paused: string;
    /** Only read out loud: the switch on one agent's row. */
    switchOn: (agent: string) => string;
    switchOff: (agent: string) => string;
    contributes: string;
    runsWhen: string;
    change: string;
    /** One setting's line, before it is opened. */
    setting: (label: string, value: string) => string;
    settingWithCost: (label: string, value: string, cost: string) => string;
    flipFailedOn: (agent: string) => string;
    flipFailedOff: (agent: string) => string;
    saveFailed: (agent: string) => string;
  };
  delivery: {
    title: string;
    blurb: string;
    on: string;
    off: string;
    loading: string;
    /** A change only reaches deliveries started afterwards. */
    frozen: string;
    commits: { title: string; body: string; failedOn: string; failedOff: string };
    approval: { title: string; body: string; failedOn: string; failedOff: string };
    /** Only read out loud: one setting's switch. */
    switchOn: (setting: string) => string;
    switchOff: (setting: string) => string;
  };
  flowRules: {
    title: string;
    blurb: string;
    loading: string;
    tooOld: string;
    flows: string;
    set: (inUse: number, total: number) => string;
    saved: string;
    rule: (flow: string) => string;
    placeholder: (flow: string) => string;
    saveFailed: (flow: string) => string;
  };
  skill: {
    title: string;
    blurb: string;
    checking: string;
    checkAgain: string;
    writing: string;
    writeAgain: string;
    /** The two rows under the headline. */
    skillRow: string;
    commandRow: string;
    headline: { unchecked: string; unfinished: string; update: string; ready: string };
    detail: {
      unchecked: string;
      none: string;
      some: (agents: string) => string;
      outdated: string;
      commandBehind: string;
      ready: (agents: string) => string;
    };
    status: {
      unchecked: string;
      notInstalled: string;
      partial: string;
      updateAvailable: string;
      ready: (version: string) => string;
    };
    commandStatus: {
      checking: string;
      unchecked: string;
      notFound: string;
      behind: (version: string) => string;
      ready: (version: string) => string;
    };
    button: { add: string; addRest: string; update: string };
    addFailed: string;
    details: string;
    writtenBy: (version: string) => string;
    folder: {
      absent: (agent: string) => string;
      linked: string;
      unknown: (agent: string) => string;
      stale: (version: string | null, carries: string, agent: string) => string;
      ready: (version: string | null, agent: string) => string;
    };
    receipt: {
      ok: string;
      nothing: string;
      wrote: (path: string, files: string) => string;
      refreshed: (path: string, files: string) => string;
    };
    reviewDiff: string;
    behind: {
      onPath: (found: string, running: string) => string;
      none: string;
      useButton: string;
      title: string;
      runThis: string;
      copy: string;
    };
  };
  language: {
    title: string;
    blurb: string;
    /** Only read out loud: the group of language choices. */
    group: string;
    note: string;
    saveFailed: string;
  };
  cloud: {
    title: string;
    blurb: string;
    checking: string;
    /** Beside a control whose new value is already drawn but not yet written. */
    saving: string;
    unreachable: (why: string) => string;
    signedIn: string;
    signOut: string;
    notAdmitted: string;
    signedInAs: (handle: string) => string;
    /** How a request is answered, beside the button that makes one. */
    howWeAnswer: string;
    /** The request already went in. Takes the day it went in, or `askedUndated`. */
    asked: (when: string) => string;
    askedUndated: string;
    requestInvite: string;
    asking: string;
    expired: string;
    expiredBody: string;
    inviteOnly: string;
    inviteOnlyBody: string;
    boundary: string;
    terms: string;
    privacyLink: string;
    termsAnd: string;
    termsLink: string;
    termsEnd: string;
    signIn: string;
    signInAgain: string;
    needsApp: string;
    waiting: string;
    finishFailed: string;
    signOutFailed: string;
    /** The machine's one silencing switch (#319). It sits with the sign-in because
     *  what it stops arrives from every board Cloud is on for. */
    silence: {
      title: string;
      blurb: string;
    };
    /** The account's one Slack destination (#320) — where a task waiting on a decision
     *  arrives, and where that decision is made. It sits with the sign-in because every
     *  board Cloud is on for posts to it. */
    slack: {
      title: string;
      /** What Slack is for, before there is a connection to describe. */
      blurb: string;
      checking: string;
      connect: string;
      connecting: string;
      /** The consent screen is out in the browser. */
      waiting: string;
      disconnect: string;
      disconnecting: string;
      /** Reads "in workspace <name>" after the picker — the words each side of the name,
       *  which is drawn in strong ink between them. */
      inWorkspace: { before: string; after: string };
      /** The destination picker. */
      postsTo: string;
      pickChannel: string;
      loadingChannels: string;
      /** The app is in no channel and the direct message could not be opened. */
      noChannels: string;
      /** Slack refused us — the app was removed, the token revoked, the destination gone. */
      refused: string;
      /** Connecting needs the app: the consent screen comes back to it. */
      needsApp: string;
      /** This Cloud service carries no Slack app. */
      unavailable: string;
      connectFailed: string;
      saveFailed: string;
      disconnectFailed: string;
    };
    /** The account's one Lark destination (#351), beside Slack. 飞书 and Lark international
     *  are two platforms, so connecting names a cloud. */
    lark: {
      title: string;
      /** An administrator installs the app in the organisation first — that happens in Lark,
       *  not here, and an authorization cannot finish without it. */
      install: string;
      checking: string;
      /** Takes the cloud's own name: `飞书` or `Lark`. */
      connect: (cloud: string) => string;
      connecting: string;
      /** The consent screen is out in the browser. */
      waiting: string;
      disconnect: string;
      disconnecting: string;
      /** The destination picker. */
      postsTo: string;
      pickChat: string;
      loadingChats: string;
      /** The bot is in no group and the direct message could not be reached. */
      noChats: string;
      /** Who connected it, under the cloud's name. */
      connectedBy: (person: string) => string;
      /** Lark refused us — the tenant uninstalled the app, or the destination is gone. */
      refused: (cloud: string) => string;
      /** Connecting needs the app: the consent screen comes back to it. */
      needsApp: string;
      /** This Cloud service carries no app for either cloud. */
      unavailable: string;
      /** No way in yet — the app is not published. */
      comingSoon: string;
      connectFailed: string;
      saveFailed: string;
      disconnectFailed: string;
    };
    /** Which machine runs this board's approvals (#318). A board attaches exactly one. */
    server: {
      title: string;
      blurb: string;
      /** Another machine holds this board. Takes its name. */
      heldBy: (machine: string) => string;
      moveHere: string;
      moving: string;
      /** Only read out loud: the switch. */
      switchOn: string;
      switchOff: string;
      /** Above what that machine runs the board's runtimes as (#345). */
      runsAs: string;
      /** Beside a runtime that machine bound nothing for, so it falls back. */
      notBound: string;
    };
    /** This board's own settings — the one open release it watches, and the machine
     *  that runs its work. On as soon as this machine is signed in. */
    notifications: {
      /** The caption over the board's rows. */
      title: string;
      watching: string;
      /** The picker's widest entry — every card, whatever release. */
      allReleases: string;
      /** The picker's own entry while the watched release has closed. */
      pickRelease: string;
      /** Beside the picker: what each width means, and what a closed release
       *  leaves. */
      anyRelease: string;
      onlyThisRelease: string;
      releaseClosed: string;
      saveFailed: string;
    };
  };
};
