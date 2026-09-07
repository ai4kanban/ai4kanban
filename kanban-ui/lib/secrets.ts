import { boardRules } from "./cli";

// --- the board's keys (#168) -------------------------------------------------
// They live in docs/kanban/.env, kept out of git by the board's own ignore file, and the
// CLI is what writes them — the same file `akb agent set <key> …` writes, with the same
// rule that a key is never read back.
//
// Which variable a key reaches a run under is the setting's business, and a key never
// leaves the machine: nothing here returns one.

export async function setSecret(name: string, value: string): Promise<{ ok: boolean; error?: string }> {
  return (await boardRules()).setSecret(name, value);
}

/** One runtime's key, under the id-scoped line a run actually reads (#467). `harness` names
 *  the row — the first one on that connector — and with none it is Global default.
 *
 *  `key` is the setting's own key, not the variable: which line it lands on is the runtime's
 *  business, and this side never learns the name. Rules from before runtimes have no such
 *  line and take the bare variable, which is what a run read there. */
export async function setHarnessSecret(
  setting: { key: string; env: string },
  value: string,
  harness?: string,
): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  return rules.setHarnessSecret
    ? rules.setHarnessSecret(setting.key, value, harness)
    : rules.setSecret(setting.env, value);
}
