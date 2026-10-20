#!/usr/bin/env node
// Stand-in for `codex exec --json`: no account, no model. Each call is one turn of a thread.
// Like real Codex, `turn.completed.usage` is the THREAD's running total, and the rollout under
// $CODEX_HOME/sessions (default ~/.codex) gets a token_count and task_complete per turn.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

// What each turn spends on its own, in Codex's fields (input_tokens includes the cached part).
const TURNS = [
  { input_tokens: 100000, cached_input_tokens: 0, output_tokens: 2000 },
  { input_tokens: 120000, cached_input_tokens: 90000, output_tokens: 3000 },
  { input_tokens: 150000, cached_input_tokens: 120000, output_tokens: 1000 },
]

const argv = process.argv.slice(2)
if (argv[0] === '--version') { console.log('codex-cli 0.0.0-stand-in'); process.exit(0) }
const at = argv.indexOf('resume')
const resumed = at >= 0
const thread = resumed ? argv[at + 1] : `${Date.now().toString(16).padStart(12, '0').slice(0, 8)}-${randomUUID().slice(9)}`
const root = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'sessions')

function rolloutOf(id) {
  if (!existsSync(root)) return undefined
  for (const y of readdirSync(root)) for (const m of readdirSync(join(root, y))) for (const d of readdirSync(join(root, y, m))) {
    const hit = readdirSync(join(root, y, m, d)).find((n) => n.endsWith(`-${id}.jsonl`))
    if (hit) return join(root, y, m, d, hit)
  }
}
let file = rolloutOf(thread)
if (!file) {
  const now = new Date(), p = (n) => String(n).padStart(2, '0')
  const dir = join(root, String(now.getFullYear()), p(now.getMonth() + 1), p(now.getDate()))
  mkdirSync(dir, { recursive: true })
  file = join(dir, `rollout-${now.toISOString().slice(0, 19).replace(/:/g, '-')}-${thread}.jsonl`)
  appendFileSync(file, JSON.stringify({ type: 'session_meta', payload: { id: thread, model_provider: 'openai' } }) + '\n')
}
const done = readFileSync(file, 'utf8').split('\n').filter((l) => l.includes('"task_complete"')).length
const own = TURNS[Math.min(done, TURNS.length - 1)]
const total = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 }
for (let i = 0; i <= done; i++) for (const k in total) total[k] += TURNS[Math.min(i, TURNS.length - 1)][k]
const w = (o) => appendFileSync(file, JSON.stringify(o) + '\n')
w({ type: 'turn_context', payload: { model: 'gpt-5.5' } })
w({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: total, last_token_usage: own, model_context_window: 400000 } } })
w({ type: 'event_msg', payload: { type: 'task_complete' } })

const say = (o) => process.stdout.write(JSON.stringify(o) + '\n')
say({ type: 'thread.started', thread_id: thread })
say({ type: 'turn.started' })
say({ type: 'item.completed', item: { id: 'i0', type: 'agent_message', text: `Stand-in reply ${done + 1}.` } })
say({ type: 'turn.completed', usage: total })
