import { boardRules } from "./cli";
import { autoWorkAllowed } from "./desktop";
import type { CloudEventAnswer } from "./types";

// --- the notification center (#319) ------------------------------------------
// The bell, and the per-board switch that fills it.
//
// Nothing here knows what a Cloud event is made of, where it is stored, or how it reaches
// this machine. That is the board's own rules, so the flow can change with nothing in this
// app touched — the same seam every Cloud move in lib/cloud.ts sits behind.
//
// One connection however many boards are enabled, and it belongs to the board server the
// window is showing: `autoWorkAllowed()` is already the app's answer to "is this the board
// on screen", so a backgrounded server keeps publishing and never subscribes. A
// subscription in each would raise one event's notification several times over.

/** What the section shows when the rules loaded here predate the notification center. The
 *  bell stays away rather than drawing a count nothing can fill. */
const TOO_OLD = "The board's rules in this project are too old for Cloud notifications.";

/** One row of the rail — mirrored from the rules so the browser can name it. */
export interface NotificationRow {
  eventId: string;
  boardId: string;
  boardName: string;
  boardHere: boolean;
  taskId: number;
  taskTitle: string;
  label: string;
  state: string;
  unread: boolean;
  changedAt: string;
}

/** One interruption the app is being asked to raise. */
export interface NotificationAlert {
  eventId: string;
  boardId: string;
  taskId: number;
  title: string;
  body: string;
  kind: "actionable" | "outcome";
}

export interface NotificationCenter {
  signedIn: boolean;
  enabled: boolean;
  /** This board's own Cloud id — what a card page matches its own event on. */
  boardId: string;
  release: string;
  silenced: boolean;
  namesBoards: boolean;
  rows: NotificationRow[];
  unread: number;
  alerts: NotificationAlert[];
  error?: string;
  /** This board has no copy of the rules that can draw a bell. */
  unavailable?: string;
}

/** Which machine runs a board's work (#318). A board attaches exactly one server, and an
 *  approval taken anywhere else runs there and nowhere else. */
export interface BoardServer {
  attached: boolean;
  here: boolean;
  machineName: string;
  thisMachine: string;
}

/** What this board's Cloud section shows: whether notifications are on, which release they
 *  watch, which ones they could, and which machine runs their approvals. */
export interface BoardNotifications {
  enabled: boolean;
  release: string;
  releases: string[];
  signedIn: boolean;
  server: BoardServer;
}

const OFF: NotificationCenter = {
  signedIn: false,
  enabled: false,
  boardId: "",
  release: "",
  silenced: false,
  namesBoards: false,
  rows: [],
  unread: 0,
  alerts: [],
  unavailable: TOO_OLD,
};

/** The bell as it stands, and the alerts waiting to be raised. Reading takes the alerts
 *  away: they are raised once or not at all, and nothing is raised later to make up for a
 *  window that was focused when one arrived. */
export async function notificationCenter(): Promise<NotificationCenter> {
  const rules = await boardRules();
  if (!rules.readCloudCenter || !rules.startCloudCenter) return OFF;
  // Idempotent, and the one place the connection is opened: every screen polls this.
  rules.startCloudCenter(autoWorkAllowed());
  return rules.readCloudCenter();
}

/** Opening a row marks it read, and says where to go — the board's own path on this
 *  machine, and the card to open in it. Null when the event has gone. */
export async function openNotification(
  eventId: string,
): Promise<{ boardPath: string | null; taskId: number } | null> {
  const rules = await boardRules();
  return rules.openNotification ? rules.openNotification(eventId) : null;
}

/** Stop every board's system notifications while the bell keeps filling. One switch for the
 *  machine, beside the sign-in: the interruptions it stops arrive from every enabled board. */
export async function setSilenced(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.setNotificationsSilenced) return { ok: false, error: TOO_OLD };
  return rules.setNotificationsSilenced(on);
}

// --- this board's own switch --------------------------------------------------

export async function boardNotifications(): Promise<BoardNotifications> {
  const rules = await boardRules();
  if (!rules.readBoardNotifications) {
    return { enabled: false, release: "", releases: [], signedIn: false, server: NO_SERVER };
  }
  const state = await rules.readBoardNotifications();
  // Rules that predate the board's server say nothing about one, and the row draws as
  // "no machine runs this" rather than failing to draw the section.
  return { ...state, server: state.server ?? NO_SERVER };
}

/** Turn them on, watching one open release. The bell fills with what this board is already
 *  holding actionable, and nothing is raised for any of it. */
export async function enableNotifications(release: string): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.enableBoardNotifications) return { ok: false, error: TOO_OLD };
  return rules.enableBoardNotifications(release);
}

/** Watch a different release — what the rail asks for when the last one closed. */
export async function watchRelease(release: string): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.watchRelease) return { ok: false, error: TOO_OLD };
  return rules.watchRelease(release);
}

/** Turn them off. This board's live events are retired first. */
export async function disableNotifications(): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.disableBoardNotifications) return { ok: false, error: TOO_OLD };
  return rules.disableBoardNotifications();
}

// --- this board's server (#318) -----------------------------------------------

const NO_SERVER: BoardServer = { attached: false, here: false, machineName: "", thisMachine: "" };

/** Run this board's approvals on this machine, or stop. `takeOver` is the user moving the
 *  board to the machine in front of them — without it a board another machine holds is
 *  refused and told which one. */
export async function setBoardServer(on: boolean, takeOver = false): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.setBoardServer) return { ok: false, error: TOO_OLD };
  return rules.setBoardServer(on, takeOver);
}

/** Take up a delivery whose server was killed under it, on the machine that claimed it. */
export async function resumeCloudRequest(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.resumeCloudRequest) return { ok: false, error: TOO_OLD };
  return rules.resumeCloudRequest(eventId);
}

/** End it instead. Whatever it left on this machine stays exactly where it is. */
export async function cancelCloudRequest(
  taskId: number,
  eventId: string,
): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.cancelCloudRequest) return { ok: false, error: TOO_OLD };
  return rules.cancelCloudRequest(taskId, eventId);
}

/** Record the one durable action a live event carries, from a click on this machine. It
 *  never blocks the click: the board's own outbox retries it. */
export async function recordCloudAction(
  taskId: number,
  decision: "implement" | "answer",
  revision: string,
  answers: CloudEventAnswer[],
): Promise<void> {
  const rules = await boardRules();
  rules.recordCloudActionFor?.(taskId, decision, revision, answers);
}
