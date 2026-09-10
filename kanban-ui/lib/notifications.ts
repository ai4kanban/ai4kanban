import { boardRules } from "./cli";
import { alertsAllowed, autoWorkAllowed } from "./desktop";
import type { CloudEventAnswer } from "./types";

// --- the notification center (#319) ------------------------------------------
// The bell, and what each board fills it with. Signing in is what turns a board on — the
// rules register it themselves — so nothing here turns one on or off.
//
// Nothing here knows what a Cloud event is made of, where it is stored, or how it reaches
// this machine. That is the board's own rules, so the flow can change with nothing in this
// app touched — the same seam every Cloud move in lib/cloud.ts sits behind.
//
// A board on screen subscribes; a backgrounded server keeps publishing and never does. Each
// connection carries the whole account, so the alerts one hands out are account-wide — and
// only ONE on-screen board may raise them, or a window per board would interrupt once per
// window (#495). `autoWorkAllowed()` says which servers subscribe, `alertsAllowed()` which
// one interrupts; the alerts are taken from the rest either way, so nothing piles up to be
// raised late.
//
// The bell itself is the open board's — the rules hand back its rows and nothing else. The
// account's other boards reach you as system notifications, and clicking one switches the
// app to it.

/** What the section shows when the rules loaded here predate the notification center. The
 *  bell stays away rather than drawing a count nothing can fill. */
const TOO_OLD = "The board's rules in this project are too old for Cloud notifications.";

/** One row of the rail — mirrored from the rules so the browser can name it. */
export interface NotificationRow {
  eventId: string;
  boardId: string;
  /** The workspace this event belongs to (#364). Empty on a Local board's, and absent from
   *  rules that predate the move. */
  workspaceId?: string;
  taskId: number;
  taskTitle: string;
  label: string;
  state: string;
  /** The rail draws this one. Absent from rules that predate the filter, where every row was
   *  drawn — the rail treats that as true rather than emptying itself. */
  onRail?: boolean;
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

/** One scope change, as the line above the rows says it (#451): what is watched now, and how
 *  many cards were already waiting when it moved. */
export interface WatchFill {
  release: string;
  cards: number;
}

export interface NotificationCenter {
  signedIn: boolean;
  enabled: boolean;
  /** This board's own Cloud id — every row below is one of its own. */
  boardId: string;
  release: string;
  silenced: boolean;
  rows: NotificationRow[];
  unread: number;
  alerts: NotificationAlert[];
  /** The scope change that just filled the bell (#451), handed out once. Absent when no
   *  switch brought anything in, and from rules that predate it. */
  filled?: WatchFill;
  error?: string;
  /** How many changes this board gave up on sending to Cloud (#329). Absent from rules that
   *  predate it, which is not the same answer as none. */
  unsent?: number;
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

/** What this board's Cloud section shows: whether notifications are on, how wide they watch,
 *  which releases they could narrow to, and which machine runs their approvals. */
export interface BoardNotifications {
  enabled: boolean;
  release: string;
  releases: string[];
  signedIn: boolean;
  server: BoardServer;
  /** The board lives in a workspace, so the switch and the release are this member's rather
   *  than this machine's (#328) — they follow them wherever they open it. False on a Local
   *  board, and on rules that predate this. */
  shared: boolean;
}

const OFF: NotificationCenter = {
  signedIn: false,
  enabled: false,
  boardId: "",
  release: "",
  silenced: false,
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
  const center = rules.readCloudCenter();
  // Reading took the alerts away wherever this runs; only the one board that interrupts
  // passes them on.
  return alertsAllowed() ? center : { ...center, alerts: [] };
}

/** Opening a row marks it read, and says where to go — the project this board belongs to on
 *  this machine, the board folder inside it, and the card to open. A project can hold more
 *  than one board (#407), so the two are not one answer. Null when the event has gone. */
export async function openNotification(
  eventId: string,
): Promise<{ boardPath: string | null; boardDir: string | null; taskId: number } | null> {
  const rules = await boardRules();
  return rules.openNotification ? rules.openNotification(eventId) : null;
}

/** Mark every row read at once. The rows stay where they are — only the count empties. */
export async function readAllNotifications(): Promise<void> {
  const rules = await boardRules();
  rules.readAllNotifications?.();
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
    return {
      enabled: false,
      release: "",
      releases: [],
      signedIn: false,
      server: NO_SERVER,
      shared: false,
    };
  }
  const state = await rules.readBoardNotifications();
  // Rules that predate the board's server say nothing about one, and the row draws as
  // "no machine runs this" rather than failing to draw the section.
  return { ...state, server: state.server ?? NO_SERVER, shared: state.shared === true };
}

/** Watch a different release — what the rail asks for when the last one closed. */
export async function watchRelease(release: string): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.watchRelease) return { ok: false, error: TOO_OLD };
  return rules.watchRelease(release);
}

/** Be told about a shared board, or not (#328). A Local board has no such switch: signed in
 *  means on there, and the section draws none. */
export async function setBoardNotify(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.setBoardNotify) return { ok: false, error: TOO_OLD };
  return rules.setBoardNotify(on);
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
