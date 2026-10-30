/**
 * Artifact components (#2006): a developer's own preview, published as a static bundle and
 * served from `<hash>.wildcraneusercontent.com`, where nothing of WildCrane's is reachable.
 * The review page frames it and talks to it over postMessage; the bundle host only serves files.
 */

import { APP_URL, COMPONENT_HOST } from '../config.ts'
import { call, mutate } from '../db.ts'
import type { Env } from '../env.ts'
import { Refusal, artifactsUnavailable, badRequest, payloadTooLarge } from '../errors.ts'
import { readCapped } from './http.ts'

const KB = 1024
const MB = 1024 * KB

export const COMPONENT_LIMITS = { bundle: 10 * MB, files: 1000, path: 200, schema: 64 * KB, types: 20, title: 200 }

/** The review page's own previews; no component takes one of their names. */
export const BUILTIN_TYPES = ['html', 'image', 'video', 'markdown', 'storyboard', 'compare']

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
const TYPE = /^@[a-z0-9][a-z0-9-]*\/[a-z0-9]+(-[a-z0-9]+)*$/
const HASH = /^[a-f0-9]{32}$/

type Fields = Record<string, unknown>

const isObject = (v: unknown): v is Fields => !!v && typeof v === 'object' && !Array.isArray(v)

export function componentName(value: unknown): string {
  if (typeof value !== 'string' || value.length > 64 || !NAME.test(value)) {
    throw badRequest('name must be lowercase words joined by hyphens, at most 64 characters.')
  }
  if (BUILTIN_TYPES.includes(value)) throw badRequest(`${value} is a built-in preview; pick another name.`)
  return value
}

export function componentVersion(value: unknown): string {
  if (typeof value !== 'string' || value.length > 64 || !SEMVER.test(value)) {
    throw badRequest('version must be a semantic version, such as 1.0.0.')
  }
  return value
}

/** `{ name, version, manifest }`, where the manifest is `wildcrane.component.json`. */
export function componentInput(body: Fields): { p_name: string; p_version: string; p_manifest: Fields } {
  const name = componentName(body.name)
  const version = componentVersion(body.version)
  const m = body.manifest
  if (!isObject(m)) throw badRequest('manifest must be an object.')
  if (m.name !== undefined && m.name !== name) throw badRequest('manifest.name does not match name.')
  if (m.version !== undefined && m.version !== version) throw badRequest('manifest.version does not match version.')
  const title = m.title
  if (!isObject(title)) throw badRequest('manifest.title must be { en, zh }.')
  for (const lang of ['en', 'zh']) {
    const t = title[lang]
    if (typeof t !== 'string' || !t.trim() || t.length > COMPONENT_LIMITS.title) {
      throw badRequest(`manifest.title.${lang} must be text of at most ${COMPONENT_LIMITS.title} characters.`)
    }
  }
  const types = m.types
  if (!Array.isArray(types) || types.length < 1 || types.length > COMPONENT_LIMITS.types) {
    throw badRequest(`manifest.types must list 1 to ${COMPONENT_LIMITS.types} artifact types.`)
  }
  for (const t of types) {
    if (typeof t !== 'string' || t.length > 128 || !TYPE.test(t)) {
      throw badRequest('Each of manifest.types must read @<account>/<name>, in lowercase.')
    }
  }
  if (m.schema !== undefined && !isObject(m.schema)) throw badRequest('manifest.schema must be a JSON Schema object.')
  if (m.schema !== undefined && new TextEncoder().encode(JSON.stringify(m.schema)).length > COMPONENT_LIMITS.schema) {
    throw payloadTooLarge(`manifest.schema is longer than ${COMPONENT_LIMITS.schema / KB} KB.`)
  }
  const manifest: Fields = {
    title: { en: (title.en as string).trim(), zh: (title.zh as string).trim() },
    types: [...new Set(types as string[])],
  }
  if (m.schema !== undefined) manifest.schema = m.schema
  return { p_name: name, p_version: version, p_manifest: manifest }
}

export const bundleUrl = (name: string, version: string) =>
  `/v1/components/${name}/versions/${version}/bundle`

const prefixOf = (hash: string) => `components/${hash}/`

// --- the bundle: a tar, gzipped or not ------------------------------------------------------

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'))
  try {
    return await readCapped(new Response(stream), COMPONENT_LIMITS.bundle, tooLarge)
  } catch (error) {
    if (error instanceof Refusal) throw error
    throw badRequest('The bundle is not a valid .tar.gz.')
  }
}

const tooLarge = () => payloadTooLarge(`A component bundle is at most ${COMPONENT_LIMITS.bundle / MB} MB, unpacked.`)

const ascii = (b: Uint8Array) => new TextDecoder().decode(b).replace(/\0.*$/s, '')

function pathOf(raw: string): string {
  const path = raw.replace(/^(\.\/)+/, '')
  const parts = path.split('/')
  if (!path || path.length > COMPONENT_LIMITS.path || path.startsWith('/') || path.includes('\\')
    || parts.some((p) => p === '' || p === '.' || p === '..')) {
    throw badRequest(`The bundle holds a path that cannot be served: ${raw.slice(0, 80)}`)
  }
  return path
}

/** The files a ustar archive holds; directories are skipped, and links refused. */
export function untar(bytes: Uint8Array): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>()
  let longName: string | null = null
  for (let at = 0; at + 512 <= bytes.length;) {
    const header = bytes.subarray(at, at + 512)
    if (header.every((b) => b === 0)) break
    const size = parseInt(ascii(header.subarray(124, 136)).trim() || '0', 8)
    if (!Number.isFinite(size) || size < 0 || at + 512 + size > bytes.length) throw badRequest('The bundle is not a valid tar.')
    const kind = String.fromCharCode(header[156]!)
    const body = bytes.subarray(at + 512, at + 512 + size)
    at += 512 + Math.ceil(size / 512) * 512
    if (kind === 'x') {
      longName = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(new TextDecoder().decode(body))?.[1] ?? null
      continue
    }
    if (kind === 'g' || kind === '5') continue
    if (kind !== '0' && kind !== '\0') throw badRequest('The bundle may hold only files and folders.')
    const prefix = ascii(header.subarray(345, 500))
    const name = longName ?? (prefix ? `${prefix}/${ascii(header.subarray(0, 100))}` : ascii(header.subarray(0, 100)))
    longName = null
    files.set(pathOf(name), body)
    if (files.size > COMPONENT_LIMITS.files) throw badRequest(`A bundle holds at most ${COMPONENT_LIMITS.files} files.`)
  }
  if (!files.has('index.html')) throw badRequest('The bundle has no index.html at its top.')
  return files
}

const TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json', map: 'application/json', txt: 'text/plain; charset=utf-8',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  wasm: 'application/wasm', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm',
}

const typeOf = (path: string) => TYPES[path.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream'

// --- the routes ----------------------------------------------------------------------------

export async function putBundle(env: Env, account: string, name: string, version: string, request: Request) {
  const bucket = env.ARTIFACTS
  if (!bucket) throw artifactsUnavailable()
  const { stored: hash } = await call<{ stored: string }>(env, 'v1_component_upload_target', {
    p_account: account, p_name: name, p_version: version,
  })
  if (Number(request.headers.get('content-length') ?? 0) > COMPONENT_LIMITS.bundle) throw tooLarge()
  let bytes = await readCapped(request, COMPONENT_LIMITS.bundle, tooLarge)
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await gunzip(bytes)
  const files = untar(bytes)
  const size = [...files.values()].reduce((n, f) => n + f.length, 0)
  const keys = [...files.keys()].map((path) => prefixOf(hash) + path)
  await Promise.all([...files].map(([path, body]) =>
    bucket.put(prefixOf(hash) + path, body, { httpMetadata: { contentType: typeOf(path) } })))
  try {
    return await mutate(env, 'v1_finish_component', { p_account: account, p_name: name, p_version: version, p_size: size })
  } catch (error) {
    await bucket.delete(keys)
    throw error
  }
}

/** Removed: the row stays, so the number is never reused; its files leave R2. */
export async function deleteVersion(env: Env, account: string, name: string, version: string) {
  const { stored: hash, ...removed } = await mutate<{ stored: string } & Fields>(env, 'v1_delete_component_version', {
    p_account: account, p_name: name, p_version: version,
  })
  const bucket = env.ARTIFACTS
  if (bucket) {
    for (let cursor: string | undefined, more = true; more;) {
      const listed = await bucket.list({ prefix: prefixOf(hash), cursor })
      if (listed.objects.length > 0) await bucket.delete(listed.objects.map((o) => o.key))
      more = listed.truncated
      cursor = listed.truncated ? listed.cursor : undefined
    }
  }
  return removed
}

/** What a page frames: the version's address, and what its manifest says. */
async function framed(env: Env, fn: string, args: Record<string, unknown>) {
  const { stored: hash, ...held } = await call<{ stored: string } & Fields>(env, fn, args)
  return { ...held, url: `https://${hash}.${COMPONENT_HOST}/` }
}

export const sharedComponent = (env: Env, args: Record<string, unknown>, name: string, version: string) =>
  framed(env, 'v1_shared_component', { ...args, p_name: componentName(name), p_version: componentVersion(version) })

/** The component a member's artifact version pinned, for the WildCrane Web card page. */
export const artifactComponent = (env: Env, account: string, artifact: string, version: number) =>
  framed(env, 'v1_artifact_component', { p_account: account, p_artifact: artifact, p_version: version })

// --- the bundle host -----------------------------------------------------------------------

export const isComponentHost = (hostname: string) => hostname.endsWith(`.${COMPONENT_HOST}`)

/** No network and no embedding but the review page's and the Web card page's. Blobs and data URLs are local. */
export const componentCsp = (env: Env) =>
  [
    "default-src 'self'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${new URL(env.APP_URL || APP_URL).origin}`,
  ].join('; ')

const missing = () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })

export async function serveComponent(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } })
  const url = new URL(request.url)
  const hash = url.hostname.slice(0, -COMPONENT_HOST.length - 1)
  if (!HASH.test(hash) || !env.ARTIFACTS) return missing()
  let path: string
  try {
    path = decodeURIComponent(url.pathname).slice(1)
    if (path === '' || path.endsWith('/')) path += 'index.html'
    path = pathOf(path)
  } catch {
    return missing()
  }
  const object = await env.ARTIFACTS.get(prefixOf(hash) + path)
  if (!object) return missing()
  return new Response(request.method === 'HEAD' ? null : object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? typeOf(path),
      'content-length': String(object.size),
      'content-security-policy': componentCsp(env),
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'cache-control': 'public, max-age=300',
    },
  })
}
