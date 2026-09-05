// Optional usage reporting (#293): whether this MACHINE reports, whether it has been told,
// and the id its reports are tied to.
//
// Three keys in `~/.ai4kanban/settings.json`, beside the language and the notification
// silence, because the answer is a fact about the machine and not about any board. A board
// is committed to git, so a setting kept there would be cloned with the repository and
// answer for everyone who works on it.
//
// Reporting is ON when the answer is absent, which is why this reads the file through
// `heldSettings` rather than through the language's reader: that one answers a missing file
// and an unreadable one the same way, and a default-on setting read off an unreadable file
// would start sending from a machine that had already said no. An unreadable file sends
// nothing, shows no step, and refuses every write until it can be read again.
//
// Sending is not here. #295 and #296 queue and send; this owns the answer they ask, the id
// they stamp, and the queue that turning reporting off empties. Two answers, not one: `on`
// is what a sender needs, and the APP also waits on `disclosed`, because it is the surface
// that shows the step and must queue nothing before it is answered. A terminal `akb` never
// sees that step and reports on `on` alone — the README, the site and the privacy page are
// what told a terminal-only user, and `akb telemetry off` is what they answer with.

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import type { WriteResult } from '../view/types'
import { machineHome } from './home'
import { heldSettings, saveSettings, settingsFile } from './settings'
import type { UsageReporting } from './types'

/** Where the events waiting to be sent are kept (#295). Named here because turning
 *  reporting off is what empties it, and that switch is this file's. */
export const usageQueueFile = (): string => path.join(machineHome(), 'usage-queue.jsonl')

/** And what the sender remembers between runs (#295): the day it last tried, and the minute
 *  of the day this install sends at. Its own file rather than a key in `settings.json` — a
 *  file that will not parse reads as "cannot be read" below, which turns reporting off and
 *  refuses every write, and the sender's bookkeeping must never be able to do that to the
 *  user's own answers. Emptied by the same switch. */
export const usageStateFile = (): string => path.join(machineHome(), 'usage-state.json')

/** What this machine has answered. `on` is the only question a sender has to ask. */
export function readUsageReporting(): UsageReporting {
  const { unreadable, values } = heldSettings()
  if (unreadable) return { on: false, disclosed: false, installId: '', unreadable: true }
  const answer = values.usageReporting
  const id = values.usageInstallId
  return {
    // Absent means on; anything that is not a boolean is an answer this build cannot read,
    // and the safe reading of one is off.
    on: answer === undefined ? true : answer === true,
    disclosed: values.usageDisclosureShown === true,
    installId: typeof id === 'string' ? id : '',
    unreadable: false,
  }
}

/** Whether anything may be sent from this machine — what #295 and #296 ask before queueing. */
export function usageReportingOn(): boolean {
  return readUsageReporting().on
}

/** Whether the disclosure step is still owed. Gated on the record alone, never on the
 *  setting's value: gating it on the value would hide the step from someone who had already
 *  answered in the terminal, and show it switched on to someone who had answered off. Held
 *  back while the file cannot be read — a step whose Continue could not save would be a wall. */
export function usageDisclosureOwed(): boolean {
  const held = readUsageReporting()
  return !held.unreadable && !held.disclosed
}

/** Turn reporting on or off with no prompt — the Configuration row, and `akb telemetry`. */
export function setUsageReporting(on: boolean): WriteResult {
  return write(on, false)
}

/** What **Continue** on the disclosure step does: save the setting as it was shown and
 *  record that the step has been shown, in one write. A failure leaves both as they were,
 *  so the step is still owed on the next open. */
export function recordUsageDisclosure(on: boolean): WriteResult {
  return write(on, true)
}

/** The id this machine's reports carry, made here the first time an event is queued and
 *  never before — a machine that has sent nothing carries no identifier at all. Random, and
 *  never derived from the machine, the user or the repository (and never `machine.json`'s
 *  id): a value that survives a reinstall and a switch-off is an identifier the user cannot
 *  get rid of. Empty when reporting is off, which is also the answer that nothing should be
 *  queued. */
export function ensureUsageInstallId(): string {
  const held = readUsageReporting()
  if (!held.on) return ''
  if (held.installId) return held.installId
  const id = randomUUID()
  return saveSettings({ usageInstallId: id }).ok ? id : ''
}

function write(on: boolean, disclosed: boolean): WriteResult {
  const held = readUsageReporting()
  if (held.unreadable) return { ok: false, error: `${settingsFile()} cannot be read — fix or remove it, then try again` }
  const patch: Record<string, unknown> = { usageReporting: !!on }
  if (disclosed) patch.usageDisclosureShown = true
  // Off forgets the id. Turning it on again makes a new one rather than bringing the old
  // one back, or switching off would be something the machine could undo behind the user.
  if (!on) patch.usageInstallId = undefined
  const saved = saveSettings(patch)
  // …and drops what was waiting to be sent, so nothing queued before the switch goes out
  // after it — along with the sender's own bookkeeping, so turning it on again starts from
  // a fresh install id AND a freshly picked send time rather than the old machine's.
  if (saved.ok && !on) {
    fs.rmSync(usageQueueFile(), { force: true })
    fs.rmSync(usageStateFile(), { force: true })
  }
  return saved
}
