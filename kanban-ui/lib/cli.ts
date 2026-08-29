import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getCopy } from "@/i18n";
import { repoRoot } from "./paths";
import { DEFAULT_LANGUAGE } from "./types";
import type {
  AgentInfo,
  AgentRequest,
  CommandRequest,
  ChatReply,
  ChatView,
  ConnectionTest,
  DeliveryRecord,
  FlowRuleView,
  HarnessSetting,
  RunRecord,
  RunView,
  SpecAgentView,
} from "./format/agent/types";
import type { CloudEventAnswer } from "./format/cloud/events";
import type {
  CloudAccount,
  CloudMove,
  SlackConversation,
  SlackState,
} from "./format/cloud/types";
import type { BoardNotifications, NotificationCenter } from "./notifications";
import type { Language } from "./format/machine/types";
import type { CommandState, SkillInstall, SkillState } from "./format/skill/types";
import type {
  Board,
  BulkReleaseResult,
  Card,
  CardPatch,
  ClosePlan,
  DeliveryDiff,
  DeliveryPlan,
  DropPlan,
  FillPlan,
  MemoryFile,
  MetricsResult,
  SaveProjectResult,
  ScoreResult,
  SetupDraft,
  SetupState,
  TrackDraft,
  VerifyResult,
  WriteResult,
} from "./format/view/types";

// --- the board's rules, loaded once (#168, #169) -----------------------------
// Everything the board is — how a card is written, what a release does when it closes, how
// the setup checklist reads, which cards a refine would move, which agent runs and what it
// is sent — lives in the CLI, as one built file. This loads that file and hands the UI its
// exports. The UI keeps no copy of any of it.
//
// Loading it rather than shelling out to it is the same one copy of the rules either way:
// it IS `akb`'s own module, and a card written here is a card written there. What it buys
// is that the board's poll doesn't spawn a process every second and a half.
//
// Where the file is:
//   • `AI4KANBAN_CLI` names it outright — the desktop app passes the copy it carries, so
//     an app on a machine with nothing installed still runs the board.
//   • otherwise the installed `akb`, asked where its own copy is. A project stopped
//     carrying one of its own (#213): the note in a skill folder is the whole skill, and
//     the command it names comes from npm.
//   • otherwise the skill folder in this repo, either harness's — where a board installed
//     before that release still has one.
//
// Nothing to read the board with at all, and every screen says so in one line that names
// the fix rather than coming up empty.

/** What the built file gives us. It is the CLI's own public surface — see the exports at
 *  the top of `cli/src/kanban.ts`.
 *
 *  Everything that reads or writes the board is promise-returning: a board can live
 *  somewhere other than this machine, and the CLI's operation contract (#312) is
 *  asynchronous all the way through so a Cloud board is one more provider rather than a
 *  second write path. A copy of the rules older than that contract answers with the plain
 *  value, which `await` takes just as happily — so awaiting is safe on every board. */
export interface BoardRules {
  setBoardRoot(root: string): string;

  // the runs
  listRuns(): Promise<RunView[]>;
  getRun(id: string, bytes?: number): Promise<RunView | null>;
  openRun(req: AgentRequest, prompt: string): { run: RunRecord } | { error: string };
  openResume(id: string): Promise<{ run: RunRecord } | { error: string }>;
  markSpawned(sessionId: string, pid: number | undefined): void;
  spawnWatcher(sessionId: string): number | undefined;
  stopRun(id: string): Promise<{ ok: boolean; sessionId?: string; error?: string }>;
  titleOf(cardId: number | undefined): string | undefined;
  buildPrompt(req: AgentRequest): string;
  refinementRequest?(req: CommandRequest): AgentRequest | { error: string };

  // the deliveries (#301) — the whole job one Implement click starts, several runs
  // long. Optional: a project can be running rules older than the release that added them,
  // and then a run simply carries no delivery and no card is ever held.
  listDeliveries?(): DeliveryRecord[];
  activeDelivery?(cardId: number): DeliveryRecord | undefined;
  cancelDelivery?(id: string): Promise<{ ok: boolean; deliveryId?: string; error?: string }>;
  /** A delivery's worktree and branch, thrown away on request (#303). Cancelling one leaves
   *  its checkout where it is; this is the only thing that removes one. */
  discardDelivery?(id: string): Promise<{ ok: boolean; deliveryId?: string; error?: string }>;
  discardCost?(id: string): { deliveryId: string; worktree?: string; branch?: string } | null;
  /** Sign off the tree a delivery would land (#308), on a board that requires it. `from`
   *  names where the approval came from and rides into the permanent record. */
  approveDelivery?(
    id: string,
    from?: string,
  ): Promise<{ ok: true; deliveryId: string; covers: string } | { ok: false; error: string }>;
  /** Deliveries whose worktree or branch has gone missing — reported at startup, never
   *  started over. */
  repairDeliveries?(): string[];

  // the flow rules (#306) — one rule per flow, in the user's own words, appended to that
  // flow's built-in prompt. Optional: a project can be running rules older than the release
  // that added them, and the Rules pane says so rather than the dialog failing to draw.
  readFlowRules?(): FlowRuleView[];
  setFlowRule?(command: string, text: string): WriteResult;

  // may the board commit? (#303) The one repository-level setting behind worktrees,
  // parallel deliveries and landing reviewed code.
  autoCommitAllowed?(): boolean;
  setAutoCommit?(on: boolean): WriteResult;

  // must the tree be approved before it lands? (#308) The other repository-level setting in
  // the same file, off by default — so rules older than it read as off, which is what they
  // did.
  diffApprovalRequired?(): boolean;
  setDiffApproval?(on: boolean): WriteResult;

  // the conversation with that agent (#242) — the board's, and each card's. Optional for
  // the same reason as the moves below: a project can be running rules older than the
  // release that added them, and the chat says so rather than the window failing to draw.
  readChatView?(cardId: number | null): ChatView;
  sendChatMessage?(
    cardId: number | null,
    message: string,
    options?: { onText?(chunk: string): void; title?: string },
  ): Promise<ChatReply | { error: string }>;
  clearChat?(cardId: number | null): boolean;

  // the agent, and what it is set to
  agentInfo(): AgentInfo;
  /** `ask` names the harness the settings are read against (#343): the board's own by
   *  default, or the one a runtime is bound to on this computer. A copy of the rules from
   *  before runtimes ignores it and answers for the board's, which is what it always did. */
  activeSettings(ask?: { runtime?: string; board?: boolean }): HarnessSetting[];
  settingSaveError(
    key: string,
    value: string,
    ask?: { runtime?: string; board?: boolean },
  ): string | null;
  setupInstruction(): string;
  setHarness(name: string): WriteResult;
  setHarnessSetting(key: string, value: string): WriteResult;
  setSecret(name: string, value: string): WriteResult;
  /** Named a runtime, the test spawns what THAT runtime resolves to here (#343). */
  testConnection(runtime?: string): Promise<ConnectionTest>;

  // the runtimes (#343, #344) — the board names them, this computer says what each one
  // runs as. Optional: a project can be running rules older than the release that added
  // them, and Configuration → Runtimes then draws the board's own harness alone.
  addRuntime?(name: string): WriteResult;
  removeRuntime?(name: string): WriteResult;
  renameRuntime?(from: string, to: string): WriteResult;
  setGlobalRuntime?(name: string): WriteResult;
  bindRuntime?(runtime: string, harness: string): WriteResult;
  setBindingSetting?(runtime: string, key: string, value: string): WriteResult;
  unbindRuntime?(runtime: string): WriteResult;

  // the board, read
  readBoard(): Promise<Board>;
  /** A short string that changes when anything the board draws does (#243). The window asks
   *  it a few times a second while a chat is writing, and re-reads the board only when it
   *  moves. Optional: on older rules the window falls back to re-reading when a run ends. */
  boardStamp?(): Promise<string>;
  findCard(id: number): Promise<Card | null>;
  allCards(): Promise<Card[]>;
  /** What an Implement click would do on this board right now (#307): the branch the change
   *  would land on, and whether it lands at all. Optional: a board can be running rules from
   *  before the one-click flow, and the dialog then says only what it always said. */
  deliveryPlan?(): Promise<DeliveryPlan>;
  /** What one delivery changed (#305), for the card page's **Diff** tab: its branch against
   *  its base while it builds, and the commit it landed once it has. Optional: an older
   *  board's rules have no diff to give, and the tab simply doesn't appear. */
  deliveryDiff?(deliveryId: string): Promise<DeliveryDiff | null>;
  readModules(): Promise<string[]>;
  readMetricsView(): Promise<MetricsResult>;
  /** The planning scores, release by release (#224). Optional: a board can be running rules
   *  from before the score existed, and the chart says so in one line rather than drawing an
   *  empty panel that would read as a board that has planned nothing. */
  readScoreView?(): Promise<ScoreResult>;
  readReleases(): Promise<string[]>;
  readGoalText(): Promise<string>;
  /** One of the four memory files, whole — the project's copy, or a module's when `module`
   *  names one the map knows (#129, #130). Optional: a board can be running rules older than
   *  the release that added it, and the memory page then says so rather than the whole app
   *  failing to draw. */
  readMemoryFile?(name: string, module?: string): Promise<MemoryFile | null>;
  readSetupDraft(): Promise<SetupDraft>;
  readSetupState(): Promise<SetupState | null>;
  fillPlan(): Promise<FillPlan>;
  closePlan(id: string): Promise<ClosePlan>;
  dropPlan(id: string): Promise<DropPlan>;

  // the board, written
  patchCard(id: number, patch: CardPatch): Promise<WriteResult>;
  // One hand-check added or crossed off from the card page (#276). Optional: a project can
  // be running rules older than the release that added them, and the panel then reads the
  // way it always did rather than the page failing to draw.
  addVerify?(id: number, line: string): Promise<VerifyResult>;
  dropVerify?(id: number, line: string): Promise<VerifyResult>;
  setSchedule(id: number, action: string, notes?: string): Promise<WriteResult>;
  clearSchedule(id: number): Promise<WriteResult>;
  setCardsRelease(ids: number[], release: string): Promise<BulkReleaseResult>;
  newRelease(id: string, goal?: string, fill?: boolean): Promise<WriteResult & { fill?: "none" | "fill" | "agent" }>;
  setReleaseGoal(id: string, goal: string): Promise<WriteResult>;
  // `shipped` is how many cards the close counted, so the caller knows whether a changelog
  // run has anything to write (#232). Absent on a copy of the rules that predates it.
  closeRelease(id: string): Promise<WriteResult & { shipped?: number }>;
  dropRelease(id: string): Promise<WriteResult>;
  saveGoal(text: string): Promise<WriteResult>;
  saveProject(name: string, description: string, tracks: TrackDraft[]): Promise<SaveProjectResult>;
  finishSetupStep(name: string): Promise<WriteResult>;

  // the language the app and the agent work in (#334) — one answer for this MACHINE, held
  // outside every repository. Optional: a project can be running rules older than the
  // release that added them, and every screen then draws in English, which is what it did.
  readLanguage?(): Language;
  setLanguage?(value: Language): WriteResult;

  // the spec agents, and which of them may run (#191). Optional for the same reason as the
  // skill moves below: a project can be running rules older than the release that added
  // them, and the Agents section says so rather than the dialog failing to draw.
  readSpecAgents?(): SpecAgentView[];
  setSpecAgentEnabled?(name: string, on: boolean): WriteResult;
  /** Save one of the settings an agent declares (#257). Optional on its own: a board can
   *  be running rules that list the agents but predate their settings, and the row then
   *  draws no control rather than offering one nothing can save. */
  setSpecAgentSetting?(name: string, key: string, value: string): WriteResult;

  // the coding agent skill — whether this project has one, and the move that adds it
  // (#174). Optional because a project can be running rules older than the release that
  // added them, and the panel says so rather than the whole dialog failing to draw.
  readSkillState?(root?: string): SkillState;
  installSkill?(root?: string, only?: "present"): SkillInstall;
  readCommandState?(): CommandState;

  // the Cloud sign-in (#326) — which account this MACHINE acts as, held outside every
  // repository so a terminal `akb` is the same account. Optional for the same reason as
  // the moves above: a project can be running rules older than the release that added
  // Cloud, and the section says so rather than the dialog failing to draw.
  readCloudAccount?(): Promise<CloudAccount>;
  startCloudSignIn?(): { ok: true; url: string } | { ok: false; error: string };
  finishCloudSignIn?(callback: string): Promise<{ ok: boolean; error?: string }>;
  signOutOfCloud?(): { ok: true };

  // the two doors out of the not-admitted state (#327) — ask us for an invite, and spend the
  // code we answer with. Optional on their own: a project can be running rules that sign in
  // to Cloud but predate the invitation loop, and the pane offers neither rather than a
  // button nothing can answer.
  requestCloudInvite?(): Promise<CloudMove>;
  redeemCloudInvitation?(code: string): Promise<CloudMove>;

  // the Cloud notification center (#319) — the events this machine's boards raise, and the
  // bell that carries them. A board turns itself on inside the rules as soon as this machine
  // is signed in, so nothing here turns one on. Optional like every Cloud move above: a
  // project running rules that sign in but predate the center draws no bell rather than a
  // count nothing can fill.
  //
  // `startCloudCenter` is idempotent and takes whether this board server is the one the
  // window is showing: one connection however many boards are enabled.
  startCloudCenter?(focused: boolean): void;
  readCloudCenter?(): NotificationCenter;
  openNotification?(eventId: string): { boardPath: string | null; taskId: number } | null;
  setNotificationsSilenced?(on: boolean): WriteResult;
  readBoardNotifications?(): Promise<BoardNotifications>;
  watchRelease?(release: string): Promise<WriteResult>;
  /** The one durable action a live event carries, recorded from a click on this machine.
   *  Never waits on the network: the board's own outbox retries it. */
  recordCloudActionFor?(
    taskId: number,
    decision: "implement" | "answer",
    revision: string,
    answers: CloudEventAnswer[],
  ): void;

  // this board's server (#318) — the machine that runs an approval taken anywhere else.
  //
  // `startCloudServer` is the opposite of `startCloudCenter` above: every enabled board's
  // server calls it, backgrounded ones included, because a request is addressed to one
  // board's server and the board a user has switched away from is exactly the one whose
  // approval would otherwise never run. Idempotent, and called from the dispatcher's tick.
  startCloudServer?(): void;
  setBoardServer?(on: boolean, takeOver?: boolean): Promise<WriteResult>;
  /** The two moves an interrupted request offers on the card page: take it up again on this
   *  machine, or end it. */
  resumeCloudRequest?(eventId: string): Promise<WriteResult>;
  cancelCloudRequest?(taskId: number, eventId: string): WriteResult;

  // the account's one Slack destination (#320) — where a task waiting on a decision arrives,
  // and where that decision is made. A fact about the ACCOUNT like the sign-in: every board
  // Cloud is on for posts to it, with the board named on each message. Optional like every
  // Cloud move above, so a project running older rules offers no Slack rather than a button
  // nothing can answer.
  readSlackState?(): Promise<SlackState>;
  startSlackConnect?(): Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  readSlackConversations?(): Promise<
    { ok: true; conversations: SlackConversation[] } | { ok: false; error: string }
  >;
  setSlackChannel?(channelId: string, channelName: string): Promise<CloudMove>;
  disconnectSlack?(): Promise<CloudMove>;

  /** Where the card link in a Slack message leads — the board's own path on this machine,
   *  and the card to open in it. Null when the URL names no card. */
  readCloudCardLink?(
    url: string,
  ): { ok: true; boardPath: string; taskId: number } | { ok: false; reason: "not-here" } | null;

  // what the board would start on its own, this minute
  nextWork(): Promise<AgentRequest[]>;
}

export type { AgentRequest, CommandRequest, RunRecord, RunView } from "./format/agent/types";

// The language is held by the board's rules and read through them, and this file is what
// loads them — so nothing here can ask. Every sentence it writes is about not having a
// usable copy, which is exactly the case where there is nothing to read a language from.
const ENGLISH = getCopy(DEFAULT_LANGUAGE).messages.rules;

/** The one line every screen shows when there is no usable copy of the board's rules —
 *  none installed, or one too old to read the board. It names the fix, because the fix is
 *  one command. */
export class NoRulesError extends Error {
  /** `fix` is the line that ends it, English by default for the same reason the rest of
   *  this file is: the language is held by the rules, and every sentence here is about not
   *  having them. A caller that does hold them passes its own translation. */
  constructor(what: string, fix: string = ENGLISH.installIt) {
    // The rules are the installed command's own copy (#213), so the fix is putting the
    // command on the PATH — not `skill install`, which writes the agent's note and carries
    // no rules with it, and not `update`, which refreshes a board that is already here.
    super(`${what} ${fix}`);
    this.name = "NoRulesError";
  }
}

// One load per server process, pinned to globalThis: Next may evaluate this module more
// than once across its server bundles, and two loads would be two module states — two
// board roots, and two of everything the rules keep.
function cached(): { rules?: Promise<BoardRules> } {
  const g = globalThis as unknown as { __kanbanRules?: { rules?: Promise<BoardRules> } };
  if (!g.__kanbanRules) g.__kanbanRules = {};
  return g.__kanbanRules;
}

function candidates(): string[] {
  const named = process.env.AI4KANBAN_CLI;
  if (named) return [named];
  const found: string[] = [];
  const asked = installedCommand();
  if (asked) found.push(asked);
  try {
    const root = repoRoot();
    found.push(
      path.join(root, ".claude", "skills", "kanban", "kanban.mjs"),
      path.join(root, ".agents", "skills", "kanban", "kanban.mjs"),
    );
  } catch {
    // No board here — the two paths below it are a board's, so there is nothing to add.
  }
  return found;
}

/** The `akb` on the PATH, asked where its own copy of the rules is (`akb __rules`).
 *
 *  One process, on the first read of the server's life — `boardRules()` caches what this
 *  finds, and the board polls every second and a half, so this may never be per request.
 *  Best effort: no `akb`, or one too old to answer, comes back null and the caller falls
 *  through to the folders a board installed by an older release still has. */
function installedCommand(): string | null {
  const result = spawnSync("akb", ["__rules"], {
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["ignore", "pipe", "ignore"],
    // On Windows npm installs `akb` as a `.cmd` shim, which only a shell will run.
    shell: process.platform === "win32",
  });
  if (result.status !== 0 || !result.stdout) return null;
  const named = result.stdout.trim().split("\n").pop()?.trim() ?? "";
  return named && fs.existsSync(named) ? named : null;
}

// The newest thing the UI asks of the rules. A copy that predates it is a copy that cannot
// draw the board at all, so it is turned away by name here rather than failing later as an
// undefined function somewhere in a render.
const REQUIRED = ["listRuns", "readBoard", "nextWork"] as const;

/** The board's rules, loaded and pointed at this server's board. */
export function boardRules(): Promise<BoardRules> {
  const box = cached();
  if (box.rules) return box.rules;
  const looked = candidates();
  const found = looked.find((file) => fs.existsSync(file));
  if (!found) {
    return Promise.reject(
      new NoRulesError(
        looked.length
          ? ENGLISH.noneLookedIn(looked.join(", "))
          : ENGLISH.none,
      ),
    );
  }
  box.rules = import(/* webpackIgnore: true */ pathToFileURL(found).href).then(
    (mod: Partial<BoardRules>) => {
      const missing = REQUIRED.filter((name) => typeof mod[name] !== "function");
      if (missing.length > 0) {
        throw new NoRulesError(ENGLISH.tooOld(found));
      }
      // Every command points the rules at one board before it runs; here it is one board
      // for the life of the server, so it is set once.
      mod.setBoardRoot?.(repoRoot());
      return mod as BoardRules;
    },
  );
  // A failed load must not be remembered as the answer: install the rules and the next
  // click should work without restarting the board.
  box.rules.catch(() => {
    box.rules = undefined;
  });
  return box.rules;
}

/** What went wrong, in one line a strip can show. */
export function whyNoRules(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
