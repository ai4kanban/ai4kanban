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
import { findGuide } from '../src/lib/guide.ts'
import { printFlow } from '../src/lib/agent/flow.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { discardTopic, newTopic, readDrafts, saveDraft } from '../src/lib/view/drafts.ts'
import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setLanguage } from '../src/lib/machine/settings.ts'
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
  it('keeps product planning guides out of the repurposing pipeline', () => {
    for (const name of ['add-task', 'extract-ideas', 'evaluate-task', 'writing', 'setup']) {
      assert.equal(findGuide(name), null, name)
    }
    for (const name of ['board', 'polish', 'marketing-polish-loop', 'repurpose', 'prune-memory']) {
      assert.ok(findGuide(name), name)
    }
    assert.equal(findGuide('channel'), null)
    assert.doesNotMatch(buildPrompt({ action: 'create', description: 'A topic' }), /guide add-task|open questions/)
    solution('product')
    for (const name of ['add-task', 'extract-ideas', 'evaluate-task', 'writing', 'setup']) {
      assert.ok(findGuide(name), name)
    }
  })

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
    const text = card('3.md')
    for (const field of ['priority:', 'roi:', 'release:', 'questions:']) assert.ok(!text.includes(field), field)
  })

  it('is named off its id alone, and its draft folder with it', async () => {
    const made = await move(root, ['create', '--title', 'Approve a screen', '--modules', 'shipped'])
    assert.equal(made.file, 'docs/kanban/todo/3.md')
    assert.equal(readDrafts(3).dir, 'docs/kanban/content/3')
    // The title is frontmatter alone: writing one moves neither the card nor its drafts.
    await move(root, ['update', '3', '--title', 'Approve a screen, not a paragraph'])
    assert.ok(fs.existsSync(path.join(TODO, '3.md')))
    assert.equal(readDrafts(3).dir, 'docs/kanban/content/3')
  })

  it('refuses --slug, so no command can part a topic from its drafts', async () => {
    await refuses(root, ['create', '--title', 'x', '--slug', 'approve'], /--slug is not a `marketing` card's/)
    await move(root, ['create', '--title', 'Approve a screen'])
    await refuses(root, ['update', '3', '--slug', 'approve'], /--slug is not a `marketing` card's/)
    assert.ok(fs.existsSync(path.join(TODO, '3.md')))
  })

  // A non-English board is told to pass `--slug` so a title that slugifies to nothing does
  // not name every card `<id>-task.md` (#337). Here the flag is refused, so being told to
  // pass it is being told to make a call the board turns down.
  it('tells no run to pass --slug, whatever language the board is read in', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-topic-home-'))
    process.env.AI4KANBAN_HOME = home
    try {
      setLanguage('zh')
      await move(root, ['create', '--title', '一个选题'])
      const sink = startCollecting()
      try {
        printFlow({ action: 'create' })
      } finally {
        stopCollecting()
      }
      // `marketing/add-task` is printed under the ask and says the flag is refused, so this
      // asks about the words the run is given: the close line, and the language note in it.
      const ask = sink.out.join('\n').split('the flows this is done by')[0]!
      assert.match(ask, /create --title "\.\." —/)
      assert.doesNotMatch(ask, /--slug/)
      assert.doesNotMatch(buildPrompt({ action: 'implement', id: 3, title: '一个选题' }), /--slug/)
    } finally {
      delete process.env.AI4KANBAN_HOME
      fs.rmSync(home, { recursive: true, force: true })
    }
  })

  it('keeps a slugged topic written before the id-only name exactly where it is', async () => {
    fs.writeFileSync(
      path.join(TODO, '2-a-piece.md'),
      `${serializeFrontmatter({ title: 'A piece', status: 'todo' } as Partial<Meta>)}\n`,
    )
    assert.equal(readDrafts(2).dir, 'docs/kanban/content/2-a-piece')
    await move(root, ['update', '2', '--title', 'A piece, renamed'])
    assert.ok(fs.existsSync(path.join(TODO, '2-a-piece.md')))
  })

  it('opens a blank topic and takes one back off, with no agent either way', async () => {
    const made = await newTopic()
    assert.equal(made.ok, true)
    assert.equal(card(`${made.id}.md`).includes('title: Untitled'), true)
    saveDraft(made.id!, 'source', 'a rough note')
    const gone = await discardTopic(made.id!)
    assert.equal(gone.ok, true)
    assert.ok(!fs.existsSync(path.join(TODO, `${made.id}.md`)))
    // The drafts outlive the topic, exactly as they outlive an archive.
    assert.ok(fs.existsSync(path.join(kanban(), 'content', String(made.id), 'source.md')))
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
