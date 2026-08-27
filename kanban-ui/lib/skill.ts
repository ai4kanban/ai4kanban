import { copy } from "@/i18n";
import { boardRules } from "./cli";
import type { CommandState, SkillInstall, SkillState } from "./types";

// --- the coding agent skill (#174) -------------------------------------------
// Getting a board no longer brings the skill with it: a board is scaffolded on its own, and
// driving it from Claude Code or Codex is an extra, added from the Configuration dialog's
// Skill section. This is the door onto the move that adds it.
//
// Nothing here knows what a skill folder holds. It asks the board's own rules, which is
// what lets that change — where the files live, what is in them — without this screen ever
// hearing about it.

/** What the panel shows when the rules loaded here are older than the release that added
 *  the skill move. The section says so and offers the command instead of a dead button. */
export const UNKNOWN_SKILL: SkillState = {
  version: "",
  folders: [],
  installed: false,
  outdated: false,
};

/** Whether a coding agent can drive this board, folder by folder, and how current each
 *  copy is. Reads files only. */
export async function skillState(): Promise<SkillState> {
  const rules = await boardRules();
  return rules.readSkillState ? rules.readSkillState() : UNKNOWN_SKILL;
}

/** The `akb` on this machine's PATH against the copy this board runs on. Spawns a process,
 *  so it is asked for when the panel opens and never on the board's poll. */
export async function commandState(): Promise<CommandState | null> {
  const rules = await boardRules();
  return rules.readCommandState ? rules.readCommandState() : null;
}

/** Add the skill to this project, or bring an older copy up to date. Writes files in the
 *  project and nothing else — no global install, no command replaced. */
export async function installSkill(): Promise<SkillInstall> {
  const rules = await boardRules();
  if (!rules.installSkill) {
    return {
      ok: false,
      error: copy.messages.tooOld.skillInstall,
      wrote: [],
      skipped: [],
      state: UNKNOWN_SKILL,
    };
  }
  return rules.installSkill();
}
