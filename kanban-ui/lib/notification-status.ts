// The state a notification is in, in the app's own language (#952).
//
// The rules word every state in English when they build a row (`eventLabel`), because the
// board and its server have no reader to write for. The app does: the rail, its rows and the
// system notification it raises all follow Configuration → Language, and a row whose title
// and time are in one language and whose state is in another reads as half-translated.
//
// So the English word is a fallback rather than the answer. A row carrying `kind` came from
// rules new enough to say what the card is asking, and is worded here; anything else — an
// older copy of the rules, or a row the app built itself for a run that stopped short
// (lib/run-alerts.ts) — keeps the words it arrived with.

import type { NotificationsCopy } from "@/i18n/notifications/types";
import type { NotificationAlert, NotificationRow } from "./notifications";

/** The state under a row's title, and the sentence its system notification says. */
export function statusLabel(row: Pick<NotificationRow, "label" | "state" | "kind">, c: NotificationsCopy): string {
  if (!row.kind) return row.label;
  const s = c.status;
  switch (row.state) {
    case "actionable":
      return row.kind === "question" ? s.question : s.readyForReview;
    case "accepted":
      return s.accepted;
    case "waiting_for_server":
      return s.waitingForServer;
    case "running":
      return s.running;
    case "completed":
      return s.completed;
    case "failed":
      return s.failed;
    case "cancelled":
      return s.cancelled;
    case "interrupted":
      return s.interrupted;
    case "stale":
      return s.stale;
    default:
      return row.label;
  }
}

/**
 * The same states, said out loud: the interruptions the app is about to raise, reworded from
 * the row each one is about.
 *
 * The rules hand out the alerts and the rows in one answer, and an alert is only ever raised
 * for an event that has a row, so the row is what carries the state to word. An alert with no
 * row behind it keeps the words it came with.
 */
export function wordedAlerts(
  alerts: NotificationAlert[],
  rows: NotificationRow[],
  c: NotificationsCopy,
): NotificationAlert[] {
  const byId = new Map(rows.map((row) => [row.eventId, row]));
  return alerts.map((alert) => {
    const row = byId.get(alert.eventId);
    return row ? { ...alert, body: statusLabel(row, c) } : alert;
  });
}
