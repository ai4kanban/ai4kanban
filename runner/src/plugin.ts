import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Writable } from 'node:stream'

import { McpServer, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { readSession } from '../../cli/src/lib/cloud/session'
import { akbHome, bundledAkb, shimDir } from './akb'
import * as api from './api'
import { kept } from './cache'
import { launch } from './launcher'
import { WEB_URL, taskUrl } from './urls'
import { refusal } from './folders'
import { machineId, runnerHome, useRunnerHome } from './home'
import { checkReleased, pluginInfo } from './plugin-version'
import { EXIT_OUTDATED, VERSION } from './protocol'
import { LABELS } from './runtimes'
import * as settings from './settings'
import { closeSettings, openSettings } from './settings-server'

export type Host = 'claude-code' | 'codex'

/** The panel's tool takes this file's key, so the model, which never reads it, cannot start a task. */
export const panelKeyFile = () => path.join(runnerHome(), 'plugin', 'panel.key')
const chatsFile = () => path.join(runnerHome(), 'plugin', 'chats.json')

function panelKey(): string {
  try {
    const held = fs.readFileSync(panelKeyFile(), 'utf8').trim()
    if (held) return held
  } catch {
    // Not written yet.
  }
  const key = crypto.randomBytes(24).toString('hex')
  fs.mkdirSync(path.dirname(panelKeyFile()), { recursive: true, mode: 0o700 })
  fs.writeFileSync(panelKeyFile(), `${key}\n`, { mode: 0o600 })
  return key
}

/** One host session's discussion, kept on this computer only. */
export interface Chat {
  session: string
  discussion: string
  project: string
  dir: string
  at: string
}

export function readChats(): Chat[] {
  try {
    const held = JSON.parse(fs.readFileSync(chatsFile(), 'utf8')) as { chats?: Chat[] }
    return Array.isArray(held.chats) ? held.chats : []
  } catch {
    return []
  }
}

function keepChat(chat: Chat): void {
  const chats = [chat, ...readChats().filter((c) => c.session !== chat.session)].slice(0, 200)
  fs.mkdirSync(path.dirname(chatsFile()), { recursive: true, mode: 0o700 })
  fs.writeFileSync(chatsFile(), `${JSON.stringify({ chats }, null, 2)}\n`)
}

const home = (dir: string) => (dir === os.homedir() || dir.startsWith(os.homedir() + path.sep) ? `~${dir.slice(os.homedir().length)}` : dir)

function realpath(dir: string): string {
  try {
    return fs.realpathSync(dir)
  } catch {
    return dir
  }
}

/** What a failed call shows: offline when Cloud was not reached, else Cloud's refusal code. */
const failure = (call: { ok: false; error: string; code?: string }) => ({ error: call.code ?? 'offline', message: call.error })

const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] })

const discussionUrl = (id: string) => `${WEB_URL()}/discussions/${encodeURIComponent(id)}`
const boardUrl = (project: string) => `${WEB_URL()}/projects/${encodeURIComponent(project)}`

/** 模型读取的目标。 */
const goalOf = (i: api.DraftGoal) => ({
  id: i.id,
  title: i.title,
  outcome: i.outcome,
  acceptance: i.acceptance,
  workflow: i.workflow,
  previews: i.previews ?? [],
  task: i.task ? { ...i.task, url: taskUrl(i.task.key || i.task.id) } : null,
})

async function workflowsOf(workspace: string) {
  const list = await api.listWorkflows(workspace)
  if (!list.ok) return []
  return list.value.data.map((w) => ({ id: w.id, name: w.name, names: w.names, description: w.description ?? '', when: w.when ?? '', previews: w.previews }))
}

async function draftOf(id: string) {
  const read = await api.readDiscussion(id)
  if (!read.ok) return failure(read)
  const d = read.value
  const goals = linked(d, (d.goals ?? d.ideas).map(goalOf))
  return { discussion: d.id, url: discussionUrl(d.id), project: d.project, version: d.version, goals, ideas: goals, workflows: await workflowsOf(d.workspace) }
}

/** The Runner: started once signed in, closed with the host. */
let runner: { close(): Promise<void>; renew(): void } | null = null
/** `outdated`: Cloud refused this plugin's Runner; it stays off until the plugin is updated. */
let runnerState: 'off' | 'waiting' | 'running' | 'outdated' = 'off'
let host: Host = 'claude-code'
/** This plugin's `akb` for a session the Runner did not start. */
let akbFile: string | null = null

/** A session started by hand has no Runner to put `akb` on its PATH (#187): the fixed folder
 *  hooks/session.mjs names, not a version's. Windows stays out. */
function writeShim(): void {
  if (process.env.WILDCRANE_JOB) return
  try {
    akbFile = path.join(shimDir({ ...bundledAkb(), shim: akbHome() }), process.platform === 'win32' ? 'akb.cmd' : 'akb')
  } catch (e) {
    process.stderr.write(`wildcrane: could not write the akb shim: ${e instanceof Error ? e.message : String(e)}\n`)
  }
}

function run(): void {
  if (runner || runnerState === 'outdated' || process.env.WILDCRANE_JOB || !readSession()) return
  runnerState = 'running'
  const abort = new AbortController()
  const entry = path.join(path.dirname(fileURLToPath(import.meta.url)), 'runner.mjs')
  let renew = () => {}
  const done = launch({ version: VERSION, entry }, {
    signal: abort.signal, quiet: true, kind: host,
    onSpawn: (send) => { renew = () => send('renew') },
    onMessage: (message) => {
      if (message.type === 'waiting') runnerState = 'waiting'
      if (message.type === 'connected') runnerState = 'running'
    },
  })
  const stopped = done.then((code) => code === EXIT_OUTDATED ? { reason: 'outdated' as const } : { reason: 'refused' as const, message: 'Runner 已停止' })
  runner = { close: async () => { abort.abort(); await done }, renew: () => renew() }
  void stopped.then((stop) => {
    runner = null
    runnerState = stop.reason === 'outdated' ? 'outdated' : 'off'
  })
}

const startSignIn = settings.startSignIn

/** This folder's project, when it was added. */
const folderOf = settings.folderOf

/** How to update the plugin, which carries its own Runner. */
const UPDATE = {
  'claude-code': 'The WildCrane plugin is out of date, so tasks no longer run on this computer. Tell the user to run `claude plugin marketplace update wildcrane` and `claude plugin update wildcrane@wildcrane` in a terminal, then `/reload-plugins`.',
  codex: 'The WildCrane plugin is out of date, so tasks no longer run on this computer. Tell the user to download `wildcrane-codex.zip` from the latest `plugin-v*` release at https://github.com/wildcrane-ai/wildcrane/releases, unzip it over the old copy, then run `codex plugin remove wildcrane@wildcrane` and `codex plugin add wildcrane@wildcrane`.',
}

/** Codex has no panel, so a newer release reaches the user through `next`. */
const NEWER = (version: string, latest: string) =>
  `WildCrane plugin ${latest} is out; this computer has ${version}, and tasks still run. Tell the user once in this conversation, with the steps: download \`wildcrane-codex.zip\` from https://github.com/wildcrane-ai/wildcrane/releases/tag/plugin-v${latest}, unzip it over the old copy, then run \`codex plugin remove wildcrane@wildcrane\` and \`codex plugin add wildcrane@wildcrane\`.`

type Connection = { label: string; state: 'notInstalled' | 'signedOut' | 'ready'; command: string | null }

/** Codex has no panel: the tools' states, their commands, and the web for the rest of setup. */
const NOT_READY = (found: Connection[], web: string) => {
  const each = found
    .filter((c) => c.state !== 'ready')
    .map((c) => `${c.label} is ${c.state === 'signedOut' ? 'signed out' : 'not installed'}${c.command ? ` (run \`${c.command}\`)` : ''}`)
  return `No AI tool is ready on this computer: ${each.join(', ')}. Tell the user, with the command for the tool they use, and that they can finish setup at ${web}.`
}
const NOT_ADDED = 'This folder is not a WildCrane project yet. Call wildcrane_open_settings to let the user choose its project folder.'

/** What the signed-in state shows that `next` reads: `refused` is unset when Cloud was not reached. */
export type Seen = { connections: Connection[]; folder: unknown; refused?: string | null; web: string }

/** One line for the model, the first that holds: an outdated Runner, then for Codex alone no tool
 *  ready, this folder not added, a newer release. Claude Code's panel shows the rest itself. */
export function nextOf(as: Host, state: typeof runnerState, plugin: { version: string | null; latest: string | null }, seen?: Seen): string | null {
  if (state === 'outdated') return UPDATE[as]
  if (as !== 'codex') return null
  if (seen && !seen.connections.some((c) => c.state === 'ready')) return NOT_READY(seen.connections, seen.web)
  if (seen && seen.folder === null && seen.refused === null) return NOT_ADDED
  return plugin.version && plugin.latest ? NEWER(plugin.version, plugin.latest) : null
}

async function state(cwd: string) {
  const plugin = pluginInfo(host)
  const next = nextOf(host, runnerState, plugin)
  const base = { dir: home(cwd), runner: runnerState, web: WEB_URL(), ...(next ? { next } : {}), plugin }
  const session = readSession()
  if (!session) return { ...base, signedIn: false, signing: settings.signingState() }
  const account = { name: session.name ?? session.handle, email: session.email }
  const found = await folderOf(cwd)
  if ('error' in found) return { ...base, signedIn: true, account, ...found }
  const refused = found.folder ? null : refusal(cwd)
  return {
    ...base,
    signedIn: true,
    account,
    folder: found.folder,
    refused,
    projects: found.folders.map((f) => ({ ...f, dir: home(f.path), board: boardUrl(f.project), busy: kept(realpath(f.path)) })),
    elsewhere: await elsewhere(),
  }
}

/** 先关闭 Runner，停止正在执行的任务。 */
async function signOut(cwd: string) {
  const result = await settings.signOut()
  if ('error' in result) return result
  await runner?.close()
  return state(cwd)
}

async function elsewhere() {
  const list = await api.listElsewhere(machineId())
  if (!list.ok) return []
  return list.value.projects.map(({ project, name, workspace_name, personal }) => ({ project, name, workspace_name, personal, board: boardUrl(project) }))
}

const typed = (given: string, cwd: string) => path.resolve(cwd, given.trim().replace(/^~(?=$|[\\/])/, os.homedir()))
async function addFolder(dir: string, bind?: string, strict = false) {
  const result = await settings.addFolder(dir, bind, strict)
  return 'error' in result ? result : { ...result, board: boardUrl(result.project!) }
}
async function removeFolder(cwd: string, project: string) {
  const result = await settings.removeFolder(project)
  return 'error' in result ? result : state(cwd)
}

async function chats() {
  const held = readChats().slice(0, 20)
  const read = await Promise.all(held.map((c) => api.readDiscussion(c.discussion)))
  return {
    chats: held.flatMap((c, n) => {
      const d = read[n]!
      if (!d.ok) return d.code === 'not_found' ? [] : [{ ...c, title: '', goals: 0, offline: true }]
      return [{ ...c, dir: home(c.dir), title: d.value.title, goals: (d.value.goals ?? d.value.ideas).length, at: d.value.updated_at }]
    }),
  }
}

/** This computer's running and queued tasks, from Cloud: whichever process holds the lock runs them. */
async function tasks() {
  const list = await api.listMachineTasks(machineId())
  if (!list.ok) return failure(list)
  const now = Date.now()
  return {
    tasks: list.value.tasks.map((t) => ({
      task: t.task,
      title: t.title,
      project: t.project ?? '',
      agent: LABELS[t.runtime] ?? t.runtime,
      state: t.state,
      minutes: Math.max(0, Math.floor((now - Date.parse(t.since)) / 60_000)),
      stop: t.stop,
      url: taskUrl(t.key || t.task),
    })),
  }
}

const connections = settings.connections

/** The host session's discussion, opened on Cloud and kept on this computer. */
async function open(session: string, project: string | null, cwd: string) {
  const opened = await api.openDiscussion(project, session, host)
  if (!opened.ok) return failure(opened)
  keepChat({ session, discussion: opened.value.id, project: project ?? '', dir: realpath(cwd), at: new Date().toISOString() })
  return opened.value
}

/** A Claude Code session's draft: opened on first read in `cwd`'s project, or in none until one is chosen. */
async function sessionDraft(session: string, cwd: string) {
  const held = readChats().find((c) => c.session === session)
  if (held) return draftOf(held.discussion)
  const found = await folderOf(cwd)
  if ('error' in found) return found
  const opened = await open(session, found.folder?.project ?? null, cwd)
  return 'error' in opened ? opened : draftOf(opened.id)
}

const PanelArgs = {
  key: z.string(),
  action: z.enum(['state', 'signIn', 'signOut', 'addFolder', 'removeFolder', 'connections', 'tasks', 'stopTask', 'openSettings']),
  session: z.string().optional(),
  cwd: z.string().optional(),
  project: z.string().optional(),
  path: z.string().optional(),
  task: z.string().optional(),
  stop: z.enum(['task', 'chat']).optional(),
}

type Panel = { [K in keyof typeof PanelArgs]: z.infer<(typeof PanelArgs)[K]> }

export async function panel(args: Panel): Promise<unknown> {
  const cwd = args.cwd ?? process.cwd()
  switch (args.action) {
    case 'state':
      return state(cwd)
    case 'openSettings':
      return openSettings(settings.settingsAction, { path: cwd, project: args.project })
    case 'signIn':
      startSignIn()
      return { signing: settings.signingState() }
    case 'signOut':
      return signOut(cwd)
    case 'addFolder':
      return args.path ? addFolder(typed(args.path, cwd), args.project, true) : addFolder(cwd, args.project)
    case 'removeFolder':
      return args.project ? removeFolder(cwd, args.project) : { error: 'bad_request' }
    case 'connections':
      return connections()
    case 'tasks':
      return tasks()
    case 'stopTask': {
      if (!args.task || !args.stop) return { error: 'bad_request' }
      const stopped = await api.stopTask(args.task, args.stop)
      return stopped.ok ? { stopped: true } : failure(stopped)
    }
  }
}

const GoalInput = z.object({
  id: z.string().optional().describe('A goal from wildcrane_draft_read to update; leave out for a new one.'),
  title: z.string().max(200),
  outcome: z.string().describe('What the user gets, in at most 150 words, in their language.'),
  acceptance: z.array(z.string()).describe('`Done when` checks a reviewer can verify.'),
  workflow: z.string().describe('One of the workflow ids wildcrane_draft_read lists.'),
  previews: z.array(z.string()).max(50).optional(),
})

/** 已开始目标链接任务，其余链接讨论。 */
const linked = (d: { id: string }, goals: ReturnType<typeof goalOf>[]) =>
  goals.map((i) => ({ ...i, url: i.task?.url ?? discussionUrl(d.id) }))

/** The Codex thread a call comes from, else this process: one Codex session runs one component. */
const PROCESS = `process-${crypto.randomUUID()}`
type Meta = { threadId?: unknown; 'x-codex-turn-metadata'?: { workspaces?: Record<string, unknown> } } | undefined
const threadOf = (meta: Meta) => `codex:${typeof meta?.threadId === 'string' && meta.threadId ? meta.threadId : PROCESS}`
const pathOf = (given: string | undefined, meta: Meta) => given || Object.keys(meta?.['x-codex-turn-metadata']?.workspaces ?? {})[0] || ''

const SIGNED_OUT = { error: 'signed_out', message: 'Not signed in to WildCrane. Call wildcrane_open_settings to open settings and sign in, then try again.' }
const PANEL_SIGNED_OUT = { error: 'signed_out', message: 'Not signed in to WildCrane. Tell the user to run /wildcrane and sign in, then try again.' }

export function server(): McpServer {
  const instructions = host === 'codex' && akbFile ? `When \`akb\` is not on PATH, run \`${akbFile}\` in its place.` : undefined
  const mcp = new McpServer({ name: 'wildcrane', version: VERSION }, { instructions })
  mcp.registerTool('wildcrane_open_settings', {
    description: '在当前电脑打开 WildCrane 设置，管理登录、项目文件夹和 AI 工具状态。参数仅预填上下文，不授予目录权限。用户要求设置时调用。',
    inputSchema: { path: z.string().optional(), project: z.string().optional() },
  }, async (context) => {
    try { return text(await openSettings(settings.settingsAction, context)) }
    catch { return { ...text({ error: 'settings_unavailable', message: '无法打开本机设置，请重试。' }), isError: true } }
  })
  const saveSchema = { discussionId: z.string(), expectedVersion: z.number().int(), goals: z.array(GoalInput).max(10).optional(), ideas: z.array(GoalInput).max(10).optional() }
  const save: ToolCallback<typeof saveSchema> = async ({ discussionId, expectedVersion, goals, ideas }) => {
    if (!readSession()) return { ...text(host === 'codex' ? SIGNED_OUT : PANEL_SIGNED_OUT), isError: true }
    if ((goals === undefined) === (ideas === undefined)) return { ...text({ error: 'bad_request', message: 'Provide exactly one of goals or ideas.' }), isError: true }
    const saved = await api.saveDraft(discussionId, expectedVersion, goals ?? ideas!)
    if (saved.ok) {
      const out = linked(saved.value, (saved.value.goals ?? saved.value.ideas).map(goalOf))
      return text({ saved: true, url: discussionUrl(discussionId), version: saved.value.version, goals: out, ideas: out })
    }
    if (saved.discussion) {
      const out = linked(saved.discussion, (saved.discussion.goals ?? saved.discussion.ideas).map(goalOf))
      return text({ saved: false, reason: 'The goals have changed. Merge your changes with the latest goals and save again.', url: discussionUrl(discussionId), version: saved.discussion.version, goals: out, ideas: out })
    }
    return { ...text({ saved: false, ...failure(saved) }), isError: true }
  }
  const saveWhat = '保存讨论中全部开放目标，必须使用最近读取的版本；遗漏的开放目标会被丢弃。保存不会开始任务，用户从网页开始。'

  if (host === 'codex') {
    mcp.registerTool('wildcrane_draft_read', {
      description: "Read this Codex session's WildCrane discussion: its goals, their version, the workflows a goal can use, and its web page. Opens one on first use, in the project of `path`.",
      inputSchema: {
        path: z.string().optional().describe('The current working directory. The component runs elsewhere and cannot see it.'),
        discussionId: z.string().optional().describe("Leave out for this session's discussion."),
      },
    }, async ({ path: given, discussionId }, extra) => {
      if (!readSession()) return { ...text(SIGNED_OUT), isError: true }
      let id = discussionId
      let project: { name: string; board: string } | null = null
      if (!id) {
        const session = threadOf(extra._meta as Meta)
        id = readChats().find((c) => c.session === session)?.discussion
        if (!id) {
          const dir = pathOf(given, extra._meta as Meta)
          const found = dir ? await folderOf(dir) : { folders: [], folder: null }
          if ('error' in found) return { ...text(found), isError: true }
          const opened = await open(session, found.folder?.project ?? null, dir)
          if ('error' in opened) return { ...text(opened), isError: true }
          id = opened.id
        }
      }
      const draft = await draftOf(id)
      if ('error' in draft) return { ...text(draft), isError: true }
      if (draft.project) {
        const list = await api.listFolders(machineId())
        const name = list.ok ? list.value.folders.find((f) => f.project === draft.project)?.name : undefined
        project = { name: name ?? draft.project, board: boardUrl(draft.project) }
      }
      return text({
        ...draft,
        url: discussionUrl(id),
        goals: linked({ id }, draft.goals ?? draft.ideas),
        ideas: linked({ id }, draft.goals ?? draft.ideas),
        project,
        ...(project ? {} : { note: 'This folder is not a WildCrane project: goals go to General. The user can ask to add it.' }),
      })
    })
    mcp.registerTool('wildcrane_draft_save', { description: saveWhat, inputSchema: saveSchema }, save)
    mcp.registerTool('wildcrane_status', {
      description: "WildCrane on this computer: whether the user is signed in, the projects added here with their boards (the one for `path` marked), this computer's recent discussions, which agent CLIs are ready, and `next` when the plugin needs an update, setup on this computer is unfinished, or a newer one is out.",
      inputSchema: { path: z.string().optional().describe('The current working directory.') },
    }, async ({ path: given }, extra) => {
      const dir = pathOf(given, extra._meta as Meta)
      const now = await state(dir || os.homedir())
      const found = (await connections()).connections
      if (!now.signedIn) return text({ signedIn: false, signing: settings.signingState(), connections: found })
      const recent = (await chats()).chats.map((c) => ({ title: c.title, goals: c.goals, ideas: c.goals, at: c.at, dir: c.dir, url: discussionUrl(c.discussion) }))
      const { next: _, ...rest } = now
      const next = nextOf(host, runnerState, now.plugin, { connections: found, folder: 'folder' in now ? now.folder : null, refused: 'refused' in now ? now.refused : undefined, web: now.web })
      return text({ ...rest, ...(next ? { next } : {}), dir: dir ? home(dir) : null, recent, connections: found })
    })
    mcp.registerTool('wildcrane_sign_in', {
      description: 'Sign in to WildCrane in the browser. When goal commands report signed out, call this and retry after sign-in. Answers at once when already signed in.',
      inputSchema: {},
    }, async () => {
      if (readSession()) return text({ signedIn: true })
      startSignIn()
      let signing = settings.signingState()
      const end = Date.now() + 5_000
      while (signing && !signing.url && !signing.failed && Date.now() < end) { await new Promise((r) => setTimeout(r, 50)); signing = settings.signingState() }
      return text({ signedIn: !!readSession(), opened: !!signing?.url, url: signing?.url ?? null, failed: signing?.failed ?? null,
        next: 'Finish signing in in the browser, then try again.' })
    })
    mcp.registerTool('wildcrane_add_folder', {
      description: 'Add a folder to WildCrane as a project on this computer, new or an existing one. Only when the user asks to.',
      inputSchema: {
        path: z.string().describe('The git root of the current working directory.'),
        project: z.string().optional().describe("An `elsewhere` project's id from `wildcrane_status`, to bind the folder to it; omit to make a new project."),
      },
    }, async ({ path: given, project }) => {
      if (!readSession()) return { ...text(SIGNED_OUT), isError: true }
      const added = await addFolder(given, project)
      return 'error' in added ? { ...text(added), isError: true } : text(added)
    })
    return mcp
  }

  const key = panelKey()
  mcp.registerTool('wildcrane_draft_read', {
    description: "Read a WildCrane discussion: its goals, their version, and the workflows a goal can use. Give `sessionId` for this Claude Code session's discussion, opened on first use.",
    inputSchema: {
      discussionId: z.string().optional(),
      sessionId: z.string().optional().describe("This Claude Code session's id, given at session start."),
    },
  }, async ({ discussionId, sessionId }) => {
    if (!readSession()) return { ...text(PANEL_SIGNED_OUT), isError: true }
    if (discussionId) return text(await draftOf(discussionId))
    if (!sessionId) return { ...text({ error: 'bad_request', message: 'Give discussionId or sessionId.' }), isError: true }
    return text(await sessionDraft(sessionId, process.cwd()))
  })
  mcp.registerTool('wildcrane_draft_save', { description: saveWhat, inputSchema: saveSchema }, save)
  mcp.registerTool('wildcrane_panel', {
    description: 'Used by the WildCrane panel only. Never call it.',
    inputSchema: PanelArgs,
  }, async (args) => (args.key === key ? text(await panel(args)) : { ...text({ error: 'not_yours' }), isError: true }))
  return mcp
}

export async function main(as: Host = 'claude-code'): Promise<void> {
  host = as
  useRunnerHome()
  writeShim()
  // stdout carries the protocol: whatever else the Runner prints goes to stderr.
  const write = process.stdout.write.bind(process.stdout)
  const out = new Writable({ write: (chunk, encoding, done) => void write(chunk, encoding, done) })
  process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write
  const transport = new StdioServerTransport(process.stdin, out)
  let accountWatch: ReturnType<typeof setInterval> | null = null
  let ending = false
  const end = async () => {
    if (ending) return
    ending = true
    if (accountWatch) clearInterval(accountWatch)
    await closeSettings()
    await runner?.close()
    process.exit(0)
  }
  transport.onclose = () => void end()
  process.stdin.on('end', () => void end())
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void end())
  await server().connect(transport)
  settings.onSettingsChange(() => { runner?.renew(); run() })
  accountWatch = setInterval(() => { if (!ending) run() }, 1000)
  accountWatch.unref()
  run()
  if (!process.env.WILDCRANE_JOB) void checkReleased()
}
