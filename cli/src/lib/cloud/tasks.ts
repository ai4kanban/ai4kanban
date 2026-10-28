// A Runner workspace's new tasks go to Cloud (#2063): the Runner names the task a job runs for
// in `AI4KANBAN_TASK`, and a task made there is a Cloud task of the same project, numbered by
// Cloud and linked back to that task. Without the variable nothing here is used.

import crypto from 'node:crypto'

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

async function call<T>(method: 'GET' | 'POST', route: string, body?: unknown, key?: string): Promise<CloudCall<T> & { replayed?: boolean }> {
  if (!cloudConfigured()) return { ok: false, error: NOT_CONFIGURED, code: 'bad_request' }
  const token = await accessToken()
  if (!token.ok) {
    return token.reason === 'unreachable'
      ? { ok: false, error: `Cloud could not be reached: ${token.error}` }
      : { ok: false, error: 'This machine is not signed in to Cloud.', code: 'unauthenticated' }
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
}

export interface CardFields {
  priority?: string
  roi?: string
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
    source_context: { task: from },
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
