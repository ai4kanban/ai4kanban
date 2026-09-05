import { machineCopy } from "./language";
import { boardRules } from "./cli";
import type { SpecAgentView, WriteResult } from "./types";

// --- the spec agents (#191, #403, #419) --------------------------------------
// A spec agent fills one part of a card's spec — the screen it changes, the library it
// picks — in a run of its own, while the card is being planned. The Agents section in the
// Configuration dialog lists them and switches them on or off.
//
// Nothing here knows an agent's name, what it fills in, or when the board calls it. That is
// the board's own list, read out of each agent's AGENT.md, and asking for it is what keeps
// `akb spec` and this section from ever saying different things — and what puts an agent the
// project added into both.
//
// The four moves on the rules keep the spelling they had when the word was "skill". They
// are the boundary between this app and whatever `akb` the project has, and a UI newer than
// the rules it loads would find nothing under a new name and draw the pane as too old.

/** Every spec agent this board has, in the board's order, with both of its lines and
 *  whether it is switched on. Rules older than the release that added the switches answer
 *  nothing at all, and the section says so rather than drawing an empty list. */
export async function specAgents(): Promise<SpecAgentView[] | null> {
  const rules = await boardRules();
  return rules.readSpecSkills ? rules.readSpecSkills() : null;
}

/** What is wrong with the agents on this board — a malformed AGENT.md, a name already taken,
 *  a folder still where agents used to live. Empty on rules that predate project agents,
 *  which is the same answer as "nothing". */
export async function specAgentProblems(): Promise<string[]> {
  const rules = await boardRules();
  return rules.specSkillProblems ? rules.specSkillProblems() : [];
}

/** Switch one agent on or off, saved with the board so everyone working on it reads the
 *  same switch — and so a flow run from a terminal reads it too. */
export async function setSpecAgentEnabled(name: string, on: boolean): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setSpecSkillEnabled) {
    return { ok: false, error: (await machineCopy()).messages.tooOld.specAgentSwitch };
  }
  return rules.setSpecSkillEnabled(name, on);
}

/** Save one of the settings an agent declares (#257) — which agent, which setting, and which
 *  of its choices. The command checks all three against the agents this board has, so a
 *  stale screen can't write a setting no agent has. Saved with the board like the switch, so
 *  a run started from a terminal reads the same answer. */
export async function setSpecAgentSetting(name: string, key: string, value: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setSpecSkillSetting) {
    return { ok: false, error: (await machineCopy()).messages.tooOld.specAgentSetting };
  }
  return rules.setSpecSkillSetting(name, key, value);
}
