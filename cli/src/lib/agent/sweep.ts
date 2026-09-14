// ---- sweeping the stale cards (#119) ----------------------------------------
//
// A sweep is not a run. It is state the board keeps — one JSON report beside the run logs —
// plus one `unstick` at a time, started from the same tick the pruner's cadence and the
// recurring cards are started from. That is what lets it survive the app closing: the card
// in flight finishes, and the next tick picks the sweep up where it left off.
//
// It opens on **Run now** or on the cadence, judges at most five cards stalest first, and
// ends on the fifth verdict, when nothing is left to judge, at the first run that did not
// pass, or when the user switches the cadence off. Only a sweep that finished its work
// stamps the cadence — a sweep cut short leaves the stamp where it was, so the window it
// opened in is read off its own opening stamp and no tick re-opens it there.

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { formatStamp, nextDue } from '../cadence'
import { cardAges, cardsDatable, staleAfter } from '../card-age'
import { heldBy, waitingOn } from '../card-holds'
import { SWEEP_REPORT, TODO } from '../paths'
import { allCards, findCard } from '../view/read'
import type { Card } from '../view/types'
import { listRuns } from './sessions'
import { cardSweep, setCardSweep, stampCardSweep } from './settings'
import { startRun } from './start'
import type { RunView, SweepEnd, SweepReport, SweepRow } from './types'

/** How many cards one sweep judges. It bounds the sweep's cost and its report at once; a
 *  board with more stuck cards gets them in the next period. */
export const SWEEP_CAP = 5

// ---- the report file -------------------------------------------------------

/** The current or latest sweep, or null when this board has never swept. A file that won't
 *  parse reads as none: a report nobody can read is not a reason to refuse a new sweep. */
export function sweepReport(): SweepReport | null {
  try {
    const raw = JSON.parse(fs.readFileSync(SWEEP_REPORT, 'utf8')) as SweepReport
    if (!raw || typeof raw.sweepId !== 'string' || !Array.isArray(raw.rows)) return null
    return raw
  } catch {
    return null
  }
}

// Replace the report whole, atomically — a reader never sees half a sweep. False means the
// write failed, which stops the sweep dispatching anything further.
function writeReport(report: SweepReport): boolean {
  const tmp = `${SWEEP_REPORT}.${process.pid}.tmp`
  try {
    fs.mkdirSync(path.dirname(SWEEP_REPORT), { recursive: true })
    fs.writeFileSync(tmp, JSON.stringify(report, null, 2) + '\n')
    fs.renameSync(tmp, SWEEP_REPORT)
    return true
  } catch {
    try {
      fs.rmSync(tmp, { force: true })
    } catch {
      // nothing to clean up
    }
    return false
  }
}

// The sweep still going, or null. A closed report is still a report — it is the latest sweep,
// which is what the page draws — so this asks the narrower question.
const openSweep = (report: SweepReport | null): SweepReport | null =>
  report?.status === 'running' ? report : null

// Close a sweep with what it has. Only a sweep that finished its work moves the cadence's
// stamp: a sweep that broke or was switched off is due again on its own terms, not on the
// next tick.
function close(report: SweepReport, end: SweepEnd): void {
  writeReport({ ...report, status: 'done', end, endedAt: Date.now(), activeRunId: undefined })
  if (end !== 'cap' && end !== 'nothing') return
  try {
    stampCardSweep()
  } catch {
    // the settings file would not take the write — the sweep is over either way
  }
}

// ---- which card is next ----------------------------------------------------

/** One stale card, as the sweep picks them. */
interface Stale {
  card: Card
  days: number
}

// The cards this sweep may still judge, stalest first. The listing is read again before
// every card, so a card the last verdict settled — rewritten, and therefore undateable, or
// discarded, and therefore off the board — is gone from it by itself.
function staleNow(seen: ReadonlySet<number>): Stale[] | null {
  const ages = cardAges()
  if (ages === null) return null
  const threshold = staleAfter()
  const stale: Stale[] = []
  for (const card of allCards()) {
    if (card.isGroup || card.recurring || seen.has(card.id)) continue
    const age = ages.get(path.join(TODO, ...card.relPath.split('/')))
    if (!age || age.days < threshold) continue
    stale.push({ card, days: age.days })
  }
  return stale.sort((a, b) => b.days - a.days || a.card.id - b.card.id)
}

// Whether the sweep walks past this card rather than judging it. A card held by something —
// blocked by an open card, or being built — is waiting rather than forgotten; a card busy
// right now would have its run refused before any record existed, which would leave the
// sweep picking it again every tick. Walking past one costs neither a verdict nor a tick.
function passOver(card: Card, busy: ReadonlySet<number>): boolean {
  if (busy.has(card.id) || card.creation || card.discussing) return true
  return (
    waitingOn(
      heldBy({
        blockers: card.openBlockers.map((b) => b.id),
        questions: card.questions,
        status: card.status,
      }),
    ) !== null
  )
}

// ---- one tick --------------------------------------------------------------

// What a finished `unstick` decided, read off the board rather than out of what the agent
// wrote: the card is still there, or it is gone.
const verdictOf = (id: number): 'kept' | 'discarded' => (findCard(id) ? 'kept' : 'discarded')

// The line the run ended with — the agent's own last message, or the board's word about it
// when the agent had none.
const noteOf = (run: RunView): string | undefined => (run.result || run.note || '').trim() || undefined

// Fill the active row in from the run that has just ended, or leave it unfinished when that
// run did not pass. A stale callback cannot touch a newer sweep: the report is read again
// here, and the sweep id and the active run both have to still match.
function settleRow(report: SweepReport, run: RunView | undefined): SweepReport | null {
  const now = openSweep(sweepReport())
  if (!now || now.sweepId !== report.sweepId || now.activeRunId !== report.activeRunId) return null
  const passed = run?.status === 'done'
  const rows = now.rows.map((row) =>
    row.runId === now.activeRunId
      ? passed
        ? { ...row, verdict: verdictOf(row.id), note: noteOf(run!) }
        : { ...row, unfinished: true as const }
      : row,
  )
  const next = { ...now, rows, activeRunId: undefined }
  return writeReport(next) ? next : null
}

/**
 * Carry the open sweep on by one card. Does nothing when no sweep is open.
 *
 * The verdict of the card in flight is read first, then one more card is started — so a tick
 * that finds its run still going simply waits, and the sweep advances one card per tick.
 */
export async function advanceCardSweep(): Promise<void> {
  let report = openSweep(sweepReport())
  if (!report) return

  const active = report.activeRunId
  if (active) {
    const runs = await listRuns()
    const run = runs.find((r) => r.sessionId === active)
    // Still going — nothing to do this tick. A run no longer in the record at all is one
    // that did not pass: a sweep left open across a hundred other runs would otherwise wait
    // for it forever.
    if (run?.status === 'running') return
    const settled = settleRow(report, run)
    if (!settled) return
    report = settled
    if (run?.status !== 'done') return close(report, 'failed')
  }

  const judged = report.rows.filter((row) => row.verdict).length
  if (judged >= SWEEP_CAP) return close(report, 'cap')
  await startNext(report)
}

// Start the stalest card this sweep has not judged yet. The tick walks on down the list
// until it starts one or runs out — a card it walks past costs no tick and is left for a
// later sweep.
async function startNext(report: SweepReport): Promise<void> {
  // The report has to be writable BEFORE a run starts, because the row is what remembers
  // that run — a sweep that could not write one and started anyway would start another next
  // tick, and another, with nothing on disk to say any of them happened. Writing it back
  // unchanged is the only honest way to ask.
  if (!writeReport(report)) return

  const seen = new Set(report.rows.map((row) => row.id))
  const stale = staleNow(seen)
  // Nothing can be dated any more — the board left its repository mid-sweep. There is no
  // card to judge, which is how the sweep ends.
  if (stale === null) return close(report, 'nothing')

  const busy = new Set<number>()
  for (const run of await listRuns()) {
    if (run.status === 'running' && run.cardId !== null) busy.add(run.cardId)
  }

  for (const { card, days } of stale) {
    if (passOver(card, busy)) continue
    const started = await startRun({ action: 'unstick', id: card.id, title: card.title })
    // The board refused this one — walk on. A pick that produced no run writes nothing.
    if ('error' in started) continue
    const row: SweepRow = { id: card.id, title: card.title, days, runId: started.run.sessionId }
    const next = { ...report, rows: [...report.rows, row], activeRunId: started.run.sessionId }
    // It stopped taking writes between the check above and here. Nothing more is dispatched:
    // the next tick's check fails too, and the run in flight finishes unrecorded rather than
    // being followed by one more every minute.
    writeReport(next)
    return
  }
  close(report, 'nothing')
}

// ---- opening one -----------------------------------------------------------

/**
 * Open a sweep and start its first card. **Run now**, and the cadence's own tick.
 *
 * The report is replaced only once the start checks pass, so a refused start leaves the
 * previous sweep's report exactly where it was.
 */
export async function startCardSweep(): Promise<{ ok: boolean; error?: string }> {
  if (openSweep(sweepReport())) return { ok: false, error: 'the board is already being swept' }
  if (!cardsDatable()) {
    return { ok: false, error: `not a git repository — a card's age is the date git last saw its file, so there is nothing to sweep.` }
  }
  const fresh: SweepReport = { sweepId: randomUUID(), startedAt: Date.now(), status: 'running', rows: [] }
  if (!writeReport(fresh)) return { ok: false, error: `couldn't write ${SWEEP_REPORT}` }
  await startNext(fresh)
  return { ok: true }
}

/** Whether this board can be swept at all — its cards can be dated. False takes Run now and
 *  the cadence chip off the sweeper's page, with one line saying why. */
export const canSweep = (): boolean => cardsDatable()

/** Whether the cadence has made a sweep due right now. The window is read off the last
 *  sweep's OWN opening stamp: a sweep is not one run, so a sweep cut short would otherwise
 *  be due again on the next tick, forever.
 *
 *  It closes that window and no more. A sweep cut short leaves the stamp the cadence counts
 *  from exactly where it was, so the window that stamp names never moves — reading the last
 *  sweep's opening against it alone would take the cadence off for good after one failure. */
export function sweepDue(now = Date.now()): boolean {
  const schedule = cardSweep()
  if (!schedule.enabled) return false
  const due = nextDue(schedule.lastRun, schedule.cadence)
  if (!due || due.getTime() > now) return false
  const report = sweepReport()
  if (openSweep(report)) return false
  if (!report || report.startedAt < due.getTime()) return true
  const again = nextDue(formatStamp(new Date(report.startedAt)), schedule.cadence)
  return !!again && again.getTime() <= now
}

/** Save the cadence. Switching it off is the whole opt-in going away, so it stops the sweep
 *  already running — at the cost of that sweep losing the cards it had not reached. */
export function saveCardSweep(next: { enabled: boolean; cadence: string }): { ok: boolean; error?: string } {
  const res = setCardSweep(next)
  if (!res.ok || next.enabled) return res
  const open = openSweep(sweepReport())
  if (open) {
    const rows = open.rows.map((row) => (row.runId === open.activeRunId ? { ...row, unfinished: true as const } : row))
    close({ ...open, rows }, 'switched-off')
  }
  return res
}
