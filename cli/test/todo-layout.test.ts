// What a folder under `todo/` is. `todo/` is flat, so the only folders in it are a group
// task's and the reserved `recurring/` — one rule (lib/cards.ts), and this pins the cases
// that used to disagree.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'
import { readBoard } from '../src/lib/view/read.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-todo-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '20\n')
  fs.writeFileSync(path.join(kanban, 'modules.md'), '# Modules\n\n- **skill** — the board.\n- **site** — the site.\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

function card(id: number, title: string, modules: string[] = []): string {
  const meta: Partial<Meta> = {
    title,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules,
    questions: [],
    schedule: null,
  }
  return `${serializeFrontmatter(meta)}\n\nA card.\n\n## Todo\n\n- [ ] Build it.\n`
}

const ids = (): number[] =>
  readBoard()
    .columns.flatMap((c) => c.cards)
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

    const cards = readBoard().columns.flatMap((c) => c.cards)
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

describe('the bands', () => {
  it('follow the module map, and gather the untagged at the end', () => {
    fs.writeFileSync(path.join(todo, '11-site.md'), card(11, 'Site work', ['site']))
    fs.writeFileSync(path.join(todo, '12-skill.md'), card(12, 'Skill work', ['skill']))
    fs.writeFileSync(path.join(todo, '13-loose.md'), card(13, 'No module'))

    assert.deepEqual(
      readBoard().columns.map((c) => [c.title, c.cards.map((x) => x.id)]),
      [
        ['skill', [12]],
        ['site', [11]],
        ['Untagged', [13]],
      ],
    )
  })

  it('bands a card under the first of its modules', () => {
    fs.writeFileSync(path.join(todo, '11-both.md'), card(11, 'Both', ['site', 'skill']))

    assert.deepEqual(
      readBoard().columns.map((c) => c.title),
      ['site'],
    )
  })
})
