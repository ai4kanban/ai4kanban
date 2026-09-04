// What the board starts on its own. A group's subtasks never show in the columns, so the
// dispatcher reads every card instead — otherwise a scheduled subtask stays queued for good.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'
import { nextWork } from '../src/lib/view/dispatch.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-dispatch-'))
const kanban = path.join(root, 'docs', 'kanban')
const track = path.join(kanban, 'todo', 'features')
const groupTrack = path.join(kanban, 'todo', '10-a-group', 'features')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(groupTrack, { recursive: true })
  fs.mkdirSync(track, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '20\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

function body(id: number, opts: { schedule?: Meta['schedule']; subtasks?: number[] } = {}): string {
  const meta: Partial<Meta> = {
    title: `Card ${id}`,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
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
