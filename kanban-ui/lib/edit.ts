import { getCopy } from "@/i18n";
import { boardRules } from "./cli";
import { DEFAULT_LANGUAGE } from "./types";
import type { CardPatch, SaveProjectResult, WriteResult } from "./types";

// --- writing the board, through the CLI (#169) -------------------------------
// Every change a button makes: a card's fields and body, the project and its tracks, a setup
// box ticked. Each one is the CLI's own move — the same code `akb` runs —
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

/** Apply a direct edit to one card.
 *
 *  `expect` is the revision the page read the card at (#316). A card rewritten under an
 *  open page — by a run here, or by another machine on a Cloud board — comes back as a
 *  conflict and NOTHING is written, so the page re-reads that one card and says what moved
 *  rather than overwriting somebody else's words. */
export async function patchCard(id: number, patch: CardPatch, expect = ""): Promise<WriteResult> {
  try {
    return await (await boardRules()).patchCard(id, patch, expect ? { expect } : undefined);
  } catch (e) {
    return refused(e);
  }
}

// Read at load, so English: rules this old may not be able to say what language to use.
const ENGLISH = getCopy(DEFAULT_LANGUAGE).messages.rules;
const OLD_RULES: WriteResult = {
  ok: false,
  error: `${ENGLISH.tooOldForSkip} ${ENGLISH.updateIt}`,
};

/** Skip one of the user's questions on a card, or reopen it (#831). Named by its text. */
export async function skipQuestion(id: number, question: string, skipped: boolean, expect = ""): Promise<WriteResult> {
  try {
    const rules = await boardRules();
    const opts = expect ? { expect } : undefined;
    return rules.skipQuestion ? await rules.skipQuestion(id, question, skipped, opts) : OLD_RULES;
  } catch (e) {
    return refused(e);
  }
}

/** Schedule an action on a blocked card, so the board runs it by itself once the last card
 *  in its way leaves the board. A card that isn't waiting on anything, or an action that
 *  wouldn't move it, refuses with the line saying why. */
export async function setSchedule(
  id: number,
  action: string,
  notes = "",
  expect = "",
): Promise<WriteResult> {
  try {
    return await (await boardRules()).setSchedule(id, action, notes, expect ? { expect } : undefined);
  } catch (e) {
    return refused(e);
  }
}

/** Take a card's schedule off. Nothing fires after this. */
export async function clearSchedule(id: number, expect = ""): Promise<WriteResult> {
  try {
    return await (await boardRules()).clearSchedule(id, expect ? { expect } : undefined);
  } catch (e) {
    return refused(e);
  }
}

/** Save what the project is and what tracks its work falls into — setup's `project` step,
 *  folders and board index included. */
export async function saveProject(name: string, description: string): Promise<SaveProjectResult> {
  try {
    return await (await boardRules()).saveProject(name, description);
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
