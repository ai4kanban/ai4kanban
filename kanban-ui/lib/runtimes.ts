import { boardRules } from "./cli";
import type { WriteResult } from "./types";

// --- the runtimes, through the CLI (#343, #344) ------------------------------
// One place holds all of it: docs/kanban/ui.config.json, which travels with the repository.
// The board names its runtimes, says which one is global, and says what each one runs as —
// so every checkout runs the same thing and no machine keeps a setting of its own.
//
// Every move is optional on the rules: a project can be running a command older than
// runtimes, and Configuration → Runtimes draws the board's own agent alone rather than a
// pane whose buttons all fail.

const TOO_OLD =
  "this board's rules are older than runtimes — run `npm install -g ai4kanban`.";

export async function addRuntime(name: string): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.addRuntime ? rules.addRuntime(name) : { ok: false, error: TOO_OLD };
}

export async function removeRuntime(name: string): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.removeRuntime ? rules.removeRuntime(name) : { ok: false, error: TOO_OLD };
}

export async function renameRuntime(from: string, to: string): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.renameRuntime ? rules.renameRuntime(from, to) : { ok: false, error: TOO_OLD };
}

export async function setGlobalRuntime(name: string): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.setGlobalRuntime ? rules.setGlobalRuntime(name) : { ok: false, error: TOO_OLD };
}

/** The agent one runtime runs. The global one writes the board's own `harness`; every other
 *  writes its own entry beside the names. */
export async function setRuntimeHarness(
  runtime: string,
  harness: string,
): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.setRuntimeHarness
    ? rules.setRuntimeHarness(runtime, harness)
    : { ok: false, error: TOO_OLD };
}

/** One of that runtime's settings. Never a key: those stay in docs/kanban/.env. */
export async function setRuntimeSetting(
  runtime: string,
  key: string,
  value: string,
): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.setRuntimeSetting
    ? rules.setRuntimeSetting(runtime, key, value)
    : { ok: false, error: TOO_OLD };
}
