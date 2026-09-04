// The channels a topic goes to (#409): the field on the card, the two moves that write it,
// and the run that fills one channel's draft.
//
// What is asked here is the whole of the promise: the order the user picked is what the file
// keeps, a reorder cannot lose where a piece was published, only the four names are accepted,
// the field is the marketing solution's alone, a repurpose refuses rather than overwrite a
// draft the user may have edited, and the `draft` status is stamped by the board once the
// file is on disk — never claimed by the run that wrote it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import { RUN_ENV } from '../src/lib/agent/env.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { markChannelDrafted } from '../src/lib/agent/sessions.ts'
import { parseFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { move, refuses, run } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-channels-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')
const card = path.join(todo, '2-a-topic.md')
const drafts = path.join(kanban, 'content', '2-a-topic')

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
  'One topic, going out to more than one channel.',
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

/** The card's channels as anything reading the board sees them. */
const channels = (): { name: string; status: string; url: string }[] =>
  parseFrontmatter(fs.readFileSync(card, 'utf8')).meta!.channels

/** The `channels:` block as it is written down, so the two shapes can be told apart. */
const block = (): string[] => {
  const lines = fs.readFileSync(card, 'utf8').split('\n')
  const at = lines.indexOf('channels:')
  if (at === -1) return []
  const out: string[] = []
  for (let i = at + 1; i < lines.length && /^\s/.test(lines[i]!); i++) out.push(lines[i]!)
  return out
}

const draft = (name: string, text = 'the piece.\n'): void => {
  fs.mkdirSync(drafts, { recursive: true })
  fs.writeFileSync(path.join(drafts, `${name}.md`), text)
}

const refusesRun = (argv: string[], pattern: RegExp): Promise<void> =>
  assert.rejects(() => run(root, argv), pattern)

beforeEach(() => {
  delete process.env[RUN_ENV]
  board()
})

afterEach(() => delete process.env[RUN_ENV])
after(() => fs.rmSync(root, { recursive: true, force: true }))

describe('the channels a topic goes to', () => {
  it('keeps the order the user picked, lead first, and writes a bare name for a channel with no draft', async () => {
    await move(root, ['update', '2', '--channels', 'xiaohongshu,x'])
    assert.deepEqual(
      channels().map((c) => c.name),
      ['xiaohongshu', 'x'],
    )
    assert.deepEqual(block(), ['  - xiaohongshu', '  - x'])
  })

  it('keeps a channel’s status and URL through a reorder', async () => {
    await move(root, ['update', '2', '--channels', 'x,xiaohongshu'])
    await move(root, ['channel-status', '2', 'x', 'published', '--url', 'https://x.com/p/1'])
    await move(root, ['update', '2', '--channels', 'xiaohongshu,x'])
    assert.deepEqual(channels(), [
      { name: 'xiaohongshu', status: '', url: '' },
      { name: 'x', status: 'published', url: 'https://x.com/p/1' },
    ])
  })

  it('keeps a repeated name once, and clears the field entirely', async () => {
    await move(root, ['update', '2', '--channels', 'x,x,reddit'])
    assert.deepEqual(
      channels().map((c) => c.name),
      ['x', 'reddit'],
    )
    await move(root, ['update', '2', '--channels', ''])
    assert.deepEqual(channels(), [])
    assert.ok(!fs.readFileSync(card, 'utf8').includes('channels:'))
  })

  it('refuses a name outside the four', async () => {
    await refuses(root, ['update', '2', '--channels', 'x,tiktok'], /unknown channel\(s\): tiktok/)
    assert.deepEqual(channels(), [])
  })

  it('is the marketing solution’s alone', async () => {
    board('product')
    await refuses(root, ['update', '2', '--channels', 'x'], /--channels is the marketing solution's/)
  })
})

describe('moving one channel along', () => {
  beforeEach(async () => {
    await move(root, ['update', '2', '--channels', 'x,xiaohongshu'])
  })

  it('sets the status and the URL, and says what it moved from', async () => {
    const out = await move(root, ['channel-status', '2', 'x', 'ready'])
    assert.equal(out.was, '(no draft yet)')
    assert.equal(out.status, 'ready')
    assert.deepEqual(block(), ['  - name: x', '    status: ready', '  - xiaohongshu'])
    await move(root, ['channel-status', '2', 'x', 'published', '--url', 'https://x.com/p/1'])
    assert.deepEqual(channels()[0], { name: 'x', status: 'published', url: 'https://x.com/p/1' })
  })

  it('never adds a channel the card has not chosen', async () => {
    await refuses(root, ['channel-status', '2', 'reddit', 'draft'], /#2 does not go to reddit/)
    assert.deepEqual(
      channels().map((c) => c.name),
      ['x', 'xiaohongshu'],
    )
  })

  it('takes only the four names and the four statuses', async () => {
    await refuses(root, ['channel-status', '2', 'mastodon', 'draft'], /must be x \| linkedin \| reddit \| xiaohongshu/)
    await refuses(root, ['channel-status', '2', 'x', 'posted'], /must be draft \| ready \| scheduled \| published/)
  })
})

describe('the run that repurposes one draft', () => {
  it('refuses a channel this card has not chosen', async () => {
    await refusesRun(['channel', 'x', '2'], /#2 does not go to x/)
  })

  it('refuses a topic whose source.md is not written yet', async () => {
    await move(root, ['update', '2', '--channels', 'x'])
    await refusesRun(['channel', 'x', '2'], /has no docs\/kanban\/content\/2-a-topic\/source\.md yet/)
  })

  it('refuses to replace a draft the user may have edited, and names --again', async () => {
    await move(root, ['update', '2', '--channels', 'x'])
    draft('source')
    draft('x')
    await refusesRun(['channel', 'x', '2'], /is already written.*Add `--again`/s)
  })

  it('refuses a name outside the four, a --print, a product board and being typed inside a run', async () => {
    await move(root, ['update', '2', '--channels', 'x'])
    draft('source')
    await refusesRun(['channel', 'mastodon', '2'], /no channel called "mastodon"/)
    await refusesRun(['channel', 'x', '2', '--print'], /a repurpose has no --print/)
    process.env[RUN_ENV] = 'a-run'
    await refusesRun(['channel', 'x', '2'], /a run does not repurpose a draft/)
    delete process.env[RUN_ENV]
    board('product')
    await refusesRun(['channel', 'x', '2'], /is the marketing solution's/)
  })

  it('hands the run both file paths, the channel’s language and its own flow', () => {
    const prompt = buildPrompt({ action: 'channel', id: 2, title: 'A topic', channel: 'xiaohongshu' })
    assert.match(prompt, /akb guide channel/)
    assert.match(prompt, /Read docs\/kanban\/content\/2-a-topic\/source\.md/)
    assert.match(prompt, /write docs\/kanban\/content\/2-a-topic\/xiaohongshu\.md, in Chinese/)
    assert.match(buildPrompt({ action: 'channel', id: 2, channel: 'x' }), /x\.md, in English/)
  })
})

describe('the board stamps the draft, not the run', () => {
  beforeEach(async () => {
    await move(root, ['update', '2', '--channels', 'x'])
  })

  it('says draft once the file is on disk', async () => {
    draft('x')
    await markChannelDrafted(2, 'x')
    assert.equal(channels()[0]!.status, 'draft')
  })

  it('says nothing when the draft never arrived', async () => {
    await markChannelDrafted(2, 'x')
    assert.equal(channels()[0]!.status, '')
  })

  it('puts a ready channel back to draft and leaves a published one alone', async () => {
    draft('x')
    await move(root, ['channel-status', '2', 'x', 'ready'])
    await markChannelDrafted(2, 'x')
    assert.equal(channels()[0]!.status, 'draft')
    await move(root, ['channel-status', '2', 'x', 'published', '--url', 'https://x.com/p/1'])
    await markChannelDrafted(2, 'x')
    assert.deepEqual(channels()[0], { name: 'x', status: 'published', url: 'https://x.com/p/1' })
  })
})
