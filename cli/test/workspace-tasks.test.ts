// A Runner workspace's new cards are Cloud tasks (#2063): numbered by Cloud, linked to the task
// the job works for, written under the new task's id, and never made twice by a retry.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, afterEach, beforeEach, describe, it } from 'node:test'

import { RUN_ENV } from '../src/lib/agent/env.ts'
import { TASK_ENV } from '../src/lib/cloud/tasks.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, refuses, restoreMachineHome, run } from './helpers/board.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-workspace-tasks-'))
const kanban = path.join(root, 'docs', 'kanban')
const todo = path.join(kanban, 'todo')
const realFetch = globalThis.fetch

let home = ''
let sent: { route: string; method: string; body: Record<string, unknown> | null; key: string | null }[] = []
let made: Record<string, string> = {}

/** Cloud as far as these commands reach it: the source task, and creates kept by their key. */
function serve(refuse?: { status: number; code: string; message: string }): void {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const route = String(url).slice(API.length)
    const headers = (init?.headers ?? {}) as Record<string, string>
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
    sent.push({ route, method: init?.method ?? 'GET', body, key: headers['idempotency-key'] ?? null })
    if (route === '/v1/tasks/task_src') {
      return Response.json({ id: 'task_src', key: 'WC-3', project: 'prj_1', workflow: { id: 'wf_builtin_coding' } })
    }
    if (route === '/v1/tasks' && init?.method === 'POST') {
      if (refuse) return Response.json({ error: { code: refuse.code, message: refuse.message } }, { status: refuse.status })
      const key = headers['idempotency-key']!
      const replayed = key in made
      made[key] ??= `task_${(Object.keys(made).length + 0xa1).toString(16)}`
      const id = made[key]!
      return Response.json({ id, key: `WC-${12 + Object.values(made).indexOf(id)}`, project: 'prj_1', workflow: { id: 'wf_builtin_coding' } }, {
        status: 201,
        headers: replayed ? { 'idempotent-replayed': 'true' } : {},
      })
    }
    throw new Error(`unexpected ${init?.method ?? 'GET'} ${route}`)
  }) as typeof fetch
}

beforeEach(() => {
  delete process.env[RUN_ENV]
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-workspace-home-'))
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
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  forgetMachineState(root)
  fs.mkdirSync(todo, { recursive: true })
  setBoardRoot(root)
  sent = []
  made = {}
  serve()
})

afterEach(() => {
  globalThis.fetch = realFetch
  delete process.env[TASK_ENV]
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_CLOUD_URL
  fs.rmSync(home, { recursive: true, force: true })
  restoreMachineHome()
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

const create = (argv: string[]) => move(root, ['create', ...argv])

describe('raw create --id', () => {
  it('takes the number it is given', async () => {
    const out = await create(['--title', 'Own card', '--slug', 'task_1', '--id', '9'])
    assert.equal(out.id, 9)
    assert.ok(fs.existsSync(path.join(todo, '9-task-1.md')))
    assert.equal(sent.length, 0, 'a card for a task Cloud already has went to Cloud')
  })

  it('refuses a number another card holds', async () => {
    await create(['--title', 'Old', '--slug', 'old', '--id', '5'])
    await refuses(root, ['create', '--title', 'Own card', '--slug', 'task_1', '--id', '5'], /#5 is already a card here/)
  })
})

describe('in a Runner workspace', () => {
  beforeEach(() => (process.env[TASK_ENV] = 'task_src'))

  it('makes the card a Cloud task of the same project, numbered by Cloud and linked back', async () => {
    const body = path.join(root, 'body.md')
    fs.writeFileSync(body, 'Offer yearly billing.\n')
    const out = await create(['--title', 'Annual plan', '--body-file', body])
    assert.equal(out.id, 12)
    const post = sent.find((s) => s.method === 'POST')!
    assert.deepEqual(post.body, {
      title: 'Annual plan',
      project: 'prj_1',
      workflow: 'wf_builtin_coding',
      request: 'Offer yearly billing.',
      source: 'api',
      source_context: { task: 'task_src' },
    })
    assert.match(post.key!, /^akb-[0-9a-f]{40}$/)
    const card = fs.readFileSync(path.join(todo, '12-annual-plan.md'), 'utf8')
    assert.match(card, /source:\n {2}- WC-3\n/)
    assert.match(card, /Offer yearly billing\./)
  })

  it('names the triage item it is made of by its file, for Cloud to move (#2107)', async () => {
    fs.mkdirSync(path.join(kanban, 'triage', 'dismissed'), { recursive: true })
    const item = (title: string) => `---\nsource_id: derived-${title.length}\ntitle: ${title}\ncollected_at: 2026-10-26 09:00\nimported_at: 2026-10-26 09:00\n---\n\nWords.\n`
    fs.writeFileSync(path.join(kanban, 'triage', 'dark-mode.md'), item('Dark mode'))
    fs.writeFileSync(path.join(kanban, 'triage', 'dismissed', 'sso.md'), item('SSO'))
    await create(['--title', 'Dark mode', '--triage', 'derived-9'])
    assert.equal(sent.find((s) => s.method === 'POST')!.body!.triage, 'tri_1_dark-mode')
    await create(['--title', 'SSO', '--triage', 'derived-3'])
    assert.equal(sent.filter((s) => s.method === 'POST')[1]!.body!.triage, 'tri_1_sso', 'one not open is Cloud’s to refuse')
    await refuses(root, ['create', '--title', 'Gone', '--triage', 'derived-0'], /nothing in triage is derived-0/)
  })

  it('a retry answers the card already written', async () => {
    await create(['--title', 'Annual plan'])
    const again = await create(['--title', 'Annual plan'])
    assert.equal(again.id, 12)
    assert.equal(Object.keys(made).length, 1)
    assert.equal(fs.readdirSync(todo).filter((f) => f.endsWith('.md') && f !== 'README.md').length, 1)
  })

  it('a scheduled card runs in Cloud and is written by its own job, with its fields', async () => {
    const out = await create(['--title', 'Annual plan', '--schedule', 'refine', '--priority', 'high', '--roi', 'low',
      '--modules', 'web,cli', '--related', '3', '--blocked-by', '#4'])
    assert.equal(out.key, 'WC-12')
    const post = sent.find((s) => s.method === 'POST')!.body!
    assert.equal(post.run, true)
    assert.deepEqual(post.metadata, { priority: 'high', roi: 'low', modules: ['web', 'cli'], related: ['3'], blocked_by: ['4'] })
    assert.ok(!fs.readdirSync(todo).some((f) => f.startsWith('12-')))
  })

  it('a refusal writes nothing', async () => {
    serve({ status: 403, code: 'forbidden', message: 'Only members may make tasks here.' })
    await refuses(root, ['create', '--title', 'Annual plan'], /Cloud did not make the task: Only members may make tasks here\./)
    assert.ok(!fs.readdirSync(todo).some((f) => /^\d+-/.test(f)))
  })

  it('create --from-card hands the follow-up to Cloud to run, and starts nothing here', async () => {
    await create(['--title', 'Pricing page', '--slug', 'task_src', '--id', '3'])
    await run(root, ['create', '--from-card', '3', 'split', 'the', 'annual', 'plan', 'off'])
    const post = sent.find((s) => s.method === 'POST')!
    assert.deepEqual(post.body, {
      title: 'split the annual plan off',
      project: 'prj_1',
      workflow: 'wf_builtin_coding',
      request: 'split the annual plan off',
      source: 'api',
      source_context: { task: 'task_src' },
      run: true,
    })
    assert.ok(!fs.readdirSync(todo).some((f) => f.startsWith('12-')))
  })
})
