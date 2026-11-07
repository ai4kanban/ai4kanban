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
import { restartPrompt, resumePrompt } from '../src/lib/agent/prompts.ts'
import { cancelDelivery, listRuns, openResume, recoverOrphanedDeliveries, resumeDelivery } from '../src/lib/agent/sessions.ts'
import { readStore, withStore } from '../src/lib/agent/store.ts'
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
  'status: ready',
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
  '## By `security` agent',
  '- **A risk**: mitigated.',
  '',
  '<!-- agent -->',
  '',
  '## Scope',
  '- **A requirement**: one line.',
  '',
  '## Todo',
  '- [ ] the first step',
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
  // Nothing reviews the build (#1203), and outside git there is no commit to wait for.
  it('waits for explicit completion outside a git repository', async () => {
    const id = start(session())
    await settleDelivery({ ...readStore().runs[0]!, status: 'done' })
    assert.equal(activeDelivery(5)?.status, 'active')
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

// A build with no card at all (#428) — what **Start now** starts. The typed sentence is the
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

  it('is found by its own id', () => {
    const id = startCardless(session({ cardId: null }))
    assert.equal(findDelivery(id)?.deliveryId, id)
    assert.equal(namedDelivery(id)?.deliveryId, id)
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

  // A cardless resume needs the frozen requirement, with no card-writing step.
  it('quotes the typed sentence to a run that has to start over', () => {
    const id = startCardless(session({ cardId: null }))
    const prompt = restartPrompt({ action: 'implement' }, id) ?? ''
    assert.match(prompt, /is gone, and this one holds nothing of it/)
    assert.match(prompt, new RegExp(`Continue delivery ${id}`))
    assert.match(prompt, /create no card and build exactly this approved requirement/)
    assert.doesNotMatch(prompt, /write (?:it|its card)/)
    assert.match(prompt, new RegExp(typed))
  })

  // #416: a build that ended without recording completion is told only that.
  it('resumes its own session with just the stop reason', () => {
    const id = startCardless(session({ cardId: null }))
    withStore((store) => {
      store.runs.at(-1)!.status = 'done'
    })
    assert.equal(
      resumePrompt(id, 'implement'),
      `Continue delivery ${id}. The delivery has not recorded completion. Finish its unchecked todos, then run akb delivery complete ${id}, with --commit <sha> --branch <name> in a git project.`,
    )
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

    it('leaves what was frozen with no card frozen — nothing reviews it', () => {
      const id = withStore((store) => {
        const run = session({ cardId: null })
        store.runs.push(run)
        const delivery = joinDelivery(store, run, typed, 'implement', undefined, { title: typed, approved: typed })
        return delivery.deliveryId
      })
      adoptDirectCard(readStore().runs[0]!.sessionId, 9)
      const delivery = findDelivery(id)!
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
      withStore((store) => store.runs.push(session({ cardId: null, action: 'clarify' })))
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

  it('keeps a cardless legacy delivery active until completion', async () => {
    const id = startCardless(session({ cardId: null }))
    withStore((store) => {
      const live = store.deliveries.find((d) => d.deliveryId === id)!
      live.commitMode = 'manual'
    })
    await settleDelivery({ ...readStore().runs[0]!, status: 'done' })
    const ended = readStore().deliveries.find((d) => d.deliveryId === id)!
    assert.equal(ended.status, 'active')
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
    resting('rest1111')
    assert.deepEqual(await recoverOrphanedDeliveries(), [])
    const row = rowOf('rest1111')
    assert.equal(row?.status, 'active')
    assert.equal(row?.cardId, 5)
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
      status: 'landing',
      attempts: 2,
      rebasedFrom: 'main',
      originalBase: undefined,
      onto: 'abc123',
      at: 3_000,
      why: undefined,
      wait: undefined,
      reason: undefined,
      rebasedAt: undefined,
      rebaseKind: undefined,
      commit: undefined,
      overlap: undefined,
      conflictFiles: undefined,
      conflictFails: undefined,
      conflictAt: undefined,
      retryAt: undefined,
      fitAt: undefined,
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

  // A **Start now** delivery holds no card, so there is no card check to pass (#428).
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
    assert.match(res.error ?? '', /was cancelled, and its files were preserved/)
  })

  // A run of a delivery that can no longer be carried on offers no Resume, and refuses one
  // asked for by id (#930).
  it('takes Resume away from a run of a cancelled delivery', async () => {
    stopped('carry333', { status: 'cancelled' })
    const run = session({ deliveryId: 'carry333', status: 'error', endedAt: 2_000 })
    fs.mkdirSync(path.dirname(run.logPath), { recursive: true })
    fs.writeFileSync(run.logPath, '')
    withStore((store) => {
      store.runs.push(run)
      store.deliveries.push(rowOf2('carry333'))
    })
    assert.equal((await listRuns()).find((r) => r.sessionId === run.sessionId)?.canResume, false)
    const res = await openResume(run.sessionId)
    assert.ok('error' in res)
    assert.match(res.error, /was cancelled/)
  })

  it('keeps Resume on a run of a failed delivery that can be carried on', async () => {
    stopped('carry444')
    const run = session({ deliveryId: 'carry444', status: 'error', endedAt: 2_000 })
    fs.mkdirSync(path.dirname(run.logPath), { recursive: true })
    fs.writeFileSync(run.logPath, '')
    withStore((store) => {
      store.runs.push(run)
      store.deliveries.push(rowOf2('carry444'))
    })
    assert.equal((await listRuns()).find((r) => r.sessionId === run.sessionId)?.canResume, true)
  })

  it('keeps Resume on a run of a failed delivery that worked in the project', async () => {
    stopped('carry555', { commitMode: 'manual', worktree: undefined, branch: undefined })
    const run = session({ deliveryId: 'carry555', status: 'error', endedAt: 2_000 })
    fs.mkdirSync(path.dirname(run.logPath), { recursive: true })
    fs.writeFileSync(run.logPath, '')
    withStore((store) => {
      store.runs.push(run)
      store.deliveries.push(rowOf2('carry555'))
    })
    assert.equal((await listRuns()).find((r) => r.sessionId === run.sessionId)?.canResume, true)
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
    assert.equal(res.carryOn, 'build')
    assert.equal(rowOf('carry444')?.landing?.status, 'landing')
    assert.equal(rowOf('carry444')?.landing?.attempts, 2)
  })

  // A conflict keeps its whole record: the rebase and the resolutions staged in the
  // worktree are untouched, and `akb delivery conflict` is what carries them through.
  it('leaves a landing conflict exactly as it was', async () => {
    stopped('carry555', {
      landing: { status: 'conflict', attempts: 1, conflictFiles: ['shared.txt'], why: 'a conflict', at: 3_000 },
    })
    const res = await resumeDelivery('carry555')
    assert.equal(res.carryOn, 'build')
    assert.deepEqual(rowOf('carry555')?.landing?.conflictFiles, ['shared.txt'])
    assert.equal(rowOf('carry555')?.landing?.status, 'conflict')
  })

  it('sends a delivery that never queued back to its build', async () => {
    stopped('carry666')
    const res = await resumeDelivery('carry666')
    assert.equal(res.carryOn, 'build')
    assert.equal(rowOf('carry666')?.landing, undefined, 'nothing put it in the queue')
  })

  it('hands missing worktree context back to the agent', async () => {
    stopped('carry777')
    fs.rmSync(path.join(root, '.akb', 'worktrees', '5', 'carry777'), { recursive: true, force: true })
    const res = await resumeDelivery('carry777')
    assert.equal(res.ok, true)
  })

  it('lets the agent recover a missing legacy branch', async () => {
    stopped('carry888')
    git('branch', '-D', 'card/5/carry888')
    const res = await resumeDelivery('carry888')
    assert.equal(res.ok, true)
  })

  // Manual commit mode has no checkout of its own: the work is in the user's tree and
  // their commit is what ends it.
  it('resumes a legacy manual delivery', async () => {
    stopped('carry999', { commitMode: 'manual' })
    const res = await resumeDelivery('carry999')
    assert.equal(res.ok, true)
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
    const live = start(session({ pid: process.pid, startedAt: Date.now() }))
    assert.match((await resumeDelivery(live)).error ?? '', /still has a running agent/)
  })

  // A card whose only delivery is in flight is not a card with no delivery: the refusal
  // names it and says what is wrong with it.
  it('names the delivery in flight when the card is asked for by number', async () => {
    const live = start(session())
    assert.match((await resumeDelivery('639')).error ?? '', /no delivery here answers/)
    assert.equal((await resumeDelivery('5')).deliveryId, live)
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
