import type { AgentAction } from "@/lib/types";

/** Agent runs: the badge a busy card wears, the run log, the runs panel, and the
 *  dialogs that start a run. */
export type RunsCopy = {
  /** What each action is called, as the runs panel lists it. Keyed by the action
   *  the board records, which is not itself copy. */
  action: Record<AgentAction, string>;
  /** The same actions as what a run is doing right now — "implementing". */
  verb: Record<AgentAction, string>;
  /** The same actions as the title over one step of a job — "Implement". */
  step: Record<AgentAction, string>;
  /** The whole job's name, where it differs from the step's: a refine's steps are
   *  `clarify` and `writing`, but the job a person started is "Refine". */
  flow: Partial<Record<AgentAction, string>>;
  badge: {
    running: string;
    watch: string;
    /** The badge's tooltip where it names the action in flight. */
    doing: (label: string) => string;
    idle: string;
  };
  log: {
    title: string;
    expand: string;
    collapse: string;
    events: string;
    noOutput: string;
    /** The live tail before the agent has written anything. */
    waiting: string;
    stopped: string;
    interrupted: string;
    done: string;
    exited: (code: string) => string;
    blocked: string;
    running: string;
    seconds: (s: number) => string;
    minutes: (m: number, s: number) => string;
    hours: (h: number, m: number) => string;
    /** Too cheap to reach a cent, and the ordinary case. */
    costTiny: string;
    cost: (usd: string) => string;
    costHint: string;
    modelHint: string;
    tokens: (input: string, cacheWrite: string, cacheRead: string, output: string) => string;
    tokensHint: string;
    /** A run that ended without finishing, and the half-sentence Resume adds. */
    stoppedShort: string;
    stoppedShortResume: string;
    blocker: {
      heading: string;
      step: string;
      cause: string;
      unblock: string;
    };
  };
  stop: {
    label: string;
    stopping: string;
    /** The button's own tooltip and what a screen reader reads. */
    title: string;
    confirm: string;
    body: string;
    failed: string;
  };
  resume: {
    label: string;
    resuming: string;
    hint: string;
    failed: string;
  };
  panel: {
    open: string;
    /** The tooltip while runs are going. */
    openRunning: (n: number) => string;
    heading: string;
    empty: string;
    pick: string;
    note: string;
    resumed: string;
    cancelled: string;
    /** How many sessions one job took, under its row. */
    steps: (n: number) => string;
    justNow: string;
    minutesAgo: (m: number) => string;
    hoursAgo: (h: number) => string;
    daysAgo: (d: number) => string;
  };
  /** What a run with no card of its own is called — while it runs, and after. */
  cardless: {
    planning: (release: string) => string;
    plan: (release: string) => string;
    writingChangelog: (release: string) => string;
    changelog: (release: string) => string;
    proposing: string;
    propose: string;
    finishingSetup: string;
    finishSetup: string;
    creating: string;
    create: string;
  };
  dialog: {
    cancel: string;
    implement: {
      title: (id: number) => string;
      /** The one-click sentence, in the shapes the tick and the checkout put it in
       *  (#346): onto a named branch, onto whatever branch you are on, in this very
       *  folder because the box is unticked, and — where there was never a box — because
       *  no worktree is possible here (`manualWhy`) or the setting is off (`manual`). */
      autoBranch: (branch: string) => string;
      autoHere: string;
      needsApproval: string;
      thenArchives: string;
      manualFolder: string;
      manual: string;
      manualWhy: (why: string) => string;
      /** The box that picks where THIS build works (#346), and the line under it — which
       *  follows the tick, since what it costs is what the tick changes. */
      ownBranch: string;
      ownBranchOn: string;
      ownBranchOff: string;
      questionsOne: string;
      questionsMany: (n: number) => string;
      ackQuestionsOne: string;
      ackQuestionsMany: (n: number) => string;
      blockedOne: (ids: string) => string;
      blockedMany: (ids: string) => string;
      blockedOneSchedule: (ids: string) => string;
      blockedManySchedule: (ids: string) => string;
      ackBlockedOne: (ids: string) => string;
      ackBlockedMany: (ids: string) => string;
      notReady: string;
      ackNotReady: string;
      notes: string;
      confirm: string;
      confirmAnyway: string;
      resolveFirst: string;
      resolveFirstHint: string;
      schedule: string;
      scheduleHint: string;
    };
    run: {
      title: (id: number) => string;
      blurb: string;
      unattended: string;
      lastRun: (when: string) => string;
      neverRun: string;
      notes: string;
      confirm: string;
    };
    refine: {
      title: (id: number) => string;
      blurb: string;
      blockedOne: (ids: string) => string;
      blockedMany: (ids: string) => string;
      blockedOneSchedule: (ids: string) => string;
      blockedManySchedule: (ids: string) => string;
      confirm: string;
      confirmAnyway: string;
      schedule: string;
      scheduleHint: string;
    };
    reject: {
      title: (id: number) => string;
      blurb: string;
      placeholder: string;
      confirm: string;
    };
    archive: {
      title: (id: number) => string;
      blurb: string;
      placeholder: string;
      confirm: string;
    };
    edit: {
      title: (id: number) => string;
      blurb: string;
      placeholder: string;
      confirm: string;
    };
    create: {
      title: string;
      tabDescribe: string;
      tabPropose: string;
      describeBlurb: string;
      proposeBlurb: string;
      shipsIn: (release: string) => string;
      describePlaceholder: string;
      confirm: string;
      proposeOne: string;
      proposeMany: (n: number) => string;
      module: { label: string; blurb: string; auto: string };
      count: { label: string; blurb: string };
      boldness: {
        label: string;
        blurb: string;
        safe: string;
        safeBlurb: string;
        normal: string;
        normalBlurb: string;
        bold: string;
        boldBlurb: string;
      };
    };
  };
};
