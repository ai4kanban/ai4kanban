/**
 * What a public API body may hold (#2000), checked before it reaches a query: every field's
 * type, every text's length, every list's count. Unknown fields are ignored.
 */

import { badRequest, payloadTooLarge } from '../errors.ts'
import { idOf } from './http.ts'

const KB = 1024
const MB = 1024 * KB

export const LIMITS = {
  name: 200,
  text: 4000,
  expertise: 64 * KB,
  request: 64 * KB,
  sourceContext: 16 * KB,
  comment: 16 * KB,
  checkpoints: 50,
  memoryEntries: 50,
  memoryBody: 64 * KB,
  inlineArtifact: 256 * KB,
  file: 50 * MB,
}

export const TASK_SOURCES = ['web', 'slack', 'codex', 'api'] as const
export const TASK_STATUSES = ['queued', 'running', 'waiting_review', 'done', 'failed', 'cancelled'] as const
/** What a PATCH may set; `cancelled` goes through `/cancel`. */
const SETTABLE_STATUSES = TASK_STATUSES.filter((s) => s !== 'cancelled')

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const CONTENT_TYPE = /^[\w.+-]+\/[\w.+-]+(\s*;\s*[\w.+-]+=[\w.+-]+)*$/

type Fields = Record<string, unknown>

export function objectOf(body: unknown): Fields {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('The body must be a JSON object.')
  return body as Fields
}

const bytes = (text: string) => new TextEncoder().encode(text).length

function text(value: unknown, field: string, max: number, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw badRequest(`${field} is required.`)
    return undefined
  }
  if (typeof value !== 'string') throw badRequest(`${field} must be a string.`)
  const held = max <= LIMITS.name ? value.trim() : value
  if (required && !held) throw badRequest(`${field} is required.`)
  if (bytes(held) > max) throw payloadTooLarge(`${field} is longer than ${max} bytes.`)
  return held
}

function slug(value: unknown, field: string, required = false): string | undefined {
  const held = text(value, field, 64, required)
  if (held !== undefined && !SLUG.test(held)) throw badRequest(`${field} must be lowercase words joined by hyphens.`)
  return held
}

function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined
  if (!allowed.includes(value as T)) throw badRequest(`${field} must be one of ${allowed.join(', ')}.`)
  return value as T
}

const compact = (fields: Fields) => Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))

function patchOf(fields: Fields): Fields {
  const held = compact(fields)
  if (Object.keys(held).length === 0) throw badRequest('Nothing to change.')
  return held
}

export const apiKeyInput = (body: Fields) => ({ name: text(body.name, 'name', LIMITS.name) || 'API key' })

export function projectInput(body: Fields, patch = false): Fields {
  const fields = { name: text(body.name, 'name', LIMITS.name, !patch), path: text(body.path, 'path', 4096) }
  return patch ? patchOf(fields) : compact(fields)
}

function checkpointsOf(value: unknown) {
  if (!Array.isArray(value)) throw badRequest('checkpoints must be a list.')
  if (value.length > LIMITS.checkpoints) throw payloadTooLarge(`A workflow has at most ${LIMITS.checkpoints} checkpoints.`)
  const keys = new Set<string>()
  return value.map((item, i) => {
    const held = objectOf(item)
    const key = slug(held.key, `checkpoints[${i}].key`, true) as string
    if (keys.has(key)) throw badRequest(`Two checkpoints share the key ${key}.`)
    keys.add(key)
    return {
      key,
      title: text(held.title, `checkpoints[${i}].title`, LIMITS.name, true),
      artifact_type: slug(held.artifact_type, `checkpoints[${i}].artifact_type`) ?? null,
      question: text(held.question, `checkpoints[${i}].question`, LIMITS.text) ?? '',
      acceptance: text(held.acceptance, `checkpoints[${i}].acceptance`, LIMITS.text) ?? '',
    }
  })
}

function memoryPlanOf(value: unknown) {
  const held = objectOf(value)
  const entries = (list: unknown, scope: string) => {
    if (list === undefined) return []
    if (!Array.isArray(list)) throw badRequest(`memory.${scope} must be a list.`)
    if (list.length > LIMITS.memoryEntries) throw payloadTooLarge(`memory.${scope} has at most ${LIMITS.memoryEntries} entries.`)
    return list.map((item, i) => {
      const entry = objectOf(item)
      return {
        name: text(entry.name, `memory.${scope}[${i}].name`, LIMITS.name, true),
        description: text(entry.description, `memory.${scope}[${i}].description`, LIMITS.text) ?? '',
      }
    })
  }
  return { project: entries(held.project, 'project'), user: entries(held.user, 'user') }
}

export function workflowInput(body: Fields, patch = false): Fields {
  const fields = {
    name: text(body.name, 'name', LIMITS.name, !patch),
    description: text(body.description, 'description', LIMITS.text),
    expertise: text(body.expertise, 'expertise', LIMITS.expertise),
    checkpoints: body.checkpoints === undefined ? undefined : checkpointsOf(body.checkpoints),
    memory: body.memory === undefined ? undefined : memoryPlanOf(body.memory),
  }
  return patch ? patchOf(fields) : compact(fields)
}

export function taskInput(body: Fields): { fields: Fields; workflow: string } {
  const context = body.source_context
  if (context !== undefined && (typeof context !== 'object' || context === null || Array.isArray(context))) {
    throw badRequest('source_context must be an object.')
  }
  if (context !== undefined && bytes(JSON.stringify(context)) > LIMITS.sourceContext) {
    throw payloadTooLarge(`source_context is larger than ${LIMITS.sourceContext} bytes.`)
  }
  return {
    workflow: idOf(body.workflow, 'wf', 'workflow'),
    fields: compact({
      title: text(body.title, 'title', LIMITS.name, true),
      request: text(body.request, 'request', LIMITS.request),
      project: body.project == null ? undefined : idOf(body.project, 'prj', 'project'),
      source: oneOf(body.source, 'source', TASK_SOURCES),
      source_context: context,
    }),
  }
}

export const taskPatch = (body: Fields): Fields =>
  patchOf({ title: text(body.title, 'title', LIMITS.name), status: oneOf(body.status, 'status', SETTABLE_STATUSES) })

export const artifactInput = (body: Fields): Fields =>
  compact({
    type: slug(body.type, 'type', true),
    name: text(body.name, 'name', LIMITS.name),
    checkpoint: body.checkpoint == null ? undefined : idOf(body.checkpoint, 'cp', 'checkpoint'),
  })

/** Inline JSON, or a finished upload. */
export function versionInput(body: Fields): { p_content: unknown; p_upload: string | null } {
  if (body.upload != null) return { p_content: null, p_upload: idOf(body.upload, 'upl', 'upload') }
  if (body.content === undefined || body.content === null) throw badRequest('A version needs content or an upload.')
  if (bytes(JSON.stringify(body.content)) > LIMITS.inlineArtifact) {
    throw payloadTooLarge(`Inline content is limited to ${LIMITS.inlineArtifact / KB} KB; upload a file instead.`)
  }
  return { p_content: body.content, p_upload: null }
}

export function uploadInput(body: Fields): string {
  const type = text(body.content_type, 'content_type', LIMITS.name) || 'application/octet-stream'
  if (!CONTENT_TYPE.test(type)) throw badRequest('content_type is not a media type.')
  return type
}

export function decisionInput(body: Fields): Fields {
  const version = body.artifact_version
  if (version !== undefined && (!Number.isInteger(version) || (version as number) < 1)) {
    throw badRequest('artifact_version must be a positive whole number.')
  }
  if (version !== undefined && body.artifact == null) throw badRequest('artifact_version needs artifact.')
  return compact({
    decision: oneOf(body.decision ?? null, 'decision', ['approve', 'request_changes']),
    comment: text(body.comment, 'comment', LIMITS.comment),
    artifact: body.artifact == null ? undefined : idOf(body.artifact, 'art', 'artifact'),
    artifact_version: version,
  })
}

export function memoryInput(body: Fields, patch = false): Fields {
  const name = text(body.name, 'name', LIMITS.name, !patch)
  const content = text(body.body, 'body', LIMITS.memoryBody)
  if (patch) return patchOf({ name, body: content })
  const scope = oneOf(body.scope ?? null, 'scope', ['project', 'user'])
  if (scope === 'project' && body.project == null) throw badRequest('Project memory needs project.')
  return compact({
    scope,
    project: scope === 'project' ? idOf(body.project, 'prj', 'project') : undefined,
    name,
    body: content,
  })
}
