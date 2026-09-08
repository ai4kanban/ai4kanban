// `akb signals fetch` — pull what the board is pointed at into the inbox (#453).
//
// The endpoint's way in. It checks who the inbox is open to, reads the two settings, asks
// the endpoint, and writes what came back — the whole of it in one pass, so a scheduled pull
// and a hand-typed one do exactly the same thing. The other way in is **Add to inbox** on
// the page (#499), which writes the same files without an endpoint.
//
// Nothing in the inbox is a task: nothing here creates a card, ranks anything, or touches
// the board's counts. Turning one into a card is #454's.

import fs from 'node:fs'

import { fetchSignals, sayGap, signalConfigGaps, signalsAccess } from '../lib/signals'
import { signalEndpoint } from '../lib/signals/config'
import { say } from '../lib/io'
import { withBoardLock } from '../lib/lock'
import { die, rel, SIGNAL_INBOX } from '../lib/paths'
import { writeSignalsFetchCard } from '../lib/recurring'
import type { MoveResult } from '../lib/types'

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

export async function cmdSignalsFetch(): Promise<MoveResult> {
  const access = await signalsAccess()
  if (!access.open) die(access.why, { kind: 'signals-closed' })

  const gaps = signalConfigGaps()
  if (gaps.length > 0) {
    for (const gap of gaps) say(`  ${sayGap(gap)}`)
    die('nothing was pulled — the board is not set up to pull signals yet.', {
      kind: 'signals-not-configured',
    })
  }

  // Whether this is the pull that makes the inbox, asked before it does. The recurring card
  // below is seeded exactly once, on that pull.
  const fresh = !fs.existsSync(SIGNAL_INBOX)
  const report = await fetchSignals()

  say(`Pulled ${signalEndpoint()}.`)
  say(
    `Added ${count(report.added.length, 'item', 'items')}, ` +
      `skipped ${report.skipped}, failed ${report.failed.length}.`,
  )
  for (const failed of report.failed) say(`  ${failed.which} — ${failed.why}`)
  if (report.added.length > 0) say(`  ${rel(SIGNAL_INBOX)}/`)

  const seeded = fresh && report.added.length > 0 ? withBoardLock(() => writeSignalsFetchCard()) : null
  if (seeded) {
    say(`  recurring card: #${seeded.id} ${rel(seeded.file)} — set a cadence on it to pull on its own`)
  }

  return {
    added: report.added.length,
    skipped: report.skipped,
    failed: report.failed,
    inbox: rel(SIGNAL_INBOX),
    recurring_card: seeded?.id ?? null,
  }
}
