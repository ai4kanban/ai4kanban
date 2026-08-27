import { copy } from "@/i18n";
import { boardRules } from "./cli";
import type {
  BulkReleaseResult,
  CardPatch,
  ClosePlan,
  DropPlan,
  FillPlan,
  SaveProjectResult,
  TrackDraft,
  VerifyResult,
  WriteResult,
} from "./types";

// --- writing the board, through the CLI (#169) -------------------------------
// Every change a button makes: a card's fields and body, a bulk move into a release, a
// release opened, given a goal, closed or dropped, the project goal, the project and its
// tracks, a setup box ticked. Each one is the CLI's own move — the same code `akb` runs —
// so a card edited from a screen and a card edited from a terminal come out identical.
//
// Two things they all share, and both belong to the CLI rather than to this file: a write
// waits its turn behind whatever an agent is writing at that moment, and a refusal comes
// back as `{ ok:false, error }` instead of throwing, so the dialog can say why and stay
// open on what the user typed.
//
// A board with no copy of the rules refuses the same way, with the line that names the fix.

const refused = (e: unknown): WriteResult => ({
  ok: false,
  error: e instanceof Error ? e.message : String(e),
});

/** Apply a direct edit to one card. */
export async function patchCard(id: number, patch: CardPatch): Promise<WriteResult> {
  try {
    return await (await boardRules()).patchCard(id, patch);
  } catch (e) {
    return refused(e);
  }
}

/** Add one hand-check to a card, or cross one off (#276). Both answer with the list as the
 *  card now holds it, so the panel redraws from what was written — including a cross-off
 *  refused because a run had already taken that line off. Rules older than this say so in
 *  the line that names the update. */
const OLD_RULES: WriteResult = {
  ok: false,
  error: `${copy.messages.rules.tooOldForHandChecks} ${copy.messages.rules.updateIt}`,
};

export async function addVerify(id: number, line: string): Promise<VerifyResult> {
  try {
    const rules = await boardRules();
    return rules.addVerify ? await rules.addVerify(id, line) : OLD_RULES;
  } catch (e) {
    return refused(e);
  }
}

export async function dropVerify(id: number, line: string): Promise<VerifyResult> {
  try {
    const rules = await boardRules();
    return rules.dropVerify ? await rules.dropVerify(id, line) : OLD_RULES;
  } catch (e) {
    return refused(e);
  }
}

/** Schedule an action on a blocked card, so the board runs it by itself once the last card
 *  in its way leaves the board. A card that isn't waiting on anything, or an action that
 *  wouldn't move it, refuses with the line saying why. */
export async function setSchedule(id: number, action: string, notes = ""): Promise<WriteResult> {
  try {
    return await (await boardRules()).setSchedule(id, action, notes);
  } catch (e) {
    return refused(e);
  }
}

/** Take a card's schedule off. Nothing fires after this. */
export async function clearSchedule(id: number): Promise<WriteResult> {
  try {
    return await (await boardRules()).clearSchedule(id);
  } catch (e) {
    return refused(e);
  }
}

/** Move the ticked cards into one release, or back out of one. A release the list doesn't
 *  hold refuses the whole move before anything is written; a card that can't be moved on
 *  its own comes back in `failed` while the rest go through. */
export async function setCardsRelease(ids: number[], release: string): Promise<BulkReleaseResult> {
  try {
    return await (await boardRules()).setCardsRelease(ids, release);
  } catch (e) {
    return { moved: 0, failed: [], error: refused(e).error };
  }
}

/** Start a release. `fill` asks for it to be filled as it is made; which way that happens
 *  is the CLI's call — a release with a goal is planned against it by an agent, one without
 *  takes the plain rule there and then — and the answer says which, so the caller knows
 *  whether a run still has to be started. */
export async function newRelease(
  id: string,
  goal = "",
  fill = false,
): Promise<WriteResult & { fill?: "none" | "fill" | "agent" }> {
  try {
    return await (await boardRules()).newRelease(id, goal, fill);
  } catch (e) {
    return refused(e);
  }
}

/** Change what a release is for, after it was made. An empty goal clears it. */
export async function setReleaseGoal(id: string, goal: string): Promise<WriteResult> {
  try {
    return await (await boardRules()).setReleaseGoal(id, goal);
  } catch (e) {
    return refused(e);
  }
}

/** Close a shipped release. `shipped` is how many cards it counted, so the caller knows
 *  whether a changelog run has anything to write (#232). */
export async function closeRelease(id: string): Promise<WriteResult & { shipped?: number }> {
  try {
    return await (await boardRules()).closeRelease(id);
  } catch (e) {
    return refused(e);
  }
}

/** Give up on a release. */
export async function dropRelease(id: string): Promise<WriteResult> {
  try {
    return await (await boardRules()).dropRelease(id);
  } catch (e) {
    return refused(e);
  }
}

/** Save the project goal, which is also setup's goal step. */
export async function saveGoal(text: string): Promise<WriteResult> {
  try {
    return await (await boardRules()).saveGoal(text);
  } catch (e) {
    return refused(e);
  }
}

/** Save what the project is and what tracks its work falls into — setup's `project` step,
 *  folders and board index included. */
export async function saveProject(
  name: string,
  description: string,
  tracks: TrackDraft[],
): Promise<SaveProjectResult> {
  try {
    return await (await boardRules()).saveProject(name, description, tracks);
  } catch (e) {
    return refused(e);
  }
}

/** Tick one setup box by name. */
export async function finishSetupStep(name: string): Promise<WriteResult> {
  try {
    return await (await boardRules()).finishSetupStep(name);
  } catch (e) {
    return refused(e);
  }
}

// ---- what a release move would do, before it does it ------------------------
// Read as a dialog opens, so the user sees the move before anything is changed. A board
// with no rules to read gives an empty plan; the move itself is what says why.

export async function fillPlan(): Promise<FillPlan> {
  try {
    return await (await boardRules()).fillPlan();
  } catch {
    return { fill: [], skipped: [] };
  }
}

export async function closePlan(id: string): Promise<ClosePlan> {
  try {
    return await (await boardRules()).closePlan(id);
  } catch {
    return { left: [], shipped: 0 };
  }
}

export async function dropPlan(id: string): Promise<DropPlan> {
  try {
    return await (await boardRules()).dropPlan(id);
  } catch {
    return { archived: [], left: [] };
  }
}
