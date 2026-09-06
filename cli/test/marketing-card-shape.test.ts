// A marketing card's format (#435): a title, its channels and its draft, and nothing else.
//
// What is asked here: the four fields a topic does not carry are never written, never asked
// for and never accepted; a card with an empty body passes `validate` while a recurring job
// on the same board keeps every rule; and a board written into another folder keeps ITS
// fields rather than this process's.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { unpackBoard, type BoardPayload } from '../src/lib/board/transfer.ts'
import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot, TODO } from '../src/lib/paths.ts'
import { validateSpec } from '../src/lib/spec-contract.ts'
import type { Meta } from '../src/lib/types.ts'
import { move, refuses } from './helpers/board.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

/** Say what kind of board this is — `product` unless the line says otherwise. */
const solution = (name: string): void => {
  fs.writeFileSync(path.join(kanban(), 'config.md'), `- **Solution** — ${name}\n`)
}

const card = (rel: string): string => fs.readFileSync(path.join(TODO, rel), 'utf8')

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-topic-'))
  fs.mkdirSync(path.join(kanban(), 'todo', 'recurring'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '3\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Board\n\n## Tasks\n')
  fs.writeFileSync(path.join(kanban(), 'modules.md'), '- **shipped** — a release told as what you can now do.\n')
  solution('marketing')
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a marketing card', () => {
  it('is written with neither ranking, release nor questions, and with no body', async () => {
    const made = await move(root, ['create', '--title', 'Approve a screen', '--modules', 'shipped'])
    const text = card(String(made.file).split('todo/')[1]!)
    assert.equal(
      text,
      ['---', 'title: Approve a screen', 'status: todo', 'blocked_by: []', 'related: []', 'modules: [shipped]', '---', '', ''].join('\n'),
    )
  })

  it('keeps them off on every later move, not only on create', async () => {
    await move(root, ['create', '--title', 'Approve a screen', '--modules', 'shipped'])
    await move(root, ['update', '3', '--title', 'Approve a screen, not a paragraph'])
    const text = card('3-approve-a-screen.md')
    for (const field of ['priority:', 'roi:', 'release:', 'questions:']) assert.ok(!text.includes(field), field)
  })

  it('refuses the flags that would write one', async () => {
    await move(root, ['create', '--title', 'Approve a screen', '--modules', 'shipped'])
    await refuses(root, ['create', '--title', 'x', '--priority', 'high'], /--priority is not a `marketing` card's/)
    await refuses(root, ['update', '3', '--roi', 'high'], /--roi is not a `marketing` card's/)
    await refuses(root, ['update', '3', '--release', 'v1'], /--release is not a `marketing` card's/)
    await refuses(root, ['update', '3', '--status', 'ready'], /--status ready is not a `marketing` card's/)
    await refuses(root, ['update-questions', '3', '--clear'], /not a `marketing` move/)
    await refuses(root, ['schedule', '3', '--action', 'refine'], /is not a `marketing` flow/)
  })

  it('validates with an empty body, and still refuses an H1 and a repeated section', () => {
    const meta: Partial<Meta> = { title: 'Approve a screen', status: 'todo', modules: ['shipped'] }
    const good = path.join(TODO, '3-approve-a-screen.md')
    assert.deepEqual(validateSpec(good, `${serializeFrontmatter(meta)}\n`), [])
    const bad = validateSpec(good, `${serializeFrontmatter(meta)}\n\n# Approve a screen\n\n## Source\n\n## Source\n`)
    assert.deepEqual(bad.map((e) => e.rule), ['heading', 'duplicate-section'])
  })

  it('still holds a recurring job to its Process', () => {
    const meta: Partial<Meta> = { title: 'Prune the memory', status: 'todo' }
    const file = path.join(TODO, 'recurring', '1-prune-the-memory.md')
    assert.deepEqual(
      validateSpec(file, `${serializeFrontmatter(meta)}\n`).map((e) => e.rule),
      ['missing-section'],
    )
    assert.deepEqual(validateSpec(file, `${serializeFrontmatter(meta)}\n\n## Process\n1. prune\n`), [])
  })

  it('reads a missing priority and roi as empty rather than as a level', () => {
    const { meta } = parseFrontmatter(`${serializeFrontmatter({ title: 'Approve a screen', status: 'todo' })}\n`)
    assert.equal(meta!.priority, '')
    assert.equal(meta!.roi, '')
  })
})

describe('a board written into another folder', () => {
  it('takes its fields from the payload’s own config.md, not from this board', () => {
    const meta = { title: 'A card', priority: 'high', roi: 'high', status: 'todo', release: 'v1' }
    const payload = (line: string): BoardPayload =>
      ({
        cards: [{ id: 7, path: 'todo/7-a-card.md', meta, body: '\n' }],
        documents: [{ path: 'config.md', kind: 'config', body: line }],
        deliveries: [],
        nextCardId: 8,
      }) as unknown as BoardPayload

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-unpack-'))
    try {
      unpackBoard(payload('- **Solution** — product\n'), path.join(out, 'eng'))
      const eng = fs.readFileSync(path.join(out, 'eng', 'docs', 'kanban', 'todo', '7-a-card.md'), 'utf8')
      assert.match(eng, /^priority: high$/m)
      assert.match(eng, /^release: v1$/m)

      unpackBoard(payload('- **Solution** — marketing\n'), path.join(out, 'mktg'))
      const mktg = fs.readFileSync(path.join(out, 'mktg', 'docs', 'kanban', 'todo', '7-a-card.md'), 'utf8')
      assert.ok(!mktg.includes('priority:'))
      assert.ok(!mktg.includes('release:'))
    } finally {
      fs.rmSync(out, { recursive: true, force: true })
    }
  })
})
