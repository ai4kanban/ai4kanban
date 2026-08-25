// Review is one fresh session: it judges the delivery, fixes plain mistakes itself, and
// records pass or ask. These tests cover that handoff and its stop conditions.

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
import { parseFindings } from '../src/lib/agent/review.ts'
import { readStore, withStore } from '../src/lib/agent/store.ts'
import type { AgentAction, RunRecord } from '../src/lib/agent/types.ts'
import { DELIVERIES, setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-review-'))
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

function verdict(sessionId: string, kind: 'pass' | 'ask', findings?: string): void {
  process.env[RUN_ENV] = sessionId
  try {
    cmdReviewVerdict(['5', '--verdict', kind, ...(findings ? ['--text', findings] : [])])
  } finally {
    delete process.env[RUN_ENV]
  }
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

describe('reading a review answer', () => {
  it('takes each bullet as one finding', () => {
    const found = parseFindings(
      ['- **Empty input crashes**: `parse("")` throws in read.ts:20.', '- **Missing test**: nothing covers it.'].join('\n'),
    )
    assert.deepEqual(
      found.map((finding) => finding.title),
      ['Empty input crashes', 'Missing test'],
    )
    assert.match(found[0]!.detail, /read\.ts:20/)
  })

  it('folds a wrapped line into the preceding finding', () => {
    const found = parseFindings(['- **One thing**: the first half', '      and the second half.'].join('\n'))
    assert.equal(found.length, 1)
    assert.match(found[0]!.detail, /first half and the second half/)
  })

  it('reads prose as one finding', () => {
    const found = parseFindings('the change does not do what the card asked for')
    assert.equal(found.length, 1)
    assert.match(found[0]!.title, /does not do what the card asked/)
  })
})

describe('reviewing and fixing in one session', () => {
  it('reviews after implementation and finishes on pass', () => {
    const built = build()
    const id = activeDelivery(5)!.deliveryId
    close(built)
    const review = carryOn(built)
    assert.equal(review.action, 'review')
    verdict(review.sessionId, 'pass')
    close(review)

    assert.equal(passedOn(5), true)
    assert.equal(deliveryRunAfter(review), null)
    assert.equal(readAudit(id).reviewed !== undefined, true)
  })

  it('keeps fixes made by the review and needs no correction run', () => {
    const built = build()
    close(built)
    const review = carryOn(built)
    fs.writeFileSync(code, 'fixed by review\n')
    verdict(review.sessionId, 'pass')
    close(review)

    assert.equal(fs.readFileSync(code, 'utf8'), 'fixed by review\n')
    assert.equal(deliveryRunAfter(review), null)
    assert.equal(activeDelivery(5)!.review!.rounds.length, 1)
  })

  it('waits when implementation was cut off', () => {
    const built = build()
    close(built, 'interrupted')
    assert.equal(activeDelivery(5)?.status, 'active')
    assert.equal(deliveryRunAfter(built), null)
    assert.equal(deliveryWaiting(5), undefined)
  })
})

describe('stopping for the user', () => {
  const stops = (why: RegExp) => {
    assert.equal(activeDelivery(5)?.status, 'active')
    assert.match(deliveryWaiting(5) ?? '', why)
    assert.equal(questions().length, 1)
    assert.match(questions()[0]!, /Review stopped on delivery/)
  }

  it('stops on ask and records the finding', () => {
    const built = build()
    close(built)
    const review = carryOn(built)
    verdict(review.sessionId, 'ask', '- **Is the retry wanted?**: the card does not say.')
    close(review)
    stops(/only you can settle/)
    assert.match(questions()[0]!, /Is the retry wanted\?/)
  })

  it('stops when review failed before recording a verdict', () => {
    const built = build()
    close(built)
    close(carryOn(built), 'error')
    stops(/failed before it recorded a verdict/)
  })

  it('stops when review ended without a verdict', () => {
    const built = build()
    close(built)
    close(carryOn(built))
    stops(/without recording a verdict/)
  })

  it('does not add a question when the user stopped the session', () => {
    const built = build()
    close(built)
    close(carryOn(built), 'stopped')
    assert.equal(deliveryWaiting(5), undefined)
    assert.equal(questions().length, 0)
  })

  it('clears a stop when a fresh review starts', () => {
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

  it('accepts only pass or ask', () => {
    build()
    assert.throws(() => cmdReviewVerdict(['5', '--verdict', 'correct']), /takes pass, ask/)
  })

  it('requires findings for ask and refuses them for pass', () => {
    build()
    assert.throws(() => cmdReviewVerdict(['5', '--verdict', 'ask']), /has to say what was found/)
    assert.throws(
      () => cmdReviewVerdict(['5', '--verdict', 'pass', '--text', 'nothing wrong']),
      /carries no findings/,
    )
  })

  it('replaces the verdict when one session records twice', () => {
    const built = build()
    close(built)
    const review = carryOn(built)
    verdict(review.sessionId, 'ask', '- **First thought**: needs a decision.')
    verdict(review.sessionId, 'pass')
    assert.equal(activeDelivery(5)!.review!.rounds.length, 1)
    close(review)
    assert.equal(passedOn(5), true)
  })

  it('does not trust a verdict recorded outside the review session', () => {
    const built = build()
    close(built)
    const review = carryOn(built)
    cmdReviewVerdict(['5', '--verdict', 'pass'])
    close(review)
    assert.equal(activeDelivery(5)?.status, 'active')
    assert.match(deliveryWaiting(5) ?? '', /without recording a verdict/)
  })
})
