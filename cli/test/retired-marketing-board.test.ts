// A board that WAS a marketing board, opened by a version that has retired them (#718).
//
// Nothing migrates it: the `Solution` line stays in its `config.md`, its topic cards keep
// their `channels:` and their missing `priority`, and a `write` agent it added is still on
// disk. All three have to read as what they now are — an unknown config setting, ordinary
// cards, and one agent with a problem beside it — rather than stopping the board.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { specAgentCatalog } from '../src/lib/agents/catalog.ts'
import { missingConfigKeys } from '../src/lib/config-template.ts'
import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { CONFIG, setBoardRoot } from '../src/lib/paths.ts'
import { allCards, readBoard } from '../src/lib/view/read.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')

// The `config.md` an install wrote when this board was made, `Solution` line and all.
const CONFIG_MD = `# Configuration

- **Solution** — marketing
- **Project** — a board that used to write posts.
- **Stale after** — 30 days
`

// A topic card as that board wrote one: no `priority`, no `roi`, no `release`, no
// `questions`, and a `channels:` block carrying both of its shapes.
const TOPIC = `---
title: Why we stopped using a second board
status: todo
blocked_by: []
related: []
modules: []
channels:
  - x
  - name: xiaohongshu
    status: published
    url: "https://example.com/p/1"
---

The piece itself lived under content/.
`

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-retired-marketing-')))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'config.md'), CONFIG_MD)
  fs.writeFileSync(path.join(kanban(), 'next-id'), '9\n')
  fs.writeFileSync(path.join(kanban(), 'todo', '7-why-we-stopped.md'), TOPIC)
  setBoardRoot(root)
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a board whose config still names a solution', () => {
  it('opens, and the leftover line is neither read nor reported as missing', () => {
    assert.equal(readBoard().columns.flatMap((c) => c.cards).length, 1)
    // `missingConfigKeys` names what a newer release ADDED, so a setting this one dropped
    // is simply a line nobody asks about — not an error, and not a repair to make.
    assert.ok(!missingConfigKeys(fs.readFileSync(CONFIG, 'utf8')).includes('Solution'))
  })
})

describe('a topic card with channels and no ranking', () => {
  it('reads as an ordinary card, ranked empty rather than refused', () => {
    const card = allCards().find((c) => c.id === 7)!
    assert.equal(card.title, 'Why we stopped using a second board')
    assert.equal(card.priority, '')
    assert.equal(card.roi, '')
    assert.equal(card.status, 'todo')
    assert.deepEqual(card.questions, [])
  })

  it('drops the dead field the next time the card is written', () => {
    const written = serializeFrontmatter({ title: 'x', status: 'todo' } as never)
    assert.doesNotMatch(written, /channels:/)
  })
})

describe('a `write` agent left on the board', () => {
  it('is listed as a problem, and the rest of the roster still reads', () => {
    const home = path.join(kanban(), 'agents', 'post-image')
    fs.mkdirSync(home, { recursive: true })
    fs.writeFileSync(
      path.join(home, 'AGENT.md'),
      [
        '---',
        'name: post-image',
        'description: Use when a post needs an image.',
        'akb:',
        '  kind: write',
        '  owns: the image a post goes out with',
        '---',
        '',
        'Draw the image.',
      ].join('\n'),
    )
    const { agents, problems } = specAgentCatalog()
    assert.ok(!agents.some((a) => a.name === 'post-image'))
    assert.match(problems.join('\n'), /the marketing board it wrote for is retired/)
    // And the two the command ships are still there — one bad file is one problem, not a
    // catalog that failed to read.
    assert.ok(agents.some((a) => a.name === 'ui-designer'))
  })
})
