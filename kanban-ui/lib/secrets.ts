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
