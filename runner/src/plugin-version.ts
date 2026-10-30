// The plugin's version, and a newer one when released (#119). Nothing here throws:
// offline, a blocked GitHub or a manifest it cannot read all answer null.

import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import type { Socket } from 'node:net'
import path from 'node:path'
import tls from 'node:tls'

import type { Host } from './plugin'
import { compare } from './update'

/** The manifest `claude plugin update` reads. */
export const MARKETPLACE = 'https://raw.githubusercontent.com/ai4kanban/ai4kanban/main/.claude-plugin/marketplace.json'
const TIMEOUT_MS = 5_000
const KEEP_MS = 6 * 60 * 60_000
const RETRY_MS = 5 * 60_000

/** The server runs from `<root>/server/dist/index.mjs`. A Codex opened from Claude Code inherits `CLAUDE_PLUGIN_ROOT`. */
const pluginRoot = (host: Host) => (host === 'claude-code' && process.env.CLAUDE_PLUGIN_ROOT) || path.resolve(path.dirname(process.argv[1] ?? ''), '..', '..')

/** Codex's `plugin.json` sits at the plugin root. */
export function pluginVersion(host: Host = 'claude-code', root = pluginRoot(host)): string | null {
  const file = host === 'codex' ? 'plugin.json' : path.join('.claude-plugin', 'plugin.json')
  try {
    const version = (JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as { version?: unknown }).version
    return typeof version === 'string' ? version : null
  } catch {
    return null
  }
}

/** The released version: the `plugin-v<version>` in wildcrane's archive URL. */
export function releasedOf(manifest: string): string | null {
  try {
    const { plugins } = JSON.parse(manifest) as { plugins?: { name?: string; source?: { url?: string } }[] }
    return /\/plugin-v(\d+\.\d+\.\d+)\//.exec(plugins?.find((p) => p.name === 'wildcrane')?.source?.url ?? '')?.[1] ?? null
  } catch {
    return null
  }
}

/** `latest` only when it is newer than `version`. */
export const newerOf = (version: string | null, latest: string | null) => (version && latest && compare(latest, version) > 0 ? latest : null)

let released: { at: number; value: string | null } | null = null
let fetching: Promise<void> | null = null

/** Fetches in the background; a success is kept 6 hours, a failure retried after 5 minutes. */
export function checkReleased(url = MARKETPLACE, now = Date.now()): Promise<void> {
  const stale = !released || now - released.at > (released.value ? KEEP_MS : RETRY_MS)
  if (!stale || fetching) return fetching ?? Promise.resolve()
  fetching = get(url)
    .then(releasedOf, () => null)
    .then((value) => void (released = { at: Date.now(), value }))
    .finally(() => (fetching = null))
  return fetching
}

export function pluginInfo(host: Host = 'claude-code'): { version: string | null; latest: string | null } {
  void checkReleased()
  const version = pluginVersion(host)
  return { version, latest: newerOf(version, released?.value ?? null) }
}

export function forgetReleased(): void {
  released = null
}

/** Through `HTTPS_PROXY` when set: Node's fetch ignores it. */
async function get(url: string): Promise<string> {
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  const target = new URL(url)
  const proxy = proxyFor(target)
  const socket = proxy ? await tunnel(proxy, target, signal) : null
  return new Promise((resolve, reject) => {
    const via = socket ? { createConnection: () => tls.connect({ socket, servername: target.hostname }) } : {}
    const req = (target.protocol === 'http:' ? http : https).get(target, { signal, ...via }, (res) => {
      if (res.statusCode !== 200) return void (res.resume(), reject(new Error(`answered ${res.statusCode}`)))
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (d: string) => (body += d))
      res.on('end', () => resolve(body))
      res.on('error', reject)
    })
    req.on('error', reject)
  })
}

function proxyFor(target: URL): URL | null {
  if (target.protocol !== 'https:') return null
  const env = process.env
  const skip = (env.NO_PROXY ?? env.no_proxy ?? '').split(',').map((s) => s.trim().replace(/^\*?\./, '')).filter(Boolean)
  if (skip.some((s) => s === '*' || target.hostname === s || target.hostname.endsWith(`.${s}`))) return null
  const raw = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || env.ALL_PROXY || env.all_proxy
  try {
    return raw ? new URL(/^\w+:\/\//.test(raw) ? raw : `http://${raw}`) : null
  } catch {
    return null
  }
}

function tunnel(proxy: URL, target: URL, signal: AbortSignal): Promise<Socket> {
  const to = `${target.hostname}:${target.port || 443}`
  const auth = proxy.username
    ? { 'Proxy-Authorization': `Basic ${Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString('base64')}` }
    : {}
  const secure = proxy.protocol === 'https:'
  return new Promise((resolve, reject) => {
    const req = (secure ? https : http).request({ host: proxy.hostname, port: proxy.port || (secure ? 443 : 80), method: 'CONNECT', path: to, headers: { host: to, ...auth }, signal })
    req.on('connect', (res, socket) => (res.statusCode === 200 ? resolve(socket) : (socket.destroy(), reject(new Error(`proxy answered ${res.statusCode}`)))))
    req.on('error', reject)
    req.end()
  })
}
