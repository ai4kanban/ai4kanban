/**
 * What a public API body may hold (#2000), checked before it reaches a query: every field's
 * type, every text's length, every list's count. Unknown fields are ignored.
 */

import { badRequest, payloadTooLarge } from '../errors.ts'
import { uuid } from '../input.ts'
import { idOf } from './http.ts'
import { ofTriageId } from '../triage-files.ts'
import { checkWorkflowFiles, landsOf } from './workflow-files.ts'
import { BOARD_FILE_LIMIT, numberOfCard } from '../board-files.ts'
import { SCHEDULED_ACTIONS, normalizeSchedule } from '../../../cli/src/lib/schedule.ts'

const KB = 1024
const MB = 1024 * KB

export const LIMITS = {
  name: 200,
  text: 4000,
  reason: 2000,
  request: 64 * KB,
  sourceContext: 16 * KB,
  comment: 16 * KB,
  card: 256 * KB,
  stages: 20,
  inlineArtifact: 256 * KB,
  /** A single PUT, and each part of a larger upload. Plan limits are src/quota.ts's. */
  part: 50 * MB,
}

export const TASK_SOURCES = ['web', 'slack', 'codex', 'api'] as const
export const TASK_STATUSES = ['queued', 'running', 'waiting_review', 'done', 'failed', 'cancelled', 'stopped'] as const
/** What a PATCH may set; `cancelled` and `stopped` go through `/cancel` and `/stop`. */
const SETTABLE_STATUSES = TASK_STATUSES.filter((s) => s !== 'cancelled' && s !== 'stopped')

/** A built-in type, or a component's `@<handle>/<name>` (#2006). */
const ARTIFACT_TYPE = /^(@[a-z0-9][a-z0-9-]*\/)?[a-z0-9]+(-[a-z0-9]+)*$/
const PREFIX = /^[A-Z][A-Z0-9]{0,9}$/
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

function artifactType(value: unknown): string {
  const held = text(value, 'type', 128, true)!
  if (!ARTIFACT_TYPE.test(held)) throw badRequest('type must be lowercase words joined by hyphens, or @<account>/<name>.')
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

/** The workspace a create goes into; the caller's personal one when absent. */
const workspaceOf = (value: unknown) => (value == null ? undefined : idOf(value, 'ws', 'workspace'))

export const workspaceInput = (body: Fields): Fields => ({ name: text(body.name, 'name', LIMITS.name, true) })

export const MEMBER_ROLES = ['owner', 'member'] as const

export const memberRoleInput = (body: Fields) => oneOf(body.role ?? null, 'role', MEMBER_ROLES) as string

function prefix(value: unknown): string | undefined {
  const held = text(value, 'prefix', LIMITS.name)?.toUpperCase()
  if (held !== undefined && !PREFIX.test(held)) throw badRequest('prefix must be 1–10 letters and digits, starting with a letter.')
  return held
}

export function projectInput(body: Fields, patch = false): Fields {
  const fields = {
    name: text(body.name, 'name', LIMITS.name, !patch),
    path: text(body.path, 'path', 4096),
    prefix: prefix(body.prefix),
  }
  return patch ? patchOf(fields) : compact({ ...fields, workspace: workspaceOf(body.workspace) })
}

const RETIRED_WORKFLOW_FIELDS = ['expertise', 'checkpoints', 'memory']

/** A workflow is its files, checked the way akb reads them; name and description come from
 *  `WORKFLOW.md`. A PATCH replaces every file. */
export function workflowInput(body: Fields): Fields {
  const retired = RETIRED_WORKFLOW_FIELDS.find((field) => body[field] !== undefined)
  if (retired) throw badRequest(`${retired} is no longer part of a workflow; send its files instead.`)
  if (body.files === undefined) throw badRequest('files is required.')
  const checked = checkWorkflowFiles(body.files)
  if (!checked.ok) {
    const message = `${checked.file} ${checked.reason}.`
    throw checked.tooLarge ? payloadTooLarge(message) : badRequest(message)
  }
  const { name, description } = checked.def
  return compact({
    name: name.slice(0, LIMITS.name),
    description: description.slice(0, LIMITS.text),
    ...landsOf(checked.def),
    files: checked.files,
    workspace: workspaceOf(body.workspace),
  })
}

export function taskInput(body: Fields): { fields: Fields; workflow: string } {
  const context = body.source_context
  if (context !== undefined && (typeof context !== 'object' || context === null || Array.isArray(context))) {
    throw badRequest('source_context must be an object.')
  }
  if (context !== undefined && bytes(JSON.stringify(context)) > LIMITS.sourceContext) {
    throw payloadTooLarge(`source_context is larger than ${LIMITS.sourceContext} bytes.`)
  }
  if (body.skip_plan === true && body.run !== true) throw badRequest('skip_plan needs run.')
  return {
    workflow: idOf(body.workflow, 'wf', 'workflow'),
    fields: compact({
      title: text(body.title, 'title', LIMITS.name, true),
      request: text(body.request, 'request', LIMITS.request),
      workspace: workspaceOf(body.workspace),
      project: body.project == null ? undefined : idOf(body.project, 'prj', 'project'),
      source: oneOf(body.source, 'source', TASK_SOURCES),
      source_context: context,
      run: body.run === undefined || body.run === false ? undefined : bool(body.run, 'run'),
      skip_plan: body.skip_plan === undefined || body.skip_plan === false ? undefined : bool(body.skip_plan, 'skip_plan'),
      runtime: body.runtime == null ? undefined : idOf(body.runtime, 'rt', 'runtime'),
      triage: body.triage == null ? undefined : triageIdOf(body.triage),
      context: contextOf(body.context),
      metadata: body.metadata == null ? undefined : taskMetadataOf(body.metadata),
    }),
  }
}

const TASK_METADATA = ['priority', 'roi', 'modules', 'related', 'blocked_by']

/** A new task's card fields, as `PUT /v1/tasks/{id}/card` takes them. */
function taskMetadataOf(value: unknown): Fields | undefined {
  const held = objectOf(value)
  const other = Object.keys(held).find((key) => !TASK_METADATA.includes(key))
  if (other) throw badRequest(`metadata takes only ${TASK_METADATA.join(', ')}.`)
  const out = cardMetadataOf(held)
  return Object.keys(out).length ? out : undefined
}

/** `{ workflow? }`: the own workflow a Workflow builder task changes (#2004). */
function contextOf(value: unknown): Fields | undefined {
  if (value == null) return undefined
  if (typeof value !== 'object' || Array.isArray(value)) throw badRequest('context must be an object.')
  const { workflow, ...rest } = value as Fields
  if (Object.keys(rest).length) throw badRequest('context takes only workflow.')
  return workflow == null ? undefined : { workflow: idOf(workflow, 'wf', 'workflow') }
}

/** A cancel's or a dismissal's reason, optional: what the review learns from (#2067). */
export const reasonInput = (body: Fields) => text(body.reason, 'reason', LIMITS.reason)?.trim() || null

export const TRIAGE_STATES = ['open', 'dismissed', 'carded'] as const

export const triageInput = (body: Fields): Fields =>
  compact({
    title: text(body.title, 'title', LIMITS.name, true),
    text: text(body.text, 'text', LIMITS.request),
    workspace: workspaceOf(body.workspace),
    project: body.project == null ? undefined : idOf(body.project, 'prj', 'project'),
    source_task: body.source_task == null ? undefined : idOf(body.source_task, 'task', 'task'),
    workflow: idOf(body.workflow, 'wf', 'workflow'),
  })


const REVIEWED_MAX = 200

function idsOf(value: unknown, field: string, prefix: string, what: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > REVIEWED_MAX) throw badRequest(`${field} must be a list of at most ${REVIEWED_MAX} ids.`)
  return value.map((v) => idOf(v, prefix, what))
}

/** `{ tasks, triage }`: what a rejection review learned. */
export const reviewedInput = (body: Fields) => ({
  p_tasks: idsOf(body.tasks, 'tasks', 'task', 'task'),
  p_triage: (() => {
    if (body.triage === undefined) return []
    if (!Array.isArray(body.triage) || body.triage.length > REVIEWED_MAX) throw badRequest(`triage must be a list of at most ${REVIEWED_MAX} ids.`)
    return body.triage.map(triageIdOf)
  })(),
})

/** A triage item's id: its project and file name (#2107). */
export function triageIdOf(value: unknown): string {
  if (!ofTriageId(value)) throw badRequest('That is not a triage item id.')
  return value as string
}

export const CONNECTORS = ['claude-code', 'codex', 'cursor', 'opencode', 'kimi', 'dsh', 'zcode', 'grok'] as const
/** A model id goes to the connector's CLI as one argument: free text, but nothing a shell or a
 *  config line would read as more than one word. */
const MODEL = /^[^\s"'`\\$;|&<>]{1,200}$/
/** A setting's key, as a harness declares it. `model` has its own field and a key is never a setting. */
const SETTING_KEY = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
const NOT_SETTINGS = new Set(['model', 'apiKey', 'command'])
const MAX_SETTINGS = 30
const MAX_SETTING = 2000
const SECRET_KEYS = ['apiKey'] as const
const MAX_SECRET = 4000

function model(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !MODEL.test(value.trim())) throw badRequest('model must be a model id, or null.')
  return value.trim()
}

/** `{ key: value }` of the connector's own settings; an empty value is dropped, which is its default. */
function settings(value: unknown): Fields | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badRequest('settings must be an object.')
  const entries = Object.entries(value as Fields)
  if (entries.length > MAX_SETTINGS) throw badRequest(`settings holds at most ${MAX_SETTINGS} keys.`)
  const out: Fields = {}
  for (const [key, held] of entries) {
    if (!SETTING_KEY.test(key) || NOT_SETTINGS.has(key)) throw badRequest(`settings cannot hold "${key}".`)
    if (held === null || held === '') continue
    if (typeof held !== 'string' || held.length > MAX_SETTING || /[\x00-\x1f]/.test(held)) {
      throw badRequest(`settings.${key} must be one line of text.`)
    }
    if (held.trim()) out[key] = held.trim()
  }
  return out
}

/** `{ apiKey: "…" | null }`: a key to hand the runtime's Runner, or null to clear it there. */
export function secretsInput(body: Fields): Record<string, string | null> | undefined {
  const value = body.secrets
  if (value === undefined) return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badRequest('secrets must be an object.')
  const out: Record<string, string | null> = {}
  for (const [key, held] of Object.entries(value as Fields)) {
    if (!(SECRET_KEYS as readonly string[]).includes(key)) throw badRequest(`secrets takes only ${SECRET_KEYS.join(', ')}.`)
    if (held === null || held === '') out[key] = null
    else if (typeof held !== 'string' || held.length > MAX_SECRET || /[\x00-\x1f]/.test(held.trim())) {
      throw badRequest(`secrets.${key} must be one line of text, or null.`)
    } else out[key] = held.trim()
  }
  return Object.keys(out).length ? out : undefined
}

/** `{ name, runner, connector, model?, settings? }`; on a patch every field is optional and
 *  `model: null` clears it. Keys go separately (`secretsInput`). */
export function runtimeInput(body: Fields, patch = false): Fields {
  const name = text(body.name, 'name', 60, !patch)
  if (patch && body.name !== undefined && !name) throw badRequest('name is required.')
  if (!patch && body.runner == null) throw badRequest('runner is required.')
  const fields = {
    name,
    runner: body.runner === undefined ? undefined : uuid(body.runner, 'runner'),
    connector: patch ? oneOf(body.connector, 'connector', CONNECTORS) : oneOf(body.connector ?? null, 'connector', CONNECTORS),
    model: model(body.model),
    settings: settings(body.settings),
  }
  if (patch) return patchOf(fields)
  return compact(fields)
}

function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw badRequest(`${field} must be true or false.`)
  return value
}

export const taskPatch = (body: Fields): Fields =>
  patchOf({
    title: text(body.title, 'title', LIMITS.name),
    status: oneOf(body.status, 'status', SETTABLE_STATUSES),
    project: body.project === undefined ? undefined : idOf(body.project, 'prj', 'project'),
  })

export const artifactInput = (body: Fields): Fields =>
  compact({
    type: artifactType(body.type),
    name: text(body.name, 'name', LIMITS.name),
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

export function uploadInput(body: Fields): { type: string; size: number | null } {
  const type = text(body.content_type, 'content_type', LIMITS.name) || 'application/octet-stream'
  if (!CONTENT_TYPE.test(type)) throw badRequest('content_type is not a media type.')
  const size = body.size ?? null
  if (size !== null && (!Number.isSafeInteger(size) || (size as number) < 1)) {
    throw badRequest('size must be a positive whole number of bytes.')
  }
  return { type, size: size as number | null }
}

export function decisionInput(body: Fields): Fields {
  const version = body.artifact_version
  if (version !== undefined && (!Number.isInteger(version) || (version as number) < 1)) {
    throw badRequest('artifact_version must be a positive whole number.')
  }
  if (version !== undefined && body.artifact == null) throw badRequest('artifact_version needs artifact.')
  const revision = body.review_revision
  if (revision !== undefined && (!Number.isInteger(revision) || (revision as number) < 0)) {
    throw badRequest('review_revision must be a whole number.')
  }
  return compact({
    review_revision: revision,
    decision: oneOf(body.decision ?? null, 'decision', ['approve', 'request_changes']),
    comment: text(body.comment, 'comment', LIMITS.comment),
    artifact: body.artifact == null ? undefined : idOf(body.artifact, 'art', 'artifact'),
    artifact_version: version,
  })
}

const integerOf = (value: unknown, field: string, min: number, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw badRequest(`${field} must be a whole number from ${min}${max < Number.MAX_SAFE_INTEGER ? ` to ${max}` : ' up'}.`)
  }
  return value as number
}

function list<T>(value: unknown, field: string, max: number, item: (v: unknown, at: string) => T): T[] {
  if (!Array.isArray(value)) throw badRequest(`${field} must be a list.`)
  if (value.length > max) throw payloadTooLarge(`${field} has at most ${max} entries.`)
  return value.map((v, i) => item(v, `${field}[${i}]`))
}

const AGENT_BOUNDARY = '<!-- agent -->'

/** Fences closed and at most one agent boundary: what the board itself refuses. */
function checkCardBody(body: string) {
  let fence: { char: string; size: number } | null = null
  let boundaries = 0
  for (const line of body.split('\n')) {
    const mark = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    const run = mark?.[1] ?? ''
    if (fence) {
      if (run[0] === fence.char && run.length >= fence.size && !mark?.[2]?.trim()) fence = null
    } else if (run) {
      fence = { char: run[0] as string, size: run.length }
    } else if (line.trim() === AGENT_BOUNDARY) {
      boundaries += 1
    }
  }
  if (fence) throw badRequest('body has a code fence that is never closed.')
  if (boundaries > 1) throw badRequest(`body holds ${AGENT_BOUNDARY} more than once.`)
}

const CARD_TEXT = ['priority', 'roi', 'parent'] as const
const CARD_LISTS = ['modules', 'source', 'related', 'blocked_by'] as const

function cardMetadataOf(value: unknown): Fields {
  const held = objectOf(value)
  const out: Fields = {}
  for (const key of CARD_TEXT) out[key] = text(held[key], `metadata.${key}`, LIMITS.name)
  for (const key of CARD_LISTS) {
    if (held[key] !== undefined) out[key] = list(held[key], `metadata.${key}`, 50, (v, at) => text(v, at, LIMITS.name, true))
  }
  // What a card runs once nothing blocks it (#2064); null takes it off.
  if (held.schedule === null) out.schedule = null
  else if (held.schedule !== undefined) {
    const schedule = normalizeSchedule(objectOf(held.schedule))
    if (!schedule) throw badRequest(`metadata.schedule.action must be one of ${SCHEDULED_ACTIONS.join(', ')}.`)
    if ((schedule.notes?.length ?? 0) > LIMITS.text) throw payloadTooLarge(`metadata.schedule.notes is over ${LIMITS.text} characters.`)
    out.schedule = schedule
  }
  // The previews the card chose, how many approvals they make and the one it is on (#2154).
  if (held.previews !== undefined) out.previews = list(held.previews, 'metadata.previews', 50, (v, at) => text(v, at, LIMITS.name, true))
  if (held.stages !== undefined) out.stages = integerOf(held.stages, 'metadata.stages', 1, LIMITS.stages)
  if (held.phase !== undefined) out.phase = integerOf(held.phase, 'metadata.phase', 1, LIMITS.stages)
  return compact(out)
}

function cardAssetsOf(value: unknown, body: string): Fields {
  const held = objectOf(value)
  const entries = Object.entries(held)
  if (entries.length > 200) throw payloadTooLarge('assets has at most 200 entries.')
  return Object.fromEntries(entries.map(([path, ref]) => {
    if (!path || path.length > 1024) throw badRequest('An asset path must be 1 to 1024 characters.')
    if (!body.includes(path)) throw badRequest(`The asset ${path} is not named in body.`)
    const target = objectOf(ref)
    return [path, compact({
      artifact: idOf(target.artifact, 'art', 'artifact'),
      version: target.version === undefined ? undefined : integerOf(target.version, `assets.${path}.version`, 1),
    })]
  }))
}

export function cardInput(body: Fields): { p_fields: Fields; p_base: number } {
  const card = text(body.body, 'body', LIMITS.card, true) as string
  checkCardBody(card)
  return {
    p_base: integerOf(body.base_version, 'base_version', 0),
    p_fields: compact({
      body: card,
      metadata: body.metadata === undefined ? undefined : cardMetadataOf(body.metadata),
      assets: body.assets === undefined ? undefined : cardAssetsOf(body.assets, card),
    }),
  }
}

export const IMPORT_CARDS = 50
const IMPORT_FILES = 2000

export interface ImportCard {
  ref: number
  number: number
  title: string
  workflow: string
  path: string
  body: string
  /** `true` asks to approve the plan; an object asks the card's own question. */
  review?: true | { question: string; options: string[]; position: number }
}

/** `POST /v1/projects/{id}/import` (#2123): cards in the order they take numbers, and board files
 *  by the paths the workspace's board keeps them at. */
export function importInput(body: Fields): { board: string; cards: ImportCard[]; files: { path: string; content: string }[] } {
  const board = text(body.board, 'board', LIMITS.name, true) as string
  const cards = list(body.cards ?? [], 'cards', IMPORT_CARDS, (v, at) => {
    const c = objectOf(v)
    const number = integerOf(c.number, `${at}.number`, 1)
    const path = text(c.path, `${at}.path`, 500, true) as string
    if (!path.startsWith('todo/') || numberOfCard(path) !== number) throw badRequest(`${at}.path must be a card under todo/ named by its number.`)
    const card = text(c.body, `${at}.body`, LIMITS.card, true) as string
    checkCardBody(card)
    let review: ImportCard['review']
    if (c.review === true) review = true
    else if (c.review != null) {
      const r = objectOf(c.review)
      review = {
        question: text(r.question, `${at}.review.question`, LIMITS.text, true) as string,
        options: list(r.options, `${at}.review.options`, 8, (o, i) => text(o, i, LIMITS.name, true) as string),
        position: integerOf(r.position, `${at}.review.position`, 1),
      }
    }
    return {
      ref: integerOf(c.ref, `${at}.ref`, 1),
      number,
      title: text(c.title, `${at}.title`, LIMITS.name, true) as string,
      workflow: idOf(c.workflow, 'wf', 'workflow'),
      path,
      body: card,
      ...(review ? { review } : {}),
    }
  })
  const files = list(body.files ?? [], 'files', IMPORT_FILES, (v, at) => {
    const f = objectOf(v)
    if (typeof f.content !== 'string') throw badRequest(`${at}.content must be text.`)
    const content = text(f.content, `${at}.content`, BOARD_FILE_LIMIT) as string
    return { path: text(f.path, `${at}.path`, 500, true) as string, content }
  })
  return { board, cards, files }
}

/** Up to eight options: a reviewer answers with a number key, and "other" is the ninth. */
export function reviewPatch(body: Fields): Fields {
  const options = body.options === undefined ? undefined : list(body.options, 'options', 8, (v, at) => {
    const option = objectOf(v)
    if (option.approve !== undefined && typeof option.approve !== 'boolean') throw badRequest(`${at}.approve must be true or false.`)
    return { label: text(option.label, `${at}.label`, LIMITS.name, true), approve: option.approve === true }
  })
  if (options && options.filter((o) => o.approve).length !== 1) throw badRequest('Exactly one option approves.')
  return patchOf({ question: text(body.question, 'question', LIMITS.text), options })
}

export function commentInput(body: Fields): string {
  const held = text(body.body, 'body', LIMITS.comment, true) as string
  if (!held.trim()) throw badRequest('body is required.')
  return held
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ACCESS = ['invited', 'link'] as const

export function emailOf(value: unknown): string {
  const email = text(value, 'email', 254, true) as string
  if (!EMAIL.test(email.trim())) throw badRequest('That is not an email address.')
  return email.trim().toLowerCase()
}

/** `PUT /v1/tasks/{id}/guests/{email}`: the link the owner is sharing, mailed to a new guest. */
export function guestInput(body: Fields): { share_token: string | null; lang: 'zh' | 'en' } {
  const token = body.share_token
  if (token !== undefined && token !== null && (typeof token !== 'string' || !/^[\w-]{20,128}$/.test(token))) {
    throw badRequest('share_token is not a share link token.')
  }
  return { share_token: (token as string | null | undefined) ?? null, lang: oneOf(body.lang, 'lang', ['zh', 'en'] as const) ?? 'en' }
}

export function shareLinkInput(body: Fields, patch = false): Fields {
  const fields = {
    access: oneOf(body.access, 'access', ACCESS),
    expires_in_days: patch || body.expires_in_days === undefined ? undefined : integerOf(body.expires_in_days, 'expires_in_days', 1, 30),
  }
  return patch ? patchOf(fields) : compact(fields)
}

/** `runtime`: one of the caller's runtimes, or `task` to follow the task's (#2083). */
/** `{ body, runtime?, images? }`: pictures alone are a message too. */
export function chatInput(body: Fields) {
  const said = (text(body.body, 'body', LIMITS.comment) ?? '').trim()
  const images = chatImages(body.images)
  if (!said && !images.length) throw badRequest('body is required.')
  return {
    p_body: said,
    p_runtime: body.runtime == null ? null : body.runtime === 'task' ? 'task' : idOf(body.runtime, 'rt', 'runtime'),
    ...(images.length ? { p_images: images } : {}),
  }
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
export const MAX_CHAT_IMAGES = 4
/** Base64 characters across a message's pictures: runners.ts's cap on a job's attachments. */
const MAX_IMAGE_CHARS = 5_600_000

/** `[{ name, type, content }]`, content in base64, each name made unique: the files the agent opens (#2133). */
function chatImages(value: unknown): { name: string; type: string; content: string }[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > MAX_CHAT_IMAGES) throw badRequest(`Send at most ${MAX_CHAT_IMAGES} images.`)
  const names = new Set<string>()
  let size = 0
  return value.map((item) => {
    const held = objectOf(item)
    const type = IMAGE_TYPES.find((t) => t === held.type)
    if (!type) throw badRequest(`An image is one of ${IMAGE_TYPES.join(', ')}.`)
    let name = typeof held.name === 'string' ? held.name.trim() : ''
    if (!/^[^/\\\0]{1,200}$/.test(name) || name === '.' || name === '..') throw badRequest('An image needs a plain file name.')
    const content = typeof held.content === 'string' ? held.content : ''
    if (!content || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) throw badRequest('An image is sent as base64.')
    size += content.length
    if (size > MAX_IMAGE_CHARS) throw payloadTooLarge('Those images are too large.')
    const dot = name.lastIndexOf('.')
    const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
    for (let n = 2; names.has(name); n++) name = `${stem}-${n}${ext}`
    names.add(name)
    return { name, type, content }
  })
}

export function sharedDecisionInput(body: Fields) {
  const picked = body.picked == null ? null : integerOf(body.picked, 'picked', 0, 7)
  const said = text(body.text, 'text', LIMITS.comment)?.trim() || null
  if (picked === null && !said) throw badRequest('Write what should change.')
  return { p_picked: picked, p_text: said, p_revision: integerOf(body.review_revision, 'review_revision', 0) }
}

function dayOf(value: string | null, field: string): number {
  if (!value) throw badRequest(`${field} is required.`)
  const at = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) : NaN
  if (Number.isNaN(at) || new Date(at).toISOString().slice(0, 10) !== value) throw badRequest(`${field} must be a date, YYYY-MM-DD.`)
  return at
}

/** `?from=&to=&tz=` of the stats (#2066): whole days, inclusive, a year at most. */
export function statsQuery(params: URLSearchParams): { p_from: string; p_to: string; p_tz: string } {
  const from = dayOf(params.get('from'), 'from')
  const to = dayOf(params.get('to'), 'to')
  if (to < from) throw badRequest('to must not be before from.')
  const yearOn = new Date(from)
  yearOn.setUTCFullYear(yearOn.getUTCFullYear() + 1)
  if (to >= yearOn.getTime()) throw badRequest('The range is longer than a year.')
  const tz = params.get('tz') || 'UTC'
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
  } catch {
    throw badRequest('tz must be an IANA time zone.')
  }
  return { p_from: params.get('from')!, p_to: params.get('to')!, p_tz: tz }
}
