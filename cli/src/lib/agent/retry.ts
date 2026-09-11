// When a run that died on a provider failure tries again (#525).
//
// The recognition is each connector's (agent/harnesses/transient.ts) — this is the part
// that is the same whoever failed: how long to wait, how many times, and when to stop
// waiting and hand the card back.
//
// Capped exponential backoff with jitter. A blip clears in seconds, so the first wait is
// short; a provider that is really down would otherwise be hammered by every board on it at
// the same second, which is what the jitter is for. A retry time the provider asked for
// wins outright — it knows when it will be back and we do not.
//
// Both bounds matter and they bound different things. THREE attempts is what stops a
// failure that only looks transient from being paid for over and over. FIFTEEN MINUTES,
// counted from the moment the first attempt STARTED, is what stops a card being held while
// nothing happens — and it is also how a harness's own internal retries are accounted for:
// the time one burned retrying inside an attempt is inside that window already, so those
// attempts count against the same limit without the harness having to report them.

import type { TransientFailure } from './harnesses'
import type { RunRetry } from './types'

/** How many attempts one failure gets, the first included. */
export const RETRY_ATTEMPTS = 3

/** And how long the whole chain gets, from the first attempt's start. */
export const RETRY_WINDOW_MS = 15 * 60_000

// The first wait, and the ceiling the doubling stops at.
const BASE_MS = 15_000
const CAP_MS = 120_000

// How much of a wait is jittered away, at most: a wait lands somewhere in the last quarter
// of its window, so two boards that failed together do not come back together.
const JITTER = 0.25

/** The wait before attempt `attempt`, in ms — `random` is the roll, injected so a test can
 *  hold it still.
 *
 *  Landing's own conflict retries borrow this curve (#595): the same first wait, the same
 *  ceiling and the same jitter, without the attempt and window bounds above — a conflict is
 *  retried until it lands. */
export function backoffMs(attempt: number, random: () => number = Math.random): number {
  const step = Math.min(CAP_MS, BASE_MS * 2 ** Math.max(0, attempt - 2))
  return Math.round(step * (1 - JITTER * random()))
}

/** The retry this failure earns, or null when it has run out of attempts or out of time.
 *
 *  `prev` is what the failed run carried — nothing on the first failure of a chain. `now`
 *  and `random` are injected so the policy can be read at a fixed moment. */
export function planRetry(
  prev: RunRetry | undefined,
  failure: TransientFailure,
  startedAt: number,
  now: number = Date.now(),
  random: () => number = Math.random,
): RunRetry | null {
  const attempt = (prev?.attempt ?? 1) + 1
  if (attempt > RETRY_ATTEMPTS) return null
  // The chain's clock started with its first attempt, and a run that never retried before
  // IS that first attempt.
  const since = prev?.since ?? startedAt
  const wait = failure.retryAfterMs ?? backoffMs(attempt, random)
  const at = now + wait
  // A wait that would leave the next attempt starting outside the window is not a wait
  // worth holding a card through: the answer is the same either way, and this way the user
  // gets it now.
  if (at > since + RETRY_WINDOW_MS) return null
  return { attempt, of: RETRY_ATTEMPTS, reason: failure.reason, at, since }
}

/** What the log and the runs view say about a wait: the reason, the countdown, and which
 *  attempt is coming. One sentence, because it is read on one row. */
export function retryLine(retry: RunRetry, now: number = Date.now()): string {
  const seconds = Math.max(1, Math.round((retry.at - now) / 1_000))
  return (
    `${retry.reason} — the provider failed for a moment, so this run tries again in ` +
    `${seconds}s (attempt ${retry.attempt} of ${retry.of}).`
  )
}
