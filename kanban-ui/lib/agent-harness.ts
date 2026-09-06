import { boardRules } from "./cli";
import type { WriteResult } from "./types";

// --- which connector each agent runs, through the CLI (#443) -----------------
// Two files, and the split is the whole idea: the PICK is the board's, in
// docs/kanban/ui.config.json, so every checkout runs each agent on the same tool; the MODEL
// is this computer's, in docs/kanban/.local.json, which git never carries.
//
// Both moves are optional on the rules: a project can be running a command older than
// per-agent connectors, and the Agents pane then draws no runtime row rather than one whose
// buttons all fail.

const TOO_OLD =
  "this board's rules are older than per-agent runtimes — run `npm install -g ai4kanban`.";

/** Give one agent a connector of its own, or put it back on the board's default with "". */
export async function setAgentHarness(agent: string, harness: string): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.setAgentHarness ? rules.setAgentHarness(agent, harness) : { ok: false, error: TOO_OLD };
}

/** Save one of an agent's model settings, against the connector it runs right now — so
 *  switching a tool and switching back finds the model where it was left. Never a key: those
 *  stay in docs/kanban/.env, one per connector. */
export async function setAgentSetting(
  agent: string,
  key: string,
  value: string,
): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setLocalAgentValue || !rules.agentHarness) return { ok: false, error: TOO_OLD };
  return rules.setLocalAgentValue(agent, rules.agentHarness(agent).name, key, value);
}
