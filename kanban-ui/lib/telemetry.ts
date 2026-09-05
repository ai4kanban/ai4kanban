import { boardRules } from "./cli";
import { machineCopy } from "./language";
import type { UsageReporting, WriteResult } from "./types";

// --- optional usage reporting (#293) -----------------------------------------
// Not a board setting: one answer covers every project this machine opens and every
// terminal on it, so the board's rules hold it in a file outside every repository and
// nothing here knows which file or what shape it has.
//
// Every read answers `null` on rules that predate it. That is not "off" and not "on": the
// disclosure step is held back rather than drawn with a Continue nothing could save, and
// the Privacy row says the rules are too old instead of offering a switch that writes
// nowhere.

export async function usageReporting(): Promise<UsageReporting | null> {
  const rules = await boardRules();
  return rules.readUsageReporting?.() ?? null;
}

/** Whether the app still owes this machine the disclosure step. The recorded disclosure
 *  alone decides it, so `akb telemetry off` typed before the app was ever opened still
 *  brings the step up — and an unreadable settings file holds it back. */
export async function usageDisclosureOwed(): Promise<boolean> {
  const held = await usageReporting().catch(() => null);
  return held !== null && !held.unreadable && !held.disclosed;
}

export async function setUsageReporting(on: boolean): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.setUsageReporting) return { ok: false, error: (await machineCopy()).messages.tooOld.usageReporting };
  return rules.setUsageReporting(on);
}

/** What Continue on the disclosure step does. A failure leaves the step owed, so the next
 *  open asks again rather than a machine reporting on an answer nobody gave. */
export async function recordUsageDisclosure(on: boolean): Promise<WriteResult> {
  const rules = await boardRules();
  if (!rules.recordUsageDisclosure) return { ok: false, error: (await machineCopy()).messages.tooOld.usageReporting };
  return rules.recordUsageDisclosure(on);
}
