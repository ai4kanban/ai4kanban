// A Runner workspace's new tasks go to Cloud (#2063): the Runner names the task a job runs for
// in `AI4KANBAN_TASK`, and a task made there is a Cloud task of the same project, numbered by
// Cloud and linked back to that task. Without the variable nothing here is used.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { cloudConfigured, cloudEndpoints, NOT_CONFIGURED } from './config'
import { accessToken } from './session'

/** A refusal with no `code` never reached the service. */
export type CloudCall<T> = { ok: true; value: T } | { ok: false; error: string; code?: string }

export const TASK_ENV = 'AI4KANBAN_TASK'

/** The Cloud task this process works for, when a Runner started it — otherwise null. */
export function workspaceTask(): string | null {
  const id = process.env[TASK_ENV]
  return id && id.trim() ? id.trim() : null
}

export interface CloudTask {
  id: string
  key: string
  project: string
  workflow: { id: string } | null
}

/** `WC-12` → 12. */
export const numberOf = (key: string): number => Number(/-(\d+)$/.exec(key)?.[1] ?? NaN)

/** An akb workflow name as Cloud's id: a built-in's (`coding` → `wf_builtin_coding`), or an
 *  account's own folder (`wf-0190ab` → `wf_0190ab`). */
export function cloudWorkflow(name: string): string {
  if (/^wf-/.test(name)) return name.replace('-', '_')
  return `wf_builtin_${name.replace(/-/g, '_')}`
}

export async function call<T>(method: 'GET' | 'POST', route: string, body?: unknown, key?: string): Promise<CloudCall<T> & { replayed?: boolean }> {
  if (!cloudConfigured()) return { ok: false, error: NOT_CONFIGURED, code: 'bad_request' }
  const token = await accessToken()
  if (!token.ok) {
    return token.reason === 'unreachable'
      ? { ok: false, error: `Cloud could not be reached: ${token.error}` }
      : { ok: false, error: token.reason === 'expired' ? 'Cloud sign-in has expired. Sign in again.' : 'This machine is not signed in to Cloud.', code: 'unauthenticated' }
  }
  let response: Response
  try {
    response = await fetch(`${cloudEndpoints().api}${route}`, {
      method,
      headers: {
        authorization: `Bearer ${token.token}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    return { ok: false, error: `Cloud could not be reached: ${e instanceof Error ? e.message : String(e)}` }
  }
  const parsed = (await response.json().catch(() => ({}))) as T & { error?: { code?: string; message?: string } }
  if (!response.ok) return { ok: false, code: parsed.error?.code ?? 'refused', error: parsed.error?.message ?? `Cloud answered ${response.status}.` }
  return { ok: true, value: parsed, replayed: response.headers.get('idempotent-replayed') === 'true' }
}

export interface NewTask {
  title: string
  /** What the task's own card is written from. */
  request?: string
  /** An akb workflow name; left off, the source task's. */
  workflow?: string
  /** Cloud runs it at once, from planning. */
  run?: boolean
  /** What tells this task apart from another made from the same one, with the title. */
  slug?: string
  /** The card's fields, for the card a task that runs gets in Cloud. */
  metadata?: CardFields
  /** The file name of the triage item it is made of (#2107), which Cloud moves to `archived/`. */
  triage?: string
  /** The agent making it, recorded as its creator (#95). */
  agent?: string
}

export interface CardFields {
  priority?: string
  modules?: string[]
  related?: string[]
  blocked_by?: string[]
}

export type Made = CloudCall<{ task: CloudTask; number: number; from: CloudTask; replayed: boolean }>

/** A task of the source task's project. A retry of the same one answers the task already made. */
export async function createTask(from: string, said: NewTask): Promise<Made> {
  const source = await call<CloudTask>('GET', `/v1/tasks/${encodeURIComponent(from)}`)
  if (!source.ok) return source
  const workflow = said.workflow ? cloudWorkflow(said.workflow) : source.value.workflow?.id
  const body = {
    title: said.title,
    project: source.value.project,
    ...(workflow ? { workflow } : {}),
    ...(said.request?.trim() ? { request: said.request.trim() } : {}),
    source: 'api',
    source_context: { task: from, ...(said.agent ? { agent: said.agent } : {}) },
    ...(said.run ? { run: true } : {}),
    ...(said.metadata && Object.keys(said.metadata).length ? { metadata: said.metadata } : {}),
    ...(said.triage ? { triage: `tri_${source.value.project.replace(/^prj_/, '')}_${said.triage}` } : {}),
  }
  const key = `akb-${crypto.createHash('sha256').update(`${from}\n${said.slug?.trim() || said.title}`).digest('hex').slice(0, 40)}`
  const made = await call<CloudTask>('POST', '/v1/tasks', body, key)
  if (!made.ok) return made
  const number = numberOf(made.value.key)
  if (!Number.isInteger(number)) return { ok: false, error: `Cloud answered a task with no number: ${made.value.key}`, code: 'refused' }
  return { ok: true, value: { task: made.value, number, from: source.value, replayed: made.replayed === true } }
}

/** The Cloud project a Runner keeps this board for: the board is `<project>/.akb/kanban`, and the
 *  Runner's `.akb/base.json` beside it holds that project's files. Null on a board no Runner keeps. */
export function runnerProject(board: string): string | null {
  if (path.basename(board) !== 'kanban' || path.basename(path.dirname(board)) !== '.akb') return null
  const linked = linkedProject(board, path.dirname(path.dirname(board)))
  return linked.ok ? linked.value : null
}

/** 严格读取 Runner 已有的项目关联，不猜测项目。 */
export function linkedProject(board: string, root: string): CloudCall<string | null> {
  const file = path.join(root, '.akb', 'base.json')
  if (!fs.existsSync(file)) return { ok: true, value: null }
  try {
    const base = JSON.parse(fs.readFileSync(file, 'utf8')) as { project?: unknown; files?: unknown }
    if (!base || typeof base !== 'object' || (base.project !== undefined && (typeof base.project !== 'string' || !base.project.trim()))
      || (base.files !== undefined && (!base.files || typeof base.files !== 'object' || Array.isArray(base.files)))) throw new Error()
    const projects = new Set(Object.keys(base.files ?? {}).flatMap((p) => /^projects\/([^/]+)\//.exec(p)?.[1] ?? []))
    if (typeof base.project === 'string') projects.add(base.project)
    if (projects.size !== 1) throw new Error()
    return { ok: true, value: [...projects][0]! }
  } catch {
    return { ok: false, error: 'The project link is invalid or names multiple projects.', code: 'invalid-link' }
  }
}

export async function creationProject(board: string, root: string, task = workspaceTask()): Promise<CloudCall<string>> {
  const link = linkedProject(board, root)
  if (!link.ok) return link
  let project = link.value
  if (task) {
    const source = await call<CloudTask>('GET', `/v1/tasks/${encodeURIComponent(task)}`)
    if (!source.ok) return {
      ...source,
      error: source.code === 'forbidden'
        ? 'Cannot access this task. Check your account and task access in WildCrane, then try again.'
        : source.code === 'not_found'
          ? 'This task does not exist. Start a new task from the WildCrane web app.'
          : source.error,
    }
    if (project && project !== source.value.project) return { ok: false, error: 'The source task conflicts with this board’s project link.', code: 'invalid-link' }
    project = source.value.project
  }
  if (!project) return { ok: false, error: 'This board is not linked to a Cloud project.', code: 'unlinked' }
  const checked = await call<unknown>('GET', `/v1/projects/${encodeURIComponent(project)}`)
  return checked.ok ? { ok: true, value: project } : checked
}

export async function createProjectTask(project: string, said: NewTask, key: string): Promise<CloudCall<{ task: CloudTask; number: number }>> {
  const made = await call<CloudTask>('POST', '/v1/tasks', {
    title: said.title, project, source: 'api',
    ...(said.workflow ? { workflow: cloudWorkflow(said.workflow) } : {}),
    ...(said.request?.trim() ? { request: said.request.trim() } : {}),
    ...(said.agent ? { source_context: { agent: said.agent } } : {}),
    ...(said.triage ? { triage: `tri_${project.replace(/^prj_/, '')}_${said.triage}` } : {}),
  }, key)
  if (!made.ok) return made
  const number = numberOf(made.value.key)
  if (!Number.isInteger(number)) return { ok: false, error: `Cloud answered a task with no number: ${made.value.key}`, code: 'refused' }
  return { ok: true, value: { task: made.value, number } }
}

/** The web's Approve on card `number` of `project`: Cloud moves the task on and sends its next
 *  step to the Runner. */
export async function approveTask(project: string, number: number): Promise<CloudCall<{ key: string }>> {
  const held = await call<{ prefix: string }>('GET', `/v1/projects/${encodeURIComponent(project)}`)
  if (!held.ok) return held
  const key = `${held.value.prefix}-${number}`
  const task = await call<{ review?: { revision?: number } | null }>('GET', `/v1/tasks/${encodeURIComponent(key)}`)
  if (!task.ok) return task
  const revision = task.value.review?.revision
  const decided = await call('POST', `/v1/tasks/${encodeURIComponent(key)}/decisions`, {
    decision: 'approve',
    ...(revision !== undefined ? { review_revision: revision } : {}),
  })
  return decided.ok ? { ok: true, value: { key } } : decided
}
