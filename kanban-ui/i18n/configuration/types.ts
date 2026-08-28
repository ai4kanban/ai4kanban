/** The Configuration dialog: its sidebar and every pane in it. The settings a
 *  harness declares — their labels, help and choices — are the board's own rules
 *  and never enter this file. */
export type ConfigurationCopy = {
  open: string;
  title: string;
  sections: string;
  section: {
    harness: string;
    agents: string;
    delivery: string;
    rules: string;
    skill: string;
    language: string;
    cloud: string;
  };
  harness: {
    title: string;
    description: string;
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
    approval: {
      title: string;
      body: string;
      /** Nothing to hold while automatic commits are off. */
      moot: string;
      failedOn: string;
      failedOff: string;
    };
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
    unreachable: (why: string) => string;
    signedIn: string;
    signOut: string;
    slackHandle: string;
    admitted: string;
    renews: string;
    /** Where the sign-in is kept. Takes the file it is kept in. */
    kept: (file: string) => string;
    signOutNote: string;
    notAdmitted: string;
    signedInAs: (handle: string) => string;
    haveCode: string;
    codeLabel: string;
    codeExample: string;
    redeem: string;
    redeeming: string;
    oneCode: string;
    noCode: string;
    noCodeBody: string;
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
    /** This board's own notifications, and the one open release they watch. */
    notifications: {
      title: string;
      blurb: string;
      /** No open release to watch, so the switch says so rather than filling
       *  nothing. */
      noReleases: string;
      watching: string;
      /** The picker's own entry while the watched release has closed. */
      pickRelease: string;
      /** Beside the picker: what a watched release means, and what a closed one
       *  leaves. */
      onlyThisRelease: string;
      releaseClosed: string;
      saveFailed: string;
    };
  };
};
