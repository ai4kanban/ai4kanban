// Reading an agent's JSON, and writing the one line a tool call gets in the log.
//
// Every connector here is handed JSON somebody else's program wrote, so nothing in it can
// be trusted to be the shape it should be. These coerce rather than throw: a field that
// isn't there, or isn't what it claims, reads as empty. A malformed frame costs a blank in
// the log, never a dead run.
//
// `hint` is the other half — the one short parenthetical every renderer puts beside a tool
// call. It lives here so every agent's log really does read alike, which each renderer
// used to claim in a comment while keeping its own copy.

export type Json = Record<string, unknown>

export function obj(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {}
}

export function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

/** The first line of the text a tool call is recognisable by, bounded and parenthesised.
 *  Empty in, empty out — a call with nothing to show gets its name alone. */
export function hint(raw: string): string {
  const line = raw.split('\n')[0].trim()
  if (!line) return ''
  return `(${line.length > 96 ? `${line.slice(0, 93)}…` : line})`
}

/** The hint for a call's arguments: the first of `keys` that holds a non-empty string.
 *  The key list is each agent's own — their tools name the same thing `file_path`,
 *  `filePath` or `path` — and the order is the order it is tried in. */
export function argHint(input: unknown, keys: readonly string[]): string {
  const args = obj(input)
  for (const key of keys) {
    const value = str(args[key])
    if (value.trim()) return hint(value)
  }
  return ''
}
