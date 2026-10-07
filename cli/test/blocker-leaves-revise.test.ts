// A card waiting on another is queued to be revised when that card leaves the board (#1578).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { withStore } from '../src/lib/agent/store.ts'
import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'
import { forgetMachineState, move, refuses } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-blocker-revise-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '20\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

function writeCard(id: number, opts: { blockedBy?: number[]; schedule?: Meta['schedule'] } = {}): void {
  const meta: Partial<Meta> = {
    title: `Card ${id}`,
    priority: 'med',
    roi: 'med',
    status: 'ready',
    release: '',
    blocked_by: opts.blockedBy ?? [],
    related: [],
    modules: [],
    questions: [],
    schedule: opts.schedule ?? null,
  }
  fs.writeFileSync(path.join(todo, `${id}-card-${id}.md`), `${serializeFrontmatter(meta)}\n\nA card.\n\n## Todo\n\n- [ ] Build it.\n`)
}

function scheduleOf(id: number): Meta['schedule'] {
  const { meta } = parseFrontmatter(fs.readFileSync(path.join(todo, `${id}-card-${id}.md`), 'utf8'))
  return meta!.schedule
}

describe('a blocker leaving the board', () => {
  it('queues a revise against what an archived blocker shipped', async () => {
    writeCard(1)
    writeCard(2, { blockedBy: [1] })

    const res = await move(root, ['archive', '1'])

    assert.deepEqual(res.revisions, [{ id: 2, action: 'revise' }])
    const s = scheduleOf(2)!
    assert.equal(s.action, 'revise')
    assert.match(s.notes, /^#1 "Card 1" was archived \(docs\/kanban\/\.archive\/.*1-card-1\.md\)\. Check this card/)
  })

  it('asks to drop what a rejected blocker was relied on for', async () => {
    writeCard(1)
    writeCard(2, { blockedBy: [1] })

    await move(root, ['reject', '1', '--reason', 'not needed'])

    assert.match(scheduleOf(2)!.notes, /^#1 "Card 1" was rejected .*ask the user an open question instead\.$/)
  })

  it('collects one note per blocker as each leaves', async () => {
    writeCard(1)
    writeCard(3)
    writeCard(2, { blockedBy: [1, 3] })

    await move(root, ['archive', '1'])
    await move(root, ['reject', '3', '--reason', 'dropped'])

    const s = scheduleOf(2)!
    assert.equal(s.action, 'revise')
    const lines = s.notes.split('\n')
    assert.equal(lines.length, 2)
    assert.match(lines[0]!, /^#1 .* was archived/)
    assert.match(lines[1]!, /^#3 .* was rejected/)
  })

  it('keeps a queued implement and appends the note to it', async () => {
    writeCard(1)
    writeCard(2, { blockedBy: [1], schedule: { action: 'implement', notes: 'Use the new API.' } })

    const res = await move(root, ['archive', '1'])

    assert.deepEqual(res.revisions, [{ id: 2, action: 'implement' }])
    const s = scheduleOf(2)!
    assert.equal(s.action, 'implement')
    assert.match(s.notes, /^Use the new API\.\n#1 "Card 1" was archived/)
  })

  it('leaves a card a delivery is building alone', async () => {
    writeCard(1)
    writeCard(2, { blockedBy: [1] })
    withStore((store) => {
      store.deliveries.push({
        deliveryId: 'held1234',
        cardId: 2,
        title: 'Card 2',
        status: 'active',
        startedAt: Date.now(),
        sessions: [],
        approved: '',
        steps: [],
      } as never)
    })

    const res = await move(root, ['archive', '1'])

    assert.deepEqual(res.revisions, [])
    assert.equal(scheduleOf(2), null)
  })

  it('does not touch a card that only named it as related', async () => {
    writeCard(1)
    writeCard(2)
    fs.writeFileSync(
      path.join(todo, '2-card-2.md'),
      fs.readFileSync(path.join(todo, '2-card-2.md'), 'utf8').replace('related: []', 'related: [1]'),
    )

    await move(root, ['archive', '1'])

    assert.equal(scheduleOf(2), null)
  })
})

describe('a revise schedule', () => {
  it('needs notes saying what to revise', async () => {
    writeCard(1)
    await refuses(root, ['schedule', '1', '--action', 'revise'], /needs notes/)
    await move(root, ['schedule', '1', '--action', 'revise', '--notes', 'Drop the old API.'])
    assert.deepEqual(scheduleOf(1), { action: 'revise', notes: 'Drop the old API.' })
  })
})
