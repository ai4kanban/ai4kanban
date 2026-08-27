// Refinement is one exhaustive QA session followed by one writing session. Applying user
// answers performs that QA inside Resolve and may hand straight to writing.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { refineRunsAfter } from '../src/lib/agent/follow.ts'
import {
  markBoard,
  refinementRequest,
  refinementRunsAfter,
  type BoardMarks,
} from '../src/lib/agent/refine.ts'
import {
  askForRefine,
  clearAsks,
  closeRun,
  finishWriting,
  openRun,
  readRefineAsks,
} from '../src/lib/agent/sessions.ts'
import type { AgentAction, RunRecord } from '../src/lib/agent/types.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-refine-'))
const track = path.join(root, 'docs', 'kanban', 'todo', 'skill')
const cardFile = path.join(track, '7-a-card-to-refine.md')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(track, { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'README.md'), '# Open tasks\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '8\n')
  setBoardRoot(root)
  setBoardProvider(null)
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
      action: 'clarify',
      id: 7,
      title: 'A card to refine',
      notes: undefined,
      refineRound: 1,
    })
  })

  it('starts the same QA session when untagged questions already exist', () => {
    writeCard({ questions: ['Which boundary applies?'] })
    const request = refinementRequest({ action: 'refine', id: 7 })
    assert.ok(!('error' in request))
    assert.equal(request.action, 'clarify')
  })

  it('starts the same QA session with mixed tagged and untagged questions', () => {
    writeCard({ questions: ['[user] Which layout?', 'Which boundary applies?'] })
    const request = refinementRequest({ action: 'refine', id: 7 })
    assert.ok(!('error' in request))
    assert.equal(request.action, 'clarify')
  })
})

describe('the QA pass', () => {
  it('goes straight from a clean audit to writing', () => {
    writeCard()
    const { runs, stalled } = afterSession('clarify', 1, () => {})
    assert.equal(stalled, undefined)
    assert.deepEqual(runs.map((r) => [r.action, r.refineRound]), [['writing', 2]])
  })

  it('goes to writing after exhausting an existing question list', () => {
    writeCard({ questions: ['Which boundary applies?'] })
    const { runs, stalled } = afterSession('clarify', 1, () => {
      writeCard({ body: 'The boundary is settled.' })
    })
    assert.equal(stalled, undefined)
    assert.deepEqual(runs.map((r) => [r.action, r.refineRound]), [['writing', 2]])
  })

  it('waits when QA leaves only revalidated user questions', () => {
    writeCard({ questions: ['Which boundary applies?'] })
    const { runs, stalled } = afterSession('clarify', 1, () => {
      writeCard({ questions: ['[user] Which boundary applies?'] })
    })
    assert.deepEqual(runs, [])
    assert.equal(stalled, undefined)
  })

  it('reports an untagged question as incomplete instead of starting another session', () => {
    writeCard()
    const { runs, stalled } = afterSession('clarify', 1, () => {
      writeCard({ questions: ['Which boundary applies?'] })
    })
    assert.deepEqual(runs, [])
    assert.match(stalled ?? '', /QA left untagged questions/)
  })

  it('waits for requested spec agents instead of starting writing', () => {
    writeCard()
    const before = markBoard()
    const { runs, stalled } = refinementRunsAfter(run('clarify', 1), before, true)
    assert.deepEqual(runs, [])
    assert.equal(stalled, undefined)
  })
})

describe('applying user answers', () => {
  const resolveRun = (flowId = 'answer-flow'): RunRecord => ({
    ...run('resolve', 1, { flowId }),
    refineRound: undefined,
  })

  it('hands a resolved and validated card straight to writing', () => {
    writeCard({ questions: ['[user] Which boundary applies?'] })
    const before = markBoard()
    writeCard({ body: 'The selected boundary is applied.' })
    const { runs, stalled } = refinementRunsAfter(resolveRun(), before)
    assert.equal(stalled, undefined)
    assert.deepEqual(
      runs.map((r) => [r.action, r.refineRound, r.flowId]),
      [['writing', 1, 'answer-flow']],
    )
  })

  it('waits when post-answer QA leaves user decisions', () => {
    writeCard({ questions: ['[user] Which boundary?', '[user] Which layout?'] })
    const before = markBoard()
    writeCard({ body: 'The boundary is applied.', questions: ['[user] Which layout?'] })
    const { runs, stalled } = refinementRunsAfter(resolveRun(), before)
    assert.deepEqual(runs, [])
    assert.equal(stalled, undefined)
  })

  it('reports post-answer QA that leaves an untagged question as incomplete', () => {
    writeCard({ questions: ['[user] Which boundary applies?'] })
    const before = markBoard()
    writeCard({ questions: ['Which dependent boundary applies?'] })
    const { runs, stalled } = refinementRunsAfter(resolveRun(), before)
    assert.deepEqual(runs, [])
    assert.match(stalled ?? '', /QA left untagged questions/)
  })
})

describe('writing', () => {
  it('marks the card ready as board-owned bookkeeping', async () => {
    writeCard()
    await finishWriting(7)
    assert.match(fs.readFileSync(cardFile, 'utf8'), /^status: ready$/m)
  })

  it('cannot mark a card with open questions ready', async () => {
    writeCard({ questions: ['[user] Which boundary applies?'] })
    await assert.rejects(finishWriting(7), /did not reach ready/)
    assert.match(fs.readFileSync(cardFile, 'utf8'), /^status: todo$/m)
  })

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

// A job is several sessions long, and the record has to say so: the runs panel groups by
// this id, so a broken chain reads as unrelated runs on the same card.
describe('one job, several sessions', () => {
  const openPass = (round: number, flowId?: string) => {
    const opened = openRun(
      { action: 'clarify', id: 7, title: 'A card to refine', refineRound: round, flowId },
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
    const { runs } = refinementRunsAfter(first, before)
    assert.deepEqual(
      runs.map((r) => [r.action, r.flowId]),
      [['writing', first.flowId]],
    )
  })

  it('gives an ordinary run a flow of its own, so the panel can hang its sessions off it', () => {
    writeCard()
    const opened = openRun({ action: 'edit', id: 7, title: 'A card to refine' }, 'prompt', [])
    if ('error' in opened) throw new Error(opened.error)
    assert.ok(opened.run.flowId)
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

// A revise applies the requested change and validates it in the same session.
describe('a revise', () => {
  const reviseRun = (flowId = 'revise-flow'): RunRecord => ({
    ...run('edit', 1, { flowId }),
    refineRound: undefined,
  })

  it('hands a revised and validated card straight to writing', () => {
    writeCard()
    const before = markBoard()
    writeCard({ body: 'The plan, revised.' })
    const { runs, stalled } = refinementRunsAfter(reviseRun(), before)
    assert.equal(stalled, undefined)
    assert.deepEqual(
      runs.map((r) => [r.action, r.refineRound, r.flowId]),
      [['writing', 1, 'revise-flow']],
    )
  })

  it('waits when post-revision QA leaves user decisions', () => {
    writeCard({ questions: ['[user] Which boundary applies?'] })
    const before = markBoard()
    writeCard({ body: 'The plan, revised.', questions: ['[user] Which boundary applies?'] })
    const { runs, stalled } = refinementRunsAfter(reviseRun(), before)
    assert.deepEqual(runs, [])
    assert.equal(stalled, undefined)
  })

  it('reports post-revision QA that leaves an untagged question as incomplete', () => {
    writeCard()
    const before = markBoard()
    writeCard({ questions: ['Which boundary applies?'] })
    const { runs, stalled } = refinementRunsAfter(reviseRun(), before)
    assert.deepEqual(runs, [])
    assert.match(stalled ?? '', /QA left untagged questions/)
  })
})

describe('an explicit refine handoff', () => {
  it('writes one ask down however many times the run asks', () => {
    writeCard()
    const opened = openRun({ action: 'edit', id: 7, title: 'A card to refine' }, 'prompt', [])
    if ('error' in opened) throw new Error(opened.error)
    const { sessionId } = opened.run
    assert.equal(askForRefine(sessionId, { cardId: 7 }), 'queued')
    assert.equal(askForRefine(sessionId, { cardId: 7 }), 'already')
    assert.deepEqual(readRefineAsks(sessionId), [{ cardId: 7, notes: undefined }])
    clearAsks(sessionId)
    assert.deepEqual(readRefineAsks(sessionId), [])
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
    assert.deepEqual(runs.map((r) => [r.action, r.refineRound]), [['clarify', 1]])
  })

  it('resumes QA even when a spec agent could not write a section', () => {
    writeCard()
    const before = markBoard()
    const { runs, stalled } = refinementRunsAfter(
      { ...run('spec', 1), refineRound: undefined },
      before,
    )
    assert.equal(stalled, undefined)
    assert.deepEqual(runs.map((r) => [r.action, r.refineRound]), [['clarify', 1]])
  })
})
