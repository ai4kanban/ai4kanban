// The plugin's version, and a newer one when released (#119). Nothing here throws:
// offline, a blocked GitHub or a manifest it cannot read all answer null.

import fs from 'node:fs'
import path from 'node:path'

import type { Host } from './plugin'
import { compare } from './update'

/** The manifest `claude plugin update` reads. */
export const MARKETPLACE = 'https://raw.githubusercontent.com/wildcrane-ai/wildcrane/main/.claude-plugin/marketplace.json'
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

async function get(url: string): Promise<string> {
  const answer = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (answer.status !== 200) throw new Error(`answered ${answer.status}`)
  return answer.text()
}
