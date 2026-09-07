import { boardRules } from "./cli";
import { machineCopy } from "./language";
import type { WriteResult } from "./types";

// --- the board's runtimes, through the CLI (#467, #468) -----------------------
// Configuration → Runtimes is a list you add to, and every write it makes goes through the
// command's own writers — so `akb agent runtime` and the pane are one writer with one set of
// rules, and a delete typed in either takes that row's key off this computer.
//
// Rules older than runtimes carry none of these. They answer with the one line that fixes it
// rather than falling back to a per-harness write, which would land in another row.

async function writer<T>(
  pick: (rules: Awaited<ReturnType<typeof boardRules>>) => T | undefined,
): Promise<{ move: T } | { error: string }> {
  const move = pick(await boardRules());
  if (move) return { move };
  return { error: (await machineCopy()).messages.tooOld.runtimes };
}

export async function addRuntime(
  name: string,
  harness: string,
): Promise<WriteResult & { id?: string }> {
  const got = await writer((r) => r.addRuntime);
  return "error" in got ? { ok: false, error: got.error } : got.move(name, harness);
}

export async function renameRuntime(id: string, name: string): Promise<WriteResult> {
  const got = await writer((r) => r.renameRuntime);
  return "error" in got ? { ok: false, error: got.error } : got.move(id, name);
}

export async function deleteRuntime(id: string): Promise<WriteResult> {
  const got = await writer((r) => r.deleteRuntime);
  return "error" in got ? { ok: false, error: got.error } : got.move(id);
}

export async function setRuntimeHarness(id: string, harness: string): Promise<WriteResult> {
  const got = await writer((r) => r.setRuntimeHarness);
  return "error" in got ? { ok: false, error: got.error } : got.move(id, harness);
}

export async function setRuntimeSetting(
  id: string,
  key: string,
  value: string,
): Promise<WriteResult> {
  const got = await writer((r) => r.setRuntimeSetting);
  return "error" in got ? { ok: false, error: got.error } : got.move(id, key, value);
}

/** One row's key, on its own id-scoped line. `key` is the setting's own key, never the
 *  variable: which line it lands on is the runtime's business, and this side never learns
 *  the name. */
export async function setRuntimeSecret(
  id: string,
  key: string,
  value: string,
): Promise<WriteResult> {
  const got = await writer((r) => r.setRuntimeSecret);
  return "error" in got ? { ok: false, error: got.error } : got.move(id, key, value);
}
