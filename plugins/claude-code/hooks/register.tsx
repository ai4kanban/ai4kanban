// The WildCrane panel (#2161): `/wildcrane` opens it in the terminal and in Claude Desktop's Code
// tab, one tree for both. Ideas are shaped in this Claude session's conversation; Cloud reads and
// writes go through the plugin's own MCP server (server/), never from here.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Adding, Connection, Draft, Removing, Status, Tab, TaskRow } from '../types'
import { copyFor, langOf } from './copy'
import { Pane, type Handlers, type View } from './pane'

const PANE = 'wildcrane'

const tabState = atom({ plugin: 'wildcrane', key: 'tab' } as const, 'ideas' as Tab)
const langState = atom({ plugin: 'wildcrane', key: 'lang' } as const, 'en' as 'zh' | 'en')
const sessionState = atom({ plugin: 'wildcrane', key: 'session' } as const, '')
const cwdState = atom({ plugin: 'wildcrane', key: 'cwd' } as const, '')
const statusState = atom({ plugin: 'wildcrane', key: 'status' } as const, null as Status | null)
const draftState = atom({ plugin: 'wildcrane', key: 'draft' } as const, null as Draft | null)
const openState = atom({ plugin: 'wildcrane', key: 'open' } as const, 0)
const busyState = atom({ plugin: 'wildcrane', key: 'busy' } as const, false)
const bannerState = atom({ plugin: 'wildcrane', key: 'banner' } as const, null as string | null)
const connectionsState = atom({ plugin: 'wildcrane', key: 'connections' } as const, null as Connection[] | null)
const tasksState = atom({ plugin: 'wildcrane', key: 'tasks' } as const, null as TaskRow[] | null)
const stoppingState = atom({ plugin: 'wildcrane', key: 'stopping' } as const, [] as string[])
const stopFailedState = atom({ plugin: 'wildcrane', key: 'stopFailed' } as const, [] as string[])
const syncedState = atom({ plugin: 'wildcrane', key: 'synced' } as const, true)
const removingState = atom({ plugin: 'wildcrane', key: 'removing' } as const, null as Removing)
const addingState = atom({ plugin: 'wildcrane', key: 'adding' } as const, null as Adding)
const signingOutState = atom({ plugin: 'wildcrane', key: 'signingOut' } as const, false)

type Answer = Record<string, unknown> & { error?: string }

/** Refusals of a start, by Cloud's code; anything else is `startFailed`. */
const START_REFUSALS: Record<string, string> = {
  offline: 'offline',
  version_conflict: 'conflict',
  quota_exceeded: 'limit',
  runtime_unavailable: 'notReady',
}

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

async function setDraft($: EngineInterface, answer: Answer): Promise<boolean> {
  if (answer.error) {
    await update($, syncedState, () => false)
    if (answer.error === 'offline') await update($, bannerState, () => 'offline')
    return false
  }
  const draft = answer as unknown as Draft
  await update($, draftState, () => draft)
  await update($, syncedState, () => true)
  await update($, openState, (n) => Math.min(n, Math.max(0, draft.ideas.length - 1)))
  return true
}

async function loadDraft($: EngineInterface): Promise<boolean> {
  return setDraft($, await ask($, 'discussion'))
}

async function checkConnections($: EngineInterface): Promise<void> {
  await update($, connectionsState, () => null)
  const answer = await ask($, 'connections')
  if (!answer.error) await update($, connectionsState, () => answer.connections as Connection[])
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
    await update($, bannerState, () => 'offline')
    return
  }
  if (status.signing && !status.signedIn && !polling) polling = $.clock.every(2_000, () => void refresh($))
  if (status.signedIn && polling) {
    polling.cancel()
    polling = null
  }
  if ((await read($, bannerState)) === 'offline') await update($, bannerState, () => null)
  const tab = await read($, tabState)
  watchTasks($, status.signedIn && tab === 'tasks')
  if (!status.signedIn) return
  if (tab === 'ideas') await loadDraft($)
  if (tab === 'tasks') await loadTasks($)
  if (tab === 'agents' && !(await read($, connectionsState))) await checkConnections($)
}

async function goTab($: EngineInterface, tab: Tab): Promise<void> {
  await cancel($)
  await update($, tabState, () => tab)
  await refresh($)
}

async function signIn($: EngineInterface): Promise<void> {
  await update($, statusState, (s) => (s ? { ...s, signing: { url: null, failed: null } } : s))
  await ask($, 'signIn')
  await refresh($)
}

/** Makes this folder a project: a new one, or `project` bound to it. */
async function addHere($: EngineInterface, project?: string): Promise<void> {
  const added = await ask($, 'addFolder', project ? { project } : {})
  if (added.error) await update($, statusState, (s) => (s ? { ...s, refused: added.error === 'folder_taken' ? 'taken' : added.error ?? null } : s))
  else await refresh($)
}

async function askSignOut($: EngineInterface, open: boolean): Promise<void> {
  await cancel($)
  await update($, signingOutState, () => open)
}

/** Back to how a first open looks. */
async function signOut($: EngineInterface): Promise<void> {
  const answer = await ask($, 'signOut')
  await update($, signingOutState, () => false)
  if (answer.error) return void (await refresh($))
  await update($, statusState, () => answer as unknown as Status)
  await update($, tabState, () => 'ideas')
  await update($, draftState, () => null)
  await update($, connectionsState, () => null)
  await update($, tasksState, () => null)
  await update($, bannerState, () => null)
  watchTasks($, false)
}

/** Closes the Projects tab's open question or folder field. */
async function cancel($: EngineInterface): Promise<void> {
  await update($, removingState, () => null)
  await update($, addingState, () => null)
}

/** A row's Unbind: asks first, or says at once that a job holds the folder. Pressed again, it closes. */
async function remove($: EngineInterface, project: string): Promise<void> {
  const open = (await read($, removingState))?.project === project
  await cancel($)
  if (open) return
  const busy = !!(await read($, statusState))?.projects?.find((p) => p.project === project)?.busy
  await update($, removingState, () => ({ project, busy }))
}

async function confirmRemove($: EngineInterface, project: string): Promise<void> {
  const answer = await ask($, 'removeFolder', { project })
  if (answer.error === 'busy') return void (await update($, removingState, () => ({ project, busy: true })))
  await cancel($)
  if (answer.error) await refresh($)
  else await update($, statusState, () => answer as unknown as Status)
}

/** New project's or a row's Bind field: opened empty, or with this folder when it has no project yet. */
async function toggleAdding($: EngineInterface, project: string | null): Promise<void> {
  const open = await read($, addingState)
  await cancel($)
  if (open && open.project === project) return
  const status = await read($, statusState)
  await update($, addingState, () => ({ project, path: status?.folder ? '' : status?.dir ?? '', error: null, holder: null }))
}

async function add($: EngineInterface, value: string): Promise<void> {
  const adding = await read($, addingState)
  const path = value.trim()
  if (!adding || !path) return
  const answer = await ask($, 'addFolder', adding.project ? { path, project: adding.project } : { path })
  if (answer.error) {
    const error = answer.error === 'folder_taken' ? 'taken' : answer.error
    const holder = typeof answer.name === 'string' ? answer.name : null
    await update($, addingState, () => ({ ...adding, path: value, error, holder }))
    return
  }
  await cancel($)
  await refresh($)
}

async function setWorkflow($: EngineInterface, idea: string, workflow: string): Promise<void> {
  const draft = await read($, draftState)
  if (draft) await setDraft($, await ask($, 'workflow', { discussion: draft.discussion, idea, workflow }))
}

async function discard($: EngineInterface, idea: string): Promise<void> {
  const draft = await read($, draftState)
  if (draft) await setDraft($, await ask($, 'discard', { discussion: draft.discussion, idea }))
}

/** The one way a task is made: never while Claude is still changing the ideas, they are not
 *  synced, or this folder is no project yet. */
async function start($: EngineInterface, idea: string): Promise<void> {
  const draft = await read($, draftState)
  const folder = (await read($, statusState))?.folder
  if (!draft || !folder || (await read($, busyState)) || !(await read($, syncedState))) return
  const answer = await ask($, 'start', { discussion: draft.discussion, idea, version: draft.version, ...(draft.project ? {} : { project: folder.project }) })
  await update($, bannerState, () => (answer.error ? START_REFUSALS[answer.error] ?? 'startFailed' : null))
  await loadDraft($)
}

async function retry($: EngineInterface): Promise<void> {
  await update($, bannerState, () => null)
  await refresh($)
}

async function show($: EngineInterface, n: number): Promise<void> {
  await update($, openState, () => n)
}

async function view($: EngineInterface): Promise<View> {
  return {
    lang: await read($, langState),
    tab: await read($, tabState),
    session: await read($, sessionState),
    status: await read($, statusState),
    draft: await read($, draftState),
    open: await read($, openState),
    busy: await read($, busyState),
    banner: await read($, bannerState),
    connections: await read($, connectionsState),
    tasks: await read($, tasksState),
    stopping: await read($, stoppingState),
    stopFailed: await read($, stopFailedState),
    synced: await read($, syncedState),
    removing: await read($, removingState),
    adding: await read($, addingState),
    signingOut: await read($, signingOutState),
    root: $.plugin.root,
  }
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    // A WildCrane job's own Claude session: the panel belongs to the person's.
    if (await $.env.get('WILDCRANE_JOB')) return next(e)
    await $.command.register({ name: 'wildcrane', description: 'Shape ideas with Claude and start them as WildCrane tasks' })
    // A reload: the open panel still holds what the old version read.
    if ((await $.ui.panes()).some((p) => p.id === PANE)) await refresh($)
    return next(e)
  })

  // A new, resumed or cleared conversation: the panel follows it to its ideas.
  on('classic.SessionStart', async ($, e, next) => {
    const opened = !!(await read($, sessionState))
    await update($, sessionState, () => e.session_id)
    await update($, cwdState, () => e.cwd)
    await update($, draftState, () => null)
    await update($, openState, () => 0)
    await update($, bannerState, () => null)
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

  // The model saved the ideas: the panel shows what it saved.
  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (String(e.tool).endsWith('__wildcrane_draft_save')) await loadDraft($)
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    await update($, busyState, () => true)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await update($, busyState, () => false)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const v = await view($)
    const act: Handlers = {
      tab: (tab) => void goTab($, tab),
      signIn: () => void signIn($),
      addHere: (project) => void addHere($, project),
      askSignOut: (open) => void askSignOut($, open),
      signOut: () => void signOut($),
      show: (n) => void show($, n),
      workflow: (idea, workflow) => void setWorkflow($, idea, workflow),
      discard: (idea) => void discard($, idea),
      start: (idea) => void start($, idea),
      retry: () => void retry($),
      recheck: () => void checkConnections($),
      remove: (project) => void remove($, project),
      confirmRemove: (project) => void confirmRemove($, project),
      cancel: () => void cancel($),
      adding: (project) => void toggleAdding($, project),
      add: (path) => void add($, path),
      stopTask: (row) => void stopTask($, row),
    }
    if (e.surface === 'terminal') return Pane({ surface: 'terminal', ui: $.ui.resolve(e) }, v, act)
    if (e.surface === 'desktop') return Pane({ surface: 'desktop', ui: $.ui.resolve(e) }, v, act)
    if (e.surface === 'vscode') return Pane({ surface: 'vscode', ui: $.ui.resolve(e) }, v, act)
    return Pane({ surface: 'mobile', ui: $.ui.resolve(e) }, v, null)
  })
}
