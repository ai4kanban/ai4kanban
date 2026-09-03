// What a delivery records, and what it holds still while it records it (#301): the card as
// it was approved, one id across every session, and a card the board won't change under a
// delivery it isn't part of.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import {
  activeDelivery,
  approvedRequirements,
  endDelivery,
  heldByDelivery,
  insideDelivery,
  joinDelivery,
  settleDelivery,
} from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { cancelDelivery } from '../src/lib/agent/sessions.ts'
import { cardsAtWork, readStore, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { DELIVERIES, setBoardRoot } from '../src/lib/paths.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-delivery-'))
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
  'verify:',
  '  - "check it by hand"',
  '---',
  '',
  'What this card is for, in one paragraph.',
  '',
  '## Worth noting',
  '- **A call**: its answer.',
  '',
  '<!-- agent -->',
  '',
  '## Today',
  '- **How it is now**: badly.',
  '',
  '## Scope',
  '- **A requirement**: one line.',
  '',
  '## Todo',
  '- [ ] the first step',
  '',
  '## By `security` agent',
  '- **A risk**: mitigated.',
  '',
  '## Decided by the agent',
  '- **A smaller call**: its answer.',
  '',
].join('\n')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(todo, 'features'), { recursive: true })
  fs.writeFileSync(file, CARD)
  setBoardRoot(root)
  delete process.env[RUN_ENV]
})

after(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(root, { recursive: true, force: true })
})

let next = 0
const session = (over: Partial<RunRecord> = {}): RunRecord => ({
  sessionId: `s${++next}`,
  cardId: 5,
  action: 'implement',
  status: 'running',
  startedAt: 1_000 + next,
  harness: 'claude-code',
  logPath: path.join(root, 'docs', 'kanban', '.sessions', `s${next}.log`),
  ...over,
})

// Write a session down and put it in its delivery, the way openRun does.
const start = (run: RunRecord): string =>
  withStore((store) => {
    store.runs.push(run)
    return joinDelivery(store, run, 'A card', 'implement').deliveryId
  })

describe('the approved requirements', () => {
  it('copies the title, the opening, Worth noting, Scope and a spec skill section', async () => {
    const approved = approvedRequirements(5)
    assert.match(approved, /^# A card/)
    assert.match(approved, /What this card is for/)
    assert.match(approved, /## Worth noting/)
    assert.match(approved, /## Scope\n/)
    assert.match(approved, /## By `security` agent/)
  })

  it('leaves out Todo, Today, Decided by the agent and the boundary', async () => {
    const approved = approvedRequirements(5)
    assert.doesNotMatch(approved, /## Todo/)
    assert.doesNotMatch(approved, /## Today/)
    assert.doesNotMatch(approved, /## Decided by the agent/)
    assert.doesNotMatch(approved, /<!-- agent -->/)
    assert.doesNotMatch(approved, /the first step/)
  })

  it('is a copy: an edit to the card afterwards never reaches the delivery', async () => {
    const id = start(session())
    fs.writeFileSync(file, CARD.replace('- **A requirement**: one line.', '- **A requirement**: something else.'))
    assert.match(activeDelivery(5)!.approved, /one line/)
    assert.doesNotMatch(activeDelivery(5)!.approved, /something else/)
    assert.equal(activeDelivery(5)!.deliveryId, id)
  })
})

describe('one delivery, several sessions', () => {
  it('gives a second session on the same card the same delivery id', async () => {
    const first = start(session())
    await settleDelivery({ ...readStore().runs[0]!, status: 'interrupted' })
    const second = start(session())
    assert.equal(second, first)
    assert.equal(activeDelivery(5)!.sessions.length, 2)
  })

  it('opens a new delivery once the old one has ended', async () => {
    const first = start(session())
    endDelivery(first, 'finished')
    assert.equal(activeDelivery(5), undefined)
    assert.notEqual(start(session()), first)
  })

  it('leaves a standalone session with no delivery at all', async () => {
    withStore((store) => store.runs.push(session({ action: 'clarify' })))
    assert.equal(activeDelivery(5), undefined)
    assert.equal(readStore().runs[0]!.deliveryId, undefined)
  })
})

describe('ending one', () => {
  it('does not end when the build finished — review comes next (#302)', async () => {
    const id = start(session())
    await settleDelivery({ ...readStore().runs[0]!, status: 'done' })
    assert.equal(activeDelivery(5)?.deliveryId, id)
    assert.equal(activeDelivery(5)?.next, 'review')
    assert.equal(readAudit(id).status, 'active')
  })

  it('leaves it active and unfinished when its session was cut off', async () => {
    start(session())
    await settleDelivery({ ...readStore().runs[0]!, status: 'interrupted' })
    assert.equal(activeDelivery(5)?.status, 'active')
  })

  it('leaves it active when its session was stopped', async () => {
    start(session())
    await settleDelivery({ ...readStore().runs[0]!, status: 'stopped' })
    assert.equal(activeDelivery(5)?.status, 'active')
  })
})

describe('the permanent record', () => {
  it('is written when the delivery starts and says how it ended', async () => {
    const id = start(session())
    const started = readAudit(id)
    assert.equal(started.status, 'active')
    assert.equal(started.cardId, 5)
    assert.match(started.approved, /## Scope/)
    assert.equal(started.sessions.length, 1)
    // The log is named, never copied: the log is this machine's and ages out.
    assert.match(started.sessions[0].log, /\.sessions[\\/]s\d+\.log$/)
    endDelivery(id, 'cancelled')
    assert.equal(readAudit(id).status, 'cancelled')
  })

  it('keeps one record per delivery, so two cards never share one', async () => {
    fs.writeFileSync(path.join(todo, 'features', '6-another.md'), CARD.replace('title: A card', 'title: Another'))
    const first = start(session())
    const second = start(session({ cardId: 6 }))
    assert.notEqual(first, second)
    assert.equal(readAudit(first).cardId, 5)
    assert.equal(readAudit(second).cardId, 6)
    assert.deepEqual(readAudit(first).sessions.map((s: { sessionId: string }) => s.sessionId), [
      readStore().runs[0]!.sessionId,
    ])
  })
})

describe('cancelling one', () => {
  it('ends the delivery, unlocks the card and leaves the record saying cancelled', async () => {
    const id = start(session())
    assert.equal((await cancelDelivery(id)).ok, true)
    assert.equal(activeDelivery(5), undefined)
    assert.equal(heldByDelivery(5), undefined)
    assert.equal(readAudit(id).status, 'cancelled')
  })

  it('takes the card back when named by the card rather than the delivery', async () => {
    const id = start(session())
    assert.equal((await cancelDelivery('5')).deliveryId, id)
    assert.equal(activeDelivery(5), undefined)
  })

  it('says so rather than failing when the delivery has already ended', async () => {
    const id = start(session())
    endDelivery(id, 'finished')
    assert.equal((await cancelDelivery(id)).ok, true)
    assert.equal(readAudit(id).status, 'finished')
  })

  it('refuses a delivery this board has never had', async () => {
    assert.equal((await cancelDelivery('nosuchid')).ok, false)
  })
})

describe('the hold on the card', () => {
  it('names the delivery and what takes the card back', async () => {
    const id = start(session())
    const held = heldByDelivery(5)
    assert.match(held!, new RegExp(id))
    assert.match(held!, /Discard/)
    // Not `akb cancel`: with no `akb` on PATH the board spells its own command as
    // `node <path>/ai4kanban.mjs`, so the command is what to look for, not the program.
    assert.match(held!, new RegExp(`cancel ${id}`))
  })

  it('lifts once the delivery has ended', async () => {
    endDelivery(start(session()), 'cancelled')
    assert.equal(heldByDelivery(5), undefined)
  })

  it("lets the delivery's own session through", () => {
    const run = session()
    start(run)
    process.env[RUN_ENV] = run.sessionId
    assert.equal(insideDelivery(5), true)
    assert.equal(heldByDelivery(5), undefined)
  })

  it('holds against a session that is not part of it', async () => {
    start(session())
    process.env[RUN_ENV] = 'some-other-session'
    assert.equal(insideDelivery(5), false)
    assert.ok(heldByDelivery(5))
  })
})

// What Cloud reads to decide whether a card is anybody's decision yet (#319): a card the
// board is working on is not one waiting for a person, whatever it happens to say mid-run.
describe('the cards the board is working on', () => {
  const live = (over: Partial<RunRecord> = {}): RunRecord =>
    session({ startedAt: Date.now(), pid: process.pid, ...over })

  it('holds the card a live run names', () => {
    withStore((store) => store.runs.push(live({ cardId: 7, action: 'resolve' })))
    assert.deepEqual([...cardsAtWork()], [7])
  })

  it('lets go the moment that run is no longer running', () => {
    const run = live({ cardId: 7, action: 'resolve' })
    withStore((store) => store.runs.push(run))
    withStore((store) => {
      const held = store.runs.find((r) => r.sessionId === run.sessionId)!
      held.status = 'done'
    })
    assert.deepEqual([...cardsAtWork()], [])
  })

  it('lets go of a run whose process is gone, without waiting to be reaped', () => {
    // A pid nothing answers to. The rule is `reap`'s own, so a reader and a reaper never
    // disagree about which runs are live.
    withStore((store) => store.runs.push(live({ cardId: 7, action: 'resolve', pid: 2 ** 30 })))
    assert.deepEqual([...cardsAtWork()], [])
  })

  it('holds a card its delivery still has, between the delivery’s runs', () => {
    const id = start(session({ cardId: 5 }))
    withStore((store) => {
      for (const r of store.runs) r.status = 'done'
    })
    assert.deepEqual([...cardsAtWork()], [5], 'the delivery holds it with no run going')
    endDelivery(id, 'finished')
    assert.deepEqual([...cardsAtWork()], [])
  })

  it('is held by no spec run — it fills one section and never the plan', () => {
    withStore((store) => store.runs.push(live({ cardId: 7, action: 'spec' })))
    assert.deepEqual([...cardsAtWork()], [])
  })
})

function readAudit(id: string): {
  status: string
  cardId: number
  approved: string
  sessions: { sessionId: string; log: string }[]
} {
  return JSON.parse(fs.readFileSync(path.join(DELIVERIES, `${id}.json`), 'utf8'))
}
