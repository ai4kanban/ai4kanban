// What a folder under `todo/` is. The board used to answer this three ways — by the id in
// the name, by a `root.md` inside it, and by a reserved list — so the columns a screen drew
// and the tracks `--track` took could disagree. One rule now (lib/cards.ts), and this pins
// the case they disagreed on.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { trackNames } from '../src/lib/cards.ts'
import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'
import { readBoard } from '../src/lib/view/read.ts'
import { validTrack } from '../src/lib/validate.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-tracks-'))
const todo = path.join(root, 'docs', 'kanban', 'todo')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(todo, 'features'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '20\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

function card(id: number, title: string): string {
  const meta: Partial<Meta> = {
    title,
    track: 'features',
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
    schedule: null,
  }
  return `${serializeFrontmatter(meta)}\n\nA card.\n\n## Todo\n\n- [ ] Build it.\n`
}

const columns = (): string[] => readBoard().columns.map((c) => c.track)

describe('a folder named like a group task', () => {
  it('is not a track, even before its root.md is written', () => {
    fs.mkdirSync(path.join(todo, '10-a-group'), { recursive: true })

    assert.deepEqual(trackNames(), ['features'])
    assert.deepEqual(columns(), ['features'])
    assert.throws(() => validTrack('10-a-group'), /unknown track/)
  })

  it('is not a track once it is written either, and its root is one card', () => {
    fs.mkdirSync(path.join(todo, '10-a-group'), { recursive: true })
    fs.writeFileSync(path.join(todo, '10-a-group', 'root.md'), card(10, 'The group'))

    assert.deepEqual(trackNames(), ['features'])
    assert.deepEqual(columns(), ['features'])
    const cards = readBoard().columns.flatMap((c) => c.cards)
    assert.deepEqual(
      cards.map((c) => [c.id, c.isGroup]),
      [[10, true]],
    )
  })

  it('leaves the cards in the real tracks alone', () => {
    fs.mkdirSync(path.join(todo, '10-a-group', 'features'), { recursive: true })
    fs.writeFileSync(path.join(todo, 'features', '12-plain.md'), card(12, 'A plain card'))

    assert.deepEqual(
      readBoard()
        .columns.flatMap((c) => c.cards)
        .map((c) => c.id),
      [12],
    )
  })
})

describe('a track added by hand', () => {
  it('is a track the moment its folder is, with no file to edit', () => {
    fs.mkdirSync(path.join(todo, 'chores'), { recursive: true })

    assert.deepEqual(trackNames(), ['chores', 'features'])
    validTrack('chores')
  })
})
