// What a card finishing in planning has to carry before it is archived (#1057, #1117): a
// finished video or deck, or a carousel's pages as a `<Storyboard>` of `pages-*.json`.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { ASSETS, setBoardRoot } from '../src/lib/paths.ts'
import { planDeliveryGap } from '../src/lib/view/rules.ts'
import { move } from './helpers/board.ts'

const done = (body: string) => planDeliveryGap({ questions: [], todos: { total: 1, done: 1 }, body: `${body}\n\n- [x] Render: \`node render.mjs\`` })

describe('the deliverable a card finishing in planning carries', () => {
  it('counts a carousel pages storyboard', () => {
    assert.equal(done('<Storyboard src=".assets/1/pages-3x4.json" label="3:4" />'), null)
  })

  it('still refuses a video with only its cover, and a deck with only its storyboard', () => {
    assert.equal(done('<Asset src=".assets/1/cover.png" />'), 'deliverable')
    assert.equal(done('<Storyboard src=".assets/1/storyboard.json" />'), 'deliverable')
  })
})

describe('archiving a carousel post', () => {
  let root = ''
  const kanban = () => path.join(root, 'docs', 'kanban')

  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-carousel-')))
    fs.mkdirSync(path.join(root, '.git'), { recursive: true })
    fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
    fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
    fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
    fs.writeFileSync(path.join(kanban(), 'config.md'), '# Configuration\n\n- **Project** — a project.\n')
    setBoardRoot(root)
  })
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('is refused until the pages are on the card and on this machine', async () => {
    const id = (await move(root, ['create', '--title', 'Launch post', '--workflow', 'carousel-post'])).id as number
    const file = path.join(kanban(), 'todo', fs.readdirSync(path.join(kanban(), 'todo')).find((f) => f.startsWith(`${id}-`))!)
    const head = fs.readFileSync(file, 'utf8').split('\n---\n')[0]
    const write = (body: string) => fs.writeFileSync(file, `${head}\n---\n\nA post.\n\n${body}\n`)

    write('## Todo\n- [x] Pages: `node render.mjs`')
    await assert.rejects(move(root, ['archive', String(id)]), /carousel pages/)

    write(`<Storyboard src=".assets/${id}/pages-3x4.json" label="3:4" />\n\n## Todo\n- [x] Pages: \`node render.mjs\``)
    await assert.rejects(move(root, ['archive', String(id)]), /pages-3x4\.json is not on this machine/)

    fs.mkdirSync(path.join(ASSETS, String(id)), { recursive: true })
    fs.writeFileSync(path.join(ASSETS, String(id), 'pages-3x4.json'), '{}')
    await move(root, ['archive', String(id)])
  })
})
