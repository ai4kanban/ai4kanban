import { boardRules } from "./cli";
import type { WriteResult } from "./types";

// --- which runtime each agent runs, through the CLI (#467) -------------------
// A runtime is the whole answer to what a run runs as — harness, provider, endpoint, key,
// model id, reasoning, extra arguments — and the pick is the board's, in
// docs/kanban/ui.config.json, so every checkout runs each agent as the same thing. What a
// runtime IS gets set up in Configuration → Runtimes; this is only the pick.
//
// The move is optional on the rules: a project can be running a command older than named
// runtimes, and the Agents pane then draws no runtime row rather than one whose picker fails.

const TOO_OLD =
  "this board's rules are older than named runtimes — run `npm install -g ai4kanban`.";

/** Point one agent at a runtime, or back at Global default with "". */
export async function setAgentRuntime(agent: string, runtime: string): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.setAgentRuntime ? rules.setAgentRuntime(agent, runtime) : { ok: false, error: TOO_OLD };
}
