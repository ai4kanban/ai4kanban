// Dropping a card without writing any memory (#601).
//
// A discard is a reject that records nothing: the card goes, the sentences pointing at it
// are still handed over, and no `rejected.md` is named — so nothing downstream can read the
// clear-out as a lasting no. These fix that difference on both sides of it: the receipt
// `raw reject --discard` prints, and the flow a printed `card reject --discard` hands over.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdRemove } from '../src/commands/remove.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { MoveResult } from '../src/lib/types.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-discard-'))
const kanban = () => path.join(root, 'docs', 'kanban')
const todo = () => path.join(kanban(), 'todo')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(todo(), { recursive: true })
  fs.mkdirSync(path.join(kanban(), 'memory'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'memory', 'rejected.md'), '# Rejected\n\n## ui\n\n- **something** — no.\n')
  fs.writeFileSync(path.join(kanban(), 'next-id'), '90\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

function card(id: number, body = 'One idea.'): void {
  fs.writeFileSync(
    path.join(todo(), `${id}-an-idea.md`),
    [
      '---',
      `title: Card ${id}`,
      'priority: low',
      'roi: low',
      'status: todo',
      'release: ""',
      'blocked_by: []',
      'related: []',
      'modules: []',
      'questions: []',
      '---',
      '',
      body,
      '',
    ].join('\n'),
  )
}

/** Both halves of a removal's answer: its fields, and the receipt it printed. */
function remove(id: number, discard: boolean): MoveResult & { receipt: string } {
  const box = startCollecting()
  try {
    return { ...cmdRemove(id, 'rejected', discard ? { discard: true } : {}), receipt: box.out.join('\n') }
  } finally {
    stopCollecting()
  }
}

function printed(discard: boolean): string {
  const box = startCollecting()
  try {
    printFlow({ action: 'reject', id: 80, title: 'Card 80', reason: 'nobody wants it', ...(discard ? { discard: true } : {}) })
    return box.out.join('\n')
  } finally {
    stopCollecting()
  }
}

describe('raw reject --discard', () => {
  it('asks for no note and names no memory file', () => {
    card(80)
    const res = remove(80, true)
    assert.equal(res.note, null)
    assert.match(res.receipt, /discarded #80/)
    assert.match(res.receipt, /no memory is written/)
    assert.doesNotMatch(res.receipt, /rejected\.md/)
  })

  it('still hands over the sentences that pointed at the card', () => {
    card(80)
    card(81)
    fs.writeFileSync(
      path.join(todo(), '81-an-idea.md'),
      fs.readFileSync(path.join(todo(), '81-an-idea.md'), 'utf8').replace('One idea.', 'Follows on from #80.'),
    )
    const res = remove(80, true)
    const files = (res.mentions as { file: string }[]).map((m) => m.file)
    assert.deepEqual(files, [path.join('docs', 'kanban', 'todo', '81-an-idea.md')])
  })

  it('leaves a plain reject asking for its note', () => {
    card(80)
    const res = remove(80, false)
    assert.match(res.receipt, /rejected #80/)
    assert.match(res.receipt, /rejected\.md/)
    assert.deepEqual((res.note as { files: string[] }).files, [path.join('docs', 'kanban', 'memory', 'rejected.md')])
  })
})

describe('the printed reject flow', () => {
  it('closes a discard on --discard and hands it no memory file', () => {
    card(80)
    const out = printed(true)
    assert.match(out, /raw reject 80 --discard/)
    assert.doesNotMatch(out, /write the rejection note/)
    // The guide itself is printed under the flow and names `rejected.md` in its own text, so
    // what has to be gone is the board fact — the file this run would write into.
    assert.doesNotMatch(out, /^\s+memory\s/m)
  })

  it('keeps the note step and the memory file on a plain reject', () => {
    card(80)
    const out = printed(false)
    assert.match(out, /write the rejection note/)
    assert.match(out, /^\s+memory\s+docs\/kanban\/memory\/rejected\.md$/m)
  })
})
