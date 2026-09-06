import { machineCopy } from "./language";
import { boardRules } from "./cli";
import type { AgentView, SpecAgentView, WriteResult } from "./types";

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

// --- the whole team (#420, #422) ---------------------------------------------
// The Agents pane draws everyone working on the board — the roles it ships, the specialists
// the command ships, then the ones this project added — and writes a rule, a template and
// an agent's own `AGENT.md` back. Four moves, one release: a copy of the rules that has the
// roster read has all four, so the pane never draws a grid it cannot save from.

/** Everyone on this board, each with its rule, the memory files it owns, the settings it
 *  declares and — for a project agent — the whole of its `AGENT.md`. `null` on rules older
 *  than the pane, which is what the "too old" note is drawn from. */
export async function agents(): Promise<{ agents: AgentView[]; problems: string[] } | null> {
  const rules = await boardRules();
  return rules.readAgents ? await rules.readAgents() : null;
}

/** Save one agent's rule, or clear it with empty text. Every flow that agent runs reads it,
 *  and a run started from a terminal reads the same words. */
export async function setAgentRule(agent: string, text: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setAgentRule) return { ok: false, error: (await machineCopy()).messages.tooOld.agents };
  return await rules.setAgentRule(agent, text);
}

/** Add a specialist from the board's template. A name already on the roster or already a
 *  folder is refused before anything is written. */
export async function createAgent(name: string): Promise<WriteResult & { agent?: string }> {
  const rules = await boardRules();
  if (!rules.createAgent) return { ok: false, error: (await machineCopy()).messages.tooOld.agents };
  return await rules.createAgent(name);
}

/** Replace one project agent's `AGENT.md`, whole. The board reads the text the way its
 *  catalog reads an agent, so a save it would refuse never reaches the file. */
export async function saveAgentFile(name: string, text: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.saveAgentFile) return { ok: false, error: (await machineCopy()).messages.tooOld.agents };
  return await rules.saveAgentFile(name, text);
}

/** Delete one agent this project added, with the rule, the memory and the settings the
 *  board kept for it. Only a project agent: a role and a bundled agent are the board's. */
export async function deleteAgent(name: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.deleteAgent) return { ok: false, error: (await machineCopy()).messages.tooOld.agents };
  return await rules.deleteAgent(name);
}
