// Would a refine — or a build — on this card actually move it? The one rule behind every way
// each of them starts: the refine that follows a run, the Refine and Implement buttons on a
// card page, and the schedule that queues either of them on a blocked card. A button can
// never offer a run that arrives, finds nothing to do, and leaves the card exactly as it was.
//
// The rule is NOT here. It is `cli/src/lib/view/rules.ts`, copied to ./format/view/rules.ts
// by scripts/sync-format.mjs — the button runs it in the browser, the follow-up runs it in
// the CLI, and they are the same function. Fix it in cli/src/lib/view/.

export { canImplement, canRefine } from "./format/view/rules";
