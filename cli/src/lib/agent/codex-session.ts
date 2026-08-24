// What Codex writes down about a run that its event stream leaves out.
//
// `codex exec --json` never names the model — see the note at the top of codex-stream.ts —
// but Codex keeps a rollout of every session on disk, and the file's name ends in the thread
// id the run's FIRST event already handed us. That file names the model and the provider
// that served it, which is a model in the runs panel and, for a provider whose rates are
// published, a price (agent/prices.ts).
//
// Read, never written: this is Codex's own bookkeeping and the board is a guest in it. Every
// failure here is silent and means "not known" — a rollout a user turned off with
// `--ephemeral`, a Codex that moved its folder, a file still being written. None of those is
// worth a line in a run's log, and all of them already have an answer: the panel shows a
// blank, the way it does today.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface CodexRunFacts {
  /** The model id Codex ran the turn on, e.g. `gpt-5.6-sol`. */
  model?: string
  /** Who served it, e.g. `openai`. A model id only means a price next to this. */
  provider?: string
}

type Entry = { type?: unknown; payload?: Record<string, unknown> }

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

// Sessions are filed under the LOCAL date they started, so a run that straddles midnight —
// or a machine whose clock disagrees with Codex's by a few hours — lands in a neighbouring
// folder. Three days is the whole of it, and each is one readdir.
function dayDir(root: string, shiftDays: number): string {
  const day = new Date(Date.now() + shiftDays * 86_400_000)
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
  let newest: { path: string; at: number } | undefined
  for (const shift of [0, -1, 1]) {
    let names: string[]
    try {
      names = readdirSync(dayDir(root, shift))
    } catch {
      continue
    }
    for (const name of names) {
      if (!name.startsWith('rollout-') || !name.endsWith(tail)) continue
      const path = join(dayDir(root, shift), name)
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
  for (const line of raw.split('\n')) {
    // A rollout is mostly the conversation itself. Only two kinds of line carry an answer,
    // so the rest is skipped without parsing it.
    if (!line.includes('"session_meta"') && !line.includes('"turn_context"')) continue
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
  }
  return facts.model || facts.provider ? facts : undefined
}
