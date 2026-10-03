// A reply's and a run's own cost (#1480): Claude Code reports the session's running total,
// so what a carried-on or forked session spent before is taken off.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { handOffToCards, readChat, sendChatMessage } from '../src/lib/agent/chat.ts'
import { splitLog } from '../src/lib/agent/log.ts'
import { ownCost } from '../src/lib/agent/own-cost.ts'
import { closeRun, openResume, openRun, patch, peekRun } from '../src/lib/agent/sessions.ts'
import { startRun } from '../src/lib/agent/start.ts'
import { readRuns, recordCreatedCards } from '../src/lib/agent/store.ts'
import type { AgentRequest, RunRecord } from '../src/lib/agent/types.ts'
import { readLedger } from '../src/lib/agent/usage.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { CHATS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, uiConfigOf } from './helpers/board.ts'

const DISCUSSION = 'discussion-00000000-0000-0000-0000-000000000001'
let root = ''
let total = ''

// A stand-in CLI that reports whatever session total the test wrote last.
function board(harness = 'claude-code'): void {
  const file = path.join(root, 'agent.mjs')
  total = path.join(root, 'total')
  fs.writeFileSync(
    file,
    `import fs from 'node:fs'
const usd = Number(fs.readFileSync(${JSON.stringify(total)}, 'utf8'))
console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }))
console.log(JSON.stringify({ type: 'result', result: 'ok', total_cost_usd: usd }))
`,
  )
  fs.writeFileSync(
    uiConfigOf(root, 'docs', 'kanban'),
    JSON.stringify({ runtimes: [{ id: 'global', name: 'Global default', harness, settings: { command: `node ${file}` } }] }),
  )
}

const reports = (usd: number) => fs.writeFileSync(total, String(usd))
const near = (a: number | undefined, b: number) => assert.ok(a !== undefined && Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`)

function discussion(sessionCostUsd?: number): void {
  fs.mkdirSync(CHATS_DIR, { recursive: true })
  fs.writeFileSync(
    path.join(CHATS_DIR, `${DISCUSSION}.json`),
    JSON.stringify({
      cardId: DISCUSSION,
      harness: 'claude-code',
      resumeId: 'handoff-session',
      messages: [
        { role: 'you', text: 'plan it', at: 1 },
        { role: 'agent', text: 'planned', at: 2, costUsd: 0.5, ...(sessionCostUsd ? { sessionCostUsd } : {}) },
      ],
      startedAt: 1,
      updatedAt: 2,
    }),
  )
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-own-cost-'))
  forgetMachineState(root)
  setBoardRoot(root)
  setBoardProvider(null)
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '1\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'README.md'), '# Tasks\n')
  board()
  await move(root, ['create', '--title', 'Card one'])
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('ownCost', () => {
  it('takes the last total off, and keeps a total that fell back as it is', () => {
    near(ownCost(6.97, 6.88), 0.09)
    assert.equal(ownCost(0.4, 6.88), 0.4)
    assert.equal(ownCost(0.4, undefined), 0.4)
    assert.equal(ownCost(0.4, null), undefined)
    assert.equal(ownCost(undefined, 1), undefined)
  })
})

describe("a card chat's cost", () => {
  it('forked from a $6.88 session, each turn shows its own', async () => {
    discussion(6.88)
    handOffToCards(DISCUSSION, [1])
    reports(6.95)
    await sendChatMessage(1, 'go on')
    reports(7.04)
    await sendChatMessage(1, 'and then')
    const replies = readChat(1)!.messages.filter((m) => m.role === 'agent')
    near(replies[0]!.costUsd, 0.07)
    near(replies[1]!.costUsd, 0.09)
    assert.equal(replies[1]!.sessionCostUsd, 7.04)
    const ledger = readLedger()!.entries.filter((e) => e.key.startsWith('chat:card-1:'))
    near(ledger[0]!.costUsd, 0.07)
    near(ledger[1]!.costUsd, 0.09)
  })

  it('shows no cost on a fork whose session has no total on record, then carries on', async () => {
    discussion()
    handOffToCards(DISCUSSION, [1])
    reports(6.95)
    await sendChatMessage(1, 'go on')
    reports(7.04)
    await sendChatMessage(1, 'and then')
    const replies = readChat(1)!.messages.filter((m) => m.role === 'agent')
    assert.equal(replies[0]!.costUsd, undefined)
    assert.equal(readLedger()!.entries.find((e) => e.key.startsWith('chat:card-1:'))!.costUsd, undefined)
    near(replies[1]!.costUsd, 0.09)
  })

  it('takes the total as it is when it falls below the last one', async () => {
    reports(3)
    await sendChatMessage(1, 'hi')
    reports(0.2)
    await sendChatMessage(1, 'again')
    const replies = readChat(1)!.messages.filter((m) => m.role === 'agent')
    assert.equal(replies[0]!.costUsd, 3)
    assert.equal(replies[1]!.costUsd, 0.2)
  })

  it('leaves a connector that reports its own cost alone', async () => {
    board('opencode')
    discussion(6.88)
    reports(6.95)
    await sendChatMessage(1, 'hi')
    const reply = readChat(1)!.messages.find((m) => m.role === 'agent')!
    assert.equal(reply.sessionCostUsd, undefined)
  })
})

describe("a run's cost", () => {
  async function start(req: AgentRequest): Promise<RunRecord> {
    const started = await startRun(req)
    if ('error' in started) throw new Error(started.error)
    return started.run
  }

  async function watched(req: AgentRequest, usd: number): Promise<RunRecord> {
    return watch(await start(req), usd)
  }

  async function watch(run: RunRecord, usd: number): Promise<RunRecord> {
    patch(run.sessionId, (r) => { r.pid = process.pid })
    fs.writeFileSync(run.logPath, '')
    reports(usd)
    await watchRun(run.sessionId, async () => ({ error: 'no resume' }))
    return readRuns().find((r) => r.sessionId === run.sessionId)!
  }

  it('forked from a $6.88 create, and resumed after it, each run records its own', async () => {
    const opened = openRun({ action: 'create', description: 'a card' }, 'prompt', [])
    if ('error' in opened) throw new Error(opened.error)
    recordCreatedCards(opened.run.sessionId, [1])
    fs.writeFileSync(peekRun(opened.run.sessionId)!.logPath, 'log\n')
    patch(opened.run.sessionId, (r) => { r.sessionCostUsd = 6.88; r.costUsd = 6.88 })
    await closeRun(opened.run.sessionId, { status: 'done', ok: true, code: 0 })

    const planned = await watched({ action: 'clarify', id: 1 }, 6.95)
    assert.deepEqual(planned.continues?.fork, true)
    near(planned.costUsd, 0.07)
    assert.equal(planned.sessionCostUsd, 6.95)
    near(splitLog(fs.readFileSync(planned.logPath, 'utf8')).costUsd, planned.costUsd!)

    const resolved = await watched({ action: 'resolve', id: 1 }, 7.04)
    assert.equal(resolved.continues?.resumeId, planned.sessionId)
    near(resolved.costUsd, 0.09)
  })

  // A failed run on a session that had spent `from` before it, ending at `total` if it reported one.
  async function failed(from: number | undefined, total: number | undefined): Promise<RunRecord> {
    const opened = openRun({ action: 'clarify', id: 1 }, 'prompt', [])
    if ('error' in opened) throw new Error(opened.error)
    fs.writeFileSync(opened.run.logPath, 'log\n')
    patch(opened.run.sessionId, (r) => {
      r.sessionCostFrom = from
      r.sessionCostUsd = total
      r.costUsd = total === undefined ? undefined : total - (from ?? 0)
    })
    await closeRun(opened.run.sessionId, { status: 'error', ok: false, code: 1 })
    return peekRun(opened.run.sessionId)!
  }

  async function resumed(prev: RunRecord, usd: number): Promise<RunRecord> {
    const opened = await openResume(prev.sessionId)
    if ('error' in opened) throw new Error(opened.error)
    return watch(opened.run, usd)
  }

  const ledgerCost = (run: RunRecord) => readLedger()!.entries.find((e) => e.key === `run:${run.sessionId}`)?.costUsd

  it('resumed after a failure, records only what the resume spent', async () => {
    const prev = await failed(undefined, 2)
    const run = await resumed(prev, 2.5)
    assert.equal(run.resumedFrom, prev.sessionId)
    near(run.costUsd, 0.5)
    assert.equal(run.sessionCostUsd, 2.5)
    near(ledgerCost(run), 0.5)
    near(splitLog(fs.readFileSync(run.logPath, 'utf8')).costUsd, 0.5)
  })

  it('resumed from a run that reported no total, starts where that run started', async () => {
    const prev = await failed(1, undefined)
    const run = await resumed(prev, 2.5)
    near(run.costUsd, 1.5)
    patch(run.sessionId, (r) => { r.status = 'error' })
    const again = await resumed(run, 3)
    near(again.costUsd, 0.5)
  })

  it('said into a discussion, takes off what the discussion had spent', async () => {
    discussion(6.88)
    const run = await watched({ action: 'create', description: 'cards', chat: DISCUSSION }, 7)
    assert.equal(run.chat, DISCUSSION)
    near(run.costUsd, 0.12)
    near(ledgerCost(run), 0.12)
  })

  it('leaves a resumed run on a connector that reports its own cost alone', async () => {
    board('opencode')
    const prev = await failed(undefined, 2)
    const run = await resumed(prev, 2.5)
    assert.equal(run.sessionCostUsd, undefined)
    assert.equal(run.sessionCostFrom, undefined)
  })
})
