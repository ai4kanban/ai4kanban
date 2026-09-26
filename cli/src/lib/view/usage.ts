// The usage ledger (../agent/usage.ts) summed for Insights: one row per connector and model
// over the last `span` local days, costliest first.

import { harnessLabel } from '../agent/resolve'
import { readRuns } from '../agent/store'
import { loadLedger } from '../agent/usage'
import { USAGE } from '../paths'
import type { UsageResult, UsageRow } from './types'

export function readUsageView(span: number): UsageResult {
  let ledger
  try {
    ledger = loadLedger(readRuns)
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Could not read ${USAGE} — ${why}` }
  }
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (Math.max(1, Math.floor(span) || 30) - 1))

  const rows = new Map<string, UsageRow>()
  let any = false
  for (const e of ledger.entries) {
    if (e.at < start.getTime()) continue
    any = true
    const key = `${e.harness ?? ''}\u0000${e.model ?? ''}`
    let row = rows.get(key)
    if (!row) {
      row = {
        harness: e.harness,
        connector: e.harness ? harnessLabel(e.harness) : undefined,
        model: e.harness ? e.model : undefined,
        runs: 0,
        turns: 0,
        tokens: { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 },
        costUsd: 0,
        unpriced: 0,
      }
      rows.set(key, row)
    }
    if (e.kind === 'run') row.runs++
    else row.turns++
    if (e.usage) for (const k of ['input', 'cacheCreation', 'cacheRead', 'output'] as const) row.tokens[k] += e.usage[k]
    if (e.costUsd === undefined) row.unpriced++
    else row.costUsd += e.costUsd
  }

  const total = (r: UsageRow) => r.tokens.input + r.tokens.cacheCreation + r.tokens.cacheRead + r.tokens.output
  const priced = [...rows.values()]
    .filter((r) => r.unpriced < r.runs + r.turns)
    .sort((a, b) => b.costUsd - a.costUsd || total(b) - total(a))
  return {
    ok: true,
    view: {
      since: ledger.since,
      rows: priced,
      totalUsd: priced.reduce((n, r) => n + r.costUsd, 0),
      empty: !any,
    },
  }
}
