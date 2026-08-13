// Would a refine on this card actually move it? The one rule behind both ways a refine
// starts — the refine that follows a run, and the Refine button on a card page — so the
// button can never offer a run that arrives, finds nothing to do, and leaves the card
// exactly as it was.
//
// The rule is NOT here. It is `cli/src/lib/view/rules.ts`, copied to ./format/view/rules.ts
// by scripts/sync-format.mjs — the button runs it in the browser, the follow-up runs it in
// the CLI, and they are the same function. Fix it in cli/src/lib/view/.

export { canRefine } from "./format/view/rules";
