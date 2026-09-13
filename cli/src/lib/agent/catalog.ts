// How big each model's context window is, from models.dev (#675).
//
// The context ring needs a denominator, and only Codex and ZCode report one: every other
// connector that counts the prompt at all says nothing about the window it went into. A list written
// into this build would be wrong the week a provider ships a model — the same reason
// harnesses/models.ts reads each CLI's own cache rather than keeping one — so the numbers
// come from models.dev, the community catalogue OpenCode already ships against, and are
// kept on disk.
//
// What is cached is NOT the catalogue: the download is megabytes of prices, modalities and
// release dates, and one number per model is wanted. It is boiled down to
// `provider/model → context` as it lands, which is a file small enough to read on any
// lookup.
//
// Every failure here means "the window is unknown", and a run says so by drawing no ring.
// Offline, behind a proxy, first ever run — all of them keep whatever was last written and
// none of them is worth a line in a log.

import fs from 'node:fs'
import path from 'node:path'

import { machineHome } from '../machine/home'

const CATALOGUE = 'https://models.dev/api.json'

/** How long the numbers on disk are used before a refresh is started behind them. A model's
 *  window changes when a provider ships one, so a day is plenty and nothing waits on it. */
const FRESH_FOR_MS = 24 * 60 * 60_000

/** How long the download has. Past this it is an outage, and the cache already answers. */
const ANSWER_BY_MS = 20_000

interface Cached {
  fetchedAt: number
  /** `provider/model` → the model's context window in tokens. */
  limits: Record<string, number>
}

function cacheFile(): string {
  return path.join(machineHome(), 'models-dev.json')
}

// Read once per process, against the file's own stamp: a lookup happens on every chunk of a
// run's output, and this file has thousands of entries.
let held: { stamp: string; cached: Cached } | undefined

function readCache(): Cached | undefined {
  const file = cacheFile()
  let stamp: string
  try {
    const stat = fs.statSync(file)
    stamp = `${stat.mtimeMs}:${stat.size}`
  } catch {
    return undefined
  }
  if (held?.stamp === stamp) return held.cached
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Cached>
    if (!data || typeof data.limits !== 'object' || !data.limits) return undefined
    const cached: Cached = {
      fetchedAt: typeof data.fetchedAt === 'number' ? data.fetchedAt : 0,
      limits: data.limits,
    }
    held = { stamp, cached }
    return cached
  } catch {
    return undefined
  }
}

/** The catalogue boiled down to one number per model. A provider or a model whose entry
 *  carries no usable `limit.context` is left out — it has nothing to say here. */
function limitsIn(data: unknown): Record<string, number> {
  const limits: Record<string, number> = {}
  if (!data || typeof data !== 'object') return limits
  for (const [provider, raw] of Object.entries(data as Record<string, unknown>)) {
    const models = (raw as { models?: unknown })?.models
    if (!models || typeof models !== 'object') continue
    for (const [model, entry] of Object.entries(models as Record<string, unknown>)) {
      const context = (entry as { limit?: { context?: unknown } })?.limit?.context
      if (typeof context === 'number' && Number.isFinite(context) && context > 0) {
        limits[`${provider}/${model}`] = context
      }
    }
  }
  return limits
}

// One download per process at most, and never a second while the first is in flight.
let fetching: Promise<void> | undefined

/** Pull the catalogue if what is on disk is old, and write the boiled-down numbers over it.
 *  Never throws and never rejects: a refresh that fails leaves the old numbers in place,
 *  which is the whole point of keeping them.
 *
 *  Started rather than awaited by its callers — a run and a chat turn both outlive it, and
 *  neither has anything to show for a window it doesn't know yet. */
export function refreshCatalog(): Promise<void> {
  if (fetching) return fetching
  const cached = readCache()
  if (cached && Date.now() - cached.fetchedAt < FRESH_FOR_MS) return Promise.resolve()
  fetching = (async () => {
    try {
      const answer = await fetch(CATALOGUE, { signal: AbortSignal.timeout(ANSWER_BY_MS) })
      if (!answer.ok) return
      const limits = limitsIn(await answer.json())
      // An answer with nothing in it is not an answer — keep what is already on disk.
      if (Object.keys(limits).length === 0) return
      const file = cacheFile()
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify({ fetchedAt: Date.now(), limits } satisfies Cached))
    } catch {
      // Offline, a proxy in the way, a home folder that can't be written: the cache answers.
    }
  })()
  return fetching
}

// The providers each connector's models really come from, tried before the catalogue is
// searched at large. Without them `glm-4.7` is looked up among the eighty resellers that
// list it, and the first one found wins — which is a coin toss between windows that differ.
//
// Codex is not here: it names its own window and never reaches this file. ZCode names one
// too, and only falls back to this when its session state has none.
const PROVIDERS: Record<string, string[]> = {
  'claude-code': ['anthropic'],
  zcode: ['zai', 'zhipuai'],
  kimi: ['moonshotai', 'moonshotai-cn'],
  opencode: ['opencode'],
}

/** A model id as the catalogue spells it. Connectors name a model in their own way — Claude
 *  Code pins a build with a date, ZCode and OpenCode write `provider/model` — so a lookup
 *  tries the id as given and then the id with the pin taken off. */
function spellings(model: string): string[] {
  const id = model.trim().toLowerCase()
  if (!id) return []
  const undated = id.replace(/-\d{8}$/, '')
  return [...new Set([id, undated])]
}

/** The context window this model runs with, in tokens, or nothing when the catalogue has
 *  never been pulled or has never heard of it. `harness` is which connector named the model,
 *  and picks the providers its ids belong to. */
export function contextLimit(harness: string, model: string | undefined): number | undefined {
  if (!model?.trim()) return undefined
  const limits = readCache()?.limits
  if (!limits) return undefined
  // `provider/model`, as ZCode and OpenCode report it: the catalogue's own key, so it is
  // tried whole before anything is taken off it.
  const cut = model.lastIndexOf('/')
  if (cut > 0) {
    const whole = model.trim().toLowerCase()
    if (limits[whole]) return limits[whole]
  }
  const bare = cut > 0 ? model.slice(cut + 1) : model
  const ids = spellings(bare)
  for (const provider of PROVIDERS[harness] ?? []) {
    for (const id of ids) {
      const found = limits[`${provider}/${id}`]
      if (found) return found
    }
  }
  // Nothing under the providers this connector runs on. The model is still a real model
  // somewhere in the catalogue, and the biggest window any provider serves it with is the
  // one closest to what a first-party endpoint gives — a reseller that trims it is the
  // exception, never the whole story.
  let widest = 0
  for (const [key, limit] of Object.entries(limits)) {
    const id = key.slice(key.indexOf('/') + 1)
    if (ids.includes(id) && limit > widest) widest = limit
  }
  return widest || undefined
}
