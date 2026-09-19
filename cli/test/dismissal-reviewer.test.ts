// Learning triage preferences from dismissal reasons (#929).
//
// What a review writes is the agent's judgement; what is asserted here is everything around
// it: which dismissals and restored ids reach it, when the board starts one on its own, and
// that the window moves only on a pass.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { formatStamp } from '../src/lib/cadence.ts'
import { citedSources, dismissalsToReview, withdrawnSources } from '../src/lib/agent/dismissal-review.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { dismissalReview, setDismissalReview, stampDismissalReview } from '../src/lib/agent/settings.ts'
import { findGuide } from '../src/lib/guide.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { scaffoldProjectMemory } from '../src/lib/memory.ts'
import { setBoardRoot, SESSIONS, UI_CONFIG } from '../src/lib/paths.ts'
import { nextWork } from '../src/lib/view/dispatch.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const triage = (): string => path.join(kanban(), 'triage')
const memoryFile = (): string => path.join(kanban(), 'memory', 'agents', 'planner', 'dismissed.md')

const HOUR = 60 * 60_000
const DAY = 24 * HOUR

/** One triage item: waiting, dismissed with a reason, or archived into a card. */
function item(
  id: string,
  where: 'waiting' | 'dismissed' | 'archived',
  dismissal: { by?: 'user' | 'agent'; reason?: string; at?: number } = {},
): void {
  const dir = where === 'waiting' ? triage() : path.join(triage(), where)
  fs.mkdirSync(dir, { recursive: true })
  const lines = ['---', `source_id: ${id}`, `title: item ${id}`, 'collected_at: 2026-09-01 09:00', 'imported_at: 2026-09-01 09:00']
  if (where === 'dismissed') {
    lines.push(`dismissed_at: ${formatStamp(new Date(dismissal.at ?? Date.now()))}`, `dismissed_by: ${dismissal.by ?? 'user'}`)
    if (dismissal.reason) lines.push(`dismissed_reason: ${dismissal.reason}`)
  }
  if (where === 'archived') lines.push('card_id: 5', 'archived_at: 2026-09-02 09:00')
  lines.push('---', '', `what item ${id} says`, '')
  fs.writeFileSync(path.join(dir, `${id}.md`), lines.join('\n'))
}

function memory(text: string): void {
  fs.mkdirSync(path.dirname(memoryFile()), { recursive: true })
  fs.writeFileSync(memoryFile(), text)
}

/** Review runs in the record, so the dispatcher can see what the last one did. */
function pastRuns(...runs: { status: string; startedAt: number }[]): void {
  fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
  fs.writeFileSync(
    SESSIONS,
    JSON.stringify({
      runs: runs.map((run, i) => ({
        sessionId: `past-${i}`,
        cardId: null,
        action: 'review-dismissals',
        status: run.status,
        startedAt: run.startedAt,
        ...(run.status === 'running' ? {} : { endedAt: run.startedAt + 1 }),
        harness: 'claude-code',
        logPath: '/dev/null',
      })),
      deliveries: [],
    }),
  )
}

const work = async (): Promise<string[]> =>
  (await nextWork(() => Promise.resolve(true))).map((w) => w.action).filter((a) => a === 'review-dismissals')

function quiet(job: () => void): string {
  const sink = startCollecting()
  try {
    job()
    return sink.out.join('\n')
  } finally {
    stopCollecting()
  }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-dismissal-review-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  forgetMachineState(root)
  setBoardRoot(root)
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('what a review reads', () => {
  it("takes only the user's dismissals that carry a reason, inside the window", () => {
    item('mine', 'dismissed', { reason: 'we never serve enterprise SSO' })
    item('bare', 'dismissed')
    item('agents', 'dismissed', { by: 'agent', reason: 'duplicate of #3' })
    item('old', 'dismissed', { reason: 'not our market', at: Date.now() - 3 * DAY })
    const since = Date.now() - DAY
    assert.deepEqual(
      dismissalsToReview(since).map((d) => d.sourceId),
      ['mine'],
    )
    assert.equal(dismissalsToReview(since)[0]!.reason, 'we never serve enterprise SSO')
    assert.deepEqual(dismissalsToReview(0).map((d) => d.sourceId).sort(), ['mine', 'old'])
  })

  it('lists a cited id whose item was restored, and nothing the user wrote in brackets', () => {
    item('back', 'waiting')
    item('carded', 'archived')
    item('still', 'dismissed', { reason: 'no', at: Date.now() - 3 * DAY })
    memory(
      [
        '# Triage preferences',
        '',
        '## skill',
        '- **No SSO**: we do not serve enterprise (back, still)',
        '- **No mobile**: desktop only (carded)',
        '- **Keep it small**: my own words (e.g. this one)',
        '',
      ].join('\n'),
    )
    assert.deepEqual(citedSources(fs.readFileSync(memoryFile(), 'utf8')), ['back', 'still', 'carded', 'e.g. this one'])
    assert.deepEqual(withdrawnSources().sort(), ['back', 'carded'])
  })

  it('is scaffolded with the planner memory', () => {
    scaffoldProjectMemory()
    assert.match(fs.readFileSync(memoryFile(), 'utf8'), /^# Triage preferences/)
  })
})

describe('the review the board starts on its own', () => {
  it('ships on, daily', () => {
    assert.deepEqual(dismissalReview(), { enabled: true, cadence: '1d', lastRun: '' })
  })

  it('starts nothing while nothing waits', async () => {
    item('agents', 'dismissed', { by: 'agent', reason: 'duplicate' })
    item('bare', 'dismissed')
    assert.deepEqual(await work(), [])
  })

  it('starts one for a new reason', async () => {
    item('mine', 'dismissed', { reason: 'not for us' })
    assert.deepEqual(await work(), ['review-dismissals'])
  })

  it('starts one for a restored item alone', async () => {
    stampDismissalReview(new Date(Date.now() - 2 * DAY))
    item('back', 'waiting')
    memory('## skill\n- **No SSO**: never (back)\n')
    assert.deepEqual(await work(), ['review-dismissals'])
  })

  it('starts nothing once switched off, and keeps the cadence', async () => {
    item('mine', 'dismissed', { reason: 'not for us' })
    assert.deepEqual(setDismissalReview({ enabled: false, cadence: '3d' }), { ok: true })
    assert.deepEqual(dismissalReview(), { enabled: false, cadence: '3d', lastRun: '' })
    assert.deepEqual(await work(), [])
  })

  it('keeps a changed cadence across a reload, and is due on it', async () => {
    assert.deepEqual(setDismissalReview({ enabled: true, cadence: '6h' }), { ok: true })
    assert.match(fs.readFileSync(UI_CONFIG, 'utf8'), /"cadence": "6h"/)
    assert.equal(dismissalReview().cadence, '6h')
    stampDismissalReview(new Date(Date.now() - 7 * HOUR))
    item('mine', 'dismissed', { reason: 'not for us' })
    assert.deepEqual(await work(), ['review-dismissals'])
    stampDismissalReview(new Date(Date.now() - 5 * HOUR))
    assert.deepEqual(await work(), [])
  })

  it('refuses a cadence it cannot read, and saves nothing', () => {
    const res = setDismissalReview({ enabled: true, cadence: 'weekly' })
    assert.equal(res.ok, false)
    assert.match(res.error!, /isn't a cadence/)
    assert.equal(dismissalReview().cadence, '1d')
  })

  it('writes nothing while the schedule is back at the default', () => {
    setDismissalReview({ enabled: false, cadence: '1d' })
    setDismissalReview({ enabled: true, cadence: '1d' })
    assert.doesNotMatch(fs.existsSync(UI_CONFIG) ? fs.readFileSync(UI_CONFIG, 'utf8') : '', /dismissalReview/)
  })

  it('starts nothing while one is going', async () => {
    item('mine', 'dismissed', { reason: 'not for us' })
    pastRuns({ status: 'running', startedAt: Date.now() - 60_000 })
    assert.deepEqual(await work(), [])
  })

  it('does not retry a failure on the next tick, and does on the next cycle', async () => {
    const reason = Date.now() - 2 * DAY
    item('mine', 'dismissed', { reason: 'not for us', at: reason })
    pastRuns({ status: 'error', startedAt: Date.now() - 60_000 })
    assert.deepEqual(await work(), [])
    pastRuns({ status: 'error', startedAt: Date.now() - DAY - 60_000 })
    assert.deepEqual(await work(), ['review-dismissals'])
    // the window never moved, so the reason the failure missed is still in it
    assert.deepEqual(dismissalsToReview(0).map((d) => d.sourceId), ['mine'])
  })
})

describe('Review now', () => {
  it('starts whatever the cadence says, and never a second one', () => {
    setDismissalReview({ enabled: false, cadence: '7d' })
    stampDismissalReview(new Date())
    const first = openRun({ action: 'review-dismissals' }, 'a prompt')
    assert.ok(!('error' in first))
    const second = openRun({ action: 'review-dismissals' }, 'a prompt')
    assert.ok('error' in second)
    assert.match(second.error, /already being reviewed/)
  })
})

describe('the window', () => {
  it('moves to the start of a pass, and not on a failure', async () => {
    const started = Date.now() - 10 * 60_000
    pastRuns({ status: 'running', startedAt: started })
    await closeRun('past-0', { status: 'error' }, { reportEnd: false })
    assert.equal(dismissalReview().lastRun, '')

    pastRuns({ status: 'running', startedAt: started })
    await closeRun('past-0', { status: 'done', ok: true, code: 0 }, { reportEnd: false })
    assert.equal(dismissalReview().lastRun, formatStamp(new Date(started)))
  })
})

describe('what the review is handed', () => {
  it('lists each dismissal with its reason, the withdrawn ids and the file it writes', () => {
    item('mine', 'dismissed', { reason: 'we never serve enterprise SSO' })
    item('back', 'waiting')
    memory('## skill\n- **No SSO**: never (back)\n')
    const said = quiet(() => printFlow({ action: 'review-dismissals' }))
    assert.match(said, /mine — item mine/)
    assert.match(said, /reason: we never serve enterprise SSO/)
    assert.match(said, /withdrawn\s+back/)
    assert.match(said, /memory\/agents\/planner\/dismissed\.md/)
    assert.match(said, /none has been reviewed yet/)
  })

  it('points the ask at the guide, which holds the rules', () => {
    assert.match(buildAsk({ action: 'review-dismissals' }), /akb guide review-dismissals/)
    const guide = findGuide('review-dismissals')!.text
    assert.match(guide, /Never infer one/)
    assert.match(guide, /Withdraw restored evidence/)
    assert.match(guide, /a line with no source id was written by the user/)
  })

  it('has triage read the preferences, below the goal and the run’s own instruction', () => {
    const triage = findGuide('triage')!.text
    assert.match(triage, /`dismissed\.md` is the user's triage taste/)
    assert.match(triage, /let the goal and any\s+instruction given with this run win over it/)
    assert.match(findGuide('prune-memory')!.text, /keep every source id/)
  })
})
