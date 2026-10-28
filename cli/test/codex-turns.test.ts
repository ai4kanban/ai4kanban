// Codex's `turn.completed` carries the thread's running total (#1888). A turn that resumes or
// forks a thread is billed only its own share, read off the rollout.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { priceUsd } from '../src/lib/agent/prices.ts'
import { createCodexStreamRenderer } from '../src/lib/agent/wire/codex-stream.ts'
import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState } from './helpers/board.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-codex-turns-'))
const home = path.join(root, 'codex')
const THREAD = '01a157f9-955e-7be0-87cd-8a8b7de94b77'
const FORK = '01a15820-eef1-70d3-a866-159dcff781b1'
const MODEL = 'gpt-6.1-sol'

beforeEach(() => {
  forgetMachineState(root)
  fs.rmSync(home, { recursive: true, force: true })
  fs.mkdirSync(path.join(root, 'docs', 'kanban'), { recursive: true })
  setBoardRoot(root)
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  process.env.CODEX_HOME = home
})

after(() => {
  delete process.env.CODEX_HOME
  fs.rmSync(root, { recursive: true, force: true })
})

// Codex's raw counts: `input` is the whole prompt, `cached` the part of it read from cache.
type Raw = { input: number; cached: number; output: number }
const raw = (r: Raw) => ({ input_tokens: r.input, cached_input_tokens: r.cached, cache_write_input_tokens: 0, output_tokens: r.output, reasoning_output_tokens: 0, total_tokens: r.input + r.output })
const board = (r: Raw) => ({ input: r.input - r.cached, cacheCreation: 0, cacheRead: r.cached, output: r.output })

// The figures of #1865's card chat: two turns' closing totals.
const T4: Raw = { input: 4051855, cached: 3884544, output: 25496 }
const T5: Raw = { input: 5671369, cached: 5438720, output: 33421 }
const OWN5 = { input: 65338, cacheCreation: 0, cacheRead: 1554176, output: 7925 }

// A rollout cut down to the lines the board reads. Each turn is its requests' running totals;
// `from` is the total the thread's first request was added to (a fork's parent).
function writeRollout(id: string, turns: Raw[][], from: Raw = { input: 0, cached: 0, output: 0 }, forkedFrom?: string): void {
  const day = new Date(parseInt(id.replace(/-/g, '').slice(0, 12), 16))
  const pad = (n: number) => String(n).padStart(2, '0')
  const dir = path.join(home, 'sessions', String(day.getFullYear()), pad(day.getMonth() + 1), pad(day.getDate()))
  fs.mkdirSync(dir, { recursive: true })
  const lines = [{ type: 'session_meta', payload: { id, forked_from_id: forkedFrom ?? null, source: 'exec', model_provider: 'openai' } }]
  let prev = from
  for (const requests of turns) {
    lines.push({ type: 'event_msg', payload: { type: 'task_started' } } as never)
    lines.push({ type: 'turn_context', payload: { model: MODEL } } as never)
    for (const total of requests) {
      const last = { input: total.input - prev.input, cached: total.cached - prev.cached, output: total.output - prev.output }
      lines.push({ type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: raw(total), last_token_usage: raw(last), model_context_window: 475000 } } } as never)
      prev = total
    }
    lines.push({ type: 'event_msg', payload: { type: 'task_complete', last_agent_message: 'ok' } } as never)
  }
  fs.writeFileSync(path.join(dir, `rollout-2026-10-20T14-22-20-${id}.jsonl`), lines.map((l) => JSON.stringify(l)).join('\n') + '\n')
}

// One `codex exec [resume] --json` process: its stream ends on the thread's running total.
function turn(id: string, total: Raw, carried: boolean) {
  const renderer = createCodexStreamRenderer(carried)
  renderer.push([
    JSON.stringify({ type: 'thread.started', thread_id: id }),
    JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'ok' } }),
    JSON.stringify({ type: 'turn.completed', usage: raw(total) }),
  ].join('\n') + '\n')
  renderer.flush()
  return { usage: renderer.usage?.(), costUsd: renderer.costUsd?.() }
}

const MID4: Raw = { input: 3878560, cached: 3713792, output: 25148 }
const MID5: Raw = { input: 5459152, cached: 5227648, output: 33282 }
const T1: Raw = { input: 289884, cached: 260352, output: 1531 }

describe('a turn is billed its own share', () => {
  it('a resumed turn reports what it added, not the thread total', () => {
    writeRollout(THREAD, [[T1], [MID4, T4], [MID5, T5]])
    const r = turn(THREAD, T5, true)
    assert.deepEqual(r.usage, OWN5)
    assert.equal(r.costUsd, priceUsd('openai', MODEL, OWN5))
    assert.ok(Math.abs(r.costUsd! - 0.3653436) < 1e-9)
  })

  it('a new thread reports its first turn as is', () => {
    writeRollout(THREAD, [[T1]])
    assert.deepEqual(turn(THREAD, T1, false).usage, board(T1))
  })

  it('a fork subtracts the total it inherited from its parent', () => {
    const forked: Raw = { input: 4200000, cached: 4000000, output: 26000 }
    writeRollout(FORK, [[forked]], T4, THREAD)
    assert.deepEqual(turn(FORK, forked, true).usage, {
      input: forked.input - forked.cached - (T4.input - T4.cached),
      cacheCreation: 0,
      cacheRead: forked.cached - T4.cached,
      output: forked.output - T4.output,
    })
  })

  it('reports nothing for a carried turn with no rollout, never the total', () => {
    const r = turn(THREAD, T5, true)
    assert.equal(r.usage, undefined)
    assert.equal(r.costUsd, undefined)
  })

  it('the turns sum to the thread total', () => {
    writeRollout(THREAD, [[T1], [MID4, T4], [MID5, T5]])
    const sum = [turn(THREAD, T1, false), turn(THREAD, T4, true), turn(THREAD, T5, true)]
      .reduce((a, r) => a + r.costUsd!, 0)
    assert.ok(Math.abs(sum - priceUsd('openai', MODEL, board(T5))!) < 1e-9)
  })
})
