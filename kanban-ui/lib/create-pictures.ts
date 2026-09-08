import { boardRules, whyNoRules } from "./cli";
import type { CreateImageAgents } from "./types";

// --- the pictures pasted into the create sheet (#517) ------------------------
//
// The board's door onto the command's own box (cli/src/lib/agent/pictures.ts). A picture is
// written as it is pasted, into a box the sheet holds; the run that starts takes the box as
// its own folder beside its log, so the log prune takes the pictures with it and nothing
// lands in git.
//
// Nothing here takes a path. A box and a file name are the whole of what a browser sends,
// and the command is what turns the two into a file inside a folder the board itself wrote.

/** Nothing this board could take a picture with — no rules, or a copy older than the box. */
const NO_BOX = "this board's command is too old to take a picture. Update it.";

export async function addRunPicture(
  box: string,
  data: Uint8Array,
  type: string,
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  let rules;
  try {
    rules = await boardRules();
  } catch (e) {
    return { ok: false, error: whyNoRules(e) };
  }
  if (!rules.addRunPicture) return { ok: false, error: NO_BOX };
  const saved = rules.addRunPicture(box, data, type);
  return "error" in saved ? { ok: false, error: saved.error } : { ok: true, name: saved.name };
}

/** Take one picture back out of the box before it is sent. Its file goes with it. */
export async function dropRunPicture(box: string, name: string): Promise<void> {
  try {
    (await boardRules()).dropRunPicture?.(box, name);
  } catch {
    // Nothing to read the board with — there is no file of ours to drop either.
  }
}

/** Empty the box: the sheet was closed without sending, so nothing is left behind. */
export async function emptyRunBox(box: string): Promise<void> {
  try {
    (await boardRules()).emptyRunBox?.(box);
  } catch {
    // As above.
  }
}

/** Where one of a box's pictures is on disk, for the one route that serves its bytes. */
export async function runPictureFile(box: string, name: string): Promise<string | null> {
  try {
    return (await boardRules()).runPictureFile?.(box, name) ?? null;
  } catch {
    return null;
  }
}

/** What the sheet's two run modes can do with a picture. A board with no rules to read, or
 *  rules older than the box, sees no pictures at all — so the sheet takes no paste rather
 *  than writing files nothing will ever open. */
export async function createImageAgents(): Promise<CreateImageAgents> {
  const none = { agent: "", seesImages: false, imagesAble: [] };
  try {
    return (await boardRules()).createImageAgents?.() ?? { card: none, build: none };
  } catch {
    return { card: none, build: none };
  }
}
