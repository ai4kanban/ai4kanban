// How the board decides which card to start next, and how a column orders one track's band.
//
// The rules are NOT here. They are `cli/src/lib/view/rules.ts`, copied to
// ./format/view/rules.ts by scripts/sync-format.mjs, so a column and `akb list` put the
// same card on top. This file is the name the UI imports them under — and the reason it
// exists at all is that the client needs them, so they must not come from a module that
// reads the filesystem. Fix them in cli/src/lib/view/.

export { byPickOrder, byQueueOrder } from "./format/view/rules";
