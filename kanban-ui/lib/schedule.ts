// What a blocked card is waiting to run (#140), as the screens read it: whether this card
// can be scheduled for an action at all, and the one line saying what will run and what it
// waits for.
//
// The rules are NOT here. They are `cli/src/lib/view/rules.ts`, copied to
// ./format/view/rules.ts by scripts/sync-format.mjs — the dialog runs them in the browser
// and the dispatcher runs them in the CLI, and they are the same functions. Fix them in
// cli/src/lib/view/.

import type { ChipsCopy } from "@/i18n/chips/types";
import type { Card } from "./format/view/types";

export { scheduleLabel, scheduleRefusal } from "./format/view/rules";
export type { CardSchedule, ScheduledAction } from "./format/view/types";

/** The same line as `scheduleLabel`, in the interface language (#956). The CLI keeps the
 *  English one; the screens draw this. Card numbers and the `·` separator read the same in
 *  every language. */
export function scheduleMark(card: Card, copy: ChipsCopy): string {
  if (!card.schedule) return "";
  const action = copy.schedule.action[card.schedule.action];
  const waiting = card.openBlockers.map((b) => `#${b.id}`).join(", ");
  return waiting ? copy.schedule.waiting(action, waiting) : copy.schedule.queued(action);
}
