import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'
import { forgetMachineState, move, refuses } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-update-append-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '10\n')
  setBoardRoot(root)
  for (const id of [2, 3, 4, 5]) writeCard(id)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

function writeCard(id: number, meta: Partial<Meta> = {}): void {
  const full: Partial<Meta> = {
    title: `Card ${id}`,
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
    ...meta,
  }
  fs.writeFileSync(path.join(todo, `${id}-card-${id}.md`), `${serializeFrontmatter(full)}\n\nA card.\n\n## Todo\n\n- [ ] Build it.\n`)
}

function metaOf(id: number): Meta {
  const { meta } = parseFrontmatter(fs.readFileSync(path.join(todo, `${id}-card-${id}.md`), 'utf8'))
  assert.ok(meta)
  return meta
}

describe('raw update --add-blocked-by / --add-related', () => {
  it('appends new ids after the existing list, deduplicated', async () => {
    // #7 is closed: already on the list, it stays.
    writeCard(1, { blocked_by: [7, 3], related: [2] })

    await move(root, ['update', '1', '--add-blocked-by', '3,4,4', '--add-related', '5,2'])

    assert.deepEqual(metaOf(1).blocked_by, [7, 3, 4])
    assert.deepEqual(metaOf(1).related, [2, 5])
  })

  it('checks only the new ids', async () => {
    writeCard(1, { blocked_by: [3] })

    await refuses(root, ['update', '1', '--add-blocked-by', '7'], /--add-blocked-by points at #7, which is not an open card/)
    assert.deepEqual(metaOf(1).blocked_by, [3])
  })

  it('refuses replacing and appending the same field at once, writing nothing', async () => {
    writeCard(1, { blocked_by: [3], related: [2] })
    const before = fs.readFileSync(path.join(todo, '1-card-1.md'), 'utf8')

    await refuses(root, ['update', '1', '--title', 'New', '--blocked-by', '4', '--add-blocked-by', '5'], /pass one/)
    await refuses(root, ['update', '1', '--related', '4', '--add-related', '5'], /pass one/)
    assert.equal(fs.readFileSync(path.join(todo, '1-card-1.md'), 'utf8'), before)
  })
})
