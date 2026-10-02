// What the board starts on its own. A group's subtasks never show in the columns, so the
// dispatcher reads every card instead — otherwise a scheduled subtask stays queued for good.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { logPathOf, noteRefineTried, readStore, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { CHATS_DIR, SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'
import { nextWork } from '../src/lib/view/dispatch.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-dispatch-'))
const kanban = path.join(root, 'docs', 'kanban')
const track = path.join(kanban, 'todo', 'features')
const groupTrack = path.join(kanban, 'todo', '10-a-group', 'features')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(groupTrack, { recursive: true })
  fs.mkdirSync(track, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '20\n')
  // A described product, so the product writer (#1268) is not due alongside.
  fs.mkdirSync(path.join(kanban, 'memory'), { recursive: true })
  fs.writeFileSync(path.join(kanban, 'memory', 'product.md'), '# Product\n\n## What it is\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

function body(
  id: number,
  opts: { schedule?: Meta['schedule']; subtasks?: number[]; questions?: string[]; blockedBy?: number[]; priority?: Meta['priority'] } = {},
): string {
  const meta: Partial<Meta> = {
    title: `Card ${id}`,
    priority: opts.priority ?? 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: opts.blockedBy ?? [],
    related: [],
    modules: [],
    questions: (opts.questions ?? []).map((text) => ({ text })),
    schedule: opts.schedule ?? null,
  }
  const todo = opts.subtasks
    ? `## Subtasks\n\n${opts.subtasks.map((s) => `- [ ] #${s}`).join('\n')}\n`
    : '## Todo\n\n- [ ] Build it.\n'
  return `${serializeFrontmatter(meta)}\n\nA card.\n\n${todo}`
}

const refine = { action: 'refine', notes: '' } as const

describe('the runs the board starts on its own', () => {
  it('starts a scheduled group subtask, which the columns never show', async () => {
    fs.writeFileSync(path.join(kanban, 'todo', '10-a-group', 'root.md'), body(10, { subtasks: [11] }))
    fs.writeFileSync(path.join(groupTrack, '11-sub.md'), body(11, { schedule: refine }))
    const cleared: number[] = []

    const work = await nextWork((id) => {
      cleared.push(id)
      return Promise.resolve(true)
    })

    assert.deepEqual(cleared, [11])
    assert.deepEqual(work, [{ action: 'clarify', id: 11, title: 'Card 11', notes: undefined, refineRound: 1 }])
  })

  it('still starts a scheduled standalone card', async () => {
    fs.writeFileSync(path.join(track, '12-plain.md'), body(12, { schedule: refine }))

    const work = await nextWork(() => Promise.resolve(true))

    assert.deepEqual(work, [{ action: 'clarify', id: 12, title: 'Card 12', notes: undefined, refineRound: 1 }])
  })

  // A card whose own chat is answering is held (#633), so a start would be refused. It is
  // skipped here rather than left to that refusal: the mark comes off in the pass that hands
  // the run back, and a run refused after that would lose the schedule for good.
  it('skips a card its own chat is discussing, and leaves its mark on', async () => {
    fs.writeFileSync(path.join(track, '12-plain.md'), body(12, { schedule: refine }))
    const marker = path.join(CHATS_DIR, 'card-12.answering')
    fs.mkdirSync(marker, { recursive: true })
    fs.writeFileSync(path.join(marker, 'owner'), `${process.pid}\n`)
    const cleared: number[] = []

    const work = await nextWork((id) => {
      cleared.push(id)
      return Promise.resolve(true)
    })

    assert.deepEqual(work, [])
    assert.deepEqual(cleared, [], 'the schedule is still there for the tick after the reply')
  })

  it('starts one scheduled card per tick, leaving the rest their mark', async () => {
    fs.writeFileSync(path.join(kanban, 'todo', '10-a-group', 'root.md'), body(10, { subtasks: [11] }))
    fs.writeFileSync(path.join(groupTrack, '11-sub.md'), body(11, { schedule: refine }))
    fs.writeFileSync(path.join(track, '12-plain.md'), body(12, { schedule: refine }))
    const cleared: number[] = []

    const work = await nextWork((id) => {
      cleared.push(id)
      return Promise.resolve(true)
    })

    assert.equal(work.length, 1)
    assert.deepEqual(cleared, [work[0]!.id])
  })
})

// A card nothing has refined is refined once, however it got that way (#1366).
describe('the cards the board refines on its own', () => {
  const noMark = () => Promise.resolve(true)
  const clarify = (id: number) => ({ action: 'clarify', id, title: `Card ${id}`, refineRound: 1 })

  /** Write a card whose file was last touched `ago` ms back — three minutes unless said. */
  function write(id: number, opts: Parameters<typeof body>[1] = {}, ago = 3 * 60_000): void {
    const file = path.join(track, `${id}-card.md`)
    fs.writeFileSync(file, body(id, opts))
    const at = new Date(Date.now() - ago)
    fs.utimesSync(file, at, at)
  }

  const liveRun = (over: Partial<RunRecord>): void => {
    const run: RunRecord = {
      sessionId: 'live-run',
      cardId: null,
      action: 'create',
      status: 'running',
      startedAt: Date.now(),
      pid: process.pid,
      harness: 'test',
      logPath: logPathOf('live-run'),
      ...over,
    }
    fs.mkdirSync(SESSIONS_DIR, { recursive: true })
    fs.writeFileSync(run.logPath, '')
    withStore((store) => store.runs.push(run))
  }

  it('leaves the cards already refinable on its first pass to the user', async () => {
    write(12)

    assert.deepEqual(await nextWork(noMark), [])
    assert.deepEqual(readStore().refined, [12])
    assert.deepEqual(await nextWork(noMark), [], 'and never comes back for them')
  })

  it('refines a card once its last [user] question is answered, and only once', async () => {
    write(12, { questions: ['[user] Which layout?'] })
    assert.deepEqual(await nextWork(noMark), [])
    assert.deepEqual(await nextWork(noMark), [], 'a card waiting on its answer is not refined')

    write(12)
    assert.deepEqual(await nextWork(noMark), [clarify(12)])
    // The refine failed or settled nothing: the card is still refinable, and still listed.
    assert.deepEqual(await nextWork(noMark), [])

    // Asked again and answered again, it is refined once more.
    write(12, { questions: ['[user] And the colour?'] })
    assert.deepEqual(await nextWork(noMark), [])
    write(12)
    assert.deepEqual(await nextWork(noMark), [clarify(12)])
  })

  it('passes over a card a refine was already started on by hand', async () => {
    await nextWork(noMark)
    write(12)
    withStore((store) => noteRefineTried(store, 12))

    assert.deepEqual(await nextWork(noMark), [])
  })

  it('passes over a blocked card, a scheduled one keeps its own slot, and a fresh edit waits', async () => {
    await nextWork(noMark)
    write(12)
    write(13, { blockedBy: [12] })
    write(14, {}, 30_000)
    write(15, { schedule: refine, blockedBy: [12] })

    assert.deepEqual(await nextWork(noMark), [clarify(12)])
    assert.deepEqual(await nextWork(noMark), [], 'the blocked, the scheduled and the just-edited all wait')
  })

  it('passes over a card in a live run, and one still being created', async () => {
    await nextWork(noMark)
    write(12)
    write(13)
    liveRun({ action: 'edit', cardId: 12, createdCardIds: [13] })

    assert.deepEqual(await nextWork(noMark), [])
    assert.deepEqual(readStore().refined, [], 'neither is listed, so each is refined once the run is over')
  })

  it('starts one a tick, in the board’s own order', async () => {
    await nextWork(noMark)
    write(12)
    write(13, { priority: 'high' })

    assert.deepEqual(await nextWork(noMark), [clarify(13)])
    assert.deepEqual(await nextWork(noMark), [clarify(12)])
    assert.deepEqual(await nextWork(noMark), [])
  })
})
