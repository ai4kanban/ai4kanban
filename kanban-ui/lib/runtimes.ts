import { boardRules } from "./cli";
import type { WriteResult } from "./types";

// --- the runtimes, through the CLI (#343, #344) ------------------------------
// Two halves, and the door onto each is here. The BOARD names its runtimes and says which
// one is global — that travels with the repository, in docs/kanban/ui.config.json. THIS
// COMPUTER says what each name runs as, in ~/.ai4kanban/runtimes.json, and never writes
// that into the board.
//
// Every move is optional on the rules: a project can be running a command older than
// runtimes, and Configuration → Runtimes draws the board's own harness alone rather than a
// pane whose buttons all fail.

const TOO_OLD =
  "this board's rules are older than runtimes — run `npm install -g ai4kanban`.";

// ---- the board's half --------------------------------------------------------

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

/** Point a runtime at a computer, or back at the one a run starts on with an empty name
 *  (#370). The board's half: it travels with the repository, beside the names. */
export async function setRuntimeComputer(name: string, computer: string): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.setRuntimeComputer
    ? rules.setRuntimeComputer(name, computer)
    : { ok: false, error: TOO_OLD };
}

// ---- this computer's half ----------------------------------------------------

export async function bindRuntime(runtime: string, harness: string): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.bindRuntime ? rules.bindRuntime(runtime, harness) : { ok: false, error: TOO_OLD };
}

export async function setBindingSetting(
  runtime: string,
  key: string,
  value: string,
): Promise<WriteResult> {
  const rules = await boardRules();
  return rules.setBindingSetting
    ? rules.setBindingSetting(runtime, key, value)
    : { ok: false, error: TOO_OLD };
}
