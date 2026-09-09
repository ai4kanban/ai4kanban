// `akb triage fetch` — pull what the board is pointed at into triage (#453).
//
// The endpoint's way in. It checks who triage is open to, reads the two settings, asks
// the endpoint, and writes what came back — the whole of it in one pass, so a scheduled pull
// and a hand-typed one do exactly the same thing. The other way in is **Add to triage** on
// the page (#499), which writes the same files without an endpoint.
//
// `add` is the third way in (#534): one item written from words the caller already has,
// which is what the proposer's reflection uses. It asks Cloud nothing — the endpoint is what
// admission is about, and **Add to triage** on the page has never asked either.
//
// Nothing in triage is a task: nothing here creates a card, ranks anything, or touches
// the board's counts. Turning one into a card is #454's.

import fs from 'node:fs'

import { addToInbox, fetchSignals, sayGap, signalConfigGaps, signalsAccess } from '../lib/signals'
import { signalEndpoint } from '../lib/signals/config'
import { say } from '../lib/io'
import { withBoardLock } from '../lib/lock'
import { die, rel, SIGNAL_INBOX } from '../lib/paths'
import { writeSignalsFetchCard } from '../lib/recurring'
import type { MoveResult } from '../lib/types'

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

export async function cmdTriageFetch(): Promise<MoveResult> {
  const access = await signalsAccess()
  if (!access.open) die(access.why, { kind: 'triage-closed' })

  const gaps = signalConfigGaps()
  if (gaps.length > 0) {
    for (const gap of gaps) say(`  ${sayGap(gap)}`)
    die('nothing was pulled — the board is not set up to pull triage items yet.', {
      kind: 'triage-not-configured',
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

/** `akb triage add`, as its command declares it. */
export interface TriageAddOptions {
  title?: string
  text?: string
  file?: string
  source?: string
}

/** Write one item into triage. The body comes from `--text` for a line or two and from
 *  `--file` when it is longer, the same pair `akb release changelog` takes. */
export function cmdTriageAdd(opts: TriageAddOptions): MoveResult {
  const title = (opts.title ?? '').trim()
  if (!title) die('say what it is: --title "<one line>"', { kind: 'needs-input' })
  if (opts.file !== undefined && opts.text !== undefined) die('pass --file or --text, not both', { kind: 'needs-input' })

  let body = opts.text
  if (opts.file !== undefined) {
    try {
      body = fs.readFileSync(opts.file, 'utf8')
    } catch {
      die(`can't read ${opts.file} — write the item to a file, then pass its path`, { kind: 'needs-input' })
    }
  }
  if (!body?.trim()) {
    die('the item has to say something: --text ".." , or --file <path> for a longer one', { kind: 'needs-input' })
  }

  const done = addToInbox({ title, text: body, source: opts.source })
  if (!done.ok) die(done.error, { kind: 'triage-item-refused' })
  say(`added to triage: ${done.signal.relPath}`)
  return { title: done.signal.title, source_id: done.signal.sourceId, file: done.signal.relPath }
}
