/**
 * A partner's refine case (#628) — the one thing this service takes that carries project
 * files.
 *
 * It is stored as ONE object in a private bucket, under a prefix that is the submission id.
 * No index row anywhere: an id is the whole address, so deleting a submission is listing one
 * prefix and deleting what is under it, and there is no second place for that state to
 * disagree with. The eval cases a submission was later entered into live under the same
 * prefix, which is what makes "delete the pack and everything it became" one operation.
 *
 * Nothing about it touches D1. The feedback tables promise a 90-day sweep on their
 * attachments (#603) and a case is kept until it is asked for back, so the two never share a
 * store.
 */

import { CASE_ID, DAY, LIMITS, SURFACES, TOKEN, VERSION } from '../contract.ts'
import type { SentCase, SentCaseFile, SentCaseRun } from '../contract.ts'

/** A body that is not one. The endpoint answers 400 and stores nothing. */
export class BadCase extends Error {}

/** Where one submission's objects live. Everything under it goes together. */
export const casePrefix = (id: string): string => `pending/${id}/`

/** The pack itself, under that prefix. */
export const caseKey = (id: string): string => `${casePrefix(id)}case.json`

/**
 * A posted body, taken as one case.
 *
 * Stricter than a batch and for the opposite reason: a dropped number costs nothing, while a
 * case stored as less than the user authorised is a reproduction that quietly cannot be
 * reproduced. So an unreadable field is a refusal the sender is told about, never a field
 * dropped in silence.
 */
export function takeCase(body: unknown, today: string): SentCase {
  const sent = body as Record<string, unknown> | null
  if (!sent || typeof sent !== 'object') throw new BadCase('not an object')
  if (sent.v !== VERSION) throw new BadCase('unknown contract version')

  // The id is the delete key AND the de-duplication: a pack posted twice is one object.
  if (typeof sent.id !== 'string' || !CASE_ID.test(sent.id)) throw new BadCase('bad id')

  const day = typeof sent.day === 'string' ? sent.day : ''
  if (!DAY.test(day) || day < shift(today, -LIMITS.backfillDays) || day > shift(today, LIMITS.aheadDays)) {
    throw new BadCase('bad day')
  }

  const submittedAt = typeof sent.submittedAt === 'string' ? sent.submittedAt : ''
  if (!submittedAt || Number.isNaN(Date.parse(submittedAt))) throw new BadCase('bad submittedAt')

  const surface = typeof sent.surface === 'string' ? sent.surface : ''
  if (!(SURFACES as readonly string[]).includes(surface)) throw new BadCase('bad surface')

  const version = typeof sent.version === 'string' && TOKEN.test(sent.version) ? sent.version : ''

  if (typeof sent.card !== 'number' || !Number.isSafeInteger(sent.card) || sent.card < 0) {
    throw new BadCase('bad card')
  }

  const text = typeof sent.text === 'string' ? sent.text.trim() : ''
  if (!text) throw new BadCase('no text')

  return {
    v: VERSION,
    id: sent.id,
    day,
    submittedAt,
    surface,
    version,
    card: sent.card,
    ...(typeof sent.flowId === 'string' && sent.flowId ? { flowId: sent.flowId } : {}),
    text: text.slice(0, LIMITS.feedbackTextChars),
    ...(typeof sent.analysis === 'string' && sent.analysis ? { analysis: sent.analysis } : {}),
    gaps: lines(sent.gaps),
    runs: runs(sent.runs),
    files: files(sent.files),
  }
}

function lines(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new BadCase('bad gaps')
  return value.map((line) => {
    if (typeof line !== 'string') throw new BadCase('bad gap')
    return line
  })
}

function runs(value: unknown): SentCaseRun[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new BadCase('bad runs')
  return value.map((item) => {
    const run = item as Record<string, unknown> | null
    if (!run || typeof run !== 'object') throw new BadCase('bad run')
    if (typeof run.sessionId !== 'string' || !run.sessionId) throw new BadCase('bad run session')
    if (typeof run.startedAt !== 'number') throw new BadCase('bad run time')
    return {
      action: typeof run.action === 'string' ? run.action : '',
      startedAt: run.startedAt,
      harness: typeof run.harness === 'string' ? run.harness : '',
      sessionId: run.sessionId,
      ...(typeof run.runtime === 'string' && run.runtime ? { runtime: run.runtime } : {}),
      ...(typeof run.resumeId === 'string' && run.resumeId ? { resumeId: run.resumeId } : {}),
      ...(typeof run.cwd === 'string' && run.cwd ? { cwd: run.cwd } : {}),
      ...(Array.isArray(run.argv) ? { argv: run.argv.map(String) } : {}),
      ...(typeof run.version === 'string' && run.version ? { version: run.version } : {}),
      ...(typeof run.input === 'string' && run.input ? { input: run.input } : {}),
      ...(typeof run.trace === 'string' && run.trace ? { trace: run.trace } : {}),
    }
  })
}

function files(value: unknown): SentCaseFile[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new BadCase('bad files')
  const seen = new Set<string>()
  return value.map((item) => {
    const file = item as Record<string, unknown> | null
    if (!file || typeof file !== 'object') throw new BadCase('bad file')
    if (typeof file.path !== 'string' || !file.path) throw new BadCase('bad file path')
    if (seen.has(file.path)) throw new BadCase('repeated file')
    seen.add(file.path)
    const version = file.version
    if (version !== 'read' && version !== 'current' && version !== 'missing') throw new BadCase('bad file version')
    return {
      path: file.path,
      bytes: typeof file.bytes === 'number' ? file.bytes : 0,
      text: typeof file.text === 'string' ? file.text : '',
      version,
      ...(typeof file.evidence === 'string' && file.evidence ? { evidence: file.evidence } : {}),
    }
  })
}

/**
 * Put one case away, as a single object under its own prefix.
 *
 * `httpMetadata` and `customMetadata` carry the id and the submission time on the object
 * itself, so a request quoting an id that was mistyped can still be found by the day it was
 * sent — which is the whole reason the pack carries both.
 */
export async function storeCase(bucket: R2Bucket, taken: SentCase): Promise<void> {
  await bucket.put(caseKey(taken.id), JSON.stringify(taken), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
    customMetadata: { id: taken.id, submittedAt: taken.submittedAt, day: taken.day, card: String(taken.card) },
  })
}

/** A calendar date `days` away from `day`. Its own copy, so nothing about a case imports the
 *  batch path. */
function shift(day: string, days: number): string {
  const at = Date.parse(`${day}T00:00:00Z`)
  return new Date(at + days * 86_400_000).toISOString().slice(0, 10)
}
