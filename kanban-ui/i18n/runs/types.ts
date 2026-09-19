import type { AgentAction, ReviewTrigger, SessionView } from "@/lib/types";

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
  /** Why a review after the first one started (#417), beside that step's own label. Keyed
   *  by the trigger the run records; a trigger with no word here shows nothing. */
  trigger: Partial<Record<ReviewTrigger, string>>;
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
    failed: string;
    /** The failed state's tooltip: the code the agent exited with. */
    exitCode: (code: string) => string;
    /** A setup run that exited cleanly with no checklist box ticked (#909). */
    nothingDone: string;
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
    /** In place of `stoppedShort` on a setup run that ticked nothing. */
    tickedNothing: string;
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
  /** A run waiting out a provider that failed for a moment (#525). */
  retry: {
    /** The countdown to the next attempt, and which attempt it is. */
    waiting: (seconds: number, attempt: number, of: number) => string;
    /** The same the moment the wait is up. */
    starting: (attempt: number, of: number) => string;
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
    /** …and while jobs that stopped short are waiting on somebody (#809), which is what the
     *  button says first: live work looks after itself and a thing to fix does not. */
    openUnhandled: (n: number) => string;
    heading: string;
    empty: string;
    pick: string;
    note: string;
    /** The timeline's mark on a session that Resume started. */
    resumedSession: string;
    cancelled: string;
    /** The cap over a card-less delivery's pause (#428) — it has no card page to be read
     *  on, so its own label rides here. */
    stopped: (label: string) => string;
    /** The work a build with no card left behind, kept because the job can still be carried
     *  on (#720): what is here, and the two things to do with it. */
    kept: {
      tag: string;
      blurb: string;
      carryOn: string;
      carryingOn: string;
      discard: string;
      discarding: string;
      carryOnFailed: string;
      discardFailed: string;
    };
    /** How many sessions one job took, under its row. */
    steps: (n: number) => string;
    justNow: string;
    minutesAgo: (m: number) => string;
    hoursAgo: (h: number) => string;
    daysAgo: (d: number) => string;
  };
  /** The office the Runs dialog opens on (#399): the room, the bots in it, and the
   *  controls that float over them. */
  scene: {
    /** What the room is, for a reader who cannot see it. */
    office: string;
    /** One bot, said in full: who is working, on what tool, at which task, and how it is
     *  going. */
    bot: (role: string, harness: string, task: string, state: string) => string;
    /** How a job is going, keyed by the state the board records. */
    state: Record<SessionView["status"], string>;
    /** A connector this build ships no mark for, and a job run by no named agent. */
    noHarness: string;
    noRole: string;
    /** How many jobs are working, across every room. */
    running: (n: number) => string;
    idle: string;
    /** The three ways into the records, and the word that puts a drawer away. The running
     *  drawer is titled here; its entrance says the count instead. */
    runningTitle: string;
    completed: string;
    unfinished: string;
    /** The same entrance while some of what is behind it is still waiting on somebody
     *  (#809): the word, and how many. */
    unfinishedCount: (n: number) => string;
    collapse: string;
    /** Which room of how many is on screen. */
    page: (n: number, of: number) => string;
    prevRoom: string;
    nextRoom: string;
    /** Said once, quietly, when the room could not be drawn on this machine. */
    unavailable: string;
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
      /** The same five sentences with **AI review** off (#416): no review step, and the
       *  commit is matched against what the build left rather than what review passed. */
      autoBranchNoReview: (branch: string) => string;
      autoHereNoReview: string;
      manualFolderNoReview: string;
      manualNoReview: string;
      manualWhyNoReview: (why: string) => string;
      /** A card whose workflow makes files (#874): no branch, no commit, and nothing to pick. */
      files: string;
      filesNoReview: string;
      /** What the press does on a surface that starts no run of its own (#364): the browser
       *  records it, and one of the workspace's machines builds it when one is running. It
       *  replaces the five sentences above, which describe a checkout a reader has none of. */
      recorded: string;
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
      /** What an empty box does versus a filled one (#729) — the reason picks the move. */
      hint: string;
      confirm: string;
      /** The word the button reads while no reason is typed: the card is only dropped, and
       *  nothing is written to memory (#601). */
      confirmDiscard: string;
    };
    archive: {
      title: (id: number) => string;
      blurb: string;
      placeholder: string;
      confirm: string;
    };
  };
};
