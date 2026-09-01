import { machineCopy } from "./language";
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
// **Automatic Git commits** — one repository-level setting, saved in the same file,
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
    return { ok: false, error: (await machineCopy()).messages.tooOld.autoDelivery };
  }
  return rules.setAutoCommit(on);
}

// --- diff approval (#308) ----------------------------------------------------
// **Approve diffs before landing** — the other repository-level answer in the same
// file. Off by default, so rules from before it existed read as off, which is what they did.

export async function diffApprovalRequired(): Promise<boolean> {
  const rules = await boardRules();
  return rules.diffApprovalRequired ? rules.diffApprovalRequired() : false;
}

export async function setDiffApproval(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.setDiffApproval) {
    return { ok: false, error: (await machineCopy()).messages.tooOld.diffApproval };
  }
  return rules.setDiffApproval(on);
}

// --- the silence limit (#394) -------------------------------------------------
// **End a silent run after** — how many minutes a run may produce nothing before the board
// ends it as a failure. Repository-level, in the same file as the two above.

export async function silenceMinutes(): Promise<number> {
  const rules = await boardRules();
  // Rules from before the setting ended nothing at all — which is exactly what 0 means, so
  // the box stays honest about what a run would actually do.
  return rules.silenceMinutes ? rules.silenceMinutes() : 0;
}

export async function setSilenceMinutes(minutes: number): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.setSilenceMinutes) {
    return { ok: false, error: (await machineCopy()).messages.tooOld.silenceLimit };
  }
  return rules.setSilenceMinutes(minutes);
}
