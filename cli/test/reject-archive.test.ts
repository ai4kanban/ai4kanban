// A rejected card is filed in the archive, marked `rejected` (#1229).
//
// Reject and discard used to delete the file. Both now move it the way archive does, and the
// mark is what keeps a turned-down card from reading as shipped work. The reason it was
// rejected with stays on it (#1379), beside who rejected it and when (#1497).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdRemove } from '../src/commands/remove.ts'
import { RUN_ENV } from '../src/lib/agent/env.ts'
import { queueCompleted } from '../src/lib/agent/propose.ts'
import { rejectCard } from '../src/lib/agent/reject.ts'
import { reflectQueue } from '../src/lib/agent/settings.ts'
import { leftBoardOnLanding } from '../src/lib/agent/sessions.ts'
import { logPathOf, readRuns, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { walkMd } from '../src/lib/cards.ts'
import { parseFrontmatter } from '../src/lib/frontmatter.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { validateSpec } from '../src/lib/spec-contract.ts'
import type { MoveResult } from '../src/lib/types.ts'
import { archivedId, readArchive } from '../src/lib/view/archive.ts'
import { cloudNumber, forgetMachineState, move } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-reject-archive-'))
const kanban = () => path.join(root, 'docs', 'kanban')
const todo = () => path.join(kanban(), 'todo')
const archive = () => path.join(kanban(), '.archive')

beforeEach(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(todo(), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '90\n')
  setBoardRoot(root)
})

after(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(root, { recursive: true, force: true })
})

const cardText = (id: number, status = 'todo'): string =>
  [
    '---',
    `title: Card ${id}`,
    'priority: med',
    'roi: med',
    `status: ${status}`,
    'blocked_by: []',
    'related: []',
    'modules: []',
    'questions: []',
    '---',
    '',
    `What card ${id} is for.`,
    '',
  ].join('\n')

function card(id: number, status = 'todo'): void {
  fs.writeFileSync(path.join(todo(), `${id}-an-idea.md`), cardText(id, status))
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
      card(80, 'implementing')
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
    assert.equal(metaOf('80-an-idea.md').rejected, true)
    assert.equal(parseFrontmatter(fs.readFileSync(path.join(archive(), '80-an-idea.md'), 'utf8')).body.trim(), 'What card 80 is for.')
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

  it('validates with the mark, and only as true', () => {
    const marked = cardText(80).replace('questions: []', 'rejected: true\nquestions: []')
    const rules = (text: string) => validateSpec('80-an-idea.md', text).map((e) => e.rule)
    assert.equal(rules(marked).includes('rejected'), false)
    assert.equal(rules(marked.replace('rejected: true', 'rejected: no')).includes('rejected'), true)
  })
})

// The reason as the rejection dialog sends it: several lines, quotes, colons.
const WHY = 'Covered elsewhere: "a test reason".\nIt\'s not worth keeping — it\'s a test.'

/** A new card on the board, numbered the way the board numbers it. */
function fresh(): number {
  const id = cloudNumber(root)
  card(id)
  return id
}

const fileOf = (id: number) => path.join(archive(), `${id}-an-idea.md`)

/** The archived card's frontmatter, found by id anywhere under `.archive`. */
function archived(id: number) {
  const file = walkMd(archive()).find((f) => archivedId(f) === id)
  return file ? parseFrontmatter(fs.readFileSync(file, 'utf8')).meta! : null
}

/** A live run on `cardId`. */
function liveRun(sessionId: string, cardId: number | null, action: string): void {
  const run = {
    sessionId,
    cardId,
    action,
    status: 'running',
    startedAt: Date.now(),
    pid: process.pid,
    harness: 'test',
    logPath: logPathOf(sessionId),
  } as RunRecord
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  fs.writeFileSync(run.logPath, '')
  withStore((store) => store.runs.push(run))
}

describe('raw reject --reason', () => {
  it('keeps a multi-line reason with quotes and colons, word for word', async () => {
    const id = fresh()
    await move(root, ['reject', String(id), '--reason', WHY])
    const text = fs.readFileSync(fileOf(id), 'utf8')
    assert.match(text, /^rejected_reason: /m)
    // Validation knows the field on a rejected card, and refuses it anywhere else.
    const flagged = (t: string) => validateSpec(fileOf(id), t).filter((e) => e.rule === 'rejected_reason' || e.rule === 'frontmatter')
    assert.deepEqual(flagged(text), [])
    assert.equal(flagged(text.replace('rejected: true\n', '')).length, 1)
    assert.equal(archived(id)?.rejected_reason, WHY)
    // The list carries no reason — only the opened card does.
    assert.equal('rejectedReason' in readArchive().cards[0]!, false)
  })

  it('writes no field on a discard with no reason', async () => {
    const id = fresh()
    await move(root, ['reject', String(id), '--discard'])
    assert.doesNotMatch(fs.readFileSync(fileOf(id), 'utf8'), /rejected_reason/)
    assert.equal(archived(id)!.rejected, true)
    assert.equal(archived(id)!.rejected_reason, '')
  })

  it('keeps the reason a discard was given', async () => {
    const id = fresh()
    await move(root, ['reject', String(id), '--discard', '--reason', WHY])
    assert.equal(archived(id)?.rejected_reason, WHY)
  })

  it('stamps every subtask a group takes with it', async () => {
    const id = cloudNumber(root)
    const subs = [id + 1, id + 2]
    const dir = path.join(todo(), `${id}-a-group`)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'root.md'), `${cardText(id)}\n## Todo\n${subs.map((s) => `- [ ] A piece #${s}`).join('\n')}\n`)
    for (const sub of subs) fs.writeFileSync(path.join(dir, `${sub}-a-part.md`), cardText(sub))
    await move(root, ['reject', String(id), '--reason', WHY])
    for (const each of [id, ...subs]) assert.equal(archived(each)?.rejected_reason, WHY)
  })

  it('leaves a finished card without one', async () => {
    const id = fresh()
    await move(root, ['archive', String(id)])
    assert.equal(archived(id)!.rejected_reason, '')
  })
})

describe('who rejected it, and when (#1497)', () => {
  it('stamps a rejection by the user', async () => {
    const id = fresh()
    const before = Date.now()
    await move(root, ['reject', String(id), '--reason', WHY])
    const text = fs.readFileSync(fileOf(id), 'utf8')
    assert.match(text, /^rejected_by: user$/m)
    const at = Date.parse(text.match(/^rejected_at: (.+)$/m)![1]!.replace(/^['"]|['"]$/g, ''))
    assert.ok(at >= before - 1000 && at <= Date.now())
    assert.deepEqual(validateSpec(fileOf(id), text).filter((e) => e.rule.startsWith('rejected')), [])
    assert.equal(validateSpec(fileOf(id), text.replace('rejected: true\n', '')).filter((e) => e.rule.startsWith('rejected')).length, 3)
  })

  it('stamps a rejection made inside a run as the agent', async () => {
    const id = fresh()
    liveRun('chat-run', null, 'create')
    process.env[RUN_ENV] = 'chat-run'
    await move(root, ['reject', String(id), '--reason', WHY])
    assert.match(fs.readFileSync(fileOf(id), 'utf8'), /^rejected_by: agent$/m)
  })

  it('stamps neither on a discard', async () => {
    const id = fresh()
    await move(root, ['reject', String(id), '--discard', '--reason', WHY])
    assert.doesNotMatch(fs.readFileSync(fileOf(id), 'utf8'), /rejected_(at|by)/)
  })
})

describe('rejecting starts no run (#1497)', () => {
  it('files the card on the spot', async () => {
    const id = fresh()
    const res = await rejectCard(id, { reason: WHY })
    assert.equal(res.ok, true)
    assert.equal(archived(id)?.rejected_reason, WHY)
    assert.equal(readRuns().length, 0)
  })

  it('is held by a live run on the card, as a reject run was', async () => {
    const id = fresh()
    liveRun('refine-run', id, 'clarify')
    const res = await rejectCard(id, { reason: WHY })
    assert.equal(res.ok, false)
    assert.ok(fs.existsSync(path.join(todo(), `${id}-an-idea.md`)))
  })

  it('is not held by the run asking', async () => {
    const id = fresh()
    liveRun('refine-run', id, 'clarify')
    process.env[RUN_ENV] = 'refine-run'
    const res = await rejectCard(id, { reason: WHY })
    assert.equal(res.ok, true)
  })
})
