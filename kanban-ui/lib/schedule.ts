// What a blocked card is waiting to run (#140), as the screens read it: whether this card
// can be scheduled for an action at all, and the one line saying what will run and what it
// waits for.
//
// The rules are NOT here. They are `cli/src/lib/view/rules.ts`, copied to
// ./format/view/rules.ts by scripts/sync-format.mjs — the dialog runs them in the browser
// and the dispatcher runs them in the CLI, and they are the same functions. Fix them in
// cli/src/lib/view/.

export { scheduleLabel, scheduleRefusal } from "./format/view/rules";
export type { CardSchedule, ScheduledAction } from "./format/view/types";
