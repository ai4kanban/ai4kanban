// One pull of the triage endpoint (#453, #499).
//
// `GET` the endpoint `config.md` names, with the token from `docs/kanban/.env` as a bearer.
// The answer is `{ "signals": [...] }`. Only `title` and `summary` are required —
// `source_type`, `meta`, `url` and `collected_at` are taken when sent, and `source_id` is
// derived when nothing supplies one, so an endpoint over a newsletter or a PDF pipeline
// connects on the same terms as one over a social platform. There is no paging and no
// ceiling: the endpoint decides how much it sends, and the board takes all of it.
//
// What says which source an item came from goes through the one match rule (./sources.ts):
// a sent `source_type`, then an older `platform`/`source`, then the link's own domain. What
// none of them match is left without a type rather than guessed at — and a `platform` or
// `source` that missed is kept as a `meta` entry, so nothing an endpoint said is dropped.
//
// Nothing is written until the whole answer is in hand: a request that fails, an answer
// that will not parse and a board with the settings still to fill in all leave the inbox
// exactly as it was. An item that fails field validation is the one exception the other
// way — it is counted and explained, and the rest of the batch still lands.

import { formatStamp } from '../cadence'
import { die } from '../paths'
import { signalConfigGaps, signalEndpoint, signalToken } from './config'
import { derivedSourceId, host } from './identity'
import { matchSourceType, readSourceType } from './sources'
import { metaPair, readHandled, readInbox, writeSignal, type IncomingSignal } from './inbox'
import type { Signal, SignalMeta } from '../view/types'

/** One item the fetch would not take, and why. */
export interface SignalFailure {
  /** Its source id, or where it sat in the answer when it carried none. */
  which: string
  why: string
}

/** What one pull did. */
export interface FetchReport {
  added: Signal[]
  /** Already in the inbox, already handled, or a repeat inside this same batch. */
  skipped: number
  failed: SignalFailure[]
}

const REQUIRED = ['title', 'summary'] as const

type Wire = Record<string, unknown>

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** The key-value pairs an endpoint sent, in the order it sent them. Anything a single line
 *  will not hold — an object, a list — is left out rather than flattened. */
function readMeta(sent: unknown): SignalMeta[] {
  if (!sent || typeof sent !== 'object' || Array.isArray(sent)) return []
  const pairs: SignalMeta[] = []
  for (const [key, value] of Object.entries(sent as Record<string, unknown>)) {
    const pair = metaPair(key, value)
    if (pair) pairs.push(pair)
  }
  return pairs
}

/** One wire item read into the shape the inbox writes, or the reasons it cannot be.
 *
 *  `platform` is what endpoints written before #499 called `source`; both are read through
 *  the match rule now (#560) and kept as a `meta` entry when they match nothing. */
function read(raw: Wire): { ok: true; signal: IncomingSignal } | { ok: false; why: string } {
  const missing = REQUIRED.filter((field) => !text(raw[field]))
  if (missing.length > 0) return { ok: false, why: `missing ${missing.join(', ')}` }
  const sent = text(raw.collected_at)
  const when = sent ? new Date(sent) : new Date()
  if (Number.isNaN(when.getTime())) return { ok: false, why: `collected_at is not a time: ${sent}` }
  const url = text(raw.url)
  const title = text(raw.title)
  const summary = text(raw.summary)

  const meta = readMeta(raw.meta)
  const typed = text(raw.source_type)
  const named = text(raw.source) || text(raw.platform)
  let sourceType = ''
  if (typed) {
    sourceType = readSourceType(typed)
  } else if (named) {
    sourceType = matchSourceType(named)
    const kept = sourceType ? null : metaPair('source', named)
    if (kept) meta.unshift(kept)
  } else {
    sourceType = matchSourceType(host(url))
  }

  return {
    ok: true,
    signal: {
      sourceId: text(raw.source_id) || derivedSourceId(url || `${title}\n${summary}`),
      title,
      summary,
      sourceType,
      meta,
      url,
      collectedAt: formatStamp(when),
    },
  }
}

/** Ask the endpoint, and write what comes back into the inbox.
 *
 *  Refuses — writing nothing — when the board is not configured, when the request fails, or
 *  when the answer is not the shape it must be. The token is never in a refusal: what a
 *  reader is told is that it is missing, not what it is. */
export async function fetchSignals(): Promise<FetchReport> {
  const gaps = signalConfigGaps()
  if (gaps.length > 0) die('the board is not set up to pull triage items yet', { kind: 'triage-not-configured' })

  const endpoint = signalEndpoint()
  let response: Response
  try {
    response = await fetch(endpoint, { headers: { authorization: `Bearer ${signalToken()}` } })
  } catch (e) {
    die(`could not reach ${endpoint}: ${e instanceof Error ? e.message : String(e)}`, { kind: 'triage-unreachable' })
  }
  if (!response.ok) {
    die(`${endpoint} answered ${response.status}.`, { kind: 'triage-endpoint-refused' })
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (e) {
    die(`${endpoint} did not answer with JSON: ${e instanceof Error ? e.message : String(e)}`, {
      kind: 'triage-unreadable',
    })
  }
  const wire = (body as { signals?: unknown } | null)?.signals
  if (!Array.isArray(wire)) {
    die(`${endpoint} did not answer with a \`signals\` list.`, { kind: 'triage-unreadable' })
  }

  const seen = new Set([...readInbox().map((signal) => signal.sourceId), ...readHandled()])
  const importedAt = formatStamp(new Date())
  const report: FetchReport = { added: [], skipped: 0, failed: [] }
  wire.forEach((raw, at) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      report.failed.push({ which: `item ${at + 1}`, why: 'not an object' })
      return
    }
    const found = read(raw as Wire)
    if (!found.ok) {
      report.failed.push({ which: text((raw as Wire).source_id) || `item ${at + 1}`, why: found.why })
      return
    }
    if (seen.has(found.signal.sourceId)) {
      report.skipped++
      return
    }
    seen.add(found.signal.sourceId)
    report.added.push(writeSignal(found.signal, importedAt))
  })
  return report
}
