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
  const prompts: string[] = []
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
  on('prompt.submit', (_$, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  return { calls, prompts }
}

const SIGNED_IN = { dir: '~/git/ai4kanban', signedIn: true, folder: FOLDER, projects: [FOLDER] }

test('signed out, one button signs in and adds the folder', async ($, on) => {
  const fake = host(on, { state: { dir: '~/git/ai4kanban', signedIn: false, signing: null } }, '中文')
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ key: 'setup' }))?.text).toContain('登录并添加为项目')
    await ui.unmount()
  }
  expect(fake.calls.map((c) => c.action)).toContain('state')
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

test('a folder not added lists the projects it can be bound to, and Bind adds it to one', async ($, on) => {
  const fake = host(on, { state: NOT_ADDED, addFolder: { added: true, project: 'prj_wc' } }, 'zh')
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ key: 'setup' }))?.text).toContain('添加为项目')
    expect(await ui.find({ text: /绑定到这台电脑上还没有目录/ })).toBeDefined()
    expect(await ui.find({ text: /Acme/ })).toBeDefined()
    expect(await ui.find({ text: /Personal/ })).toBeUndefined()
    expect((await ui.find({ key: 'bind-prj_wc' }))?.text).toContain('绑定')
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'bind-prj_wc' })
  await ui.unmount()
  expect(fake.calls.find((c) => c.action === 'addFolder')).toMatchObject({ project: 'prj_wc' })
})

test('binding a folder that belongs to another project says so', async ($, on) => {
  host(on, { state: NOT_ADDED, addFolder: { error: 'folder_taken' } })
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'bind-prj_site' })
  expect(await ui.find({ text: /already belongs to another project/ })).toBeDefined()
  await ui.unmount()
})

test('with nothing to bind, the folder keeps its plain hint', async ($, on) => {
  host(on, { state: { ...NOT_ADDED, elsewhere: [] } })
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ text: /same-named project/ })).toBeDefined()
  expect(await ui.find({ text: /Or bind/ })).toBeUndefined()
  await ui.unmount()
})

test('one idea open in full, the other a row; Start sends the version shown', async ($, on) => {
  const draft = { discussion: 'dsc_1', version: 3, ideas: [IDEA, { ...IDEA, id: 'idea_2', title: 'Open a failed run at its step' }], workflows: WORKFLOWS }
  const fake = host(on, { state: SIGNED_IN, discussion: draft, start: { task: { id: 'task_1', key: 'WC-7', url: 'u' } } })
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ key: 'idea' })).toBeDefined()
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

test('what the person writes reaches this session under its discussion', async ($, on) => {
  const draft = { discussion: 'dsc_1', version: 1, ideas: [], workflows: WORKFLOWS }
  const fake = host(on, { state: SIGNED_IN, discussion: draft })
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.input({ key: 'idea', text: 'Add a pricing page', kind: 'submit' })
  await ui.unmount()
  expect(fake.prompts).toEqual(['[WildCrane idea · discussion dsc_1]\nAdd a pricing page'])
  expect(fake.calls.some((c) => c.action === 'start')).toBe(false)
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
  expect(await ui.find({ text: /limit on tasks in progress/ })).toBeDefined()
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

const EMPTY = { discussion: 'dsc_1', version: 1, ideas: [], workflows: WORKFLOWS }

async function onProjects($: Parameters<Parameters<typeof test>[1]>[0], surface: 'terminal' | 'desktop' = 'desktop') {
  await $.command.run({ command: 'wildcrane', args: '' } as never)
  const ui = await $.ui.mount({ ...PANE, surface })
  await ui.press({ key: 'tab-projects' })
  return ui
}

test('Projects is one list: the current project marked, the ones not here below with their boards', async ($, on) => {
  host(on, { discussion: EMPTY, state: PROJECTS }, 'zh')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await onProjects($, surface)
    expect(await ui.find({ text: /Claude Code 插件/ })).toBeDefined()
    expect(await ui.find({ text: /^当前$/ })).toBeDefined()
    expect((await ui.find({ key: 'remove-prj_site' }))?.text).toContain('解绑')
    expect((await ui.find({ key: 'new-project' }))?.text).toContain('新建项目')
    expect(await ui.find({ text: /不在这台电脑上/ })).toBeDefined()
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
  host(on, { discussion: EMPTY, state: { ...PROJECTS, runner: 'running' } })
  const ui = await onProjects($)
  expect(await ui.find({ text: /out of date/ })).toBeUndefined()
  await ui.unmount()
})
