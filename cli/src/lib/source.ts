// Where a card came from (#1306): the refs its frontmatter `source:` carries, and the same
// refs read out of the `## Source` section older cards wrote by hand.
//
// Pure — no filesystem — so scripts/sync-format.mjs copies it to the board UI. Turning a ref
// into something a page can open is ./card-sources.ts.

/** One place a card came from. `item` is only ever read off an old `## Source`: the file of
 *  a triage item, which a new card names through `triage:` instead. */
export type SourceRef =
  | { kind: 'plan'; id: number }
  | { kind: 'card'; id: number }
  | { kind: 'url'; url: string }
  | { kind: 'item'; file: string }

const URL = /^https?:\/\/\S+$/
const PLAN_PATH = /(?:^|\/)plans\/(?:archive\/)?(\d+)-[^/\\\s]*\.md$/

/** A ref as `source:` stores it — `plan:<id>`, `#<id>` or an address — or null. */
export function parseSourceRef(raw: string): SourceRef | null {
  const text = raw.trim()
  const plan = /^plan:(\d+)$/.exec(text)
  if (plan) return { kind: 'plan', id: Number(plan[1]) }
  const card = /^#(\d+)$/.exec(text)
  if (card) return { kind: 'card', id: Number(card[1]) }
  return URL.test(text) ? { kind: 'url', url: text } : null
}

/** What `--source` takes: a stored ref, or a plan's path. Answers the stored spelling. */
export function sourceRefFrom(said: string): string | null {
  const text = said.trim()
  const plan = PLAN_PATH.exec(text)
  if (plan) return `plan:${plan[1]}`
  return parseSourceRef(text) ? text : null
}

/** Where `## Source` sits: up to the next section or the agent boundary. A heading inside a
 *  code fence is the card quoting something, not a section. */
function sourceSpan(body: string): { start: number; end: number } | null {
  let at = 0
  let start = -1
  let fence = ''
  for (const line of body.split('\n')) {
    const mark = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = ''
    } else if (mark) {
      fence = mark
    } else if (start < 0) {
      if (/^## Source[ \t]*$/.test(line)) start = at
    } else if (/^## |^<!--\s*agent\s*-->/.test(line)) {
      return { start, end: at }
    }
    at += line.length + 1
  }
  return start < 0 ? null : { start, end: body.length }
}

export const hasSourceSection = (body: string): boolean => sourceSpan(body) !== null

/** The body as a page draws it once the source is a link: the section left out. */
export function withoutSourceSection(body: string): string {
  const span = sourceSpan(body)
  if (!span) return body
  const before = body.slice(0, span.start).trimEnd()
  const after = body.slice(span.end).trimStart()
  return before && after ? `${before}\n\n${after}` : before || after
}

/** The refs an old `## Source` names: a plan's path or a triage item's anywhere on a line,
 *  and a line holding nothing but a `#id` or an address. Notes in prose are not refs. */
export function legacySourceRefs(body: string): SourceRef[] {
  const span = sourceSpan(body)
  if (!span) return []
  const out: SourceRef[] = []
  const seen = new Set<string>()
  const put = (ref: SourceRef) => {
    const key = JSON.stringify(ref)
    if (seen.has(key)) return
    seen.add(key)
    out.push(ref)
  }
  for (const line of body.slice(span.start, span.end).split('\n').slice(1)) {
    const plan = /plans\/(?:archive\/)?(\d+)-[^/\\\s`'")\]]*\.md/.exec(line)
    if (plan) {
      put({ kind: 'plan', id: Number(plan[1]) })
      continue
    }
    const item = /triage\/(?:(?:archived|dismissed)\/)?([^/\\\s`'")\]]+\.md)/.exec(line)
    if (item) {
      put({ kind: 'item', file: item[1]! })
      continue
    }
    const alone = line
      .trim()
      .replace(/^[-*]\s+/, '')
      .replace(/^[`<]|[`>]$/g, '')
    const ref = parseSourceRef(alone)
    if (ref) put(ref)
  }
  return out
}

/** Every ref a card's own text carries, with no file read: `source:` when it has any, else
 *  the old section. */
export function writtenSourceRefs(source: readonly string[], body: string): SourceRef[] {
  const refs = source.map(parseSourceRef).filter((r): r is SourceRef => r !== null)
  return refs.length ? refs : legacySourceRefs(body)
}
