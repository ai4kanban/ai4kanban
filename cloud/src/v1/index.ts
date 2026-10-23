/**
 * The public API (#2000): one route table, which openapi.json must match exactly
 * (test/v1.test.mjs). Every surface, WildCrane's own included, calls only these.
 */

import { call, mutate } from '../db.ts'
import type { Env } from '../env.ts'
import {
  artifactsUnavailable,
  badRequest,
  methodNotAllowed,
  notFound,
  payloadTooLarge,
  readOnly,
  sessionRequired,
} from '../errors.ts'
import { bodyOf, json } from '../http.ts'
import openapi from '../../openapi.json' with { type: 'json' }
import { API_KEY_PREFIX, actorOf, authenticate, deprecationHeaders, idOf, idempotent, pageOf, sha256 } from './http.ts'
import type { Caller } from './http.ts'
import {
  LIMITS,
  TASK_STATUSES,
  apiKeyInput,
  artifactInput,
  decisionInput,
  memoryInput,
  objectOf,
  projectInput,
  taskInput,
  taskPatch,
  uploadInput,
  versionInput,
  workflowInput,
} from './input.ts'
import { eventSeq, openStream, poke, readEvents } from './stream.ts'
import { BUILTIN_WORKFLOWS, builtinJson, builtinWorkflow, isBuiltin } from './workflows.ts'
import type { WorkflowDefinition } from './workflows.ts'

interface Call {
  env: Env
  ctx: ExecutionContext
  request: Request
  url: URL
  caller: Caller
  /** The path's `{…}` values, in order. */
  params: string[]
}

type Handler = (c: Call) => Promise<Response>

const page = (c: Call, prefix?: string) => ({ p_account: c.caller.accountId, ...pageOf(c.url.searchParams, prefix) })

const read = async (c: Call, fn: string, args: Record<string, unknown>) =>
  json(await call(c.env, fn, { p_account: c.caller.accountId, ...args }))

/** A change: written, then the account's open streams told. */
async function write(c: Call, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const done = await mutate(c.env, fn, { p_account: c.caller.accountId, ...args })
  poke(c.env, c.ctx, c.caller.accountId)
  return done
}

const change = async (c: Call, fn: string, args: Record<string, unknown>) => json(await write(c, fn, args))

/** A create: `201`, replayed under an `Idempotency-Key`. */
async function create(c: Call, fn: string, args: (body: Record<string, unknown>) => Record<string, unknown>) {
  const body = await bodyOf(c.request)
  const fields = args(objectOf(body))
  return idempotent(c.env, c.caller, c.request, body, async () => ({ status: 201, body: await write(c, fn, fields) }))
}

const id = (c: Call, prefix: string, what: string, at = 0) => idOf(c.params[at], prefix, what)

function requireSession(c: Call) {
  if (c.caller.key) throw sessionRequired()
}

function requireOwnWorkflow(c: Call): string {
  const wf = id(c, 'wf', 'workflow')
  if (isBuiltin(wf)) throw builtinWorkflow(wf) ? readOnly() : notFound('No workflow has this id.')
  return wf
}

async function workflowFor(c: Call, wf: string): Promise<WorkflowDefinition> {
  const builtin = builtinWorkflow(wf)
  if (builtin) return builtin
  if (isBuiltin(wf)) throw notFound('No workflow has this id.')
  const own = await call<WorkflowDefinition>(c.env, 'v1_workflow', { p_account: c.caller.accountId, p_id: wf })
  const { id, name, description, expertise, checkpoints, memory } = own
  return { id, name, description, expertise, checkpoints, memory }
}

async function createApiKey(c: Call): Promise<Response> {
  requireSession(c)
  const { name } = apiKeyInput(objectOf((await bodyOf(c.request)) ?? {}))
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const key = API_KEY_PREFIX + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const row = await mutate<Record<string, unknown>>(c.env, 'v1_create_api_key', {
    p_account: c.caller.accountId,
    p_name: name,
    p_prefix: key.slice(0, 12),
    p_hash: await sha256(key),
  })
  return json({ ...row, key }, 201)
}

async function listWorkflows(c: Call): Promise<Response> {
  const args = page(c, 'wf')
  const own = await call<{ data: unknown[]; next: string | null }>(c.env, 'v1_list_workflows', args)
  const builtins = args.p_after ? [] : BUILTIN_WORKFLOWS.map(builtinJson)
  return json({ data: [...builtins, ...own.data], next: own.next })
}

async function getWorkflow(c: Call): Promise<Response> {
  const wf = id(c, 'wf', 'workflow')
  const builtin = builtinWorkflow(wf)
  if (builtin) return json(builtinJson(builtin))
  if (isBuiltin(wf)) throw notFound('No workflow has this id.')
  return read(c, 'v1_workflow', { p_id: wf })
}

async function createTask(c: Call): Promise<Response> {
  const body = await bodyOf(c.request)
  const { fields, workflow } = taskInput(objectOf(body))
  const definition = await workflowFor(c, workflow)
  return idempotent(c.env, c.caller, c.request, body, async () => ({
    status: 201,
    body: await write(c, 'v1_create_task', { p_fields: fields, p_workflow: definition }),
  }))
}

function listTasks(c: Call): Promise<Response> {
  const project = c.url.searchParams.get('project')
  const status = c.url.searchParams.get('status')
  if (status && !(TASK_STATUSES as readonly string[]).includes(status)) throw badRequest('That is not a task status.')
  return read(c, 'v1_list_tasks', {
    ...pageOf(c.url.searchParams, 'task'),
    p_project: project ? idOf(project, 'prj', 'project') : null,
    p_status: status || null,
  })
}

const versionOf = (c: Call) => {
  const n = Number(c.params[1])
  if (!Number.isInteger(n) || n < 1) throw badRequest('That is not a version number.')
  return n
}

async function getVersion(c: Call): Promise<Response> {
  const { stored: _stored, ...version } = await call<Record<string, unknown>>(c.env, 'v1_artifact_version', {
    p_account: c.caller.accountId,
    p_artifact: id(c, 'art', 'artifact'),
    p_version: versionOf(c),
  })
  return json(version)
}

async function getVersionFile(c: Call): Promise<Response> {
  const bucket = c.env.ARTIFACTS
  if (!bucket) throw artifactsUnavailable()
  const { stored } = await call<{ stored: { key: string; content_type: string } | null }>(c.env, 'v1_artifact_version', {
    p_account: c.caller.accountId,
    p_artifact: id(c, 'art', 'artifact'),
    p_version: versionOf(c),
  })
  if (!stored) throw notFound('This version has no file.')
  const object = await bucket.get(stored.key)
  if (!object) throw notFound('This version has no file.')
  return new Response(object.body, {
    headers: { 'content-type': stored.content_type, 'content-length': String(object.size) },
  })
}

async function createUpload(c: Call): Promise<Response> {
  if (!c.env.ARTIFACTS) throw artifactsUnavailable()
  const type = uploadInput(objectOf((await bodyOf(c.request)) ?? {}))
  const upload = await mutate<Record<string, unknown>>(c.env, 'v1_create_upload', {
    p_account: c.caller.accountId,
    p_artifact: id(c, 'art', 'artifact'),
    p_content_type: type,
  })
  return json({ ...upload, max_size: LIMITS.file }, 201)
}

async function putUpload(c: Call): Promise<Response> {
  const bucket = c.env.ARTIFACTS
  if (!bucket) throw artifactsUnavailable()
  const upload = id(c, 'upl', 'upload')
  const target = await call<{ key: string; content_type: string } | null>(c.env, 'v1_upload_target', {
    p_account: c.caller.accountId,
    p_upload: upload,
  })
  if (!target) throw notFound('No upload is waiting under this id.')
  const tooLarge = () => payloadTooLarge(`A file is limited to ${LIMITS.file / 1024 / 1024} MB.`)
  if (Number(c.request.headers.get('content-length') ?? 0) > LIMITS.file) throw tooLarge()
  const bytes = await readCapped(c.request, LIMITS.file, tooLarge)
  await bucket.put(target.key, bytes, { httpMetadata: { contentType: target.content_type } })
  return json(await mutate(c.env, 'v1_finish_upload', { p_account: c.caller.accountId, p_upload: upload, p_size: bytes.length }))
}

async function readCapped(request: Request, max: number, refuse: () => Error): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array()
  const parts: Uint8Array[] = []
  let size = 0
  const reader = request.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > max) {
      await reader.cancel()
      throw refuse()
    }
    parts.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}

function listMemories(c: Call): Promise<Response> {
  const q = c.url.searchParams
  const scope = q.get('scope')
  if (scope && scope !== 'project' && scope !== 'user') throw badRequest('scope must be project or user.')
  return read(c, 'v1_list_memories', {
    ...pageOf(q, 'mem'),
    p_scope: scope || null,
    p_project: q.get('project') ? idOf(q.get('project'), 'prj', 'project') : null,
    p_task: q.get('task') ? idOf(q.get('task'), 'task', 'task') : null,
  })
}

async function listEvents(c: Call): Promise<Response> {
  const { p_limit } = pageOf(c.url.searchParams)
  return json(await readEvents(c.env, c.caller.accountId, eventSeq(c.url.searchParams.get('after')), p_limit))
}

export const ROUTES: [string, string, Handler][] = [
  ['GET', '/v1/api-keys', (c) => read(c, 'v1_list_api_keys', pageOf(c.url.searchParams, 'key'))],
  ['POST', '/v1/api-keys', createApiKey],
  ['DELETE', '/v1/api-keys/{id}', (c) => {
    requireSession(c)
    return change(c, 'v1_revoke_api_key', { p_id: id(c, 'key', 'API key') })
  }],

  ['GET', '/v1/projects', (c) => read(c, 'v1_list_projects', pageOf(c.url.searchParams, 'prj'))],
  ['POST', '/v1/projects', (c) => create(c, 'v1_create_project', (b) => ({ p_fields: projectInput(b) }))],
  ['GET', '/v1/projects/{id}', (c) => read(c, 'v1_project', { p_id: id(c, 'prj', 'project') })],
  ['PATCH', '/v1/projects/{id}', async (c) =>
    change(c, 'v1_update_project', { p_id: id(c, 'prj', 'project'), p_fields: projectInput(objectOf(await bodyOf(c.request)), true) })],
  ['DELETE', '/v1/projects/{id}', (c) => change(c, 'v1_delete_project', { p_id: id(c, 'prj', 'project') })],

  ['GET', '/v1/workflows', listWorkflows],
  ['POST', '/v1/workflows', (c) => create(c, 'v1_create_workflow', (b) => ({ p_fields: workflowInput(b) }))],
  ['GET', '/v1/workflows/{id}', getWorkflow],
  ['PATCH', '/v1/workflows/{id}', async (c) => {
    const wf = requireOwnWorkflow(c)
    return change(c, 'v1_update_workflow', { p_id: wf, p_fields: workflowInput(objectOf(await bodyOf(c.request)), true) })
  }],
  ['DELETE', '/v1/workflows/{id}', (c) => change(c, 'v1_delete_workflow', { p_id: requireOwnWorkflow(c) })],

  ['GET', '/v1/tasks', listTasks],
  ['POST', '/v1/tasks', createTask],
  ['GET', '/v1/tasks/{id}', (c) => read(c, 'v1_task', { p_id: id(c, 'task', 'task') })],
  ['PATCH', '/v1/tasks/{id}', async (c) =>
    change(c, 'v1_update_task', { p_id: id(c, 'task', 'task'), p_fields: taskPatch(objectOf(await bodyOf(c.request))) })],
  ['POST', '/v1/tasks/{id}/cancel', (c) => change(c, 'v1_cancel_task', { p_id: id(c, 'task', 'task') })],

  ['GET', '/v1/tasks/{id}/checkpoints', (c) => read(c, 'v1_list_checkpoints', { p_task: id(c, 'task', 'task') })],
  ['GET', '/v1/checkpoints/{id}', (c) => read(c, 'v1_checkpoint', { p_id: id(c, 'cp', 'checkpoint') })],

  ['GET', '/v1/tasks/{id}/artifacts', (c) =>
    read(c, 'v1_list_artifacts', { p_task: id(c, 'task', 'task'), ...pageOf(c.url.searchParams, 'art') })],
  ['POST', '/v1/tasks/{id}/artifacts', (c) =>
    create(c, 'v1_create_artifact', (b) => ({ p_task: id(c, 'task', 'task'), p_fields: artifactInput(b) }))],
  ['GET', '/v1/artifacts/{id}', (c) => read(c, 'v1_artifact', { p_id: id(c, 'art', 'artifact') })],
  ['POST', '/v1/artifacts/{id}/versions', (c) =>
    create(c, 'v1_create_artifact_version', (b) => ({ p_artifact: id(c, 'art', 'artifact'), ...versionInput(b) }))],
  ['GET', '/v1/artifacts/{id}/versions/{version}', getVersion],
  ['GET', '/v1/artifacts/{id}/versions/{version}/file', getVersionFile],
  ['POST', '/v1/artifacts/{id}/uploads', createUpload],
  ['PUT', '/v1/uploads/{id}', putUpload],

  ['GET', '/v1/checkpoints/{id}/decisions', (c) =>
    read(c, 'v1_list_decisions', { p_checkpoint: id(c, 'cp', 'checkpoint'), ...pageOf(c.url.searchParams, 'dec') })],
  ['POST', '/v1/checkpoints/{id}/decisions', (c) =>
    create(c, 'v1_create_decision', (b) => ({
      p_checkpoint: id(c, 'cp', 'checkpoint'),
      p_fields: decisionInput(b),
      p_actor: actorOf(c.caller),
    }))],

  ['GET', '/v1/memories', listMemories],
  ['POST', '/v1/memories', (c) => create(c, 'v1_create_memory', (b) => ({ p_fields: memoryInput(b) }))],
  ['GET', '/v1/memories/{id}', (c) => read(c, 'v1_memory', { p_id: id(c, 'mem', 'memory') })],
  ['PUT', '/v1/memories/{id}', async (c) =>
    change(c, 'v1_update_memory', { p_id: id(c, 'mem', 'memory'), p_fields: memoryInput(objectOf(await bodyOf(c.request)), true) })],
  ['DELETE', '/v1/memories/{id}', (c) => change(c, 'v1_delete_memory', { p_id: id(c, 'mem', 'memory') })],

  ['GET', '/v1/events', listEvents],
  ['GET', '/v1/events/stream', (c) => openStream(c.env, c.caller.accountId, c.request)],
]

const MATCHERS = ROUTES.map(([method, path, handler]) => ({
  method,
  path,
  handler,
  pattern: new RegExp(`^${path.replace(/\{[^}]+\}/g, '([^/]+)')}$`),
}))

/** Any browser origin may call the public API: it is bearer-authenticated, never by cookie. */
export const V1_CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE',
  'access-control-allow-headers': 'authorization, content-type, idempotency-key, last-event-id',
  'access-control-expose-headers': 'deprecation, sunset, link, idempotent-replayed, retry-after',
  'access-control-max-age': '86400',
}

export const isV1Path = (pathname: string) =>
  pathname === '/v1/openapi.json' || MATCHERS.some((m) => m.pattern.test(pathname))

/**
 * Whether a request is the public API's. `GET /v1/events` is shared with the v0.11 event
 * feed until it retires: it is this one when the request carries `after` or an API key.
 */
export function isV1Request(request: Request, url: URL): boolean {
  if (url.pathname === '/v1/events') {
    const bearer = request.headers.get('authorization') ?? ''
    return url.searchParams.has('after') || bearer.slice(7).trim().startsWith(API_KEY_PREFIX)
  }
  return isV1Path(url.pathname)
}

export async function routeV1(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  if (url.pathname === '/v1/openapi.json') {
    if (request.method !== 'GET') throw methodNotAllowed()
    return json(openapi)
  }
  const matched = MATCHERS.filter((m) => m.pattern.test(url.pathname))
  const route = matched.find((m) => m.method === request.method)
  if (!route) throw matched.length > 0 ? methodNotAllowed() : notFound()
  const params = (route.pattern.exec(url.pathname) ?? []).slice(1).map(decodeURIComponent)
  const caller = await authenticate(request, env)
  const response = await route.handler({ env, ctx, request, url, caller, params })
  const deprecation = deprecationHeaders(`${route.method} ${route.path}`)
  if (Object.keys(deprecation).length === 0) return response
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(deprecation)) headers.set(name, value)
  return new Response(response.body, { status: response.status, headers })
}
