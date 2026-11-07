// Claude Code's `total_cost_usd` is the session's running total: a resumed or forked session
// carries everything spent before it (#1480). A reply's or a run's own cost is that total less
// the last total recorded for the session it carried on.

import type { RunRecord } from './types'

export const reportsSessionTotal = (harness: string | undefined): boolean => harness === 'claude-code'

/** `before` is undefined for a fresh session and null for one carried on with no total on
 *  record — that turn shows no cost rather than the history's. A total lower than `before`
 *  is a new session, so it is the turn's own. */
export function ownCost(total: number | undefined, before: number | null | undefined): number | undefined {
  if (total === undefined || before === null) return undefined
  if (before === undefined || total < before) return total
  return total > before ? total - before : undefined
}

/** The last session total recorded for this session id, by any run. */
export function lastSessionTotal(id: string, runs: RunRecord[]): number | null {
  let best: { at: number; usd: number } | undefined
  const take = (at: number, usd: unknown): void => {
    if (typeof usd === 'number' && usd > 0 && (!best || at >= best.at)) best = { at, usd }
  }
  for (const r of runs) if (r.resumeId === id || r.sessionId === id) take(r.endedAt ?? r.startedAt, r.sessionCostUsd)
  return best?.usd ?? null
}
