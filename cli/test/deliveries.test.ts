// What a delivery records, and what it holds still while it records it (#301): the card as
// it was approved, one id across every session, and a card the board won't change under a
// delivery it isn't part of.

import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import {
  activeDelivery,
  approvedRequirements,
  endDelivery,
  keptCheckout,
  sweepCheckouts,
  tidyCheckout,
  findDelivery,
  heldByDelivery,
  insideDelivery,
  adoptDirectCard,
  joinDelivery,
  namedDelivery,
  settleDelivery,
  syncAudit,
} from '../src/lib/agent/deliveries.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { resumePrompt } from '../src/lib/agent/prompts.ts'
import { cancelDelivery, recoverOrphanedDeliveries, resumeDelivery } from '../src/lib/agent/sessions.ts'
import { cardsAtWork, cardsWithLiveRun, readStore, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { DELIVERIES, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-delivery-'))
const todo = path.join(root, 'docs', 'kanban', 'todo')
const file = path.join(todo, 'features', '5-a-card.md')

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
  forgetMachineState(root)
  fs.mkdirSync(path.join(todo, 'features'), { recursive: true })
  fs.writeFileSync(file, CARD)
  // The board refuses every write without it, and handing a card back is a board write.
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '6\n')
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
  it('copies the title, the opening, Worth noting, Scope and a spec agent section', async () => {
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
    // Not `akb delivery cancel`: with no `akb` on PATH the board spells its own command as
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

  // The wider set (#568): not what may start, but what a person can act on. A spec run holds
  // no card and the card page still turns its controls off, so Cloud reads this one too.
  it('names a card under a spec run, which the narrower set lets go', () => {
    withStore((store) => store.runs.push(live({ cardId: 7, action: 'spec' })))
    assert.deepEqual([...cardsWithLiveRun()], [7])
  })

  it('names nothing once that run has ended, so the card comes back', () => {
    const run = live({ cardId: 7, action: 'spec' })
    withStore((store) => store.runs.push(run))
    withStore((store) => {
      const held = store.runs.find((r) => r.sessionId === run.sessionId)!
      held.status = 'done'
    })
    assert.deepEqual([...cardsWithLiveRun()], [])
  })

  it('names no card for a delivery between its runs — a person can act on that one', () => {
    const id = start(session({ cardId: 5 }))
    withStore((store) => {
      for (const r of store.runs) r.status = 'done'
    })
    assert.deepEqual([...cardsWithLiveRun()], [])
    endDelivery(id, 'finished')
  })
})

// A build with no card at all (#428) — what **Build now** starts. The typed sentence is the
// whole of what it was approved to build, and its own id is the only name it has.
describe('a delivery with no card', () => {
  const typed = 'Rename the Runs panel heading to Activity'

  // What openRun does for a card-less build: the sentence is the title AND the approved copy.
  const startCardless = (run: RunRecord): string =>
    withStore((store) => {
      store.runs.push(run)
      return joinDelivery(store, run, typed, 'implement', undefined, { title: typed, approved: typed }).deliveryId
    })

  it('takes the typed sentence as its requirements and its title', () => {
    const id = startCardless(session({ cardId: null }))
    const delivery = readStore().deliveries.find((d) => d.deliveryId === id)!
    assert.equal(delivery.cardId, null)
    assert.equal(delivery.approved, typed)
    assert.equal(delivery.title, typed)
    // Nothing on the board was held, so there is no stage to put back at the end.
    assert.equal(delivery.priorStatus, undefined)
  })

  it('opens one delivery per send — two never collapse into one', () => {
    const first = startCardless(session({ cardId: null }))
    const second = startCardless(session({ cardId: null }))
    assert.notEqual(first, second)
    assert.equal(readStore().deliveries.filter((d) => d.cardId === null).length, 2)
  })

  it('is found by its own id, and holds no card', () => {
    const id = startCardless(session({ cardId: null }))
    assert.equal(findDelivery(id)?.deliveryId, id)
    assert.equal(namedDelivery(id)?.deliveryId, id)
    assert.deepEqual([...cardsAtWork()], [])
  })

  it('keeps its row when the record is read back', () => {
    const id = startCardless(session({ cardId: null }))
    // Straight through the file, the way another process reads it.
    assert.equal(readStore().deliveries.some((d) => d.deliveryId === id && d.cardId === null), true)
  })

  it('is cancelled by its own id, with no card to hand back', async () => {
    const id = startCardless(session({ cardId: null }))
    assert.equal((await cancelDelivery(id)).ok, true)
    assert.equal(readAudit(id).status, 'cancelled')
  })

  // What a restarted run is told when its saved conversation is gone. A carded delivery is
  // pointed at the command that prints its approved copy; this one never got as far as
  // writing its card, so the sentence itself has to be in the words.
  it('quotes the typed sentence to a run that has to start over', () => {
    const id = startCardless(session({ cardId: null }))
    const prompt = resumePrompt(id, null, 'implement')
    assert.match(prompt, new RegExp(`Continue delivery ${id}`))
    assert.match(prompt, /No card was written yet: write it from this sentence/)
    assert.match(prompt, new RegExp(typed))
  })

  // The card the run writes for itself (#470), handed to the delivery already in flight.
  describe('once the run has written its card', () => {
    it('names it on the run and on the delivery, and rests it at ready', () => {
      const id = startCardless(session({ cardId: null }))
      assert.equal(adoptDirectCard(readStore().runs[0]!.sessionId, 9), true)
      const delivery = findDelivery(id)!
      assert.equal(delivery.cardId, 9)
      assert.equal(delivery.priorStatus, 'ready')
      assert.equal(readStore().runs[0]!.cardId, 9)
      assert.equal(readStore().runs[0]!.priorStatus, 'ready')
      assert.equal(readAudit(id).cardId, 9)
    })

    it('leaves what was frozen with no card frozen — nothing reviews or approves it', () => {
      const id = withStore((store) => {
        const run = session({ cardId: null })
        store.runs.push(run)
        const delivery = joinDelivery(store, run, typed, 'implement', undefined, { title: typed, approved: typed })
        delivery.aiReview = false
        delivery.approval = { required: false, events: [] }
        return delivery.deliveryId
      })
      adoptDirectCard(readStore().runs[0]!.sessionId, 9)
      const delivery = findDelivery(id)!
      assert.equal(delivery.aiReview, false)
      assert.equal(delivery.approval?.required, false)
      // And the sentence stays the requirement: the card was written from it.
      assert.equal(delivery.approved, typed)
    })

    it('takes the first card only — a second create changes nothing', () => {
      startCardless(session({ cardId: null }))
      const sessionId = readStore().runs[0]!.sessionId
      adoptDirectCard(sessionId, 9)
      assert.equal(adoptDirectCard(sessionId, 10), false)
      assert.equal(readStore().runs[0]!.cardId, 9)
    })

    it('leaves a run that is not a card-less build alone', () => {
      start(session())
      assert.equal(adoptDirectCard(readStore().runs[0]!.sessionId, 9), false)
      withStore((store) => store.runs.push(session({ cardId: null, action: 'create' })))
      assert.equal(adoptDirectCard(readStore().runs[1]!.sessionId, 9), false)
      assert.equal(readStore().runs[1]!.cardId, null)
    })

    // A run that opened no delivery holds the card itself, and rests it where a cancel or a
    // discard hands back a settled card.
    it('hands the card to a run with no delivery, resting it at ready', () => {
      withStore((store) => store.runs.push(session({ cardId: null })))
      const sessionId = readStore().runs[0]!.sessionId
      assert.equal(adoptDirectCard(sessionId, 9), true)
      assert.equal(readStore().runs[0]!.cardId, 9)
      assert.equal(readStore().runs[0]!.priorStatus, 'ready')
    })
  })

  it('finishes on its own build in manual commit mode, waiting for no commit', async () => {
    const id = startCardless(session({ cardId: null }))
    withStore((store) => {
      const live = store.deliveries.find((d) => d.deliveryId === id)!
      live.commitMode = 'manual'
      live.aiReview = false
    })
    await settleDelivery({ ...readStore().runs[0]!, status: 'done' })
    const ended = readStore().deliveries.find((d) => d.deliveryId === id)!
    assert.equal(ended.status, 'finished')
    assert.equal(ended.reviewed, undefined)
  })
})

// A delivery the live record lost — the index file went missing under it, so nothing that
// reads the record can reach it and its card sat at `implementing` with nothing running.
describe('a delivery the live record lost', () => {
  // The permanent record as a delivery cut off mid-build leaves it, written straight to
  // disk: the live row is exactly what these deliveries no longer have.
  const orphan = (id: string, over: Record<string, unknown> = {}): string => {
    const worktree = path.join('.akb', 'worktrees', '5', id)
    fs.mkdirSync(DELIVERIES, { recursive: true })
    fs.writeFileSync(
      path.join(DELIVERIES, `${id}.json`),
      JSON.stringify({
        deliveryId: id,
        cardId: 5,
        title: 'A card',
        status: 'active',
        startedAt: 1_000,
        approved: '# A card\n',
        steps: [{ step: 'implement', at: 1_000 }],
        priorStatus: 'ready',
        commitMode: 'auto',
        worktree,
        branch: `card/5/${id}`,
        sessions: [{ sessionId: `${id}-1`, action: 'implement', status: 'running', startedAt: 1_000, log: 'x.log' }],
        ...over,
      }),
    )
    return worktree
  }

  // What `worktreeExists` looks for: the folder, still git's.
  const onThisMachine = (worktree: string): string => {
    const dir = path.join(root, worktree)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, '.git'), 'gitdir: elsewhere\n')
    return dir
  }

  const atImplementing = (): void => fs.writeFileSync(file, CARD.replace('status: ready', 'status: implementing'))

  // A session that had already wrapped up when the record went missing — the delivery was
  // between steps, which is what makes it recoverable rather than failed.
  const settled = (id: string) => ({
    sessionId: `${id}-1`,
    action: 'implement',
    status: 'done',
    startedAt: 1_000,
    endedAt: 2_000,
    log: 'x.log',
  })

  // An orphan whose last session ended, standing on this machine.
  const resting = (id: string, over: Record<string, unknown> = {}): void => {
    onThisMachine(orphan(id, { sessions: [settled(id)], ...over }))
  }

  const rowOf = (id: string) => readStore().deliveries.find((d) => d.deliveryId === id)

  it('fails the record and interrupts the sessions nobody saw end', async () => {
    onThisMachine(orphan('lost1111'))
    await recoverOrphanedDeliveries()
    const record = readAudit('lost1111')
    assert.equal(record.status, 'failed')
    assert.ok(record.endedAt)
    assert.deepEqual(record.sessions.map((s) => s.status), ['interrupted'])
  })

  it('leaves its branch and worktree exactly where they are', async () => {
    const dir = onThisMachine(orphan('lost2222'))
    await recoverOrphanedDeliveries()
    assert.equal(fs.existsSync(dir), true)
    assert.equal(readAudit('lost2222').branch, 'card/5/lost2222')
  })

  it('hands the card back to the stage the delivery took it from', async () => {
    atImplementing()
    onThisMachine(orphan('lost3333'))
    await recoverOrphanedDeliveries()
    assert.match(fs.readFileSync(file, 'utf8'), /status: ready/)
  })

  // `deliveries/` is in git, so a delivery running on a colleague's machine arrives here as
  // an `active` record too. Its worktree is theirs, and that is what tells the two apart.
  it('leaves a delivery whose worktree is not on this machine alone', async () => {
    atImplementing()
    orphan('lost4444') // the record, with no worktree beside it
    assert.deepEqual(await recoverOrphanedDeliveries(), [])
    assert.equal(readAudit('lost4444').status, 'active')
    assert.match(fs.readFileSync(file, 'utf8'), /status: implementing/)
  })

  it('leaves a delivery the record still has a row for alone', async () => {
    const id = start(session())
    onThisMachine(path.join('.akb', 'worktrees', '5', id))
    withStore((store) => {
      store.deliveries.find((d) => d.deliveryId === id)!.worktree = path.join('.akb', 'worktrees', '5', id)
    })
    assert.deepEqual(await recoverOrphanedDeliveries(), [])
    assert.equal(readAudit(id).status, 'active')
  })

  it('does not hand back a card another delivery has taken over', async () => {
    onThisMachine(orphan('lost5555'))
    start(session()) // the delivery building #5 now, which put it at `implementing`
    atImplementing()
    const closed = await recoverOrphanedDeliveries()
    assert.deepEqual(closed.map((d) => d.deliveryId), ['lost5555'])
    assert.match(fs.readFileSync(file, 'utf8'), /status: implementing/)
  })

  // The other ending (#638). A switched-out record loses every row at once, and the
  // deliveries that were resting between steps are whole in `deliveries/` — so they go back
  // in rather than being failed by the thousand.
  it('puts a delivery whose last session ended back into the live record', async () => {
    atImplementing()
    resting('rest1111', { next: 'review' })
    assert.deepEqual(await recoverOrphanedDeliveries(), [])
    const row = rowOf('rest1111')
    assert.equal(row?.status, 'active')
    assert.equal(row?.cardId, 5)
    assert.equal(row?.next, 'review')
    assert.deepEqual(row?.sessions, ['rest1111-1'])
    assert.equal(row?.worktree, path.join('.akb', 'worktrees', '5', 'rest1111'))
  })

  it('leaves the permanent record and the card exactly as they were', async () => {
    atImplementing()
    resting('rest2222')
    await recoverOrphanedDeliveries()
    const record = readAudit('rest2222')
    assert.equal(record.status, 'active')
    assert.equal(record.endedAt, undefined)
    assert.deepEqual(record.sessions.map((s) => s.status), ['done'])
    assert.match(fs.readFileSync(file, 'utf8'), /status: implementing/)
  })

  // The process walking it through the queue is the one that went missing, so the claim on
  // the landing slot is nobody's. Everything else it learned on the way is kept.
  it('puts a delivery mid-landing back in the queue', async () => {
    atImplementing()
    resting('rest3333', {
      landing: { status: 'landing', attempts: 2, rebasedFrom: 'main', onto: 'abc123', at: 3_000 },
    })
    await recoverOrphanedDeliveries()
    assert.deepEqual(rowOf('rest3333')?.landing, {
      status: 'waiting',
      attempts: 2,
      rebasedFrom: 'main',
      onto: 'abc123',
      at: 3_000,
      why: undefined,
      rebasedAt: undefined,
      rebaseKind: undefined,
      commit: undefined,
      overlap: undefined,
      conflictFiles: undefined,
      conflictFails: undefined,
      conflictAt: undefined,
      retryAt: undefined,
      checks: undefined,
    })
  })

  // The live record holds no run for a recovered delivery's sessions — they went with the
  // index. The next write reads them off the permanent record instead of dropping them.
  it('keeps its session history when the record is written again', async () => {
    atImplementing()
    resting('rest4444')
    await recoverOrphanedDeliveries()
    syncAudit('rest4444')
    assert.deepEqual(readAudit('rest4444').sessions, [
      { sessionId: 'rest4444-1', action: 'implement', status: 'done', startedAt: 1_000, endedAt: 2_000, log: 'x.log' },
    ])
  })

  it('recovers once, however many scans see it', async () => {
    atImplementing()
    resting('rest5555')
    await recoverOrphanedDeliveries()
    await recoverOrphanedDeliveries()
    assert.deepEqual(
      readStore().deliveries.filter((d) => d.deliveryId === 'rest5555').length,
      1,
    )
  })

  // The recheck under the index's lock, standing in for whatever ended the delivery while
  // the scan was reading: the second read of the record is the one the write turns on.
  it('does not revive a delivery that ended after the scan read it', async () => {
    atImplementing()
    resting('rest6666')
    const wasRead = fs.readFileSync
    let reads = 0
    fs.readFileSync = ((target: string, encoding: unknown) => {
      if (typeof target === 'string' && target.endsWith('rest6666.json') && ++reads === 2) {
        return JSON.stringify({ ...JSON.parse(wasRead(target, 'utf8') as string), status: 'cancelled' })
      }
      return wasRead(target, encoding as never)
    }) as typeof fs.readFileSync
    try {
      await recoverOrphanedDeliveries()
    } finally {
      fs.readFileSync = wasRead
    }
    assert.equal(reads, 2, 'the recheck under the lock is the second read')
    assert.equal(rowOf('rest6666'), undefined)
  })

  it('leaves a resting delivery whose worktree is not on this machine alone', async () => {
    atImplementing()
    orphan('rest7777', { sessions: [settled('rest7777')] }) // the record, with no worktree beside it
    assert.deepEqual(await recoverOrphanedDeliveries(), [])
    assert.equal(rowOf('rest7777'), undefined)
    assert.equal(readAudit('rest7777').status, 'active')
  })

  it('leaves a resting delivery whose card is archived or gone alone', async () => {
    resting('rest8888', { cardId: 404 })
    assert.deepEqual(await recoverOrphanedDeliveries(), [])
    assert.equal(rowOf('rest8888'), undefined)
  })

  it('leaves a resting delivery whose card another delivery has taken over alone', async () => {
    resting('rest9999')
    start(session()) // the delivery building #5 now
    atImplementing()
    assert.deepEqual(await recoverOrphanedDeliveries(), [])
    assert.equal(rowOf('rest9999'), undefined)
    assert.equal(readAudit('rest9999').status, 'active')
  })

  // A **Build now** delivery holds no card, so there is no card check to pass (#428).
  it('recovers a delivery with no card', async () => {
    resting('restaaaa', { cardId: null })
    await recoverOrphanedDeliveries()
    const row = rowOf('restaaaa')
    assert.equal(row?.status, 'active')
    assert.equal(row?.cardId, null)
  })
})

// Carrying one on (#639): a delivery that failed or was cancelled with its work still on
// disk goes back to `active` and finishes the job, instead of the card being rebuilt.
describe('carrying an ended delivery on', () => {
  // `resume` asks git whether the branch is still there, so this block needs a real one.
  const git = (...args: string[]): string =>
    spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim()

  beforeEach(() => {
    git('init', '--quiet', '-b', 'main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'test')
    fs.writeFileSync(path.join(root, 'code.txt'), 'one\n')
    git('add', 'code.txt')
    git('commit', '--quiet', '-m', 'start')
  })

  // The permanent record of a delivery that ended with its work still here, plus the
  // worktree and branch that make it resumable.
  const stopped = (id: string, over: Record<string, unknown> = {}): string => {
    const worktree = path.join('.akb', 'worktrees', '5', id)
    const branch = `card/5/${id}`
    fs.mkdirSync(DELIVERIES, { recursive: true })
    fs.writeFileSync(
      path.join(DELIVERIES, `${id}.json`),
      JSON.stringify({
        deliveryId: id,
        cardId: 5,
        title: 'A card',
        status: 'failed',
        startedAt: 1_000,
        endedAt: 2_000,
        approved: '# A card\n\n## Scope\n- **A requirement**: one line.\n',
        steps: [{ step: 'implement', at: 1_000 }],
        priorStatus: 'ready',
        commitMode: 'auto',
        targetBranch: 'main',
        worktree,
        branch,
        sessions: [
          { sessionId: `${id}-1`, action: 'implement', status: 'interrupted', startedAt: 1_000, log: 'x.log' },
        ],
        ...over,
      }),
    )
    const dir = path.join(root, worktree)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, '.git'), 'gitdir: elsewhere\n')
    git('branch', '-f', branch, 'HEAD')
    return id
  }

  const rowOf = (id: string) => readStore().deliveries.find((d) => d.deliveryId === id)

  const atImplementing = (): void => fs.writeFileSync(file, CARD.replace('status: ready', 'status: implementing'))

  it('puts a failed delivery back to work, holding its card again', async () => {
    stopped('carry111')
    const res = await resumeDelivery('carry111')
    assert.equal(res.ok, true, res.error)
    const row = rowOf('carry111')!
    assert.equal(row.status, 'active')
    assert.equal(row.endedAt, undefined)
    assert.equal(activeDelivery(5)?.deliveryId, 'carry111')
    assert.deepEqual(row.steps.map((s) => s.step), ['implement', 'resume'])
    assert.match(fs.readFileSync(file, 'utf8'), /status: implementing/)
    assert.equal(readAudit('carry111').status, 'active')
  })

  // Cancelling is the user giving the delivery up (#720), so there is nothing to carry on
  // — and its checkout has already gone with it.
  it('refuses a cancelled one', async () => {
    stopped('carry222', { status: 'cancelled' })
    const res = await resumeDelivery('carry222')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /was cancelled, so its work was given up/)
  })

  // A newer delivery on the card is the one a reader means by "the delivery that stopped
  // here", even when it has ended too.
  it('refuses one a later delivery on the same card took over', async () => {
    stopped('carryfff')
    stopped('carryggg', { startedAt: 5_000, endedAt: 6_000 })
    // Both in the live record: a delivery that still holds a checkout is never pruned out
    // of it (#720), so this is how the two really sit beside each other.
    withStore((store) => store.deliveries.push(rowOf2('carryfff'), rowOf2('carryggg')))
    const res = await resumeDelivery('carryfff')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /delivery carryggg took #5 over/)
    assert.equal((await resumeDelivery('carryggg')).ok, true)
  })

  // The live rows for the two above, read back out of the permanent records.
  const rowOf2 = (id: string) =>
    ({ ...JSON.parse(fs.readFileSync(path.join(DELIVERIES, `${id}.json`), 'utf8')), sessions: [] }) as never

  // Nothing is rebuilt, so nothing it was approved to build may move under it.
  it('keeps the approved copy, the base and the session history', async () => {
    stopped('carry333', { base: 'abc123', sessions: [
      { sessionId: 'carry333-1', action: 'implement', status: 'done', startedAt: 1_000, endedAt: 1_500, log: 'x.log' },
      { sessionId: 'carry333-2', action: 'review', status: 'interrupted', startedAt: 1_600, log: 'y.log' },
    ] })
    fs.writeFileSync(file, CARD.replace('- **A requirement**: one line.', '- **A requirement**: something else.'))
    await resumeDelivery('carry333')
    const row = rowOf('carry333')!
    assert.match(row.approved, /one line/)
    assert.doesNotMatch(row.approved, /something else/)
    assert.equal(row.base, 'abc123')
    assert.deepEqual(row.sessions, ['carry333-1', 'carry333-2'])
    syncAudit('carry333')
    assert.deepEqual(readAudit('carry333').sessions.map((s) => s.sessionId), ['carry333-1', 'carry333-2'])
  })

  // The process walking it through the queue died with the delivery, so its claim on the
  // one landing slot is nobody's (#638).
  it('puts a delivery that was mid-landing back in the queue', async () => {
    stopped('carry444', { landing: { status: 'landing', attempts: 2, at: 3_000 } })
    const res = await resumeDelivery('carry444')
    assert.equal(res.carryOn, 'landing')
    assert.equal(rowOf('carry444')?.landing?.status, 'waiting')
    assert.equal(rowOf('carry444')?.landing?.attempts, 2)
  })

  // A conflict keeps its whole record: the rebase and the resolutions staged in the
  // worktree are untouched, and `akb delivery conflict` is what carries them through.
  it('leaves a landing conflict exactly as it was', async () => {
    stopped('carry555', {
      landing: { status: 'conflict', attempts: 1, conflictFiles: ['shared.txt'], why: 'a conflict', at: 3_000 },
    })
    const res = await resumeDelivery('carry555')
    assert.equal(res.carryOn, 'conflict')
    assert.deepEqual(rowOf('carry555')?.landing?.conflictFiles, ['shared.txt'])
    assert.equal(rowOf('carry555')?.landing?.status, 'conflict')
  })

  it('sends a build nothing has reviewed to review', async () => {
    stopped('carry666')
    const res = await resumeDelivery('carry666')
    assert.equal(res.carryOn, 'review')
    assert.equal(rowOf('carry666')?.next, 'review')
  })

  // A review that ASKED is a review that stopped, not one that passed: it never queued, so
  // carrying the delivery on owes it another review. Putting it in the queue would land work
  // review never passed, the moment anything cleared the stop.
  it('sends one whose review asked a question to review, not to the landing queue', async () => {
    stopped('carry000', {
      review: {
        rounds: [{ sessionId: 'carry000-2', verdict: 'ask', findings: [], at: 1_700 }],
        stopped: { reason: 'ask', why: 'review left 1 open decision for you', at: 1_700 },
      },
    })
    const res = await resumeDelivery('carry000')
    assert.equal(res.carryOn, 'review')
    assert.equal(rowOf('carry000')?.next, 'review')
    assert.equal(rowOf('carry000')?.landing, undefined, 'nothing put it in the queue')
  })

  it('refuses one whose worktree is gone, and says which one', async () => {
    stopped('carry777')
    fs.rmSync(path.join(root, '.akb', 'worktrees', '5', 'carry777'), { recursive: true, force: true })
    const res = await resumeDelivery('carry777')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /worktree .* is gone/)
    assert.match(res.error ?? '', /delivery discard carry777/)
    assert.equal(rowOf('carry777'), undefined)
  })

  it('refuses one whose branch is gone', async () => {
    stopped('carry888')
    git('branch', '-D', 'card/5/carry888')
    const res = await resumeDelivery('carry888')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /branch card\/5\/carry888 is gone/)
  })

  // Manual commit mode has no checkout of its own: the work is in the user's tree and
  // their commit is what ends it.
  it('refuses a manual-commit delivery', async () => {
    stopped('carry999', { commitMode: 'manual' })
    const res = await resumeDelivery('carry999')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /committed in your own checkout/)
  })

  it('refuses one whose card another delivery has taken over', async () => {
    stopped('carryaaa')
    start(session())
    atImplementing()
    const res = await resumeDelivery('carryaaa')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /is building #5 now/)
  })

  it('refuses one whose card has left the board', async () => {
    stopped('carrybbb', { cardId: 404 })
    const res = await resumeDelivery('carrybbb')
    assert.equal(res.ok, false)
    assert.match(res.error ?? '', /#404 is no longer on the board/)
  })

  it('refuses a delivery that finished, and one still in flight', async () => {
    stopped('carryccc', { status: 'finished' })
    assert.match((await resumeDelivery('carryccc')).error ?? '', /finished/)
    const live = start(session())
    assert.match((await resumeDelivery(live)).error ?? '', /has not ended/)
  })

  // A card whose only delivery is in flight is not a card with no delivery: the refusal
  // names it and says what is wrong with it.
  it('names the delivery in flight when the card is asked for by number', async () => {
    const live = start(session())
    assert.match((await resumeDelivery('639')).error ?? '', /no delivery here answers/)
    assert.match((await resumeDelivery('5')).error ?? '', new RegExp(`delivery ${live} has not ended`))
  })

  // The live record keeps only the newest thirty ended rows, so the delivery worth
  // carrying on is often one that `deliveries/` alone still remembers.
  it('finds one the live record has let go, by id or by card number', async () => {
    stopped('carryddd')
    assert.equal(rowOf('carryddd'), undefined, 'the live record never had it')
    assert.equal((await resumeDelivery('5')).deliveryId, 'carryddd')
  })

  it('answers to a prefix of the delivery id', async () => {
    stopped('carryeee')
    assert.equal((await resumeDelivery('carrye')).deliveryId, 'carryeee')
  })
})

// Clearing up after an ended delivery (#720): the checkout of one somebody can still carry
// on stays, and every other ending gives its worktree and branch back. One rule, read off
// `resumeRefusal`, so the button and the clean-up can never disagree.
describe("an ended delivery's checkout", () => {
  const git = (...args: string[]): string =>
    spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout.trim()

  beforeEach(() => {
    git('init', '--quiet', '-b', 'main')
    git('config', 'user.email', 'test@example.com')
    git('config', 'user.name', 'test')
    fs.writeFileSync(path.join(root, 'code.txt'), 'one\n')
    git('add', 'code.txt')
    git('commit', '--quiet', '-m', 'start')
  })

  /** An ended delivery with a REAL worktree and branch — the record, and the checkout git
   *  actually made — so a clean-up either removes them or does not. */
  const ended = (id: string, over: Record<string, unknown> = {}): { worktree: string; branch: string } => {
    const cardId = (over.cardId ?? 5) as number | null
    const worktree = path.join('.akb', 'worktrees', cardId === null ? 'delivery' : String(cardId), id)
    const branch = cardId === null ? `delivery/${id}` : `card/${cardId}/${id}`
    git('worktree', 'add', '--quiet', '-b', branch, worktree, 'HEAD')
    withStore((store) =>
      store.deliveries.push({
        deliveryId: id,
        cardId,
        title: 'A card',
        status: 'failed',
        startedAt: 1_000,
        endedAt: 2_000,
        approved: '# A card\n',
        steps: [{ step: 'implement', at: 1_000 }],
        commitMode: 'auto',
        targetBranch: 'main',
        sessions: [],
        worktree,
        branch,
        ...over,
      } as never),
    )
    return { worktree, branch }
  }

  const onDisk = (at: { worktree: string; branch: string }): boolean =>
    fs.existsSync(path.join(root, at.worktree)) || git('branch', '--list', at.branch) !== ''

  // ---- the eight endings ----------------------------------------------------

  it('goes when the user cancelled it', async () => {
    const id = start(session())
    const at = { worktree: `.akb/worktrees/5/${id}`, branch: `card/5/${id}` }
    git('worktree', 'add', '--quiet', '-b', at.branch, at.worktree, 'HEAD')
    withStore((store) => {
      const live = store.deliveries.find((d) => d.deliveryId === id)!
      live.worktree = at.worktree
      live.branch = at.branch
      store.runs.length = 0
    })
    assert.equal((await cancelDelivery(id)).ok, true)
    assert.equal(onDisk(at), false)
  })

  // `stopRun` signals and returns, so the run is still alive for a moment after it. The
  // cancel waits it out rather than leaving its own checkout for the next sweep.
  it('waits for the run it stopped to go, then clears the checkout', async () => {
    const id = start(session())
    const at = { worktree: `.akb/worktrees/5/${id}`, branch: `card/5/${id}` }
    git('worktree', 'add', '--quiet', '-b', at.branch, at.worktree, 'HEAD')
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], { stdio: 'ignore' })
    withStore((store) => {
      const live = store.deliveries.find((d) => d.deliveryId === id)!
      live.worktree = at.worktree
      live.branch = at.branch
      const run = store.runs.find((r) => r.deliveryId === id)!
      run.pid = child.pid
      run.startedAt = Date.now()
    })
    try {
      assert.equal((await cancelDelivery(id)).ok, true)
      assert.equal(onDisk(at), false)
    } finally {
      child.kill('SIGKILL')
    }
  })

  it('goes when a fresh delivery superseded it', () => {
    const at = ended('tidy-sup', { status: 'cancelled', steps: [{ step: 'superseded', at: 2_000 }] })
    assert.equal(tidyCheckout('tidy-sup').removed, true)
    assert.equal(onDisk(at), false)
  })

  it('goes when the delivery finished with nothing to land', () => {
    const at = ended('tidy-fin', { status: 'finished' })
    assert.equal(tidyCheckout('tidy-fin').removed, true)
    assert.equal(onDisk(at), false)
  })

  it('goes when its work was already on the target branch', () => {
    const at = ended('tidy-had', {
      status: 'finished',
      landing: { status: 'landed', attempts: 1, at: 2_000, why: 'already on main' },
    })
    assert.equal(tidyCheckout('tidy-had').removed, true)
    assert.equal(onDisk(at), false)
  })

  it('stays when it failed with the card still here and nothing else on it', () => {
    const at = ended('tidy-keep')
    assert.deepEqual(tidyCheckout('tidy-keep'), { removed: false, kept: true })
    assert.equal(onDisk(at), true)
    assert.equal(keptCheckout('tidy-keep')?.worktree, at.worktree)
  })

  it('goes when a later delivery took the card over', () => {
    const at = ended('tidy-old')
    ended('tidy-new', { startedAt: 5_000, endedAt: 6_000 })
    assert.equal(tidyCheckout('tidy-old').removed, true)
    assert.equal(onDisk(at), false)
    assert.equal(keptCheckout('tidy-old'), undefined)
  })

  it('goes when the card was completed and left the board', () => {
    const at = ended('tidy-done')
    fs.rmSync(file)
    assert.equal(tidyCheckout('tidy-done').removed, true)
    assert.equal(onDisk(at), false)
  })

  it('goes when the card was removed from the board', () => {
    const at = ended('tidy-gone', { cardId: 404 })
    assert.equal(tidyCheckout('tidy-gone').removed, true)
    assert.equal(onDisk(at), false)
  })

  // ---- what must never trigger it -------------------------------------------

  // A board we cannot read is not a board with no cards on it. Reading it as one would
  // delete the checkout of every delivery here.
  it('stays when the card could not be read at all', () => {
    const at = ended('tidy-blind')
    const todoDir = path.join(root, 'docs', 'kanban', 'todo')
    fs.chmodSync(todoDir, 0o000)
    try {
      assert.equal(tidyCheckout('tidy-blind').kept, true)
      assert.equal(onDisk(at), true)
    } finally {
      fs.chmodSync(todoDir, 0o755)
    }
  })

  it('stays while the delivery is still in flight', () => {
    const at = ended('tidy-live', { status: 'active', endedAt: undefined })
    assert.deepEqual(tidyCheckout('tidy-live'), { removed: false, kept: false })
    assert.equal(onDisk(at), true)
  })

  // A delivery that has ended must not have its files pulled out from under a process still
  // writing them — the next sweep picks it up.
  it('waits while a run of it is still going, and says so', () => {
    const at = ended('tidy-busy', { status: 'finished' })
    withStore((store) => store.runs.push(session({ deliveryId: 'tidy-busy', startedAt: Date.now() })))
    const first = tidyCheckout('tidy-busy')
    assert.equal(first.removed, false)
    assert.match(first.error ?? '', /still going/)
    assert.equal(onDisk(at), true)
    withStore((store) => (store.runs.length = 0))
    assert.equal(tidyCheckout('tidy-busy').removed, true)
    assert.equal(onDisk(at), false)
  })

  // Every run commits its work to the branch as it closes, so what is left uncommitted is a
  // half-step an interruption left behind — it goes with the ending that threw the rest away.
  it('removes a worktree that still holds uncommitted changes', () => {
    const at = ended('tidy-dirty', { status: 'finished' })
    fs.writeFileSync(path.join(root, at.worktree, 'code.txt'), 'changed\n')
    fs.writeFileSync(path.join(root, at.worktree, 'untracked.txt'), 'new\n')
    assert.equal(tidyCheckout('tidy-dirty').removed, true)
    assert.equal(onDisk(at), false)
  })

  // ---- the sweep as the board comes up --------------------------------------

  it('clears every leftover checkout at once and keeps the recoverable one', () => {
    const keep = ended('sweep-keep')
    const drop = ended('sweep-drop', { status: 'cancelled' })
    const cardless = ended('sweep-none', { cardId: null, status: 'finished' })
    assert.deepEqual(sweepCheckouts(), [])
    assert.equal(onDisk(keep), true)
    assert.equal(onDisk(drop), false)
    assert.equal(onDisk(cardless), false)
  })

  // The empty `<card>/` folders a release that removed worktrees without them left behind,
  // and nothing else: a folder with anything in it is somebody's.
  it('drops the empty card folders an older release left under .akb/worktrees', () => {
    const empty = path.join(root, '.akb', 'worktrees', '338')
    const used = path.join(root, '.akb', 'worktrees', 'kanban-ui')
    fs.mkdirSync(empty, { recursive: true })
    fs.mkdirSync(used, { recursive: true })
    fs.writeFileSync(path.join(used, 'node_modules'), 'not empty\n')
    const keep = ended('sweep-folders')
    assert.deepEqual(sweepCheckouts(), [])
    assert.equal(fs.existsSync(empty), false)
    assert.equal(fs.existsSync(used), true)
    assert.equal(onDisk(keep), true, 'and a kept checkout is still where it was')
  })

  // The permanent record outlives the live one, so a worktree older than the newest thirty
  // deliveries is still reachable — and the record itself is never deleted.
  it('reaches one the live record has already let go, and keeps its audit', () => {
    const at = ended('sweep-old', { status: 'cancelled' })
    fs.mkdirSync(DELIVERIES, { recursive: true })
    fs.writeFileSync(
      path.join(DELIVERIES, 'sweep-old.json'),
      JSON.stringify({ ...rowOf720('sweep-old'), sessions: [] }),
    )
    withStore((store) => (store.deliveries.length = 0))
    assert.deepEqual(sweepCheckouts(), [])
    assert.equal(onDisk(at), false)
    const audit = JSON.parse(fs.readFileSync(path.join(DELIVERIES, 'sweep-old.json'), 'utf8'))
    assert.equal(audit.deliveryId, 'sweep-old')
    assert.equal(audit.worktree, undefined, 'the record no longer points at a folder that is gone')
  })

  const rowOf720 = (id: string) => readStore().deliveries.find((d) => d.deliveryId === id)!

  // ---- what the record must not forget --------------------------------------

  // The entry is on the delivery's own row and on the run beside it, and the record trims
  // both. A kept checkout that aged out of the record would be work on disk with nothing
  // pointing at it.
  it('is never trimmed out of the live record, log or no log', () => {
    ended('keep-me', { cardId: null })
    withStore((store) => {
      store.runs.push(session({ deliveryId: 'keep-me', cardId: null, logPath: '/nowhere/keep-me.log' }))
      // Far more endings than the record keeps, all newer, so trimming has to choose.
      for (let i = 0; i < 40; i++) {
        store.deliveries.push({
          ...rowOf720('keep-me'),
          deliveryId: `filler${i}`,
          startedAt: 9_000 + i,
          worktree: undefined,
          branch: undefined,
        })
      }
    })
    // One more write, so the trim runs over everything above.
    withStore((store) => (store.marks = { ...store.marks, poke: String(Date.now()) }))
    assert.ok(rowOf720('keep-me'), 'the delivery holding a checkout is still here')
    assert.ok(
      readStore().runs.some((r) => r.deliveryId === 'keep-me'),
      'and so is the run its entry is drawn on',
    )
  })
})

function readAudit(id: string): {
  status: string
  cardId: number | null
  approved: string
  endedAt?: number
  branch?: string
  landing?: Record<string, unknown>
  sessions: { sessionId: string; log: string; status: string }[]
} {
  return JSON.parse(fs.readFileSync(path.join(DELIVERIES, `${id}.json`), 'utf8'))
}
