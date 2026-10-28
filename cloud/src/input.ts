/**
 * What a client sends, taken as shapes this service will store.
 *
 * Every route validates here rather than trusting a body: an id that is not an id never
 * reaches a query, a name is cut to a length a row can hold, and a list is capped so nothing
 * a client sends can grow a row without bound.
 */

import { badRequest } from './errors.ts'

/** As long as a machine name, which is the longest thing a person types into any of this. */
export const MAX_NAME = 200

/** At most this many runtimes on one node (#345). A board names a handful. */
const MAX_RUNTIMES = 32

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function uuid(value: unknown, what: string): string {
  const held = typeof value === 'string' ? value.trim() : ''
  if (!UUID.test(held)) throw badRequest(`That request names no ${what}.`)
  return held
}

/** A name, trimmed and cut. Never refused: a name is prose, and a long one is not an error. */
export const shortName = (value: unknown): string =>
  typeof value === 'string' ? value.trim().slice(0, MAX_NAME) : ''

/** One of the board's runtimes (#345), and what a machine runs it as. Names only: never a
 *  key, an argument string or a path. */
export interface ServerRuntime {
  name: string
  harness: string
  /** Absent where that computer set no model, so the harness runs its own default. */
  model?: string
  /** That computer bound nothing for this runtime, so it fell back. */
  fallback?: boolean
}

/** What the client says it runs the board's runtimes as, taken as names and nothing else.
 *  Anything unrecognisable is dropped rather than refused: a report is best-effort, and one
 *  bad entry must not stop a machine registering. */
export function runtimes(value: unknown): ServerRuntime[] {
  if (!Array.isArray(value)) return []
  const out: ServerRuntime[] = []
  for (const item of value.slice(0, MAX_RUNTIMES)) {
    const held = (item ?? {}) as Record<string, unknown>
    const name = shortName(held.name)
    const harness = shortName(held.harness)
    if (!name || !harness) continue
    const model = shortName(held.model)
    out.push({
      name,
      harness,
      ...(model ? { model } : {}),
      ...(held.fallback === true ? { fallback: true } : {}),
    })
  }
  return out
}
