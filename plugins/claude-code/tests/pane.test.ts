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
  return { calls }
}

const SIGNED_IN = { dir: '~/git/ai4kanban', signedIn: true, account: { name: 'Lin Chen', email: 'lin@acme.dev' }, folder: FOLDER, projects: [FOLDER] }
const EMPTY = { discussion: 'dsc_1', version: 1, ideas: [], workflows: WORKFLOWS }

test('signed out, the panel says what it is and Sign in only signs in', async ($, on) => {
  const fake = host(on, { state: { dir: '~/git/ai4kanban', signedIn: false, signing: null } }, '中文')
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /在对话里告诉 Claude 要做什么/ })).toBeDefined()
    expect((await ui.find({ key: 'sign-in' }))?.text).toContain('登录')
    expect(await ui.find({ key: 'tab-ideas' })).toBeUndefined()
    expect(await ui.find({ key: 'sign-out' })).toBeUndefined()
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'sign-in' })
  await ui.unmount()
  expect(fake.calls.map((c) => c.action)).toContain('signIn')
  expect(fake.calls.some((c) => c.action === 'addFolder')).toBe(false)
})

test('signed in, the account sits at the foot; Sign out asks first and goes back to the first open', async ($, on) => {
  const fake = host(on, { state: SIGNED_IN, discussion: EMPTY, signOut: { dir: '~/git/ai4kanban', signedIn: false, signing: null } }, 'zh')
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ text: /^Lin Chen$/ })).toBeDefined()
  expect(await ui.find({ text: /已同步|未同步/ })).toBeUndefined()
  expect(await ui.find({ text: /Claude Code 插件/ })).toBeUndefined()
  await ui.press({ key: 'sign-out' })
  expect(await ui.find({ text: /正在运行的任务会停止/ })).toBeDefined()
  await ui.press({ key: 'sign-out-cancel' })
  expect(await ui.find({ text: /正在运行的任务会停止/ })).toBeUndefined()
  expect(fake.calls.some((c) => c.action === 'signOut')).toBe(false)
  await ui.press({ key: 'sign-out' })
  await ui.press({ key: 'sign-out-confirm' })
  expect(fake.calls.some((c) => c.action === 'signOut')).toBe(true)
  expect((await ui.find({ key: 'sign-in' }))?.text).toContain('登录')
  expect(await ui.find({ text: /Lin Chen/ })).toBeUndefined()
  await ui.unmount()
})

const NOT_ADDED = {
  dir: '~/git/wildcrane-clone',
  signedIn: true,
  folder: null,
  refused: null,
  projects: [],
  elsewhere: [
    { project: 'prj_wc', name: 'wildcrane', workspace_name: 'Personal', personal: true },
    { project: 'prj_site', name: 'site-redesign', workspace_name: 'Acme', personal: false },
  ],
}

test('a folder not yet a project offers a new one or a bind, and Bind adds it to one', async ($, on) => {
  const fake = host(on, { state: NOT_ADDED, discussion: EMPTY, addFolder: { added: true, project: 'prj_wc' } }, 'zh')
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ text: /wildcrane-clone 还不是项目/ })).toBeDefined()
    expect((await ui.find({ key: 'create-here' }))?.text).toContain('新建项目 wildcrane-clone')
    expect(await ui.find({ text: /Acme/ })).toBeDefined()
    expect(await ui.find({ text: /Personal/ })).toBeUndefined()
    expect((await ui.find({ key: 'bind-here-prj_wc' }))?.text).toContain('绑定')
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'bind-here-prj_wc' })
  await ui.unmount()
  expect(fake.calls.find((c) => c.action === 'addFolder')).toMatchObject({ project: 'prj_wc' })
})

test('binding a folder that belongs to another project says so', async ($, on) => {
  host(on, { state: NOT_ADDED, discussion: EMPTY, addFolder: { error: 'folder_taken' } })
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'bind-here-prj_site' })
  expect(await ui.find({ text: /already belongs to another project/ })).toBeDefined()
  await ui.unmount()
})

test("this session's ideas show before the folder is a project, but start only once it is one", async ($, on) => {
  const draft = { discussion: 'dsc_1', project: null, version: 2, ideas: [IDEA], workflows: WORKFLOWS }
  const fake = host(on, { state: { ...NOT_ADDED, elsewhere: [] }, discussion: draft })
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /Or bind/ })).toBeUndefined()
  expect((await ui.find({ key: 'start-idea_1' }))?.props.dimColor).toBe(true)
  await ui.press({ key: 'start-idea_1' })
  await ui.unmount()
  expect(fake.calls.some((c) => c.action === 'start')).toBe(false)
})

test('one idea open in full, the other a row; Start sends the version shown', async ($, on) => {
  const draft = { discussion: 'dsc_1', version: 3, ideas: [IDEA, { ...IDEA, id: 'idea_2', title: 'Open a failed run at its step' }], workflows: WORKFLOWS }
  const fake = host(on, { state: SIGNED_IN, discussion: draft, start: { task: { id: 'task_1', key: 'WC-7', url: 'u' } } })
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Input' })).toBeUndefined()
    expect((await ui.find({ key: 'start-idea_1' }))?.text).toContain('Start')
    expect(await ui.find({ key: 'start-idea_2' })).toBeUndefined()
    expect((await ui.find({ key: 'show-idea_2' }))?.text).toContain('Open a failed run at its step')
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'start-idea_1' })
  await ui.unmount()
  const start = fake.calls.find((c) => c.action === 'start')
  expect(start).toMatchObject({ discussion: 'dsc_1', idea: 'idea_1', version: 3, session: 'sess-1' })
})

test('an idea of a discussion opened before the folder was a project starts in this folder\'s', async ($, on) => {
  const draft = { discussion: 'dsc_1', project: null, version: 3, ideas: [IDEA], workflows: WORKFLOWS }
  const fake = host(on, { state: SIGNED_IN, discussion: draft, start: { task: { id: 'task_1', url: 'u' } } })
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'start-idea_1' })
  await ui.unmount()
  expect(fake.calls.find((c) => c.action === 'start')).toMatchObject({ discussion: 'dsc_1', project: 'prj_1' })
})

test('no ideas yet says to tell Claude in the conversation', async ($, on) => {
  host(on, { state: SIGNED_IN, discussion: EMPTY }, 'zh')
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /还没有想法。在对话里告诉 Claude/ })).toBeDefined()
  await ui.unmount()
})

test('a cleared or resumed conversation brings its own ideas', async ($, on) => {
  const fake = host(on, { state: SIGNED_IN, discussion: EMPTY })
  on('classic.SessionStart', () => ({}))
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  await $.classic.SessionStart({ source: 'clear', session_id: 'sess-2', cwd: '/Users/me/git/ai4kanban' } as never)
  expect(fake.calls.filter((c) => c.action === 'discussion').at(-1)).toMatchObject({ session: 'sess-2' })
})

test('Agents says what they are for', async ($, on) => {
  host(on, { state: SIGNED_IN, discussion: EMPTY, connections: { connections: [
    { name: 'claude-code', label: 'Claude Code', state: 'ready', command: null },
    { name: 'codex', label: 'Codex', state: 'signedOut', command: 'codex login' },
  ] } }, 'zh')
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'tab-agents' }))?.text).toContain('Agent')
  await ui.press({ key: 'tab-agents' })
  expect(await ui.find({ text: /任务由这台电脑上的 Agent 运行/ })).toBeDefined()
  expect(await ui.find({ type: 'Code', text: /codex login/ })).toBeDefined()
  expect(await ui.find({ key: 'recheck-codex' })).toBeDefined()
  await ui.unmount()
})

test('a started idea links its task in place of Start', async ($, on) => {
  const started = { ...IDEA, task: { id: 'task_1', key: 'WC-7', url: 'https://app.wildcrane.ai/tasks/WC-7' } }
  host(on, { state: SIGNED_IN, discussion: { discussion: 'dsc_1', version: 2, ideas: [started], workflows: WORKFLOWS } }, 'zh')
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'start-idea_1' })).toBeUndefined()
    expect(await ui.find({ type: 'Link', text: /WC-7/ })).toBeDefined()
    expect(await ui.find({ text: /软件开发/ })).toBeDefined()
    await ui.unmount()
  }
})

test('over the plan limit, the start is refused in words and nothing is retried', async ($, on) => {
  const fake = host(on, {
    state: SIGNED_IN,
    discussion: { discussion: 'dsc_1', version: 2, ideas: [IDEA], workflows: WORKFLOWS },
    start: { error: 'quota_exceeded' },
  })
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'start-idea_1' })
  expect(await ui.find({ text: /storage is at your plan's limit/ })).toBeDefined()
  expect((await ui.find({ key: 'start-idea_1' }))?.props.dimColor).toBe(true)
  await ui.unmount()
  expect(fake.calls.filter((c) => c.action === 'start').length).toBe(1)
})

const SITE = { project: 'prj_site', name: 'site', dir: '~/git/site', board: 'https://app.wildcrane.ai/projects/prj_site' }
const PROJECTS = {
  ...SIGNED_IN,
  projects: [FOLDER, SITE],
  elsewhere: [{ project: 'prj_wc', name: 'wildcrane', workspace_name: 'Acme', personal: false, board: 'https://app.wildcrane.ai/projects/prj_wc' }],
}

async function onProjects($: Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[0], surface: 'terminal' | 'desktop' = 'desktop') {
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface })
  await ui.press({ key: 'tab-projects' })
  return ui
}

test('Projects is one list: the current project marked, the ones not here say so and offer Bind', async ($, on) => {
  host(on, { discussion: EMPTY, state: PROJECTS }, 'zh')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await onProjects($, surface)
    expect(await ui.find({ text: /^当前$/ })).toBeDefined()
    expect((await ui.find({ key: 'remove-prj_site' }))?.text).toContain('解绑')
    expect((await ui.find({ key: 'new-project' }))?.text).toContain('新建项目')
    expect(await ui.find({ text: /不在这台电脑上/ })).toBeUndefined()
    expect(await ui.find({ text: /^这台电脑上没有目录$/ })).toBeDefined()
    expect((await ui.find({ key: 'bind-prj_wc' }))?.text).toContain('绑定')
    expect(await ui.find({ type: 'Link', text: /看板/ })).toBeDefined()
    expect(await ui.find({ text: /本目录|已添加/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('Unbind asks first, then unbinds; Cancel changes nothing', async ($, on) => {
  const fake = host(on, { discussion: EMPTY, state: PROJECTS, removeFolder: { ...PROJECTS, projects: [FOLDER] } })
  const ui = await onProjects($)
  await ui.press({ key: 'remove-prj_site' })
  expect(await ui.find({ text: /Unbind site from this folder/ })).toBeDefined()
  await ui.press({ key: 'keep-prj_site' })
  expect(await ui.find({ text: /Unbind site from this folder/ })).toBeUndefined()
  expect(fake.calls.some((c) => c.action === 'removeFolder')).toBe(false)
  await ui.press({ key: 'remove-prj_site' })
  await ui.press({ key: 'unbind-prj_site' })
  expect(fake.calls.find((c) => c.action === 'removeFolder')).toMatchObject({ project: 'prj_site' })
  expect(await ui.find({ key: 'remove-prj_site' })).toBeUndefined()
  await ui.unmount()
})

test('a folder a job holds is not unbound, and says why', async ($, on) => {
  const fake = host(on, { discussion: EMPTY, state: { ...PROJECTS, projects: [FOLDER, { ...SITE, busy: true }] } })
  const ui = await onProjects($)
  await ui.press({ key: 'remove-prj_site' })
  expect(await ui.find({ text: /A task is running in this folder/ })).toBeDefined()
  expect(await ui.find({ key: 'unbind-prj_site' })).toBeUndefined()
  await ui.unmount()
  expect(fake.calls.some((c) => c.action === 'removeFolder')).toBe(false)
})

test('New project and Bind take a typed folder, and a taken one is refused by name', async ($, on) => {
  const fake = host(on, { discussion: EMPTY, state: PROJECTS, addFolder: { error: 'folder_taken', name: 'site' } })
  const ui = await onProjects($)
  await ui.press({ key: 'new-project' })
  await ui.input({ key: 'folder-new', text: '~/git/app', kind: 'submit' })
  expect(fake.calls.find((c) => c.action === 'addFolder')).toMatchObject({ path: '~/git/app' })
  expect(fake.calls.find((c) => c.action === 'addFolder')?.project).toBeUndefined()
  await ui.press({ key: 'bind-prj_wc' })
  expect(await ui.find({ key: 'folder-new' })).toBeUndefined()
  await ui.input({ key: 'folder-prj_wc', text: '~/git/site', kind: 'submit' })
  expect(fake.calls.filter((c) => c.action === 'addFolder').at(-1)).toMatchObject({ path: '~/git/site', project: 'prj_wc' })
  expect(await ui.find({ text: /already belongs to site/ })).toBeDefined()
  await ui.unmount()
})

test('an outdated Runner shows the update commands above every tab', async ($, on) => {
  host(on, { discussion: EMPTY, state: { ...PROJECTS, runner: 'outdated' } }, 'zh')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await onProjects($, surface)
    expect(await ui.find({ text: /插件版本过旧/ })).toBeDefined()
    expect(await ui.find({ type: 'Code', text: /claude plugin update wildcrane@wildcrane/ })).toBeDefined()
    await ui.press({ key: 'tab-ideas' })
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
