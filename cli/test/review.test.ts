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
import { answerOutcome, recordAnswer } from '../src/lib/agent/answers.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { readStore, withStore } from '../src/lib/agent/store.ts'
import type { AgentAction, RunRecord } from '../src/lib/agent/types.ts'
import { DELIVERIES, setBoardRoot } from '../src/lib/paths.ts'
import { move } from './helpers/board.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-review-'))

const ask = (argv: string[]): Promise<Record<string, unknown>> => move(root, ['update-questions', '5', ...argv])

// What the run that applied the answers says about them (#637). The board reads this rather
// than the card's text, so nothing carries on until it is written.
const said = (outcome: 'unchanged' | 'changed', why = 'the option it confirms was already built'): void => {
  recordAnswer(activeDelivery(5)!.deliveryId, outcome, why)
}
const todo = path.join(root, 'docs', 'kanban', 'todo')
const file = path.join(todo, 'features', '5-a-card.md')
const code = path.join(root, 'src.txt')

const CARD = [
  '---',
  'title: A card',
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
  forgetMachineState(root)
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

    // What `akb card resolve` leaves behind: the answer is on the card, the question is gone,
    // and it has said what the answer did to the build. It joins no delivery, so nothing but
    // the card and that conclusion say the stop is over.
    await ask(['--drop', '1'])
    said('unchanged')
    assert.equal(deliveryWaiting(5), undefined)
    // The request names the delivery as well as the card: that is what a build with no card
    // is found by, and a carded one carries it just the same (#428). It also names why the
    // review is happening, since it is not the first one (#417).
    const owed = activeDelivery(5)!.deliveryId
    assert.deepEqual(answeredWork(), [
      { action: 'review', id: 5, deliveryId: owed, title: 'A card', trigger: 'answered' },
    ])
    // A card with a run already on it is left for the next pass.
    assert.deepEqual(answeredWork(new Set([5])), [])

    // And the run that answered hands it on as it closes, rather than a tick later.
    const answering = session('resolve')
    withStore((store) => void store.runs.push(answering))
    const carry = deliveryRunAfter(await close(answering))
    assert.deepEqual(carry, { action: 'review', id: 5, deliveryId: owed, title: 'A card', trigger: 'answered' })
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
    said('unchanged')
    await close(answering)

    assert.equal(asClaimed.status, 'running')
    assert.deepEqual(deliveryRunAfter(asClaimed), {
      action: 'review',
      id: 5,
      deliveryId: activeDelivery(5)!.deliveryId,
      title: 'A card',
      trigger: 'answered',
    })
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

  // What the answers DID is what decides, and it is read rather than worked out (#637).
  describe('what the answers did', () => {
    // Get to the stop review leaves on the card, with its question answered.
    async function stopped(): Promise<void> {
      const built = build()
      await close(built)
      const first = carryOn(built)
      await ask(['--append', '[user] Which retry behavior should apply?', '--recommended-option', 'Retry once', '--option', 'Do not retry'])
      await close(first)
      await ask(['--drop', '1'])
    }

    it('reviews the same build again when the answers changed nothing', async () => {
      await stopped()
      said('unchanged')
      assert.equal(answeredWork().length, 1)
      assert.equal(deliveryState(activeDelivery(5)!, 0).stage, 'rereview')
    })

    // Every delivery here commits in the user's own checkout, so no landing pass can reopen
    // one: a change has nothing to act on it, and the review the answer asked for still runs
    // rather than the build wedging on a supersede nobody can make. What a change does to a
    // delivery that CAN be reopened is `one-click.test.ts`.
    it('records the change, and still reviews a build nothing can reopen', async () => {
      await stopped()
      said('changed', 'the retry policy it was approved to build is now a queue')
      assert.equal(activeDelivery(5)!.commitMode, 'manual')
      assert.equal(answerOutcome(activeDelivery(5)!), 'changed')
      assert.equal(answeredWork().length, 1)
    })

    it('guesses at nothing when no run said, and asks to be told', async () => {
      await stopped()
      assert.equal(answerOutcome(activeDelivery(5)!), 'none')
      assert.deepEqual(answeredWork(), [])
      const state = deliveryState(activeDelivery(5)!, 0)
      assert.equal(state.paused, true)
      assert.match(state.line, /delivery answered/)
    })

    it('takes a conclusion once, so a second pass carries nothing on', async () => {
      await stopped()
      said('unchanged')
      const again = session('review')
      withStore((store) => {
        store.runs.push(again)
        joinActive(store, again, 'review')
      })
      // The run it asked for has started, so the conclusion has had its effect.
      assert.equal(answerOutcome(activeDelivery(5)!), 'none')
      assert.deepEqual(answeredWork(), [])
    })

    it('keeps a real change from being answered away by the round after it', async () => {
      await stopped()
      said('changed', 'the approved retry policy is now a queue')
      said('unchanged', 'and this one only confirmed the wording')
      assert.equal(answerOutcome(activeDelivery(5)!), 'changed')
    })

    it('refuses a conclusion with no reason, and one about a delivery that has ended', async () => {
      await stopped()
      const id = activeDelivery(5)!.deliveryId
      assert.equal(recordAnswer(id, 'unchanged', '  ').ok, false)
      assert.equal(recordAnswer('nothing-here', 'unchanged', 'why').ok, false)
      assert.equal(answerOutcome(activeDelivery(5)!), 'none')
    })
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

// #417. A delivery's runs are handed back by whichever watcher happened to be closing, so
// the flow one of them arrives carrying can be another card's. The delivery is the job.
describe('one delivery, one job', () => {
  it('groups every run of a delivery under the delivery, whatever flow it arrived with', async () => {
    const built = build()
    const id = activeDelivery(5)!.deliveryId
    assert.equal(built.flowId, id)
    await close(built)

    // A review handed over by the watcher of an unrelated run, carrying that run's flow.
    const review = session('review', { flowId: 'another-card-flow' })
    withStore((store) => {
      store.runs.push(review)
      joinActive(store, review, 'review')
    })
    assert.equal(readStore().runs.find((r) => r.sessionId === review.sessionId)!.flowId, id)
  })

  it("keeps a review's trigger on the delivery's permanent record", async () => {
    const built = build()
    const id = activeDelivery(5)!.deliveryId
    await close(built)
    const review = session('review', { trigger: 'rebase' })
    withStore((store) => {
      store.runs.push(review)
      joinActive(store, review, 'review')
    })
    await close(review)

    const sessions = readAudit(id).sessions as { sessionId: string; trigger?: string }[]
    assert.equal(sessions.find((s) => s.sessionId === review.sessionId)?.trigger, 'rebase')
    // The first review after a build is the default and names none.
    assert.equal(sessions.find((s) => s.sessionId === built.sessionId)?.trigger, undefined)
  })
})
