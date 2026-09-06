// The decider (#447): when the board answers a card's questions itself, what it writes down,
// and what a delivery says while it does.
//
// Nothing spawns here. All three parts are decisions taken from the board and the switch —
// which card is answerable, whether the board would still answer it, and how a stopped
// delivery is worded — so the tests are those functions against a board written on disk.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { cmdUpdateDecided } from '../src/commands/card.ts'
import { decidable, decideRunAfter, decidingOn } from '../src/lib/agent/decide.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { claimChanges, markBoard, refinementRunsAfter } from '../src/lib/agent/refine.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { deciderOn, setDecider } from '../src/lib/agent/settings.ts'
import type { DeliveryRecord, RunRecord, RunStatus } from '../src/lib/agent/types.ts'
import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'
import { findCard } from '../src/lib/view/read.ts'

let root = ''

const TRACK = (): string => path.join(root, 'docs', 'kanban', 'todo', 'skill')

const cardText = (
  { status = 'todo', blockedBy = [] as number[], questions = [] as string[] } = {},
): string =>
  [
    '---',
    'title: A card with a question',
    'priority: med',
    'roi: med',
    `status: ${status}`,
    'release: ""',
    `blocked_by: [${blockedBy.join(', ')}]`,
    'related: []',
    'modules: []',
    questions.length
      ? `questions:\n${questions.map((q) => `  - ${JSON.stringify(q)}`).join('\n')}`
      : 'questions: []',
    '---',
    '',
    'What this card is for.',
    '',
    '<!-- agent -->',
    '',
    '## Scope',
    '- **A requirement**: something observable.',
    '',
  ].join('\n')

const card = (id: number, opts: Parameters<typeof cardText>[0] = {}): void => {
  fs.writeFileSync(path.join(TRACK(), `${id}-a-card.md`), cardText(opts))
}

// A delivery whose review stopped on the question the card carries, which is the wait the
// decider answers.
const stopped = (): DeliveryRecord =>
  ({
    deliveryId: 'd1',
    cardId: 7,
    title: 'A card with a question',
    status: 'active',
    commitMode: 'auto',
    sessions: [],
    review: { rounds: [], stopped: { reason: 'ask', why: 'one call is yours', at: 0 } },
  }) as unknown as DeliveryRecord

// One decide run on #7, as the record holds it. Written straight into the store: what
// `decidingOn` reads is the newest one's status, and nothing here needs a process.
const decideRun = (status: RunStatus, startedAt: number): void => {
  withStore((store) => {
    store.runs.push({
      sessionId: `s${startedAt}`,
      cardId: 7,
      action: 'decide',
      status,
      startedAt,
      harness: 'test',
      logPath: '/dev/null',
    })
  })
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-decider-'))
  fs.mkdirSync(TRACK(), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'README.md'), '# Open tasks\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '99\n')
  setBoardRoot(root)
  setBoardProvider(null)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('the switch', () => {
  it('is off until somebody turns it on, and writes nothing until then', () => {
    assert.equal(deciderOn(), false)
    assert.equal(fs.existsSync(UI_CONFIG), false)

    assert.equal(setDecider(true).ok, true)
    assert.equal(deciderOn(), true)
    assert.equal(JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')).decider, true)

    // Off drops the key rather than writing `false`: a missing key and a `false` mean the
    // same thing, and only one of them reads as deliberate.
    assert.equal(setDecider(false).ok, true)
    assert.equal(deciderOn(), false)
    assert.equal('decider' in JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')), false)
  })
})

describe('which card it answers', () => {
  it('takes a card left with nothing but the user’s calls', () => {
    setDecider(true)
    card(7, { questions: ['[user] Which one?'] })
    assert.equal(decidable(findCard(7)!), true)
    assert.deepEqual(decideRunAfter(7), { action: 'decide', id: 7, title: 'A card with a question' })
  })

  it('leaves an untagged question to QA, and a blocked or unquestioned card alone', () => {
    setDecider(true)
    card(7, { questions: ['[user] Which one?', 'Still to triage'] })
    assert.equal(decidable(findCard(7)!), false)

    card(8)
    assert.equal(decidable(findCard(8)!), false)

    card(9, { questions: ['[user] Which one?'], blockedBy: [7] })
    assert.equal(decidable(findCard(9)!), false)
  })

  it('starts nothing while the switch is off — read as the run would start, not when the card moved', () => {
    card(7, { questions: ['[user] Which one?'] })
    assert.equal(decideRunAfter(7), null)
    setDecider(true)
    assert.notEqual(decideRunAfter(7), null)
  })
})

describe('whether the board is still answering', () => {
  it('gives the card back to the user once a decide run has failed', () => {
    setDecider(true)
    card(7, { questions: ['[user] Which one?'] })
    assert.equal(decidingOn(7), true)

    decideRun('done', 1)
    assert.equal(decidingOn(7), true)

    // The newest one gave up, and nothing starts another by itself — so the card reads as
    // the user's again, however many rounds it answered before this.
    decideRun('error', 2)
    assert.equal(decidingOn(7), false)

    // A new appearance of the question is a new trigger, not a retry: the START is gated on
    // the switch alone, so the next event still hands it one.
    assert.notEqual(decideRunAfter(7), null)
  })
})

describe('what a stopped delivery says', () => {
  it('asks the user while the decider is off, and says so while it is answering', () => {
    const waiting = deliveryState(stopped(), 1, false)
    assert.equal(waiting.label, 'Waiting on you')
    assert.equal(waiting.paused, true)
    assert.equal(waiting.deciding, undefined)

    const answering = deliveryState(stopped(), 1, true)
    assert.equal(answering.stage, 'stopped')
    assert.equal(answering.label, 'Decider is answering')
    assert.equal(answering.paused, false)
    assert.equal(answering.deciding, true)
  })
})

describe('what it wrote down', () => {
  it('keeps the question, the choice and the file it went on — and nothing when it never ran', () => {
    card(7, { questions: ['[user] Which one?'] })
    const before = parseFrontmatter(fs.readFileSync(path.join(TRACK(), '7-a-card.md'), 'utf8')).meta!
    assert.deepEqual(before.decided, [])
    // A card it never answered keeps the frontmatter it always had.
    assert.equal(serializeFrontmatter(before).includes('decided:'), false)

    cmdUpdateDecided(7, { question: 'Which one?', chose: 'B', from: 'docs/kanban/memory/goal.md' })
    cmdUpdateDecided(7, { question: 'And how long?', chose: '30 days' })

    const meta = parseFrontmatter(fs.readFileSync(path.join(TRACK(), '7-a-card.md'), 'utf8')).meta!
    assert.deepEqual(meta.decided, [
      { question: 'Which one?', chose: 'B', from: 'docs/kanban/memory/goal.md' },
      { question: 'And how long?', chose: '30 days', from: '' },
    ])
    // Taken blind, so no `from:` line at all — that is the case the card page draws apart.
    assert.equal(serializeFrontmatter(meta).includes('from: docs/kanban/memory/goal.md'), true)
    assert.equal(findCard(7)!.decided.length, 2)

    cmdUpdateDecided(7, { drop: '1' })
    assert.deepEqual(findCard(7)!.decided.map((d) => d.chose), ['30 days'])
    cmdUpdateDecided(7, { clear: true })
    assert.deepEqual(findCard(7)!.decided, [])
  })
})

describe('what follows the run', () => {
  it('hands the answered card its writing pass, the way a resolve does', () => {
    setDecider(true)
    card(7, { questions: ['[user] Which one?'] })
    const before = markBoard()

    // What the decide run leaves behind: the question gone, the choice recorded.
    card(7)
    cmdUpdateDecided(7, { question: 'Which one?', chose: 'B', from: 'docs/kanban/memory/goal.md' })

    const run: RunRecord = {
      sessionId: 'decide-7',
      cardId: 7,
      action: 'decide',
      status: 'done',
      startedAt: 0,
      harness: 'test',
      logPath: '/dev/null',
    }
    // Not another QA round: the decide already settled the plan in its own session, exactly
    // as a resolve does, so what is owed is the writing pass.
    assert.deepEqual(refinementRunsAfter(run, claimChanges(before, run.sessionId), before).runs, [
      { action: 'writing', id: 7, title: 'A card with a question', refineRound: 1, refineEffort: 'standard' },
    ])
  })
})
