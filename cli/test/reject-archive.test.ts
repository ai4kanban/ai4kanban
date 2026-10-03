// A rejected card is filed in the archive, marked `rejected` (#1229).
//
// Reject and discard used to delete the file. Both now move it the way archive does, and the
// mark is what keeps a turned-down card from reading as shipped work.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdRemove } from '../src/commands/remove.ts'
import { queueCompleted } from '../src/lib/agent/propose.ts'
import { reflectQueue } from '../src/lib/agent/settings.ts'
import { packBoard, unpackBoard } from '../src/lib/board/transfer.ts'
import { leftBoardOnLanding } from '../src/lib/agent/sessions.ts'
import { parseFrontmatter } from '../src/lib/frontmatter.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { endingCards } from '../src/lib/releases.ts'
import { validateSpec } from '../src/lib/spec-contract.ts'
import type { MoveResult } from '../src/lib/types.ts'
import { readArchive, readArchivedCard } from '../src/lib/view/archive.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-reject-archive-'))
const kanban = () => path.join(root, 'docs', 'kanban')
const todo = () => path.join(kanban(), 'todo')
const archive = () => path.join(kanban(), '.archive')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(todo(), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '90\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const cardText = (id: number, release = '', status = 'todo'): string =>
  [
    '---',
    `title: Card ${id}`,
    'priority: med',
    'roi: med',
    `status: ${status}`,
    `release: "${release}"`,
    'blocked_by: []',
    'related: []',
    'modules: []',
    'questions: []',
    '---',
    '',
    `What card ${id} is for.`,
    '',
  ].join('\n')

function card(id: number, release = '', status = 'todo'): void {
  fs.writeFileSync(path.join(todo(), `${id}-an-idea.md`), cardText(id, release, status))
}

function remove(id: number, metric: 'completed' | 'rejected', discard = false): MoveResult & { receipt: string } {
  const box = startCollecting()
  try {
    return { ...cmdRemove(id, metric, discard ? { discard: true } : {}), receipt: box.out.join('\n') }
  } finally {
    stopCollecting()
  }
}

const metaOf = (...parts: string[]) => parseFrontmatter(fs.readFileSync(path.join(archive(), ...parts), 'utf8')).meta!

describe('rejecting a card', () => {
  for (const discard of [false, true]) {
    it(`files it in the archive, marked rejected${discard ? ' — a discard too' : ''}`, () => {
      card(80, '', 'implementing')
      const res = remove(80, 'rejected', discard)
      assert.equal(fs.existsSync(path.join(todo(), '80-an-idea.md')), false)
      const meta = metaOf('80-an-idea.md')
      assert.equal(meta.rejected, true)
      assert.match(meta.archived, /^\d{4}-\d{2}-\d{2}$/)
      assert.equal(meta.status, 'todo')
      assert.equal(res.action, 'rejected')
      assert.equal(res.archived_to, path.join('docs', 'kanban', '.archive', '80-an-idea.md'))
      assert.match(res.receipt, /moved file 80-an-idea\.md → .*marked rejected/)
      assert.doesNotMatch(res.receipt, /What card 80 is for/, 'the receipt no longer prints the card')
    })
  }

  it('keeps the body readable and says so on the list row', () => {
    card(80)
    card(81)
    remove(80, 'rejected')
    remove(81, 'completed')
    const rows = readArchive().cards
    assert.deepEqual(rows.map((row) => [row.id, row.rejected]), [[81, false], [80, true]])
    assert.equal(readArchivedCard(80)!.rejected, true)
    assert.equal(readArchivedCard(80)!.body, 'What card 80 is for.')
    assert.equal(metaOf('81-an-idea.md').rejected, false)
  })

  it('leaves the assets for the weekly cleanup', () => {
    card(80)
    const assets = path.join(root, '.akb', 'boards', 'docs', 'kanban', 'assets', '80')
    fs.mkdirSync(assets, { recursive: true })
    fs.writeFileSync(path.join(assets, 'shot.png'), 'x')
    remove(80, 'rejected')
    assert.equal(fs.existsSync(path.join(assets, 'shot.png')), true)
  })

  it('moves a group folder whole, marking every card in it', () => {
    const dir = path.join(todo(), '50-a-group')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'root.md'), `${cardText(50)}\n## Todo\n- [ ] one #51\n`)
    fs.writeFileSync(path.join(dir, '51-a-part.md'), cardText(51))
    remove(50, 'rejected')
    assert.equal(fs.existsSync(dir), false)
    assert.equal(metaOf('50-a-group', 'root.md').rejected, true)
    assert.equal(metaOf('50-a-group', '51-a-part.md').rejected, true)
    assert.deepEqual(readArchive().cards.map((row) => [row.id, row.rejected]), [[51, true], [50, true]])
  })

  it('refuses on a name already in the archive, with the board untouched', () => {
    card(80)
    fs.mkdirSync(archive(), { recursive: true })
    fs.writeFileSync(path.join(archive(), '80-an-idea.md'), 'in the way')
    const before = fs.readFileSync(path.join(todo(), '80-an-idea.md'), 'utf8')
    assert.throws(() => remove(80, 'rejected'), /already exists/)
    assert.equal(fs.readFileSync(path.join(todo(), '80-an-idea.md'), 'utf8'), before)
    assert.equal(fs.readFileSync(path.join(archive(), '80-an-idea.md'), 'utf8'), 'in the way')
  })
})

describe('a rejected card in the archive', () => {
  it('is not counted as shipped by its release', () => {
    card(80, 'v1')
    card(81, 'v1')
    card(82, 'v1')
    remove(80, 'rejected')
    remove(81, 'rejected', true)
    remove(82, 'completed')
    assert.deepEqual(endingCards('v1').archived.map((row) => row.id), [82])
  })

  it('starts no reflection and is not a landed card', () => {
    card(80)
    card(81)
    remove(80, 'rejected')
    remove(81, 'completed')
    queueCompleted([80, 81])
    assert.deepEqual(reflectQueue(), [81])
    assert.equal(leftBoardOnLanding(80), false)
    assert.equal(leftBoardOnLanding(81), true)
  })

  it('travels to a Cloud workspace and back with the mark', () => {
    card(80)
    remove(80, 'rejected')
    const payload = packBoard()
    const sent = payload.cards.find((one) => one.id === 80)!
    assert.equal(sent.archived, true)
    // The wire is JSON, so the mark comes back as a boolean rather than as the text a file holds.
    const back = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-reject-back-'))
    unpackBoard(JSON.parse(JSON.stringify(payload)), back)
    const text = fs.readFileSync(path.join(back, 'docs', 'kanban', '.archive', '80-an-idea.md'), 'utf8')
    fs.rmSync(back, { recursive: true, force: true })
    assert.equal(parseFrontmatter(text).meta!.rejected, true)
  })

  it('validates with the mark, and only as true', () => {
    const marked = cardText(80).replace('questions: []', 'rejected: true\nquestions: []')
    const rules = (text: string) => validateSpec('80-an-idea.md', text).map((e) => e.rule)
    assert.equal(rules(marked).includes('rejected'), false)
    assert.equal(rules(marked.replace('rejected: true', 'rejected: no')).includes('rejected'), true)
  })
})
