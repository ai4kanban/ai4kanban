// The comments left on a topic's drafts, and the polish they are submitted to (#458, #572).
//
// What is asked here is the whole of the promise: a comment is SAVED beside the board and
// never inside the draft, each draft keeps its own markdown file, an entry is a quoted
// passage and the change asked for under it, edit and delete name one comment by its id,
// Submit refuses a batch there is nothing to answer, and the batch leaves with its card.
//
// And the reason the file is markdown: somebody opens it and edits it. A hand-written entry
// is read, a half-written one is left exactly where it is, and neither is lost to a save.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { clearComments, readComments } from '../src/lib/comments.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { anchorOf, passageOf } from '../src/lib/view/anchor.ts'
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
const batchDir = path.join(kanban, '.comments', '2')
const batchFile = path.join(batchDir, 'source.md')

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

const textOf = (name: string): string => fs.readFileSync(path.join(drafts, `${name}.md`), 'utf8')

/** Leave a comment the way the editor does: on one copy of the passage, carrying whatever
 *  of the draft tells it from the others. */
const leaveAt = (name: string, quote: string, words: string, text: string, from: number) =>
  commentOnDraft(2, name, { ...passageOf(text, from, from + quote.length), words })

/** The same, on the first copy of the passage in the draft as it stands. */
function leave(name: string, quote: string, words: string) {
  const file = path.join(drafts, `${name}.md`)
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : quote
  return leaveAt(name, quote, words, text, Math.max(text.indexOf(quote), 0))
}

const batchText = (): string => fs.readFileSync(batchFile, 'utf8')

const handWrite = (name: string, body: string): void => {
  fs.mkdirSync(batchDir, { recursive: true })
  fs.writeFileSync(path.join(batchDir, `${name}.md`), body)
}

beforeEach(() => board())
after(() => fs.rmSync(root, { recursive: true, force: true }))

describe('leaving a comment on a draft', () => {
  it('saves it beside the board as readable markdown, and never inside the draft', () => {
    draft('source', 'the piece.\n')
    const batch = leave('source', 'the piece', 'say it shorter')
    assert.equal(batch.length, 1)
    assert.equal(batch[0]!.quote, 'the piece')
    assert.equal(batch[0]!.words, 'say it shorter')
    assert.ok(batch[0]!.id)
    assert.equal(textOf('source'), 'the piece.\n')
    const file = batchText()
    assert.match(file, /^# Comments on the `source` draft$/m)
    assert.match(file, /^> \[\[the piece\]\]\.$/m)
    assert.match(file, /^say it shorter$/m)
  })

  it('keeps each draft’s batch in its own file', () => {
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
    assert.ok(!fs.existsSync(batchFile))
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
    assert.ok(!fs.existsSync(batchDir))
  })

  it('names two comments that read the same apart, so one edit is one comment', () => {
    draft('source')
    leave('source', 'the piece', 'say it shorter')
    const both = leave('source', 'the piece', 'say it shorter')
    dropDraftComment(2, 'source', both[0]!.id)
    const again = leave('source', 'the piece', 'say it shorter')
    assert.equal(new Set(again.map((c) => c.id)).size, 2)
    assert.deepEqual(
      editDraftComment(2, 'source', again[0]!.id, 'say it much shorter').map((c) => c.words),
      ['say it much shorter', 'say it shorter'],
    )
    assert.equal(dropDraftComment(2, 'source', again[0]!.id).length, 1)
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

describe('the file is the format, so a person can write it', () => {
  it('reads entries nobody left through the board, and keeps them through a save', () => {
    draft('source', 'the piece opens well.\n\nthe piece closes badly.\n')
    handWrite(
      'source',
      ['> the piece opens well.', '', 'say it shorter', '', '> closes badly', '', 'end on the number', ''].join('\n'),
    )
    const read = readComments(2, 'source')
    assert.deepEqual(
      read.map((c) => [c.quote, c.words]),
      [
        ['the piece opens well.', 'say it shorter'],
        ['closes badly', 'end on the number'],
      ],
    )
    assert.equal(new Set(read.map((c) => c.id)).size, 2)
    // Read twice with nothing written between: a hand-written entry keeps one id, so the row
    // the page draws for it does not change out from under a click.
    assert.deepEqual(readComments(2, 'source').map((c) => c.id), read.map((c) => c.id))

    const edited = editDraftComment(2, 'source', read[0]!.id, 'say it much shorter')
    assert.deepEqual(
      edited.map((c) => c.words),
      ['say it much shorter', 'end on the number'],
    )
    assert.match(batchText(), /^<!-- [0-9a-f]+ -->$/m)
    assert.deepEqual(
      dropDraftComment(2, 'source', edited[1]!.id).map((c) => c.words),
      ['say it much shorter'],
    )
  })

  it('leaves an entry it cannot read exactly where it is, and out of the batch', () => {
    draft('source', 'the piece opens well.\n')
    handWrite(
      'source',
      [
        'A note to myself, with nothing quoted.',
        '',
        '> the piece',
        '',
        'say it shorter',
        '',
        '> a passage nobody finished',
        '',
      ].join('\n'),
    )
    assert.deepEqual(
      readComments(2, 'source').map((c) => c.words),
      ['say it shorter'],
    )
    leave('source', 'opens well', 'open on the number')
    const file = batchText()
    assert.match(file, /^A note to myself, with nothing quoted\.$/m)
    assert.match(file, /^> a passage nobody finished$/m)
    // And the polish that answers the batch does not take them with it.
    clearComments(2, 'source')
    const left = fs.readFileSync(batchFile, 'utf8')
    assert.match(left, /^A note to myself, with nothing quoted\.$/m)
    assert.match(left, /^> a passage nobody finished$/m)
    assert.doesNotMatch(left, /say it shorter/)
  })
})

describe('finding a passage again', () => {
  it('tells two copies of the same words apart by what is around them', () => {
    const text = 'the piece opens well.\n\nthe piece closes badly.\n'
    draft('source', text)
    const first = leave('source', 'the piece', 'say it shorter')
    const both = leaveAt('source', 'the piece', 'end on the number', text, text.lastIndexOf('the piece'))
    assert.equal(both.length, 2)
    assert.deepEqual(anchorOf(text, both[0]!), { from: 0, to: 9 })
    assert.deepEqual(anchorOf(text, both[1]!), { from: 23, to: 32 })
    assert.notEqual(both[0]!.context, both[1]!.context)
    assert.equal(first[0]!.context, 'the piece opens well.')
  })

  it('keeps a comment whose passage the draft no longer holds, with nothing to mark', () => {
    draft('source', 'the piece opens well.\n')
    leave('source', 'the piece', 'say it shorter')
    const rewritten = 'a different sentence entirely.\n'
    draft('source', rewritten)
    const batch = readComments(2, 'source')
    assert.equal(batch.length, 1)
    assert.equal(anchorOf(rewritten, batch[0]!), null)
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
    assert.match(prompt, /the comments in docs\/kanban\/\.comments\/2\/x\.md/)
    assert.match(prompt, /rewrite docs\/kanban\/content\/2-a-topic\/x\.md/)
  })

  it('carries the note left on the whole batch, and says nothing without one', () => {
    const req = { action: 'polish', id: 2, title: 'A topic', draft: 'x' } as const
    assert.doesNotMatch(buildPrompt(req), /Extra notes on this batch/)
    assert.match(buildPrompt({ ...req, notes: 'keep it under 200 words' }), /Extra notes on this batch: keep it under 200 words/)
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
    assert.ok(!fs.existsSync(batchDir))
  })
})
