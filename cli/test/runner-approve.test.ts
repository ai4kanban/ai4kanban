// A Runner's board is approved as the web approves it (#59): Cloud decides, nothing runs here.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import { RUN_ENV } from '../src/lib/agent/env.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { readRuns } from '../src/lib/agent/store.ts'
import { restoreMachineHome, run } from './helpers/board.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-runner-approve-'))
const board = path.join(root, '.akb', 'kanban')
const realFetch = globalThis.fetch

let home = ''
let sent: { route: string; method: string; body: Record<string, unknown> | null }[] = []

function serve(refuse?: { status: number; code: string; message: string }): void {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (!String(url).startsWith(API)) return Response.json({})
    const route = String(url).slice(API.length)
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
    sent.push({ route, method: init?.method ?? 'GET', body })
    if (route === '/v1/projects/prj_1') return Response.json({ id: 'prj_1', prefix: 'WC' })
    if (route === '/v1/tasks/WC-3' && !body) return Response.json({ id: 'task_3', key: 'WC-3', review: { revision: 4 } })
    if (route === '/v1/tasks/WC-3/decisions') {
      if (refuse) return Response.json({ error: { code: refuse.code, message: refuse.message } }, { status: refuse.status })
      return Response.json({ id: 'dec_1' }, { status: 201 })
    }
    throw new Error(`unexpected ${init?.method ?? 'GET'} ${route}`)
  }) as typeof fetch
}

beforeEach(() => {
  delete process.env[RUN_ENV]
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-runner-approve-home-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_CLOUD_URL = API
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 60 * 60 * 1000,
    subject: '11111111-1111-4111-8111-111111111111',
  })
  fs.rmSync(path.join(root, '.akb'), { recursive: true, force: true })
  fs.mkdirSync(path.join(board, 'todo'), { recursive: true })
  fs.writeFileSync(path.join(board, 'config.md'), '# Config\n')
  fs.writeFileSync(path.join(board, 'todo', '3-pricing.md'), '---\ntitle: Pricing\nstatus: in-review\nquestions: []\n---\n\nPlan.\n')
  fs.writeFileSync(path.join(root, '.akb', 'base.json'), JSON.stringify({ layout: 'workspace', head_seq: 1, files: { 'projects/prj_1/todo/3-pricing.md': { seq: 1, content: '' } } }))
  sent = []
  serve()
})

afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_CLOUD_URL
  fs.rmSync(home, { recursive: true, force: true })
  restoreMachineHome()
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

describe('card approve on a Runner board', () => {
  it('decides in Cloud on the review it reads, and starts no run here', async () => {
    await run(root, ['card', 'approve', '3', '--board', board])
    const post = sent.find((s) => s.method === 'POST')!
    assert.equal(post.route, '/v1/tasks/WC-3/decisions')
    assert.deepEqual(post.body, { decision: 'approve', review_revision: 4 })
    assert.equal(readRuns().length, 0)
  })

  it('a refusal says what Cloud said', async () => {
    serve({ status: 409, code: 'conflict', message: 'A step is already running.' })
    await assert.rejects(() => run(root, ['card', 'approve', '3', '--board', board]), /Cloud did not approve #3: A step is already running\./)
  })
})
