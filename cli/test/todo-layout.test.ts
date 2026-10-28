// What a folder under `todo/` is. `todo/` is flat, so the only folder in it is a group
// task's — one rule (lib/cards.ts), and this pins the cases that used to disagree.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'
import { allCards } from '../src/lib/view/read.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-todo-'))
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

function card(id: number, title: string, modules: string[] = []): string {
  const meta: Partial<Meta> = {
    title,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    blocked_by: [],
    related: [],
    modules,
    questions: [],
    schedule: null,
  }
  return `${serializeFrontmatter(meta)}\n\nA card.\n\n## Todo\n\n- [ ] Build it.\n`
}

const ids = (): number[] =>
  allCards()
    .map((c) => c.id)
    .sort((a, b) => a - b)

describe('a flat todo/', () => {
  it('reads a card written straight into it', () => {
    fs.writeFileSync(path.join(todo, '12-plain.md'), card(12, 'A plain card', ['skill']))

    assert.deepEqual(ids(), [12])
  })
})

describe('a folder named like a group task', () => {
  it('draws nothing before its root.md is written', () => {
    fs.mkdirSync(path.join(todo, '10-a-group'), { recursive: true })

    assert.deepEqual(ids(), [])
  })

  it('is one card once it is written, not a folder of them', () => {
    fs.mkdirSync(path.join(todo, '10-a-group'), { recursive: true })
    fs.writeFileSync(path.join(todo, '10-a-group', 'root.md'), card(10, 'The group', ['skill']))

    const cards = allCards()
    assert.deepEqual(
      cards.map((c) => [c.id, c.isGroup]),
      [[10, true]],
    )
  })

  it('leaves the cards beside it alone', () => {
    fs.mkdirSync(path.join(todo, '10-a-group'), { recursive: true })
    fs.writeFileSync(path.join(todo, '12-plain.md'), card(12, 'A plain card', ['skill']))

    assert.deepEqual(ids(), [12])
  })
})
