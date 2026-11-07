import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'node:test'
import { cloudGoal, cloudGoalWorkflows, queryPreviews } from '../src/commands/goal-cloud'
import { writeSession } from '../src/lib/cloud/session'

const originalEnv = { ...process.env }
const originalFetch = globalThis.fetch
let root: string
let goals: Record<string, unknown>[]
let version: number
let conflict: boolean
let calls: { url: URL; method: string; body: Record<string, unknown> }[]
const catalog = [{ agent: 'ui-designer', title: { en: 'UI design' }, when: 'A full condition.\nWith exceptions.' }, { agent: 'api-designer', title: {}, when: '' }]
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-cloud-'))
  process.env.AI4KANBAN_HOME = root
  process.env.WILDCRANE_HOME = root
  process.env.AI4KANBAN_SUPABASE_URL = 'https://project.test'
  process.env.AI4KANBAN_CLOUD_URL = 'https://api.test'
  process.env.CODEX_THREAD_ID = 'test-thread'
  process.env.CLAUDE_CODE_SESSION_ID = ''
  writeSession({ version: 1, supabaseUrl: 'https://project.test', subject: 'test-account', accessToken: 'test-token', refreshToken: 'test-refresh', expiresAt: Date.now() + 3600_000 })
  goals = []; version = 1; conflict = false; calls = []
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input)); const body = JSON.parse(String(init?.body || '{}'))
    calls.push({ url, method: init?.method || 'GET', body })
    let result: unknown
    if (url.pathname.endsWith('/folders')) result = { folders: [{ path: process.cwd(), project: 'prj_test' }] }
    else if (url.pathname.endsWith('/workflows')) {
      if (url.searchParams.get('workspace') === 'missing') return new Response(JSON.stringify({ error: { message: 'No workspace has this id.' } }), { status: 404 })
      result = { data: [{ id: 'wf_builtin_coding', name: 'Coding', previews: catalog }], next: null }
    } else if (url.pathname.endsWith('/external')) result = { id: 'dsc_test', workspace: 'ws_test', version, goals, ideas: goals }
    else if (url.pathname.endsWith('/draft')) {
      if (conflict) return new Response(JSON.stringify({ error: { message: 'The goals have changed.' } }), { status: 409 })
      goals = (body.goals as Record<string, unknown>[]).map((g, i) => ({ ...g, id: String(g.id).startsWith('new_') ? `idea_${i + 1}` : g.id }))
      result = { id: 'dsc_test', workspace: 'ws_test', version: ++version, goals, ideas: goals }
    } else if (url.pathname.endsWith('/start')) result = { id: 'task_1' }
    else throw new Error(`Unexpected route ${url.pathname}`)
    return new Response(JSON.stringify(result), { status: 200 })
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  for (const key of ['AI4KANBAN_HOME', 'WILDCRANE_HOME', 'AI4KANBAN_SUPABASE_URL', 'AI4KANBAN_CLOUD_URL', 'CODEX_THREAD_ID', 'CLAUDE_CODE_SESSION_ID']) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
  fs.rmSync(root, { recursive: true, force: true })
})
it('外部会话按会话与项目保存，返回 Cloud 目标 id；后续编辑与开始使用同一讨论', async () => {
  const body = path.join(root, 'body.md'); fs.writeFileSync(body, 'Deliver.\n\n## Done when\n- Done')
  const created = await cloudGoal(['new'], { title: 'Goal', bodyFile: body, workflow: 'coding', previews: 'api,ui,ui' })
  assert.equal(created.id, 'idea_1')
  assert.equal(created.url, 'https://app.wildcrane.ai/discussions/dsc_test')
  assert.deepEqual(goals[0].previews, ['ui-designer', 'api-designer'])
  assert.deepEqual(calls.find((c) => c.url.pathname.endsWith('/external'))?.body, { requestId: 'test-thread', host: 'codex', project: 'prj_test' })
  await cloudGoal(['save'], { id: String(created.id), title: 'Updated' })
  assert.deepEqual(goals[0].previews, ['ui-designer', 'api-designer'])
  await cloudGoal(['start'], { id: String(created.id) })
  assert.equal(calls.at(-1)?.url.pathname, '/v1/discussions/dsc_test/goals/idea_1/start')
  assert.equal(calls.at(-1)?.body.expectedVersion, version)
  assert.equal(process.env.KANBAN_GOALS, originalEnv.KANBAN_GOALS)
})
it('外部查询包含完整触发条件，错误不继续写入，支持 Claude Code 的同一入口', async () => {
  assert.equal((await cloudGoalWorkflows()).discussion, 'dsc_test')
  assert.deepEqual((await queryPreviews('coding', 'ws_test')).agents, [{ name: 'ui-designer', when: catalog[0].when }, { name: 'api-designer', when: null }])
  await assert.rejects(queryPreviews('coding', 'missing'), /No workspace/)
  process.env.CLAUDE_CODE_SESSION_ID = 'test-claude'
  await cloudGoalWorkflows()
  assert.deepEqual([...calls].reverse().find((c) => c.url.pathname.endsWith('/external'))?.body, { requestId: 'test-claude', host: 'claude-code', project: 'prj_test' })
  goals = [{ id: 'idea_1', title: 'Goal', workflow: 'wf_builtin_coding', previews: [], task: null }]
  conflict = true
  await assert.rejects(cloudGoal(['save'], { id: 'idea_1', title: 'Changed' }), /goals have changed/)
  assert.equal(goals[0].title, 'Goal')
  assert.equal(process.env.KANBAN_GOALS, originalEnv.KANBAN_GOALS)
})
