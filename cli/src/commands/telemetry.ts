// `akb telemetry` — read or change optional usage reporting for this machine (#293).
//
// It needs no board: the answer belongs to the machine, like the Cloud sign-in beside it,
// and one board is not the place to answer for every other project on the same computer.
//
// It never prompts. The app asks once, in an onboarding step nobody can press past; a
// terminal has nobody to ask, so somebody who only ever types `akb` turns reporting off
// here, and the README, the site and the privacy page are what told them it was on.

import { readUsageReporting, setUsageReporting } from '../lib/machine/telemetry'
import { settingsFile } from '../lib/machine/settings'
import { die } from '../lib/paths'
import { say } from '../lib/io'
import type { MoveResult } from '../lib/types'

const PRIVACY_URL = 'https://ai4kanban.dev/privacy'
const SENT = `  What is sent, and how to have it deleted: ${PRIVACY_URL}`

export function cmdTelemetry(args: string[], program: string): MoveResult {
  const [sub] = args
  if (sub !== undefined && sub !== 'status' && sub !== 'on' && sub !== 'off') {
    die(
      `unknown \`telemetry\` command "${sub}". Try \`${program} telemetry status\`, ` +
        `\`${program} telemetry on\` or \`${program} telemetry off\`.`,
      { kind: 'unknown-move' },
    )
  }

  if (sub === 'on' || sub === 'off') {
    const saved = setUsageReporting(sub === 'on')
    if (!saved.ok) die(saved.error ?? 'the setting could not be saved.', { kind: 'save-failed' })
    say(
      sub === 'on'
        ? 'Usage reporting is on. This machine gets a new install id when the first event is queued.'
        : 'Usage reporting is off. Nothing more is sent, anything queued is dropped, and the install id is forgotten.',
    )
    say(SENT)
    return { usageReporting: readUsageReporting() }
  }

  const held = readUsageReporting()
  // Not a refusal: reading is what this command is for, and "nothing is being sent" is the
  // answer. Fixing the file is the user's, and saying so is the whole of the help.
  if (held.unreadable) {
    say(`${settingsFile()} cannot be read, so nothing is reported and nothing can be saved.`)
    say('Fix or remove that file to answer this again.')
    return { usageReporting: held }
  }

  say(held.on ? 'Usage reporting is on.' : 'Usage reporting is off.')
  if (held.on) {
    say(held.installId ? `  Install id: ${held.installId}` : '  Nothing has been sent yet, so there is no install id.')
    say(`  Turn it off with \`${program} telemetry off\`.`)
  } else {
    say(`  Turn it on with \`${program} telemetry on\`.`)
  }
  say(SENT)
  return { usageReporting: held }
}
