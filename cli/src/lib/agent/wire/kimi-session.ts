// What Kimi writes down about a run that its print stream leaves out.
//
// `kimi -p --output-format stream-json` prints assistant text, tool calls and retry notices
// — nothing about the model, and nothing about tokens. Kimi keeps a full record of every
// session on disk instead, so the missing numbers are read from there, the way
// codex-session.ts reads Codex's rollouts.
//
// Two things are looked up, and they come from different files:
//
//   session_index.jsonl   one line per session — `{sessionId, sessionDir, workDir}`, or
//                         `{sessionId, deleted:true}` for one that was removed. This is
//                         what turns an id into a folder, and a folder into an id.
//   <session>/agents/*/   one `wire.jsonl` per agent, the main one and every subagent it
//                         spawned. Its `usage.record` lines carry the model and the token
//                         counts, one per model call.
//
// Read, never written: this is Kimi's own bookkeeping and the board is a guest in it. Every
// failure here is silent and means "not known" — a KIMI_CODE_HOME the run didn't use, a
// Kimi that moved its layout, a file still being written. None is worth a line in a run's
// log, and all of them already have an answer: the panel shows a blank.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { num, obj, str } from './json'
import type { TokenUsage } from '../types'

export interface KimiRunFacts {
  /** The model id Kimi ran the turn on, e.g. `kimi-k2-thinking`. */
  model?: string
  /** Everything the session's agents spent, summed. */
  usage?: TokenUsage
}

interface IndexEntry {
  sessionId: string
  sessionDir: string
  workDir: string
}

function home(): string {
  return process.env.KIMI_CODE_HOME?.trim() || join(homedir(), '.kimi-code')
}

// The index is append-only and a deletion is a line of its own, so it is replayed in order
// rather than filtered: the last word on a session id wins.
function readIndex(): Map<string, IndexEntry> {
  const entries = new Map<string, IndexEntry>()
  let raw: string
  try {
    raw = readFileSync(join(home(), 'session_index.jsonl'), 'utf8')
  } catch {
    return entries
  }
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue
    let record: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(line)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
      record = parsed as Record<string, unknown>
    } catch {
      // A half-written last line, on an index another kimi is appending to.
      continue
    }
    const sessionId = str(record.sessionId).trim()
    if (!sessionId) continue
    if (record.deleted === true) {
      entries.delete(sessionId)
      continue
    }
    const sessionDir = str(record.sessionDir).trim()
    const workDir = str(record.workDir).trim()
    if (sessionDir && workDir) entries.set(sessionId, { sessionId, sessionDir, workDir })
  }
  return entries
}

/** The newest session Kimi opened in `cwd` since `since`, or nothing.
 *
 *  Only for a run whose stream never named its session: `kimi -p` prints the id as its
 *  closing line, so a run that finished at all has already said it, and one that died
 *  before then is what this is for. `since` is what keeps the answer honest — without it
 *  the newest session in a folder is as likely to be the PREVIOUS run's, and offering
 *  Resume on that would pick up a conversation about different work. */
export function findKimiSession(cwd: string, since: number): string | undefined {
  const want = resolve(cwd)
  let newest: { id: string; at: number } | undefined
  for (const entry of readIndex().values()) {
    if (resolve(entry.workDir) !== want) continue
    let at: number
    try {
      at = statSync(entry.sessionDir).mtimeMs
    } catch {
      // Gone between the index line and the stat. Nothing to read.
      continue
    }
    if (at < since) continue
    if (!newest || at > newest.at) newest = { id: entry.sessionId, at }
  }
  return newest?.id
}

// Every agent's record in one session: the main one, plus a `wire.jsonl` for each subagent
// it spawned. All of them are read, because what a run spent includes what it handed out —
// and `main` is read FIRST, because the model a run is shown as is the main agent's.
function wireFiles(sessionDir: string): string[] {
  const agents = join(sessionDir, 'agents')
  let names: string[]
  try {
    names = readdirSync(agents)
  } catch {
    // A layout this build doesn't know. The session's own file is the fallback.
    return [join(sessionDir, 'wire.jsonl')]
  }
  const ordered = names.sort((a, b) => Number(b === 'main') - Number(a === 'main'))
  return ordered.map((name) => join(agents, name, 'wire.jsonl'))
}

/** The model and token counts behind a Kimi session, or nothing when its record can't be
 *  read. Safe to call while the run is still going: `usage.record` lines land as each model
 *  call returns, and a read that comes too early simply finds fewer of them. */
export function readKimiRunFacts(sessionId: string): KimiRunFacts | undefined {
  const entry = readIndex().get(sessionId)
  if (!entry) return undefined
  const total: TokenUsage = { input: 0, cacheCreation: 0, cacheRead: 0, output: 0 }
  let model: string | undefined
  for (const path of wireFiles(entry.sessionDir)) {
    let raw: string
    try {
      raw = readFileSync(path, 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split('\n')) {
      // A wire is mostly the conversation itself. One kind of line carries both answers, so
      // the rest is skipped without parsing it.
      if (!line.includes('"usage.record"')) continue
      let record: Record<string, unknown>
      try {
        const parsed: unknown = JSON.parse(line)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
        record = parsed as Record<string, unknown>
      } catch {
        continue
      }
      if (record.type !== 'usage.record') continue
      // The model a run is shown as is the one it started on, so the first record wins —
      // work handed to a subagent on a smaller model is still one run by one model.
      model ??= str(record.model).trim() || undefined
      const usage = obj(record.usage)
      total.input += num(usage.inputOther)
      total.cacheCreation += num(usage.inputCacheCreation)
      total.cacheRead += num(usage.inputCacheRead)
      total.output += num(usage.output)
    }
  }
  const spent = total.input + total.cacheCreation + total.cacheRead + total.output
  if (!model && !spent) return undefined
  return { model, usage: spent ? total : undefined }
}
