// The Claude Code (#2161) and Codex (#2160) plugins' local component, started by the host over
// stdio with every session. It gives the model two tools to draft a discussion's ideas, and runs
// the computer's jobs while no other WildCrane does (lock.ts). Claude Code's panel takes one more
// tool to sign in, add the folder, read and start ideas; Codex has no panel, so the model gets
// tools to sign in, add a folder and read the state, and ideas are started on the web. The host
// closing stdin ends it.

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Writable } from 'node:stream'

import { McpServer, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { readSession } from '../../cli/src/lib/cloud/session'
import * as api from './api'
import { startRunner, type Runner } from './connect'
import { WEB_URL, taskUrl } from './desktop'
import { allow, refusal } from './folders'
import { machineId, machineName, runnerHome, useRunnerHome } from './home'
import { VERSION } from './protocol'
import { LABELS, detectRuntimes, hints } from './runtimes'
import { signIn } from './signin'

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

/** An idea as the model and the panel read it. */
const ideaOf = (i: api.DraftIdea) => ({
  id: i.id,
  title: i.title,
  outcome: i.outcome,
  acceptance: i.acceptance,
  workflow: i.workflow,
  task: i.task ? { ...i.task, url: taskUrl(i.task.key || i.task.id) } : null,
})

async function workflowsOf(workspace: string) {
  const list = await api.listWorkflows(workspace)
  if (!list.ok) return []
  return list.value.data.map((w) => ({ id: w.id, name: w.name, names: w.names, description: w.description ?? '' }))
}

async function draftOf(id: string) {
  const read = await api.readDiscussion(id)
  if (!read.ok) return failure(read)
  const d = read.value
  return { discussion: d.id, project: d.project, version: d.version, ideas: d.ideas.map(ideaOf), workflows: await workflowsOf(d.workspace) }
}

/** The Runner: started once signed in, closed with the host. */
let runner: Runner | null = null
let runnerState: 'off' | 'waiting' | 'running' = 'off'
let host: Host = 'claude-code'

function run(): void {
  if (runner || process.env.WILDCRANE_JOB || !readSession()) return
  const id = machineId()
  runnerState = 'running'
  runner = startRunner({
    registration: async () => ({ machineId: id, machineName: machineName(), version: VERSION, runtimes: await detectRuntimes(true) }),
    kind: host,
    onWaiting: () => (runnerState = 'waiting'),
    onConnected: () => (runnerState = 'running'),
  })
  void runner.stopped.then(() => {
    runner = null
    runnerState = 'off'
  })
}

let signing: { url: string | null; failed: string | null } | null = null

function startSignIn(): void {
  if (signing?.url && !signing.failed) return
  signing = { url: null, failed: null }
  const held = signing
  void signIn({ onUrl: (url) => (held.url = url) }).then((failed) => {
    if (failed) held.failed = failed.why
    else {
      signing = null
      run()
    }
  })
}

/** This folder's project, when it was added. */
async function folderOf(cwd: string) {
  const list = await api.listFolders(machineId())
  if (!list.ok) return { ...failure(list), folders: [] as api.Folder[], folder: null }
  const real = realpath(cwd)
  return { folders: list.value.folders, folder: list.value.folders.find((f) => realpath(f.path) === real) ?? null }
}

async function state(cwd: string) {
  const base = { dir: home(cwd), runner: runnerState, web: WEB_URL() }
  if (!readSession()) return { ...base, signedIn: false, signing }
  const found = await folderOf(cwd)
  if ('error' in found) return { ...base, signedIn: true, ...found }
  const refused = found.folder ? null : refusal(cwd)
  return {
    ...base,
    signedIn: true,
    folder: found.folder,
    refused,
    projects: found.folders.map((f) => ({ ...f, dir: home(f.path), board: boardUrl(f.project) })),
    ...(found.folder || refused ? {} : { elsewhere: await elsewhere() }),
  }
}

/** The account's projects with no folder on this computer: the ones this folder can be bound to. */
async function elsewhere() {
  const list = await api.listElsewhere(machineId())
  if (!list.ok) return []
  return list.value.projects.map(({ project, name, workspace_name, personal }) => ({ project, name, workspace_name, personal }))
}

/** This folder as a project: `project` binds it to that existing one, else a new one is made. */
async function addFolder(cwd: string, bind?: string) {
  const why = refusal(cwd)
  if (why) return { error: why }
  const real = fs.realpathSync(cwd)
  const found = await folderOf(real)
  if ('error' in found) return found
  let project = found.folder?.project
  if (!project || (bind && bind !== project)) {
    const added = await api.addFolder(machineId(), path.basename(real) || real, real, bind)
    if (!added.ok) return failure(added)
    project = added.value.folder.project
  }
  allow(real)
  runner?.renew()
  return { added: true, project, board: boardUrl(project) }
}

async function chats() {
  const held = readChats().slice(0, 20)
  const read = await Promise.all(held.map((c) => api.readDiscussion(c.discussion)))
  return {
    chats: held.flatMap((c, n) => {
      const d = read[n]!
      if (!d.ok) return d.code === 'not_found' ? [] : [{ ...c, title: '', ideas: 0, offline: true }]
      return [{ ...c, dir: home(c.dir), title: d.value.title, ideas: d.value.ideas.length, at: d.value.updated_at }]
    }),
  }
}

async function connections() {
  const found = await detectRuntimes(true)
  return {
    connections: found.map((r) => {
      const hint = hints(r.name)
      const state = !r.installed ? 'notInstalled' : r.loggedIn === false ? 'signedOut' : 'ready'
      return { name: r.name, label: LABELS[r.name], state, command: state === 'notInstalled' ? hint.install : state === 'signedOut' ? hint.login : null }
    }),
  }
}

/** The host session's discussion, opened on Cloud and kept on this computer. */
async function open(session: string, project: string | null, cwd: string) {
  const opened = await api.openDiscussion(project, session, host)
  if (!opened.ok) return failure(opened)
  keepChat({ session, discussion: opened.value.id, project: project ?? '', dir: realpath(cwd), at: new Date().toISOString() })
  return opened.value
}

const PanelArgs = {
  key: z.string(),
  action: z.enum(['state', 'signIn', 'addFolder', 'chats', 'discussion', 'workflow', 'discard', 'start', 'connections']),
  session: z.string().optional(),
  cwd: z.string().optional(),
  discussion: z.string().optional(),
  idea: z.string().optional(),
  workflow: z.string().optional(),
  version: z.number().int().optional(),
  project: z.string().optional(),
}

type Panel = { [K in keyof typeof PanelArgs]: z.infer<(typeof PanelArgs)[K]> }

export async function panel(args: Panel): Promise<unknown> {
  const cwd = args.cwd ?? process.cwd()
  switch (args.action) {
    case 'state':
      return state(cwd)
    case 'signIn':
      startSignIn()
      return { signing }
    case 'addFolder':
      return addFolder(cwd, args.project)
    case 'chats':
      return chats()
    case 'discussion': {
      if (args.discussion) return draftOf(args.discussion)
      if (!args.session) return { error: 'bad_request' }
      const held = readChats().find((c) => c.session === args.session)
      if (held) return draftOf(held.discussion)
      const found = await folderOf(cwd)
      if ('error' in found) return found
      if (!found.folder) return { error: 'no_folder' }
      const opened = await open(args.session, found.folder.project, cwd)
      return 'error' in opened ? opened : draftOf(opened.id)
    }
    case 'workflow': {
      const set = await api.setIdeaWorkflow(args.discussion!, args.idea!, args.workflow!)
      return set.ok ? draftOf(args.discussion!) : failure(set)
    }
    case 'discard': {
      const dropped = await api.dropIdea(args.discussion!, args.idea!)
      return dropped.ok ? draftOf(args.discussion!) : failure(dropped)
    }
    case 'start': {
      const started = await api.startIdea(args.discussion!, args.idea!, args.version!)
      if (!started.ok) return failure(started)
      run()
      return { task: { ...started.value, url: taskUrl(started.value.key || started.value.id) } }
    }
    case 'connections':
      return connections()
  }
}

const IdeaInput = z.object({
  id: z.string().optional().describe('An idea from wildcrane_draft_read to update; leave out for a new one.'),
  title: z.string().max(200),
  outcome: z.string().describe('What the user gets, in at most 150 words, in their language.'),
  acceptance: z.array(z.string()).describe('`Done when` checks a reviewer can verify.'),
  workflow: z.string().describe('One of the workflow ids wildcrane_draft_read lists.'),
})

/** Each idea's page: its task once started, else the discussion's. */
const linked = (d: { id: string }, ideas: ReturnType<typeof ideaOf>[]) =>
  ideas.map((i) => ({ ...i, url: i.task?.url ?? discussionUrl(d.id) }))

/** The Codex thread a call comes from, else this process: one Codex session runs one component. */
const PROCESS = `process-${crypto.randomUUID()}`
type Meta = { threadId?: unknown; 'x-codex-turn-metadata'?: { workspaces?: Record<string, unknown> } } | undefined
const threadOf = (meta: Meta) => `codex:${typeof meta?.threadId === 'string' && meta.threadId ? meta.threadId : PROCESS}`
const pathOf = (given: string | undefined, meta: Meta) => given || Object.keys(meta?.['x-codex-turn-metadata']?.workspaces ?? {})[0] || ''

const SIGNED_OUT = { error: 'signed_out', message: 'Not signed in to WildCrane. Call wildcrane_sign_in, then try again.' }

export function server(): McpServer {
  const mcp = new McpServer({ name: 'wildcrane', version: VERSION })
  const save: ToolCallback<{ discussionId: z.ZodString; expectedVersion: z.ZodNumber; ideas: z.ZodArray<typeof IdeaInput> }> =
    async ({ discussionId, expectedVersion, ideas }) => {
      if (!readSession()) return { ...text(SIGNED_OUT), isError: true }
      const saved = await api.saveDraft(discussionId, expectedVersion, ideas)
      if (saved.ok) {
        const out = saved.value.ideas.map(ideaOf)
        return text({ saved: true, version: saved.value.version, ideas: host === 'codex' ? linked(saved.value, out) : out })
      }
      if (saved.discussion) {
        return text({ saved: false, reason: 'The ideas changed since you read them. Merge your changes into these and save again.',
          version: saved.discussion.version, ideas: saved.discussion.ideas.map(ideaOf) })
      }
      return { ...text({ saved: false, ...failure(saved) }), isError: true }
    }
  const saveSchema = { discussionId: z.string(), expectedVersion: z.number().int(), ideas: z.array(IdeaInput).max(10) }
  const saveWhat = 'Save the whole set of open ideas of a WildCrane discussion against the version last read. An open idea left out is discarded. Starts nothing: only the user starts an idea.'

  if (host === 'codex') {
    mcp.registerTool('wildcrane_draft_read', {
      description: "Read this Codex session's WildCrane discussion: its ideas, their version, the workflows an idea can use, and its web page. Opens one on first use, in the project of `path`.",
      inputSchema: {
        path: z.string().describe('The current working directory. The component runs elsewhere and cannot see it.'),
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
        ideas: linked({ id }, draft.ideas),
        project,
        ...(project ? {} : { note: 'This folder is not a WildCrane project: ideas go to General. The user can ask to add it.' }),
      })
    })
    mcp.registerTool('wildcrane_draft_save', { description: saveWhat, inputSchema: saveSchema }, save)
    mcp.registerTool('wildcrane_status', {
      description: "WildCrane on this computer: whether the user is signed in, the projects added here with their boards (the one for `path` marked), this computer's recent discussions, and which agent CLIs are ready.",
      inputSchema: { path: z.string().optional().describe('The current working directory.') },
    }, async ({ path: given }, extra) => {
      const dir = pathOf(given, extra._meta as Meta)
      const now = await state(dir || os.homedir())
      if (!now.signedIn) return text({ signedIn: false, signing, connections: (await connections()).connections })
      const recent = (await chats()).chats.map((c) => ({ title: c.title, ideas: c.ideas, at: c.at, dir: c.dir, url: discussionUrl(c.discussion) }))
      return text({ ...now, dir: dir ? home(dir) : null, recent, connections: (await connections()).connections })
    })
    mcp.registerTool('wildcrane_sign_in', {
      description: 'Sign in to WildCrane in the browser. Answers at once when already signed in.',
      inputSchema: {},
    }, async () => {
      if (readSession()) return text({ signedIn: true })
      startSignIn()
      const end = Date.now() + 5_000
      while (signing && !signing.url && !signing.failed && Date.now() < end) await new Promise((r) => setTimeout(r, 50))
      return text({ signedIn: !!readSession(), opened: !!signing?.url, url: signing?.url ?? null, failed: signing?.failed ?? null,
        next: 'Finish signing in in the browser, then try again.' })
    })
    mcp.registerTool('wildcrane_add_folder', {
      description: 'Add a folder to WildCrane as a project on this computer. Only when the user asks to.',
      inputSchema: { path: z.string().describe('The git root of the current working directory.') },
    }, async ({ path: given }) => {
      if (!readSession()) return { ...text(SIGNED_OUT), isError: true }
      const added = await addFolder(given)
      return 'error' in added ? { ...text(added), isError: true } : text(added)
    })
    return mcp
  }

  const key = panelKey()
  mcp.registerTool('wildcrane_draft_read', {
    description: 'Read a WildCrane discussion: its ideas, their version, and the workflows an idea can use.',
    inputSchema: { discussionId: z.string() },
  }, async ({ discussionId }) => text(await draftOf(discussionId)))
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
  // stdout carries the protocol: whatever else the Runner prints goes to stderr.
  const write = process.stdout.write.bind(process.stdout)
  const out = new Writable({ write: (chunk, encoding, done) => void write(chunk, encoding, done) })
  process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write
  const transport = new StdioServerTransport(process.stdin, out)
  let ending = false
  const end = async () => {
    if (ending) return
    ending = true
    await runner?.close()
    process.exit(0)
  }
  transport.onclose = () => void end()
  process.stdin.on('end', () => void end())
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => void end())
  await server().connect(transport)
  run()
}
