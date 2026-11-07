// 本地看板与云端按 seq 同步，冲突时三方合并；同一目录的读写串行执行。

import { collect } from '../../artifact-sdk/src/internal/collect'
import { kindOf, TYPES, type Kind } from '../../artifact-sdk/src/internal/references'
import { manifestOf, mapReferences } from '../../artifact-sdk/src/internal/manifest'

import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { diff3Merge } from 'node-diff3'

import { BOARD_FILE_LIMIT, BUILDER, assetsFile, cardFront, draftFolder, isBoardPath, isSettingsPath, numberOfCard, workflowFolder, workflowName } from '../../cli/src/lib/shared/board-files.ts'
import { itemAt, stampItem } from '../../cli/src/lib/shared/triage-files.ts'
import { projectStateDir } from '../../cli/src/lib/machine/project'
import { readPin, readVersion, savePin, saveVersion } from '../../cli/src/lib/agent/cloud-workflows'
import { renderError } from '../../cli/src/lib/preview-validation'
import { referenceText } from '../../cli/src/lib/dress-page'
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
  localHash?: string
}

/** What this computer keeps of one task beside the board: its assets and its workflow's tools. */
interface Record_ {
  task?: string
  number?: number

  /** `kind` is the artifact's type (#2003); an `html` one is the page a mockup draws, and its
   *  hash is the page's. */
  assets: { [path: string]: Entry & { artifact: string; kind?: Kind; dependencies?: string[] } }
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
  /** Cards with deferred assets stay excluded from later job writebacks. */
  deferred?: string[]
  pendingAssets?: string[]
  files: { [path: string]: { seq: number; content: string } }
}

export type Pushed =
  | { ok: true; changed: boolean }
  | { ok: false; conflict: boolean; error: string; offline?: boolean; tasks?: Record<string, { error: string; offline?: boolean }> }

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

/** Managed workflows execute in an ordinary directory. */
function openCached(project: string): string {
  const dir = cacheDir(project)
  fs.mkdirSync(dir, { recursive: true })
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
  const at = (name: string) => { try { return assetPath(ws, name, card) } catch { return null } }
  return new Set(Object.keys(assetsOf(list)).map(at).filter((f): f is string => !!f)
    .map((f) => path.relative(ws.board, f).split(path.sep).join('/')))
}

const assetsListOf = (ws: TaskFolder, base: Base) => base.files[rootOf(ws) + assetsFile(ws.task)]?.content

const localFiles = (ws: TaskFolder, base: Base) => {
  const assets = new Set([...assetFiles(ws, assetsListOf(ws, base)), ...assetFiles(ws, readText(path.join(ws.board, assetsFile(ws.task))))])
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

/** The workflow version a job runs on (#409), from this machine's copy, which akb reads too: a
 *  task's own version, read once; an agent job's workflow's current one. */
async function workflowFiles(ws: TaskFolder): Promise<api.Call<Record<string, string>>> {
  const workflow = ws.workflow!
  if (ws.cloudTask && ws.cloudTask === ws.task) {
    const pin = readPin(ws.cloudTask)
    const held = pin && readVersion(pin.workflow, pin.version)
    if (held) return { ok: true, value: held.files }
    const read = await api.readTaskWorkflow(ws.cloudTask)
    if (!read.ok) return read
    savePin(ws.cloudTask, { id: read.value.workflow, version: read.value.version, name: read.value.name ?? read.value.workflow, files: read.value.files })
    return { ok: true, value: read.value.files }
  }
  const read = await api.readWorkflow(workflow)
  if (!read.ok) return read
  saveVersion({ id: workflow, version: read.value.version, name: read.value.name ?? workflow, files: read.value.files })
  return { ok: true, value: read.value.files }
}

/** The job's workflow: its skills into the project. akb reads its agents from the same copy, so
 *  agents an earlier Runner placed on the board go. */
async function pullWorkflow(ws: TaskFolder, record: Record_): Promise<api.Call<void>> {
  if (ws.workflow) {
    record.builtin = ws.workflow.startsWith('wf_builtin_')
    const files = await workflowFiles(ws)
    if (!files.ok && files.code !== 'not_found') return files
    if (files.ok) pullTools(ws, record, files.value)
  }
  dropPlacedAgents(ws)
  // A draft's agents are put back by `pullDraftAgents`.
  for (const name of Object.keys(record.agents ?? {})) fs.rmSync(path.join(ws.board, name), { force: true })
  record.agents = {}
  return { ok: true, value: undefined }
}

const agentsRecord = (ws: TaskFolder) => path.join(ws.board, '.sync', 'agents.json')

/** The workflows' agents an earlier Runner placed, by file hash. */
function readPlaced(ws: TaskFolder): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(agentsRecord(ws), 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

/** Before #409 a Runner copied every workflow's agents into `agents/`; akb now reads them from
 *  the workflow's version. */
function dropPlacedAgents(ws: TaskFolder): void {
  const placed = readPlaced(ws)
  for (const name of Object.keys(placed)) if (hashFile(path.join(ws.board, name)) === placed[name]) fs.rmSync(path.join(ws.board, name), { force: true })
  fs.rmSync(agentsRecord(ws), { force: true })
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

/** An asset path the body names: akb's `.assets/` and `.mockups/` in the board's state folder,
 *  anything else relative to the card; never outside either. */
function assetPath(ws: TaskFolder, name: string, owner: string): string | null {
  if (/^[a-z][\w+.-]*:/i.test(name) || name.startsWith('#') || name.startsWith('//')) return null
  if (path.isAbsolute(name)) throw new Error(`absolute path: ${name}`)
  const held = /^\.(assets|mockups)\//.exec(name)
  const state = stateDir(ws)
  const root = held && state ? path.join(state, held[1]!) : ws.board
  const file = held && state ? path.resolve(root, name.slice(held[0].length)) : path.resolve(path.dirname(owner), name)
  const roots = [ws.board, ...(state ? ['assets', 'mockups'].map(folder => path.join(state, folder, ...(ws.number ? [String(ws.number)] : []))) : [])]
  const inside = (file: string, root: string) => file.startsWith(root + path.sep)
  if (!roots.some(root => inside(file, root))) throw new Error(`outside the board: ${name}`)
  let existing = file
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing)
  const real = fs.realpathSync(existing)
  let stateParent = state
  while (stateParent && !fs.existsSync(stateParent) && path.dirname(stateParent) !== stateParent) stateParent = path.dirname(stateParent)
  const realState = state && stateParent ? path.resolve(fs.realpathSync(stateParent), path.relative(stateParent, state)) : null
  const realRoots = [fs.realpathSync(ws.board), ...(realState ? ['assets', 'mockups'].map(folder => path.join(realState, folder, ...(ws.number ? [String(ws.number)] : []))) : [])]
  if (!realRoots.some(root => real === root || inside(real, root))) throw new Error(`link outside the board: ${name}`)
  return file
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
    if (!sent.ok) {
      const refused = sent.tasks ? sent.tasks[ws.cloudTask ?? ''] : sent
      if (refused) return { ok: false, error: `This computer's board changes could not be sent: ${refused.error}`, ...(refused.offline ? {} : { code: 'version_conflict' }) }
    }
    return readCloud(ws)
  })
}

/** The Cloud board version the folder last read up to; null when never read. */
export const readHead = (ws: Pick<TaskFolder, 'cwd'>): number | null => readBase(ws).head_seq

/** What Cloud changed since the base, between jobs (#103): written only over a file still as last
 *  read. One changed here keeps its base, so the next push merges it, and the base keeps its
 *  `head_seq` until that push lands. */
export const pullChanges = (ws: TaskFolder): Promise<api.Call<void>> => inFolder(ws.cwd, async () => {
  const base = readBase(ws)
  if (base.head_seq === null) return { ok: true, value: undefined }
  const read = await api.readBoard(ws.project, base.head_seq)
  if (!read.ok) return read
  const shared = sharedMemory(ws.board)
  const root = rootOf(ws)
  let skipped = false
  for (const f of read.value.files) {
    const p = f.path.startsWith(root) ? f.path.slice(root.length) : f.path
    const isShared = p.startsWith(MEMORY) && shared(p.slice(MEMORY.length))
    if (kept(p) && isShared === !f.path.startsWith(root)) {
      const file = path.join(ws.board, p)
      const here = readText(file)
      if (here !== f.content && here !== (base.files[f.path]?.content ?? null)) {
        skipped = true
        continue
      }
      if (f.content === null) fs.rmSync(file, { force: true })
      else if (here !== f.content) write(file, f.content)
    }
    if (f.content === null) delete base.files[f.path]
    else base.files[f.path] = { seq: f.seq, content: f.content }
  }
  if (!skipped) base.head_seq = read.value.head_seq
  writeBase(ws, base)
  writeIndex(ws.board)
  return { ok: true, value: undefined }
})

async function readCloud(ws: TaskFolder): Promise<api.Call<void>> {
  const base = readBase(ws)
  const known = new Set(Object.keys(base.files))
  const keepDraft = new Set((base.deferred ?? []).filter(p =>
    readText(path.join(ws.board, p)) !== (base.files[rootOf(ws) + p]?.content ?? null)))
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
      if (!keepDraft.has(p) && kept(p) && readText(file) !== content) write(file, content)
    }
  }
  const view = viewOf(ws, base, sharedMemory(ws.board))
  // A settings file Cloud has never held is this board's own until its next push (#2106).
  const first = (p: string) => isSettingsPath(p) && !known.has(rootOf(ws) + p)
  for (const p of localFiles(ws, base)) if (!keepDraft.has(p) && !view.has(p) && !first(p)) fs.rmSync(path.join(ws.board, p), { force: true })
  reset(view)

  const record = readRecord(ws)
  const workflow = await pullWorkflow(ws, record)
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
  if (ws.cloudTask && ws.number) { record.task = ws.cloudTask; record.number = ws.number }
  const file = cardFile(ws)
  const out: Record_['assets'] = {}
  for (const [name, ref] of Object.entries(assets)) {
    const held = record.assets[name]
    // Never drawn: nothing to read, and the source here stays.
    if (ref.error && !ref.version) {
      if (held?.artifact === ref.artifact) out[name] = held
      continue
    }
    const target = assetPath(ws, name, file)
    if (!target) continue
    let kind = held?.artifact === ref.artifact ? held.kind : undefined
    let version = ref.version
    const localHash = hashFile(target)
    const current = held?.artifact === ref.artifact && held.version === version && localHash === (held.localHash ?? held.hash)
    if (version === undefined || !kind || (!current && kind !== 'html')) {
      const latest = await api.readArtifact(ref.artifact)
      if (!latest.ok) return latest
      version ??= latest.value.latest_version ?? 0
      kind = latest.value.type
      if (!kind) return { ok: false, code: 'bad_request', error: `${name}: 资源类型缺失` }
    }
    if (kind === 'html' && held?.artifact === ref.artifact) {
      out[name] = { ...held, kind, version }
      continue
    }
    if (held?.artifact === ref.artifact && held.version === version && current) {
      out[name] = { ...held, kind }
      continue
    }
    const bytes = await readAsset(ref.artifact, version)
    if (!bytes.ok) return bytes
    let local = bytes.value
    const dependencies: string[] = []
    const manifest = manifestOf(kind)
    let data: unknown
    if (manifest?.references) {
      data = Buffer.from(local).toString()
      if (manifest.references.some(r => 'json' in r)) {
        try { data = JSON.parse(data as string) } catch { data = undefined /* 无效 JSON 保持原字节。 */ }
      }
    }
    if (data !== undefined) {
      let changed = false
      // 页面里的引用由浏览器按页面位置解析，总是写成相对路径。
      const restored = mapReferences(manifest, data, (src, found) => {
        const name = Object.entries(assets).find(([, r]) => r.artifact === src)?.[0]
        if (!name) return src
        const child = assetPath(ws, name, file)
        if (!child) return src
        dependencies.push(name)
        const back = !found.text && /^\.(assets|mockups)\//.test(name) ? name : path.relative(path.dirname(target), child).split(path.sep).join('/')
        if (back !== src) changed = true
        return back
      })
      if (changed) local = Buffer.from(typeof restored === 'string' ? restored : JSON.stringify(restored))
    }
    const json = data !== undefined && typeof data !== 'string'
    if (held?.artifact === ref.artifact && held.version === version && !held.localHash && json) {
      const source = readText(target)
      if (source !== null) {
        // 旧记录没有本地哈希：确认内容等价后才补记，保留源码及尚未上传的修改。
        let same = false
        try { same = JSON.stringify(JSON.parse(source)) === JSON.stringify(JSON.parse(Buffer.from(local).toString())) } catch { /* 留给上传校验。 */ }
        if (!same) {
          out[name] = { ...held, kind }
          continue
        }
        local = Buffer.from(source)
      }
    }
    write(target, local)
    // 改写过引用的页面以本地内容为准，推送时据此认出它没变。
    const hash = hashOf(typeof data === 'string' ? local : bytes.value)
    out[name] = { ...held, kind, dependencies: [...new Set(dependencies)], artifact: ref.artifact, version, hash, localHash: hashOf(local) }
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

interface Sent {
  bytes: Uint8Array
  type: string
  kind: Kind
}

/** What goes up for a file: a mockup as the page it draws, anything else as it is. */
async function sentOf(file: string, kind: Kind): Promise<Sent> {
  const ext = path.extname(file).toLowerCase()
  if (kind !== 'html') return { bytes: fs.readFileSync(file), type: kind === 'tiled' && ext === '.tsx' ? 'application/xml' : TYPES[ext] ?? 'application/octet-stream', kind }
  const page = await (await import('./mockup')).drawMockup(file)
  return { bytes: Buffer.from(page), type: 'text/html', kind }
}

/** The card's previews that cannot be drawn, each with why. */
export const undrawnPreviews = (ws: TaskFolder): string[] =>
  Object.entries(assetsOf(readText(path.join(ws.board, assetsFile(ws.task))))).flatMap(([key, ref]) => ref.error ? [`${key}: ${ref.error}`] : [])

/** Why a preview cannot be drawn, with its paths as the card names them. */
function undrawn(ws: TaskFolder, reason: string): string {
  const state = stateDir(ws)
  for (const [root, shown] of [...(state ? [[path.join(state, 'assets'), '.assets'], [path.join(state, 'mockups'), '.mockups']] : []), [ws.board, '']]) {
    reason = reason.split(`file://${root}${path.sep}`).join(shown && `${shown}/`).split(`${root}${path.sep}`).join(shown && `${shown}/`)
  }
  return reason.replace(/ \(at [^)]*file:\/\/[^)]*\)$/, '').slice(0, 500)
}

async function uploadAsset(artifact: string, { bytes, type }: Sent): Promise<api.Call<number>> {
  const upload = await api.createUpload(artifact, type, Math.max(bytes.length, 1))
  if (!upload.ok) return upload
  const put = await api.upload(`/v1/uploads/${encodeURIComponent(upload.value.id)}`, bytes, type)
  if (!put.ok) return put
  const version = await api.createVersion(artifact, upload.value.id)
  return version.ok ? { ok: true, value: version.value.version } : version
}

/** 每次成功上传即记账，失败重试可复用。任一预览处理失败都不阻塞推送：沿用旧版本或建空记录，并在清单里记下原因（#456, #457）。 */
async function pushAssets(ws: TaskFolder, record: Record_, before: Assets): Promise<api.Call<void>> {
  if (ws.cloudTask && ws.number) { record.task = ws.cloudTask; record.number = ws.number; writeRecord(ws, record) }
  const file = cardFile(ws)
  const body = readText(file)
  if (body === null) return { ok: true, value: undefined }
  const refs: Assets = {}
  const canonical = (target: string) => {
    // 本机已删除的文件按最近的现存上级解析符号链接，键与删除前一致。
    const real = (file: string): string => fs.existsSync(file) ? fs.realpathSync(file)
      : path.dirname(file) === file ? file : path.join(real(path.dirname(file)), path.basename(file))
    target = real(target)
    const state = stateDir(ws)
    for (const folder of ['assets', 'mockups']) {
      const root = state && real(path.join(state, folder))
      if (root && target.startsWith(root + path.sep)) return `.${folder}/${path.relative(root, target).split(path.sep).join('/')}`
    }
    return path.relative(real(path.dirname(file)), target).split(path.sep).join('/')
  }
  try {
    const graph = collect(body, file, {
      resolve: (src, owner) => {
        // 已有 artifact ID 只允许来自本任务清单。
        const id = Object.entries(before).find(([, ref]) => ref.artifact === src)
        if (id) return { key: id[0], file: null }
        const target = assetPath(ws, src, owner)
        if (!target) return null
        const key = owner === file && before[src] ? src : canonical(target)
        if (!fs.statSync(target, { throwIfNoEntry: false })?.isFile()) {
          if (before[key]) return { key, file: null }
          throw new Error(`file not found: ${target}`)
        }
        return { key: canonical(fs.realpathSync(target)), file: target }
      },
      read: referenceText,
      retained: key => (record.assets[key]?.dependencies ?? []).map(src => {
        const kind = record.assets[src]?.kind
        return { src, types: kind ? [kind] : [] }
      }),
    })
    for (const node of graph) {
      const previous = [...node.aliases].map(key => record.assets[key]).find(Boolean)
      const old = [...node.aliases].map(key => before[key]).find(Boolean)
      const kind = node.kind as Kind
      let out: Sent | undefined
      let why = node.error ?? [...node.dependencies.values()].map(key => refs[key]?.error).find(Boolean)
      if (!why && node.file) {
        try { out = await sentOf(node.file, kind) }
        catch (error) { why = renderError(error) }
      }
      if (why) {
        let pin: Assets[string] | null = old ? { artifact: old.artifact, ...(old.version ? { version: old.version } : {}) }
          : previous?.version ? { artifact: previous.artifact, version: previous.version } : null
        if (!pin) {
          if (!ws.cloudTask) continue
          let artifact = previous?.artifact
          if (!artifact) {
            const made = await api.createArtifact(ws.cloudTask, node.key.slice(0, 200), kind)
            if (!made.ok) return { ...made, error: `${node.key}: ${made.error}` }
            artifact = made.value.id
            for (const alias of node.aliases) record.assets[alias] = { artifact, kind, version: 0, hash: '' }
            writeRecord(ws, record)
          }
          pin = { artifact }
        }
        for (const alias of node.aliases) refs[alias] = { ...pin, error: undrawn(ws, why) }
        continue
      }
      if (!node.file || !out) {
        if (old?.error && !old.version) for (const alias of node.aliases) refs[alias] = old
        else if (old) {
          let version = old.version ?? (previous?.artifact === old.artifact ? previous.version : undefined)
          if (version === undefined) {
            const art = await api.readArtifact(old.artifact)
            if (!art.ok) return art
            version = art.value.latest_version ?? 0
          }
          for (const alias of node.aliases) refs[alias] = { artifact: old.artifact, version }
        }
        continue
      }
      if (previous && previous.kind !== kind) {
        const artifact = await api.readArtifact(previous.artifact)
        if (!artifact.ok) return artifact
        if (!artifact.value.type) return { ok: false, code: 'bad_request', error: `${node.key}: 资源类型缺失` }
        previous.kind = artifact.value.type
      }
      const manifest = manifestOf(kind)
      const json = !!manifest?.references && node.data !== undefined && typeof node.data !== 'string'
      if (manifest?.references && node.data !== undefined) {
        const map = (src: string) => {
          const key = node.dependencies.get(src)
          return key ? refs[key]?.artifact ?? src : src
        }
        out = json
          ? { kind, type: 'application/json', bytes: Buffer.from(JSON.stringify(mapReferences(manifest, node.data, map))) }
          : { ...out, bytes: Buffer.from(mapReferences(manifest, Buffer.from(out.bytes).toString(), map) as string) }
      }
      const hash = hashOf(out.bytes)
      let entry = previous
      const localHash = hashFile(node.file)
      const restored = json || (typeof node.data === 'string' && previous?.hash === localHash)
      const unchanged = restored && previous && (previous.kind ?? out.kind) === out.kind
        && localHash === (previous.localHash ?? previous.hash)
        && [...node.dependencies.values()].every(key => refs[key]?.artifact === before[key]?.artifact)
      if (!entry || (!unchanged && entry.hash !== hash) || (entry.kind && entry.kind !== out.kind)) {
        if (!ws.cloudTask) continue
        let artifact = previous && (previous.kind ?? kindOf(path.extname(node.file).toLowerCase())) === out.kind ? previous.artifact : undefined
        if (!artifact) {
          const made = await api.createArtifact(ws.cloudTask, node.key.slice(0, 200), out.kind)
          if (!made.ok) return { ...made, error: `${node.key}: ${made.error}` }
          artifact = made.value.id
        }
        const sent = await uploadAsset(artifact, out)
        if (!sent.ok) return { ...sent, error: `${node.key}: ${sent.error}` }
        entry = { artifact, version: sent.value, hash, kind: out.kind }
      }
      entry = { ...entry, localHash: localHash ?? undefined, dependencies: [...node.dependencies.values()] }
      for (const alias of node.aliases) {
        record.assets[alias] = entry
        refs[alias] = { artifact: entry.artifact, version: entry.version }
      }
      writeRecord(ws, record)
    }
  } catch (error) {
    return { ok: false, code: 'bad_request', error: error instanceof Error ? error.message : String(error) }
  }
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

/** A file both sides changed, merged line by line against the base. It always merges, or the
 *  board would stay stuck: lines both changed keep both, mine first, for a later clean-up. Front
 *  matter cannot hold a key twice, so Cloud's wins there. A delete against an edit keeps the edit. */
export function mergeFile(base: string | null, mine: string | null, theirs: string | null): { content: string | null } {
  if (mine === null || theirs === null || mine === theirs) return { content: mine ?? theirs }
  const lines: string[] = []
  for (const block of diff3Merge(mine.split('\n'), (base ?? '').split('\n'), theirs.split('\n'), { excludeFalseConflicts: true })) {
    if (block.ok) lines.push(...block.ok)
    else if (block.conflict) lines.push(...(inFrontMatter(lines) ? [] : block.conflict.a), ...block.conflict.b)
  }
  return { content: lines.join('\n') }
}

const inFrontMatter = (lines: string[]) => lines[0] === '---' && lines.indexOf('---', 1) < 0

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
  markUnsent(ws.cwd, !pushed.ok || !!readBase(ws).pendingAssets?.length)
  return pushed
}

async function send(ws: TaskFolder, job: { id: string | null; machineId: string }): Promise<Pushed> {
  const record = readRecord(ws)
  const base = readBase(ws)
  const fail = (error: string, conflict = false, code?: string): Pushed => ({ ok: false, conflict, error, ...(code ? {} : { offline: true }) })

  const tasks = ws.cloudTask ? [{ folder: ws, record }] : filesUnder(path.join(ws.board, '.sync')).filter(name => name.endsWith('.json')).flatMap(name => {
    try {
      const held = JSON.parse(fs.readFileSync(path.join(ws.board, '.sync', name), 'utf8')) as Record_
      if (!held.task || !TASK_ID.test(held.task) || !held.number) return []
      return [{ folder: { ...ws, task: held.task, cloudTask: held.task, number: held.number }, record: held }]
    } catch { return [] }
  })
  const boardSync = !job.id && !ws.cloudTask
  const deferredCards = new Set<number>()
  const deferredLists = new Set<string>()
  const assetErrors: Record<string, { error: string; offline?: boolean }> = {}
  for (const item of tasks) {
    const card = path.relative(ws.board, cardFile(item.folder)).split(path.sep).join('/')
    const archived = boardSync && card.startsWith('.archive/') && base.files[rootOf(ws) + card]
    if (!archived) {
      const assets = await pushAssets(item.folder, item.record, assetsOf(assetsListOf(item.folder, base)))
      if (assets.ok) {
        writeRecord(item.folder, item.record)
        continue
      }
      if (!boardSync) return fail(assets.error, false, assets.code)
      if (assets.code !== 'conflict' || !assets.error.endsWith(': This task has finished.')) {
        assetErrors[item.folder.task] = { error: assets.error, ...(assets.code ? {} : { offline: true }) }
      }
    }
    deferredCards.add(item.folder.number!)
    deferredLists.add(assetsFile(item.folder.task))
  }
  proposeItems(ws, base)

  const shared = sharedMemory(ws.board)
  const deferred = new Set(boardSync ? [] : base.deferred)
  const defer = (p: string) => {
    if (!boardSync) return deferred.has(p)
    if (!deferredLists.has(p) && !deferredCards.has(numberOfCard(p) ?? 0)) return false
    deferred.add(p)
    return true
  }
  const success = (changed: boolean): Pushed => {
    const refreshDeferred = boardSync && (deferred.size !== (base.deferred?.length ?? 0) || base.deferred?.some(p => !deferred.has(p)))
    const pendingAssets = Object.keys(assetErrors)
    const refreshPending = boardSync && JSON.stringify(pendingAssets) !== JSON.stringify(base.pendingAssets ?? [])
    if (refreshDeferred) base.deferred = [...deferred]
    if (refreshPending) base.pendingAssets = pendingAssets
    if (changed || refreshDeferred || refreshPending) writeBase(ws, base)
    const firstError = Object.values(assetErrors)[0]
    if (firstError) return { ok: false, conflict: false, ...firstError, tasks: assetErrors }
    return { ok: true, changed }
  }
  const local = localFiles(ws, base)
  const localOf = new Map<string, string>()
  const changes: api.BoardWrite[] = []
  // An item a job is adding goes up with that job, stamped with its task.
  const owed = (p: string) => !job.id && busy(ws.cwd) && itemAt(p)?.state === 'open' && !base.files[rootOf(ws) + p]
  for (const p of local) {
    if (defer(p) || owed(p)) continue
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
    if (!defer(p) && kept(p) && !localOf.has(remote) && base.files[remote]) {
      localOf.set(remote, p)
      changes.push({ path: remote, content: null, base_seq: base.files[remote]!.seq })
    }
  }
  // A project's copy of a file declared the workspace's would bring a deleted one back (#2099).
  const memory = rootOf(ws) + MEMORY
  const stale = new Set(Object.keys(base.files).filter((p) => p.startsWith(memory) && shared(p.slice(memory.length))))
  for (const p of stale) changes.push({ path: p, content: null, base_seq: base.files[p]!.seq })
  if (!changes.length) return success(false)

  let sent = await api.commitBoard(ws.project, job.id, job.machineId, changes)
  if (!sent.ok && sent.files) {
    for (const theirs of sent.files) {
      const at = changes.findIndex((c) => c.path === theirs.path)
      if (stale.has(theirs.path)) {
        if (at >= 0) changes.splice(at, 1)
        continue
      }
      const p = localOf.get(theirs.path) ?? theirs.path
      // A card Cloud took off the board goes here too: an edit to it never merges, and would
      // hold back every other change.
      if (at >= 0 && theirs.content === null && changes[at]!.content !== null && p.startsWith('todo/') && numberOfCard(p) !== null) {
        changes.splice(at, 1)
        delete base.files[theirs.path]
        writeBase(ws, base)
        fs.rmSync(path.join(ws.board, p), { force: true })
        writeIndex(ws.board)
        continue
      }
      // Where an item sits is Cloud's to say: a sort or a move there wins (#2107).
      if (at < 0) continue
      const merged = itemAt(p) ? { content: theirs.content } : mergeFile(base.files[theirs.path]?.content ?? null, changes[at]!.content, theirs.content)
      changes[at] = { path: theirs.path, content: merged.content, base_seq: theirs.seq }
      if (merged.content === null) fs.rmSync(path.join(ws.board, p), { force: true })
      else write(path.join(ws.board, p), merged.content)
    }
    if (!changes.length) return success(false)
    sent = await api.commitBoard(ws.project, job.id, job.machineId, changes)
  }
  if (!sent.ok) return fail(sent.error, sent.code === 'version_conflict', sent.code)

  // The base keeps its `head_seq`: what others wrote meanwhile is read at the next pull.
  for (const c of changes) {
    const seq = sent.value.files.find((f) => f.path === c.path)?.seq ?? c.base_seq
    if (c.content === null) delete base.files[c.path]
    else base.files[c.path] = { seq, content: c.content }
  }
  return success(true)
}
