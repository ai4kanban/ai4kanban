// Refinement is orchestration, not one agent job: a question audit and resolver loop until
// the plan is settled, followed by one writing session.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import {
  markBoard,
  refinementRequest,
  refinementRunsAfter,
  type BoardMarks,
} from '../src/lib/agent/refine.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import type { AgentAction, RunRecord } from '../src/lib/agent/types.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-refine-'))
const track = path.join(root, 'docs', 'kanban', 'todo', 'skill')
const cardFile = path.join(track, '7-a-card-to-refine.md')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(track, { recursive: true })
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

function writeCard(opts: { status?: string; body?: string; questions?: string[] } = {}): void {
  const questions = opts.questions?.length
    ? ['questions:', ...opts.questions.map((q) => `  - ${q}`)]
    : ['questions: []']
  fs.writeFileSync(
    cardFile,
    [
      '---',
      'title: A card to refine',
      'track: skill',
      'priority: med',
      'roi: med',
      `status: ${opts.status ?? 'todo'}`,
      'release: ""',
      'blocked_by: []',
      'related: []',
      'modules: []',
      ...questions,
      '---',
      '',
      opts.body ?? 'The plan as it stands.',
      '',
      '## Todo',
      '',
      '- [ ] build it',
      '',
    ].join('\n'),
  )
}

const run = (action: AgentAction, round: number, extra: Partial<RunRecord> = {}): RunRecord => ({
  sessionId: 's',
  cardId: 7,
  action,
  status: 'done',
  startedAt: 0,
  harness: 'test',
  logPath: '/dev/null',
  refineRound: round,
  ...extra,
})

function afterSession(
  action: AgentAction,
  round: number,
  wrote: () => void,
): ReturnType<typeof refinementRunsAfter> {
  const before: BoardMarks = markBoard()
  wrote()
  return refinementRunsAfter(run(action, round), before)
}

describe('entering refinement', () => {
  it('starts with a question audit when the card has no questions', () => {
    writeCard()
    assert.deepEqual(refinementRequest({ action: 'refine', id: 7 }), {
      action: 'raise-questions',
      id: 7,
      title: 'A card to refine',
      notes: undefined,
      refineRound: 1,
    })
  })

  it('starts with a resolver when questions already exist', () => {
    writeCard({ questions: ['Which boundary applies?'] })
    const request = refinementRequest({ action: 'refine', id: 7 })
    assert.ok(!('error' in request))
    assert.equal(request.action, 'resolve')
  })
})

describe('the QA loop', () => {
  it('goes straight from a clean audit to writing', () => {
    writeCard()
    const { runs, stalled } = afterSession('raise-questions', 1, () => {})
    assert.equal(stalled, undefined)
    assert.deepEqual(runs.map((r) => [r.action, r.refineRound]), [['writing', 2]])
  })

  it('hands questions from the audit to a resolver', () => {
    writeCard()
    const { runs } = afterSession('raise-questions', 1, () => {
      writeCard({ questions: ['Which boundary applies?'] })
    })
    assert.deepEqual(runs.map((r) => [r.action, r.refineRound]), [['resolve', 2]])
  })

  it('audits again after the resolver clears the questions', () => {
    writeCard({ questions: ['Which boundary applies?'] })
    const { runs, stalled } = afterSession('resolve', 2, () => {
      writeCard({ body: 'The boundary is settled.' })
    })
    assert.equal(stalled, undefined)
    assert.deepEqual(runs.map((r) => [r.action, r.refineRound]), [['raise-questions', 3]])
  })

  it('waits when the resolver leaves only user questions', () => {
    writeCard({ questions: ['Which boundary applies?'] })
    const { runs, stalled } = afterSession('resolve', 2, () => {
      writeCard({ questions: ['[user] Which boundary applies?'] })
    })
    assert.deepEqual(runs, [])
    assert.equal(stalled, undefined)
  })
})

describe('writing', () => {
  it('ends refinement when it marks the card ready', () => {
    writeCard()
    const { runs, stalled } = afterSession('writing', 2, () => {
      writeCard({ status: 'ready', body: 'A clear plan.' })
    })
    assert.deepEqual(runs, [])
    assert.equal(stalled, undefined)
  })

  it('reports a writer that leaves the card unsettled', () => {
    writeCard()
    const { runs, stalled } = afterSession('writing', 2, () => {})
    assert.deepEqual(runs, [])
    assert.match(stalled ?? '', /#7 is still at todo/)
  })
})

// A refinement is one job several sessions long, and the record has to say so: the runs
// panel groups by this id, so a broken chain reads as unrelated runs on the same card.
describe('one refinement, several sessions', () => {
  const openPass = (round: number, flowId?: string) => {
    const opened = openRun(
      { action: 'raise-questions', id: 7, title: 'A card to refine', refineRound: round, flowId },
      'prompt',
      [],
    )
    if ('error' in opened) throw new Error(opened.error)
    return opened.run
  }

  it('carries the first pass id down the loop', () => {
    writeCard()
    const first = openPass(1)
    assert.ok(first.flowId)
    const before = markBoard()
    writeCard({ questions: ['Which boundary applies?'] })
    const { runs } = refinementRunsAfter(first, before)
    assert.deepEqual(
      runs.map((r) => [r.action, r.flowId]),
      [['resolve', first.flowId]],
    )
  })

  it('gives a second refinement on the same card an id of its own', async () => {
    writeCard()
    const first = openPass(1)
    fs.writeFileSync(first.logPath, 'log\n')
    await closeRun(first.sessionId, { status: 'done', ok: true, code: 0 })
    const second = openPass(1)
    assert.ok(second.flowId)
    assert.notEqual(second.flowId, first.flowId)
  })
})

describe('specialized input', () => {
  it('starts a fresh audit after a spec agent writes its section', () => {
    writeCard()
    const before = markBoard()
    writeCard({ body: 'A plan with its specialized section.' })
    const { runs, stalled } = refinementRunsAfter(
      { ...run('spec', 1), refineRound: undefined },
      before,
    )
    assert.equal(stalled, undefined)
    assert.deepEqual(runs.map((r) => [r.action, r.refineRound]), [['raise-questions', 1]])
  })
})
