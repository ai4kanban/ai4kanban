import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'wildcrane',
  component: 'Pane',
  requestId: 'wildcrane',
  props: { title: 'WildCrane', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const FOLDER = { project: 'prj_1', name: 'ai4kanban', dir: '~/git/ai4kanban', board: 'https://app.wildcrane.ai/projects/prj_1' }
const IDEA = { id: 'idea_1', title: 'Copy a run log as Markdown', outcome: 'Add **Copy**.', acceptance: ['The button reads Copied'], workflow: 'wf_builtin_coding', task: null }
const WORKFLOWS = [{ id: 'wf_builtin_coding', name: 'Coding', names: { en: 'Coding', zh: '软件开发' }, description: '' }]

/** The plugin's MCP server, as the panel's tool answers: `answers` by action, each call recorded. */
function host(on: On, answers: Record<string, unknown>, lang = 'en') {
  const calls: Record<string, unknown>[] = []
  on('mcp.connect', () => ({ value: { isConnected: true, server: 'plugin:wildcrane:wildcrane' } }))
  on('mcp.call', (_$, e) => {
    calls.push(e.args)
    return { value: { content: [{ type: 'text', text: JSON.stringify(answers[String(e.args.action)] ?? {}) }], isError: false } }
  })
  on('fs.read', () => ({ value: 'key' }))
  on('env.get', (_$, e) => ({ value: e.name === 'HOME' ? '/Users/me' : undefined }))
  on('settings.read', () => ({ value: { language: lang } }))
  on('session.id', () => ({ value: 'sess-1' }))
  on('session.cwd', () => ({ value: '/Users/me/git/ai4kanban' }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', () => ({ value: { command: 'wildcrane' } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  return { calls }
}

const SIGNED_IN = { dir: '~/git/ai4kanban', signedIn: true, account: { name: 'Lin Chen', email: 'lin@acme.dev' }, folder: FOLDER, projects: [FOLDER] }
const EMPTY = { discussion: 'dsc_1', version: 1, ideas: [], workflows: WORKFLOWS }

test('登录入口统一打开运行电脑设置', async ($, on) => {
  const fake = host(on, { state: { signedIn: false } }, '中文')
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'settings' })).toBeDefined()
  expect(await ui.find({ key: 'sign-in' })).toBeUndefined()
  await ui.press({ key: 'settings' })
  expect(fake.calls.some((c) => c.action === 'openSettings' && c.cwd === '/Users/me/git/ai4kanban')).toBe(true)
  await ui.unmount()
})

test('项目页保留网页入口，目录和工具配置统一放入设置页', async ($, on) => {
  host(on, { state: SIGNED_IN })
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: 'ai4kanban' })).toBeDefined()
  expect(await ui.find({ key: 'settings' })).toBeDefined()
  for (const key of ['new-project', 'sign-out', 'tab-agents', 'remove-prj_1']) expect(await ui.find({ key })).toBeUndefined()
  await ui.unmount()
})

test('默认项目页无目标内容，重新打开和切换会话也不读取讨论', async ($, on) => {
  const fake = host(on, { state: SIGNED_IN, discussion: { ...EMPTY, ideas: [IDEA] } })
  on('classic.SessionStart', () => ({}))
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'tab-ideas' })).toBeUndefined()
    expect(await ui.find({ key: 'tab-goals' })).toBeUndefined()
    expect(await ui.find({ text: /Copy a run log/ })).toBeUndefined()
    expect((await ui.find({ key: 'tab-projects' }))?.props.dimColor).toBe(false)
    expect(await ui.find({ key: 'settings' })).toBeDefined()
    await ui.unmount()
  }
  await $.classic.SessionStart({ source: 'clear', session_id: 'sess-2', cwd: '/Users/me/git/ai4kanban' } as never)
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  expect(fake.calls.some((c) => ['discussion', 'workflow', 'discard', 'start'].includes(String(c.action)))).toBe(false)
})

const PROJECTS = SIGNED_IN
async function onProjects($: Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[0], surface: 'terminal' | 'desktop' = 'desktop') {
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface })
  await ui.press({ key: 'tab-projects' })
  return ui
}

test('an outdated Runner shows the update commands above every tab', async ($, on) => {
  host(on, { discussion: EMPTY, state: { ...PROJECTS, runner: 'outdated' }, tasks: { tasks: [] } }, 'zh')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await onProjects($, surface)
    expect(await ui.find({ text: /插件版本过旧/ })).toBeDefined()
    expect(await ui.find({ type: 'Code', text: /claude plugin update wildcrane@wildcrane/ })).toBeDefined()
    await ui.press({ key: 'tab-tasks' })
    expect(await ui.find({ text: /插件版本过旧/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a running Runner shows no update notice', async ($, on) => {
  host(on, { discussion: EMPTY, state: { ...PROJECTS, runner: 'running', plugin: { version: '0.1.4', latest: null } } })
  const ui = await onProjects($)
  expect(await ui.find({ text: /^v0\.1\.4$/ })).toBeDefined()
  expect(await ui.find({ text: /out of date|is available/ })).toBeUndefined()
  expect(await ui.find({ type: 'Code' })).toBeUndefined()
  await ui.unmount()
})

test('a newer release shows the version and the update commands', async ($, on) => {
  host(on, { discussion: EMPTY, state: { ...PROJECTS, runner: 'running', plugin: { version: '0.1.2', latest: '0.1.5' } } }, 'zh')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await onProjects($, surface)
    expect(await ui.find({ text: /^v0\.1\.2$/ })).toBeDefined()
    expect(await ui.find({ text: /插件有新版本 0\.1\.5/ })).toBeDefined()
    expect(await ui.find({ type: 'Code', text: /claude plugin update wildcrane@wildcrane/ })).toBeDefined()
    await ui.unmount()
  }
})

test('an outdated plugin shows only the outdated notice', async ($, on) => {
  host(on, { discussion: EMPTY, state: { ...PROJECTS, runner: 'outdated', plugin: { version: '0.1.2', latest: '0.1.5' } } })
  const ui = await onProjects($)
  expect(await ui.find({ text: /out of date/ })).toBeDefined()
  expect(await ui.find({ text: /is available/ })).toBeUndefined()
  await ui.unmount()
})

test('a reload refreshes the open panel: the new version shows and the update notice goes', async ($, on) => {
  const answers: Record<string, unknown> = { discussion: EMPTY, state: { ...PROJECTS, runner: 'running', plugin: { version: '0.1.0', latest: '0.1.4' } } }
  host(on, answers)
  on('ui.panes', () => ({ value: [{ id: 'wildcrane', title: 'WildCrane', isShown: true, isFocused: true, isPlaced: true }] }))
  const ui = await onProjects($)
  expect(await ui.find({ text: /^v0\.1\.0$/ })).toBeDefined()
  expect(await ui.find({ text: /is available/ })).toBeDefined()

  answers.state = { ...PROJECTS, runner: 'running', plugin: { version: '0.1.4', latest: null } }
  await $.session.start({ cwd: '/Users/me/git/ai4kanban', surface: 'terminal', isInteractive: true })
  expect(await ui.find({ text: /^v0\.1\.4$/ })).toBeDefined()
  expect(await ui.find({ text: /is available/ })).toBeUndefined()
  await ui.unmount()
})

test('a reload with the panel closed calls nothing', async ($, on) => {
  const fake = host(on, { state: SIGNED_IN })
  on('ui.panes', () => ({ value: [] }))
  await $.session.start({ cwd: '/Users/me/git/ai4kanban', surface: 'terminal', isInteractive: true })
  expect(fake.calls).toEqual([])
})

test('only the panel tool is allowed without asking', async ($, on) => {
  on('tool.check', () => ({ decision: 'ask' }))
  expect(await $.tool.check({ tool: 'mcp__plugin_wildcrane_wildcrane__wildcrane_panel', input: {} })).toMatchObject({ decision: 'allow' })
  expect(await $.tool.check({ tool: 'mcp__plugin_wildcrane_wildcrane__wildcrane_draft_save', input: {} })).toMatchObject({ decision: 'ask' })
})

const TASKS = { tasks: [
  { task: 'task_1', title: 'Fix sign-in', project: 'ai4kanban', agent: 'Claude Code', state: 'running', minutes: 12, stop: 'task', url: 'https://app.wildcrane.ai/tasks/AKB-1' },
  { task: 'task_2', title: 'Release notes', project: 'billing', agent: 'Cursor', state: 'queued', minutes: 2, stop: null, url: 'https://app.wildcrane.ai/tasks/AKB-2' },
] }

test("Tasks lists this computer's tasks; Stop shows Stopping until the task leaves the list", async ($, on) => {
  const answers: Record<string, unknown> = { state: SIGNED_IN, discussion: EMPTY, tasks: TASKS, stopTask: { stopped: true } }
  const fake = host(on, answers, 'zh')
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'tab-tasks' }))?.text).toContain('任务')
  await ui.press({ key: 'tab-tasks' })
  expect(await ui.find({ text: /^Fix sign-in$/ })).toBeDefined()
  expect(await ui.find({ text: /运行中 · 12 分钟/ })).toBeDefined()
  expect(await ui.find({ text: /排队中 · 2 分钟/ })).toBeDefined()
  expect(await ui.find({ key: 'stop-task_2' })).toBeUndefined()
  expect(await ui.find({ type: 'Link', text: /打开/ })).toBeDefined()

  await ui.press({ key: 'stop-task_1' })
  expect(fake.calls.find((c) => c.action === 'stopTask')).toMatchObject({ task: 'task_1', stop: 'task' })
  expect(await ui.find({ text: /正在停止/ })).toBeDefined()
  expect(await ui.find({ key: 'stop-task_1' })).toBeUndefined()

  answers.tasks = { tasks: [] }
  await ui.press({ key: 'tab-tasks' })
  expect(await ui.find({ text: /这台电脑上没有任务在运行/ })).toBeDefined()
  await ui.unmount()
})

test('a refused Stop says so in its row, and offline keeps the last list', async ($, on) => {
  const answers: Record<string, unknown> = { state: SIGNED_IN, discussion: EMPTY, tasks: TASKS, stopTask: { error: 'forbidden' } }
  host(on, answers)
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'tab-tasks' })
  await ui.press({ key: 'stop-task_1' })
  expect(await ui.find({ text: /Couldn't stop/ })).toBeDefined()
  expect(await ui.find({ key: 'stop-task_1' })).toBeDefined()

  answers.tasks = { error: 'offline' }
  await ui.press({ key: 'tab-tasks' })
  expect(await ui.find({ text: /^Fix sign-in$/ })).toBeDefined()
  expect(await ui.find({ text: /Not synced/ })).toBeDefined()
  await ui.unmount()
})
