// Review is one fresh session: it judges the delivery, fixes plain mistakes itself, and
// passes unless it appends a validated user decision to the card.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import {
  activeDelivery,
  answeredWork,
  deliveryRunAfter,
  deliveryWaiting,
  joinActive,
  joinDelivery,
  settleDelivery,
} from '../src/lib/agent/deliveries.ts'
import { readStore, withStore } from '../src/lib/agent/store.ts'
import type { AgentAction, RunRecord } from '../src/lib/agent/types.ts'
import { DELIVERIES, setBoardRoot } from '../src/lib/paths.ts'
import { move } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-review-'))

const ask = (argv: string[]): Promise<Record<string, unknown>> => move(root, ['update-questions', '5', ...argv])
const todo = path.join(root, 'docs', 'kanban', 'todo')
const file = path.join(todo, 'features', '5-a-card.md')
const code = path.join(root, 'src.txt')

const CARD = [
  '---',
  'title: A card',
  'track: features',
  'priority: med',
  'roi: med',
  'status: ready',
  'release: ""',
  'blocked_by: []',
  'related: []',
  'modules: []',
  'questions: []',
  '---',
  '',
  'What this card is for, in one paragraph.',
  '',
  '## Worth noting',
  '- **A call**: its answer.',
  '',
  '<!-- agent -->',
  '',
  '## Scope',
  '- **A requirement**: one line.',
  '',
  '## Todo',
  '- [ ] the first step',
  '',
].join('\n')

const git = (...args: string[]): void => {
  const out = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
}

beforeEach(() => {
  git('reset', '--hard', '--quiet')
  git('clean', '-qfd')
  fs.mkdirSync(path.join(todo, 'features'), { recursive: true })
  fs.writeFileSync(file, CARD)
  setBoardRoot(root)
})

git('init', '--quiet', '-b', 'main')
git('config', 'user.email', 'test@example.com')
git('config', 'user.name', 'test')
fs.writeFileSync(code, 'as it was\n')
git('add', '-A')
git('commit', '--quiet', '-m', 'start')

after(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

let next = 0
const session = (action: AgentAction = 'implement', over: Partial<RunRecord> = {}): RunRecord => ({
  sessionId: `s${++next}`,
  cardId: 5,
  action,
  status: 'running',
  startedAt: 1_000 + next,
  harness: 'claude-code',
  logPath: path.join(root, 'docs', 'kanban', '.sessions', `s${next}.log`),
  ...over,
})

function build(): RunRecord {
  const run = session('implement')
  withStore((store) => {
    store.runs.push(run)
    joinDelivery(store, run, 'A card', 'implement')
  })
  return { ...readStore().runs.find((r) => r.sessionId === run.sessionId)! }
}

function carryOn(after: RunRecord): RunRecord {
  const req = deliveryRunAfter(after)
  assert.ok(req, 'the delivery should have said what comes next')
  const run = session(req.action)
  withStore((store) => {
    store.runs.push(run)
    joinActive(store, run, req.action)
  })
  return { ...readStore().runs.find((r) => r.sessionId === run.sessionId)! }
}

async function close(run: RunRecord, status: RunRecord['status'] = 'done'): Promise<RunRecord> {
  const closed = withStore((store) => {
    const found = store.runs.find((r) => r.sessionId === run.sessionId)!
    found.status = status
    found.endedAt = Date.now()
    return { ...found }
  })
  await settleDelivery(closed)
  return closed
}

const questions = (): string[] =>
  fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().startsWith('- ') && line.includes('[user]'))
    .map((line) => line.trim())

const readAudit = (id: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(DELIVERIES, `${id}.json`), 'utf8'))

const passedOn = (cardId: number): boolean => {
  const delivery = activeDelivery(cardId)
  if (!delivery) return true
  return delivery.next === undefined && !delivery.review?.stopped && delivery.reviewed !== undefined
}

describe('reviewing and fixing in one session', () => {
  it('reviews after implementation and finishes on pass', async () => {
    const built = build()
    const id = activeDelivery(5)!.deliveryId
    await close(built)
    const review = carryOn(built)
    assert.equal(review.action, 'review')
    await close(review)

    assert.equal(passedOn(5), true)
    assert.equal(deliveryRunAfter(review), null)
    assert.equal(readAudit(id).reviewed !== undefined, true)
  })

  it('keeps fixes made by the review and needs no correction run', async () => {
    const built = build()
    await close(built)
    const review = carryOn(built)
    fs.writeFileSync(code, 'fixed by review\n')
    await close(review)

    assert.equal(fs.readFileSync(code, 'utf8'), 'fixed by review\n')
    assert.equal(deliveryRunAfter(review), null)
    assert.equal(activeDelivery(5)!.review!.rounds.length, 1)
  })

  it('waits when implementation was cut off', async () => {
    const built = build()
    await close(built, 'interrupted')
    assert.equal(activeDelivery(5)?.status, 'active')
    assert.equal(deliveryRunAfter(built), null)
    assert.equal(deliveryWaiting(5), undefined)
  })
})

describe('stopping for the user', () => {
  it('waits on the exact validated question review appended', async () => {
    const built = build()
    await close(built)
    const review = carryOn(built)
    await ask(['--append',
      '[user] Which retry behavior should apply?',
      '--recommended-option',
      'Retry once — recovers transient failures with one delay',
      '--option',
      'Do not retry — fails immediately without duplicate work',
    ])
    await close(review)
    assert.match(deliveryWaiting(5) ?? '', /open decision/)
    assert.equal(questions().length, 1)
    assert.match(questions()[0]!, /Which retry behavior should apply\?/)
    assert.doesNotMatch(questions()[0]!, /delivery|ai4kanban\.mjs|review 5/i)
  })

  it('leaves a failed review unfinished without inventing a question', async () => {
    const built = build()
    await close(built)
    await close(carryOn(built), 'error')
    assert.equal(activeDelivery(5)?.status, 'active')
    assert.equal(deliveryWaiting(5), undefined)
    assert.equal(questions().length, 0)
  })

  it('does not add a question when the user stopped the session', async () => {
    const built = build()
    await close(built)
    await close(carryOn(built), 'stopped')
    assert.equal(deliveryWaiting(5), undefined)
    assert.equal(questions().length, 0)
  })

  it('clears the question stop when a fresh review starts', async () => {
    const built = build()
    await close(built)
    const first = carryOn(built)
    await ask(['--append',
      '[user] Which retry behavior should apply?',
      '--recommended-option',
      'Retry once — recovers transient failures',
      '--option',
      'Do not retry — fails immediately',
    ])
    await close(first)
    assert.ok(deliveryWaiting(5))
    await ask(['--drop', '1'])
    const again = session('review')
    withStore((store) => {
      store.runs.push(again)
      joinActive(store, again, 'review')
    })
    assert.equal(deliveryWaiting(5), undefined)
    await close(again)
    assert.equal(passedOn(5), true)
  })

  it('stops waiting the moment the question is answered, and asks for the review itself', async () => {
    const built = build()
    await close(built)
    const first = carryOn(built)
    await ask(['--append',
      '[user] Which retry behavior should apply?',
      '--recommended-option',
      'Retry once — recovers transient failures',
      '--option',
      'Do not retry — fails immediately',
    ])
    await close(first)
    assert.ok(deliveryWaiting(5))

    // What `akb resolve` leaves behind: the answer is on the card and the question is gone.
    // It joins no delivery, so nothing but the card says the stop is over.
    await ask(['--drop', '1'])
    assert.equal(deliveryWaiting(5), undefined)
    assert.deepEqual(answeredWork(), [{ action: 'review', id: 5, title: 'A card' }])
    // A card with a run already on it is left for the next pass.
    assert.deepEqual(answeredWork(new Set([5])), [])

    // And the run that answered hands it on as it closes, rather than a tick later.
    const answering = session('resolve')
    withStore((store) => void store.runs.push(answering))
    const carry = deliveryRunAfter(await close(answering))
    assert.deepEqual(carry, { action: 'review', id: 5, title: 'A card' })
  })

  // The watcher asks with the row it claimed the card with — read before the run spawned,
  // never written back into, so its `status` still says `running` when the close has already
  // been recorded. Asked that way, the hand-off has to give the same answer: without it the
  // resolve carries on nothing and the card sits at `Review again` until a tick picks it up.
  it('hands the review on even when the caller holds the run as it was before it closed', async () => {
    const built = build()
    await close(built)
    const first = carryOn(built)
    await ask(['--append', '[user] Which retry behavior should apply?', '--recommended-option', 'Retry once — recovers transient failures', '--option', 'Do not retry — fails immediately'])
    await close(first)

    const answering = session('resolve')
    withStore((store) => void store.runs.push(answering))
    // Exactly what `watchRun` holds: the record as it was claimed, still `running`.
    const asClaimed: RunRecord = { ...answering }
    await ask(['--drop', '1'])
    await close(answering)

    assert.equal(asClaimed.status, 'running')
    assert.deepEqual(deliveryRunAfter(asClaimed), { action: 'review', id: 5, title: 'A card' })
  })

  // The other half of that rule: what decides is the card, not the run. A resolve that left
  // the question standing hands nothing on, however it ended.
  it('hands nothing on when the answering run left the question standing', async () => {
    const built = build()
    await close(built)
    const first = carryOn(built)
    await ask(['--append', '[user] Which retry behavior should apply?', '--recommended-option', 'Retry once — recovers transient failures', '--option', 'Do not retry — fails immediately'])
    await close(first)

    const answering = session('resolve')
    withStore((store) => void store.runs.push(answering))
    const asClaimed: RunRecord = { ...answering }
    await close(answering)

    assert.equal(deliveryRunAfter(asClaimed), null)
    assert.match(deliveryWaiting(5) ?? '', /open decision/)
  })

  it('goes on waiting while any question is still open', async () => {
    const built = build()
    await close(built)
    const first = carryOn(built)
    await ask(['--append', '[user] First?', '--recommended-option', 'A — the safe one', '--option', 'B — the other'])
    await ask(['--append', '[user] Second?', '--recommended-option', 'A — the safe one', '--option', 'B — the other'])
    await close(first)
    await ask(['--drop', '1'])

    assert.match(deliveryWaiting(5) ?? '', /open decision/)
    assert.deepEqual(answeredWork(), [])
  })

  it('does not mistake a question that predates implementation for one raised by review', async () => {
    await ask(['--append',
      '[user] Which shade should apply?',
      '--recommended-option',
      'Blue — matches the existing palette',
      '--option',
      'Green — distinguishes the new state',
    ])
    const built = build()
    await close(built)
    await close(carryOn(built))
    assert.equal(activeDelivery(5)?.review?.stopped, undefined)
    assert.equal(activeDelivery(5)?.review?.rounds.at(-1)?.verdict, 'pass')
  })
})
