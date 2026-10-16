/**
 * The shared template catalog (#1708). Any sign-in, admitted or not, lists tags, searches
 * bounded metadata, and reads a template's previews and source evidence; a template's own
 * files need Pro when it is `access: pro`. Only `TEMPLATE_PUBLISHERS` publish and delete.
 *
 * Postgres holds the metadata; the files sit in the private `TEMPLATES` bucket under
 * `<kind>/<name>/<revision>/<path>`, so a replacement swaps the whole revision at once.
 */

import { readBilling } from './billing.ts'
import { TEMPLATE_PUBLISHERS } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, methodNotAllowed, notFound, ownerOnly, proRequired, templatesUnavailable } from './errors.ts'
import { json } from './http.ts'
import { readSession } from './owner.ts'
import type { Session } from './owner.ts'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const PATH = /^[A-Za-z0-9_][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/
const CAPTURED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/
const MB = 1024 * 1024

export const LIMITS = {
  files: { count: 500, bytes: 50 * MB },
  previews: { count: 3, bytes: 6 * MB },
  evidence: { count: 10, bytes: 20 * MB },
  search: { default: 5, max: 10 },
}

const PREVIEW_TYPES = ['.png', '.jpg', '.jpeg', '.webp', '.gif']

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.tsx': 'text/plain; charset=utf-8',
}

type Kind = 'files' | 'previews' | 'evidence'

interface Entry {
  path: string
  size: number
  sha256: string
}

interface TemplateRow {
  name: string
  category: string
  tags: string[]
  title: string
  summary: string
  description: string
  source: Record<string, unknown>
  access: 'free' | 'pro'
  files: Entry[]
  previews: Entry[]
  evidence: Entry[]
  revision: string
  published_at: string
}

export async function routeTemplates(request: Request, env: Env, rest: string): Promise<Response> {
  const session = await readSession(request, env)
  const bucket = env.TEMPLATES
  if (!bucket) throw templatesUnavailable()
  const url = new URL(request.url)
  const [name = '', kind = '', ...tail] = rest.split('/').map(decodeURIComponent)
  const path = tail.join('/')

  if (!name) {
    if (request.method === 'POST') return publish(env, bucket, session, request)
    only(request, 'GET')
    return json({ templates: await search(env, url.searchParams) })
  }
  if (name === 'tags' && !kind) {
    only(request, 'GET')
    return json({ tags: await call(env, 'template_tags', { p_category: category(url.searchParams.get('category')) }) })
  }
  if (!kind && request.method === 'DELETE') return remove(env, bucket, session, name)
  only(request, 'GET')
  const row = await call<TemplateRow | null>(env, 'template', { p_name: name })
  if (!row) throw notFound('No template has this name.')
  if (!kind) {
    await requireAccess(env, session, row)
    return json({ template: { ...meta(row), source: row.source, files: row.files, evidence: row.evidence } })
  }
  if (kind === 'source' && !path) return json({ name: row.name, source: row.source, evidence: row.evidence })
  if (kind === 'previews' && !path) return json({ name: row.name, previews: row.previews })
  if (kind === 'files') await requireAccess(env, session, row)
  if (kind !== 'files' && kind !== 'previews' && kind !== 'evidence') throw notFound()
  if (!row[kind].some((e) => e.path === path)) throw notFound('This template has no such file.')
  const object = await bucket.get(key(kind, row.name, row.revision, path))
  if (!object) throw notFound('This template has no such file.')
  return new Response(object.body, { headers: { 'content-type': typeOf(path), 'content-length': String(object.size) } })
}

/** What a search answers per template: enough to choose, nothing to download. */
function meta(row: TemplateRow) {
  return {
    name: row.name,
    category: row.category,
    title: row.title,
    summary: row.summary,
    description: row.description,
    tags: row.tags,
    access: row.access,
    previews: row.previews.map(({ path, size }) => ({ path, size })),
    publishedAt: row.published_at,
  }
}

async function search(env: Env, params: URLSearchParams) {
  const tags = list(params.get('tags'))
  if (tags.length === 0) throw badRequest('Name at least one tag to search within.')
  const asked = Number(params.get('limit') ?? LIMITS.search.default)
  const limit = Number.isInteger(asked) ? Math.min(Math.max(asked, 1), LIMITS.search.max) : LIMITS.search.default
  const rows = await call<TemplateRow[]>(env, 'search_templates', {
    p_category: category(params.get('category')),
    p_tags: tags,
    p_words: (params.get('q') ?? '').split(/\s+/).filter(Boolean).slice(0, 10),
    p_limit: limit,
  })
  return rows.map(meta)
}

async function requireAccess(env: Env, session: Session, row: TemplateRow): Promise<void> {
  if (row.access !== 'pro') return
  if ((await readBilling(env, session.subject)).plan !== 'pro') throw proRequired()
}

function requirePublisher(session: Session): void {
  if (!session.handle || !TEMPLATE_PUBLISHERS.includes(session.handle.toLowerCase())) {
    throw ownerOnly('Only the catalog’s maintainers publish templates.')
  }
}

// ---- publishing -------------------------------------------------------------------

interface Upload {
  kind: Kind
  path: string
  bytes: ArrayBuffer
}

async function publish(env: Env, bucket: R2Bucket, session: Session, request: Request): Promise<Response> {
  requirePublisher(session)
  const form = await request.formData().catch(() => null)
  if (!form) throw badRequest('Send the template as multipart form data.')
  const fields = readMeta(form.get('meta'))
  const parts: [string, FormDataEntryValue][] = []
  form.forEach((value, field) => void parts.push([field, value]))
  const uploads: Upload[] = []
  for (const [field, value] of parts) {
    if (field === 'meta') continue
    const [kind, ...rest] = field.split(':')
    if ((kind !== 'files' && kind !== 'previews' && kind !== 'evidence') || typeof value === 'string') {
      throw badRequest(`Unexpected field "${field}".`)
    }
    uploads.push({ kind, path: rest.join(':'), bytes: await value.arrayBuffer() })
  }
  const lists = checkUploads(uploads, fields.source)

  const revision = crypto.randomUUID()
  const entries: Record<Kind, Entry[]> = { files: [], previews: [], evidence: [] }
  const written: string[] = []
  try {
    for (const upload of uploads) {
      const at = key(upload.kind, fields.name, revision, upload.path)
      await bucket.put(at, upload.bytes, { httpMetadata: { contentType: typeOf(upload.path) } })
      written.push(at)
      entries[upload.kind].push({ path: upload.path, size: upload.bytes.byteLength, sha256: await sha256(upload.bytes) })
    }
    for (const kind of Object.keys(entries) as Kind[]) entries[kind].sort((a, b) => a.path.localeCompare(b.path))
    const done = await mutate<{ revision: string; replaced: string | null }>(env, 'publish_template', {
      p_handle: session.handle,
      p_name: fields.name,
      p_category: fields.category,
      p_tags: fields.tags,
      p_title: fields.title,
      p_summary: fields.summary,
      p_description: fields.description,
      p_source: fields.source,
      p_access: fields.access,
      p_files: entries.files,
      p_previews: entries.previews,
      p_evidence: entries.evidence,
      p_revision: revision,
      p_replace: fields.replace,
    })
    if (done.replaced) await dropRevision(bucket, fields.name, done.replaced)
    return json({ name: fields.name, replaced: !!done.replaced, files: lists.files, previews: lists.previews, evidence: lists.evidence })
  } catch (error) {
    if (written.length > 0) await bucket.delete(written).catch(() => undefined)
    throw error
  }
}

async function remove(env: Env, bucket: R2Bucket, session: Session, name: string): Promise<Response> {
  requirePublisher(session)
  const done = await mutate<{ revision: string } | null>(env, 'delete_template', { p_name: name })
  if (!done) throw notFound('No template has this name.')
  await dropRevision(bucket, name, done.revision)
  return json({ name, deleted: true })
}

interface Fields {
  name: string
  category: string
  tags: string[]
  title: string
  summary: string
  description: string
  source: Record<string, unknown>
  access: 'free' | 'pro'
  replace: boolean
}

/** Every rule a published template's metadata keeps. Exported for the tests. */
export function readMeta(raw: unknown): Fields {
  let m: Record<string, unknown>
  try {
    m = JSON.parse(typeof raw === 'string' ? raw : '') as Record<string, unknown>
  } catch {
    throw badRequest('Send the template’s metadata as JSON in "meta".')
  }
  const text = (field: string, max: number, oneLine = false): string => {
    const value = typeof m[field] === 'string' ? (m[field] as string).trim() : ''
    if (!value) throw badRequest(`Give the template a ${field}.`)
    if (value.length > max) throw badRequest(`${field} is at most ${max} characters.`)
    if (oneLine && /\n/.test(value)) throw badRequest(`${field} is one line.`)
    return value
  }
  const name = text('name', 80)
  if (!SLUG.test(name) || name === 'tags') throw badRequest('name is lowercase words joined by hyphens, like hero-tilted-screen.')
  const cat = category(typeof m.category === 'string' ? m.category : null)
  if (m.tags !== undefined && !Array.isArray(m.tags)) throw badRequest('tags is a list.')
  const tags = [...new Set(((m.tags as unknown[]) ?? []).map((t) => (typeof t === 'string' ? t.trim() : '')))]
  if (tags.length > 20 || tags.some((t) => !SLUG.test(t))) {
    throw badRequest('Each tag is lowercase words joined by hyphens, at most 20 of them.')
  }
  if (m.access !== 'free' && m.access !== 'pro') throw badRequest('access is free or pro.')
  return {
    name,
    category: cat,
    tags,
    title: text('title', 200, true),
    summary: text('summary', 300, true),
    description: text('description', 4000),
    source: readSource(m.source),
    access: m.access,
    replace: m.replace === true,
  }
}

/** An original says so; an outside reference names where it came from and when it was taken. */
function readSource(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw badRequest('Give the template a source.')
  const s = raw as Record<string, unknown>
  if (s.original === true) return { original: true }
  const isUrl = (v: unknown) => typeof v === 'string' && /^https?:\/\/\S+$/.test(v)
  const urls = (v: unknown) => (Array.isArray(v) ? v : [])
  if (!isUrl(s.site)) throw badRequest('source.site is the referenced site’s URL, or set source.original: true.')
  if (urls(s.references).length === 0 || !urls(s.references).every(isUrl)) {
    throw badRequest('source.references lists the URLs actually referenced.')
  }
  if (typeof s.captured !== 'string' || !CAPTURED.test(s.captured)) {
    throw badRequest('source.captured is when the reference was captured, with its time zone, like 2026-10-16T09:00:00+08:00.')
  }
  if (!urls(s.archives).every(isUrl)) throw badRequest('source.archives lists URLs.')
  if (typeof s.note !== 'string' || !s.note.trim()) {
    throw badRequest('source.note says what the evidence is and who captured it.')
  }
  return {
    site: s.site,
    references: s.references,
    captured: s.captured,
    ...(urls(s.archives).length > 0 ? { archives: s.archives } : {}),
    note: s.note.trim(),
  }
}

function checkUploads(uploads: Upload[], source: Record<string, unknown>): Record<Kind, number> {
  const counts: Record<Kind, number> = { files: 0, previews: 0, evidence: 0 }
  const bytes: Record<Kind, number> = { files: 0, previews: 0, evidence: 0 }
  const seen = new Set<string>()
  for (const { kind, path, bytes: b } of uploads) {
    if (!PATH.test(path) || path.split('/').some((p) => p === '..' || p === '.')) {
      throw badRequest(`"${path}" is not a relative file path.`)
    }
    if (seen.has(`${kind}:${path}`)) throw badRequest(`"${path}" is sent twice.`)
    seen.add(`${kind}:${path}`)
    if (kind === 'previews' && !PREVIEW_TYPES.includes(extOf(path))) {
      throw badRequest(`Preview "${path}" must be a PNG, JPEG, WebP or GIF image.`)
    }
    counts[kind]++
    bytes[kind] += b.byteLength
  }
  if (!uploads.some((u) => u.kind === 'files' && u.path === 'template.md')) {
    throw badRequest('A template needs template.md at its top level.')
  }
  for (const kind of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
    if (kind === 'search') continue
    if (counts[kind] > LIMITS[kind].count || bytes[kind] > LIMITS[kind].bytes) {
      throw badRequest(`Too many ${kind}: at most ${LIMITS[kind].count} files and ${LIMITS[kind].bytes / MB} MB.`)
    }
  }
  if (source.original !== true && counts.evidence === 0) {
    throw badRequest('A template cloned from a reference needs the captured evidence of it.')
  }
  return counts
}

// ---- storage ------------------------------------------------------------------------

const key = (kind: Kind, name: string, revision: string, path: string) => `${kind}/${name}/${revision}/${path}`

async function dropRevision(bucket: R2Bucket, name: string, revision: string): Promise<void> {
  for (const kind of ['files', 'previews', 'evidence'] as const) {
    let cursor: string | undefined
    do {
      const page = await bucket.list({ prefix: `${kind}/${name}/${revision}/`, cursor })
      if (page.objects.length > 0) await bucket.delete(page.objects.map((o) => o.key))
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)
  }
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---- small readers ---------------------------------------------------------------

function category(raw: string | null): string {
  const value = (raw ?? '').trim()
  if (!SLUG.test(value)) throw badRequest('Name the category, like ui or video.')
  return value
}

function list(raw: string | null): string[] {
  return [...new Set((raw ?? '').split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 20)
}

function only(request: Request, method: string): void {
  if (request.method !== method) throw methodNotAllowed()
}

const extOf = (path: string) => {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot).toLowerCase()
}

const typeOf = (path: string) => TYPES[extOf(path)] ?? 'application/octet-stream'
