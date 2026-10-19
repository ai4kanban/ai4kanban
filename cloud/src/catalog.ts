/**
 * The public template catalog behind ai4kanban.dev/templates (#1711). No sign-in: it answers
 * published metadata, where a template came from, and the media a maintainer registered
 * for the site — never a template's files, its evidence, the source note or who published it.
 *
 * A showcase is registered apart from the template (`PUT /v1/templates/<name>/showcase`):
 * a cover, and the original and recreation shown side by side, each an image with an
 * optional video or YouTube link. Its files sit under `showcase/<name>/<id>/<path>`.
 */

import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, methodNotAllowed, notFound, templatesUnavailable } from './errors.ts'
import { json } from './http.ts'

const PATH = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/
const IMAGES = ['.png', '.jpg', '.jpeg', '.webp', '.gif']
const VIDEOS = ['.mp4', '.webm']
const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}
const MB = 1024 * 1024
export const SHOWCASE_LIMITS = { count: 12, bytes: 80 * MB }

/** A browser page on any origin reads the catalog; it carries no credentials. */
export const CATALOG_CORS = { 'access-control-allow-origin': '*' }
export const isCatalogPath = (pathname: string) => pathname.startsWith('/v1/catalog')

interface Entry {
  path: string
  size: number
}

interface Side {
  image?: string
  video?: string
  youtube?: string
  keyframe?: boolean
  duration?: number
}

interface Showcase {
  id?: string
  files?: Entry[]
  cover?: string
  original?: Side
  recreation?: Side
}

interface Row {
  name: string
  category: string
  tags: string[]
  title: string
  summary: string
  description?: string
  source?: Record<string, unknown>
  access: 'free' | 'pro'
  previews: Entry[]
  revision: string
  showcase: Showcase | null
  published_at: string
}

export async function routeCatalog(request: Request, env: Env, rest: string): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') throw methodNotAllowed()
  const bucket = env.TEMPLATES
  if (!bucket) throw templatesUnavailable()
  const base = `${new URL(request.url).origin}/v1/catalog`
  const [name = '', kind = '', version = '', ...tail] = rest.split('/').map(decodeURIComponent)

  if (!name) {
    const rows = await call<Row[]>(env, 'template_catalog')
    const categories: { category: string; templates: unknown[] }[] = []
    for (const row of rows) {
      let group = categories.find((c) => c.category === row.category)
      if (!group) categories.push((group = { category: row.category, templates: [] }))
      group.templates.push(card(base, row))
    }
    return json({ categories }, 200, fresh)
  }

  const row = await call<Row | null>(env, 'template', { p_name: name })
  if (!row) throw notFound('No template has this name.')
  if (!kind) return json({ template: detail(base, row) }, 200, fresh)
  if (kind !== 'media' || tail.length !== 1) throw notFound()
  const path = tail[0]!
  const show = row.showcase ?? {}
  const key =
    version === show.id && show.files?.some((f) => f.path === path)
      ? `showcase/${row.name}/${version}/${path}`
      : version === row.revision && row.previews.some((p) => p.path === path)
        ? `previews/${row.name}/${version}/${path}`
        : null
  if (!key) throw notFound('This template has no such file.')
  return media(bucket, key, path, request)
}

const fresh = { 'cache-control': 'public, max-age=60' }

/** What a catalog tile needs. A motion's tile plays its clip in place. */
function card(base: string, row: Row) {
  const show = row.showcase ?? {}
  const clip = row.category === 'motion' ? show.recreation?.video : undefined
  return {
    name: row.name,
    category: row.category,
    title: row.title,
    summary: row.summary,
    tags: row.tags,
    access: row.access,
    cover: coverOf(base, row),
    duration: show.recreation?.duration ?? null,
    clip: clip ? mediaUrl(base, row, clip) : null,
  }
}

function detail(base: string, row: Row) {
  const show = row.showcase ?? {}
  const s = row.source ?? {}
  const url = (path?: string) => (path ? mediaUrl(base, row, path) : null)
  const side = (v?: Side) =>
    v && {
      image: url(v.image),
      video: url(v.video),
      youtube: v.youtube ?? null,
      keyframe: v.keyframe === true,
      duration: v.duration ?? null,
    }
  return {
    ...card(base, row),
    description: row.description ?? '',
    publishedAt: row.published_at,
    source: s.original === true ? { original: true } : { site: s.site, references: s.references, captured: s.captured },
    original: side(show.original) ?? null,
    recreation: side(show.recreation) ?? null,
  }
}

/** The registered cover, else the first catalog preview; null draws a placeholder. */
function coverOf(base: string, row: Row): string | null {
  const show = row.showcase ?? {}
  if (show.cover && show.id) return mediaUrl(base, row, show.cover)
  const first = row.previews[0]
  return first ? `${base}/${row.name}/media/${row.revision}/${encodeURIComponent(first.path)}` : null
}

const mediaUrl = (base: string, row: Row, path: string) =>
  row.showcase?.id ? `${base}/${row.name}/media/${row.showcase.id}/${encodeURIComponent(path)}` : null

/** One file, by range when asked: a video only seeks with partial answers. Its URL names the
 *  revision it belongs to, so it never changes. */
async function media(bucket: R2Bucket, key: string, path: string, request: Request): Promise<Response> {
  const ranged = request.headers.has('range')
  const object = await bucket.get(key, ranged ? { range: request.headers } : undefined)
  if (!object) throw notFound('This template has no such file.')
  const headers: Record<string, string> = {
    'content-type': TYPES[extOf(path)] ?? 'application/octet-stream',
    'cache-control': 'public, max-age=31536000, immutable',
    'accept-ranges': 'bytes',
  }
  const range = object.range
  if (ranged && range && range.offset !== undefined) {
    const length = range.length ?? object.size - range.offset
    headers['content-range'] = `bytes ${range.offset}-${range.offset + length - 1}/${object.size}`
    headers['content-length'] = String(length)
    return new Response(request.method === 'HEAD' ? null : object.body, { status: 206, headers })
  }
  headers['content-length'] = String(object.size)
  return new Response(request.method === 'HEAD' ? null : object.body, { headers })
}

// ---- registering a showcase (publishers only; `templates.ts` checks) -------------------

export async function registerShowcase(env: Env, bucket: R2Bucket, name: string, request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null)
  if (!form) throw badRequest('Send the showcase as multipart form data.')
  const show = readShowcase(form.get('meta'))
  const row = await call<Row | null>(env, 'template', { p_name: name })
  if (!row) throw notFound('No template has this name.')
  if (row.category === 'motion' && !show.recreation?.video) {
    throw badRequest('A motion plays its clip: send recreation.video.')
  }
  const uploads: { path: string; bytes: ArrayBuffer }[] = []
  const parts: [string, FormDataEntryValue][] = []
  form.forEach((value, field) => void parts.push([field, value]))
  for (const [field, value] of parts) {
    if (field === 'meta') continue
    if (!field.startsWith('media:') || typeof value === 'string') throw badRequest(`Unexpected field "${field}".`)
    uploads.push({ path: field.slice('media:'.length), bytes: await value.arrayBuffer() })
  }
  const named = referenced(show)
  const sent = new Set(uploads.map((u) => u.path))
  if (sent.size !== uploads.length) throw badRequest('A file is sent twice.')
  for (const path of named) if (!sent.has(path)) throw badRequest(`"${path}" is named but not sent.`)
  for (const path of sent) if (!named.includes(path)) throw badRequest(`"${path}" is sent but never named.`)
  const total = uploads.reduce((sum, u) => sum + u.bytes.byteLength, 0)
  if (uploads.length > SHOWCASE_LIMITS.count || total > SHOWCASE_LIMITS.bytes) {
    throw badRequest(`Too many showcase files: at most ${SHOWCASE_LIMITS.count} files and ${SHOWCASE_LIMITS.bytes / MB} MB.`)
  }

  const id = crypto.randomUUID()
  const written: string[] = []
  try {
    for (const u of uploads) {
      const at = `showcase/${name}/${id}/${u.path}`
      await bucket.put(at, u.bytes, { httpMetadata: { contentType: TYPES[extOf(u.path)] ?? 'application/octet-stream' } })
      written.push(at)
    }
    const files = uploads.map((u) => ({ path: u.path, size: u.bytes.byteLength })).sort((a, b) => a.path.localeCompare(b.path))
    const done = await mutate<{ replaced: Showcase } | null>(env, 'set_template_showcase', {
      p_name: name,
      p_showcase: { id, files, ...show },
    })
    if (!done) throw notFound('No template has this name.')
    if (done.replaced.id) await dropShowcase(bucket, name, done.replaced.id)
    return json({ name, files: files.length })
  } catch (error) {
    if (written.length > 0) await bucket.delete(written).catch(() => undefined)
    throw error
  }
}

/** Every showcase file a template ever had, or one registration of them. */
export async function dropShowcase(bucket: R2Bucket, name: string, id = ''): Promise<void> {
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix: `showcase/${name}/${id ? `${id}/` : ''}`, cursor })
    if (page.objects.length > 0) await bucket.delete(page.objects.map((o) => o.key))
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
}

/** The showcase's own rules. Exported for the tests. */
export function readShowcase(raw: unknown): Omit<Showcase, 'id' | 'files'> {
  let m: Record<string, unknown>
  try {
    m = JSON.parse(typeof raw === 'string' ? raw : '') as Record<string, unknown>
  } catch {
    throw badRequest('Send the showcase as JSON in "meta".')
  }
  const file = (field: string, value: unknown, types: string[]): string | undefined => {
    if (value === undefined) return undefined
    if (typeof value !== 'string' || !PATH.test(value) || !types.includes(extOf(value))) {
      throw badRequest(`${field} is a file name ending in ${types.join(', ')}.`)
    }
    return value
  }
  const side = (field: string, raw: unknown): Side | undefined => {
    if (raw === undefined) return undefined
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw badRequest(`${field} is an object.`)
    const s = raw as Record<string, unknown>
    const image = file(`${field}.image`, s.image, IMAGES)
    if (!image) throw badRequest(`${field}.image is the still shown before anything plays.`)
    const video = file(`${field}.video`, s.video, VIDEOS)
    if (s.youtube !== undefined && (typeof s.youtube !== 'string' || !youtubeId(s.youtube))) {
      throw badRequest(`${field}.youtube is a YouTube video's URL.`)
    }
    if (video && s.youtube) throw badRequest(`${field} plays a video file or a YouTube video, not both.`)
    if (s.keyframe === true && (video || s.youtube)) throw badRequest(`${field}.keyframe is for a still with no video.`)
    if (s.duration !== undefined && (typeof s.duration !== 'number' || !(s.duration > 0))) {
      throw badRequest(`${field}.duration is in seconds.`)
    }
    return {
      image,
      ...(video ? { video } : {}),
      ...(s.youtube ? { youtube: youtubeId(s.youtube as string)! } : {}),
      ...(s.keyframe === true ? { keyframe: true } : {}),
      ...(typeof s.duration === 'number' ? { duration: Math.round(s.duration) } : {}),
    }
  }
  const out = {
    cover: file('cover', m.cover, IMAGES),
    original: side('original', m.original),
    recreation: side('recreation', m.recreation),
  }
  if (!out.cover && !out.original && !out.recreation) throw badRequest('Name a cover, an original or a recreation.')
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined))
}

function referenced(show: Omit<Showcase, 'id' | 'files'>): string[] {
  const paths = [show.cover, show.original?.image, show.original?.video, show.recreation?.image, show.recreation?.video]
  return [...new Set(paths.filter((p): p is string => !!p))]
}

/** The 11-character id in a youtube.com/watch, youtu.be or embed link. */
function youtubeId(url: string): string | null {
  const m = /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#].*)?$/.exec(url)
  return m?.[1] ?? null
}

const extOf = (path: string) => {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot).toLowerCase()
}
