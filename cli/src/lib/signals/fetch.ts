// One pull of the market signal endpoint (#453).
//
// `GET` the endpoint `config.md` names, with the token from `docs/kanban/.env` as a bearer.
// The answer is `{ "signals": [...] }`, each signal carrying the six required fields. There
// is no paging and no ceiling: the endpoint decides how much it sends, and the board takes
// all of it. Turning whatever a platform actually returns into this shape is the user's own
// converter — which is what lets any platform be connected without the board knowing one.
//
// Nothing is written until the whole answer is in hand: a request that fails, an answer
// that will not parse and a board with the settings still to fill in all leave the inbox
// exactly as it was. A signal that fails field validation is the one exception the other
// way — it is counted and explained, and the rest of the batch still lands.

import { formatStamp } from '../cadence'
import { die } from '../paths'
import { signalConfigGaps, signalEndpoint, signalToken } from './config'
import { readHandled, readInbox, writeSignal, type IncomingSignal } from './inbox'
import type { Signal } from '../view/types'

/** One signal the fetch would not take, and why. */
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

const REQUIRED = ['source_id', 'title', 'summary', 'platform', 'url', 'collected_at'] as const

type Wire = Record<string, unknown>

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** One wire signal read into the shape the inbox writes, or the reasons it cannot be. */
function read(raw: Wire): { ok: true; signal: IncomingSignal } | { ok: false; why: string } {
  const missing = REQUIRED.filter((field) => !text(raw[field]))
  if (missing.length > 0) return { ok: false, why: `missing ${missing.join(', ')}` }
  const when = new Date(text(raw.collected_at))
  if (Number.isNaN(when.getTime())) return { ok: false, why: `collected_at is not a time: ${text(raw.collected_at)}` }
  return {
    ok: true,
    signal: {
      sourceId: text(raw.source_id),
      title: text(raw.title),
      summary: text(raw.summary),
      platform: text(raw.platform),
      url: text(raw.url),
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
  if (gaps.length > 0) die('the board is not set up to pull signals yet', { kind: 'signals-not-configured' })

  const endpoint = signalEndpoint()
  let response: Response
  try {
    response = await fetch(endpoint, { headers: { authorization: `Bearer ${signalToken()}` } })
  } catch (e) {
    die(`could not reach ${endpoint}: ${e instanceof Error ? e.message : String(e)}`, { kind: 'signals-unreachable' })
  }
  if (!response.ok) {
    die(`${endpoint} answered ${response.status}.`, { kind: 'signals-refused' })
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (e) {
    die(`${endpoint} did not answer with JSON: ${e instanceof Error ? e.message : String(e)}`, {
      kind: 'signals-unreadable',
    })
  }
  const wire = (body as { signals?: unknown } | null)?.signals
  if (!Array.isArray(wire)) {
    die(`${endpoint} did not answer with a \`signals\` list.`, { kind: 'signals-unreadable' })
  }

  const seen = new Set([...readInbox().map((signal) => signal.sourceId), ...readHandled()])
  const importedAt = formatStamp(new Date())
  const report: FetchReport = { added: [], skipped: 0, failed: [] }
  wire.forEach((raw, at) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      report.failed.push({ which: `signal ${at + 1}`, why: 'not an object' })
      return
    }
    const found = read(raw as Wire)
    if (!found.ok) {
      report.failed.push({ which: text((raw as Wire).source_id) || `signal ${at + 1}`, why: found.why })
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
