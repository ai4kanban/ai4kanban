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

// --- auto-delivery (#303) ----------------------------------------------------
// **Allow automatic Git commits** — one repository-level setting, saved in the same file,
// so a team shares one answer rather than each machine keeping its own.

export async function autoCommitAllowed(): Promise<boolean> {
  const rules = await boardRules();
  // Rules from before the setting existed behaved as though it were on. Reading `true` for
  // them keeps the switch honest about what a delivery would actually do.
  return rules.autoCommitAllowed ? rules.autoCommitAllowed() : true;
}

export async function setAutoCommit(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.setAutoCommit) {
    return { ok: false, error: "this board's rules are older than auto-delivery — run `npm install -g ai4kanban`." };
  }
  return rules.setAutoCommit(on);
}
