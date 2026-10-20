// Before #1888 a Codex reply or run that carried a thread on recorded the thread's running
// total as its own. Rewritten once, and only where the thread's rollout still proves it: a
// recorded count equal to exactly one turn's closing total becomes that turn's own share,
// repriced. Anything else is left as it is.

import fs from 'node:fs'
import path from 'node:path'

import { CHATS_DIR, USAGE } from '../paths'
import { asUsage } from './log'
import { priceUsd } from './prices'
import { withStore } from './store'
import type { TokenUsage } from './types'
import { readLedger, writeLedger } from './usage'
import { readCodexRunFacts, sameUsage, type CodexRunFacts } from './wire/codex-session'

const doneMark = (): string => path.join(path.dirname(USAGE), 'codex-turns-fixed')

interface Fixed {
  usage?: TokenUsage
  costUsd?: number
}

/** The turn's own share for a recorded count, or null when the thread's rollout can't prove
 *  the count was a running total. */
function ownShare(facts: CodexRunFacts | undefined, usage: TokenUsage, model?: string): Fixed | null {
  const turns = facts?.turns?.filter((t) => sameUsage(t.total, usage)) ?? []
  if (turns.length !== 1) return null
  const turn = turns[0]!
  if (turn.own && sameUsage(turn.own, usage)) return null
  return { usage: turn.own, costUsd: priceUsd(facts?.provider, turn.model ?? model, turn.own) }
}

function apply(into: { usage?: unknown; costUsd?: unknown }, fixed: Fixed): void {
  if (fixed.usage) into.usage = fixed.usage
  else delete into.usage
  if (fixed.costUsd !== undefined) into.costUsd = fixed.costUsd
  else delete into.costUsd
}

/** Run once per board; safe to run again. Returns how many records changed. */
export function fixCodexHistory(): number {
  if (fs.existsSync(doneMark())) return 0
  const facts = new Map<string, CodexRunFacts | undefined>()
  const factsOf = (id: string) => {
    if (!facts.has(id)) facts.set(id, readCodexRunFacts(id))
    return facts.get(id)
  }
  const ledgerFixes = new Map<string, Fixed>()
  withStore((store) => {
    for (const run of store.runs) {
      const usage = asUsage(run.usage)
      if (run.harness !== 'codex' || !run.resumeId || !usage || run.status === 'running') continue
      const fixed = ownShare(factsOf(run.resumeId), usage, run.model)
      if (!fixed) continue
      apply(run, fixed)
      ledgerFixes.set(`run:${run.sessionId}`, fixed)
    }

    let names: string[] = []
    try {
      names = fs.readdirSync(CHATS_DIR).filter((n) => n.endsWith('.json'))
    } catch {
      // No conversations yet.
    }
    for (const name of names) {
      const file = path.join(CHATS_DIR, name)
      let chat: { harness?: unknown; resumeId?: unknown; messages?: Record<string, unknown>[] }
      try {
        chat = JSON.parse(fs.readFileSync(file, 'utf8'))
      } catch {
        continue
      }
      if (typeof chat?.resumeId !== 'string' || !Array.isArray(chat.messages)) continue
      let changed = false
      for (const m of chat.messages) {
        const usage = asUsage(m?.usage)
        if (m?.role !== 'agent' || !usage || (m.harness ?? chat.harness) !== 'codex') continue
        const fixed = ownShare(factsOf(chat.resumeId), usage, typeof m.model === 'string' ? m.model : undefined)
        if (!fixed) continue
        apply(m, fixed)
        changed = true
        if (typeof m.at === 'number') ledgerFixes.set(`chat:${name.slice(0, -5)}:${m.at}`, fixed)
      }
      if (!changed) continue
      const tmp = `${file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(chat, null, 2) + '\n')
      fs.renameSync(tmp, file)
    }

    // Written once per key, so a fixed entry is rewritten in place.
    const ledger = ledgerFixes.size ? readLedger() : null
    if (ledger) {
      for (const e of ledger.entries) {
        const fixed = ledgerFixes.get(e.key)
        if (fixed) {
          e.usage = fixed.usage
          e.costUsd = fixed.costUsd
        }
      }
      writeLedger(ledger)
    }
  })
  fs.mkdirSync(path.dirname(doneMark()), { recursive: true })
  fs.writeFileSync(doneMark(), '')
  return ledgerFixes.size
}

/** For a screen about to show past costs: a fix that fails is tried again next time. */
export function fixCodexHistoryQuietly(): void {
  try {
    fixCodexHistory()
  } catch {
    // The records stay as they were.
  }
}
