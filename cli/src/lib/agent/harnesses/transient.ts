// Reading a passing provider failure out of a connector's own words (#525).
//
// Each harness reports a failure in its own shape and translates it into the one answer in
// ./types. But WHICH failures pass on their own is one question rather than one per
// connector — an overloaded endpoint reads the same whoever reached it — so the reading
// itself lives here and every connector that declares recognition calls it.
//
// Deliberately small, and in this order:
//   1. MANUAL — a failure no second attempt could fix. Read FIRST, so a sentence carrying
//      both ("rate limited: service unavailable") stays manual.
//   2. PASSING — the endpoint or the connection, not the request.
//   3. anything else — not transient, which is what an output nobody has read reads as.
//
// A rule that matches output no CLI writes is not coverage, and one that matches too much
// burns a card's attempts on a failure that could never succeed. Both lists are held to the
// same bar as the connectors above them: they come from failure output this board captured,
// and cli/test/agent-retry.test.ts holds it.

import type { TransientFailure } from './types'

// A failure a second attempt would only repeat: the login, the configuration, the money,
// the user's own decision, and the limits a run was given.
const MANUAL: RegExp[] = [
  /\b(401|403)\b/,
  /unauthorized|forbidden|permission denied/,
  /authenticat|invalid api key|api[_ ]key|not logged in|\/login|oauth/,
  /\b429\b/,
  /rate[_ ]limit|usage limit|quota|credit balance|insufficient|out of tokens/,
  /cancell?ed|aborted by|interrupted by the user/,
  /maximum budget|max(imum)? turns|exceeded the budget/,
  /model not found|unknown model|unsupported|invalid[_ ]request/,
]

// A provider that was there a minute ago and will be there again: the endpoint refusing for
// a moment, or the connection to it giving out mid-response.
const PASSING: RegExp[] = [
  // 502/503/529 are distinctive enough to read as a status wherever they appear. A bare
  // 500 is not — a failure line counting something would match it — so it is left to the
  // words below, which is how that status is actually written out.
  /\b(502|503|529)\b/,
  /overloaded|service unavailable|bad gateway|internal server error|server_error/,
  /connection (lost|dropped|reset|error|closed)|socket hang up|stream (error|disconnected)/,
  /econnreset|econnrefused|etimedout|enetunreach|enotfound|eai_again/,
  /fetch failed|request timed out|network error/,
]

// What the provider asked for, where it said so: `retry-after: 20`, `retry after 20s`.
// Seconds, which is what every one of these reports.
const RETRY_AFTER = /retry[-_\s]?after["':=\s]+(\d+)/i

// How much of a line is worth showing. The runs view reads it beside a countdown, so it is
// a reason and not a report.
const REASON_MAX = 140

/** The first line of `text` that a rule matched, trimmed to something a row can hold. */
function reasonLine(text: string, rule: RegExp): string {
  const line = text.split('\n').find((l) => rule.test(l.toLowerCase())) ?? text
  const said = line.trim().replace(/\s+/g, ' ')
  return said.length > REASON_MAX ? `${said.slice(0, REASON_MAX - 1)}…` : said
}

/** Whether these words describe a provider that merely stumbled, and what to say about it.
 *  Every argument is one thing the connector's output said; the first that reads as either
 *  answer settles it, so a connector hands over its most specific signal first. */
export function providerBlip(...said: (string | undefined)[]): TransientFailure | undefined {
  for (const text of said) {
    if (!text?.trim()) continue
    const lower = text.toLowerCase()
    if (MANUAL.some((rule) => rule.test(lower))) return undefined
    const hit = PASSING.find((rule) => rule.test(lower))
    if (!hit) continue
    const asked = RETRY_AFTER.exec(text)
    const seconds = asked ? Number(asked[1]) : NaN
    return {
      reason: reasonLine(text, hit),
      ...(Number.isFinite(seconds) && seconds > 0 ? { retryAfterMs: seconds * 1_000 } : {}),
    }
  }
  return undefined
}
