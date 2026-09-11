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
  runnableAgents,
  runRuntimePick,
  type AgentRequest,
  type CommandRequest,
  buildPrompt,
  prepareAgentRequest,
  settingSaveError,
} from "@/lib/agent";
import {
  boardScreen,
  boardsHere,
  commentOnDraft,
  discardTopic,
  readSolution,
  cardStillThere,
  dropDraftComment,
  newTopic,
  editDraftComment,
  polishDraft,
  refreshBoard,
  readDrafts,
  readGoalText,
  readMetrics,
  readReleases,
  readSetupDraft,
  readSetupState,
  readSignals,
  repurposeChannel,
  saveDraft,
  searchCards,
  setChannels,
  setChannelStatus,
  signalsOpen,
  triageAfterAdding,
  addToInbox,
  dismissSignal,
} from "@/lib/board";
import {
  feedbackDiagnostics,
  feedbackOffered,
  searchArchived,
  sendFeedback,
} from "@/lib/feedback";
import {
  type ChatRead,
  addChatImage,
  clearChat,
  dropChatImage,
  pickChatRuntime,
  readChat,
  sendChat,
  stopChat,
} from "@/lib/chat";
import {
  addRunPicture,
  createImageAgents,
  dropRunPicture,
  emptyRunBox,
} from "@/lib/create-pictures";
import { canDiscuss, DISCUSS_GUIDE, noteAnswer, planningStarted, planToPlanFrom, readDiscuss } from "@/lib/discuss";
import {
  archiveDiscussion,
  asDiscussion,
  listDiscussions,
  startDiscussion,
} from "@/lib/discussions";
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
import {
  addWorkspaceMember,
  commitCloudChange,
  deleteWorkspace,
  exportWorkspace,
  leaveWorkspace,
  removeWorkspaceMember,
  removeWorkspaceNode,
  renameWorkspace,
  renameWorkspaceNode,
  setWorkspaceMemberRole,
  workspaceId,
  workspaceView,
  type WorkspaceExit,
  type WorkspaceMove,
  type WorkspaceView,
} from "@/lib/workspace";
import { machineCopy, setMachineLanguage } from "@/lib/language";
import {
  recordUsageDisclosure,
  reportAppOpen,
  setUsageReporting,
  usageReporting,
} from "@/lib/telemetry";
import { setAgentRuntime } from "@/lib/agent-harness";
import {
  boardNotifications,
  cancelCloudRequest,
  notificationCenter,
  openNotification,
  readAllNotifications,
  recordCloudAction,
  resumeCloudRequest,
  setBoardNotify,
  setBoardServer,
  setSilenced,
  watchRelease,
  type BoardNotifications,
  type NotificationCenter,
} from "@/lib/notifications";
import {
  autoCommitAllowed,
  diffApprovalRequired,
  memoryPrune,
  setAutoCommit,
  setDiffApproval,
  setHarness,
  setHarnessSetting,
  setMemoryPrune,
  setSilenceMinutes,
  silenceMinutes,
} from "@/lib/config";
import { ensureDispatcher } from "@/lib/dispatcher";
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
import { type BoardEntry } from "@/lib/cli";
import {
  addRuntime,
  deleteRuntime,
  renameRuntime,
  setRuntimeHarness,
  setRuntimeSecret,
  setRuntimeSetting,
} from "@/lib/runtimes";
import { setHarnessSecret } from "@/lib/secrets";
import { commandState, installSkill, skillState, UNKNOWN_SKILL } from "@/lib/skill";
import {
  agents as boardAgents,
  createAgent,
  deleteAgent,
  saveAgentFile,
  setAgentRule,
  setSpecAgentEnabled,
  setSpecAgentSetting,
  specAgentProblems,
  specAgents,
} from "@/lib/agents";
import { testConnection } from "@/lib/test-connection";
import { isLanguage } from "@/lib/types";
import type {
  AgentInfo,
  AgentView,
  ArchivedCard,
  BoardScreen,
  CardDrafts,
  CardPatch,
  CardRef,
  ChannelStatus,
  ChatTarget,
  CloudAccount,
  CloudEventAnswer,
  CloudMove,
  ClosePlan,
  CommandState,
  CommentBatch,
  ConnectionTest,
  CreateImageAgents,
  DiscussionRow,
  DiscussionTarget,
  DiscussRead,
  DropPlan,
  FeedbackDiagnostics,
  FeedbackSent,
  FeedbackToSend,
  FillPlan,
  HarnessOption,
  Language,
  LarkChat,
  LarkCloud,
  LarkState,
  LoggedOutAgent,
  MemoryPruneSchedule,
  MemberRoleWire,
  MetricsResult,
  PlanAnswer,
  RunPick,
  SaveProjectResult,
  SessionView,
  SetupDraft,
  SkillInstall,
  SkillState,
  SlackConversation,
  SlackState,
  SpecAgentView,
  TopicResult,
  UsageReporting,
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

/** Which board this window is showing, and every board its project holds (#407) — what the
 *  folder chip's badge draws itself from. */
export async function getBoardsAction(): Promise<{ board: string; boards: BoardEntry[] }> {
  return boardsHere();
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

// create touches no existing card — it makes one — so it carries no `id`, and every other
// action needs one. plan-release is the second: it moves and writes many cards, and names a
// release instead. A setup run is the third and names nothing at all: the checklist is what
// it works from. A changelog run is the fourth, and names a version too — the one it writes
// up.
const CARDLESS = new Set(["create", "plan-release", "changelog", "setup"]);

// Of those, the ones a marketing board has not (#435). Refused rather than left off the set
// above, because which board this is is only known once it has been read.
const GONE_ON_MARKETING = new Set(["refine", "resolve", "plan-release", "changelog", "implement"]);

// Start an agent and return immediately with a sessionId (or a lock message). The request
// never waits for the child — the client polls listSessionsAction() to see the session's
// progress and outcome.
export async function startAgentAction(req: CommandRequest & CloudDecision): Promise<StartResult> {
  // A tab left open across the upgrade that made refine the loop still posts the old name.
  if (req && (req.action as string) === "auto-refine") req = { ...req, action: "refine" };
  if (!req || !ACTIONS.has(req.action)) throw new Error("unknown action");
  // The five a marketing board has no place for (#435): its cards carry no questions to
  // sharpen or answer, it plans no versions, and a topic's source is the user's own words
  // rather than something an agent drafts. The CLI refuses them too — this is so a button
  // that could never work never reaches one.
  if (GONE_ON_MARKETING.has(req.action) && (await readSolution()) === "marketing") {
    throw new Error(`a marketing board has no ${req.action}`);
  }
  // A plan is never named from the browser (#427, #481): the file a run is pointed at is the
  // board's own to say, and `startPlanningAction` and `startPlanBuildAction` above read it
  // server-side. Anything sent here naming one is dropped rather than followed.
  if (req.plan) req = { ...req, plan: undefined };
  // **Build now** is the one implement with no card (#428): the typed sentence is the whole
  // requirement, so it stands in for the id an implement usually names.
  const buildNow = req.action === "implement" && !!req.description?.trim();
  if (!CARDLESS.has(req.action) && !buildNow && !Number.isInteger(req.id)) {
    throw new Error("action needs a card id");
  }
  if (req.action === "plan-release" && !req.release?.trim()) {
    throw new Error("planning a release needs a version id");
  }
  if (req.action === "changelog" && !req.release?.trim()) {
    throw new Error("a changelog needs a version id");
  }
  const { cloudRevision, cloudAnswers, ...request } = req;
  // **Review again** is the one review a person clicks for, so it says so (#417). Every
  // other review a delivery takes is started by the board, never through here.
  if (request.action === "review") request.trigger = "asked";
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

/** What the create sheet's two runs would go on (#518): the runtime Add task's own agent
 *  and Build now's own agent are set to, and the whole list either can be pointed at
 *  instead. Read once when the sheet opens — the pick is never remembered, so there is
 *  nothing here to write back. Null on rules with no picker behind them.
 *
 *  Keyed by the sheet's own mode names, so the sheet reads the mode it is on. */
export async function createRuntimePicksAction(): Promise<{ card: RunPick; build: RunPick } | null> {
  const [card, build] = await Promise.all([runRuntimePick("create"), runRuntimePick("implement")]);
  return card && build ? { card, build } : null;
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

/** A card id, a discussion (#496), or null for the board's own conversation. Anything else
 *  is not a chat this board has.
 *
 *  A discussion is checked against the board rather than against a shape written here, so a
 *  string from a browser can only ever name a conversation this board itself wrote. */
async function chatTarget(cardId: unknown): Promise<ChatTarget | undefined> {
  if (cardId === null) return null;
  if (typeof cardId === "string") return (await asDiscussion(cardId)) ?? undefined;
  return typeof cardId === "number" && Number.isInteger(cardId) ? cardId : undefined;
}

export async function readChatAction(cardId: ChatTarget): Promise<ChatRead> {
  const target = await chatTarget(cardId);
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
      seesImages: false,
      imagesAble: [],
      missing: false,
      pick: null,
      blocked: "that is not a card on this board.",
    };
  }
  return readChat(target);
}

/** `discuss` says the message was sent from the Discuss screen (#427), which puts the flow
 *  in front of it. Which flow that is is settled here rather than sent: nothing from a
 *  browser names a topic that reaches a prompt. */
export async function sendChatAction(
  cardId: ChatTarget,
  message: string,
  discuss = false,
  /** The pictures pasted into this message (#441), by the names `addChatImageAction` filed
   *  them under. A message that is nothing but pictures is a message. */
  images: string[] = [],
  /** The create sheet's box those pictures are still in (#530) — the send is what moves
   *  them into this conversation's folder. Left out by the rail, whose box IS this
   *  conversation's. */
  box?: string,
): Promise<{ ok: boolean; error?: string }> {
  const target = await chatTarget(cardId);
  if (target === undefined) return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  const names = Array.isArray(images) ? images.filter((n): n is string => typeof n === "string") : [];
  if (typeof message !== "string" || (!message.trim() && names.length === 0)) {
    return { ok: false, error: (await machineCopy()).messages.actions.emptyChat };
  }
  return sendChat(target, message.trim(), {
    guide: discuss ? DISCUSS_GUIDE : undefined,
    images: names,
    box: names.length && typeof box === "string" ? box : undefined,
  });
}

/** Save one picture pasted into the box (#441). It is written before the message is sent —
 *  the thumbnail in the box IS the file — so a paste that can't be saved says so straight
 *  away rather than failing the send later.
 *
 *  It takes a `FormData` because that is how a browser hands bytes to a server action; what
 *  comes back is the name the picture is filed under, and nothing else ever names a path. */
export async function addChatImageAction(
  cardId: ChatTarget,
  form: FormData,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const target = await chatTarget(cardId);
  if (target === undefined) return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  const file = form.get("image");
  if (!(file instanceof Blob)) return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  return addChatImage(target, new Uint8Array(await file.arrayBuffer()), file.type);
}

/** Take one picture back out of the box. Quiet on a name this conversation never held. */
export async function dropChatImageAction(cardId: ChatTarget, name: string): Promise<{ ok: boolean }> {
  const target = await chatTarget(cardId);
  if (target === undefined || typeof name !== "string") return { ok: false };
  await dropChatImage(target, name);
  return { ok: true };
}

// ---- the pictures pasted into the create sheet (#517) -----------------------
//
// The same shape as a conversation's, one box along: they are written as they are pasted,
// and the run that starts takes the box as its own folder beside its log. A `box` is a uuid
// the sheet minted when it opened — the command checks its shape, so nothing a browser sends
// can name a folder outside the board's own.

/** Save one picture pasted into Add task or Build now. */
export async function addRunPictureAction(
  box: string,
  form: FormData,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const file = form.get("image");
  if (typeof box !== "string" || !(file instanceof Blob)) {
    return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  }
  return addRunPicture(box, new Uint8Array(await file.arrayBuffer()), file.type);
}

/** Take one picture back out of the box before it is sent. */
export async function dropRunPictureAction(box: string, name: string): Promise<{ ok: boolean }> {
  if (typeof box !== "string" || typeof name !== "string") return { ok: false };
  await dropRunPicture(box, name);
  return { ok: true };
}

/** The sheet was closed without sending: nothing it was pasted into is left behind. */
export async function emptyRunBoxAction(box: string): Promise<{ ok: boolean }> {
  if (typeof box !== "string") return { ok: false };
  await emptyRunBox(box);
  return { ok: true };
}

/** What each of the sheet's two run modes can do with a picture — what a paste in Add task
 *  or Build now is turned away by, before any file is written. */
export async function createImageAgentsAction(): Promise<CreateImageAgents> {
  return createImageAgents();
}

/** End the reply being written, keeping what arrived. Quiet when there is none: a reply
 *  that has already landed is not an error to have tried to stop. */
export async function stopChatAction(cardId: ChatTarget): Promise<{ ok: boolean; error?: string }> {
  const target = await chatTarget(cardId);
  if (target === undefined) return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  return stopChat(target);
}

export async function clearChatAction(cardId: ChatTarget): Promise<{ ok: boolean; error?: string }> {
  const target = await chatTarget(cardId);
  if (target === undefined) return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  return clearChat(target);
}

/** Point this conversation at a runtime (#272, #467) — `null` for the board's. A row on
 *  another CLI starts the conversation over, because the session belongs to the CLI that
 *  opened it; one on the same CLI carries it on. */
export async function pickChatRuntimeAction(
  cardId: ChatTarget,
  runtime: string | null,
): Promise<{ ok: boolean; cleared?: boolean; restarted?: boolean; error?: string }> {
  const target = await chatTarget(cardId);
  if (target === undefined) return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  if (runtime !== null && typeof runtime !== "string") {
    return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  }
  return pickChatRuntime(target, runtime);
}

// ---- the discussions this board is holding (#496) ---------------------------
//
// A board holds many at once. The rail lists them, Create task opens a new one on every
// press, and a row's menu takes one out of the list.

export async function listDiscussionsAction(): Promise<DiscussionRow[]> {
  return listDiscussions();
}

/** Open a discussion — what Create task presses. Nothing is written until the first message,
 *  so opening the sheet and closing it again leaves no row behind. */
export async function startDiscussionAction(): Promise<DiscussionTarget | null> {
  return startDiscussion();
}

/** Take one discussion out of the list. Its transcript stays on this machine. */
export async function archiveDiscussionAction(target: string): Promise<{ ok: boolean; error?: string }> {
  const named = await asDiscussion(target);
  if (!named) return { ok: false, error: (await machineCopy()).messages.actions.noSuchCard };
  return archiveDiscussion(named);
}

// ---- Discuss (#427) ---------------------------------------------------------
//
// The Discuss screen is one discussion's conversation with the plan it is writing beside it.
// Four moves: read that plan, record an answer the user pressed, and hand the plan to one of
// the two runs its answers start — the one that writes its cards, or the one that writes a
// single card from it and builds it (#481).

export async function readDiscussAction(discussion: string | null = null): Promise<DiscussRead & { supported: boolean }> {
  const target = await chatTarget(discussion);
  const [read, supported] = await Promise.all([readDiscuss(target ?? null), canDiscuss()]);
  return { ...read, supported };
}

/** One of the three answers, pressed. Written into the transcript as the user's own words,
 *  with no turn behind it — the board is what acts on it. */
export async function noteDiscussAnswerAction(text: string, discussion: string | null = null): Promise<void> {
  if (typeof text !== "string" || !text.trim()) return;
  await noteAnswer(text.trim(), (await chatTarget(discussion)) ?? null);
}

/**
 * Start planning: the run that turns the plan into cards.
 *
 * The plan's path is read here rather than taken from the browser — the path reaches a
 * prompt, and the only file this may ever point at is the one the board's own conversation
 * says it is writing. `release` is what the board was showing, so the cards land in it like
 * a card written by Add task.
 */
export async function startPlanningAction(release?: string, discussion: string | null = null): Promise<StartResult> {
  return startFromPlan("create", "plan", release, discussion);
}

/**
 * Build now under the plan handoff (#481): the Create sheet's own Build now, pointed at the plan
 * instead of a typed sentence — one run writes a card from it and builds it, refining nothing
 * and reviewing nothing.
 *
 * The plan is read here for the same reason Start planning reads it here: the path reaches a
 * prompt, and the only file this may ever point at is the one the board's own conversation
 * says it is writing.
 */
export async function startPlanBuildAction(release?: string, discussion: string | null = null): Promise<StartResult> {
  return startFromPlan("implement", "build", release, discussion);
}

async function startFromPlan(
  action: "create" | "implement",
  answer: PlanAnswer,
  release?: string,
  discussion: string | null = null,
): Promise<StartResult> {
  // Which discussion's plan is the board's own to say: the browser names the discussion, and
  // the path is read here — so the only file a run may ever be pointed at is the one that
  // discussion says it is writing (#496).
  const target = (await chatTarget(discussion)) ?? null;
  const plan = await planToPlanFrom(target);
  if (!plan) return { ok: false, error: (await machineCopy()).messages.actions.noPlan };
  const request = await prepareAgentRequest({
    action,
    plan,
    release: typeof release === "string" && release.trim() ? release.trim() : undefined,
  });
  const started = await startSession(request, await buildPrompt(request));
  if (started.ok && started.sessionId) await planningStarted(started.sessionId, answer, target);
  return started;
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

// Leaving the goal for later IS an answer to setup's goal step (#437): the box is ticked and
// `goal.md` stays empty. Nothing after the goal is planned from it any more, so a step left
// open would only park the flow on a screen the user has already walked past — and hold up
// the run that finishes setup.
export async function skipSetupGoalAction(): Promise<WriteResult> {
  return finishSetupStep("goal");
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

// Save the project, and tick setup's `project` box.
export async function saveSetupProjectAction(
  name: string,
  description: string,
): Promise<SaveProjectResult> {
  if (typeof name !== "string" || typeof description !== "string") {
    return { ok: false, error: "the project is saved as text" };
  }
  return saveProject(name, description);
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
// One refusal, and it is here rather than in the button, which is drawn from a board read
// that can be a poll behind: a board someone else has already finished setting up. An
// unwritten goal is no longer a second one (#437) — the steps left read the repository, so
// a board whose goal nobody wrote finishes setup like any other. The board being busy with
// another setup run is the CLI's refusal, in the one place that sees every run.
export async function startSetupRunAction(): Promise<StartResult> {
  let setup: Awaited<ReturnType<typeof readSetupState>>;
  try {
    setup = await readSetupState();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (!setup) return { ok: false, error: "this board is already set up" };
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

// ---- a marketing card's drafts (#411) ---------------------------------------
//
// The four the drafts block acts through. Each is a thin pass to the CLI, which owns every
// rule about them: which names a draft may go by, whether this card chose that channel,
// whether `source.md` is there to repurpose from.

// Which drafts this topic has, each one whole. Asked on each open and on tab focus, so a
// draft a repurpose has just written lands in the pane with nothing to poll.
export async function readDraftsAction(id: number): Promise<CardDrafts> {
  if (!Number.isInteger(id)) return { dir: "", drafts: [], error: "drafts are read by card number" };
  return readDrafts(id);
}

// Save the draft on screen. Explicit — the pane has a Save — and last write wins: a draft
// held open in an editor as well loses whichever save landed second, which is what the pane
// says when it re-reads and finds the file moved.
export async function saveDraftAction(id: number, name: string, text: string): Promise<CardDrafts> {
  if (!Number.isInteger(id)) return { dir: "", drafts: [], error: "a draft is saved by card number" };
  if (typeof name !== "string" || !name) return { dir: "", drafts: [], error: "a draft is named" };
  if (typeof text !== "string") return { dir: "", drafts: [], error: "a draft is text" };
  return saveDraft(id, name, text);
}

// Repurpose the topic's source into one channel's draft — the CLI's `channel` command, so
// the button gets every check a terminal gets. `again` is the answer to a draft that is
// already written, which the pane asks for rather than refusing. `ask` is the note and the
// language typed with this one repurpose (#457); both are optional and neither is stored.
export async function repurposeChannelAction(
  id: number,
  channel: string,
  again = false,
  ask: { note?: string; language?: string } = {},
): Promise<{ ok: boolean; sessionId?: string; error?: string; kind?: string }> {
  if (!Number.isInteger(id)) return { ok: false, error: "a repurpose names the topic by number" };
  if (typeof channel !== "string" || !channel) return { ok: false, error: "a repurpose names a channel" };
  const note = typeof ask?.note === "string" ? ask.note.trim() : "";
  const language = typeof ask?.language === "string" ? ask.language.trim() : "";
  return repurposeChannel(id, channel, again === true, {
    note: note || undefined,
    language: language || undefined,
  });
}

// Mark one channel published and record where the piece went up (#411). It posts nothing:
// until #413 lands the piece is still posted by hand, and this is the board catching up
// with what the user did. The URL is required, so every published channel has a link for
// `memory/published.md` to key on.
export async function setChannelStatusAction(
  id: number,
  channel: string,
  status: ChannelStatus,
  url = "",
): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(id)) return { ok: false, error: "a channel is moved by card number" };
  if (typeof channel !== "string" || !channel) return { ok: false, error: "a channel is named" };
  if (typeof status !== "string" || !status) return { ok: false, error: "a channel moves to a status" };
  return setChannelStatus(id, channel, status, typeof url === "string" ? url : "");
}

// New topic (#507) — the marketing board's Create. It writes one blank card and answers with
// its id, which is the page the press lands on. No agent: a topic nobody has written yet has
// nothing to ask one, so this is a board write like any other and it is over by the time the
// router moves.
export async function newTopicAction(): Promise<TopicResult> {
  return newTopic();
}

// Discard the topic on screen (#507) — the `…` menu's own item, and the only thing that takes
// a blank one off the board. It is a press and never a timer, so nothing here is automatic.
export async function discardTopicAction(id: number): Promise<TopicResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "a topic is discarded by card number" };
  return discardTopic(id);
}

// Choose the channels this topic goes to (#434) — the card page's `+`, which
// appends one to the list the card already carries. Reused from `update --channels`, so a
// channel that stays keeps its status and the URL it was published at.
export async function setChannelsAction(id: number, names: string[]): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(id)) return { ok: false, error: "channels are chosen by card number" };
  if (!Array.isArray(names) || names.some((n) => typeof n !== "string")) {
    return { ok: false, error: "the channels are a list of names" };
  }
  return setChannels(id, names);
}

// The comments left on one draft (#458). A comment is saved on its passage rather than
// sent, so a whole read-through goes to one polish instead of costing a rewrite per remark.
// Each write answers with that draft's batch as it now reads.
export async function commentOnDraftAction(
  id: number,
  draft: string,
  passage: { quote: string; context: string; at: number; words: string },
): Promise<CommentBatch> {
  if (!Number.isInteger(id)) return { comments: [], error: "a comment is left by card number" };
  if (typeof draft !== "string" || !draft) return { comments: [], error: "a comment is left on a named draft" };
  const quote = typeof passage?.quote === "string" ? passage.quote : "";
  const words = typeof passage?.words === "string" ? passage.words : "";
  if (!quote) return { comments: [], error: "a comment is left on a passage" };
  if (!words.trim()) return { comments: [], error: "a comment says what to do with the passage" };
  // A context that does not hold its own passage says nothing about where it sat, so the
  // passage stands alone rather than anchoring off a string it is not in.
  const given = typeof passage?.context === "string" ? passage.context : "";
  const at = Number.isInteger(passage?.at) ? passage.at : 0;
  const held = given.slice(at, at + quote.length) === quote;
  return commentOnDraft(id, draft, { quote, context: held ? given : quote, at: held ? at : 0, words });
}

export async function editDraftCommentAction(
  id: number,
  draft: string,
  commentId: string,
  words: string,
): Promise<CommentBatch> {
  if (!Number.isInteger(id)) return { comments: [], error: "a comment is edited by card number" };
  if (typeof draft !== "string" || !draft) return { comments: [], error: "a comment is left on a named draft" };
  if (typeof commentId !== "string" || !commentId) return { comments: [], error: "a comment is named" };
  if (typeof words !== "string" || !words.trim()) {
    return { comments: [], error: "a comment says what to do with the passage" };
  }
  return editDraftComment(id, draft, commentId, words);
}

export async function dropDraftCommentAction(id: number, draft: string, commentId: string): Promise<CommentBatch> {
  if (!Number.isInteger(id)) return { comments: [], error: "a comment is dropped by card number" };
  if (typeof draft !== "string" || !draft) return { comments: [], error: "a comment is left on a named draft" };
  if (typeof commentId !== "string" || !commentId) return { comments: [], error: "a comment is named" };
  return dropDraftComment(id, draft, commentId);
}

// Submit the batch — one `polish` run over that one draft. The board clears the comments
// when the run ends `done`, so a run that failed leaves them to submit again.
export async function polishDraftAction(
  id: number,
  draft: string,
  note?: string,
): Promise<{ ok: boolean; sessionId?: string; error?: string; kind?: string }> {
  if (!Number.isInteger(id)) return { ok: false, error: "a polish names the topic by number" };
  if (typeof draft !== "string" || !draft) return { ok: false, error: "a polish names a draft" };
  return polishDraft(id, draft, typeof note === "string" ? note.trim() || undefined : undefined);
}

// The daily progress view (#65) — the last 30 days of docs/kanban/metrics.csv. Read once
// each time the view opens; the file changes a few times a day at most, so there's nothing
// to poll. A file that can't be read comes back as { ok:false, error }, so the message
// survives to the client instead of becoming a server-render error.
export async function getMetricsAction(): Promise<MetricsResult> {
  return readMetrics();
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

// --- the memory pruner (#514) ------------------------------------------------
// Its page reads the schedule when the Agents pane opens, saves the opt-in and the cadence
// through the same file the switches above are in, and starts one pass by hand.
//
// Rules older than the pruner answer `null` rather than a schedule, and the page draws Run
// now without the recurrence chip — never a control whose save could only fail.
export async function memoryPruneAction(): Promise<{
  schedule: MemoryPruneSchedule | null;
  error?: string;
}> {
  try {
    return { schedule: await memoryPrune() };
  } catch (e) {
    return { schedule: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function setMemoryPruneAction(next: {
  enabled: boolean;
  cadence: string;
}): Promise<WriteResult> {
  if (typeof next?.enabled !== "boolean" || typeof next?.cadence !== "string") {
    return { ok: false, error: "a prune schedule is saved as an opt-in and a cadence" };
  }
  try {
    return await setMemoryPrune(next);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Start one prune by hand — **Run now** on the pruner's page. It names no card: the memory
 *  set is the whole job. A second pass while one is going is refused by the run record's own
 *  one-at-a-time rule, so the button never has to know. */
export async function startPruneMemoryAction(): Promise<StartResult> {
  const req: AgentRequest = { action: "prune-memory" };
  return startSession(req, await buildPrompt(req));
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
// Schedule, Resolve, a chat and `akb card implement` all start exactly as before, so
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

// The agents this machine could run right now (#404) — installed, and wanting no setting
// nobody has filled in. The first run asks for this before it draws anything, then tests them
// one at a time in this order and stops at the first that answers.
//
// It spawns nothing and it is the same fresh PATH read `installedAgentsAction` makes, so it
// costs what that costs. Nothing to read comes back empty, which is a first run that opens on
// the picker exactly as it did before this existed.
export async function runnableAgentsAction(): Promise<string[]> {
  try {
    return await runnableAgents();
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
export async function setHarnessSettingAction(
  key: string,
  value: string,
  harness?: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a setting is saved as text" };
  }
  const on = { harness: typeof harness === "string" && harness ? harness : undefined };
  const setting = (await activeSettings(on)).find((s) => s.key === key);
  if (!setting) return { ok: false, error: `that connector has no "${key}" setting` };
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
  const wrong = await settingSaveError(key, next, on);
  if (wrong) return { ok: false, error: wrong };
  return withAgent(() => setHarnessSetting(key, next, on.harness));
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
export async function setHarnessSecretAction(
  key: string,
  value: string,
  harness?: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a key is saved as text" };
  }
  const on = { harness: typeof harness === "string" && harness ? harness : undefined };
  const setting = (await activeSettings(on)).find((s) => s.key === key);
  if (!setting || setting.kind !== "secret" || !setting.env) {
    return { ok: false, error: `that connector has no "${key}" key` };
  }
  // Onto that runtime's own line, never the bare variable: a run reads the id-scoped one, so
  // a key written under the setting's plain name would be a key nothing uses (#467).
  return withAgent(() => setHarnessSecret({ key, env: setting.env! }, value, on.harness));
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
export async function testConnectionAction(harness?: string): Promise<ConnectionTest> {
  // Named a connector, it spawns that one (#443) — the row the button is on, never the
  // board's default.
  return testConnection(typeof harness === "string" && harness ? harness : undefined);
}

// --- which connector each agent runs (#443) -----------------------------------
// Configuration → Agents. The PICK is the board's, in docs/kanban/ui.config.json, so every
// checkout runs each agent on the same tool; the MODEL under it is this computer's, in
// docs/kanban/.local.json. Every write goes through the CLI, so a terminal `akb agent` and
// this pane are one writer with one set of rules.

/** Point one agent at a runtime, or back at Global default with "". The id is checked against
 *  the board's own list, so a stale client can't save one nothing answers to. */
export async function setAgentRuntimeAction(
  agent: string,
  runtime: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof agent !== "string" || !agent || typeof runtime !== "string") {
    return { ok: false, error: "an agent and a runtime are saved as text" };
  }
  if (runtime) {
    const info = await agentInfo().catch(() => null);
    // The runtimes this board has are the CLI's list, not a copy kept here.
    if (!info?.runtimes.some((r) => r.id === runtime)) {
      return { ok: false, error: `unknown runtime "${runtime}"` };
    }
  }
  return withAgent(() => setAgentRuntime(agent, runtime));
}

// --- the board's runtimes (#468) ----------------------------------------------
// Configuration → Runtimes is the list, and these are its six writes. Every one goes through
// the command's own writers, so a runtime added, renamed or deleted in a terminal and one
// changed here are the same move with the same rules — including the delete that takes the
// row's key off this computer.
//
// Each answers with the whole setting as it now reads, because none of them is a change the
// pane can work out for itself: an add mints an id, a harness switch drops the settings the
// new one doesn't declare, and a delete moves every agent that named the row.

/** Add a runtime on the harness named. The name is the board's to judge — empty or already
 *  another row's comes back as the refusal the row shows. */
export async function addRuntimeAction(
  name: string,
  harness: string,
): Promise<WriteResult & { id?: string; agent?: AgentInfo }> {
  if (typeof name !== "string" || typeof harness !== "string" || !harness) {
    return { ok: false, error: "a runtime is added by name and harness" };
  }
  // The harnesses this build runs are the CLI's list, not a copy kept here.
  const known = await agentInfo().catch(() => null);
  if (!known?.options.some((o) => o.name === harness)) {
    return { ok: false, error: `unknown harness "${harness}"` };
  }
  try {
    const res = await addRuntime(name.trim(), harness);
    if (!res.ok) return res;
    return { ok: true, id: res.id, agent: await agentInfo().catch(() => undefined) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** New words for one row. Global default is refused by the command, which is the one place
 *  that rule lives. */
export async function renameRuntimeAction(
  id: string,
  name: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof id !== "string" || !id || typeof name !== "string") {
    return { ok: false, error: "a runtime is renamed by id and name" };
  }
  return withAgent(() => renameRuntime(id, name.trim()));
}

/** Drop one row. Its key lines in docs/kanban/.env go with it and the agents that named it
 *  fall back to Global default — both the command's own doing, so a delete typed in a
 *  terminal leaves nothing behind either. */
export async function deleteRuntimeAction(
  id: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof id !== "string" || !id) return { ok: false, error: "a runtime is deleted by id" };
  return withAgent(() => deleteRuntime(id));
}

/** Move one row onto another harness. */
export async function setRuntimeHarnessAction(
  id: string,
  harness: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof id !== "string" || !id || typeof harness !== "string" || !harness) {
    return { ok: false, error: "a runtime's harness is saved by id and name" };
  }
  const known = await agentInfo().catch(() => null);
  if (!known?.options.some((o) => o.name === harness)) {
    return { ok: false, error: `unknown harness "${harness}"` };
  }
  return withAgent(() => setRuntimeHarness(id, harness));
}

/** Save one of the settings that row's harness declares — the same checks
 *  `setHarnessSettingAction` makes, asked of this row rather than of a connector's first. */
export async function setRuntimeSettingAction(
  id: string,
  key: string,
  value: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof id !== "string" || !id || typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a runtime setting is saved by id, key and value" };
  }
  const on = { runtime: id };
  const setting = (await activeSettings(on)).find((s) => s.key === key);
  if (!setting) return { ok: false, error: `that runtime has no "${key}" setting` };
  if (setting.kind === "secret") {
    return { ok: false, error: `"${setting.label}" is a key — it saves to docs/kanban/.env` };
  }
  const next = value.trim();
  if (setting.kind === "select" && next && !setting.choices?.some((c) => c.value === next)) {
    return { ok: false, error: `"${next}" isn't one of the ${setting.label} choices` };
  }
  const wrong = await settingSaveError(key, next, on);
  if (wrong) return { ok: false, error: wrong };
  return withAgent(() => setRuntimeSetting(id, key, next));
}

/** Save one row's key to docs/kanban/.env, under its own id-scoped line. Nothing comes back
 *  but ok: the value is never returned, echoed or read back into the browser. */
export async function setRuntimeSecretAction(
  id: string,
  key: string,
  value: string,
): Promise<WriteResult & { agent?: AgentInfo }> {
  if (typeof id !== "string" || !id || typeof key !== "string" || typeof value !== "string") {
    return { ok: false, error: "a runtime key is saved by id, key and value" };
  }
  const setting = (await activeSettings({ runtime: id })).find((s) => s.key === key);
  if (!setting || setting.kind !== "secret") {
    return { ok: false, error: `that runtime has no "${key}" key` };
  }
  return withAgent(() => setRuntimeSecret(id, key, value));
}

// One move, and the whole connector setting as it now reads. A failure answers with the
// reason and no setting, so the pane puts the row it moved back exactly as it was.
async function withAgent(
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
export async function specAgentsAction(): Promise<{
  agents: SpecAgentView[] | null;
  /** What is wrong with the agents this board carries — reported, never dropped in silence. */
  problems: string[];
  error?: string;
}> {
  try {
    return { agents: await specAgents(), problems: await specAgentProblems() };
  } catch (e) {
    return { agents: null, problems: [], error: e instanceof Error ? e.message : String(e) };
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

// --- the team (#420, #422) ---------------------------------------------------
// Everyone working on this board, and the three writes the Agents pane makes on them. The
// board owns every check — which names it answers to, which clash, and whether an
// `AGENT.md` reads — so these only say when, and turn a failure into a value the pane can
// show rather than a crash page.

/** The roster the pane draws its grid and its page from. `agents` is `null` when this
 *  project's rules are older than the pane, so it can say that rather than drawing a grid
 *  it cannot fill. */
export async function agentsAction(): Promise<{
  agents: AgentView[] | null;
  problems: string[];
  error?: string;
}> {
  try {
    const read = await boardAgents();
    return { agents: read?.agents ?? null, problems: read?.problems ?? [] };
  } catch (e) {
    return { agents: null, problems: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Save one agent's rule, or clear it with empty text. The name is checked against the
 *  board's own roster, so a stale client can't write a rule for an agent that isn't there. */
export async function setAgentRuleAction(agent: string, text: string): Promise<WriteResult> {
  if (typeof agent !== "string" || typeof text !== "string") {
    return { ok: false, error: "an agent's rule is saved by name and text" };
  }
  try {
    return await setAgentRule(agent, text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Add a specialist from the board's template. A name already taken is refused before
 *  anything is written, so the pane never creates a clash it would then report. */
export async function createAgentAction(name: string): Promise<WriteResult & { agent?: string }> {
  if (typeof name !== "string") return { ok: false, error: "an agent is created by name" };
  try {
    return await createAgent(name);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Replace one project agent's `AGENT.md`, whole. The board reads the text the way its
 *  catalog reads an agent, so a text it would refuse never reaches the file. */
export async function saveAgentFileAction(name: string, text: string): Promise<WriteResult> {
  if (typeof name !== "string" || typeof text !== "string") {
    return { ok: false, error: "an agent's file is saved by name and text" };
  }
  try {
    return await saveAgentFile(name, text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Delete one project agent, with everything the board kept for it. The board refuses a
 *  role and a bundled agent, so a stale client can't delete what it doesn't own. */
export async function deleteAgentAction(name: string): Promise<WriteResult> {
  if (typeof name !== "string") return { ok: false, error: "an agent is deleted by name" };
  try {
    return await deleteAgent(name);
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

// --- the inbox waiting to be looked at (#453, #499) --------------------------
// The rail asks for the row once when a window opens and again when the window is looked at
// again — never on the board's poll, because whether the inbox is open reaches Cloud. The
// page itself is a server page and reads the inbox directly.

/** Whether to offer the rail row at all, and the count it carries. A board that may not use
 *  the inbox answers `false`, and the row is simply not there. */
export async function signalsRowAction(): Promise<{ show: boolean; count: number }> {
  const access = await signalsOpen();
  if (!access.open) return { show: false, count: 0 };
  try {
    return { show: true, count: (await readSignals()).signals.length };
  } catch {
    return { show: false, count: 0 };
  }
}

/** Add one thing to the inbox by hand (#499): a dropped file, a pasted link, or pasted text.
 *
 *  It takes a `FormData` because that is how a browser hands bytes to a server action. What
 *  it could not take is the rules' own sentence — the reader dropped the thing, so what was
 *  wrong with it is theirs to hear. What it took answers with the item's id, so the page can
 *  find what it just added among a few hundred others (#560).
 *
 *  The access check is the page's: this address is only reachable from a page that already
 *  answered it, and asking again would reach Cloud on every add. */
export async function addToInboxAction(
  form: FormData,
): Promise<{ ok: boolean; error?: string; sourceId?: string }> {
  const c = await machineCopy();
  try {
    const typed = form.get("text");
    const dropped = form.get("file");
    const name = form.get("name");
    const file =
      dropped instanceof Blob
        ? {
            name: typeof name === "string" && name ? name : "file",
            type: dropped.type,
            data: new Uint8Array(await dropped.arrayBuffer()),
          }
        : undefined;
    const done = await addToInbox({ text: typeof typed === "string" ? typed : undefined, file });
    if (!done.ok) return { ok: false, error: done.error };
    // And the sort over it, when the triager is switched on (#562). Awaited so the spawn is
    // out before this action returns, never reported: the item is in triage either way.
    await triageAfterAdding(1);
    return { ok: true, sourceId: done.signal.sourceId };
  } catch {
    return { ok: false, error: c.rail.signals.add.failed };
  }
}

/** Ignore one signal for good: its file moves into `triage/dismissed/` and stays there. There
 *  is no undo on the page — pasting the link in again is the only way back (#559). */
export async function dismissSignalAction(sourceId: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof sourceId !== "string" || !sourceId) {
    return { ok: false, error: (await machineCopy()).rail.signals.dismissFailed };
  }
  try {
    return await dismissSignal(sourceId);
  } catch {
    return { ok: false, error: (await machineCopy()).rail.signals.dismissFailed };
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

// --- the workspace a Cloud board lives in (#317) -----------------------------
// Configuration → Workspace: the board's name, the machines allowed to run its work, the
// export, leaving Cloud and the deletion. Asked when the pane opens and after every press in
// it, never on the board's poll — every one of these reaches the service.

/** Whether this checkout points at a workspace, so the dialog knows whether to offer the
 *  Workspace pane at all. The pointer alone, and no network: a Local board has no workspace
 *  to run, and a Cloud board whose workspace this machine cannot read still needs the pane
 *  — leaving Cloud is one of the two ways out of a stranded checkout. */
export async function hasWorkspaceAction(): Promise<boolean> {
  try {
    return (await workspaceId()) !== "";
  } catch {
    return false;
  }
}

export async function workspaceViewAction(): Promise<WorkspaceView> {
  try {
    return await workspaceView();
  } catch (e) {
    return {
      workspaceId: "",
      name: "",
      nodes: [],
      members: [],
      owner: false,
      change: null,
      error: failed(e),
      stranded: false,
    };
  }
}

export async function renameWorkspaceAction(name: string): Promise<WorkspaceMove> {
  if (typeof name !== "string" || !name.trim()) return { ok: false, error: "Name it something." };
  try {
    return await renameWorkspace(name.trim());
  } catch (e) {
    return { ok: false, error: failed(e) };
  }
}

export async function renameWorkspaceNodeAction(nodeId: string, name: string): Promise<WorkspaceMove> {
  if (!nodeId || typeof name !== "string" || !name.trim()) return { ok: false, error: "Name it something." };
  try {
    return await renameWorkspaceNode(nodeId, name.trim());
  } catch (e) {
    return { ok: false, error: failed(e) };
  }
}

export async function removeWorkspaceNodeAction(nodeId: string): Promise<WorkspaceMove> {
  if (!nodeId) return { ok: false, error: "No machine was named." };
  try {
    return await removeWorkspaceNode(nodeId);
  } catch (e) {
    return { ok: false, error: failed(e) };
  }
}

/** Which handles Cloud will take is Cloud's — it answers every one it cannot resolve with
 *  one sentence, so nothing here guesses at whether a person has an account (#376). */
export async function addWorkspaceMemberAction(handle: string, role: MemberRoleWire): Promise<WorkspaceMove> {
  const named = typeof handle === "string" ? handle.trim().replace(/^@/, "") : "";
  if (!named) return { ok: false, error: "Type the GitHub handle to add." };
  try {
    return await addWorkspaceMember(named, role);
  } catch (e) {
    return { ok: false, error: failed(e) };
  }
}

export async function removeWorkspaceMemberAction(accountId: string): Promise<WorkspaceMove> {
  if (!accountId) return { ok: false, error: "No member was named." };
  try {
    return await removeWorkspaceMember(accountId);
  } catch (e) {
    return { ok: false, error: failed(e) };
  }
}

export async function setWorkspaceMemberRoleAction(accountId: string, role: MemberRoleWire): Promise<WorkspaceMove> {
  if (!accountId) return { ok: false, error: "No member was named." };
  try {
    return await setWorkspaceMemberRole(accountId, role);
  } catch (e) {
    return { ok: false, error: failed(e) };
  }
}

export async function exportWorkspaceAction(dir: string): Promise<WorkspaceMove> {
  if (typeof dir !== "string" || !dir) return { ok: false, error: "No folder was named." };
  try {
    return await exportWorkspace(dir);
  } catch (e) {
    return { ok: false, error: failed(e) };
  }
}

/** `force` is a checkout whose workspace this machine cannot read — deleted, or another
 *  account's. There is nothing to write back, so leaving is only taking the pointer off. */
export async function leaveWorkspaceAction(force = false): Promise<WorkspaceExit> {
  try {
    return await leaveWorkspace(force === true);
  } catch (e) {
    return { ok: false, error: failed(e) };
  }
}

export async function deleteWorkspaceAction(): Promise<WorkspaceExit> {
  try {
    return await deleteWorkspace();
  } catch (e) {
    return { ok: false, error: failed(e) };
  }
}

/** Take the offered commit — the board files entering or leaving git, the pointer and the
 *  `.gitignore` block, and nothing else the working tree holds. */
export async function commitCloudChangeAction(kind: "go" | "leave"): Promise<WorkspaceMove> {
  if (kind !== "go" && kind !== "leave") return { ok: false, error: "No change was named." };
  try {
    return await commitCloudChange(kind);
  } catch (e) {
    return { ok: false, error: failed(e) };
  }
}

const failed = (e: unknown): string => (e instanceof Error ? e.message : String(e));

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

// --- optional usage reporting (#293) -----------------------------------------
// One answer for this MACHINE, held outside every repository. The disclosure step is drawn
// from the value the page read on the server; these three are what the step and the
// Privacy row in Configuration → General call.

export async function usageReportingAction(): Promise<UsageReporting | null> {
  try {
    return await usageReporting();
  } catch {
    return null;
  }
}

export async function setUsageReportingAction(on: boolean): Promise<WriteResult> {
  try {
    return await setUsageReporting(on === true);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Continue on the disclosure step: the setting as it was shown, and the record that it
 *  was shown, in one write — and then, when the answer was yes, the launch that answer was
 *  given on, which is the one open the rules cannot count for themselves (#295). */
export async function recordUsageDisclosureAction(on: boolean): Promise<WriteResult> {
  try {
    const saved = await recordUsageDisclosure(on === true);
    if (saved.ok && on) await reportAppOpen().catch(() => undefined);
    return saved;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- feedback on a landed task (#603) ----------------------------------------
// Three asks, answered one at a time: which archived card this is about, what that card has
// to attach, and the send itself. Nothing here decides anything — every authorisation is a
// tick on the screen, and this layer only refuses a request whose shape is wrong.

export async function feedbackOfferedAction(): Promise<boolean> {
  try {
    return await feedbackOffered();
  } catch {
    return false;
  }
}

/** Archived cards matching what is typed — by number or by a word in the title. The search
 *  runs here for the reason the card search does: no page holds the archive to search.
 *
 *  An archive that would not read is answered as a failure, never as an empty one: "nothing
 *  matches" and "the board could not be read" are different things to tell a reader, and the
 *  second is worth a Try again. */
export async function searchArchivedAction(
  query: string,
): Promise<{ ok: true; cards: ArchivedCard[] } | { ok: false }> {
  if (typeof query !== "string") return { ok: true, cards: [] };
  try {
    return { ok: true, cards: await searchArchived(query) };
  } catch {
    return { ok: false };
  }
}

/** What one archived card has to attach, listed before the second authorisation is given.
 *  Null is "nothing to offer" — an older board's rules, or a card with no diagnostics at
 *  all — and the screen leaves the attachment rows out rather than showing empty ones. */
export async function feedbackDiagnosticsAction(cardId: number): Promise<FeedbackDiagnostics | null> {
  if (!Number.isInteger(cardId)) return null;
  try {
    return await feedbackDiagnostics(cardId);
  } catch {
    return null;
  }
}

/** Send one piece of feedback. Whatever comes back, the task it was written beside is
 *  already created — a failure here reaches nothing but the sentence itself. */
export async function sendFeedbackAction(feedback: FeedbackToSend): Promise<FeedbackSent> {
  if (!feedback || typeof feedback.text !== "string" || !feedback.text.trim()) {
    return { ok: false, reason: "empty" };
  }
  if (feedback.source !== "task" && feedback.source !== "board") return { ok: false, reason: "refused" };
  try {
    return await sendFeedback(feedback);
  } catch {
    return { ok: false, reason: "unreachable" };
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
      rows: [],
      unread: 0,
      alerts: [],
      unavailable: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Opening a row marks it read and says where to go: the project this board belongs to on
 *  this machine, the board folder inside it (#407), and the card to open. A board no longer
 *  here answers with a null path, and the rail says so rather than switching to it. */
export async function openNotificationAction(
  eventId: string,
): Promise<{ boardPath: string | null; boardDir: string | null; taskId: number } | null> {
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
      server: { attached: false, here: false, machineName: "", thisMachine: "" },
      shared: false,
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

/** Be told about a shared board, or not (#328). Their own switch, inside the workspace. */
export async function setBoardNotifyAction(on: boolean): Promise<WriteResult> {
  try {
    return await setBoardNotify(!!on);
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
