import { boardRules } from "./cli";

// --- the settings, through the CLI (#168) ------------------------------------
// docs/kanban/ui.config.json is still the file, and it still holds which agent runs, with
// every agent's own settings beside it. What changed is who reads and writes it — the CLI
// does, so `akb agent` and this dialog are one writer with one set of rules.

export async function setHarness(name: string): Promise<{ ok: boolean; error?: string }> {
  return (await boardRules()).setHarness(name);
}

export async function setHarnessSetting(key: string, value: string): Promise<{ ok: boolean; error?: string }> {
  return (await boardRules()).setHarnessSetting(key, value);
}
