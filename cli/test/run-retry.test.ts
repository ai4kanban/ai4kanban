// A failed run with no session to pick up is started again (#1321), and a run whose connector
// this build cannot resume carries on in a new session.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { cmdRuns } from '../src/commands/run.ts'
import { writeSession, type CloudSession } from '../src/lib/cloud/session.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { listRuns, openResume, readSpec } from '../src/lib/agent/sessions.ts'
import { logPathOf, readStore, withStore } from '../src/lib/agent/store.ts'
import type { DeliveryRecord, RunRecord, RunView } from '../src/lib/agent/types.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, restoreMachineHome } from './helpers/board.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'
const realFetch = globalThis.fetch

let root = ''
let home = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

function card(where: 'todo' | '.archive', id: number): void {
  const dir = path.join(kanban(), where)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${id}-thing.md`), `---\ntitle: thing\nstatus: ready\n---\n\nA thing.\n`)
}

/** One ended run in the record, with the log `prune` insists on. */
function run(over: Partial<RunRecord> & { sessionId: string }): RunRecord {
  const logPath = logPathOf(over.sessionId)
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, 'ran\n')
  const record: RunRecord = {
    cardId: 7,
    action: 'resolve',
    status: 'error',
    startedAt: 1,
    endedAt: 2,
    ok: false,
    harness: 'codex',
    logPath,
    ...over,
  }
  withStore((store) => void store.runs.push(record))
  return record
}

function delivery(deliveryId: string, over: Partial<DeliveryRecord> = {}): void {
  withStore((store) => {
    store.deliveries.push({
      deliveryId,
      cardId: 7,
      title: 'thing',
      status: 'active',
      startedAt: 1,
      sessions: [],
      approved: '# thing',
      steps: [{ step: 'implement', at: 1 }],
      ...over,
    } as DeliveryRecord)
  })
}

const view = async (sessionId: string): Promise<RunView> => (await listRuns()).find((r) => r.sessionId === sessionId)!

/** Cloud says this account has Pro, or has not. */
function pro(yes: boolean): void {
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon-key'
  process.env.AI4KANBAN_CLOUD_URL = API
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 60 * 60 * 1000,
    subject: '11111111-1111-4111-8111-111111111111',
    handle: 'someone',
    name: 'Someone',
  } satisfies CloudSession)
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ billing: { plan: yes ? 'pro' : 'free', periodEnd: null } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-run-retry-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-run-retry-home-'))
  process.env.AI4KANBAN_HOME = home
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '8\n')
  forgetMachineState(root)
  setBoardRoot(root)
  card('todo', 7)
})

afterEach(() => {
  globalThis.fetch = realFetch
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

describe('Retry is offered', () => {
  it('on a failed sort', async () => {
    run({ sessionId: 'sort', cardId: null, action: 'triage', harness: 'jev' })
    const r = await view('sort')
    assert.equal(r.canRetry, true)
    assert.equal(r.canResume, false)
  })

  it('on a failed run that never reported a session', async () => {
    run({ sessionId: 'quiet' })
    const r = await view('quiet')
    assert.equal(r.canRetry, true)
    assert.equal(r.canResume, false)
  })

  it('on a run that was cut off', async () => {
    run({ sessionId: 'cut', status: 'interrupted', ok: undefined })
    assert.equal((await view('cut')).canRetry, true)
  })

  // Claude Code takes the board's id, so only the mark says no session was ever opened.
  it('instead of Resume when the agent never started', async () => {
    run({ sessionId: 'absent', harness: 'claude-code', unspawned: true })
    run({ sessionId: 'older', harness: 'claude-code', errorWhy: [{ kind: 'notInstalled', args: { cmd: 'claude', install: 'x' } }] })
    run({ sessionId: 'started', harness: 'claude-code' })
    assert.deepEqual([(await view('absent')).canRetry, (await view('absent')).canResume], [true, false])
    assert.deepEqual([(await view('older')).canRetry, (await view('older')).canResume], [true, false])
    assert.deepEqual([(await view('started')).canRetry, (await view('started')).canResume], [undefined, true])
  })

  it('keeps the mark through a read of the record', () => {
    run({ sessionId: 'kept', unspawned: true, release: 'v2', workflow: 'quick' })
    const [kept] = readStore().runs
    assert.deepEqual([kept.unspawned, kept.release, kept.workflow], [true, 'v2', 'quick'])
  })
})

describe('akb run list', () => {
  it('names the same command for a retry as for a resume, in other words', async () => {
    run({ sessionId: 'quiet-0000' })
    run({ sessionId: 'started-00', harness: 'claude-code' })
    const sink = startCollecting()
    try {
      await cmdRuns({ all: true })
    } finally {
      stopCollecting()
    }
    const said = sink.out.join('\n')
    assert.match(said, /try it again with `akb run resume quiet-00/)
    assert.match(said, /continue it with `akb run resume started-/)
  })
})

describe('Retry is not offered', () => {
  it('on a run the user stopped', async () => {
    run({ sessionId: 'stopped', status: 'stopped', ok: undefined })
    assert.equal((await view('stopped')).canRetry, undefined)
    const res = await openResume('stopped')
    assert.ok('error' in res && res.reason === 'runNoSession')
  })

  it('on a run that finished or is still going', async () => {
    run({ sessionId: 'done', status: 'done', ok: true })
    run({ sessionId: 'going', cardId: null, action: 'setup', status: 'running', endedAt: undefined, pid: process.pid })
    assert.equal((await view('done')).canRetry, undefined)
    assert.equal((await view('going')).canRetry, undefined)
  })

  it('on a run said into a conversation, or one that is already a resume', async () => {
    run({ sessionId: 'said', cardId: null, action: 'create', input: 'a thing', chat: 'discussion-1' })
    run({ sessionId: 'resumed', resumedFrom: 'earlier' })
    assert.equal((await view('said')).canRetry, undefined)
    assert.equal((await view('resumed')).canRetry, undefined)
  })

  // The work is done and only its format is owed — unless the agent never started at all.
  it('on a run waiting for a format repair', async () => {
    const formatRepair = { attempt: 0, errors: 'bad', cardIds: [7], changedIds: [], existingIds: [7] }
    run({ sessionId: 'repair', formatRepair })
    run({ sessionId: 'absent', formatRepair, unspawned: true })
    assert.equal((await view('repair')).canRetry, undefined)
    assert.equal((await view('absent')).canRetry, true)
  })

  it('on a create whose requirement the record does not hold', async () => {
    run({ sessionId: 'planned', cardId: null, action: 'create' })
    run({ sessionId: 'typed', cardId: null, action: 'create', input: 'a thing' })
    assert.equal((await view('planned')).canRetry, undefined)
    assert.equal((await view('typed')).canRetry, true)
  })

  it('once the card has left the board', async () => {
    run({ sessionId: 'gone', cardId: 99 })
    assert.equal((await view('gone')).canRetry, undefined)
    const res = await openResume('gone')
    assert.ok('error' in res)
    assert.match(res.error, /has left the board/)
  })

  it('on a run of a delivery that can no longer be carried on', async () => {
    delivery('ended111', { status: 'cancelled', endedAt: 2 })
    run({ sessionId: 'cancelled', action: 'implement', deliveryId: 'ended111' })
    assert.equal((await view('cancelled')).canRetry, undefined)
    const res = await openResume('cancelled')
    assert.ok('error' in res)
    assert.match(res.error, /was cancelled/)
  })
})

describe('retrying', () => {
  it('starts the same ask again in a new session, in place of the failed run', async () => {
    run({ sessionId: 'quiet', input: 'mind the edge case', flowId: 'flow-1' })
    const res = await openResume('quiet')
    assert.ok(!('error' in res), 'error' in res ? res.error : '')
    const { run: next } = res
    assert.equal(next.action, 'resolve')
    assert.equal(next.cardId, 7)
    assert.equal(next.input, 'mind the edge case')
    assert.equal(next.harness, 'codex')
    assert.equal(next.resumedFrom, undefined)
    assert.equal(next.flowId, 'flow-1')
    const prompt = readSpec(next.sessionId)?.prompt ?? ''
    assert.match(prompt, /open questions on task 7/)
    assert.match(prompt, /Extra notes: mind the edge case/)
    assert.deepEqual(readStore().runs.map((r) => r.sessionId), [next.sessionId])
    assert.equal(fs.existsSync(logPathOf('quiet')), false)
  })

  // One that fails the same way is offered Retry again: nothing marks it a resume.
  it('can be retried again', async () => {
    run({ sessionId: 'quiet' })
    const res = await openResume('quiet')
    assert.ok(!('error' in res))
    fs.writeFileSync(res.run.logPath, 'ran\n')
    withStore((store) => {
      const again = store.runs.find((r) => r.sessionId === res.run.sessionId)!
      again.status = 'error'
      again.endedAt = Date.now()
      again.pid = undefined
    })
    assert.equal((await view(res.run.sessionId)).canRetry, true)
  })

  it('carries a delivery on rather than opening another', async () => {
    delivery('build111', { sessions: ['build'] })
    run({ sessionId: 'build', action: 'implement', deliveryId: 'build111', unspawned: true, harness: 'claude-code' })
    assert.equal((await view('build')).canRetry, true)
    const res = await openResume('build')
    assert.ok(!('error' in res), 'error' in res ? res.error : '')
    assert.equal(res.run.deliveryId, 'build111')
    assert.equal(res.run.resumedFrom, undefined)
    assert.match(readSpec(res.run.sessionId)?.prompt ?? '', /Implement task 7/)
    const store = readStore()
    assert.equal(store.deliveries.length, 1)
    assert.ok(store.deliveries[0]!.sessions.includes(res.run.sessionId))
  })

  it('starts a sort again where the account may sort', async () => {
    pro(true)
    run({ sessionId: 'sort', cardId: null, action: 'triage', harness: 'jev' })
    const res = await openResume('sort')
    assert.ok(!('error' in res), 'error' in res ? res.error : '')
    assert.equal(res.run.action, 'triage')
    assert.equal(res.run.harness, 'jev')
    assert.deepEqual(readStore().runs.map((r) => r.sessionId), [res.run.sessionId])
  })

  it('refuses a sort where it may not, and leaves the failed run as it was', async () => {
    pro(false)
    run({ sessionId: 'sort', cardId: null, action: 'triage', harness: 'jev' })
    const res = await openResume('sort')
    assert.ok('error' in res && res.reason === 'sortUnavailable')
    assert.deepEqual(readStore().runs.map((r) => r.sessionId), ['sort'])
  })
})

describe('a run whose connector this build no longer ships', () => {
  const lost = (over: Partial<RunRecord> = {}): RunRecord =>
    run({ sessionId: 'lost', action: 'implement', harness: 'retired-cli', resumeId: 'their-id', agent: 'builder', ...over })

  it('still offers Resume, where its ask can be said again', async () => {
    lost()
    run({ sessionId: 'revise', action: 'edit', harness: 'retired-cli', resumeId: 'their-id' })
    assert.deepEqual([(await view('lost')).canResume, (await view('lost')).canRetry], [true, undefined])
    assert.equal((await view('revise')).canResume, false)
    const res = await openResume('revise')
    assert.ok('error' in res && res.reason === 'runForeign')
  })

  it('carries a delivery on in its worktree, in a new session', async () => {
    const worktree = path.join(root, '.akb', 'worktrees', '7', 'wt111111')
    fs.mkdirSync(worktree, { recursive: true })
    delivery('wt111111', { sessions: ['lost'], worktree, branch: 'card/7/wt111111' })
    lost({ deliveryId: 'wt111111' })
    const res = await openResume('lost')
    assert.ok(!('error' in res), 'error' in res ? res.error : '')
    assert.equal(res.run.cwd, worktree)
    assert.notEqual(res.run.harness, 'retired-cli')
    assert.equal(res.run.resumedFrom, 'lost')
    assert.equal(res.run.deliveryId, 'wt111111')
    assert.match(readSpec(res.run.sessionId)?.prompt ?? '', /Continue delivery wt111111/)
  })

  it('carries a delivery with no worktree on in the project', async () => {
    delivery('flat1111', { sessions: ['lost'] })
    lost({ deliveryId: 'flat1111' })
    const res = await openResume('lost')
    assert.ok(!('error' in res), 'error' in res ? res.error : '')
    assert.equal(fs.realpathSync(res.run.cwd!), fs.realpathSync(root))
    assert.equal(res.run.deliveryId, 'flat1111')
    assert.match(readSpec(res.run.sessionId)?.prompt ?? '', /Continue delivery flat1111/)
  })

  it('does a card run again from the top where there is no delivery', async () => {
    lost({ action: 'resolve' })
    const res = await openResume('lost')
    assert.ok(!('error' in res), 'error' in res ? res.error : '')
    const prompt = readSpec(res.run.sessionId)?.prompt ?? ''
    assert.match(prompt, /The session you were continuing is gone/)
    assert.match(prompt, /open questions on task 7/)
  })
})
