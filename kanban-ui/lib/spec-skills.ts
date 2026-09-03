import { machineCopy } from "./language";
import { boardRules } from "./cli";
import type { SpecSkillView, WriteResult } from "./types";

// --- the spec skills (#191, #403) --------------------------------------------
// A spec skill fills one part of a card's spec — the screen it changes, the library it
// picks — in a run of its own, while the card is being planned. The Agents section in the
// Configuration dialog lists them and switches them on or off.
//
// Nothing here knows a skill's name, what it fills in, or when the board calls it. That is
// the board's own list, read out of each skill's SKILL.md, and asking for it is what keeps
// `akb spec` and this section from ever saying different things — and what puts a skill the
// project added into both.

/** Every spec skill this board has, in the board's order, with both of its lines and
 *  whether it is switched on. Rules older than the release that added the switches answer
 *  nothing at all, and the section says so rather than drawing an empty list. */
export async function specSkills(): Promise<SpecSkillView[] | null> {
  const rules = await boardRules();
  return rules.readSpecSkills ? rules.readSpecSkills() : null;
}

/** Why a skill on this board can't be used — a malformed SKILL.md, a name already taken.
 *  Empty on rules that predate project skills, which is the same answer as "none". */
export async function specSkillProblems(): Promise<string[]> {
  const rules = await boardRules();
  return rules.specSkillProblems ? rules.specSkillProblems() : [];
}

/** Switch one skill on or off, saved with the board so everyone working on it reads the
 *  same switch — and so a flow run from a terminal reads it too. */
export async function setSpecSkillEnabled(name: string, on: boolean): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setSpecSkillEnabled) {
    return { ok: false, error: (await machineCopy()).messages.tooOld.specSkillSwitch };
  }
  return rules.setSpecSkillEnabled(name, on);
}

/** Save one of the settings a skill declares (#257) — which skill, which setting, and which
 *  of its choices. The command checks all three against the skills this board has, so a
 *  stale screen can't write a setting no skill has. Saved with the board like the switch, so
 *  a run started from a terminal reads the same answer. */
export async function setSpecSkillSetting(name: string, key: string, value: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setSpecSkillSetting) {
    return { ok: false, error: (await machineCopy()).messages.tooOld.specSkillSetting };
  }
  return rules.setSpecSkillSetting(name, key, value);
}
