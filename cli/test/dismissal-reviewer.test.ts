// Learning what the user does not want from rejection and dismissal reasons (#929, #1497).
//
// What a review writes is the agent's judgement; what is asserted here is everything around
// it: which rejections, dismissals and restored ids reach it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { formatStamp } from '../src/lib/cadence.ts'
import { citedSources, dismissalsToReview, rejectionsToReview, withdrawnSources } from '../src/lib/agent/dismissal-review.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { buildAsk } from '../src/lib/agent/prompts.ts'
import { openRun } from '../src/lib/agent/sessions.ts'
import { findGuide } from '../src/lib/guide.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { scaffoldProjectMemory } from '../src/lib/memory.ts'
import { REJECTIONS_TO_REVIEW, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')
const triage = (): string => path.join(kanban(), 'triage')
const memoryFile = (): string => path.join(kanban(), 'memory', 'agents', 'planner', 'rejected.md')

/** One triage item: waiting, dismissed with a reason, or archived into a card. */
function item(
  id: string,
  where: 'waiting' | 'dismissed' | 'archived',
  dismissal: { by?: 'user' | 'agent'; reason?: string } = {},
): void {
  const dir = where === 'waiting' ? triage() : path.join(triage(), where)
  fs.mkdirSync(dir, { recursive: true })
  const lines = ['---', `source_id: ${id}`, `title: item ${id}`, 'collected_at: 2026-09-01 09:00', 'imported_at: 2026-09-01 09:00']
  if (where === 'dismissed') {
    lines.push(`dismissed_at: ${formatStamp(new Date())}`, `dismissed_by: ${dismissal.by ?? 'user'}`)
    if (dismissal.reason) lines.push(`dismissed_reason: ${dismissal.reason}`)
  }
  if (where === 'archived') lines.push('card_id: 5', 'archived_at: 2026-09-02 09:00')
  lines.push('---', '', `what item ${id} says`, '')
  fs.writeFileSync(path.join(dir, `${id}.md`), lines.join('\n'))
}

/** One rejected card, as a Runner lays it out, or only in the board's own archive. */
function rejected(id: number, how: { by?: 'user' | 'agent' | ''; reason?: string; archived?: boolean } = {}): void {
  const dir = path.join(kanban(), '.archive', ...(how.archived ? [] : [REJECTIONS_TO_REVIEW]))
  fs.mkdirSync(dir, { recursive: true })
  const lines = ['---', `title: card ${id}`, 'priority: low', 'status: todo', 'blocked_by: []', 'related: []', 'modules: []', 'archived: 2026-09-01', 'rejected: true']
  if (how.reason) lines.push(`rejected_reason: ${how.reason}`)
  if (how.by !== '') lines.push(`rejected_at: '${new Date().toISOString()}'`, `rejected_by: ${how.by ?? 'user'}`)
  lines.push('questions: []', '---', '', `what card ${id} says`, '')
  fs.writeFileSync(path.join(dir, `${id}-card.md`), lines.join('\n'))
}

function memory(text: string): void {
  fs.mkdirSync(path.dirname(memoryFile()), { recursive: true })
  fs.writeFileSync(memoryFile(), text)
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
  it("takes only the user's dismissals that carry a reason, however old", () => {
    item('mine', 'dismissed', { reason: 'we never serve enterprise SSO' })
    item('bare', 'dismissed')
    item('agents', 'dismissed', { by: 'agent', reason: 'duplicate of #3' })
    assert.deepEqual(dismissalsToReview().map((d) => d.sourceId), ['mine'])
    assert.equal(dismissalsToReview()[0]!.reason, 'we never serve enterprise SSO')
  })

  it("takes only the user's rejections that carry a reason", () => {
    rejected(1, { reason: 'we never build a mobile app' })
    rejected(2)
    rejected(3, { by: 'agent', reason: 'superseded by #9' })
    rejected(4, { by: '', reason: 'a discard keeps its reason too' })
    assert.deepEqual(rejectionsToReview().map((r) => r.id), [1])
    assert.equal(rejectionsToReview()[0]!.reason, 'we never build a mobile app')
  })

  it('leaves the archive to Cloud: a task in both lists once, one only archived not at all (#199)', () => {
    rejected(1, { reason: 'new', archived: true })
    rejected(1, { reason: 'new' })
    rejected(2, { reason: 'already learned', archived: true })
    assert.deepEqual(rejectionsToReview().map((r) => r.id), [1])
  })

  it('lists a cited id whose item was restored, and nothing the user wrote in brackets', () => {
    item('back', 'waiting')
    item('carded', 'archived')
    item('still', 'dismissed', { reason: 'no' })
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
  it('never starts a second one', () => {
    const first = openRun({ action: 'review-dismissals' }, 'a prompt')
    assert.ok(!('error' in first))
    const second = openRun({ action: 'review-dismissals' }, 'a prompt')
    assert.ok('error' in second)
    assert.match(second.error, /already being reviewed/)
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
    assert.doesNotMatch(said, /window/)
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
