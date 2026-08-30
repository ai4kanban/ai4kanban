// What a Codex run reports back. The stream gives tokens and a thread id; the model and the
// price come from beside it, which is the part worth pinning: a rollout Codex wrote, found
// by the thread id, priced only when the board knows the rates.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { createCodexStreamRenderer } from '../src/lib/agent/wire/codex-stream.ts'
import { priceUsd } from '../src/lib/agent/prices.ts'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-codex-'))
const THREAD = '01a02f69-b49e-7f72-a3de-b74e9cfd7b83'

beforeEach(() => {
  fs.rmSync(path.join(home, 'sessions'), { recursive: true, force: true })
  process.env.CODEX_HOME = home
})

after(() => {
  delete process.env.CODEX_HOME
  fs.rmSync(home, { recursive: true, force: true })
})

// A rollout as Codex writes one, cut down to the two lines the board reads.
function writeRollout(threadId: string, model: string, provider = 'openai'): void {
  const day = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dir = path.join(home, 'sessions', String(day.getFullYear()), pad(day.getMonth() + 1), pad(day.getDate()))
  fs.mkdirSync(dir, { recursive: true })
  const lines = [
    JSON.stringify({ type: 'session_meta', payload: { id: threadId, source: 'exec', model_provider: provider } }),
    JSON.stringify({ type: 'event_msg', payload: { type: 'agent_message', message: 'pong' } }),
    JSON.stringify({ type: 'turn_context', payload: { model, effort: 'high' } }),
  ]
  fs.writeFileSync(path.join(dir, `rollout-2026-08-24T00-17-31-${threadId}.jsonl`), lines.join('\n') + '\n')
}

// The four events a short `codex exec --json` run prints, in order.
const STREAM = [
  JSON.stringify({ type: 'thread.started', thread_id: THREAD }),
  JSON.stringify({ type: 'turn.started' }),
  JSON.stringify({ type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: 'pong' } }),
  JSON.stringify({
    type: 'turn.completed',
    usage: {
      input_tokens: 17183,
      cached_input_tokens: 11008,
      cache_write_input_tokens: 0,
      output_tokens: 5,
      reasoning_output_tokens: 0,
    },
  }),
].join('\n')

function run(stream = STREAM) {
  const renderer = createCodexStreamRenderer()
  const tail = renderer.push(stream) + renderer.flush()
  return { renderer, tail }
}

describe('what the stream itself says', () => {
  it('takes the thread id off the first event, to resume by', () => {
    const { renderer } = run()
    assert.equal(renderer.resumeId?.(), THREAD)
  })

  it('leads with what the agent said', () => {
    const { renderer, tail } = run()
    assert.equal(renderer.result(), 'pong')
    assert.match(tail, /pong/)
  })

  it('counts a cached prompt once, not twice', () => {
    // Codex's `input_tokens` is the whole prompt; the board's four buckets are added up, so
    // the cached part belongs to cacheRead alone.
    assert.deepEqual(run().renderer.usage?.(), {
      input: 17183 - 11008,
      cacheCreation: 0,
      cacheRead: 11008,
      output: 5,
    })
  })

  it('reports no tokens when the turn counted none', () => {
    const quiet = JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 0, output_tokens: 0 } })
    assert.equal(run(quiet).renderer.usage?.(), undefined)
  })
})

describe('what the rollout beside it says', () => {
  it('names the model the run used', () => {
    writeRollout(THREAD, 'gpt-5.6-sol')
    assert.equal(run().renderer.model?.(), 'gpt-5.6-sol')
  })

  it('prices the run at the model list rate', () => {
    writeRollout(THREAD, 'gpt-5.6-sol')
    const { renderer } = run()
    const expected = ((17183 - 11008) * 4 + 11008 * 0.4 + 5 * 20) / 1_000_000
    assert.equal(renderer.costUsd?.(), expected)
  })

  it('shows nothing at all when there is no rollout to read', () => {
    const { renderer } = run()
    assert.equal(renderer.model?.(), undefined)
    assert.equal(renderer.costUsd?.(), undefined)
  })

  it('names a model it cannot price, and prices nothing', () => {
    writeRollout(THREAD, 'qwen3-coder:30b', 'ollama')
    const { renderer } = run()
    assert.equal(renderer.model?.(), 'qwen3-coder:30b')
    assert.equal(renderer.costUsd?.(), undefined)
  })
})

describe('list rates', () => {
  const usage = { input: 1_000_000, cacheCreation: 0, cacheRead: 0, output: 0 }

  it('prices a model pinned to a snapshot as the model', () => {
    assert.equal(priceUsd('openai', 'gpt-5.6-sol-2026-07-09', usage), 4)
  })

  it('prices a model written provider-first as the model', () => {
    assert.equal(priceUsd('openai', 'openai/gpt-5.6-sol', usage), 4)
  })

  it('refuses a model it does not know, whoever served it', () => {
    assert.equal(priceUsd('openai', 'gpt-9-imaginary', usage), undefined)
    assert.equal(priceUsd('acme-gateway', 'gpt-5.6-sol', usage), undefined)
    assert.equal(priceUsd('openai', undefined, usage), undefined)
    assert.equal(priceUsd('openai', 'gpt-5.6-sol', undefined), undefined)
  })
})
