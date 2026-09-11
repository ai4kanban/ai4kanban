// A card is on the board from the moment its file is written, while the run that called for
// it carries on filling in the plan (#564). Until that run finishes WELL the card is not one
// to act on: the reader says so, and every card action refuses.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { collectReports } from '../src/lib/agent/collect.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { openRun } from '../src/lib/agent/sessions.ts'
import { cardsBeingCreated, logPathOf, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord, RunStatus } from '../src/lib/agent/types.ts'
import { patchCard, setCardSchedule } from '../src/lib/view/edit.ts'
import { findCard } from '../src/lib/view/read.ts'
import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, refuses, run } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-card-creation-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')

beforeEach(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '8\n')
  setBoardRoot(root)
})

after(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(root, { recursive: true, force: true })
})

// A live creation run: a pid that answers, so the record reads it as working.
const creator = (over: Partial<RunRecord> = {}): RunRecord => ({
  sessionId: 'creator-run',
  cardId: null,
  action: 'create',
  status: 'running',
  startedAt: Date.now(),
  pid: process.pid,
  harness: 'test',
  logPath: logPathOf('creator-run'),
  ...over,
})

/** Write a card the way a run does: `akb raw create` from inside it. */
async function createdInRun(over: Partial<RunRecord> = {}): Promise<number> {
  const run = creator(over)
  // With its log where a run's log goes: the record drops a finished run whose log is gone.
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  fs.writeFileSync(run.logPath, '')
  withStore((store) => store.runs.push(run))
  process.env[RUN_ENV] = run.sessionId
  const made = await move(root, ['create', '--title', 'A card being written'])
  delete process.env[RUN_ENV]
  // The run reports its cards into the project and the process watching it applies them
  // (#622). Nothing watches a test, so the collection is made here.
  await collectReports(run.sessionId)
  return made.id as number
}

/** How that run ended, once it is over. */
const endCreator = (status: RunStatus): void =>
  withStore((store) => {
    for (const r of store.runs) {
      r.status = status
      r.pid = undefined
      r.endedAt = Date.now()
    }
  })

describe('a card is not finished being created until its creator is', () => {
  it('reads as being created while the run that wrote it is live', async () => {
    const id = await createdInRun()
    assert.deepEqual(findCard(id)?.creation, { state: 'creating', runId: 'creator-run' })
  })

  it('becomes an ordinary card the moment that run finishes successfully', async () => {
    const id = await createdInRun()
    endCreator('done')
    assert.equal(findCard(id)?.creation, undefined)
    assert.equal(cardsBeingCreated().size, 0)
  })

  it('stays unfinished when its creator ended any other way', async () => {
    const id = await createdInRun()
    endCreator('error')
    assert.deepEqual(findCard(id)?.creation, { state: 'unfinished', runId: 'creator-run' })
  })

  it('is unfinished when its creator was cut off with the record still saying running', async () => {
    const id = await createdInRun()
    // The process is gone but nothing reaped the record: `runIsLive` is what settles it.
    withStore((store) => {
      for (const r of store.runs) r.pid = 2 ** 30
    })
    assert.deepEqual(findCard(id)?.creation, { state: 'unfinished', runId: 'creator-run' })
  })

  it('is never in this state when a person typed the create', async () => {
    const made = await move(root, ['create', '--title', 'Typed by hand'])
    assert.equal(findCard(made.id as number)?.creation, undefined)
  })

  it('is not being created once the run has taken it as its own', async () => {
    const id = await createdInRun({ action: 'implement' })
    // What `adoptDirectCard` writes for a **Build now**: the run holds the card it made,
    // and from then on it is being built rather than written.
    withStore((store) => {
      for (const r of store.runs) r.cardId = id
    })
    assert.equal(findCard(id)?.creation, undefined)
  })
})

describe('no action reaches a card that is not finished being created', () => {
  it('refuses to start a run on it, and says why', async () => {
    const id = await createdInRun()
    const out = openRun({ action: 'clarify', id }, 'a prompt')
    assert.ok('error' in out)
    assert.match(out.error, /still being created by run creator-/)
  })

  it('refuses a printed flow to anyone but the run that is creating it', async () => {
    const id = await createdInRun()
    await assert.rejects(
      () => run(root, ['card', 'refine', String(id), '--print']),
      /still being created/,
    )
  })

  // The one exemption, and what the create flow rests on: a run writes a card and then goes
  // on to refine it inline. Fencing the creator out of its own card would refuse the very
  // run that finishes it.
  it('lets the run doing the creating work its own card', async () => {
    const id = await createdInRun()
    process.env[RUN_ENV] = 'creator-run'
    try {
      await run(root, ['card', 'refine', String(id), '--print'])
    } finally {
      delete process.env[RUN_ENV]
    }
  })

  it('refuses an edit', async () => {
    const id = await createdInRun()
    assert.throws(() => patchCard(id, { title: 'Renamed' }), /still being created/)
  })

  // The other door onto the same write: `update` is what a terminal types, `patchCard` what
  // a screen calls, and the card cannot refuse one and take the other.
  it('refuses the same edit typed as a move', async () => {
    const id = await createdInRun()
    await refuses(root, ['update', String(id), '--title', 'Renamed'], /still being created/)
  })

  it('lets the run doing the creating fill the card in', async () => {
    const id = await createdInRun()
    process.env[RUN_ENV] = 'creator-run'
    try {
      await move(root, ['update', String(id), '--priority', 'high'])
    } finally {
      delete process.env[RUN_ENV]
    }
    assert.equal(findCard(id)?.priority, 'high')
  })

  it('refuses a schedule, and refuses to take one off', async () => {
    const id = await createdInRun()
    assert.throws(() => setCardSchedule(id, { action: 'refine', notes: '' }), /still being created/)
    assert.throws(() => setCardSchedule(id, null), /still being created/)
  })

  it('refuses archive and reject', async () => {
    const id = await createdInRun()
    await refuses(root, ['archive', String(id)], /still being created/)
    await refuses(root, ['reject', String(id)], /still being created/)
  })

  it('names the run to pick back up once its creator stopped short', async () => {
    const id = await createdInRun()
    endCreator('error')
    await refuses(root, ['archive', String(id)], /never finished being created.*picked back up/s)
  })

  it('lets every one of them through once the creator finishes', async () => {
    const id = await createdInRun()
    endCreator('done')
    patchCard(id, { title: 'Renamed' })
    assert.equal(findCard(id)?.title, 'Renamed')
    await move(root, ['archive', String(id)])
    assert.equal(findCard(id), null)
  })
})
