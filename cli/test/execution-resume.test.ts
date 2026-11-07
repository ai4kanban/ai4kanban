import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'node:test'
import { resumeDelivery } from '../src/lib/agent/sessions.ts'
import { readStore, withStore } from '../src/lib/agent/store.ts'
import { cloudEndpoints } from '../src/lib/cloud/config.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState } from './helpers/board.ts'

const old = { job: '11111111-1111-4111-8111-111111111111', machine: '22222222-2222-4222-8222-222222222222' }
const next = { ...old, job: '33333333-3333-4333-8333-333333333333' }
const env = { home: process.env.AI4KANBAN_HOME, execution: process.env.AI4KANBAN_EXECUTION }
const fetchBefore = globalThis.fetch
let root: string
let home: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-resume-lease-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-resume-auth-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_EXECUTION = JSON.stringify(next)
  setBoardRoot(root)
  writeSession({ version: 1, supabaseUrl: cloudEndpoints().supabaseUrl, accessToken: 'test', refreshToken: 'test', expiresAt: Date.now() + 3600000, subject: 'test' })
  withStore((store) => store.deliveries.push({ deliveryId: 'built', cardId: null, title: 'Build', status: 'active', startedAt: 1, sessions: ['original'], steps: [], approved: 'Build', cloudExecution: old,
    landing: { status: 'waiting', attempts: 1, at: 1, why: '无法确认执行权，已保留本地交付。' } }))
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).endsWith(`/jobs/${next.job}/renew`))
    assert.deepEqual(JSON.parse(String(init?.body)), { machineId: next.machine })
    return new Response(JSON.stringify({ renewed: true, stop: false }), { status: 200 })
  }
})

afterEach(() => {
  globalThis.fetch = fetchBefore
  if (env.home === undefined) delete process.env.AI4KANBAN_HOME
  else process.env.AI4KANBAN_HOME = env.home
  if (env.execution === undefined) delete process.env.AI4KANBAN_EXECUTION
  else process.env.AI4KANBAN_EXECUTION = env.execution
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true })
})

it('attaches a verified new execution to the existing built delivery without rebuilding', async () => {
  const result = await resumeDelivery('built')
  assert.equal(result.ok, true, result.error)
  assert.equal(result.carryOn, 'build')
  const store = readStore()
  assert.equal(store.runs.length, 0)
  assert.equal(store.deliveries.length, 1)
  assert.deepEqual(store.deliveries[0]!.cloudExecution, next)
  assert.deepEqual(store.deliveries[0]!.sessions, ['original'])
  assert.equal(store.deliveries[0]!.landing?.why, '无法确认执行权，已保留本地交付。')
})

it('keeps the previous execution when the new lease is lost, stopped or unreachable', async () => {
  for (const response of [{ renewed: false }, { renewed: true, stop: true }, null]) {
    globalThis.fetch = async () => { if (!response) throw new Error('offline'); return new Response(JSON.stringify(response)) }
    assert.equal((await resumeDelivery('built')).ok, false)
    assert.deepEqual(readStore().deliveries[0]!.cloudExecution, old)
    assert.equal(readStore().deliveries[0]!.steps.length, 0)
  }
})

it('refuses to take over a delivery whose agent is still running', async () => {
  withStore((store) => store.runs.push({ sessionId: 'live', cardId: null, action: 'implement', status: 'running', startedAt: Date.now(), pid: process.pid, harness: 'codex', logPath: path.join(root, 'live.log'), deliveryId: 'built' }))
  assert.equal((await resumeDelivery('built')).reason, 'deliveryRunGoing')
  assert.deepEqual(readStore().deliveries[0]!.cloudExecution, old)
})
