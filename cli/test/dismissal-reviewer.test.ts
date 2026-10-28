// Learning what the user does not want from rejection and dismissal reasons (#929, #1497).
//
// What a review writes is the agent's judgement; what is asserted here is everything around
// it: which rejections, dismissals and restored ids reach it, and that the window moves only
// on a pass.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { formatStamp } from '../src/lib/cadence.ts'
import { citedSources, dismissalsToReview, rejectionsToReview, withdrawnSources } from '../src/lib/agent/dismissal-review.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { dismissalReview, stampDismissalReview } from '../src/lib/agent/settings.ts'
import { findGuide } from '../src/lib/guide.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { scaffoldProjectMemory } from '../src/lib/memory.ts'
import { setBoardRoot, SESSIONS } from '../src/lib/paths.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const triage = (): string => path.join(kanban(), 'triage')
const memoryFile = (): string => path.join(kanban(), 'memory', 'agents', 'planner', 'rejected.md')

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

/** One archived card, rejected as the board would have stamped it. */
function rejected(id: number, how: { by?: 'user' | 'agent' | ''; reason?: string; at?: number } = {}): void {
  const dir = path.join(kanban(), '.archive')
  fs.mkdirSync(dir, { recursive: true })
  const lines = ['---', `title: card ${id}`, 'priority: low', 'roi: low', 'status: todo', 'blocked_by: []', 'related: []', 'modules: []', 'archived: 2026-09-01', 'rejected: true']
  if (how.reason) lines.push(`rejected_reason: ${how.reason}`)
  if (how.by !== '') lines.push(`rejected_at: '${new Date(how.at ?? Date.now()).toISOString()}'`, `rejected_by: ${how.by ?? 'user'}`)
  lines.push('questions: []', '---', '', `what card ${id} says`, '')
  fs.writeFileSync(path.join(dir, `${id}-card.md`), lines.join('\n'))
}

function memory(text: string): void {
  fs.mkdirSync(path.dirname(memoryFile()), { recursive: true })
  fs.writeFileSync(memoryFile(), text)
}

/** Review runs in the record. */
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

  it("takes only the user's rejections that carry a reason, inside the window", () => {
    rejected(1, { reason: 'we never build a mobile app' })
    rejected(2)
    rejected(3, { by: 'agent', reason: 'superseded by #9' })
    rejected(4, { by: '', reason: 'a discard keeps its reason too' })
    rejected(5, { reason: 'not our market', at: Date.now() - 3 * DAY })
    const since = Date.now() - DAY
    assert.deepEqual(rejectionsToReview(since).map((r) => r.id), [1])
    assert.equal(rejectionsToReview(since)[0]!.reason, 'we never build a mobile app')
    assert.deepEqual(rejectionsToReview(0).map((r) => r.id).sort(), [1, 5])
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
        '- **No mobile**: desktop only (carded, #12)',
        '- **Keep it small**: my own words (e.g. this one)',
        '',
      ].join('\n'),
    )
    assert.deepEqual(citedSources(fs.readFileSync(memoryFile(), 'utf8')), ['back', 'still', 'carded', '#12', 'e.g. this one'])
    assert.deepEqual(withdrawnSources().sort(), ['back', 'carded'])
  })

  it('is scaffolded with the planner memory', () => {
    scaffoldProjectMemory()
    assert.match(fs.readFileSync(memoryFile(), 'utf8'), /^# Rejected/)
    assert.equal(fs.existsSync(path.join(path.dirname(memoryFile()), 'dismissed.md')), false)
  })
})

describe('Review now', () => {
  it('starts whenever the last pass was, and never a second one', () => {
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
    await closeRun('past-0', { status: 'error' })
    assert.equal(dismissalReview().lastRun, '')

    pastRuns({ status: 'running', startedAt: started })
    await closeRun('past-0', { status: 'done', ok: true, code: 0 })
    assert.equal(dismissalReview().lastRun, formatStamp(new Date(started)))
  })
})

describe('what the review is handed', () => {
  it('lists each rejection and dismissal with its reason, the withdrawn ids and the file it writes', () => {
    rejected(7, { reason: 'we never build a mobile app' })
    item('mine', 'dismissed', { reason: 'we never serve enterprise SSO' })
    item('back', 'waiting')
    memory('## skill\n- **No SSO**: never (back)\n')
    const said = quiet(() => printFlow({ action: 'review-dismissals' }))
    assert.match(said, /#7 — card 7/)
    assert.match(said, /reason: we never build a mobile app/)
    assert.match(said, /mine — item mine/)
    assert.match(said, /reason: we never serve enterprise SSO/)
    assert.match(said, /withdrawn\s+back/)
    assert.match(said, /memory\/agents\/planner\/rejected\.md/)
    assert.match(said, /none has been reviewed yet/)
  })

  it('takes every reason on the board with --all, whatever the window (#2067)', () => {
    stampDismissalReview(new Date())
    rejected(7, { reason: 'we never build a mobile app', at: Date.now() - 30 * DAY })
    item('old', 'dismissed', { reason: 'not for teams', at: Date.now() - 30 * DAY })
    const windowed = quiet(() => printFlow({ action: 'review-dismissals' }))
    assert.doesNotMatch(windowed, /#7 — card 7/)
    const all = quiet(() => printFlow({ action: 'review-dismissals', allReasons: true }))
    assert.match(all, /#7 — card 7/)
    assert.match(all, /old — item old/)
    assert.match(all, /every reason on the board/)
    assert.match(buildAsk({ action: 'review-dismissals', allReasons: true }), /review-dismissals --all --print/)
    assert.doesNotMatch(buildAsk({ action: 'review-dismissals' }), /--all/)
  })

  it('points the ask at the guide, which holds the rules', () => {
    assert.match(buildAsk({ action: 'review-dismissals' }), /akb guide review-rejections/)
    const guide = findGuide('review-rejections')!.text
    assert.match(guide, /Never infer one/)
    assert.match(guide, /Withdraw restored evidence/)
    assert.match(guide, /a line with no source was written by the user/)
  })

  it('has pruning keep every source id', () => {
    assert.match(findGuide('prune-memory')!.text, /keep\s+every source id/i)
  })
})
