// Every workflow is Cloud's (#409): the official ones and the workspace's own. A board kept for a
// Cloud project reads the ones its workspace can run, each version downloaded once into the
// machine home's `workflows/` and read from there offline. A run on a task reads the version
// its task started on.
//
// `AI4KANBAN_WORKFLOWS=<official folder>` reads the official ones from that folder instead,
// unpublished: what the tests and a maintainer editing them use.

import fs from 'node:fs'
import path from 'node:path'

import { workflowName } from '../shared/board-files.ts'
import { packOfficial } from '../../../../official/pack.ts'
import { call, runnerProject, workspaceTask } from '../cloud/tasks'
import { cloudConfigured } from '../cloud/config'
import { readSession, sessionFile } from '../cloud/session'
import { memoByFiles } from '../file-memo'
import { machineHome } from '../machine/home'
import { KANBAN } from '../paths'
import { parseWorkflowFile, type WorkflowDef } from './workflow-def'

export type WorkflowFiles = Record<string, string>

/** One version of one workflow, as Cloud answers it. */
export interface HeldVersion {
  /** Cloud's id: `wf_builtin_coding`, `wf_…`. */
  id: string
  version: number
  name: string
  names?: Record<string, string>
  files: WorkflowFiles
}

/** One workflow as this board runs it. */
export interface CloudFlow {
  def: WorkflowDef
  cloudId: string
  version: number
  builtIn: boolean
  files: WorkflowFiles
}

interface List {
  at: string
  workspace: string
  workflows: { id: string; version: number }[]
}

interface Pin {
  workflow: string
  version: number
}

const DEV = 'AI4KANBAN_WORKFLOWS'
const FRESH_MS = 60_000

const root = () => path.join(machineHome(), 'workflows')
const safe = (name: string) => name.replace(/[^\w.@-]/g, '_')
const versionFile = (id: string, version: number) => path.join(root(), 'versions', `${safe(id)}@${version}.json`)
const listFile = (project: string) => path.join(root(), 'lists', `${safe(project)}.json`)
const pinFile = (task: string) => path.join(root(), 'tasks', `${safe(task)}.json`)

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return null
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, `${JSON.stringify(value)}\n`)
  fs.renameSync(tmp, file)
}

export const readVersion = (id: string, version: number): HeldVersion | null => readJson<HeldVersion>(versionFile(id, version))

/** The name a workflow had in any version downloaded here, by akb's name for it; empty when none
 *  was. */
export function heldWorkflowName(name: string): string {
  let files: string[]
  try {
    files = fs.readdirSync(path.join(root(), 'versions'))
  } catch {
    return ''
  }
  const held = files.filter((f) => f.endsWith('.json')).map((f) => f.slice(0, f.lastIndexOf('@'))).find((id) => workflowName(id) === name)
  if (!held) return ''
  const file = files.filter((f) => f.startsWith(`${held}@`)).sort().pop()!
  return readJson<HeldVersion>(path.join(root(), 'versions', file))?.name ?? ''
}

/** Keep one version; a version never changes, so one already kept stays. */
export function saveVersion(held: HeldVersion): void {
  const file = versionFile(held.id, held.version)
  if (!fs.existsSync(file)) writeJson(file, { id: held.id, version: held.version, name: held.name, names: held.names, files: held.files })
}

/** The version a task runs on, never changing once read. */
export function savePin(task: string, held: HeldVersion): void {
  saveVersion(held)
  writeJson(pinFile(task), { workflow: held.id, version: held.version } satisfies Pin)
}

export const readPin = (task: string): Pin | null => readJson<Pin>(pinFile(task))

/** The Cloud project this board is kept for, or null. */
export const boardProject = (): string | null => (KANBAN ? runnerProject(KANBAN) : null)

const devFolder = () => process.env[DEV]?.trim() || ''

/** Whether this board can run workflows: from the dev folder, or signed in on a linked board. */
export function workflowsReachable(): { ok: true } | { ok: false; kind: 'needs-cloud' } {
  if (devFolder()) return { ok: true }
  return boardProject() && readSession() ? { ok: true } : { ok: false, kind: 'needs-cloud' }
}

/** Offline, and the version this process's task runs on was never downloaded. */
export function pinMissing(): boolean {
  const task = workspaceTask()
  if (devFolder() || !task) return false
  const pin = readPin(task)
  return !(pin && readVersion(pin.workflow, pin.version))
}

export const NEEDS_CLOUD = 'Sign in to run workflows.'
export const NOT_DOWNLOADED = "This workflow isn't downloaded yet. Connect and try again."

let offline = false

/** The last sync could not reach Cloud, so the list is what was downloaded before. */
export const workflowsOffline = () => offline

type Answer<T> = { ok: true; value: T } | { ok: false; error: string; code?: string }

async function versionOf(id: string, version: number): Promise<Answer<HeldVersion>> {
  const held = readVersion(id, version)
  if (held) return { ok: true, value: held }
  const read = await call<HeldVersion>('GET', `/v1/workflows/${encodeURIComponent(id)}`)
  if (!read.ok) return read
  saveVersion(read.value)
  return read
}

/** The version the task this process works for runs on, read once. */
async function pinTask(task: string): Promise<Answer<HeldVersion>> {
  const pin = readPin(task)
  const held = pin && readVersion(pin.workflow, pin.version)
  if (held) return { ok: true, value: held }
  const read = await call<{ workflow: string; version: number; name: string; files: WorkflowFiles }>('GET', `/v1/tasks/${encodeURIComponent(task)}/workflow`)
  if (!read.ok) return read
  const value = { id: read.value.workflow, version: read.value.version, name: read.value.name, files: read.value.files }
  savePin(task, value)
  return { ok: true, value }
}

/** Bring this machine's copy of the workspace's workflows up to date. Never throws: offline, the
 *  copy downloaded before stands. `force` reads the list even when it is fresh. */
export async function syncWorkflows(force = false): Promise<void> {
  offline = false
  const project = boardProject()
  if (devFolder() || !project || !cloudConfigured() || !readSession()) return
  const task = workspaceTask()
  const held = readJson<List>(listFile(project))
  const fresh = held && Date.now() - Date.parse(held.at) < FRESH_MS
  try {
    if (task && !readPin(task)) {
      const pinned = await pinTask(task)
      if (!pinned.ok && !pinned.code) offline = true
    }
    if (fresh && !force) return
    let workspace = held?.workspace
    if (!workspace) {
      const read = await call<{ workspace: string }>('GET', `/v1/projects/${encodeURIComponent(project)}`)
      if (!read.ok) {
        offline = !read.code
        return
      }
      workspace = read.value.workspace
    }
    const listed: List['workflows'] = []
    let after: string | null = null
    do {
      const page: Answer<{ data: { id: string; version: number }[]; next: string | null }> = await call('GET',
        `/v1/workflows?workspace=${encodeURIComponent(workspace)}&limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`)
      if (!page.ok) {
        offline = !page.code
        return
      }
      listed.push(...page.value.data.map((w) => ({ id: w.id, version: w.version })))
      after = page.value.next
    } while (after)
    const kept: List['workflows'] = []
    for (const w of listed) {
      const read = await versionOf(w.id, w.version)
      if (read.ok) kept.push({ id: read.value.id, version: read.value.version })
      else if (!read.code) offline = true
    }
    writeJson(listFile(project), { at: new Date().toISOString(), workspace, workflows: kept } satisfies List)
  } catch {
    offline = true
  }
}

const flowOf = (held: HeldVersion): CloudFlow | null => {
  const id = workflowName(held.id)
  const read = parseWorkflowFile(id, held.files['WORKFLOW.md'] ?? '', `the \`${id}\` workflow`)
  if ('problem' in read) return null
  return { def: read.def, cloudId: held.id, version: held.version, builtIn: held.id.startsWith('wf_builtin_'), files: held.files }
}

function readFlows(): CloudFlow[] {
  const dev = devFolder()
  if (dev) {
    return packOfficial(dev, true).flatMap((w) => flowOf({ id: w.id, version: 1, name: w.name, names: w.names, files: w.files }) ?? [])
  }
  const project = boardProject()
  if (!project || !readSession()) return []
  const list = readJson<List>(listFile(project))?.workflows ?? []
  const flows = list.flatMap((w) => {
    const held = readVersion(w.id, w.version)
    return held ? (flowOf(held) ?? []) : []
  })
  const task = workspaceTask()
  const pin = task ? readPin(task) : null
  const pinned = pin && readVersion(pin.workflow, pin.version)
  const mine = pinned && flowOf(pinned)
  if (!mine) return flows
  return [mine, ...flows.filter((f) => f.cloudId !== mine.cloudId)]
}

const sources = (): string[] => {
  if (devFolder()) return [devFolder()]
  const project = boardProject()
  const task = workspaceTask()
  return [sessionFile(), ...(project ? [listFile(project)] : []), ...(task ? [pinFile(task)] : [])]
}

const flows = memoByFiles(sources, readFlows)

/** What `cloudFlows` reads, for a memo built on it. */
export const cloudWorkflowSources = sources

/** The workflows this board runs: the task's own version first, then official ones, then the
 *  workspace's own. Empty when none can be read. */
export const cloudFlows = (): CloudFlow[] => flows()

/** Every file of every workflow's agents, `<agent>/<path>`, the first workflow naming one winning;
 *  and whether that agent came with an official one. */
export function cloudAgentFiles(): { files: Record<string, string>; official: Set<string> } {
  const files: Record<string, string> = {}
  const official = new Set<string>()
  const owner = new Map<string, string>()
  for (const flow of cloudFlows()) {
    for (const [name, text] of Object.entries(flow.files)) {
      const at = /^agents\/([^/]+)\/(.+)$/.exec(name)
      if (!at) continue
      const [, agent, rest] = at as unknown as [string, string, string]
      if (owner.has(agent) && owner.get(agent) !== flow.cloudId) continue
      owner.set(agent, flow.cloudId)
      if (flow.builtIn) official.add(agent)
      files[`${agent}/${rest}`] = text
    }
  }
  return { files, official }
}
