// What Codex writes down about a run that its event stream leaves out.
//
// `codex exec --json` never names the model — see the note at the top of codex-stream.ts —
// but Codex keeps a rollout of every session on disk, and the file's name ends in the thread
// id the run's FIRST event already handed us. That file names the model and the provider
// that served it, which is a model in the runs panel and, for a provider whose rates are
// published, a price (agent/prices.ts). It also keeps the counts behind the context ring
// (#675), which the event stream leaves out for the same reason.
//
// Read, never written: this is Codex's own bookkeeping and the board is a guest in it. Every
// failure here is silent and means "not known" — a rollout a user turned off with
// `--ephemeral`, a Codex that moved its folder, a file still being written. None of those is
// worth a line in a run's log, and all of them already have an answer: the panel shows a
// blank, the way it does today.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { ContextWindow, TokenUsage } from '../types'

/** One finished turn of a thread: the thread's running total as it ended, and what the turn
 *  itself added to it — absent when it added nothing. */
export interface CodexTurn {
  total: TokenUsage
  own?: TokenUsage
  model?: string
}

export interface CodexRunFacts {
  /** The model id Codex ran the turn on, e.g. `gpt-5.6-sol`. */
  model?: string
  /** Who served it, e.g. `openai`. A model id only means a price next to this. */
  provider?: string
  /** How full the window was as of the last request that came back (#675). Codex is the one
   *  connector that answers both halves itself — but only here: `codex exec --json` renders
   *  a handful of thread events and none of them carries a count, while the rollout beside
   *  them keeps every `token_count` the session ever emitted. */
  context?: ContextWindow
  /** Every turn the rollout saw finish, oldest first. */
  turns?: CodexTurn[]
}

type Entry = { type?: unknown; payload?: Record<string, unknown> }

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

// Codex's counts in the board's four buckets. Its `input_tokens` is the WHOLE prompt, cached
// part included, where the board's is only the fresh part, so the cached tokens come back out;
// `reasoning_output_tokens` is already inside `output_tokens`. All-zero reads as "nothing".
export function codexUsage(raw: unknown): TokenUsage | undefined {
  const u = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const cacheCreation = n(u.cache_write_input_tokens)
  const cacheRead = n(u.cached_input_tokens)
  const usage: TokenUsage = {
    input: Math.max(0, n(u.input_tokens) - cacheCreation - cacheRead),
    cacheCreation,
    cacheRead,
    output: n(u.output_tokens),
  }
  return usage.input + usage.cacheCreation + usage.cacheRead + usage.output > 0 ? usage : undefined
}

export const sameUsage = (a: TokenUsage, b: TokenUsage): boolean =>
  a.input === b.input && a.cacheCreation === b.cacheCreation && a.cacheRead === b.cacheRead && a.output === b.output

const ZERO: TokenUsage = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 }

const minus = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  input: a.input - b.input,
  cacheCreation: a.cacheCreation - b.cacheCreation,
  cacheRead: a.cacheRead - b.cacheRead,
  output: a.output - b.output,
})

// How full the window is, off one `token_count` event. `last_token_usage.input_tokens` is
// the WHOLE prompt of the request that just came back, cached part included — which is what
// the model is holding — and `model_context_window` is the window it went into, as Codex
// really runs it rather than as a catalogue lists it. A window of zero is Codex saying it
// doesn't know one.
function contextIn(raw: unknown): ContextWindow | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const info = raw as Record<string, unknown>
  const last = info.last_token_usage
  const used = count(last && typeof last === 'object' ? (last as Record<string, unknown>).input_tokens : undefined)
  if (!used) return undefined
  return { used, limit: count(info.model_context_window) }
}

// Sessions are filed under the LOCAL date they started, so a run that straddles midnight —
// or a machine whose clock disagrees with Codex's by a few hours — lands in a neighbouring
// folder. A resumed thread may have started days ago: its id is a UUIDv7, whose first 48 bits
// are the moment it was minted.
function dayDir(root: string, at: number): string {
  const day = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return join(root, String(day.getFullYear()), pad(day.getMonth() + 1), pad(day.getDate()))
}

// The newest rollout whose name ends in this thread id. Newest matters because a resumed
// run reports the thread it continued: if Codex ever files that continuation separately, the
// answer wanted is the one the run just wrote.
function findRollout(threadId: string): string | undefined {
  const home = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
  const root = join(home, 'sessions')
  const tail = `-${threadId}.jsonl`
  const minted = parseInt(threadId.replace(/-/g, '').slice(0, 12), 16)
  const days = new Set<string>()
  for (const at of [Date.now(), ...(Number.isFinite(minted) && minted > 0 ? [minted] : [])]) {
    for (const shift of [0, -1, 1]) days.add(dayDir(root, at + shift * 86_400_000))
  }
  let newest: { path: string; at: number } | undefined
  for (const dir of days) {
    let names: string[]
    try {
      names = readdirSync(dir)
    } catch {
      continue
    }
    for (const name of names) {
      if (!name.startsWith('rollout-') || !name.endsWith(tail)) continue
      const path = join(dir, name)
      try {
        const at = statSync(path).mtimeMs
        if (!newest || at > newest.at) newest = { path, at }
      } catch {
        // Gone between the listing and the stat. Nothing to read.
      }
    }
  }
  return newest?.path
}

/** The model and provider behind a Codex thread, or nothing when its rollout can't be read.
 *  Safe to call while the run is still going: the model lands seconds into a turn, and a
 *  read that comes too early simply finds nothing yet. */
export function readCodexRunFacts(threadId: string): CodexRunFacts | undefined {
  const path = findRollout(threadId)
  if (!path) return undefined
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return undefined
  }
  const facts: CodexRunFacts = {}
  // `turn.completed` carries the THREAD's running total, and so does every `token_count`: a
  // turn's own share is its closing total less the total the turn before closed on. A thread's
  // first turn starts from the total its first request was added to — zero for a new thread,
  // the parent's for a fork, whose rollout holds none of the parent's turns.
  const turns: CodexTurn[] = []
  let total: TokenUsage | undefined
  let before: TokenUsage | undefined
  for (const line of raw.split('\n')) {
    // A rollout is mostly the conversation itself. Only a few kinds of line carry an answer,
    // so the rest is skipped without parsing it.
    if (
      !line.includes('"session_meta"') &&
      !line.includes('"turn_context"') &&
      !line.includes('"token_count"') &&
      !line.includes('"task_complete"')
    ) continue
    let entry: Entry
    try {
      const parsed: unknown = JSON.parse(line)
      if (!parsed || typeof parsed !== 'object') continue
      entry = parsed as Entry
    } catch {
      // A half-written last line, on a session still going.
      continue
    }
    const payload = entry.payload
    if (!payload) continue
    // The provider is settled when the session opens and can't change under it.
    if (entry.type === 'session_meta') facts.provider ??= text(payload.model_provider)
    // The model is per turn, and last turn wins — the same rule the token counts follow.
    if (entry.type === 'turn_context') facts.model = text(payload.model) ?? facts.model
    // One reading per request that came back, and the last one is what the model holds now
    // — a compaction takes it down rather than adding to it.
    if (payload.type === 'token_count') {
      facts.context = contextIn(payload.info) ?? facts.context
      const info = payload.info && typeof payload.info === 'object' ? (payload.info as Record<string, unknown>) : {}
      const now = codexUsage(info.total_token_usage)
      if (now) {
        before ??= minus(now, codexUsage(info.last_token_usage) ?? ZERO)
        total = now
      }
    }
    if (payload.type === 'task_complete' && total && before) {
      const own = minus(total, before)
      const spent = Object.values(own).some((n) => n > 0)
      if (Object.values(own).every((n) => n >= 0)) turns.push({ total, ...(spent ? { own } : {}), model: facts.model })
      before = total
    }
  }
  if (turns.length) facts.turns = turns
  return facts.model || facts.provider || facts.context ? facts : undefined
}
