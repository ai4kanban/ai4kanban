// The usage ledger (#1067): every finished run and chat reply is written down once, kept a
// year, and summed by connector and model for Insights.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { logPathOf, withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { readLedger, recordReplyUsage } from '../src/lib/agent/usage.ts'
import { CHATS_DIR, SESSIONS_DIR, USAGE, setBoardRoot } from '../src/lib/paths.ts'
import { readUsageView } from '../src/lib/view/usage.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-usage-'))
const DAY = 86_400_000
const tokens = (n: number) => ({ input: n, cacheCreation: 0, cacheRead: 0, output: n })

beforeEach(() => {
  forgetMachineState(root)
  fs.mkdirSync(path.join(root, 'docs', 'kanban'), { recursive: true })
  setBoardRoot(root)
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const run = (id: string, over: Partial<RunRecord> = {}): RunRecord => {
  fs.writeFileSync(logPathOf(id), '')
  return {
    sessionId: id,
    cardId: 1,
    action: 'implement',
    status: 'running',
    startedAt: Date.now() - 1000,
    pid: process.pid,
    harness: 'claude-code',
    model: 'claude-opus-5-5',
    logPath: logPathOf(id),
    ...over,
  }
}

function finish(id: string, over: Partial<RunRecord> = {}): void {
  withStore((s) => {
    const r = s.runs.find((x) => x.sessionId === id)!
    Object.assign(r, { status: 'done', endedAt: Date.now(), ...over })
  })
}

const view = (days = 30) => {
  const r = readUsageView(days)
  assert.ok(r.ok)
  return r.view
}

describe('usage ledger', () => {
  it('imports the record and old replies on the first read, old replies unattributed', () => {
    withStore((s) => s.runs.push(run('a', { status: 'done', endedAt: Date.now() - 2 * DAY, usage: tokens(10), costUsd: 1 })))
    fs.mkdirSync(CHATS_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(CHATS_DIR, 'board.json'),
      JSON.stringify({
        harness: 'claude-code',
        messages: [
          { role: 'you', text: 'hi', at: Date.now() - 3 * DAY },
          { role: 'agent', text: 'yo', at: Date.now() - 3 * DAY + 5, usage: tokens(3), costUsd: 0.5 },
        ],
      }),
    )
    const v = view()
    assert.equal(v.rows.length, 2)
    assert.deepEqual(v.rows.map((r) => [r.harness, r.runs, r.turns]), [['claude-code', 1, 0], [undefined, 0, 1]])
    assert.equal(v.totalUsd, 1.5)
    assert.ok(v.since < Date.now() - 2.9 * DAY)
  })

  it('writes a run once as it ends, and a resumed run counts both halves', () => {
    view()
    withStore((s) => s.runs.push(run('first')))
    finish('first', { usage: tokens(5), costUsd: 2 })
    finish('first', { costUsd: 99 })
    withStore((s) => s.runs.push(run('second', { resumedFrom: 'first' } as Partial<RunRecord>)))
    finish('second', { usage: tokens(5), costUsd: 3 })
    const [row] = view().rows
    assert.equal(row.runs, 2)
    assert.equal(row.costUsd, 5)
    assert.equal(row.tokens.input, 10)
  })

  it('keeps missing models and costs apart, and never counts a missing cost as zero', () => {
    view()
    withStore((s) => {
      s.runs.push(run('nomodel', { model: undefined }))
      s.runs.push(run('nocost', { model: 'free-model' }))
      s.runs.push(run('p1', { model: 'mixed' }))
      s.runs.push(run('p2', { model: 'mixed' }))
    })
    finish('nomodel', { costUsd: 1 })
    finish('nocost', { usage: tokens(100) })
    finish('p1', { costUsd: 4 })
    finish('p2', { usage: tokens(1) })
    const rows = view().rows
    assert.deepEqual(rows.map((r) => r.model), ['mixed', undefined])
    assert.equal(rows[0].unpriced, 1)
    assert.equal(rows[0].costUsd, 4)
    assert.equal(view().totalUsd, 5)
  })

  it('outlives the record’s own 100-run limit', () => {
    view()
    for (let i = 0; i < 120; i++) {
      withStore((s) => s.runs.push(run(`r${i}`, { startedAt: Date.now() - (200 - i) * 1000 })))
      finish(`r${i}`, { costUsd: 1 })
    }
    for (let i = 0; i < 30; i++) fs.rmSync(logPathOf(`r${i}`))
    withStore((s) => s.runs.push(run('last')))
    assert.ok(JSON.parse(fs.readFileSync(path.join(path.dirname(SESSIONS_DIR), 'sessions.json'), 'utf8')).runs.length <= 101)
    assert.equal(view().rows[0].runs, 120)
  })

  it('records replies by connector and drops entries older than a year', () => {
    view()
    const ledger = readLedger()!
    ledger.entries.push({ key: 'run:ancient', kind: 'run', at: Date.now() - 400 * DAY, harness: 'claude-code', costUsd: 9 })
    fs.writeFileSync(USAGE, JSON.stringify(ledger))
    recordReplyUsage({ key: 'chat:board:1', kind: 'chat', at: Date.now(), harness: 'codex', model: 'gpt', costUsd: 0.2 }, () => [])
    recordReplyUsage({ key: 'chat:board:1', kind: 'chat', at: Date.now(), harness: 'codex', model: 'gpt', costUsd: 0.2 }, () => [])
    assert.equal(readLedger()!.entries.some((e) => e.key === 'run:ancient'), false)
    const [row] = view(365).rows
    assert.deepEqual([row.harness, row.turns, row.costUsd], ['codex', 1, 0.2])
  })

  it('says so when the ledger cannot be read', () => {
    fs.mkdirSync(path.dirname(USAGE), { recursive: true })
    fs.writeFileSync(USAGE, '{oops')
    const r = readUsageView(30)
    assert.equal(r.ok, false)
  })
})
