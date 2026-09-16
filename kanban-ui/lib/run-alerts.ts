// A run that stopped short, as the notification rail draws it (#809).
//
// The rail used to be Cloud's alone: no account, no rows, and a board that had never signed
// in drew a signed-out end where the list goes. But a run breaking on this machine is this
// machine's own event — it owes nothing to an account, a workspace or a watched release —
// and it is exactly the kind of thing the rail exists for. So it fills the same list,
// through the same shape a Cloud event fills it with.
//
// What is kept on the machine is small and is kept in the browser: which of these rows have
// been read, and which have already interrupted somebody. Neither belongs to the board — the
// run record is the board's, and it says nothing about whether a person has looked at it.

import type { NotificationAlert, NotificationRow } from "./notifications";
import { unhandledFlows, type RunFlow } from "./run-flows";

/** What marks a rail row as this module's rather than Cloud's. A Cloud event id is opaque,
 *  so the prefix is what tells the two apart wherever they are mixed. */
const PREFIX = "run:";

export const isRunRow = (eventId: string): boolean => eventId.startsWith(PREFIX);

/** The job one of these rows is about. */
export const runRowFlow = (eventId: string): string => eventId.slice(PREFIX.length);

/** The rows the rail draws for the jobs that stopped short and are still waiting on somebody.
 *
 *  `label` is the app's own word for it, not the board's: every other row on the rail carries
 *  a sentence `akb` wrote, and this one has no event behind it to have written one.
 *
 *  `state` is `failed` so the rail's own grouping puts it under **To do** and the bell counts
 *  it — the same call that decides where a delivery that did not land goes, for the same
 *  reason. */
export function runRows(
  flows: RunFlow[],
  label: string,
  read: ReadonlySet<string>,
): NotificationRow[] {
  return unhandledFlows(flows).map((flow) => ({
    eventId: PREFIX + flow.id,
    boardId: "",
    taskId: flow.cardId!,
    taskTitle: flow.latest.cardTitle ?? "",
    label,
    state: "failed",
    onRail: true,
    unread: !read.has(flow.id),
    changedAt: new Date(flow.latest.endedAt ?? flow.latest.startedAt).toISOString(),
  }));
}

/** The interruption one of those rows is worth raising, worded the way the rest of them are:
 *  the card it is about, then what happened to it. */
export function runAlert(row: NotificationRow, body: string): NotificationAlert {
  return {
    eventId: row.eventId,
    boardId: row.boardId,
    taskId: row.taskId,
    title: `#${row.taskId} ${row.taskTitle}`.trim(),
    body,
    kind: "outcome",
  };
}

// --- what this machine remembers about them -----------------------------------
//
// Two sets of job ids, in the browser's own storage: the ones that have been read, and the
// ones that have already interrupted somebody. They are separate answers — marking the rail
// read must not un-raise a notification, and a notification raised must not mark a row read.
//
// Both are pruned to the jobs still on the rail on every write, so neither grows with a board
// that has been open for months.

const READ_KEY = "kanban-ui.run-rows.read";
const RAISED_KEY = "kanban-ui.run-rows.raised";

export const readRunRows = (): Set<string> => load(READ_KEY);
export const raisedRunRows = (): Set<string> => load(RAISED_KEY);

export const keepReadRunRows = (ids: Iterable<string>, live: ReadonlySet<string>): void =>
  save(READ_KEY, ids, live);
export const keepRaisedRunRows = (ids: Iterable<string>, live: ReadonlySet<string>): void =>
  save(RAISED_KEY, ids, live);

function load(key: string): Set<string> {
  try {
    const held: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(held) ? held.filter((x): x is string => typeof x === "string") : []);
  } catch {
    // storage unavailable, or something else wrote nonsense there — every row reads as new,
    // which is the safe way round: the rail says too much rather than too little.
    return new Set();
  }
}

function save(key: string, ids: Iterable<string>, live: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids].filter((id) => live.has(id))));
  } catch {
    // storage unavailable — the marks last as long as the window does
  }
}
