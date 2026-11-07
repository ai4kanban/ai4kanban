import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Status, Tab, TaskRow } from '../types'
import { copyFor, langOf } from './copy'
import { Pane, type Handlers, type View } from './pane'

const PANE = 'wildcrane'

const tabState = atom({ plugin: 'wildcrane', key: 'tab' } as const, 'projects' as Tab)
const langState = atom({ plugin: 'wildcrane', key: 'lang' } as const, 'en' as 'zh' | 'en')
const sessionState = atom({ plugin: 'wildcrane', key: 'session' } as const, '')
const cwdState = atom({ plugin: 'wildcrane', key: 'cwd' } as const, '')
const statusState = atom({ plugin: 'wildcrane', key: 'status' } as const, null as Status | null)
const tasksState = atom({ plugin: 'wildcrane', key: 'tasks' } as const, null as TaskRow[] | null)
const stoppingState = atom({ plugin: 'wildcrane', key: 'stopping' } as const, [] as string[])
const stopFailedState = atom({ plugin: 'wildcrane', key: 'stopFailed' } as const, [] as string[])
const syncedState = atom({ plugin: 'wildcrane', key: 'synced' } as const, true)

type Answer = Record<string, unknown> & { error?: string }

let server: string | null = null
let key: string | null = null
let polling: Timer | null = null
let taskPolling: Timer | null = null

/** The Tasks tab reads again this often while it is open. */
const TASKS_EVERY_MS = 3_000

/** The panel's one tool on the plugin's server, which answers JSON. */
async function ask($: EngineInterface, action: string, args: Record<string, unknown> = {}): Promise<Answer> {
  try {
    if (!server) {
      const connected = await $.mcp.connect('wildcrane')
      if (!connected.isConnected) return { error: 'offline' }
      server = connected.server
    }
    if (!key) {
      const home = (await $.env.get('WILDCRANE_HOME')) || `${await $.env.get('HOME')}/.wildcrane`
      key = (await $.fs.read(`${home}/plugin/panel.key`)).trim()
    }
    const session = await read($, sessionState)
    const cwd = await read($, cwdState)
    const result = await $.mcp.call(server, 'wildcrane_panel', { key, action, session, cwd, ...args })
    const block = result.content.find((b) => b.type === 'text') as { text?: string } | undefined
    return JSON.parse(block?.text ?? '{}') as Answer
  } catch {
    return { error: 'offline' }
  }
}

/** Offline keeps the last list; a Stop pressed stays pressed until its task leaves the list. */
async function loadTasks($: EngineInterface): Promise<void> {
  const answer = await ask($, 'tasks')
  if (answer.error) return void (await update($, syncedState, () => false))
  const rows = answer.tasks as TaskRow[]
  const running = new Set(rows.filter((r) => r.state === 'running').map((r) => r.task))
  await update($, tasksState, () => rows)
  await update($, syncedState, () => true)
  await update($, stoppingState, (s) => s.filter((t) => running.has(t)))
  await update($, stopFailedState, (s) => s.filter((t) => running.has(t)))
}

/** Polls only while the Tasks tab is open. */
function watchTasks($: EngineInterface, on: boolean): void {
  if (on && !taskPolling) {
    taskPolling = $.clock.every(TASKS_EVERY_MS, async () => {
      if ((await read($, tabState)) === 'tasks' && (await read($, statusState))?.signedIn) await loadTasks($)
      else watchTasks($, false)
    })
  }
  if (!on && taskPolling) {
    taskPolling.cancel()
    taskPolling = null
  }
}

async function stopTask($: EngineInterface, row: TaskRow): Promise<void> {
  if (!row.stop) return
  await update($, stopFailedState, (s) => s.filter((t) => t !== row.task))
  await update($, stoppingState, (s) => [...s.filter((t) => t !== row.task), row.task])
  const answer = await ask($, 'stopTask', { task: row.task, stop: row.stop })
  if (!answer.error) return
  await update($, stoppingState, (s) => s.filter((t) => t !== row.task))
  await update($, stopFailedState, (s) => [...s, row.task])
}

/** Everything the open tab shows, read again. */
async function refresh($: EngineInterface): Promise<void> {
  const status = (await ask($, 'state')) as unknown as Status
  await update($, statusState, () => status)
  if (status.error) {
    await update($, syncedState, () => false)
    return
  }
  if (status.signing && !status.signedIn && !polling) polling = $.clock.every(2_000, () => void refresh($))
  if (status.signedIn && polling) {
    polling.cancel()
    polling = null
  }
  const heldTab = await read($, tabState) as string
  const tab: Tab = heldTab === 'tasks' ? heldTab : 'projects'
  await update($, tabState, () => tab)
  watchTasks($, status.signedIn && tab === 'tasks')
  if (!status.signedIn) return
  if (tab === 'tasks') await loadTasks($)
}

async function goTab($: EngineInterface, tab: Tab): Promise<void> {
  await update($, tabState, () => tab)
  await refresh($)
}

async function view($: EngineInterface): Promise<View> {
  return {
    lang: await read($, langState),
    tab: await read($, tabState),
    session: await read($, sessionState),
    status: await read($, statusState),
    tasks: await read($, tasksState),
    stopping: await read($, stoppingState),
    stopFailed: await read($, stopFailedState),
    synced: await read($, syncedState),
    root: $.plugin.root,
  }
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    // A WildCrane job's own Claude session: the panel belongs to the person's.
    if (await $.env.get('WILDCRANE_JOB')) return next(e)
    await $.command.register({ name: 'wildcrane', description: '管理 WildCrane 项目、任务与 Agent' })
    // A reload: the open panel still holds what the old version read.
    if ((await $.ui.panes()).some((p) => p.id === PANE)) await refresh($)
    return next(e)
  })

  // 切换会话只更新面板上下文，不读取讨论。
  on('classic.SessionStart', async ($, e, next) => {
    const opened = !!(await read($, sessionState))
    await update($, sessionState, () => e.session_id)
    await update($, cwdState, () => e.cwd)
    if (opened) await refresh($)
    return next(e)
  })

  on('command.run', { command: 'wildcrane' }, async ($) => {
    const session = await $.session.id()
    const cwd = await $.session.cwd()
    const settings = (await $.settings.read()) as { language?: unknown }
    const lang = langOf(settings.language, await $.env.get('LANG'))
    await update($, langState, () => lang)
    await update($, sessionState, () => session)
    await update($, cwdState, () => cwd)
    await $.ui.open({ id: PANE, title: 'WildCrane', focus: true })
    await refresh($)
    return { text: copyFor(lang).opened }
  })

  // The panel's tool is the panel's: kept out of the model's tool list.
  on('tool.describe', async ($, e, next) => {
    if (!e.tool.endsWith('__wildcrane_panel')) return next(e)
    return { description: e.description, isDeferred: true }
  })

  // The panel's own reads ask nobody; `panel.key` guards the tool.
  on('tool.check', async ($, e, next) => {
    if (!e.tool.endsWith('__wildcrane_panel')) return next(e)
    return { decision: 'allow' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const v = await view($)
    const act: Handlers = {
      settings: () => { void ask($, 'openSettings') },
      tab: (tab) => void goTab($, tab),
      stopTask: (row) => void stopTask($, row),
    }
    if (e.surface === 'terminal') return Pane({ surface: 'terminal', ui: $.ui.resolve(e) }, v, act)
    if (e.surface === 'desktop') return Pane({ surface: 'desktop', ui: $.ui.resolve(e) }, v, act)
    if (e.surface === 'vscode') return Pane({ surface: 'vscode', ui: $.ui.resolve(e) }, v, act)
    return Pane({ surface: 'mobile', ui: $.ui.resolve(e) }, v, null)
  })
}
