// What a rejection hands over (#601, #1497): nothing. The card goes and its links are
// dropped; the reason is learned later by the rejection review, and a sentence still naming
// the card is fixed when its own card is next refined. An archive still hands both over.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdRemove } from '../src/commands/remove.ts'
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

function mentionedBy81(): void {
  card(81)
  const file = path.join(todo(), '81-an-idea.md')
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('One idea.', 'Follows on from #80.').replace('related: []', 'related: [80]'))
}

describe('raw reject', () => {
  for (const discard of [true, false]) {
    it(`asks for no note and hands over no sentence${discard ? ' on a discard' : ''}`, () => {
      card(80)
      mentionedBy81()
      const res = remove(80, discard)
      assert.match(res.receipt, discard ? /discarded #80/ : /rejected #80/)
      assert.equal(res.note, null)
      assert.deepEqual(res.mentions, [])
      assert.doesNotMatch(res.receipt, /rejected\.md|next — /)
      assert.doesNotMatch(fs.readFileSync(path.join(todo(), '81-an-idea.md'), 'utf8'), /related: \[80\]/)
    })
  }

  it('leaves an archive handing over its note and sentences', () => {
    card(80)
    mentionedBy81()
    const box = startCollecting()
    let res: MoveResult
    try {
      res = cmdRemove(80, 'completed')
    } finally {
      stopCollecting()
    }
    assert.deepEqual((res.note as { files: string[] }).files, [path.join('docs', 'kanban', 'memory', 'readme.md')])
    assert.deepEqual((res.mentions as { file: string }[]).map((m) => m.file), [path.join('docs', 'kanban', 'todo', '81-an-idea.md')])
    assert.match(box.out.join('\n'), /next — /)
  })
})
