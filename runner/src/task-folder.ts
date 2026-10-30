// A task's folder (#2037): the project's board kept on this computer across jobs, a working copy
// of its files in the workspace's Cloud `Board` (#2081, #2114): `projects/<id>/` is the board's
// root, and the shared memory its agents declare the workspace's (#2093) sits at `memory/<name>`
// in both. Before a job it sends what changed here, then reads what changed since it last read,
// in one call, and resets the board's files to Cloud's; after it, and whenever a file changes
// (#59), every changed file goes back in one write on the `seq` each was read at. Refused, the
// files both sides changed are merged here and written once more. A folder's reads and writes
// take turns. What it last read is the base, `.akb/base.json` in the project's folder. Triage
// items are board files too (#2107). A project's periodic agent works on the same board for no
// task (#2068).

import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { diff3Merge } from 'node-diff3'

import { BOARD_FILE_LIMIT, BUILDER, assetsFile, cardFront, draftFolder, isBoardPath, isSettingsPath, workflowFolder, workflowName } from '../../cloud/src/board-files.ts'
import { itemAt, stampItem } from '../../cloud/src/triage-files.ts'
import { projectStateDir } from '../../cli/src/lib/machine/project'
import * as api from './api'
import type { Assets, Job } from './api'
import { busy, cacheDir, markUsed, markUnsent } from './cache'
import { sharedMemory, type Shared } from './memory-files'

export { workflowFolder }

export interface TaskFolder {
  /** What its records here are kept under: the task, or a periodic agent's own name. */
  task: string
  /** The Cloud task the job works for: its memory, tools and assets are that task's. Null for a
   *  periodic agent, which keeps the project's memory alone. */
  cloudTask: string | null
  /** The board: `<project>/.akb/kanban`; the project is `~/.wildcrane/cache/<project>` without a folder. */
  board: string
  /** Where the agent runs. */
  cwd: string
  project: string
  /** The task's short number, which its card file starts with. */
  number: number | null
  /** The task's workflow, e.g. `wf_builtin_coding`. */
  workflow: string | null
}

interface Entry {
  version: number
  hash: string
}

/** What this computer keeps of one task beside the board: its assets and its workflow's tools. */
interface Record_ {
  /** `kind` is the artifact's type (#2003); an `html` one is the page a mockup draws, and its
   *  hash is the page's. */
  assets: { [path: string]: Entry & { artifact: string; kind?: Kind } }
  /** The agents a Workflow builder task's draft copied to the board's `agents/`, by file hash. */
  agents?: { [path: string]: string }
  /** Its skills written into the project, by file hash, and the MCP servers its runs get (#2030). */
  tools?: { skills: { [path: string]: string }; mcp: McpServers }
  /** The task runs on akb's own workflow and agents. */
  builtin?: boolean
}

/** What the board last read from Cloud, or wrote to it: each file by its path in the workspace's
 *  board. */
interface Base {
  /** A base from before the workspace's board (#2114) is read again whole. */
  layout?: 'workspace'
  head_seq: number | null
  workspace?: string | null
  project?: string
  files: { [path: string]: { seq: number; content: string } }
}

export type Pushed =
  | { ok: true; changed: boolean }
  | { ok: false; conflict: boolean; error: string; offline?: boolean }

const TASK_ID = /^[\w-]{1,100}$/
const EMPTY: Record_ = { assets: {} }

/** Without a folder the task runs in its project's own, in the cache. */
export function openTaskFolder(job: Pick<Job, 'task' | 'project' | 'number' | 'workflow' | 'flow'>, projectDir: string | null): TaskFolder {
  const task = job.task ?? ''
  if (!TASK_ID.test(task)) throw new Error('This job names no task.')
  if (!job.project) throw new Error('This job names no project.')
  projectDir ??= openCached(job.project)
  keepOutOfGit(projectDir)
  markUsed(projectDir)
  const board = path.join(projectDir, '.akb', 'kanban')
  fs.mkdirSync(board, { recursive: true })
  return { task, cloudTask: task, board, cwd: projectDir, project: job.project, number: job.number ?? null, workflow: job.workflow ?? job.flow?.workflow ?? null }
}

/** A periodic agent's folder (#2068): the project's board, where a reflect works for the first
 *  task it reads. */
export function openAgentFolder(job: Pick<Job, 'project' | 'agent'>, projectDir: string): TaskFolder {
  if (!job.project || !job.agent) throw new Error('This job names no project.')
  keepOutOfGit(projectDir)
  markUsed(projectDir)
  const board = path.join(projectDir, '.akb', 'kanban')
  fs.mkdirSync(board, { recursive: true })
  return {
    task: `agent-${safe(job.agent.workflow ? `${job.agent.workflow}-${job.agent.name}` : job.agent.name)}`,
    cloudTask: job.agent.tasks?.[0]?.id ?? null,
    board,
    cwd: projectDir,
    project: job.project,
    number: null,
    workflow: job.agent.workflow ?? null,
  }
}

/** A discussion's folder (#2110): the project's board, as an agent job's. */
export function openDiscussionFolder(job: Pick<Job, 'project'>, projectDir: string): TaskFolder {
  if (!job.project) throw new Error('This job names no project.')
  keepOutOfGit(projectDir)
  markUsed(projectDir)
  const board = path.join(projectDir, '.akb', 'kanban')
  fs.mkdirSync(board, { recursive: true })
  return { task: 'discussion', cloudTask: null, board, cwd: projectDir, project: job.project, number: null, workflow: null }
}

/** The board itself, for no task: what a change made outside a job goes back as (#59). */
const boardFolder = (ws: Pick<TaskFolder, 'board' | 'cwd' | 'project'>): TaskFolder =>
  ({ task: 'board', cloudTask: null, board: ws.board, cwd: ws.cwd, project: ws.project, number: null, workflow: null })

/** The board a project folder here keeps for Cloud, once read from it; null when never read. */
export function keptBoard(cwd: string): TaskFolder | null {
  const board = path.join(cwd, '.akb', 'kanban')
  const base = readBase({ cwd })
  const project = base.project ?? /^projects\/([^/]+)\//.exec(Object.keys(base.files).find((p) => p.startsWith('projects/')) ?? '')?.[1]
  return base.head_seq === null || !project ? null : boardFolder({ board, cwd, project })
}

const turns = new Map<string, Promise<unknown>>()

/** One read or write of a folder's board at a time. */
function inFolder<T>(dir: string, work: () => Promise<T>): Promise<T> {
  const next = (turns.get(dir) ?? Promise.resolve()).then(work, work)
  const held = next.catch(() => {})
  turns.set(dir, held)
  void held.then(() => turns.get(dir) === held && turns.delete(dir))
  return next
}

const safe = (name: string) => name.replace(/[^\w.-]/g, '_') || 'default'

/** A git repository with one commit, so a build gets a worktree as in a project. */
function openCached(project: string): string {
  const dir = cacheDir(project)
  if (fs.existsSync(path.join(dir, '.git'))) return dir
  fs.mkdirSync(dir, { recursive: true })
  const git = (...args: string[]) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).status === 0
  if (git('init', '-q')) git('-c', 'user.name=WildCrane', '-c', 'user.email=runner@wildcrane.ai', 'commit', '-q', '--allow-empty', '-m', 'general')
  return dir
}

/** The kanban skill the Runner installs in a project for akb's runs. */
export const SKILL_FOLDERS = ['.claude/skills/kanban', '.agents/skills/kanban']

/** Where a workflow's skills go in the project, beside the kanban skill. */
const SKILL_ROOTS = ['.claude/skills', '.agents/skills']

/** `.akb/` never reaches the project's history: excluded locally unless already ignored. */
function keepOutOfGit(dir: string, folders: string[] = SKILL_FOLDERS): void {
  const git = (...args: string[]) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' })
  const inside = git('rev-parse', '--git-path', 'info/exclude')
  if (inside.status !== 0) return
  const missing = ['.akb/', ...folders.map((f) => `${f}/`)].filter((p) => git('check-ignore', '-q', p).status !== 0)
  if (!missing.length) return
  const exclude = path.resolve(dir, inside.stdout.trim())
  fs.mkdirSync(path.dirname(exclude), { recursive: true })
  const held = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : ''
  fs.writeFileSync(exclude, `${held}${held && !held.endsWith('\n') ? '\n' : ''}${missing.join('\n')}\n`)
}

/** The card's file: akb's `todo/<number>-<slug>.md`, a group's `root.md`, or wherever akb moved it since. */
export const cardFile = (ws: TaskFolder): string =>
  (ws.number ? findCard(ws.board, ws.number) : null) ?? path.join(ws.board, 'todo', `${ws.number ?? 0}-task.md`)

/** Card `number` under `todo/` or `.archive/`, at any depth. */
export function findCard(board: string, number: number): string | null {
  const named = new RegExp(`^${number}-`)
  const walk = (dir: string): string | null => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return null
    }
    for (const e of entries) {
      if (!named.test(e.name)) continue
      if (e.isFile() && e.name.endsWith('.md')) return path.join(dir, e.name)
      const root = path.join(dir, e.name, 'root.md')
      if (e.isDirectory() && fs.existsSync(root)) return root
    }
    for (const e of entries) if (e.isDirectory() && !e.name.startsWith('.')) {
      const hit = walk(path.join(dir, e.name))
      if (hit) return hit
    }
    return null
  }
  return walk(path.join(board, 'todo')) ?? walk(path.join(board, '.archive'))
}

/** The akb id of the task's card on this board, once it has one: the task's number. */
export function akbCardOf(ws: TaskFolder): number | undefined {
  return ws.number && findCard(ws.board, ws.number) ? ws.number : undefined
}

const recordFile = (ws: TaskFolder) => path.join(ws.board, '.sync', `${ws.task}.json`)

function readRecord(ws: TaskFolder): Record_ {
  try {
    return { ...EMPTY, ...(JSON.parse(fs.readFileSync(recordFile(ws), 'utf8')) as Partial<Record_>) }
  } catch {
    return structuredClone(EMPTY)
  }
}

function writeRecord(ws: TaskFolder, record: Record_): void {
  fs.mkdirSync(path.dirname(recordFile(ws)), { recursive: true })
  fs.writeFileSync(recordFile(ws), `${JSON.stringify(record, null, 2)}\n`)
}

const baseFile = (ws: Pick<TaskFolder, 'cwd'>) => path.join(ws.cwd, '.akb', 'base.json')

function readBase(ws: Pick<TaskFolder, 'cwd'>): Base {
  try {
    const base = JSON.parse(fs.readFileSync(baseFile(ws), 'utf8')) as Base
    if (base.layout === 'workspace') return base
  } catch {
    // Never read.
  }
  return { layout: 'workspace', head_seq: null, files: {} }
}

function writeBase(ws: TaskFolder, base: Base): void {
  const file = baseFile(ws)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(base))
  fs.renameSync(`${file}.tmp`, file)
}

const hashOf = (bytes: Uint8Array | string) => crypto.createHash('sha256').update(bytes).digest('hex')

function hashFile(file: string): string | null {
  try {
    return hashOf(fs.readFileSync(file))
  } catch {
    return null
  }
}

function write(file: string, bytes: Uint8Array | string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, bytes)
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

/** Every file under `dir`, as `/`-joined paths relative to `base`. */
export function filesUnder(dir: string, base = dir): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries.flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return filesUnder(full, base)
    return e.isFile() ? [path.relative(base, full).split(path.sep).join('/')] : []
  })
}

/** The board files Cloud keeps. */
const kept = isBoardPath

const MEMORY = 'memory/'
const rootOf = (ws: TaskFolder) => `projects/${ws.project}/`

/** Where a file of this board sits in the workspace's: memory its agents share is the workspace's. */
const remoteOf = (ws: TaskFolder, shared: Shared, p: string) =>
  p.startsWith(MEMORY) && shared(p.slice(MEMORY.length)) ? p : rootOf(ws) + p

/** The board as Cloud holds it, by this board's paths: the project's files, then the shared memory
 *  over a project file at the same path. */
function viewOf(ws: TaskFolder, base: Base, shared: Shared): Map<string, string> {
  const root = rootOf(ws)
  const view = new Map<string, string>()
  for (const [p, f] of Object.entries(base.files)) if (p.startsWith(root)) view.set(p.slice(root.length), f.content)
  for (const [p, f] of Object.entries(base.files)) if (p.startsWith(MEMORY) && shared(p.slice(MEMORY.length))) view.set(p, f.content)
  return view
}

/** The files the task's assets list names, which are artifacts', not the board's. */
function assetFiles(ws: TaskFolder, list: string | null | undefined): Set<string> {
  const card = cardFile(ws)
  return new Set(Object.keys(assetsOf(list)).map((name) => assetPath(ws, name, card)).filter((f): f is string => !!f)
    .map((f) => path.relative(ws.board, f).split(path.sep).join('/')))
}

const assetsListOf = (ws: TaskFolder, base: Base) => base.files[rootOf(ws) + assetsFile(ws.task)]?.content

const localFiles = (ws: TaskFolder, base: Base) => {
  const assets = assetFiles(ws, assetsListOf(ws, base))
  return filesUnder(ws.board).filter((p) => kept(p) && !assets.has(p))
}

export interface McpServers {
  [name: string]: { command: string; args?: string[] }
}

const SKILL_PATH = /^skills\/([a-z0-9]+(?:-[a-z0-9]+)*)\/((?:[\w.-]+\/)*[\w.-]+)$/

/** Write the version's skills into the project, only what changed, and drop the ones it no
 *  longer has. A skill folder the project already holds of its own is left alone. */
function pullTools(ws: TaskFolder, record: Record_, files: Record<string, string>): void {
  const held = record.tools?.skills ?? {}
  const ours = new Set(Object.keys(held).map((name) => name.split('/')[1]))
  const theirs = (skill: string) => !ours.has(skill) && SKILL_ROOTS.some((root) => fs.existsSync(path.join(ws.cwd, root, skill)))
  const kept = Object.keys(files).map((name) => SKILL_PATH.exec(name)?.[1]).filter((skill) => skill && !theirs(skill))
  const skills: Record<string, string> = {}
  for (const [name, text] of Object.entries(files)) {
    const at = SKILL_PATH.exec(name)
    if (!at || at[1] === 'kanban' || !kept.includes(at[1]) || at[2]!.split('/').includes('..')) continue
    skills[name] = hashOf(text)
    for (const root of SKILL_ROOTS) {
      const file = path.join(ws.cwd, root, at[1]!, at[2]!)
      if (held[name] !== skills[name] || hashFile(file) !== skills[name]) write(file, text)
    }
  }
  for (const name of Object.keys(held)) {
    if (skills[name]) continue
    const [, skill, rest] = SKILL_PATH.exec(name) ?? []
    if (!skill || !rest) continue
    for (const root of SKILL_ROOTS) {
      fs.rmSync(path.join(ws.cwd, root, skill, rest), { force: true })
      if (!Object.keys(skills).some((n) => n.startsWith(`skills/${skill}/`))) fs.rmSync(path.join(ws.cwd, root, skill), { recursive: true, force: true })
    }
  }
  const names = [...new Set(Object.keys(skills).map((name) => name.split('/')[1]!))]
  if (names.length) keepOutOfGit(ws.cwd, SKILL_ROOTS.flatMap((root) => names.map((n) => `${root}/${n}`)))
  let mcp: McpServers = {}
  try {
    mcp = (JSON.parse(files['mcp.json'] ?? '{}') as { mcpServers?: McpServers }).mcpServers ?? {}
  } catch {
    // Checked by Cloud; a broken one gives no servers.
  }
  record.tools = { skills, mcp }
}

/** The MCP servers the task's workflow gives its runs. */
export const mcpServersOf = (ws: TaskFolder): McpServers => readRecord(ws).tools?.mcp ?? {}

/** The task's workflow, from `workflows/<folder>/` on the board: its skills into the project. A
 *  built-in's workflow is akb's own. A board missing the folder reads the version from Cloud,
 *  which writes it there. Every workflow's agents then go to the board's `agents/`. */
async function pullWorkflow(ws: TaskFolder, record: Record_, base: Base): Promise<api.Call<void>> {
  let files: Record<string, string> = {}
  if (ws.workflow) {
    const root = `workflows/${workflowFolder(ws.workflow)}/`
    const held = rootOf(ws) + root
    files = Object.fromEntries(Object.entries(base.files).filter(([p]) => p.startsWith(held) && isBoardPath(p.slice(rootOf(ws).length)))
      .map(([p, f]) => [p.slice(held.length), f.content]))
    record.builtin = ws.workflow.startsWith('wf_builtin_')
    let found = Object.keys(files).length > 0
    if (!found && ws.cloudTask) {
      const read = await api.readTaskWorkflow(ws.cloudTask)
      if (!read.ok && read.code !== 'not_found') return read
      if (read.ok) {
        files = read.value.files
        found = true
        if (!record.builtin) for (const [name, text] of Object.entries(files)) if (isBoardPath(root + name)) write(path.join(ws.board, root, name), text)
      }
    }
    if (found) pullTools(ws, record, files)
  }
  pullAgents(ws, base, ws.workflow && !record.builtin ? files : {})
  const placed = readPlaced(ws)
  // A draft's agents are put back by `pullDraftAgents`.
  for (const name of Object.keys(record.agents ?? {})) if (!placed[name]) fs.rmSync(path.join(ws.board, name), { force: true })
  record.agents = {}
  return { ok: true, value: undefined }
}

/** A workflow the project made: not akb's own, and not a Workflow builder task's draft. */
const OWN_FOLDER = /^wf-(?!builtin-)[a-z0-9-]+$/

const agentsRecord = (ws: TaskFolder) => path.join(ws.board, '.sync', 'agents.json')

/** The workflows' agents this board last placed, by file hash. */
function readPlaced(ws: TaskFolder): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(agentsRecord(ws), 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

/** The agents of every workflow the project made, in `agents/` (#2106), so a periodic agent's
 *  run sees them too; an agent two workflows name is the task's own workflow's, else the first
 *  folder's. One no workflow names any more goes. */
function pullAgents(ws: TaskFolder, base: Base, own: Record<string, string>): void {
  const root = rootOf(ws) + 'workflows/'
  const flows = new Map<string, Record<string, string>>()
  for (const [p, f] of Object.entries(base.files)) {
    if (!p.startsWith(root)) continue
    const [folder, ...rest] = p.slice(root.length).split('/')
    if (!OWN_FOLDER.test(folder!) || rest[0] !== 'agents') continue
    if (!flows.has(folder!)) flows.set(folder!, {})
    flows.get(folder!)![rest.join('/')] = f.content
  }
  const agents: Record<string, string> = {}
  const taken = new Set<string>()
  for (const files of [own, ...[...flows.keys()].sort().map((k) => flows.get(k)!)]) {
    const names = new Set<string>()
    for (const [name, text] of Object.entries(files)) {
      const agent = /^agents\/([^/]+)\//.exec(name)?.[1]
      const file = path.resolve(ws.board, name)
      if (!agent || taken.has(agent) || !file.startsWith(path.join(ws.board, 'agents') + path.sep)) continue
      names.add(agent)
      agents[name] = text
    }
    for (const n of names) taken.add(n)
  }
  const before = readPlaced(ws)
  const hashes: Record<string, string> = {}
  for (const [name, text] of Object.entries(agents)) {
    hashes[name] = hashOf(text)
    if (hashFile(path.join(ws.board, name)) !== hashes[name]) write(path.join(ws.board, name), text)
  }
  for (const name of Object.keys(before)) if (!hashes[name]) fs.rmSync(path.join(ws.board, name), { force: true })
  write(agentsRecord(ws), `${JSON.stringify(hashes, null, 2)}\n`)
}

/** A Workflow builder task's draft keeps the agents it writes (#2004); akb reads them in `agents/`. */
function pullDraftAgents(ws: TaskFolder, record: Record_): void {
  if (ws.workflow !== BUILDER) return
  const root = path.join(ws.board, 'workflows', draftFolder(ws.task), 'agents')
  record.agents ??= {}
  for (const name of filesUnder(root)) {
    const text = fs.readFileSync(path.join(root, name))
    const at = `agents/${name}`
    record.agents[at] = hashOf(text)
    if (hashFile(path.join(ws.board, at)) !== record.agents[at]) write(path.join(ws.board, at), text)
  }
}

/** Where the task's workflow sits, for the agent; null when it has none here or it is akb's own. */
export function workflowFile(ws: TaskFolder): string | null {
  if (!ws.workflow || readRecord(ws).builtin) return null
  const file = path.join(ws.board, 'workflows', workflowFolder(ws.workflow), 'WORKFLOW.md')
  return fs.existsSync(file) ? file : null
}

/** An asset path the body names: akb's `.assets/` and `.mockups/` in the board's state folder,
 *  anything else relative to the card; never outside either. */
function assetPath(ws: TaskFolder, name: string, card: string): string | null {
  if (/^[a-z][\w+.-]*:/i.test(name) || name.startsWith('/') || name.startsWith('#')) return null
  const held = /^\.(assets|mockups)\//.exec(name)
  if (held) {
    const state = stateDir(ws)
    const file = state && path.resolve(state, held[1]!, name.slice(held[0].length))
    return file && file.startsWith(path.join(state, held[1]!) + path.sep) ? file : null
  }
  const file = path.resolve(path.dirname(card), name)
  return file.startsWith(ws.board + path.sep) ? file : null
}

/** Where the card's `.assets/<id>/` files are. */
export function cardAssetsDir(ws: TaskFolder, id: number): string | null {
  const state = stateDir(ws)
  return state && path.join(state, 'assets', String(id))
}

function stateDir(ws: TaskFolder): string | null {
  try {
    return projectStateDir(ws.board)
  } catch {
    return null
  }
}

function assetsOf(text: string | null | undefined): Assets {
  try {
    const held = JSON.parse(text ?? '{}') as unknown
    return held && typeof held === 'object' && !Array.isArray(held) ? (held as Assets) : {}
  } catch {
    return {}
  }
}

const assetsText = (assets: Assets) => `${JSON.stringify(assets, null, 2)}\n`

/** Bring the folder up to Cloud: what changed here goes first, then what changed since the base,
 *  in one call, and the board's files reset to it. Nothing here is overwritten while it cannot
 *  be sent. */
export function pull(ws: TaskFolder, machineId: string): Promise<api.Call<void>> {
  return inFolder(ws.cwd, async () => {
    const sent = await sendBoard(boardFolder(ws), machineId)
    if (!sent.ok) return { ok: false, error: `This computer's board changes could not be sent: ${sent.error}`, ...(sent.offline ? {} : { code: 'version_conflict' }) }
    return readCloud(ws)
  })
}

async function readCloud(ws: TaskFolder): Promise<api.Call<void>> {
  const base = readBase(ws)
  const known = new Set(Object.keys(base.files))
  if (base.workspace === undefined) {
    const project = await api.readProject(ws.project)
    if (!project.ok) return project
    base.workspace = project.value.workspace ?? null
  }
  const read = await api.readBoard(ws.project, base.head_seq)
  if (!read.ok) return read
  if (base.head_seq === null) base.files = {}
  for (const f of read.value.files) {
    if (f.content === null) delete base.files[f.path]
    else base.files[f.path] = { seq: f.seq, content: f.content }
  }
  base.head_seq = read.value.head_seq
  base.project = ws.project
  writeBase(ws, base)

  const reset = (view: Map<string, string>) => {
    for (const [p, content] of view) {
      const file = path.join(ws.board, p)
      if (kept(p) && readText(file) !== content) write(file, content)
    }
  }
  const view = viewOf(ws, base, sharedMemory(ws.board))
  // A settings file Cloud has never held is this board's own until its next push (#2106).
  const first = (p: string) => isSettingsPath(p) && !known.has(rootOf(ws) + p)
  for (const p of localFiles(ws, base)) if (!view.has(p) && !first(p)) fs.rmSync(path.join(ws.board, p), { force: true })
  reset(view)

  const record = readRecord(ws)
  const workflow = await pullWorkflow(ws, record, base)
  if (!workflow.ok) return workflow
  pullDraftAgents(ws, record)
  // The workflow's agents may share more than the board's did.
  reset(viewOf(ws, base, sharedMemory(ws.board)))
  const assets = await pullAssets(ws, record, assetsOf(assetsListOf(ws, base)))
  if (!assets.ok) return assets
  writeRecord(ws, record)
  writeIndex(ws.board)
  return { ok: true, value: undefined }
}

/** `todo/README.md`, which Cloud never keeps, written again from the cards in `todo/`: each card
 *  there, and each group by its root. */
export function writeIndex(board: string): void {
  const todo = path.join(board, 'todo')
  const cards: { id: number; title: string; link: string }[] = []
  let entries: fs.Dirent[] = []
  try {
    entries = fs.readdirSync(todo, { withFileTypes: true })
  } catch {
    // No cards yet.
  }
  for (const e of entries) {
    const id = /^(\d+)-/.exec(e.name)?.[1]
    if (!id) continue
    const link = e.isDirectory() ? `${e.name}/root.md` : e.name.endsWith('.md') ? e.name : null
    const text = link && readText(path.join(todo, link))
    if (text === null || !link) continue
    cards.push({ id: Number(id), title: cardFront(text).title ?? e.name.replace(/\.md$/, ''), link })
  }
  cards.sort((a, b) => a.id - b.id)
  const list = cards.length ? cards.map((c) => `- [#${c.id} ${c.title}](${c.link})`).join('\n') : '_(none)_'
  const text = `# Board\n\nOpen tasks for the kanban board. One card per file. Ids are global and never reused —\nthe number at the front of a filename is the task id.\n\n## Tasks\n\n${list}\n`
  if (readText(path.join(todo, 'README.md')) !== text) write(path.join(todo, 'README.md'), text)
}

/** The task's workspace, as its last pull read it. */
export const workspaceOf = (ws: TaskFolder): string | null => readBase(ws).workspace ?? null

async function pullAssets(ws: TaskFolder, record: Record_, assets: Assets): Promise<api.Call<void>> {
  const file = cardFile(ws)
  const out: Record_['assets'] = {}
  for (const [name, ref] of Object.entries(assets)) {
    const target = assetPath(ws, name, file)
    if (!target) continue
    let version = ref.version
    if (version === undefined) {
      const latest = await api.readArtifact(ref.artifact)
      if (!latest.ok) return latest
      version = latest.value.latest_version ?? 0
    }
    const held = record.assets[name]
    if (held?.kind === 'html' && held.artifact === ref.artifact) {
      out[name] = { ...held, version }
      continue
    }
    if (held?.artifact === ref.artifact && held.version === version && hashFile(target) === held.hash) {
      out[name] = held
      continue
    }
    const bytes = await readAsset(ref.artifact, version)
    if (!bytes.ok) return bytes
    write(target, bytes.value)
    out[name] = { artifact: ref.artifact, version, hash: hashOf(bytes.value) }
  }
  record.assets = out
  return { ok: true, value: undefined }
}

async function readAsset(artifact: string, version: number): Promise<api.Call<Uint8Array>> {
  const held = await api.readVersion(artifact, version)
  if (!held.ok) return held
  if (held.value.file) return api.download(held.value.file.url)
  const content = held.value.content
  return { ok: true, value: Buffer.from(typeof content === 'string' ? content : JSON.stringify(content)) }
}

const TYPES: { [ext: string]: string } = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf',
  '.html': 'text/html', '.md': 'text/markdown', '.mdx': 'text/markdown', '.mov': 'video/quicktime', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.json': 'application/json', '.txt': 'text/plain',
}

type Kind = 'html' | 'markdown' | 'image' | 'video' | 'asset'

interface Sent {
  bytes: Uint8Array
  type: string
  kind: Kind
}

/** The artifact type a review draws a file as; anything else is a download. */
function kindOf(ext: string): Kind {
  if (ext === '.tsx' || ext === '.html') return 'html'
  if (ext === '.md' || ext === '.mdx') return 'markdown'
  const type = TYPES[ext] ?? ''
  if (type.startsWith('image/')) return 'image'
  return type.startsWith('video/') || type.startsWith('audio/') ? 'video' : 'asset'
}

/** What goes up for a file: a mockup as the page it draws, anything else as it is. */
async function sentOf(file: string): Promise<Sent> {
  const ext = path.extname(file).toLowerCase()
  const kind = kindOf(ext)
  if (kind !== 'html') return { bytes: fs.readFileSync(file), type: TYPES[ext] ?? 'application/octet-stream', kind }
  let page: string
  try {
    page = await (await import('./mockup')).drawMockup(file)
  } catch (e) {
    console.error(`runner: ${path.basename(file)} could not be drawn: ${e instanceof Error ? e.message : String(e)}`)
    page = UNDRAWN
  }
  return { bytes: Buffer.from(page), type: 'text/html', kind }
}

const UNDRAWN = '<!doctype html><html><head><meta charset="utf-8"></head>' +
  '<body style="font:14px system-ui;color:#555;display:grid;place-items:center;height:100vh;margin:0;text-align:center">' +
  '<p>This screen could not be drawn.<br>无法显示此界面。</p></body></html>'

async function uploadAsset(artifact: string, { bytes, type }: Sent): Promise<api.Call<number>> {
  const upload = await api.createUpload(artifact, type, Math.max(bytes.length, 1))
  if (!upload.ok) return upload
  const put = await api.upload(`/v1/uploads/${encodeURIComponent(upload.value.id)}`, bytes, type)
  if (!put.ok) return put
  const version = await api.createVersion(artifact, upload.value.id)
  return version.ok ? { ok: true, value: version.value.version } : version
}

/** Relative files the body links or embeds. */
function namedFiles(body: string): string[] {
  const out = new Set<string>()
  for (const m of body.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|\bsrc=["']([^"']+)["']/g)) out.add((m[1] ?? m[2])!)
  return [...out]
}

/** Changed or new assets the card names, uploaded as artifact versions; the task's assets list
 *  then says what the card shows. */
async function pushAssets(ws: TaskFolder, record: Record_, before: Assets): Promise<api.Call<void>> {
  const file = cardFile(ws)
  const body = readText(file)
  if (body === null) return { ok: true, value: undefined }
  const refs: Assets = {}
  const assets: Record_['assets'] = {}
  for (const [name, ref] of Object.entries(before)) {
    if (!body.includes(name)) continue
    const target = assetPath(ws, name, file)
    const held = record.assets[name]
    const out = target && held && fs.existsSync(target) ? await sentOf(target) : null
    const hash = out && hashOf(out.bytes)
    if (out && held && (held.kind === 'html') !== (out.kind === 'html')) continue
    if (held && out && hash !== held.hash) {
      const sent = await uploadAsset(held.artifact, out)
      if (!sent.ok) return sent
      assets[name] = { artifact: held.artifact, version: sent.value, hash: hash!, kind: out.kind }
      refs[name] = { artifact: held.artifact, version: sent.value }
    } else {
      if (held) assets[name] = held
      refs[name] = ref
    }
  }
  for (const name of namedFiles(body)) {
    const target = assetPath(ws, name, file)
    if (refs[name] || !target || !fs.statSync(target, { throwIfNoEntry: false })?.isFile()) continue
    const out = await sentOf(target)
    if (!ws.cloudTask) continue
    const made = await api.createArtifact(ws.cloudTask, name.slice(0, 200), out.kind)
    if (!made.ok) return made
    const sent = await uploadAsset(made.value.id, out)
    if (!sent.ok) return sent
    assets[name] = { artifact: made.value.id, version: sent.value, hash: hashOf(out.bytes), kind: out.kind }
    refs[name] = { artifact: made.value.id, version: sent.value }
  }
  record.assets = assets
  const list = path.join(ws.board, assetsFile(ws.task))
  if (Object.keys(refs).length || fs.existsSync(list)) {
    if (JSON.stringify(assetsOf(readText(list))) !== JSON.stringify(refs)) write(list, assetsText(refs))
  }
  return { ok: true, value: undefined }
}

/** `triage/dismissed/` and `triage/archived/` as Cloud holds them, after the rejection review laid
 *  its own there: what it moved aside is never sent back as deleted. */
export function resetSorted(ws: TaskFolder): void {
  for (const sub of ['dismissed', 'archived']) fs.rmSync(path.join(ws.board, 'triage', sub), { recursive: true, force: true })
  for (const [p, content] of viewOf(ws, readBase(ws), sharedMemory(ws.board))) {
    if (/^triage\/(?:dismissed|archived)\//.test(p)) write(path.join(ws.board, p), content)
  }
}

/** Each item the job added to `triage/`, proposed from its task on its workflow — the job's when
 *  the file names none — as `akb triage add` cannot know either. */
function proposeItems(ws: TaskFolder, base: Base): void {
  const root = rootOf(ws)
  for (const p of localFiles(ws, base)) {
    if (itemAt(p)?.state !== 'open' || base.files[root + p]) continue
    const file = path.join(ws.board, p)
    const content = fs.readFileSync(file, 'utf8')
    const said = (key: string) => new RegExp(`^${key}:`, 'm').test(content.split(/\n---/)[0] ?? '')
    const fields: Record<string, string> = {
      ...(ws.cloudTask && !said('source_task') ? { source_task: ws.cloudTask } : {}),
      ...(ws.workflow && !said('workflow') ? { workflow: workflowName(ws.workflow) } : {}),
    }
    const stamped = Object.keys(fields).length ? stampItem(content, fields) : content
    if (stamped !== content) write(file, stamped)
  }
}

/** A file both sides changed, merged line by line against the base; null when it does not
 *  merge — a delete against an edit never does. */
export function mergeFile(base: string | null, mine: string | null, theirs: string | null): { content: string | null } | null {
  if (mine === theirs) return { content: mine }
  if (mine === null || theirs === null) return null
  const blocks = diff3Merge(mine.split('\n'), (base ?? '').split('\n'), theirs.split('\n'), { excludeFalseConflicts: true })
  if (blocks.some((b) => b.conflict)) return null
  return { content: blocks.flatMap((b) => b.ok ?? []).join('\n') }
}

/** Send back what the job changed: assets first, then every changed board file in one write.
 *  Refused, the files both sides changed are merged here and the write goes once more. Until one
 *  goes, the folder is kept out of the cache's cleanup. */
export const push = (ws: TaskFolder, job: { id: string; machineId: string }): Promise<Pushed> => inFolder(ws.cwd, async () => {
  const pushed = await sendMarked(ws, job)
  // Refused, the step runs again from Cloud's board: what the job changed here goes, rather than
  // block every later read.
  if (!pushed.ok && pushed.conflict && (await readCloud(ws)).ok) markUnsent(ws.cwd, false)
  return pushed
})

/** `work` alone on the folder's board, with the job's push: what it lays out meanwhile never goes. */
export const withBoard = <T>(ws: TaskFolder, work: (push: (job: { id: string; machineId: string }) => Promise<Pushed>) => Promise<T>): Promise<T> =>
  inFolder(ws.cwd, () => work((job) => sendMarked(ws, job)))

/** What changed on the board, for no job (#59). */
export const pushBoard = (ws: TaskFolder, machineId: string): Promise<Pushed> => inFolder(ws.cwd, () => sendBoard(ws, machineId))

/** Never before the board was first read: everything here would go up as new. */
async function sendBoard(ws: TaskFolder, machineId: string): Promise<Pushed> {
  if (readBase(ws).head_seq === null) return { ok: true, changed: false }
  return sendMarked(ws, { id: null, machineId })
}

async function sendMarked(ws: TaskFolder, job: { id: string | null; machineId: string }): Promise<Pushed> {
  const pushed = await send(ws, job)
  markUnsent(ws.cwd, !pushed.ok)
  return pushed
}

async function send(ws: TaskFolder, job: { id: string | null; machineId: string }): Promise<Pushed> {
  const record = readRecord(ws)
  const base = readBase(ws)
  const fail = (error: string, conflict = false, code?: string): Pushed => ({ ok: false, conflict, error, ...(code ? {} : { offline: true }) })

  const assets = await pushAssets(ws, record, assetsOf(assetsListOf(ws, base)))
  if (!assets.ok) return fail(assets.error, false, assets.code)
  writeRecord(ws, record)
  proposeItems(ws, base)

  const shared = sharedMemory(ws.board)
  const local = localFiles(ws, base)
  const localOf = new Map<string, string>()
  const changes: api.BoardWrite[] = []
  // An item a job is adding goes up with that job, stamped with its task.
  const owed = (p: string) => !job.id && busy(ws.cwd) && itemAt(p)?.state === 'open' && !base.files[rootOf(ws) + p]
  for (const p of local) {
    if (owed(p)) continue
    const content = fs.readFileSync(path.join(ws.board, p), 'utf8')
    const remote = remoteOf(ws, shared, p)
    localOf.set(remote, p)
    const held = base.files[remote]
    if (held?.content === content) continue
    if (Buffer.byteLength(content) > BOARD_FILE_LIMIT) return fail(`${p} is over ${BOARD_FILE_LIMIT / 1024} KB; keep large files as assets.`, false, 'too_large')
    changes.push({ path: remote, content, base_seq: held?.seq ?? 0 })
  }
  for (const p of viewOf(ws, base, shared).keys()) {
    const remote = remoteOf(ws, shared, p)
    if (kept(p) && !localOf.has(remote) && base.files[remote]) {
      localOf.set(remote, p)
      changes.push({ path: remote, content: null, base_seq: base.files[remote]!.seq })
    }
  }
  // A project's copy of a file declared the workspace's would bring a deleted one back (#2099).
  const memory = rootOf(ws) + MEMORY
  const stale = new Set(Object.keys(base.files).filter((p) => p.startsWith(memory) && shared(p.slice(memory.length))))
  for (const p of stale) changes.push({ path: p, content: null, base_seq: base.files[p]!.seq })
  if (!changes.length) return { ok: true, changed: false }

  let sent = await api.commitBoard(ws.project, job.id, job.machineId, changes)
  if (!sent.ok && sent.files) {
    for (const theirs of sent.files) {
      const at = changes.findIndex((c) => c.path === theirs.path)
      if (stale.has(theirs.path)) {
        if (at >= 0) changes.splice(at, 1)
        continue
      }
      const p = localOf.get(theirs.path) ?? theirs.path
      // Where an item sits is Cloud's to say: a sort or a move there wins (#2107).
      const merged = at < 0 ? null : itemAt(p) ? { content: theirs.content } : mergeFile(base.files[theirs.path]?.content ?? null, changes[at]!.content, theirs.content)
      if (!merged) return fail(`${p} was changed elsewhere and does not merge.`, true, 'version_conflict')
      changes[at] = { path: theirs.path, content: merged.content, base_seq: theirs.seq }
      if (merged.content === null) fs.rmSync(path.join(ws.board, p), { force: true })
      else write(path.join(ws.board, p), merged.content)
    }
    if (!changes.length) return { ok: true, changed: false }
    sent = await api.commitBoard(ws.project, job.id, job.machineId, changes)
  }
  if (!sent.ok) return fail(sent.error, sent.code === 'version_conflict', sent.code)

  // The base keeps its `head_seq`: what others wrote meanwhile is read at the next pull.
  for (const c of changes) {
    const seq = sent.value.files.find((f) => f.path === c.path)?.seq ?? c.base_seq
    if (c.content === null) delete base.files[c.path]
    else base.files[c.path] = { seq, content: c.content }
  }
  writeBase(ws, base)
  return { ok: true, changed: true }
}
