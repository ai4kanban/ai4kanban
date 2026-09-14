// Sweeping the stalled cards on a cadence (#119).
//
// What is asked here: the cadence is the whole opt-in and starts nothing until it is saved,
// a sweep reads its verdict off the board rather than out of what the agent wrote, it ends
// on the cap and at the first run that did not pass, switching the cadence off stops the one
// that is running, and only a sweep that finished its work moves the stamp the cadence
// counts from.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { cardSweep, setCardSweep, stampCardSweep } from '../src/lib/agent/settings.ts'
import { advanceCardSweep, saveCardSweep, startCardSweep, sweepDue, sweepReport } from '../src/lib/agent/sweep.ts'
import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot, SESSIONS, SWEEP_REPORT, UI_CONFIG } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'
import type { SweepReport, SweepRow } from '../src/lib/agent/types.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

/** One open card, so a verdict can be read off the board. */
const card = (id: number): void => {
  const meta: Partial<Meta> = {
    title: `Card ${id}`,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
  }
  fs.writeFileSync(
    path.join(kanban(), 'todo', `${id}-card.md`),
    `${serializeFrontmatter(meta)}\n\nA card.\n\n## Todo\n\n- [ ] Build it.\n`,
  )
}

/** The `unstick` the sweep is waiting on, as the record holds it once it has ended. */
const unstickRun = (sessionId: string, cardId: number, status: string, result?: string): void => {
  fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
  fs.writeFileSync(
    SESSIONS,
    JSON.stringify({
      runs: [
        {
          sessionId,
          cardId,
          action: 'unstick',
          status,
          startedAt: Date.now() - 2000,
          endedAt: Date.now() - 1000,
          harness: 'claude-code',
          logPath: '/dev/null',
          ...(result ? { result } : {}),
        },
      ],
      deliveries: [],
    }),
  )
}

/** A sweep open on one card, exactly as the dispatcher would have left it. */
const openSweep = (rows: SweepRow[], activeRunId?: string, startedAt = Date.now()): void => {
  const report: SweepReport = { sweepId: 'sweep-1', startedAt, status: 'running', rows, activeRunId }
  fs.mkdirSync(path.dirname(SWEEP_REPORT), { recursive: true })
  fs.writeFileSync(SWEEP_REPORT, JSON.stringify(report))
}

const judged = (id: number): SweepRow => ({
  id,
  title: `Card ${id}`,
  days: 40,
  runId: `done-${id}`,
  verdict: 'kept',
})

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-sweep-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  setBoardRoot(root)
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe("the sweeper's cadence", () => {
  it('is off with no cadence until somebody asks for one', () => {
    assert.deepEqual(cardSweep(), { enabled: false, cadence: '', lastRun: '' })
    assert.equal(fs.existsSync(UI_CONFIG), false)
  })

  it('refuses a cadence it cannot act on, and leaves the saved one alone', () => {
    assert.equal(setCardSweep({ enabled: true, cadence: '7d at 09:00' }).ok, true)
    const bad = setCardSweep({ enabled: true, cadence: 'now and then' })
    assert.equal(bad.ok, false)
    assert.deepEqual(cardSweep(), { enabled: true, cadence: '7d at 09:00', lastRun: '' })
  })

  it('starts nothing while no cadence is saved, and opens one once it is due', () => {
    assert.equal(sweepDue(), false)
    setCardSweep({ enabled: true, cadence: '30m' })
    assert.equal(sweepDue(), true)
  })

  it('waits out the interval after a sweep that finished its work', () => {
    setCardSweep({ enabled: true, cadence: '30m' })
    stampCardSweep()
    assert.equal(sweepDue(), false)
  })

  it('opens no second sweep in the window the last one opened in', () => {
    setCardSweep({ enabled: true, cadence: '30m' })
    // A sweep cut short leaves the stamp where it was, so the cadence is due again at once.
    // Its own opening stamp is what stops the next tick reopening it.
    fs.mkdirSync(path.dirname(SWEEP_REPORT), { recursive: true })
    fs.writeFileSync(
      SWEEP_REPORT,
      JSON.stringify({ sweepId: 's', startedAt: Date.now(), status: 'done', end: 'failed', rows: [] }),
    )
    assert.equal(sweepDue(), false)
  })

  it('comes round again in the window after the one a cut-short sweep opened in', () => {
    setCardSweep({ enabled: true, cadence: '30m' })
    // The stamp the cadence counts from stayed where it was, so the window it names never
    // moves. What closed is the window the cut-short sweep itself opened in, and that one
    // has passed.
    stampCardSweep(new Date(Date.now() - 90 * 60_000))
    fs.mkdirSync(path.dirname(SWEEP_REPORT), { recursive: true })
    fs.writeFileSync(
      SWEEP_REPORT,
      JSON.stringify({ sweepId: 's', startedAt: Date.now() - 60 * 60_000, status: 'done', end: 'failed', rows: [] }),
    )
    assert.equal(sweepDue(), true)
  })

  it('opens no second sweep while one is still going', () => {
    setCardSweep({ enabled: true, cadence: '30m' })
    openSweep([], 'run-1')
    assert.equal(sweepDue(), false)
  })
})

describe('the verdict a sweep records', () => {
  it('reads a card still on the board as kept, with the line its run ended on', async () => {
    card(4)
    openSweep([{ id: 4, title: 'Card 4', days: 40, runId: 'run-1' }], 'run-1')
    unstickRun('run-1', 4, 'done', 'Kept — the scope needs halving first.')

    await advanceCardSweep()

    const report = sweepReport()!
    assert.equal(report.rows[0]!.verdict, 'kept')
    assert.equal(report.rows[0]!.note, 'Kept — the scope needs halving first.')
  })

  it('reads a card that has gone as discarded', async () => {
    openSweep([{ id: 4, title: 'Card 4', days: 40, runId: 'run-1' }], 'run-1')
    unstickRun('run-1', 4, 'done', 'Dropped — the module field covers it.')

    await advanceCardSweep()

    assert.equal(sweepReport()!.rows[0]!.verdict, 'discarded')
  })

  it('leaves a row without a verdict when its run did not pass, and stops there', async () => {
    card(4)
    openSweep([{ id: 4, title: 'Card 4', days: 40, runId: 'run-1' }], 'run-1')
    unstickRun('run-1', 4, 'error')

    await advanceCardSweep()

    const report = sweepReport()!
    assert.equal(report.status, 'done')
    assert.equal(report.end, 'failed')
    assert.equal(report.rows[0]!.verdict, undefined)
    assert.equal(report.rows[0]!.unfinished, true)
    // A sweep cut short leaves the stamp the cadence counts from exactly where it was.
    assert.equal(cardSweep().lastRun, '')
  })

  it('waits while its run is still going', async () => {
    card(4)
    openSweep([{ id: 4, title: 'Card 4', days: 40, runId: 'run-1' }], 'run-1')
    unstickRun('run-1', 4, 'running')

    await advanceCardSweep()

    const report = sweepReport()!
    assert.equal(report.status, 'running')
    assert.equal(report.activeRunId, 'run-1')
  })
})

describe('when a sweep ends', () => {
  it('ends on the fifth verdict, and stamps the cadence', async () => {
    setCardSweep({ enabled: true, cadence: '30m' })
    card(5)
    openSweep([judged(1), judged(2), judged(3), judged(4), { id: 5, title: 'Card 5', days: 31, runId: 'run-1' }], 'run-1')
    unstickRun('run-1', 5, 'done', 'Kept.')

    await advanceCardSweep()

    const report = sweepReport()!
    assert.equal(report.status, 'done')
    assert.equal(report.end, 'cap')
    assert.equal(report.rows.filter((row) => row.verdict).length, 5)
    assert.notEqual(cardSweep().lastRun, '')
  })

  it('stops the sweep that is running when the cadence is switched off', () => {
    setCardSweep({ enabled: true, cadence: '30m' })
    openSweep([judged(1), { id: 2, title: 'Card 2', days: 31, runId: 'run-1' }], 'run-1')

    assert.equal(saveCardSweep({ enabled: false, cadence: '30m' }).ok, true)

    const report = sweepReport()!
    assert.equal(report.status, 'done')
    assert.equal(report.end, 'switched-off')
    // What it did reach is kept; the card it was on says the sweep stopped there.
    assert.equal(report.rows[0]!.verdict, 'kept')
    assert.equal(report.rows[1]!.unfinished, true)
    assert.equal(report.rows[1]!.verdict, undefined)
    assert.equal(cardSweep().lastRun, '')
  })

  it('keeps the report a refused start never replaced', async () => {
    openSweep([judged(1)], 'run-1')
    const before = sweepReport()

    const refused = await startCardSweep()

    assert.equal(refused.ok, false)
    assert.match(refused.error!, /already being swept/)
    assert.deepEqual(sweepReport(), before)
  })

  it('will not let a late callback write into a sweep that has been replaced', async () => {
    card(4)
    openSweep([{ id: 4, title: 'Card 4', days: 40, runId: 'run-1' }], 'run-1')
    unstickRun('run-1', 4, 'done', 'Kept.')
    // The sweep this tick read is replaced under it — a newer one is open on another card.
    const replaced: SweepReport = {
      sweepId: 'sweep-2',
      startedAt: Date.now(),
      status: 'running',
      rows: [{ id: 9, title: 'Card 9', days: 33, runId: 'run-2' }],
      activeRunId: 'run-2',
    }
    const { advanceCardSweep: advance } = await import('../src/lib/agent/sweep.ts')
    const tick = advance()
    fs.writeFileSync(SWEEP_REPORT, JSON.stringify(replaced))
    await tick

    const now = sweepReport()!
    assert.equal(now.sweepId, 'sweep-2')
    assert.deepEqual(now.rows, replaced.rows)
  })

  it('keeps its rows when the run records that made them are gone', async () => {
    openSweep([judged(1), judged(2)], undefined)
    fs.writeFileSync(SESSIONS, JSON.stringify({ runs: [], deliveries: [] }))

    await advanceCardSweep()

    const report = sweepReport()!
    assert.equal(report.rows.length, 2)
    assert.equal(report.rows[0]!.verdict, 'kept')
  })

  it('starts nothing more once the report has stopped taking writes', async () => {
    card(4)
    openSweep([{ id: 4, title: 'Card 4', days: 40, runId: 'run-1' }], 'run-1')
    unstickRun('run-1', 4, 'done', 'Kept.')
    await advanceCardSweep()
    // The verdict landed and the sweep is looking for its next card. Now nothing can be
    // written: the row that would remember the next run could not be saved, so no run starts.
    const before = fs.readFileSync(SWEEP_REPORT, 'utf8')
    fs.chmodSync(path.dirname(SWEEP_REPORT), 0o500)
    try {
      await advanceCardSweep()
      assert.equal(fs.readFileSync(SWEEP_REPORT, 'utf8'), before)
    } finally {
      fs.chmodSync(path.dirname(SWEEP_REPORT), 0o700)
    }
  })

  it('does nothing to a report that is already closed', async () => {
    fs.mkdirSync(path.dirname(SWEEP_REPORT), { recursive: true })
    const closed = { sweepId: 's', startedAt: 1, endedAt: 2, status: 'done', end: 'cap', rows: [judged(1)] }
    fs.writeFileSync(SWEEP_REPORT, JSON.stringify(closed))

    await advanceCardSweep()

    assert.deepEqual(sweepReport(), closed)
  })
})
