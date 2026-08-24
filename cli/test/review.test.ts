// The review loop (#302): what a review says about a delivery's work, and what the delivery
// does about it — a clean pass, a corrected pass, a repeated issue, a correction that
// changed nothing, a session that failed, and the correction limit.
//
// The board here is a real git repository, because the candidate is a git question: a
// delivery records the commit it started from, and "this correction changed nothing" is
// that commit's diff being byte for byte what it was.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdReviewVerdict } from '../src/commands/review-verdict.ts'
import {
  activeDelivery,
  deliveryRunAfter,
  deliveryWaiting,
  joinActive,
  joinDelivery,
  settleDelivery,
} from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { MAX_CORRECTIONS, parseFindings } from '../src/lib/agent/review.ts'
import { readStore, withStore } from '../src/lib/agent/store.ts'
import type { AgentAction, RunRecord } from '../src/lib/agent/types.ts'
import { DELIVERIES, setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-review-'))
const todo = path.join(root, 'docs', 'kanban', 'todo')
const file = path.join(todo, 'features', '5-a-card.md')

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

// The one file the delivery's work lands in, so a correction can be made to change the
// candidate or to leave it exactly as it was.
const code = path.join(root, 'src.txt')

beforeEach(() => {
  // Back to the committed state first, so each test's delivery starts from a clean
  // candidate — `git clean` takes the board with it, which is why it comes before the
  // board is written.
  git('reset', '--hard', '--quiet')
  git('clean', '-qfd')
  fs.mkdirSync(path.join(todo, 'features'), { recursive: true })
  fs.writeFileSync(file, CARD)
  setBoardRoot(root)
  delete process.env[RUN_ENV]
})

git('init', '--quiet', '-b', 'main')
git('config', 'user.email', 'test@example.com')
git('config', 'user.name', 'test')
fs.writeFileSync(code, 'as it was\n')
git('add', '-A')
git('commit', '--quiet', '-m', 'start')

after(() => {
  delete process.env[RUN_ENV]
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

// Open a delivery with its first build session, the way openRun does.
function build(): RunRecord {
  const run = session('implement')
  withStore((store) => {
    store.runs.push(run)
    joinDelivery(store, run, 'A card', 'implement')
  })
  return { ...readStore().runs.find((r) => r.sessionId === run.sessionId)! }
}

// Start the session the delivery says comes next, the way the watcher does.
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

// End a session the way closeRun does, and hand the delivery its ending.
function close(run: RunRecord, status: RunRecord['status'] = 'done'): RunRecord {
  const closed = withStore((store) => {
    const found = store.runs.find((r) => r.sessionId === run.sessionId)!
    found.status = status
    found.endedAt = Date.now()
    return { ...found }
  })
  settleDelivery(closed)
  return closed
}

// Record a verdict as the review session itself does — from inside that session.
function verdict(sessionId: string, kind: 'pass' | 'correct' | 'ask', findings?: string): void {
  process.env[RUN_ENV] = sessionId
  try {
    cmdReviewVerdict(['5', '--verdict', kind, ...(findings ? ['--text', findings] : [])])
  } finally {
    delete process.env[RUN_ENV]
  }
}

const questions = (): string[] => {
  const text = fs.readFileSync(file, 'utf8')
  return text
    .split('\n')
    .filter((l) => l.trim().startsWith('- ') && l.includes('[user]'))
    .map((l) => l.trim())
}

const readAudit = (id: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(DELIVERIES, `${id}.json`), 'utf8'))

describe('reading a review answer', () => {
  it('takes each bullet as one finding, with its title as its identity', () => {
    const found = parseFindings(
      ['- **Empty input crashes**: `parse("")` throws in read.ts:20.', '- **Missing test**: nothing covers it.'].join('\n'),
    )
    assert.deepEqual(
      found.map((f) => f.title),
      ['Empty input crashes', 'Missing test'],
    )
    assert.match(found[0]!.detail, /read\.ts:20/)
  })

  it('folds a wrapped line back onto the finding above it', () => {
    const found = parseFindings(['- **One thing**: the first half', '      and the second half.'].join('\n'))
    assert.equal(found.length, 1)
    assert.match(found[0]!.detail, /first half and the second half/)
  })

  it('reads prose as one finding rather than refusing it', () => {
    const found = parseFindings('the change does not do what the card asked for')
    assert.equal(found.length, 1)
    assert.match(found[0]!.title, /does not do what the card asked/)
  })
})

describe('a clean pass', () => {
  it('reviews after the build, and finishes the delivery when review passes', () => {
    const built = build()
    const id = activeDelivery(5)!.deliveryId
    close(built)
    // The build did not end the delivery — review comes next.
    assert.equal(activeDelivery(5)?.deliveryId, id)
    const review = carryOn(built)
    assert.equal(review.action, 'review')
    verdict(review.sessionId, 'pass')
    close(review)
    assert.equal(activeDelivery(5), undefined)
    assert.equal(readAudit(id).status, 'finished')
  })

  it('waits rather than reviewing when the build was cut off', () => {
    const built = build()
    close(built, 'interrupted')
    assert.equal(activeDelivery(5)?.status, 'active')
    assert.equal(deliveryRunAfter(built), null)
    assert.equal(deliveryWaiting(5), undefined)
  })
})

describe('a corrected pass', () => {
  it('corrects what review found, reviews the whole candidate again, and finishes', () => {
    const built = build()
    const id = activeDelivery(5)!.deliveryId
    close(built)
    const first = carryOn(built)
    verdict(first.sessionId, 'correct', '- **Empty input crashes**: `parse("")` throws.')
    close(first)

    const fix = carryOn(first)
    assert.equal(fix.action, 'correct')
    assert.equal(activeDelivery(5)!.review!.corrections, 1)
    fs.writeFileSync(code, 'corrected once\n')
    close(fix)

    const second = carryOn(fix)
    assert.equal(second.action, 'review')
    verdict(second.sessionId, 'pass')
    close(second)
    assert.equal(activeDelivery(5), undefined)
    const audit = readAudit(id) as { review: { rounds: unknown[]; corrections: number } }
    assert.equal(audit.review.rounds.length, 2)
    assert.equal(audit.review.corrections, 1)
  })
})

describe('stopping, and the question it leaves', () => {
  const stops = (why: RegExp) => {
    assert.equal(activeDelivery(5)?.status, 'active', 'a stopped delivery still holds its card')
    assert.match(deliveryWaiting(5) ?? '', why)
    assert.equal(questions().length, 1)
    assert.match(questions()[0]!, /Review stopped on delivery/)
  }

  it('asks when the review says only the user can settle it', () => {
    const built = build()
    close(built)
    const review = carryOn(built)
    verdict(review.sessionId, 'ask', '- **Is the retry wanted?**: the card does not say.')
    close(review)
    stops(/only you can settle/)
    assert.match(questions()[0]!, /Is the retry wanted\?/)
  })

  it('stops when the same finding comes back after a correction', () => {
    const built = build()
    close(built)
    const first = carryOn(built)
    verdict(first.sessionId, 'correct', '- **Empty input crashes**: it throws.')
    close(first)
    const fix = carryOn(first)
    fs.writeFileSync(code, 'a change that did not fix it\n')
    close(fix)
    const second = carryOn(fix)
    verdict(second.sessionId, 'correct', '- **empty input crashes.**: it still throws.')
    close(second)
    stops(/came back after a correction/)
  })

  it('stops when a correction changed nothing in the candidate', () => {
    const built = build()
    close(built)
    const review = carryOn(built)
    verdict(review.sessionId, 'correct', '- **Empty input crashes**: it throws.')
    close(review)
    const fix = carryOn(review)
    // The correction writes nothing: the candidate is byte for byte what it found.
    close(fix)
    stops(/changed nothing/)
  })

  it('stops when a review session failed before recording a verdict', () => {
    const built = build()
    close(built)
    const review = carryOn(built)
    close(review, 'error')
    stops(/failed before it recorded a verdict/)
  })

  it('stops when a review session ended without recording anything', () => {
    const built = build()
    close(built)
    close(carryOn(built))
    stops(/without recording a verdict/)
  })

  it('stops at the correction limit rather than going round again', () => {
    const built = build()
    close(built)
    let last = built
    for (let round = 1; round <= MAX_CORRECTIONS; round++) {
      const review = carryOn(last)
      verdict(review.sessionId, 'correct', `- **Mistake ${round}**: still wrong.`)
      close(review)
      const fix = carryOn(review)
      fs.writeFileSync(code, `try ${round}\n`)
      close(fix)
      last = fix
    }
    const final = carryOn(last)
    verdict(final.sessionId, 'correct', '- **Mistake three**: still wrong.')
    close(final)
    stops(new RegExp(`${MAX_CORRECTIONS} corrections were spent`))
    assert.equal(activeDelivery(5)!.review!.corrections, MAX_CORRECTIONS)
  })

  it('says nothing when the user stopped the session themselves', () => {
    const built = build()
    close(built)
    close(carryOn(built), 'stopped')
    assert.equal(deliveryWaiting(5), undefined)
    assert.equal(questions().length, 0)
  })

  it('clears the stop when a fresh review is started on it', () => {
    const built = build()
    close(built)
    close(carryOn(built), 'error')
    assert.ok(deliveryWaiting(5))
    const again = session('review')
    withStore((store) => {
      store.runs.push(again)
      joinActive(store, again, 'review')
    })
    assert.equal(deliveryWaiting(5), undefined)
  })
})

describe('recording a verdict', () => {
  it('refuses a card with no delivery in flight', () => {
    assert.throws(() => cmdReviewVerdict(['5', '--verdict', 'pass']), /no delivery is in flight/)
  })

  it('refuses a correction verdict with nothing to act on', () => {
    build()
    assert.throws(() => cmdReviewVerdict(['5', '--verdict', 'correct']), /has to say what was found/)
  })

  it('replaces the verdict when one session records twice', () => {
    const built = build()
    close(built)
    const review = carryOn(built)
    verdict(review.sessionId, 'correct', '- **First thought**: wrong.')
    verdict(review.sessionId, 'pass')
    assert.equal(activeDelivery(5)!.review!.rounds.length, 1)
    close(review)
    assert.equal(activeDelivery(5), undefined)
  })

  it('is not trusted from a session the review never ran in', () => {
    const built = build()
    close(built)
    const review = carryOn(built)
    // Typed by hand, outside any session: the delivery never heard from its own reviewer.
    cmdReviewVerdict(['5', '--verdict', 'pass'])
    close(review)
    assert.equal(activeDelivery(5)?.status, 'active')
    assert.match(deliveryWaiting(5) ?? '', /without recording a verdict/)
  })
})
