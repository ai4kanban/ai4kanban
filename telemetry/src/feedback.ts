/**
 * Feedback (#603) — the one thing this service takes that a person wrote.
 *
 * It is not an event, and nothing about it goes through `take`/`store`: those drop what they
 * do not recognise and answer "taken" either way, because a counted number that is lost costs
 * nothing anyone notices. A sentence someone typed is not that. It is checked, stored, and
 * ANSWERED — a submission that did not land is said so on the screen it was written on, and
 * nothing retries it.
 *
 * The body is kept indefinitely; its attachments are swept on the same 90 days a raw event
 * gets (src/daily.ts). Neither is written into the daily archive.
 */

import { DAY, FEEDBACK_PARTS, FEEDBACK_SOURCES, LIMITS, SURFACES, TOKEN, UUID, VERSION } from '../contract.ts'
import type { FeedbackPart } from '../contract.ts'

/** A body that is not one. The endpoint answers 400 and stores nothing. */
export class BadFeedback extends Error {}

export interface TakenFeedback {
  /** '' from a machine with usage reporting off, which carries no install id at all. */
  install: string
  id: string
  day: string
  source: string
  surface: string
  version: string
  /** The archived card it is about, or null. */
  card: number | null
  text: string
  parts: { part: FeedbackPart; text: string; bytes: number }[]
}

const INSERT_FEEDBACK = `
INSERT OR IGNORE INTO feedback
  (install_id, feedback_id, day, received_at, source, surface, version, country, card_id, body)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
`

export const INSERT_PARTS = `
INSERT OR IGNORE INTO feedback_files (install_id, feedback_id, part, day, bytes, content)
SELECT ?2, ?3, json_extract(value, '$.p'), ?4,
       json_extract(value, '$.b'), json_extract(value, '$.c')
  FROM json_each(?1)
`

/**
 * A posted body, taken as one piece of feedback.
 *
 * @param body   the parsed request body
 * @param today  the server's own date, `YYYY-MM-DD`
 */
export function takeFeedback(body: unknown, today: string): TakenFeedback {
  const sent = body as Record<string, unknown> | null
  if (!sent || typeof sent !== 'object') throw new BadFeedback('not an object')
  if (sent.v !== VERSION) throw new BadFeedback('unknown contract version')

  // The id is the de-duplication: a submission the sender posted twice is stored once.
  if (typeof sent.id !== 'string' || !UUID.test(sent.id)) throw new BadFeedback('bad id')

  let install = ''
  if (sent.install !== undefined) {
    if (typeof sent.install !== 'string' || !UUID.test(sent.install)) {
      throw new BadFeedback('bad install id')
    }
    install = sent.install
  }

  const day = typeof sent.day === 'string' ? sent.day : ''
  if (!DAY.test(day) || day < shift(today, -LIMITS.backfillDays) || day > shift(today, LIMITS.aheadDays)) {
    throw new BadFeedback('bad day')
  }

  const source = typeof sent.source === 'string' ? sent.source : ''
  if (!(FEEDBACK_SOURCES as readonly string[]).includes(source)) throw new BadFeedback('bad source')

  const surface = typeof sent.surface === 'string' ? sent.surface : ''
  if (!(SURFACES as readonly string[]).includes(surface)) throw new BadFeedback('bad surface')

  const version = typeof sent.version === 'string' && TOKEN.test(sent.version) ? sent.version : ''

  // A card number and nothing else about it. Its title and its body are an attachment, and
  // an attachment is separately authorised.
  let card: number | null = null
  if (sent.card !== undefined && sent.card !== null) {
    if (typeof sent.card !== 'number' || !Number.isSafeInteger(sent.card) || sent.card < 0) {
      throw new BadFeedback('bad card')
    }
    card = sent.card
  }

  const text = typeof sent.text === 'string' ? sent.text.trim() : ''
  if (!text) throw new BadFeedback('no text')

  // An unknown part name and a part sent twice are both refused rather than dropped: this
  // sender is ours, and a submission stored as less than the user authorised is worse than
  // one they are told did not go.
  const parts: TakenFeedback['parts'] = []
  const seen = new Set<string>()
  if (sent.parts !== undefined) {
    if (!Array.isArray(sent.parts)) throw new BadFeedback('bad parts')
    for (const item of sent.parts) {
      const part = (item as { part?: unknown })?.part
      const content = (item as { text?: unknown })?.text
      if (typeof part !== 'string' || !(FEEDBACK_PARTS as readonly string[]).includes(part)) {
        throw new BadFeedback('bad part')
      }
      if (seen.has(part)) throw new BadFeedback('repeated part')
      if (typeof content !== 'string') throw new BadFeedback('bad part text')
      seen.add(part)
      parts.push({
        part: part as FeedbackPart,
        text: content.slice(0, LIMITS.feedbackPartBytes),
        bytes: bytesOf(content),
      })
    }
  }

  return {
    install,
    id: sent.id,
    day,
    source,
    surface,
    version,
    card,
    text: text.slice(0, LIMITS.feedbackTextChars),
    parts,
  }
}

/**
 * Put one piece of feedback away — the body, then its attachments.
 *
 * Two statements rather than a batch, and in that order: a body stored without its
 * attachments is still the feedback, while attachments with no body behind them are rows
 * nobody can read. A failure is answered as a failure, unlike a dropped batch: the sender is
 * a person waiting on a screen.
 */
export async function storeFeedback(
  db: D1Database,
  taken: TakenFeedback,
  country: string,
  receivedAt: string,
): Promise<{ rowsWritten: number; rowsRead: number }> {
  const body = await db
    .prepare(INSERT_FEEDBACK)
    .bind(
      taken.install,
      taken.id,
      taken.day,
      receivedAt,
      taken.source,
      taken.surface,
      taken.version,
      country,
      taken.card,
      taken.text,
    )
    .run()
  let rowsWritten = body.meta.rows_written
  let rowsRead = body.meta.rows_read

  if (taken.parts.length > 0) {
    const rows = taken.parts.map((p) => ({ p: p.part, b: p.bytes, c: p.text }))
    const files = await db
      .prepare(INSERT_PARTS)
      .bind(JSON.stringify(rows), taken.install, taken.id, taken.day)
      .run()
    rowsWritten += files.meta.rows_written
    rowsRead += files.meta.rows_read
  }
  return { rowsWritten, rowsRead }
}

/** How many bytes the user's copy of a part was, before the cut above. */
function bytesOf(text: string): number {
  return new TextEncoder().encode(text).byteLength
}

/** A calendar date `days` away from `day`. Its own copy rather than take.ts's, so nothing
 *  about feedback imports the batch path. */
function shift(day: string, days: number): string {
  const at = Date.parse(`${day}T00:00:00Z`)
  return new Date(at + days * 86_400_000).toISOString().slice(0, 10)
}
