// The reason a card was rejected with, kept on the archived card (#1379).
//
// It arrives as `--reason` and is read off the archived card, beside who rejected it and when
// (#1497) — what the rejection review reads.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { RUN_ENV } from '../src/lib/agent/env.ts'
import { rejectCard } from '../src/lib/agent/reject.ts'
import { logPathOf, readRuns, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { validateSpec } from '../src/lib/spec-contract.ts'
import { readArchive, readArchivedCard } from '../src/lib/view/archive.ts'
import { forgetMachineState, move } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-rejected-reason-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')
const archive = path.join(kanban, '.archive')

const WHY = 'Insights already covers this: "counting".\nAn export is one more thing to keep — it\'s not worth it.'

beforeEach(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(todo, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '90\n')
  setBoardRoot(root)
})

after(() => {
  delete process.env[RUN_ENV]
  fs.rmSync(root, { recursive: true, force: true })
})

const cardText = (id: number, body: string): string =>
  ['---', `title: Card ${id}`, 'priority: low', 'roi: low', 'status: todo', 'release: ""', 'blocked_by: []', 'related: []', 'modules: []', 'questions: []', '---', '', body, ''].join('\n')

function card(id: number): void {
  fs.writeFileSync(path.join(todo, `${id}-an-idea.md`), cardText(id, 'One idea.'))
}

function group(id: number, subIds: number[]): void {
  const dir = path.join(todo, `${id}-a-group`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'root.md'), cardText(id, `The whole job.\n\n## Todo\n${subIds.map((s) => `- [ ] A piece #${s}`).join('\n')}`))
  for (const sub of subIds) fs.writeFileSync(path.join(dir, `${sub}-a-part.md`), cardText(sub, 'One piece.'))
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

/** This process inside a live run on no card. */
function insideRun(sessionId: string): void {
  liveRun(sessionId, null, 'create')
  process.env[RUN_ENV] = sessionId
}

describe('raw reject --reason', () => {
  it('keeps a multi-line reason with quotes and colons, word for word', async () => {
    card(80)
    await move(root, ['reject', '80', '--reason', WHY])
    const file = path.join(archive, '80-an-idea.md')
    const text = fs.readFileSync(file, 'utf8')
    assert.match(text, /^rejected_reason: /m)
    // Validation knows the field on a rejected card, and refuses it anywhere else.
    const flagged = (t: string) => validateSpec(file, t).filter((e) => e.rule === 'rejected_reason' || e.rule === 'frontmatter')
    assert.deepEqual(flagged(text), [])
    assert.equal(flagged(text.replace('rejected: true\n', '')).length, 1)
    assert.equal(readArchivedCard(80)?.rejectedReason, WHY)
    // The list carries no reason — only the opened card does.
    assert.equal('rejectedReason' in readArchive().cards[0]!, false)
  })

  it('writes no field on a discard with no reason', async () => {
    card(80)
    await move(root, ['reject', '80', '--discard'])
    assert.doesNotMatch(fs.readFileSync(path.join(archive, '80-an-idea.md'), 'utf8'), /rejected_reason/)
    const read = readArchivedCard(80)!
    assert.equal(read.rejected, true)
    assert.equal('rejectedReason' in read, false)
  })

  it('keeps the reason a discard was given', async () => {
    card(80)
    await move(root, ['reject', '80', '--discard', '--reason', 'a duplicate of #12'])
    assert.equal(readArchivedCard(80)?.rejectedReason, 'a duplicate of #12')
  })

  it('stamps every subtask a group takes with it', async () => {
    group(80, [81, 82])
    await move(root, ['reject', '80', '--reason', WHY])
    for (const id of [80, 81, 82]) assert.equal(readArchivedCard(id)?.rejectedReason, WHY)
  })

  it('leaves a finished card without one', async () => {
    card(80)
    await move(root, ['archive', '80'])
    assert.equal('rejectedReason' in readArchivedCard(80)!, false)
  })
})

describe('who rejected it, and when (#1497)', () => {
  const metaOf = (id: number) => fs.readFileSync(path.join(archive, `${id}-an-idea.md`), 'utf8')

  it('stamps a rejection by the user', async () => {
    card(80)
    const before = Date.now()
    await move(root, ['reject', '80', '--reason', WHY])
    const text = metaOf(80)
    assert.match(text, /^rejected_by: user$/m)
    const at = Date.parse(text.match(/^rejected_at: (.+)$/m)![1]!.replace(/^['"]|['"]$/g, ''))
    assert.ok(at >= before - 1000 && at <= Date.now())
    const file = path.join(archive, '80-an-idea.md')
    assert.deepEqual(validateSpec(file, text).filter((e) => e.rule.startsWith('rejected')), [])
    assert.equal(validateSpec(file, text.replace('rejected: true\n', '')).filter((e) => e.rule.startsWith('rejected')).length, 3)
  })

  it('stamps a rejection made inside a run as the agent', async () => {
    card(80)
    insideRun('chat-run')
    await move(root, ['reject', '80', '--reason', WHY])
    assert.match(metaOf(80), /^rejected_by: agent$/m)
  })

  it('stamps neither on a discard', async () => {
    card(80)
    await move(root, ['reject', '80', '--discard', '--reason', 'clearing'])
    assert.doesNotMatch(metaOf(80), /rejected_(at|by)/)
  })
})

describe('rejecting starts no run (#1497)', () => {
  it('files the card on the spot', async () => {
    card(80)
    const res = await rejectCard(80, { reason: WHY })
    assert.equal(res.ok, true)
    assert.equal(readArchivedCard(80)?.rejectedReason, WHY)
    assert.equal(readRuns().length, 0)
  })

  it('is held by a live run on the card, as a reject run was', async () => {
    card(80)
    liveRun('refine-run', 80, 'clarify')
    const res = await rejectCard(80, { reason: WHY })
    assert.equal(res.ok, false)
    assert.ok(fs.existsSync(path.join(todo, '80-an-idea.md')))
  })

  it('is not held by the run asking', async () => {
    card(80)
    liveRun('refine-run', 80, 'clarify')
    process.env[RUN_ENV] = 'refine-run'
    const res = await rejectCard(80, { reason: WHY })
    assert.equal(res.ok, true)
  })
})
