import { machineCopy, said } from "./language";
import { boardRules } from "./cli";
import type { BoardScheduleKey, BoardScheduleView } from "./types";

// --- the settings, through the CLI (#168) ------------------------------------
// ui.config.json holds which agent runs, with every agent's own settings beside it. The CLI
// reads and writes it, so `akb agent` and this dialog are one writer with one set of rules.

export async function setHarness(name: string): Promise<{ ok: boolean; error?: string }> {
  return said(await (await boardRules()).setHarness(name));
}

export async function setHarnessSetting(
  key: string,
  value: string,
  harness?: string,
): Promise<{ ok: boolean; error?: string }> {
  return said(await (await boardRules()).setHarnessSetting(key, value, harness));
}

// --- auto-delivery (#303) ----------------------------------------------------
// **Automatic Git commits** — saved in the same file as the other board settings.

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
  return said(await rules.setAutoCommit(on));
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
  return said(await rules.setSilenceMinutes(minutes));
}

// --- the board's own scheduled agents (#514, #748, #929, #1268, #1464) -------
// Rules that predate the read answer null, and the pages draw Run now without the chip.

export async function boardSchedules(): Promise<Record<BoardScheduleKey, BoardScheduleView> | null> {
  const rules = await boardRules();
  return rules.boardSchedules ? rules.boardSchedules() : null;
}

export async function setBoardSchedule(
  key: BoardScheduleKey,
  next: { enabled: boolean; cadence: string },
): Promise<{ ok: boolean; error?: string }> {
  const rules = await boardRules();
  if (!rules.setBoardSchedule) {
    return { ok: false, error: (await machineCopy()).messages.tooOld.schedules };
  }
  return said(await rules.setBoardSchedule(key, next));
}
