"use server";

// Server Actions — this is a local server, so the client calls these directly instead of
// going through HTTP API routes.
//
// Every one of them is a thin pass to the CLI (lib/board.ts, lib/edit.ts, lib/agent.ts,
// lib/registry.ts), which is where the board's rules live. What is left here is what a
// server action owes its caller: refuse a request whose shape is wrong before it reaches
// the board, and answer with a value rather than a throw, so the browser gets the reason
// instead of a framework crash page.

import {
  activeSettings,
  agentInfo,
  loggedOutAgents,
  type AgentRequest,
  type CommandRequest,
  buildPrompt,
  prepareAgentRequest,
  settingSaveError,
} from "@/lib/agent";
import {
  boardScreen,
  cardStillThere,
  refreshBoard,
  readGoalText,
  readMetrics,
  readModules,
  readReleases,
  readScore,
  readSetupDraft,
  readSetupState,
  searchCards,
} from "@/lib/board";
import { type ChatRead, clearChat, readChat, sendChat, stopChat } from "@/lib/chat";
import { openSetupChat, readSetupChat, saySetupChat, type SetupChatRead } from "@/lib/setup-chat";
import {
  cloudAccount,
  cloudCardLink,
  disconnectLark,
  disconnectSlack,
  finishCloudSignIn,
  larkChats,
  larkState,
  requestCloudInvite,
  setLarkChat,
  setSlackChannel,
  signOutOfCloud,
  slackConversations,
  slackState,
  startCloudSignIn,
  startLarkConnect,
  startSlackConnect,
} from "@/lib/cloud";
import { machineCopy, setMachineLanguage } from "@/lib/language";
import {
  addRuntime,
  setRuntimeHarness,
  removeRuntime,
  renameRuntime,
  setRuntimeSetting,
  setGlobalRuntime,
} from "@/lib/runtimes";
import {
  boardNotifications,
  cancelCloudRequest,
  notificationCenter,
  openNotification,
  readAllNotifications,
  recordCloudAction,
  resumeCloudRequest,
  setBoardServer,
  setSilenced,
  watchRelease,
  type BoardNotifications,
  type NotificationCenter,
} from "@/lib/notifications";
import {
  autoCommitAllowed,
  diffApprovalRequired,
  setAutoCommit,
  setDiffApproval,
  setHarness,
  setHarnessSetting,
  setSilenceMinutes,
  silenceMinutes,
} from "@/lib/config";
import { ensureDispatcher } from "@/lib/dispatcher";
import { flowRules, setFlowRule } from "@/lib/flow-rules";
import {
  addVerify,
  clearSchedule,
  closePlan,
  closeRelease,
  dropPlan,
  dropRelease,
  dropVerify,
  fillPlan,
  finishSetupStep,
  newRelease,
  patchCard,
  saveGoal,
  saveProject,
  setCardsRelease,
  setReleaseGoal,
  setSchedule,
} from "@/lib/edit";
import {
  approveDelivery,
  cancelDelivery,
  discardDelivery,
  getSession,
  listSessions,
  resumeSession,
  startSession,
  type StartResult,
  stopSession,
} from "@/lib/registry";
import { setSecret } from "@/lib/secrets";
import { commandState, installSkill, skillState, UNKNOWN_SKILL } from "@/lib/skill";
import { setSpecAgentEnabled, setSpecAgentSetting, specAgents } from "@/lib/spec-agents";
import { testConnection } from "@/lib/test-connection";
import { isLanguage } from "@/lib/types";
import type {
  AgentInfo,
  BoardScreen,
  BulkReleaseResult,
  CardPatch,
  CardRef,
  CloudAccount,
  CloudEventAnswer,
  CloudMove,
  ClosePlan,
  CommandState,
  ConnectionTest,
  DropPlan,
  FillPlan,
  FlowRuleView,
  HarnessOption,
  Language,
  LarkChat,
  LarkCloud,
  LarkState,
  LoggedOutAgent,
  MetricsResult,
  SaveProjectResult,
  ScoreResult,
  SessionView,
  SetupDraft,
  SkillInstall,
  SkillState,
  SlackConversation,
  SlackState,
  SpecAgentView,
  TrackDraft,
  VerifyResult,
  WriteResult,
} from "@/lib/types";

/** The board screen's one read again (#374), after something wrote the board.
 *
 *  It carries the reason a board could not be read rather than throwing it: a thrown error
 *  from a server action reaches the browser redacted, and "an error occurred" is exactly the
 *  empty answer the strip is here to avoid. */
export async function getBoard(): Promise<BoardScreen> {
  return boardScreen();
}

/**
 * Read the whole workspace again — the user asking for the board in front of them to be
 * brought up to date. A Local board does nothing, so no caller has to know which kind it is
 * on (#316).
 *
 * Deliberately on no timer and behind no read: a live Cloud board settles for its copy, and
 * a screen that re-read on focus or on a poll would be polling the workspace. In a terminal
 * this is free — every `akb` is a new process and opens the board fresh — so what is left is
 * the control the workspace screens add (#317, #374), which is what calls this.
 */
export async function refreshBoardAction(): Promise<WriteResult> {
  return refreshBoard();
}

/** Whether this card is still on the board (#299). The card page asks before it re-reads
 *  itself: a group root is archived by the board the moment its last subtask leaves, so a
 *  page that only refreshed would render the "not on the board" page and its countdown
 *  under a user who did nothing wrong. A board that cannot be read answers `true` — the
 *  page stays where it is and says so itself, rather than being sent away by an error. */
export async function cardOnBoardAction(id: number): Promise<boolean> {
  if (!Number.isInteger(id)) return true;
  try {
    return await cardStillThere(id);
  } catch {
    return true;
  }
}

/** The module names from docs/kanban/modules.md, for the create dialog's picker (#38). */
export async function getModules(): Promise<string[]> {
  return readModules();
}

/** The open cards matching what is typed in the rail's search box (#212). The search runs
 *  here and not in the browser: the card page hands its client nothing but the one card it
 *  is showing, and the board's bodies are the better part of a megabyte on a board of any
 *  age — neither page has the words to search, and neither should have to be given them. */
export async function searchCardsAction(query: string): Promise<CardRef[]> {
  if (typeof query !== "string") return [];
  return searchCards(query);
}

// The actions a client button can start. `refine` is one of them (#99): the card page's
// Refine button starts the very run a finished run starts on its own for each card it
// touched (#211) — same action, same prompt — so a user can refine the card in front of
// them whenever they want, not only after something else has run.
const ACTIONS = new Set([
  "implement",
  // The review run after a build (#302). **Review again** starts one when a delivery has
  // stopped and its question has been answered.
  "review",
  // One pass of a recurring card (#64) — the Run button that stands in for Implement on a
  // card under todo/recurring/.
  "run",
  "reject",
  "archive",
  "edit",
  "create",
  "resolve",
  "propose",
  "refine",
  // Fill a release from its goal (#165) — started from the New release dialog and from a
  // release's ⋯ menu, never from a card.
  "plan-release",
  // Write a closed version's changelog (#232) — started by the close, never from a card.
  // Its own refusals live in changelogAction below.
  "changelog",
  // Finish setting the board up (#173) — from the guided run's closing screen and from the
  // setup strip. Started through startSetupRunAction below, which is where its own refusals
  // live.
  "setup",
]);

// create and propose touch no existing card (create makes one, propose makes several), so
// they carry no `id` — every other action needs one. plan-release is the third: it moves and
// writes many cards, and names a release instead. A setup run is the fourth and names
// nothing at all: the checklist is what it works from. A changelog run is the fifth, and
// names a version too — the one it writes up.
const CARDLESS = new Set(["create", "propose", "plan-release", "changelog", "setup"]);

// Start an agent and return immediately with a sessionId (or a lock message). The request
// never waits for the child — the client polls listSessionsAction() to see the session's
// progress and outcome.
export async function startAgentAction(req: CommandRequest & CloudDecision): Promise<StartResult> {
  // A tab left open across the upgrade that made refine the loop still posts the old name.
  if (req && (req.action as string) === "auto-refine") req = { ...req, action: "refine" };
  if (!req || !ACTIONS.has(req.action)) throw new Error("unknown action");
  if (!CARDLESS.has(req.action) && !Number.isInteger(req.id)) {
    throw new Error("action needs a card id");
  }
  if (req.action === "plan-release" && !req.release?.trim()) {
    throw new Error("planning a release needs a version id");
  }
  if (req.action === "changelog" && !req.release?.trim()) {
    throw new Error("a changelog needs a version id");
  }
  const { cloudRevision, cloudAnswers, ...request } = req;
  const runnable = await prepareAgentRequest(request);
  const started = await startSession(runnable, await buildPrompt(runnable));
  // The card page acts on the spot, exactly as it always has, and the same durable action
  // is recorded against this card's live Cloud event (#319) — so every other surface
  // showing that event stops offering it. It never waits: the board's outbox retries it,
  // and a Cloud that cannot be reached changes nothing here.
  if (started.ok && cloudRevision && Number.isInteger(req.id)) {
    const decision = req.action === "resolve" ? "answer" : "implement";
    if (req.action === "resolve" || req.action === "implement" || req.action === "run") {
      await recordCloudAction(req.id as number, decision, cloudRevision, cloudAnswers ?? []);
    }
  }
  return started;
}

/** What a card page adds to a start so the same decision reaches Cloud: the revision the
 *  user was looking at, and — on a Resolve — one answer per question the event holds, blanks
 *  included. Absent on a card with no live event, which is most of them. */
export interface CloudDecision {
  cloudRevision?: string;
  cloudAnswers?: CloudEventAnswer[];
}

// Fill a release from its goal (#165): a normal board run — it shows in the runs panel, can
// be stopped, and keeps its log — that moves the open cards shipping the goal into the
// release and writes the cards the goal needs that the board hasn't got.
//
// It returns the moment the run is spawned, never when the run is done: the release is
// already on the list, and what the run did is read in its log. Refused for a release the
// list doesn't hold — a stale tab shouldn't send an agent after a version that has been
// closed or dropped since.
export async function planReleaseAction(id: string): Promise<StartResult> {
  const release = typeof id === "string" ? id.trim() : "";
  if (!release) return { ok: false, error: "no release named" };
  if (!(await readReleases()).includes(release)) {
    return {
      ok: false,
      error: `"${release}" is not on the release list — it may already have been closed or dropped.`,
    };
  }
  const req: AgentRequest = { action: "plan-release", release };
  return startSession(req, await buildPrompt(req));
}

// Continue a failed run: a fresh run on the same card and the same action, spawned with
// the agent's resume flags and a "continue" prompt. Returns the NEW run's
// id (or a refusal message) exactly like starting one, so the panel can select it and watch
// it the same way. The CLI re-checks that the run really did fail and really can be resumed
// — the button is drawn from a poll that's up to a second and a half stale.
export async function resumeSessionAction(sessionId: string): Promise<StartResult> {
  if (typeof sessionId !== "string" || !sessionId) return { ok: false, error: "no session given" };
  return resumeSession(sessionId);
}

// End a running agent (#49): ask its process to stop, kill it if it doesn't, and close the
// run out as `stopped`. The run's half-finished edits are left in the working tree — the
// board never undoes work. Reports ok for a run that already ended, since the button is
// drawn from a poll that can be a second and a half stale.
export async function stopSessionAction(sessionId: string): Promise<StartResult> {
  if (typeof sessionId !== "string" || !sessionId) return { ok: false, error: "no session given" };
  return stopSession(sessionId);
}

// Take a card back from the delivery in flight on it (#301): the delivery ends as
// cancelled, its running run is stopped, the card unlocks, and Implement is offered
// again. Whatever the delivery wrote stays in the working tree — the board never undoes
// work. Named by delivery id, so a stale tab can't cancel the delivery that replaced the
// one it was drawn from.
export async function cancelDeliveryAction(deliveryId: string): Promise<StartResult> {
  if (typeof deliveryId !== "string" || !deliveryId) return { ok: false, error: "no delivery named" };
  return cancelDelivery(deliveryId);
}

// Throw a delivery's checkout away (#303): its worktree, its branch, and everything only
// they hold. Cancelling a delivery deliberately leaves those where they are, so this is the
// only thing that removes one — and the card page says what will be lost and asks for a
// second click before it gets here.
export async function discardDeliveryAction(deliveryId: string): Promise<StartResult> {
  if (typeof deliveryId !== "string" || !deliveryId) return { ok: false, error: "no delivery named" };
  return discardDelivery(deliveryId);
}

// Approve the tree a delivery would land (#308), on a board that requires it. The base
// commit and the fingerprint are read here, as the click lands, so what the record says was
// approved is what was on screen. Named by delivery id, so a stale tab can't approve the
// delivery that replaced the one it was drawn from.
export async function approveDeliveryAction(deliveryId: string): Promise<StartResult> {
  if (typeof deliveryId !== "string" || !deliveryId) return { ok: false, error: "no delivery named" };
  return approveDelivery(deliveryId);
}

// The shared run list, for the UI's poll. Every tab reads the same picture. The UI polls
// this continuously, so it's also where we make sure the background dispatcher (#43) is
// running — idempotent, so a poll from any tab keeps it alive for the life of the server.
export async function listSessionsAction(): Promise<SessionView[]> {
  ensureDispatcher();
  return listSessions();
}

// One run with its log tail, read from the log file. The UI polls this while a run is
// live to tail its output, and calls it once to open a finished run's log.
export async function getSessionAction(sessionId: string): Promise<SessionView | null> {
  if (typeof sessionId !== "string" || !sessionId) return null;
  return getSession(sessionId);
}

// ---- the chat (#242) --------------------------------------------------------
// The conversation the window holds with the agent — the board's, or the open card's. It
// is not a run: none of these touch the run record, so nothing here shows in the runs panel
// or keeps a run off a card.
//
// Sending comes straight back. The reply is written on the server (lib/chat.ts) and the
// window reads how far it has got, so folding the rail or walking to another card never
// cuts one off.

/** A card id, or null for the board's own conversation. Anything else is not a chat this
 *  board has. */
function chatTarget(cardId: unknown): number | null | undefined {
  if (cardId === null) return null;
  return typeof cardId === "number" && Number.isInteger(cardId) ? cardId : undefined;
}

export async function readChatAction(cardId: number | null): Promise<ChatRead> {
  const target = chatTarget(cardId);
  if (target === undefined) {
    return {
      chat: null,
      live: null,
      stopped: null,
      answering: false,
      liveSince: null,
      stamp: null,
      cardGone: false,
      canChat: false,
      agent: "",
      able: [],
      missing: false,
      blocked: "that is not a card on this board.",
    };
  }
  return readChat(target);
}

export async function sendChatAction(cardId: number | null, message: string): Promise<{ ok: boolean; error?: string }> {
  const target = chatTarget(cardId);
  if (target === undefined) return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  if (typeof message !== "string" || !message.trim()) {
    return { ok: false, error: (await machineCopy()).messages.actions.emptyChat };
  }
  return sendChat(target, message.trim());
}

/** End the reply being written, keeping what arrived. Quiet when there is none: a reply
 *  that has already landed is not an error to have tried to stop. */
export async function stopChatAction(cardId: number | null): Promise<{ ok: boolean; error?: string }> {
  const target = chatTarget(cardId);
  if (target === undefined) return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  return stopChat(target);
}

export async function clearChatAction(cardId: number | null): Promise<{ ok: boolean; error?: string }> {
  const target = chatTarget(cardId);
  if (target === undefined) return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  return clearChat(target);
}

// ---- the first run's own conversation (#280) --------------------------------
//
// The first run asks what the project is by talking. These are its three moves: open the
// conversation (the board speaks first), read how far it has got, and say one correction
// into it. Everything they need is in lib/setup-chat.ts.

export async function readSetupChatAction(): Promise<SetupChatRead> {
  return readSetupChat();
}

export async function openSetupChatAction(): Promise<{ ok: boolean; error?: string }> {
  return openSetupChat();
}

export async function saySetupChatAction(text: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof text !== "string" || !text.trim()) {
    return { ok: false, error: (await machineCopy()).messages.actions.emptyChat };
  }
  return saySetupChat(text.trim());
}

// ---- the goal ---------------------------------------------------------------

// The goal editor — the first run's goal step, and the board's goal notice long after
// setup (#53, #85, #172). Reading returns the user's words (an empty box when goal.md
// doesn't exist yet); saving writes them back, marks the goal `reviewed: pending`, and
// ticks setup's goal box, all of which is one move in the CLI.
export async function getGoalAction(): Promise<string> {
  return readGoalText();
}

export async function saveGoalAction(text: string): Promise<WriteResult> {
  if (typeof text !== "string") return { ok: false, error: "the goal is saved as text" };
  return saveGoal(text);
}

// ---- the guided first run (#172) --------------------------------------------
//
// Three of setup's steps are the user's own — which agent runs the board, what the project
// is and its tracks, and the goal. The flow settles them one view at a time, the middle one
// by talking (#280); these are what it reads and writes. Everything else setup does reads
// the repo and thinks, and is an agent's job.

/** What the flow opens with: the board's answers as they stand today. */
export async function getSetupDraftAction(): Promise<SetupDraft> {
  return readSetupDraft();
}

// Save the project and its tracks, and tick setup's `project` box. The tracks are folders
// as well as words, so this is also where a new one is made and an empty one that was
// dropped is removed. A track holding cards is kept and named in the answer rather than
// deleted.
export async function saveSetupProjectAction(
  name: string,
  description: string,
  tracks: TrackDraft[],
): Promise<SaveProjectResult> {
  if (typeof name !== "string" || typeof description !== "string") {
    return { ok: false, error: "the project is saved as text" };
  }
  if (!Array.isArray(tracks)) return { ok: false, error: "the tracks are saved as a list" };
  const clean = tracks
    .filter((t): t is TrackDraft => Boolean(t) && typeof t.name === "string")
    .map((t) => ({
      name: t.name,
      note: typeof t.note === "string" ? t.note : "",
      was: typeof t.was === "string" ? t.was : undefined,
    }));
  return saveProject(name, description, clean);
}

// Tick setup's `agent` box — the flow's first step (#280), and the one it can't be pressed
// past. A test that passed here is the only thing that ticks it: everything after it is
// that agent talking, so a board that finished setup without a working agent was never set
// up.
//
// It answers with the whole agent setting as it now reads, the way switching agents does:
// the picker keeps the switch to itself while the step is open, so this is where the board
// behind the flow hears which agent was settled on.
export async function finishSetupAgentStepAction(): Promise<WriteResult & { agent?: AgentInfo }> {
  const ticked = await finishSetupStep("agent");
  if (!ticked.ok) return ticked;
  return { ok: true, agent: await agentInfo().catch(() => undefined) };
}

// Finish setting the board up (#173) — the offer on the guided run's closing screen and on
// the setup strip. One ordinary run: it shows in the runs panel, its log can be read, it can
// be stopped, and the board re-reads itself when it ends. It does every step still unticked,
// so a run started again after a failure carries on rather than redoing what finished.
//
// The two refusals are here rather than in the button, which is drawn from a board read that
// can be a poll behind: a board someone else has already finished setting up, and a board
// with no goal — nothing after the goal can be planned from a goal nobody wrote, so a run
// started there would stop on its first step and read as a failure. The board being busy
// with another setup run is the CLI's refusal, in the one place that sees every run.
export async function startSetupRunAction(): Promise<StartResult> {
  let setup: Awaited<ReturnType<typeof readSetupState>>;
  try {
    setup = await readSetupState();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!setup) return { ok: false, error: "this board is already set up" };
  const goal = setup.steps.find((s) => s.name === "goal");
  if (goal && !goal.done) {
    return { ok: false, error: (await machineCopy()).messages.actions.goalFirst };
  }
  const req: AgentRequest = { action: "setup" };
  return startSession(req, await buildPrompt(req));
}

// ---- releases ---------------------------------------------------------------

// Start a release from the header's New release entry (#115) — one line appended to
// docs/kanban/releases.md, the same line `release new` writes, carrying what the version is
// for (#164) when the dialog's goal box was filled in.
//
// No agent run to make one: a release is a name and its place in the order, so there is
// nothing for an agent to decide, and a run answers minutes later in a log — which cannot
// refuse a bad name in the dialog the user is still typing in.
//
// `fill` is what the dialog's tab asked for (#106, #165). Which of the two fills that means
// is the CLI's call, not this file's: a release WITH a goal is planned against it by an
// agent run, one with NO goal takes the plain rule there and then. Either way the release is
// written first, so making one never waits on an agent and a refused name moves nothing.
//
// The release stands whatever the run does: a run that can't start — another is already
// going — still leaves the version on the list, so that comes back as `planError` beside
// `ok`, for the board to say out loud rather than as a failure that would keep the dialog
// open on a release it already made. A run that DID start comes back as `planSessionId`, so
// the board can take it on as a run this tab started.
export async function createReleaseAction(
  id: string,
  fill = false,
  goal = "",
): Promise<WriteResult & { planning?: boolean; planSessionId?: string; planError?: string }> {
  if (typeof id !== "string") return { ok: false, error: "a version id is text" };
  const made = await newRelease(id, typeof goal === "string" ? goal : "", fill === true);
  if (!made.ok || made.fill !== "agent") return made;
  const run = await planReleaseAction(id.trim());
  return {
    ok: true,
    planning: run.ok,
    planSessionId: run.ok ? run.sessionId : undefined,
    planError: run.ok ? undefined : run.error,
  };
}

// Change what a release is for, after it was made (#164) — the ⋯ menu's goal dialog, the
// same write `release goal` makes. An empty goal clears it, which is why only the id is
// refused for being empty.
export async function setReleaseGoalAction(id: string, goal: string): Promise<WriteResult> {
  if (typeof id !== "string" || !id.trim()) return { ok: false, error: "no release named" };
  if (typeof goal !== "string") return { ok: false, error: "a goal is text" };
  return setReleaseGoal(id.trim(), goal);
}

// What the fill would do right now — the New release dialog reads this as it opens, so the
// toggle carries the number of cards before the release is made.
export async function fillPlanAction(): Promise<FillPlan> {
  return fillPlan();
}

// Which archived cards stay put and which open cards a drop strips of their release — the
// confirm dialog reads this as it opens (#131), so the user sees the move before anything
// is changed.
export async function dropPlanAction(id: string): Promise<DropPlan> {
  if (typeof id !== "string" || !id) return { archived: [], left: [] };
  return dropPlan(id);
}

// Give up on a release from the header's picker (#131) — the same move `release drop`
// makes: clear the open cards' release and take the line off the list, without touching a
// summary file (#166). A stale board — the release already gone — comes back as
// { ok:false, error } for the dialog to show.
export async function dropReleaseAction(id: string): Promise<WriteResult> {
  if (typeof id !== "string" || !id.trim()) return { ok: false, error: "no release named" };
  return dropRelease(id.trim());
}

// What a close would write down and move — the confirm dialog reads this as it opens
// (#136). It carries the open cards with every todo ticked, since a close counts those as
// not shipped and cannot be undone; seeing them here is what lets the user cancel, archive
// the card, and close after.
export async function closePlanAction(id: string): Promise<ClosePlan> {
  if (typeof id !== "string" || !id) return { left: [], shipped: 0 };
  return closePlan(id);
}

// Close a shipped release from the header's picker (#136) — the same move `release close`
// makes: one dated `## Closed` section in the summary file, the open cards' release
// cleared, the line off the list.
//
// Then the changelog (#232). The close is finished either way — it has already written the
// card list — so the run is started behind it and never waited for: a run that couldn't
// start comes back as `changelogError` for the board to say out loud, and a version that
// shipped nothing gets no run at all, since there would be nothing to write from.
export async function closeReleaseAction(
  id: string,
): Promise<WriteResult & { changelogSessionId?: string; changelogError?: string }> {
  if (typeof id !== "string" || !id.trim()) return { ok: false, error: "no release named" };
  const release = id.trim();
  const closed = await closeRelease(release);
  if (!closed.ok || !closed.shipped) return closed;
  const req: AgentRequest = { action: "changelog", release };
  const run = await startSession(req, await buildPrompt(req));
  return {
    ...closed,
    changelogSessionId: run.ok ? run.sessionId : undefined,
    changelogError: run.ok ? undefined : run.error,
  };
}

// Move the cards ticked on the board into one release, or back out of one (#114) — the same
// single-card write the card page's Release box makes, run once per card.
export async function setCardsReleaseAction(ids: number[], release: string): Promise<BulkReleaseResult> {
  if (!Array.isArray(ids) || typeof release !== "string") {
    return { moved: 0, failed: [], error: "a bulk move takes card ids and a release" };
  }
  const clean = ids.filter((id) => Number.isInteger(id));
  if (clean.length === 0) {
    return { moved: 0, failed: [], error: (await machineCopy()).messages.actions.nothingTicked };
  }
  return setCardsRelease(clean, release);
}

// ---- a card, and the numbers -------------------------------------------------

// `expect` is the revision the page read the card at (#316). Every card write from a screen
// carries it, so a card rewritten under an open page — by a run here, or by another machine
// on a Cloud board — comes back as a conflict with nothing written, and the page re-reads
// that one card instead of overwriting words it never saw.
export async function patchCardAction(
  id: number,
  patch: CardPatch,
  expect = "",
): Promise<WriteResult> {
  return patchCard(id, patch, expect);
}

// One hand-check added or crossed off from the card page (#276). Both save the moment the
// user acts and neither starts a run: a hand-check is one line of text, so there is nothing
// for an agent to decide.
//
// A cross-off names the LINE, not its place in the list — a run can add or take away
// hand-checks while the page sits open. The answer carries the list as the card now holds
// it, so the panel redraws from the card either way, a refusal included.
export async function addVerifyAction(id: number, line: string, expect = ""): Promise<VerifyResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "a hand-check is added by card number" };
  if (typeof line !== "string" || !line.trim()) return { ok: false, error: "a hand-check is one line of text" };
  return addVerify(id, line, expect);
}

export async function dropVerifyAction(id: number, line: string, expect = ""): Promise<VerifyResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "a hand-check is crossed off by card number" };
  if (typeof line !== "string") return { ok: false, error: "a hand-check is named by its text" };
  return dropVerify(id, line, expect);
}

// Schedule an action on a blocked card (#140) — the second way out of a card that is waiting
// on another one: instead of building it anyway, the user says what should happen, and the
// board starts it by itself once the last card in its way has left the board.
//
// No agent run to write the mark: it is one field on the card, so there is nothing for an
// agent to decide, and a run would answer minutes later in a log that can't refuse a card
// with nothing in its way while the dialog is still open. Everything about whether this card
// may carry a schedule is the CLI's rule; a refusal comes back as the line it wrote.
export async function scheduleCardAction(
  id: number,
  action: string,
  notes = "",
  expect = "",
): Promise<WriteResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "a card is scheduled by its number" };
  if (typeof action !== "string") return { ok: false, error: "an action is text" };
  return setSchedule(id, action, typeof notes === "string" ? notes : "", expect);
}

// Take a card's schedule off — the card page's one control for it. Nothing fires after this.
export async function unscheduleCardAction(id: number, expect = ""): Promise<WriteResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "a card is scheduled by its number" };
  return clearSchedule(id, expect);
}

// The daily progress view (#65) — the last 30 days of docs/kanban/metrics.csv. Read once
// each time the view opens; the file changes a few times a day at most, so there's nothing
// to poll. A file that can't be read comes back as { ok:false, error }, so the message
// survives to the client instead of becoming a server-render error.
export async function getMetricsAction(): Promise<MetricsResult> {
  return readMetrics();
}

// The planning scores (#224) — every release window worked out from docs/kanban/record.csv,
// ready to draw. Read on each open, beside the daily numbers and separately from them: one
// chart failing must leave the other drawn.
export async function getScoreAction(): Promise<ScoreResult> {
  return readScore();
}

// ---- the agent settings ------------------------------------------------------

// Save the agent the user picked in the Configuration dialog (#68), persisted to the same
// file. The name is checked against the harnesses this build ships, so a stale client can't
// write a setting nothing can run. Runs in flight are untouched — each read the setting
// when it started.
//
// A save comes back with the whole agent setting as it now reads, because switching is the
// one change the dialog can't work out for itself: the new agent's settings come back from
// where they were parked when it was last picked, its keys are whatever docs/kanban/.env
// already holds, and its provider is worked out from those keys.
export async function setHarnessAction(name: string): Promise<WriteResult & { agent?: AgentInfo }> {
  // The agents this build runs are the CLI's list, not a copy kept here — so a stale client
  // can't write a setting nothing can run, and nothing here learns an agent's name.
  const known = (await agentInfo()).options.some((o) => o.name === name);
  if (typeof name !== "string" || !known) return { ok: false, error: `unknown agent "${name}"` };
  const res = await setHarness(name);
  if (!res.ok) return res;
  return { ok: true, agent: await agentInfo() };
}

// **Automatic Git commits** (#303) — read when the Delivery group opens, saved
// when the switch is flipped. One repository-level answer, in the same file as the rest.
export async function autoCommitAction(): Promise<{ on: boolean; error?: string }> {
  try {
    return { on: await autoCommitAllowed() };
  } catch (e) {
    // Nothing to read the setting with: the switch shows its default and says why rather
    // than drawing an empty pane.
    return { on: true, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setAutoCommitAction(on: boolean): Promise<WriteResult> {
  if (typeof on !== "boolean") return { ok: false, error: "that setting is on or off" };
  return setAutoCommit(on);
}

// **Approve diffs before landing** (#308) — read and saved beside it, in the same
// file. Off by default, so nothing to read reads as off.
export async function diffApprovalAction(): Promise<{ on: boolean; error?: string }> {
  try {
    return { on: await diffApprovalRequired() };
  } catch (e) {
    return { on: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setDiffApprovalAction(on: boolean): Promise<WriteResult> {
  if (typeof on !== "boolean") return { ok: false, error: "that setting is on or off" };
  return setDiffApproval(on);
}

// **End a silent run after** (#394) — how many minutes a run may say nothing before the
// board ends it. Same file as the two above, so the Delivery switches and this box are one
// read when the pane opens.
export async function silenceLimitAction(): Promise<{ minutes: number; error?: string }> {
  try {
    return { minutes: await silenceMinutes() };
  } catch (e) {
    // Nothing to read the setting with: the box shows 0 — nothing would end a run — and
    // says why rather than drawing an empty pane.
    return { minutes: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setSilenceLimitAction(minutes: number): Promise<WriteResult> {
  if (!Number.isInteger(minutes) || minutes < 0) {
    return { ok: false, error: "that setting is a whole number of minutes" };
  }
  return setSilenceMinutes(minutes);
}

// --- the flow rules (#306) ---------------------------------------------------
// Every flow the board can start, with the rule it carries. Asked when the Rules pane
// opens; nothing else on screen shows them.

export async function flowRulesAction(): Promise<{ flows: FlowRuleView[] | null; error?: string }> {
  try {
    return { flows: await flowRules() };
  } catch (e) {
    return { flows: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Save one flow's rule, or clear it with empty text. The command is checked against the
 *  board's own list of flows, so a stale client can't write a rule for a flow that does not
 *  exist. */
export async function setFlowRuleAction(command: string, text: string): Promise<WriteResult> {
  if (typeof command !== "string" || typeof text !== "string") {
    return { ok: false, error: "a flow rule is saved by command and text" };
  }
  try {
    return await setFlowRule(command, text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// The agents the board can run and which of them this machine has (#207) — the picker asks
// for this each time it opens, so a CLI installed while the board was open is offered the
// next time you look rather than after a reload.
//
// It is a fresh look every time: the PATH is read again on the server, nothing is cached,
// and nothing is spawned. An answer that can't be got at all (no copy of the rules) comes
// back empty, and the picker keeps showing what the page load gave it — the wrong way to
// fail here is greying out every agent.
export async function installedAgentsAction(): Promise<HarnessOption[]> {
  try {
    return (await agentInfo()).options;
  } catch {
    return [];
  }
}

// Which of the installed agents are logged out (#392) — asked once the picker has drawn,
// because this one spawns each CLI and the picker must never wait on it.
//
// It gates nothing. The answer is a line under the grid and a word on a card; Implement,
// Schedule, Resolve & implement, a chat and `akb implement` all start exactly as before, so
// a stale reading costs one wasted run rather than an agent the user can't reach.
//
// Nothing to say comes back as nothing: no rules to ask, a CLI that wouldn't answer, or the
// ordinary case where everything is logged in.
export async function loggedOutAgentsAction(): Promise<LoggedOutAgent[]> {
  try {
    return await loggedOutAgents();
  } catch {
    return [];
  }
}

// Save one of the settings the picked agent declares (#93), persisted to the same file. The
// key is checked against that agent's own list, so nothing can write a key it never
// declared — including a field the user left focused while switching agents, whose late
// save belongs to an agent that is no longer picked.
//
// The value is checked only as far as the setting's shape allows: a list must be given one
// of its own choices, a box takes free text. Model ids change between agent releases, so a
// text setting is never validated here — the agent is the only validator, and a bad id
// shows up as a failed run with the reason in its log. Empty clears the setting, and the
// agent runs its own default.
export async function setHarnessSettingAction(key: string, value: string): Promise<WriteResult> {
  if (typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a setting is saved as text" };
  }
  const setting = (await activeSettings()).find((s) => s.key === key);
  if (!setting) return { ok: false, error: `the agent you picked has no "${key}" setting` };
  // A key never goes near ui.config.json — it has its own action and its own file (#94).
  // Refused here rather than quietly rerouted: a client sending a key down this path has a
  // bug, and the file it would land in is committed.
  if (setting.kind === "secret") {
    return { ok: false, error: `"${setting.label}" is a key — it saves to docs/kanban/.env` };
  }
  const next = value.trim();
  if (setting.kind === "select" && next && !setting.choices?.some((c) => c.value === next)) {
    return { ok: false, error: `"${next}" isn't one of the ${setting.label} choices` };
  }
  // The provider pick, and the boxes it can't do without (#95). A pick that names no
  // provider we ship, one whose base URL is still empty, and a base URL emptied while that
  // pick is live are all refused here — so whatever a client does, the file never says a
  // run goes somewhere it can't go.
  const wrong = await settingSaveError(key, next);
  if (wrong) return { ok: false, error: wrong };
  return setHarnessSetting(key, next);
}

// Save one of the picked agent's keys (#94) to docs/kanban/.env — the board's one place for
// them. An empty value clears it, and the agent goes back to whatever login its CLI has of
// its own.
//
// The key is written to that file and nowhere else: not ui.config.json, not the run record,
// not a run's log. Nothing comes back but ok — the value is never returned, echoed, or read
// back into the browser. The setting has to be one the picked agent declares as a secret,
// so a field left focused while switching agents can't write a key the new agent never
// asked for.
export async function setHarnessSecretAction(key: string, value: string): Promise<WriteResult> {
  if (typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a key is saved as text" };
  }
  const setting = (await activeSettings()).find((s) => s.key === key);
  if (!setting || setting.kind !== "secret" || !setting.env) {
    return { ok: false, error: `the agent you picked has no "${key}" key` };
  }
  return setSecret(setting.env, value);
}

// Send one small chat through the setup that is saved right now and say whether it worked
// (#96) — the Test button in the Configuration dialog.
//
// It takes no arguments on purpose: there is nothing for the client to say. The setup being
// tested is the one in the files, which is the one the next card run will use, so a client
// can neither test something else nor test something that isn't saved.
//
// It touches no card, holds no lock and starts no session. It never throws either: every
// way it can go wrong is a result the panel shows.
export async function testConnectionAction(runtime?: string): Promise<ConnectionTest> {
  // Named a runtime, it spawns what THAT runtime resolves to here (#344) — the runtime whose
  // pane the button is on, never the board's global one.
  return testConnection(typeof runtime === "string" && runtime ? runtime : undefined);
}

// --- the runtimes (#344) ------------------------------------------------------
// Configuration → Runtimes. One file holds all of it: the board names its runtimes in
// docs/kanban/ui.config.json and says what each one runs as, right beside the names. Every
// write here goes through the CLI, so a terminal `akb agent` and this pane are one writer
// with one set of rules.
//
// Each one answers with the whole agent setting as it now reads, because a runtime move
// changes more than the row it was made on: a removal moves the flows that named it, a
// rename carries them, and a bind changes what the list says the runtime runs as.

/** What one runtime is named by, before it is removed — the flows and spec agents that would
 *  be moved onto the board's global one. Both lists come from the board's own answer, so the
 *  pane keeps no list of its own. */
export async function runtimeUsersAction(
  name: string,
): Promise<{ flows: string[]; specAgents: string[] }> {
  const blank = { flows: [], specAgents: [] };
  if (typeof name !== "string" || !name) return blank;
  try {
    const info = await agentInfo();
    const agents = await specAgents().catch(() => []);
    return {
      flows: info.flows.filter((f) => f.runtime === name).map((f) => f.command),
      specAgents: (agents ?? []).filter((a) => a.runtime === name).map((a) => a.name),
    };
  } catch {
    // Nothing to read them with. The removal itself still says whether it worked, and a
    // warning that can't be built is not a reason to refuse one.
    return blank;
  }
}

export async function addRuntimeAction(name: string): Promise<WriteResult & { agent?: AgentInfo }> {
  return runtimeMove(() => addRuntime(String(name ?? "").trim()));
}

export async function removeRuntimeAction(
  name: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  return runtimeMove(() => removeRuntime(String(name ?? "").trim()));
}

export async function renameRuntimeAction(
  from: string,
  to: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  return runtimeMove(() => renameRuntime(String(from ?? "").trim(), String(to ?? "").trim()));
}

export async function setGlobalRuntimeAction(
  name: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  return runtimeMove(() => setGlobalRuntime(String(name ?? "").trim()));
}

/** Save the agent one runtime runs. The name is checked against the agents this build
 *  ships, so a stale client can't save one nothing can spawn. */
export async function bindRuntimeAction(
  runtime: string,
  harness: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof runtime !== "string" || typeof harness !== "string") {
    return { ok: false, error: "a runtime and an agent are saved as text" };
  }
  const info = await agentInfo().catch(() => null);
  if (!info?.runtimes.some((r) => r.name === runtime)) {
    return { ok: false, error: `no runtime called "${runtime}" on this board` };
  }
  // The agents this build runs are the CLI's list, not a copy kept here.
  if (!info.options.some((o) => o.name === harness)) {
    return { ok: false, error: `unknown agent "${harness}"` };
  }
  return runtimeMove(() => setRuntimeHarness(runtime, harness));
}

/** Save one of that runtime's settings. Judged against the agent THAT runtime runs, never
 *  the board's global one — a value Codex refuses must not be saved against Claude Code's
 *  rules. */
export async function setRuntimeSettingAction(
  runtime: string,
  key: string,
  value: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof runtime !== "string" || typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a setting is saved as text" };
  }
  const setting = (await activeSettings(runtime)).find((s) => s.key === key);
  if (!setting) return { ok: false, error: `that runtime's agent has no "${key}" setting` };
  // A key never goes near ui.config.json: the board has exactly one place for one, and it is
  // the file git does not carry (#94).
  if (setting.kind === "secret") {
    return { ok: false, error: `"${setting.label}" is a key — it saves to docs/kanban/.env` };
  }
  const next = value.trim();
  if (setting.kind === "select" && next && !setting.choices?.some((c) => c.value === next)) {
    return { ok: false, error: `"${next}" isn't one of the ${setting.label} choices` };
  }
  const wrong = await settingSaveError(key, next, runtime);
  if (wrong) return { ok: false, error: wrong };
  return runtimeMove(() => setRuntimeSetting(runtime, key, next));
}

/** Save one of that runtime's keys. It goes to docs/kanban/.env exactly as the board's own
 *  does, so two runtimes on one agent share one key — the config file is committed and a key
 *  was never in it. */
export async function setRuntimeSecretAction(
  runtime: string,
  key: string,
  value: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof runtime !== "string" || typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a key is saved as text" };
  }
  const setting = (await activeSettings(runtime)).find((s) => s.key === key);
  if (!setting || setting.kind !== "secret" || !setting.env) {
    return { ok: false, error: `that runtime's agent has no "${key}" key` };
  }
  return runtimeMove(() => setSecret(setting.env!, value));
}

// One move, and the whole setting as it now reads. A failure answers with the reason and no
// setting, so the pane puts the row it moved back exactly as it was.
async function runtimeMove(
  move: () => Promise<WriteResult>,
): Promise<WriteResult & { agent?: AgentInfo }> {
  try {
    const res = await move();
    if (!res.ok) return res;
    return { ok: true, agent: await agentInfo().catch(() => undefined) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- the spec agents (#191) ---------------------------------------------------
// Which spec agents this board ships, and the switch that keeps one from running. Both are
// the board's own — these only say when, and turn a failure into a value the Agents
// section can show rather than a crash page.

/** The list the Agents section draws: each agent's two lines and whether it is on. `null`
 *  when this project's rules are older than the switches, so the section can say that
 *  instead of showing an empty list. */
export async function specAgentsAction(): Promise<{ agents: SpecAgentView[] | null; error?: string }> {
  try {
    return { agents: await specAgents() };
  } catch (e) {
    return { agents: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Switch one spec agent on or off. The name is checked against the board's own list, so a
 *  stale client can't write a switch for an agent that doesn't exist. */
export async function setSpecAgentAction(name: string, on: boolean): Promise<WriteResult> {
  if (typeof name !== "string" || typeof on !== "boolean") {
    return { ok: false, error: "a spec agent is switched by name" };
  }
  try {
    return await setSpecAgentEnabled(name, on);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Save one of the settings a spec agent declares (#257). The agent, the setting and the
 *  choice are all checked against the board's own list, so a stale client can't write a
 *  setting no agent has or a choice no setting offers. */
export async function setSpecAgentSettingAction(
  name: string,
  key: string,
  value: string,
): Promise<WriteResult> {
  if (typeof name !== "string" || typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a spec agent setting is saved by name, key and value" };
  }
  try {
    return await setSpecAgentSetting(name, key, value);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- the coding agent skill (#174) -------------------------------------------
// Whether a coding agent can drive this board, and the button that makes it able to. Both
// are the board's own move; these say when, and turn a failure into a value the panel can
// show rather than a crash page.

/** Where the skill stands in this project, plus how the `akb` on this machine compares to
 *  the copy the board runs on. Asked when the Skill section opens — the command check
 *  spawns a process, so it never rides along with the board's poll. */
export async function skillStateAction(): Promise<{ skill: SkillState; command: CommandState | null; error?: string }> {
  try {
    const [skill, command] = await Promise.all([skillState(), commandState()]);
    return { skill, command };
  } catch (e) {
    return { skill: UNKNOWN_SKILL, command: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Add the skill to this project, or bring an older copy up to date. It writes files in
 *  the repo and nothing else: no global install, and no command replaced. */
export async function installSkillAction(): Promise<SkillInstall> {
  try {
    return await installSkill();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      wrote: [],
      skipped: [],
      state: UNKNOWN_SKILL,
    };
  }
}

// --- the Cloud sign-in (#326) ------------------------------------------------
// Which account this MACHINE acts as. Asked when the Cloud section opens and after every
// press in it, never on the board's poll: it reaches the service over the network.
//
// The sign-in itself is three steps between three places — this server makes the consent
// URL and keeps the secret half, the app opens the browser and catches the answer on its
// URL scheme, and the answer comes back here to be exchanged. The board UI server is the
// one that holds the session file, so a terminal `akb` reads what a press here wrote.

export async function cloudAccountAction(): Promise<CloudAccount> {
  return cloudAccount();
}

/** The consent screen to open. The app opens it in the user's own browser — a desktop
 *  window must never navigate away from the board. */
export async function startCloudSignInAction(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    return await startCloudSignIn();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The answer the app caught, exchanged for a session. `callback` is the whole URL the
 *  scheme was opened with — checked here so a stale client cannot hand over anything else. */
export async function finishCloudSignInAction(callback: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof callback !== "string" || !callback.startsWith("ai4kanban://")) {
    return { ok: false, error: "that is not a sign-in answer" };
  }
  try {
    return await finishCloudSignIn(callback);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Sign this machine out. Nothing already on the board is touched. */
export async function signOutOfCloudAction(): Promise<{ ok: boolean; error?: string }> {
  try {
    return await signOutOfCloud();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- the one way out of the not-admitted state (#327, #350) ------------------
// It presses once and then re-reads the account: what the pane draws next — the requested
// state, or the admitted one — is the service's answer, never this screen's guess.

/** Ask us for an invite. Pressing again records no second request and sends no second email. */
export async function requestCloudInviteAction(): Promise<CloudMove> {
  try {
    return await requestCloudInvite();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- the account's Slack destination (#320) ----------------------------------
// Where a task waiting on a decision arrives, and where that decision is made. Asked when
// the Cloud section opens and after every press in it, never on the board's poll: like the
// account above, every one of these reaches the service over the network.
//
// The connection is made the same way the sign-in is — this server asks for the consent
// URL, the app opens the user's own browser, and the answer comes back to the app on its
// URL scheme, which brings the pane back to re-read what the service now holds.

export async function slackStateAction(): Promise<SlackState> {
  try {
    return await slackState();
  } catch (e) {
    return { connection: null, configured: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The consent screen to open in the user's own browser. */
export async function startSlackConnectAction(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  try {
    return await startSlackConnect();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The conversations a destination can be pointed at — the channels the app can reach, and
 *  the direct message with whoever connected. */
export async function slackConversationsAction(): Promise<
  { ok: true; conversations: SlackConversation[] } | { ok: false; error: string }
> {
  try {
    return await slackConversations();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Point it at one. Picking again is also how a refusal Slack raised is cleared. */
export async function setSlackChannelAction(channelId: string, channelName: string): Promise<CloudMove> {
  if (typeof channelId !== "string" || !channelId) return { ok: false, error: "that is not a conversation" };
  try {
    return await setSlackChannel(channelId, typeof channelName === "string" ? channelName : "");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Stop posting. No board is touched and every event goes on exactly as it was. */
export async function disconnectSlackAction(): Promise<CloudMove> {
  try {
    return await disconnectSlack();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- the account's Lark destination (#351) -----------------------------------
// Beside Slack rather than instead of it, and made the same way. Connecting names a cloud,
// because 飞书 and Lark international are two platforms that list two apps.

export async function larkStateAction(): Promise<LarkState> {
  try {
    return await larkState();
  } catch (e) {
    return { connection: null, clouds: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** The consent screen to open in the user's own browser, for one cloud. */
export async function startLarkConnectAction(
  cloud: LarkCloud,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (cloud !== "feishu" && cloud !== "lark") return { ok: false, error: "that is not a Lark cloud" };
  try {
    return await startLarkConnect(cloud);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** The chats a destination can be pointed at — the groups the bot is in, and the direct
 *  message with whoever connected. */
export async function larkChatsAction(): Promise<
  { ok: true; chats: LarkChat[] } | { ok: false; error: string }
> {
  try {
    return await larkChats();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Point it at one. Picking again is also how a refusal Lark raised is cleared. */
export async function setLarkChatAction(chat: LarkChat): Promise<CloudMove> {
  if (!chat || typeof chat.id !== "string" || !chat.id) return { ok: false, error: "that is not a chat" };
  try {
    return await setLarkChat({
      id: chat.id,
      name: typeof chat.name === "string" ? chat.name : "",
      direct: chat.direct === true,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Stop posting. A Slack connection beside this one keeps posting, and no board is touched. */
export async function disconnectLarkAction(): Promise<CloudMove> {
  try {
    return await disconnectLark();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Where the card link in a connector's message leads — the board's own path on this machine,
 *  and the card to open in it. Null when the URL names no card, so the window can hand every
 *  one of the app's URLs through it. */
export async function cloudCardLinkAction(url: string) {
  if (typeof url !== "string" || !url.startsWith("ai4kanban://")) return null;
  try {
    return await cloudCardLink(url);
  } catch {
    return null;
  }
}

// --- the language this machine works in (#334) -------------------------------
// Only the write: the answer is read on the server in `app/layout.tsx` and handed to every
// screen through the context below it, so nothing here has to ask for it.

export async function setLanguageAction(value: Language): Promise<WriteResult> {
  if (!isLanguage(value)) return { ok: false, error: "that is not a language this app knows" };
  try {
    return await setMachineLanguage(value);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- the notification center (#319) ------------------------------------------
// The bell polls `notificationCenterAction` like every other panel polls its own read. It
// is the only place the account's Realtime connection is opened, because it is the read
// every screen makes: the board server the window is showing subscribes, and a
// backgrounded one keeps publishing without subscribing or interrupting anyone.
//
// Reading takes the alerts away. An alert is raised once or not at all — nothing is raised
// later to make up for a window that happened to be focused when one arrived.

export async function notificationCenterAction(): Promise<NotificationCenter> {
  try {
    return await notificationCenter();
  } catch (e) {
    return {
      signedIn: false,
      enabled: false,
      boardId: "",
      release: "",
      silenced: false,
      namesBoards: false,
      rows: [],
      unread: 0,
      alerts: [],
      unavailable: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Opening a row marks it read and says where to go: the board's own path on this machine,
 *  and the card to open in it. A board no longer here answers with a null path, and the
 *  rail says so rather than switching to it. */
export async function openNotificationAction(
  eventId: string,
): Promise<{ boardPath: string | null; taskId: number } | null> {
  if (typeof eventId !== "string" || !eventId) return null;
  try {
    return await openNotification(eventId);
  } catch {
    return null;
  }
}

/** Mark every row read at once. The rows stay — only the bell's count empties. */
export async function readAllNotificationsAction(): Promise<void> {
  try {
    await readAllNotifications();
  } catch {
    // A read mark we could not save is a row that stays bold. Not worth an error.
  }
}

/** The one switch that stops every board's system notifications while the bell keeps
 *  filling. A fact about this machine, like the sign-in it sits beside. */
export async function setSilencedAction(on: boolean): Promise<WriteResult> {
  try {
    return await setSilenced(!!on);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- this board's own notification settings ----------------------------------

export async function boardNotificationsAction(): Promise<BoardNotifications> {
  try {
    return await boardNotifications();
  } catch {
    return {
      enabled: false,
      release: "",
      releases: [],
      signedIn: false,
      server: { attached: false, here: false, machineName: "", thisMachine: "", runtimes: [] },
    };
  }
}

/** Watch a different release — the rail's own prompt when the last one closed. */
export async function watchReleaseAction(release: string): Promise<WriteResult> {
  if (typeof release !== "string") return { ok: false, error: "that is not a release" };
  try {
    return await watchRelease(release.trim());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- this board's server (#318) ----------------------------------------------
// Which machine runs an approval taken anywhere else. A board attaches exactly one, so
// turning this on for a board another machine holds is refused and told which one; `takeOver`
// is the user moving the board to the machine in front of them, on purpose.

export async function setBoardServerAction(on: boolean, takeOver = false): Promise<WriteResult> {
  try {
    return await setBoardServer(!!on, !!takeOver);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Take an interrupted delivery up again on the machine that claimed it. */
export async function resumeCloudRequestAction(eventId: string): Promise<WriteResult> {
  if (typeof eventId !== "string" || !eventId) return { ok: false, error: "that names no event" };
  try {
    return await resumeCloudRequest(eventId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** End it. Whatever it left on the machine that started it stays exactly where it is — which
 *  is why this needs no claim: that machine may be the one that has gone. */
export async function cancelCloudRequestAction(taskId: number, eventId: string): Promise<WriteResult> {
  if (!Number.isInteger(taskId)) return { ok: false, error: "that is not a card" };
  if (typeof eventId !== "string" || !eventId) return { ok: false, error: "that names no event" };
  try {
    return await cancelCloudRequest(taskId, eventId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
