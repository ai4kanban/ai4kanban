/** The guided first run, the two notices the board keeps once it is over, and the
 *  two screens a board that can't be read falls back to. */
export type SetupCopy = {
  rail: {
    title: string;
    blurb: string;
    steps: string;
    exit: string;
    /** What each step has settled, under its name in the rail. */
    projectSettled: (name: string) => string;
    goalWritten: string;
    goalSkipped: string;
  };
  /** The rail's short name for each step. The checklist's own names are the
   *  script's and stay as they are. */
  stepTitles: { project: string; goal: string; agent: string };
  reading: string;
  /** The first run as a conversation (#280): one full window per step, one thing asked in
   *  each. The screens below it are what "I'll fill it in myself" reaches. */
  firstRun: {
    title: string;
    step: (at: number, total: number) => string;
    byHand: string;
    toBoard: string;
    /** The empty box's hint, wherever the answer has to be the user's own. */
    yourWords: string;
    agent: {
      ask: string;
      blurb: string;
      test: string;
      /** What Test and continue is about to spend, naming the agent picked. */
      testNote: (agent: string) => string;
      answered: string;
      /** The agent the probe is trying right now (#404) — the whole of the probing view's
       *  text, so it says which agent without a heading over it. */
      trying: (agent: string) => string;
      /** The agent that answered, named on the way to the project step. */
      found: (agent: string) => string;
      /** The probing view's one control: end it and take the picker instead. */
      bySelf: string;
    };
    reading: { ask: string; blurb: string };
    project: {
      right: string;
      hint: string;
      yes: string;
      send: string;
    };
    goal: {
      ask: string;
      blurb: string;
      guide: string;
      save: string;
      later: string;
    };
    failed: {
      /** The agent ended its turn with nothing this could be read from. */
      noAnswer: string;
      nothingWritten: string;
      /** A failed turn is usually a login, so the way back is the picker it came from. */
      backToAgent: string;
      retry: string;
    };
  };
  project: {
    title: string;
    blurb: string;
    name: string;
    what: string;
    whatPlaceholder: string;
    saveFailed: string;
    continue: string;
  };
  goal: {
    title: string;
    blurb: string;
    placeholder: string;
    guideTitle: string;
    guideLine: string;
    skip: string;
    saveFailed: string;
  };
  agent: {
    title: string;
    blurb: string;
    answered: string;
    testFirst: string;
    saveFailed: string;
  };
  done: {
    title: string;
    blurb: string;
    /** The goal was left for later and every step left is planned from it. */
    goalFirst: string;
    writeGoal: string;
    /** Start the setup run: the board's own strip offers it, and the closing screen
     *  offers it again after one failed. */
    finish: string;
    starting: string;
    open: string;
    startFailed: string;
  };
  /** The setup run, wherever it is reported. */
  run: {
    watching: string;
    watch: string;
    failed: string;
    readLog: string;
    failedAfter: string;
  };
  notice: {
    title: string;
    working: string;
    next: string;
    lastStep: string;
    resume: string;
    addSkill: string;
    addSkillHint: string;
    meter: (done: number, total: number) => string;
  };
  goalNotice: {
    tag: string;
    body: string;
    write: string;
    dismiss: string;
    dismissHint: string;
  };
  handover: {
    open: string;
    close: string;
    title: string;
    blurb: string;
  };
  /** The skill a paste into a coding agent needs first. */
  addSkillFirst: string;
  copy: { hint: string };
  /** The whole-page screens: no board here, and a board with nothing to read it with. */
  noBoard: {
    title: string;
    where: (folder: string) => string;
    startTitle: string;
    startApp: string;
    startBrowser: string;
    wrongTitle: string;
    wrongApp: string;
    wrongBrowser: string;
    comeBack: string;
    copy: string;
  };
  noRules: {
    title: string;
    installTitle: string;
    installApp: string;
    installBrowser: string;
    comeBack: string;
  };
};
