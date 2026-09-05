/**
 * A posted body, taken as rows this service will store.
 *
 * Nothing here trusts a sender. An unknown event name, an unknown field, a value of the
 * wrong shape and a date outside the window are all dropped silently — the answer says only
 * that the batch was taken, so nothing is ever retried into a wall.
 */

import { DAY, EVENTS, LIMITS, SURFACES, TOKEN, UUID, VERSION } from '../contract.ts'
import type { EventName, FieldKind } from '../contract.ts'

/** One row as the insert reads it. The short names keep the JSON parameter small. */
export interface Row {
  /** event id */
  e: string
  /** the sender's own calendar date */
  d: string
  /** event name */
  n: string
  /** app | command | site */
  s: string
  v: string
  /** #296's board id, or '' */
  b: string
  /** the declared fields that are not columns, as JSON text */
  f: string
}

export interface Taken {
  /** '' for a site batch, which carries no install id at all. */
  install: string
  rows: Row[]
}

/** A batch that is not a batch. The endpoint answers 400 and stores nothing. */
export class BadBatch extends Error {}

/**
 * @param body   the parsed request body
 * @param today  the server's own date, `YYYY-MM-DD`
 * @param newId  makes an id for a site event, which carries none of its own
 */
export function take(body: unknown, today: string, newId: () => string): Taken {
  const batch = body as { v?: unknown; install?: unknown; events?: unknown } | null
  if (!batch || typeof batch !== 'object') throw new BadBatch('not an object')
  if (batch.v !== VERSION) throw new BadBatch('unknown contract version')
  if (!Array.isArray(batch.events)) throw new BadBatch('no events')
  if (batch.events.length > LIMITS.batchEvents) throw new BadBatch('too many events')

  // The install id decides which of the two kinds of batch this is. A site batch carries
  // none at all, so it is never de-duplicated and nothing about the machine is stored.
  let install = ''
  if (batch.install !== undefined) {
    if (typeof batch.install !== 'string' || !UUID.test(batch.install)) {
      throw new BadBatch('bad install id')
    }
    install = batch.install
  }
  const from = install ? 'app' : 'site'

  const oldest = shift(today, -LIMITS.backfillDays)
  const newest = shift(today, LIMITS.aheadDays)

  const rows: Row[] = []
  for (const item of batch.events) {
    const row = takeOne(item, from, oldest, newest, newId)
    if (row) rows.push(row)
  }
  return { install, rows }
}

function takeOne(
  item: unknown,
  from: 'app' | 'site',
  oldest: string,
  newest: string,
  newId: () => string,
): Row | null {
  const sent = (item ?? {}) as Record<string, unknown>

  const name = typeof sent.name === 'string' ? sent.name : ''
  if (!(name in EVENTS)) return null
  const shape = EVENTS[name as EventName]
  // An app event posted without an install id, or a site event posted with one, is somebody
  // sending down the wrong path. Drop it rather than store it under the wrong rules.
  if (shape.from !== from) return null

  const day = typeof sent.day === 'string' ? sent.day : ''
  if (!DAY.test(day) || day < oldest || day > newest) return null

  // An app event is recognised by the id its sender made for it, so a resent batch costs a
  // row of storage and changes no number. A site batch is never resent and carries none.
  let id: string
  if (from === 'app') {
    if (typeof sent.id !== 'string' || !TOKEN.test(sent.id)) return null
    id = sent.id
  } else {
    id = newId()
  }

  const fields: Record<string, unknown> = {}
  let surface = from === 'site' ? 'site' : 'app'
  let version = ''
  let board = ''
  for (const [field, kind] of Object.entries(shape.fields)) {
    const value = valueOf(sent[field], kind)
    if (value === undefined) continue
    if (field === 'surface') {
      if ((SURFACES as readonly string[]).includes(value as string)) surface = value as string
    } else if (field === 'version') {
      version = value as string
    } else if (field === 'board') {
      board = value as string
    } else {
      fields[field] = value
    }
  }

  return { e: id, d: day, n: name, s: surface, v: version, b: board, f: JSON.stringify(fields) }
}

/** A field value, or nothing when it is not what the contract says it is. */
function valueOf(value: unknown, kind: FieldKind): string | number | boolean | undefined {
  if (kind === 'flag') return typeof value === 'boolean' ? value : undefined
  if (kind === 'count') {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
      ? value
      : undefined
  }
  if (typeof value !== 'string') return undefined
  if (kind === 'id') return UUID.test(value) ? value : undefined
  return TOKEN.test(value) ? value : undefined
}

/** A calendar date `days` away from `day`. */
export function shift(day: string, days: number): string {
  const at = Date.parse(`${day}T00:00:00Z`)
  return new Date(at + days * 86_400_000).toISOString().slice(0, 10)
}
