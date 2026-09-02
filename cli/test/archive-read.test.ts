// Reading the archive (#380).
//
// Two halves that only work together: `archive` stamps the day on its way out, and the read
// gives the folder back as a list. These fix the stamp (card, group, and the `implementing`
// a run was holding), the id a group's `root.md` is filed under, and the empty answers — no
// stamp, no `.archive` at all — that the screen has to tell apart from a failed read.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdRemove } from '../src/commands/remove.ts'
import { parseFrontmatter } from '../src/lib/frontmatter.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { readArchive, readArchivedCard } from '../src/lib/view/archive.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-archive-read-'))
const kanban = () => path.join(root, 'docs', 'kanban')
const todo = () => path.join(kanban(), 'todo')
const archive = () => path.join(kanban(), '.archive')

/** Today, the way `formatDay` writes it — what the stamp has to match. */
function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(path.join(todo(), 'features'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '90\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const frontmatter = (id: number, extra: Record<string, string> = {}): string =>
  [
    '---',
    `title: Card ${id}`,
    'track: features',
    'priority: med',
    'roi: med',
    `status: ${extra.status ?? 'todo'}`,
    `release: ${extra.release ?? '""'}`,
    'blocked_by: []',
    'related: []',
    'modules: []',
    'questions: []',
    '---',
  ].join('\n')

/** One card in a track folder. */
function card(id: number, extra: Record<string, string> = {}): string {
  const file = path.join(todo(), 'features', `${id}-a-card.md`)
  fs.writeFileSync(file, `${frontmatter(id, extra)}\n\nWhat it does.\n`)
  return file
}

/** A group folder: `todo/<id>-a-group/root.md` plus one subtask card per id. */
function group(id: number, subIds: number[]): string {
  const dir = path.join(todo(), `${id}-a-group`)
  fs.mkdirSync(path.join(dir, 'features'), { recursive: true })
  fs.writeFileSync(
    path.join(dir, 'root.md'),
    `${frontmatter(id)}\n\nThe whole job.\n\n## Todo\n${subIds.map((s) => `- [ ] A piece #${s}`).join('\n')}\n`,
  )
  for (const sub of subIds) {
    fs.writeFileSync(path.join(dir, 'features', `${sub}-a-part.md`), `${frontmatter(sub)}\n\nOne piece.\n`)
  }
  return dir
}

/** Run a removal with its receipt held aside, so the test run's output stays readable. */
function remove(id: number, metric: 'completed' | 'rejected'): void {
  startCollecting()
  try {
    cmdRemove(id, metric)
  } finally {
    stopCollecting()
  }
}

const metaOf = (file: string) => parseFrontmatter(fs.readFileSync(file, 'utf8')).meta!

describe('the day a card was archived', () => {
  it('is stamped on the card on its way out', () => {
    card(91)
    remove(91, 'completed')
    assert.equal(metaOf(path.join(archive(), '91-a-card.md')).archived, today())
  })

  it('is stamped on a group root and on every subtask leaving with it', () => {
    group(91, [92, 93])
    remove(91, 'completed')
    const dir = path.join(archive(), '91-a-group')
    assert.equal(metaOf(path.join(dir, 'root.md')).archived, today())
    for (const sub of [92, 93]) {
      assert.equal(metaOf(path.join(dir, 'features', `${sub}-a-part.md`)).archived, today())
    }
  })

  it('drops the stage a run was holding in the same write', () => {
    card(91, { status: 'implementing' })
    remove(91, 'completed')
    const meta = metaOf(path.join(archive(), '91-a-card.md'))
    assert.equal(meta.status, 'todo')
    assert.equal(meta.archived, today())
  })

  it('leaves a rejected card nothing — it is deleted, not filed', () => {
    card(91)
    remove(91, 'rejected')
    assert.equal(fs.existsSync(archive()), false)
    assert.equal(fs.existsSync(path.join(todo(), 'features', '91-a-card.md')), false)
  })

  it('is not written on a card nobody archived', () => {
    const file = card(91)
    assert.equal(metaOf(file).archived, '')
    assert.equal(fs.readFileSync(file, 'utf8').includes('archived:'), false)
  })
})

describe('the archive, read', () => {
  it('names the folder and holds nothing on a board that has archived none', () => {
    const list = readArchive()
    assert.equal(list.relPath, 'docs/kanban/.archive')
    assert.deepEqual(list.cards, [])
  })

  it('lists what it holds, highest id first', () => {
    card(91)
    card(93, { release: '"0.9.0"' })
    card(92)
    for (const id of [91, 92, 93]) remove(id, 'completed')
    const list = readArchive()
    assert.deepEqual(
      list.cards.map((c) => c.id),
      [93, 92, 91],
    )
    const [newest] = list.cards
    assert.equal(newest!.title, 'Card 93')
    assert.equal(newest!.track, 'features')
    assert.equal(newest!.release, '0.9.0')
    assert.equal(newest!.archived, today())
    assert.equal(newest!.relPath, 'docs/kanban/.archive/93-a-card.md')
  })

  it('reads a group root off its folder, and its subtasks beside it', () => {
    group(91, [92, 93])
    remove(91, 'completed')
    const list = readArchive()
    assert.deepEqual(
      list.cards.map((c) => c.id),
      [93, 92, 91],
    )
    assert.equal(list.cards.at(-1)!.relPath, 'docs/kanban/.archive/91-a-group/root.md')
  })

  it("leaves an unstamped card's date empty rather than guessing one", () => {
    fs.mkdirSync(archive(), { recursive: true })
    fs.writeFileSync(path.join(archive(), '80-an-old-one.md'), `${frontmatter(80)}\n\nFinished long ago.\n`)
    const [old] = readArchive().cards
    assert.equal(old!.archived, '')
    assert.equal(old!.release, '')
  })
})

describe('one archived card', () => {
  it('comes back whole, body and all', () => {
    card(91, { release: '"0.9.0"' })
    remove(91, 'completed')
    const found = readArchivedCard(91)
    assert.equal(found!.title, 'Card 91')
    assert.equal(found!.release, '0.9.0')
    assert.equal(found!.body, 'What it does.')
  })

  it('is found inside a group folder', () => {
    group(91, [92])
    remove(91, 'completed')
    assert.equal(readArchivedCard(92)!.body, 'One piece.')
    assert.equal(readArchivedCard(91)!.body.startsWith('The whole job.'), true)
  })

  it('is null for an id the archive holds none of, and on a board with no archive', () => {
    assert.equal(readArchivedCard(91), null)
    card(91)
    assert.equal(readArchivedCard(91), null, 'a card still open is not in the archive')
    remove(91, 'completed')
    assert.equal(readArchivedCard(999), null)
  })
})
