// The model ids each agent's own CLI already knows, read off this machine.
//
// A list of models written into this build would be wrong the day a provider ships one, and
// the Model box is free text for exactly that reason. But most of these CLIs already keep a
// current list on disk — Codex and Grok cache one their server hands them, OpenCode caches
// the models.dev catalogue, ZCode's config names the models of every provider it knows — and
// reading that file is a list that stays right without anybody maintaining it.
//
// A suggestion is never a limit. Nothing is checked against what these return: an id typed
// by hand runs exactly as it did before, because a list that hasn't heard of a model must
// not be able to block it.

import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** A path under the user's home folder. */
export function home(...parts: string[]): string {
  return join(homedir(), ...parts)
}

export function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function num(value: unknown): number {
  return typeof value === 'number' ? value : Number.MAX_SAFE_INTEGER
}

/** The ids given, in the order given, without blanks or repeats. */
export function uniqueIds(list: string[]): string[] {
  return [...new Set(list.map((id) => id.trim()).filter(Boolean))]
}

// Kept against the file's mtime and size. These are read on every read of the settings —
// which is every time a screen asks what the agents are — and OpenCode's catalogue alone is
// megabytes of JSON. A missing or unreadable file is no ids and never an error: the box it
// would have filled works without it.
const cached = new Map<string, { stamp: string; found: string[] }>()

/** The ids `pick` finds in a JSON file. `salt` belongs to a read whose answer depends on
 *  something outside the file — OpenCode's catalogue is cut down to the providers a second
 *  file names — so the cache turns over when that changes too. */
export function modelsIn(
  file: string,
  pick: (data: unknown) => string[],
  salt = '',
): string[] {
  let stamp: string
  try {
    const stat = statSync(file)
    stamp = `${stat.mtimeMs}:${stat.size}:${salt}`
  } catch {
    cached.delete(file)
    return []
  }
  const hit = cached.get(file)
  if (hit?.stamp === stamp) return hit.found
  let found: string[] = []
  try {
    found = uniqueIds(pick(JSON.parse(readFileSync(file, 'utf8'))))
  } catch {
    found = []
  }
  cached.set(file, { stamp, found })
  return found
}
