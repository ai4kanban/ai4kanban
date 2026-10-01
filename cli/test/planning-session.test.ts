// A card's planning carries its session on (#1304): the planning after a create forks the
// session the card was created in, and the planning after an answer resumes the one that asked.
// Anything else — no session, another CLI, one that cannot fork — opens a new session as before,
// and a session that turns out to be gone has its step started again in a new one. The run's
// log opens by saying which of these it was (#1309).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { handOff } from '../src/lib/agent/chat.ts'
import { harnessLabel } from '../src/lib/agent/resolve.ts'
import { closeRun, openRun, patch, peekRun, readSpec, resumeSessionId } from '../src/lib/agent/sessions.ts'
import { startRun } from '../src/lib/agent/start.ts'
import { readRuns, recordCreatedCards } from '../src/lib/agent/store.ts'
import type { AgentRequest, RunRecord } from '../src/lib/agent/types.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { REPO_ROOT, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, uiConfigOf } from './helpers/board.ts'

let root = ''

// A stand-in CLI: it finishes cleanly, or — told to — answers a resume the way Claude Code
// answers one for a session it no longer holds.
function board(harness = 'claude-code', lost = false): void {
  const file = path.join(root, 'agent.mjs')
  fs.writeFileSync(
    file,
    `const args = process.argv.slice(2)
if (${lost} && args.includes('--resume')) {
  console.log(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, errors: ['No conversation found with session ID: x'] }))
  process.exit(1)
}
console.log(JSON.stringify({ type: 'result', result: 'Done' }))
`,
  )
  fs.writeFileSync(
    uiConfigOf(root, 'docs', 'kanban'),
    JSON.stringify({ runtimes: [{ id: 'global', name: 'Global default', harness, settings: { command: `node ${file}` } }] }),
  )
}

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-planning-session-'))
  forgetMachineState(root)
  setBoardRoot(root)
  setBoardProvider(null)
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '1\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'README.md'), '# Tasks\n')
  board()
  await move(root, ['create', '--title', 'Card one'])
  await move(root, ['create', '--title', 'Card two'])
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

async function end(sessionId: string): Promise<void> {
  // A finished record with no log is pruned out of the store.
  fs.writeFileSync(peekRun(sessionId)!.logPath, 'log\n')
  await closeRun(sessionId, { status: 'done', ok: true, code: 0 })
}

/** A finished create run that wrote `cards`. `resumeId` is the id a CLI that mints its own reported. */
async function created(cards: number[], resumeId?: string): Promise<string> {
  const opened = openRun({ action: 'create', description: 'two cards' }, 'prompt', [])
  if ('error' in opened) throw new Error(opened.error)
  recordCreatedCards(opened.run.sessionId, cards)
  if (resumeId) patch(opened.run.sessionId, (r) => { r.resumeId = resumeId })
  await end(opened.run.sessionId)
  return opened.run.sessionId
}

async function start(req: AgentRequest): Promise<RunRecord> {
  const started = await startRun(req)
  if ('error' in started) throw new Error(started.error)
  return started.run
}

/** The lines the run's log opens with, as `[board] <note>`. */
const notes = (run: RunRecord): string[] => readSpec(run.sessionId)!.notes ?? []

const after = (argv: string[] | undefined, flag: string): string | undefined => argv?.[(argv?.indexOf(flag) ?? -1) + 1]

describe('the planning after a create', () => {
  it('forks the session the card was created in', async () => {
    const create = await created([1, 2])
    const run = await start({ action: 'clarify', id: 1, title: 'Card one' })
    assert.ok(run.argv?.includes('--fork-session'))
    assert.equal(after(run.argv, '--resume'), create)
    assert.equal(after(run.argv, '--session-id'), run.sessionId)
    assert.deepEqual(run.continues, { resumeId: create, fork: true })
    assert.equal(resumeSessionId(run), run.sessionId)
    assert.deepEqual(notes(run), ['started from a copy of the session this card was created in'])
    const prompt = readSpec(run.sessionId)!.prompt
    assert.match(prompt, /Plan task 1/)
    assert.match(prompt, /copy of the one this card was created in.*outranks what you remember/)
  })

  it('forks once for each card one create wrote, side by side', async () => {
    const create = await created([1, 2])
    const one = await start({ action: 'clarify', id: 1 })
    const two = await start({ action: 'clarify', id: 2 })
    for (const run of [one, two]) {
      assert.equal(run.status, 'running')
      assert.deepEqual(run.continues, { resumeId: create, fork: true })
    }
    assert.notEqual(after(one.argv, '--session-id'), after(two.argv, '--session-id'))
  })

  it('forks the session a card names when no create run wrote it', async () => {
    handOff({ harness: 'claude-code', resumeId: 'terminal-session', cwd: REPO_ROOT }, [1])
    handOff({ harness: 'claude-code', resumeId: 'elsewhere', cwd: os.tmpdir() }, [2])
    const one = await start({ action: 'clarify', id: 1 })
    assert.deepEqual(one.continues, { resumeId: 'terminal-session', fork: true })
    // A session opened in another folder is not one its CLI would find from here.
    const two = await start({ action: 'clarify', id: 2 })
    assert.equal(two.continues, undefined)
    assert.ok(!two.argv?.includes('--resume'))
    assert.deepEqual(notes(two), ['new session — the earlier session was opened in another folder'])
  })
})

describe('the planning after an answer', () => {
  it('resumes the session that asked, round after round', async () => {
    await created([1])
    const planned = await start({ action: 'clarify', id: 1 })
    await end(planned.sessionId)
    const first = await start({ action: 'resolve', id: 1, title: 'Card one' })
    assert.equal(after(first.argv, '--resume'), planned.sessionId)
    assert.ok(!first.argv?.includes('--fork-session') && !first.argv?.includes('--session-id'))
    assert.deepEqual(first.continues, { resumeId: planned.sessionId })
    assert.equal(resumeSessionId(first), planned.sessionId)
    assert.deepEqual(notes(first), ['continuing the session this card was last planned in'])
    assert.match(readSpec(first.sessionId)!.prompt, /Apply my answers.*planned this card before.*outranks what you remember/)
    await end(first.sessionId)
    const second = await start({ action: 'resolve', id: 1 })
    assert.equal(after(second.argv, '--resume'), planned.sessionId)
  })
})

describe('a new session, as before', () => {
  it('when the card has no session to carry on', async () => {
    const run = await start({ action: 'clarify', id: 1 })
    assert.equal(run.continues, undefined)
    assert.equal(after(run.argv, '--session-id'), run.sessionId)
    assert.deepEqual(notes(run), ['new session — no earlier session of this card is on record'])
    assert.doesNotMatch(readSpec(run.sessionId)!.prompt, /outranks/)
  })

  it('when this step runs on another CLI than the session', async () => {
    await created([1])
    board('codex')
    const run = await start({ action: 'clarify', id: 1 })
    assert.equal(run.harness, 'codex')
    assert.equal(run.continues, undefined)
    assert.ok(!run.argv?.includes('fork'))
    assert.deepEqual(notes(run), ['new session — the earlier session was held by Claude Code, and this step runs on Codex'])
  })

  it('when the CLI cannot fork', async () => {
    board('kimi')
    await created([1], 'kimi-session')
    const run = await start({ action: 'clarify', id: 1 })
    assert.equal(run.harness, 'kimi')
    assert.equal(run.continues, undefined)
    assert.deepEqual(notes(run), [`new session — ${harnessLabel('kimi')} cannot copy a session`])
    // It still resumes: the planning after an answer carries on.
    await end(run.sessionId)
    patch(run.sessionId, (r) => { r.resumeId = 'kimi-planning' })
    const answered = await start({ action: 'resolve', id: 1 })
    assert.deepEqual(answered.continues, { resumeId: 'kimi-planning' })
    assert.equal(resumeSessionId(answered), 'kimi-planning')
  })

  it('for a revise and a spec agent', async () => {
    await created([1])
    const planned = await start({ action: 'clarify', id: 1 })
    await end(planned.sessionId)
    for (const req of [{ action: 'edit', id: 1, notes: 'x' }, { action: 'spec', id: 1, specAgent: 'ui-designer' }] as AgentRequest[]) {
      const run = await start(req)
      assert.equal(run.continues, undefined)
      assert.ok(!run.argv?.includes('--resume'))
      assert.deepEqual(notes(run), [])
      await end(run.sessionId)
    }
  })
})

describe('a session that turns out to be gone', () => {
  it('has its step started again in a new session, and leaves one row', async () => {
    board('claude-code', true)
    await created([1])
    const planned = await start({ action: 'clarify', id: 1 })
    await end(planned.sessionId)
    const lost = await start({ action: 'resolve', id: 1, title: 'Card one', notes: 'keep it small' })
    patch(lost.sessionId, (r) => { r.pid = process.pid })
    fs.writeFileSync(lost.logPath, '')
    await watchRun(lost.sessionId, async () => ({ error: 'no resume' }))

    assert.equal(peekRun(lost.sessionId), undefined)
    assert.ok(!fs.existsSync(lost.logPath))
    const again = readRuns().filter((r) => r.cardId === 1 && r.action === 'resolve')
    assert.equal(again.length, 1)
    const [run] = again
    assert.equal(run!.status, 'running')
    assert.equal(run!.continues, undefined)
    assert.equal(run!.flowId, lost.flowId)
    assert.equal(run!.input, 'keep it small')
    assert.ok(!run!.argv?.includes('--resume'))
    const spec = readSpec(run!.sessionId)!
    assert.deepEqual(spec.notes, ['new session — the earlier one is gone, so this step was started again'])
    assert.doesNotMatch(spec.prompt, /outranks/)
  })

  it('stays a failure when the agent had started working', async () => {
    await created([1])
    const planned = await start({ action: 'clarify', id: 1 })
    await end(planned.sessionId)
    fs.writeFileSync(
      path.join(root, 'agent.mjs'),
      `console.log(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, errors: ['boom'], usage: { input_tokens: 10, output_tokens: 5 } }))
process.exit(1)
`,
    )
    const failed = await start({ action: 'resolve', id: 1 })
    patch(failed.sessionId, (r) => { r.pid = process.pid })
    fs.writeFileSync(failed.logPath, '')
    await watchRun(failed.sessionId, async () => ({ error: 'no resume' }))
    assert.equal(peekRun(failed.sessionId)?.status, 'error')
    assert.equal(readRuns().filter((r) => r.cardId === 1 && r.status === 'running').length, 0)
  })
})
