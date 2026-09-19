// A card is on the board from the moment its file is written, while the run that called for
// it carries on filling in the plan (#564). Until that run finishes WELL the card is not one
// to act on: the reader says so, and every card action refuses.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { RUN_ENV } from '../src/lib/agent/env.ts'
import { cleanupDiscardedCards } from '../src/commands/remove.ts'
import { discardedCardsPrompt } from '../src/lib/agent/prompts.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { openResume, peekRun, openRun, patch } from '../src/lib/agent/sessions.ts'
import { cardsBeingCreated, logPathOf, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord, RunStatus } from '../src/lib/agent/types.ts'
import { patchCard, setCardSchedule } from '../src/lib/view/edit.ts'
import { findCard } from '../src/lib/view/read.ts'
import { ASSETS, SESSIONS, SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
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

describe('discarding unfinished creation', () => {
  for (const status of ['error', 'stopped', 'interrupted'] as const) {
    it(`discards after ${status} through both the printed flow and raw removal`, async () => {
      const id = await createdInRun()
      endCreator(status)
      await run(root, ['card', 'reject', String(id), '--discard', '--print'])
      await refuses(root, ['reject', String(id)], /Use reject --discard/)
      const opened = openRun({ action: 'reject', id, discard: true }, 'Discard')
      assert.ok(!('error' in opened))
      assert.equal(peekRun(opened.run.sessionId)?.discard, true)
      process.env[RUN_ENV] = opened.run.sessionId
      try { await move(root, ['reject', String(id), '--discard']) }
      finally { delete process.env[RUN_ENV] }
      assert.equal(findCard(id), null)
      const saved = peekRun('creator-run')?.discardedCards
      assert.equal(saved?.[0]?.id, id)
      assert.equal(saved?.[0]?.pending, undefined)
      assert.ok(saved?.[0]?.path.endsWith('.md'))
      assert.equal(fs.existsSync(path.join(kanban, 'memory')), false)
    })
  }

  it('discards when the creation process vanished', async () => {
    const id = await createdInRun({ pid: 2 ** 30 })
    await move(root, ['reject', String(id), '--discard'])
    assert.equal(findCard(id), null)
  })

  it('does not let the creator bypass the live discard guard', async () => {
    const id = await createdInRun()
    process.env[RUN_ENV] = 'creator-run'
    await refuses(root, ['reject', String(id), '--discard'], /still being created/)
    await assert.rejects(() => run(root, ['card', 'reject', String(id), '--discard', '--print']), /still being created/)
    assert.ok('error' in openRun({ action: 'reject', id, discard: true }, 'Discard'))
    assert.ok(findCard(id))
  })

  it('refuses the whole group when one child is occupied', async () => {
    const id = await createdInRun()
    endCreator('error')
    const child = await move(root, ['create', '--title', 'Child'])
    const group = path.join(todo, `${id}-group`)
    fs.mkdirSync(group)
    fs.renameSync(path.join(todo, findCard(id)!.relPath), path.join(group, 'root.md'))
    fs.renameSync(path.join(todo, findCard(child.id as number)!.relPath), path.join(group, `${child.id}-child.md`))
    withStore((s) => s.runs.push(creator({ sessionId: 'child-worker', action: 'clarify', cardId: child.id as number, createdCardIds: [] })))
    await refuses(root, ['reject', String(id), '--discard'], /still being worked on/)
    assert.ok(findCard(id))
    assert.ok(findCard(child.id as number))
    assert.equal(peekRun('creator-run')?.discardedCards, undefined)
  })

  it('carries the discard across repeated resumes and removes a stale write without counting twice', async () => {
    const id = await createdInRun({ harness: 'claude-code' })
    const file = path.join(todo, findCard(id)!.relPath)
    const text = fs.readFileSync(file, 'utf8')
    process.env[RUN_ENV] = 'creator-run'
    const sibling = await move(root, ['create', '--title', 'Keep this card'])
    delete process.env[RUN_ENV]
    endCreator('error')
    await move(root, ['reject', String(id), '--discard'])
    const metrics = fs.readFileSync(path.join(kanban, 'metrics.csv'), 'utf8')
    let previous = 'creator-run'
    for (let turn = 0; turn < 2; turn++) {
      const resumed = await openResume(previous)
      assert.ok(!('error' in resumed), 'error' in resumed ? resumed.error : '')
      const { run: current } = resumed
      assert.equal(current.discardedCards?.[0]?.id, id)
      assert.match(discardedCardsPrompt(current.discardedCards), /Do not restore or recreate/)
      fs.writeFileSync(file, text)
      process.env[RUN_ENV] = current.sessionId
      assert.throws(() => patchCard(id, { title: 'Restored' }), /was discarded/)
      delete process.env[RUN_ENV]
      cleanupDiscardedCards(current.sessionId)
      assert.equal(findCard(id), null)
      assert.ok(findCard(sibling.id as number))
      assert.equal(fs.readFileSync(path.join(kanban, 'metrics.csv'), 'utf8'), metrics)
      fs.writeFileSync(current.logPath, '')
      endCreator(turn ? 'done' : 'error')
      previous = current.sessionId
    }
    assert.equal(findCard(sibling.id as number)?.creation, undefined)
  })

  it('keeps a failed removal retryable, and blocks resume until the retry succeeds', async () => {
    const id = await createdInRun({ harness: 'claude-code' })
    endCreator('error')
    const file = path.join(todo, findCard(id)!.relPath)
    fs.writeFileSync(path.join(todo, 'README.md'), `# Tasks\n- [#${id}](8-a-card-being-written.md)\n`)
    const before = fs.readFileSync(path.join(todo, 'README.md'), 'utf8')
    const original = fs.rmSync
    fs.rmSync = ((target, options) => {
      if (String(target) === file) throw new Error('simulated removal failure')
      return original(target, options)
    }) as typeof fs.rmSync
    try { await refuses(root, ['reject', String(id), '--discard'], /simulated removal failure/) }
    finally { fs.rmSync = original }
    assert.ok(findCard(id))
    assert.equal(fs.readFileSync(path.join(todo, 'README.md'), 'utf8'), before)
    assert.equal(peekRun('creator-run')?.discardedCards?.[0]?.id, id)
    assert.ok('error' in await openResume('creator-run'))
    await move(root, ['reject', String(id), '--discard'])
    assert.equal(findCard(id), null)
    assert.ok(!('error' in await openResume('creator-run')))
  })

  it('refuses discard after resume wins, and resume after discard starts', async () => {
    const id = await createdInRun({ harness: 'claude-code' })
    endCreator('error')
    const resumed = await openResume('creator-run')
    assert.ok(!('error' in resumed))
    await refuses(root, ['reject', String(id), '--discard'], /still being created/)
    fs.writeFileSync(resumed.run.logPath, '')
    endCreator('error')
    const discard = openRun({ action: 'reject', id, discard: true }, 'Discard')
    assert.ok(!('error' in discard))
    const denied = await openResume(resumed.run.sessionId)
    assert.ok('error' in denied)
    assert.match(denied.error, /already being worked on/)
  })

  it('preserves the explicit discard flag when resuming a discard run', async () => {
    const id = await createdInRun()
    endCreator('error')
    const opened = openRun({ action: 'reject', id, discard: true }, 'Discard')
    assert.ok(!('error' in opened))
    fs.writeFileSync(opened.run.logPath, '')
    withStore((s) => { const r = s.runs.find((r) => r.sessionId === opened.run.sessionId)!; r.harness = 'claude-code'; r.status = 'error' })
    const resumed = await openResume(opened.run.sessionId)
    assert.ok(!('error' in resumed), 'error' in resumed ? resumed.error : '')
    assert.equal(resumed.run.discard, true)
  })
})


describe('a resumed creator watcher', () => {
  it('passes the discard list to the agent and cleans a stale write before validation and follow-ups', async () => {
    const id = await createdInRun({ harness: 'claude-code' })
    const file = path.join(todo, findCard(id)!.relPath)
    const original = fs.readFileSync(file, 'utf8')
    process.env[RUN_ENV] = 'creator-run'
    const sibling = await move(root, ['create', '--title', 'Surviving card'])
    delete process.env[RUN_ENV]
    endCreator('error')
    await move(root, ['reject', String(id), '--discard'])
    withStore((s) => { s.runs[0]!.formatRepair = { attempt: 0, cardIds: [id], changedIds: [id], existingIds: [id], errors: `Task #${id} disappeared. Restore its card file.` } })
    const resumed = await openResume('creator-run')
    assert.ok(!('error' in resumed))
    assert.equal(resumed.run.formatRepair, undefined)
    const script = path.join(root, 'stale-writer.mjs')
    const promptFile = path.join(root, 'prompt.txt')
    fs.writeFileSync(script, `import fs from 'node:fs'; let input=''; for await (const chunk of process.stdin) input+=chunk; fs.writeFileSync(${JSON.stringify(promptFile)}, input + process.argv.slice(2).join(' ')); fs.writeFileSync(${JSON.stringify(file)}, ${JSON.stringify(original)}); console.log(JSON.stringify({type:'result',result:'Done',total_cost_usd:0.01,usage:{input_tokens:1,output_tokens:1}}));`)
    resumed.spec.plan.argv = [process.execPath, script]
    resumed.spec.plan.harness = 'claude-code'
    fs.writeFileSync(path.join(SESSIONS_DIR, `${resumed.run.sessionId}.plan.json`), JSON.stringify(resumed.spec))
    patch(resumed.run.sessionId, (r) => { r.pid = process.pid })
    const metric = fs.readFileSync(path.join(kanban, 'metrics.csv'), 'utf8')
    assert.equal(await watchRun(resumed.run.sessionId), 0)
    assert.match(fs.readFileSync(promptFile, 'utf8'), /Do not restore or recreate/)
    assert.equal(findCard(id), null)
    assert.equal(findCard(sibling.id as number)?.creation, undefined)
    assert.equal(fs.readFileSync(path.join(kanban, 'metrics.csv'), 'utf8'), metric)
    assert.equal(peekRun(resumed.run.sessionId)?.status, 'done')
  })
})


describe('discard durability and cleanup', () => {
  it('keeps the card and index when persisting the decision fails, then permits retry', async () => {
    const id = await createdInRun({ harness: 'claude-code' })
    endCreator('error')
    const rename = fs.renameSync
    let writes = 0
    fs.renameSync = ((from, to) => {
      if (String(to) === SESSIONS && ++writes === 2) throw new Error('simulated persistence failure')
      return rename(from, to)
    }) as typeof fs.renameSync
    try { await refuses(root, ['reject', String(id), '--discard'], /simulated persistence failure/) }
    finally { fs.renameSync = rename }
    assert.ok(findCard(id))
    assert.ok('error' in await openResume('creator-run'))
    await move(root, ['reject', String(id), '--discard'])
    assert.equal(findCard(id), null)
  })

  it('cleans references and assets even when an old session only restores those', async () => {
    const id = await createdInRun()
    endCreator('error')
    const sibling = await move(root, ['create', '--title', 'References'])
    await move(root, ['reject', String(id), '--discard'])
    const file = path.join(todo, findCard(sibling.id as number)!.relPath)
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('related: []', `related: [${id}]`).replace('blocked_by: []', `blocked_by: [${id}]`))
    fs.writeFileSync(path.join(todo, 'README.md'), `# Tasks\n- [#${id}](8-a-card-being-written.md)\n`)
    fs.mkdirSync(path.join(ASSETS, String(id)), { recursive: true })
    fs.writeFileSync(path.join(ASSETS, String(id), 'stale.txt'), 'stale asset')
    const metric = fs.readFileSync(path.join(kanban, 'metrics.csv'), 'utf8')
    cleanupDiscardedCards('creator-run')
    assert.deepEqual(findCard(sibling.id as number)?.related, [])
    assert.deepEqual(findCard(sibling.id as number)?.blocked_by, [])
    assert.equal(fs.existsSync(path.join(ASSETS, String(id))), false)
    assert.doesNotMatch(fs.readFileSync(path.join(todo, 'README.md'), 'utf8'), /8-a-card/)
    assert.equal(fs.readFileSync(path.join(kanban, 'metrics.csv'), 'utf8'), metric)
    await refuses(root, ['reject', String(id), '--discard'], /no task with id/)
    assert.equal(fs.readFileSync(path.join(kanban, 'metrics.csv'), 'utf8'), metric)
  })
})
