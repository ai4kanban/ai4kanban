// The comments left on a topic's drafts, and the polish they are submitted to (#458).
//
// What is asked here is the whole of the promise: a comment is SAVED beside the board and
// never inside the draft, each draft keeps its own batch, edit and delete name one comment
// by its id, Submit refuses a batch there is nothing to answer, and the batch leaves with
// its card.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { clearComments } from '../src/lib/comments.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import {
  commentOnDraft,
  dropDraftComment,
  editDraftComment,
  polishDraft,
  readDrafts,
} from '../src/lib/view/drafts.ts'
import { move } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-comments-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')
const card = path.join(todo, '2-a-topic.md')
const drafts = path.join(kanban, 'content', '2-a-topic')
const batchFile = path.join(kanban, '.comments', '2.json')

const CARD = [
  '---',
  'title: A topic',
  'priority: med',
  'roi: med',
  'status: todo',
  'release: ""',
  'blocked_by: []',
  'related: []',
  'modules: []',
  'questions: []',
  '---',
  '',
  'One topic, read through and commented on.',
  '',
].join('\n')

function board(which = 'marketing'): void {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '3\n')
  fs.writeFileSync(path.join(kanban, 'config.md'), `# Project\n\n- **Name**: Test\n- **Solution** — ${which}\n`)
  fs.writeFileSync(path.join(todo, 'README.md'), '# The board\n\n## Tasks\n\n- #2 A topic — 2-a-topic.md\n')
  fs.writeFileSync(card, CARD)
  setBoardRoot(root)
}

const draft = (name: string, text = 'the piece.\n'): void => {
  fs.mkdirSync(drafts, { recursive: true })
  fs.writeFileSync(path.join(drafts, `${name}.md`), text)
}

const leave = (name: string, quote: string, words: string) =>
  commentOnDraft(2, name, { quote, from: 0, to: quote.length, words })

beforeEach(() => board())
after(() => fs.rmSync(root, { recursive: true, force: true }))

describe('leaving a comment on a draft', () => {
  it('saves it beside the board, keyed by draft, and never inside the draft', () => {
    draft('source', 'the piece.\n')
    const batch = leave('source', 'the piece', 'say it shorter')
    assert.equal(batch.length, 1)
    assert.equal(batch[0]!.quote, 'the piece')
    assert.equal(batch[0]!.words, 'say it shorter')
    assert.ok(batch[0]!.id)
    assert.equal(fs.readFileSync(path.join(drafts, 'source.md'), 'utf8'), 'the piece.\n')
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(batchFile, 'utf8'))), ['source'])
  })

  it('keeps each draft’s batch its own', () => {
    draft('source')
    draft('x')
    leave('source', 'the piece', 'say it shorter')
    leave('x', 'the piece', 'open on the number')
    assert.deepEqual(
      readDrafts(2).drafts.map((d) => [d.name, d.comments!.map((c) => c.words)]),
      [
        ['source', ['say it shorter']],
        ['x', ['open on the number']],
      ],
    )
    clearComments(2, 'source')
    assert.deepEqual(readDrafts(2).drafts.map((d) => d.comments!.length), [0, 1])
  })

  it('edits and deletes one comment by its id, and forgets the file with the last of them', () => {
    draft('source')
    const first = leave('source', 'the', 'cut this')
    const both = leave('source', 'piece', 'and this')
    assert.equal(both.length, 2)
    const changed = editDraftComment(2, 'source', first[0]!.id, '  keep this  ')
    assert.equal(changed.find((c) => c.id === first[0]!.id)!.words, 'keep this')
    assert.equal(changed.find((c) => c.id === first[0]!.id)!.quote, 'the')
    const left = dropDraftComment(2, 'source', first[0]!.id)
    assert.deepEqual(
      left.map((c) => c.words),
      ['and this'],
    )
    dropDraftComment(2, 'source', left[0]!.id)
    assert.ok(!fs.existsSync(batchFile))
  })

  it('refuses a draft nobody reads, an empty passage and empty words', () => {
    draft('source')
    assert.throws(() => leave('mastodon', 'the piece', 'shorter'), /no draft called "mastodon"/)
    assert.throws(() => leave('source', '', 'shorter'), /a comment is left on a passage/)
    assert.throws(() => leave('source', 'the piece', '   '), /a comment says what to do/)
    assert.throws(() => editDraftComment(2, 'source', 'x', ' '), /a comment says what to do/)
    assert.ok(!fs.existsSync(batchFile))
  })
})

describe('submitting the batch', () => {
  it('refuses a draft that is not written, and a draft nothing is waiting on', async () => {
    draft('source')
    assert.match((await polishDraft(2, 'x')).error!, /has no docs\/kanban\/content\/2-a-topic\/x\.md yet/)
    assert.match((await polishDraft(2, 'source')).error!, /no comments are waiting on/)
  })

  it('is the marketing solution’s alone', async () => {
    board('product')
    draft('source')
    leave('source', 'the piece', 'say it shorter')
    const res = await polishDraft(2, 'source')
    assert.equal(res.kind, 'wrong-solution')
    assert.match(res.error!, /a polish is the marketing solution's/)
  })

  it('hands the run the one file, the batch and its own flow', () => {
    const prompt = buildPrompt({ action: 'polish', id: 2, title: 'A topic', draft: 'x' })
    assert.match(prompt, /akb guide polish/)
    assert.match(prompt, /Read docs\/kanban\/content\/2-a-topic\/x\.md/)
    assert.match(prompt, /comments under `"x"` in docs\/kanban\/\.comments\/2\.json/)
    assert.match(prompt, /rewrite docs\/kanban\/content\/2-a-topic\/x\.md/)
  })

  it('names the writing memory the polish files its rules in', () => {
    const prompt = buildPrompt({ action: 'polish', id: 2, title: 'A topic', draft: 'x' })
    assert.match(prompt, /docs\/kanban\/memory\/writing\.md/)
    assert.match(prompt, /docs\/kanban\/memory\/writing\//)
  })
})

describe('the batch leaves with its card', () => {
  it('is dropped when the topic is archived', async () => {
    draft('source')
    leave('source', 'the piece', 'say it shorter')
    const out = await move(root, ['archive', '2'])
    assert.deepEqual(out.comments_removed, [2])
    assert.ok(!fs.existsSync(batchFile))
  })
})
