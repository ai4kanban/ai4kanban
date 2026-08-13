import { boardRules } from "./cli";
import type {
  BulkReleaseResult,
  CardPatch,
  ClosePlan,
  DropPlan,
  FillPlan,
  SaveProjectResult,
  TrackDraft,
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
    return (await boardRules()).patchCard(id, patch);
  } catch (e) {
    return refused(e);
  }
}

/** Move the ticked cards into one release, or back out of one. A release the list doesn't
 *  hold refuses the whole move before anything is written; a card that can't be moved on
 *  its own comes back in `failed` while the rest go through. */
export async function setCardsRelease(ids: number[], release: string): Promise<BulkReleaseResult> {
  try {
    return (await boardRules()).setCardsRelease(ids, release);
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
    return (await boardRules()).newRelease(id, goal, fill);
  } catch (e) {
    return refused(e);
  }
}

/** Change what a release is for, after it was made. An empty goal clears it. */
export async function setReleaseGoal(id: string, goal: string): Promise<WriteResult> {
  try {
    return (await boardRules()).setReleaseGoal(id, goal);
  } catch (e) {
    return refused(e);
  }
}

/** Close a shipped release. */
export async function closeRelease(id: string): Promise<WriteResult> {
  try {
    return (await boardRules()).closeRelease(id);
  } catch (e) {
    return refused(e);
  }
}

/** Give up on a release. */
export async function dropRelease(id: string): Promise<WriteResult> {
  try {
    return (await boardRules()).dropRelease(id);
  } catch (e) {
    return refused(e);
  }
}

/** Save the project goal, which is also setup's goal step. */
export async function saveGoal(text: string): Promise<WriteResult> {
  try {
    return (await boardRules()).saveGoal(text);
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
    return (await boardRules()).saveProject(name, description, tracks);
  } catch (e) {
    return refused(e);
  }
}

/** Tick one setup box by name. */
export async function finishSetupStep(name: string): Promise<WriteResult> {
  try {
    return (await boardRules()).finishSetupStep(name);
  } catch (e) {
    return refused(e);
  }
}

// ---- what a release move would do, before it does it ------------------------
// Read as a dialog opens, so the user sees the move before anything is changed. A board
// with no rules to read gives an empty plan; the move itself is what says why.

export async function fillPlan(): Promise<FillPlan> {
  try {
    return (await boardRules()).fillPlan();
  } catch {
    return { fill: [], skipped: [] };
  }
}

export async function closePlan(id: string): Promise<ClosePlan> {
  try {
    return (await boardRules()).closePlan(id);
  } catch {
    return { left: [], shipped: 0 };
  }
}

export async function dropPlan(id: string): Promise<DropPlan> {
  try {
    return (await boardRules()).dropPlan(id);
  } catch {
    return { archived: [], left: [] };
  }
}
