// usage.json in this board's own folder on the machine — what every run and chat reply
// consumed over the last year. The run record keeps only its newest runs and a resume drops
// the run it took over, so totals over weeks are read from here instead.
//
// One entry per finished run and per reply, written once. Every write holds the run
// record's lock: the run half is written from inside `withStore`, which already holds it.

import fs from 'node:fs'
import path from 'node:path'

import { withLock } from '../lock'
import { CHATS_DIR, SESSIONS_LOCK, USAGE } from '../paths'
import { asUsage } from './log'
import type { RunRecord, TokenUsage } from './types'

const KEEP_MS = 366 * 24 * 60 * 60 * 1000

export interface UsageEntry {
  /** `run:<sessionId>` or `chat:<conversation>:<reply time>` — what makes a write idempotent. */
  key: string
  kind: 'run' | 'chat'
  at: number
  /** Absent on an old reply whose conversation is gone. */
  harness?: string
  model?: string
  usage?: TokenUsage
  costUsd?: number
}

export interface UsageLedger {
  /** The earliest moment the ledger speaks for: its oldest imported entry, or its creation. */
  since: number
  entries: UsageEntry[]
}

export function readLedger(): UsageLedger | null {
  let text: string
  try {
    text = fs.readFileSync(USAGE, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
  const raw = JSON.parse(text) as Partial<UsageLedger>
  if (typeof raw?.since !== 'number' || !Array.isArray(raw.entries)) throw new Error(`${USAGE} is not a usage ledger.`)
  return { since: raw.since, entries: raw.entries.map(asEntry).filter((e): e is UsageEntry => !!e) }
}

function asEntry(v: unknown): UsageEntry | null {
  const o = v as Partial<UsageEntry>
  if (!o || typeof o.key !== 'string' || typeof o.at !== 'number') return null
  return {
    key: o.key,
    kind: o.kind === 'chat' ? 'chat' : 'run',
    at: o.at,
    harness: typeof o.harness === 'string' && o.harness ? o.harness : undefined,
    model: typeof o.model === 'string' && o.model ? o.model : undefined,
    usage: asUsage(o.usage),
    costUsd: typeof o.costUsd === 'number' && o.costUsd > 0 ? o.costUsd : undefined,
  }
}

function writeLedger(ledger: UsageLedger): void {
  fs.mkdirSync(path.dirname(USAGE), { recursive: true })
  const tmp = `${USAGE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(ledger) + '\n')
  fs.renameSync(tmp, USAGE)
}

export const runEntry = (r: RunRecord): UsageEntry => ({
  key: `run:${r.sessionId}`,
  kind: 'run',
  at: r.endedAt ?? r.startedAt,
  harness: r.harness || undefined,
  model: r.model,
  usage: r.usage,
  costUsd: r.costUsd,
})

interface Conversation {
  harness?: unknown
  model?: unknown
  messages?: unknown
}

function readConversation(name: string): Conversation | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(CHATS_DIR, `${name}.json`), 'utf8')) as Conversation
  } catch {
    return null
  }
}

// A reply written before replies named their connector goes by its conversation's: a
// conversation keeps one connector once it opens a session, and its model is the latest one.
function nameAfter(e: UsageEntry, chat: Conversation | null): UsageEntry {
  if (e.harness || !chat || typeof chat.harness !== 'string' || !chat.harness) return e
  const model = e.model ?? (typeof chat.model === 'string' && chat.model ? chat.model : undefined)
  return { ...e, harness: chat.harness, model }
}

const conversationOf = (e: UsageEntry) => e.key.slice(5, e.key.lastIndexOf(':'))

/** Name the unnamed replies a ledger holds after their conversations, when those are still
 *  on disk. Returns whether any changed. */
function nameReplies(ledger: UsageLedger): boolean {
  const chats = new Map<string, Conversation | null>()
  let changed = false
  ledger.entries = ledger.entries.map((e) => {
    if (e.kind !== 'chat' || e.harness) return e
    const name = conversationOf(e)
    if (!chats.has(name)) chats.set(name, readConversation(name))
    const named = nameAfter(e, chats.get(name)!)
    if (named !== e) changed = true
    return named
  })
  return changed
}

// Replies already on disk.
function importedReplies(): UsageEntry[] {
  let names: string[]
  try {
    names = fs.readdirSync(CHATS_DIR).filter((n) => n.endsWith('.json'))
  } catch {
    return []
  }
  const out: UsageEntry[] = []
  for (const file of names) {
    const name = file.slice(0, -5)
    const chat = readConversation(name)
    if (!chat || !Array.isArray(chat.messages)) continue
    for (const m of chat.messages as (Partial<UsageEntry> & { role?: unknown })[]) {
      if (m?.role !== 'agent' || typeof m.at !== 'number' || !m.at) continue
      const { harness, model, usage, costUsd } = m
      const entry = asEntry({ key: `chat:${name}:${m.at}`, kind: 'chat', at: m.at, harness, model, usage, costUsd })
      if (entry) out.push(nameAfter(entry, chat))
    }
  }
  return out
}

/** Add entries, dropping any already written and any older than a year. The caller holds
 *  SESSIONS_LOCK. The first write imports what the record and the transcripts still hold;
 *  `runs` is the record as the caller has it. */
export function appendUsageLocked(add: UsageEntry[], runs: RunRecord[]): void {
  let ledger = readLedger()
  let incoming = add
  if (!ledger) {
    const imported = [...runs.filter((r) => r.status !== 'running').map(runEntry), ...importedReplies()]
    ledger = { since: Math.min(Date.now(), ...imported.map((e) => e.at)), entries: [] }
    incoming = [...imported, ...add]
  } else {
    nameReplies(ledger)
  }
  const seen = new Set(ledger.entries.map((e) => e.key))
  for (const e of incoming) {
    if (seen.has(e.key)) continue
    seen.add(e.key)
    ledger.entries.push(e)
  }
  const cutoff = Date.now() - KEEP_MS
  ledger.entries = ledger.entries.filter((e) => e.at >= cutoff).sort((a, b) => a.at - b.at)
  writeLedger(ledger)
}

/** One chat reply's usage, written as the reply lands. */
export function recordReplyUsage(entry: UsageEntry, runs: () => RunRecord[]): void {
  withLock(SESSIONS_LOCK, "writing this board's run list", () => appendUsageLocked([entry], runs()))
}

/** The ledger, made on the spot the first time anything asks, and rewritten when a reply it
 *  holds can now be named. */
export function loadLedger(runs: () => RunRecord[]): UsageLedger {
  const ledger = readLedger()
  if (ledger && !nameReplies(ledger)) return ledger
  return withLock(SESSIONS_LOCK, "writing this board's run list", () => {
    appendUsageLocked([], runs())
    return readLedger()!
  })
}
