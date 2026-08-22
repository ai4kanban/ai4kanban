import { boardRules } from "./cli";
import type { SpecAgentView, WriteResult } from "./types";

// --- the spec agents (#191) --------------------------------------------------
// A spec agent fills one part of a card's spec — the screen it changes, the library it
// picks — in a run of its own, while the card is being planned. The Agents section in the
// Configuration dialog lists them and switches them on or off.
//
// Nothing here knows an agent's name, what it fills in, or which card the board calls it
// for. That is the board's own list, and asking for it is what keeps `akb spec` and this
// section from ever saying different things.

/** Every spec agent this board ships, in the board's order, with both of its lines and
 *  whether it is switched on. Rules older than the release that added the switches answer
 *  nothing at all, and the section says so rather than drawing an empty list. */
export async function specAgents(): Promise<SpecAgentView[] | null> {
  const rules = await boardRules();
  return rules.readSpecAgents ? rules.readSpecAgents() : null;
}

/** Switch one agent on or off, saved with the board so everyone working on it reads the
 *  same switch — and so a flow run from a terminal reads it too. */
export async function setSpecAgentEnabled(name: string, on: boolean): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setSpecAgentEnabled) {
    return { ok: false, error: "the board's rules in this project are too old to switch a spec agent" };
  }
  return rules.setSpecAgentEnabled(name, on);
}

/** Save one of the settings an agent declares (#257) — which agent, which setting, and
 *  which of its choices. The command checks all three against the agents this board ships,
 *  so a stale screen can't write a setting no agent has. Saved with the board like the
 *  switch, so a run started from a terminal reads the same answer. */
export async function setSpecAgentSetting(name: string, key: string, value: string): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setSpecAgentSetting) {
    return { ok: false, error: "the board's rules in this project are too old to set a spec agent" };
  }
  return rules.setSpecAgentSetting(name, key, value);
}
