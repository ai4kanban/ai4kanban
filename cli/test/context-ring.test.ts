// Where the context ring's two numbers come from (#675): what the model is holding, and the
// window it is held in.
//
// The reading is the LAST request's own prompt, never a running total — a connector that
// only counts what a turn spent has nothing to say here. The window is the connector's own
// where it names one, and the models.dev catalogue's where it doesn't, looked up against a
// model id each connector spells its own way.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'

import { contextLimit } from '../src/lib/agent/catalog.ts'
import { asContext } from '../src/lib/agent/log.ts'
import { createStreamRenderer } from '../src/lib/agent/wire/claude-stream.ts'
import { readCodexRunFacts } from '../src/lib/agent/wire/codex-session.ts'
import { createOpencodeStreamRenderer } from '../src/lib/agent/wire/opencode-stream.ts'

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-context-'))
const codexHome = path.join(home, 'codex')
const THREAD = '01a098af-8571-7060-b071-1d033d89d168'

before(() => {
  process.env.AI4KANBAN_HOME = home
  process.env.CODEX_HOME = codexHome
  // The catalogue as this build keeps it: boiled down to one number per model, so a lookup
  // is a key rather than a search.
  fs.writeFileSync(
    path.join(home, 'models-dev.json'),
    JSON.stringify({
      fetchedAt: Date.now(),
      limits: {
        'anthropic/claude-opus-4-5': 200_000,
        'moonshotai/kimi-k2-thinking': 262_144,
        'zai/glm-4.6': 204_800,
        'zai-coding-plan/glm-4.6': 128_000,
      },
    }),
  )
})

after(() => {
  delete process.env.AI4KANBAN_HOME
  delete process.env.CODEX_HOME
  fs.rmSync(home, { recursive: true, force: true })
})

// A rollout as Codex writes one, cut to the lines the board reads.
function writeRollout(events: Record<string, unknown>[]): void {
  const day = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dir = path.join(codexHome, 'sessions', String(day.getFullYear()), pad(day.getMonth() + 1), pad(day.getDate()))
  fs.mkdirSync(dir, { recursive: true })
  const lines = [
    JSON.stringify({ type: 'session_meta', payload: { id: THREAD, model_provider: 'openai' } }),
    JSON.stringify({ type: 'turn_context', payload: { model: 'gpt-6-astra' } }),
    ...events.map((ev) => JSON.stringify(ev)),
  ]
  fs.writeFileSync(path.join(dir, `rollout-2026-09-13T10-53-54-${THREAD}.jsonl`), lines.join('\n') + '\n')
}

const tokenCount = (used: number, window?: number) => ({
  type: 'event_msg',
  payload: {
    type: 'token_count',
    info: {
      total_token_usage: { input_tokens: used * 2 },
      last_token_usage: { input_tokens: used, cached_input_tokens: 0, output_tokens: 5 },
      ...(window === undefined ? {} : { model_context_window: window }),
    },
  },
})

describe('the window a model runs in', () => {
  it('looks a Claude Code build up without its date', () => {
    assert.equal(contextLimit('claude-code', 'claude-opus-4-5-20251101'), 200_000)
  })

  it('takes a `provider/model` id as the catalogue spells it', () => {
    // OpenCode names the provider it billed, and a reseller's window is its own.
    assert.equal(contextLimit('opencode', 'zai-coding-plan/glm-4.6'), 128_000)
  })

  it('prefers the providers a connector actually runs on', () => {
    // `glm-4.6` bare: ZCode runs it on zai, not on the coding plan's smaller window.
    assert.equal(contextLimit('zcode', 'glm-4.6'), 204_800)
  })

  it('looks a Kimi id up under Moonshot', () => {
    assert.equal(contextLimit('kimi', 'kimi-k2-thinking'), 262_144)
  })

  it('answers nothing for a model the catalogue has never heard of', () => {
    assert.equal(contextLimit('claude-code', 'claude-something-unreleased'), undefined)
    assert.equal(contextLimit('claude-code', ''), undefined)
    assert.equal(contextLimit('claude-code', undefined), undefined)
  })
})

describe('what Codex is holding', () => {
  it('reads the last request off the rollout, with the window Codex named', () => {
    // `codex exec --json` carries no count on any of its events — the rollout beside it does.
    writeRollout([tokenCount(4_000, 258_400), tokenCount(18_295, 258_400)])
    assert.deepEqual(readCodexRunFacts(THREAD)?.context, { used: 18_295, limit: 258_400 })
  })

  it('keeps the reading when Codex names no window', () => {
    writeRollout([tokenCount(18_295)])
    assert.deepEqual(readCodexRunFacts(THREAD)?.context, { used: 18_295, limit: undefined })
  })

  it('says nothing when the rollout holds no count yet', () => {
    writeRollout([])
    assert.equal(readCodexRunFacts(THREAD)?.context, undefined)
  })
})

describe('what Claude Code is holding', () => {
  const said = (input: number, cacheRead: number) => ({
    type: 'assistant',
    message: {
      model: 'claude-opus-4-5-20251101',
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: input, cache_creation_input_tokens: 0, cache_read_input_tokens: cacheRead },
    },
  })

  it('adds the prompt up whole, and lets the last turn win', () => {
    const renderer = createStreamRenderer()
    renderer.push(`${JSON.stringify(said(10, 1_000))}\n${JSON.stringify(said(20, 4_000))}\n`)
    renderer.flush()
    assert.deepEqual(renderer.context?.(), { used: 4_020 })
  })

  it('says nothing on a turn that counted nothing', () => {
    const renderer = createStreamRenderer()
    renderer.push(`${JSON.stringify(said(0, 0))}\n`)
    renderer.flush()
    assert.equal(renderer.context?.(), undefined)
  })
})

describe('what OpenCode is holding', () => {
  const step = (input: number, read: number) => ({
    type: 'step_finish',
    part: { cost: 0, tokens: { input, output: 5, cache: { read, write: 0 } } },
  })

  it('takes the last step, not the sum of them', () => {
    // Each step is one model call. Added up they are what the run SPENT, which is a much
    // bigger number than what the model is holding.
    const renderer = createOpencodeStreamRenderer()
    renderer.push(`${JSON.stringify(step(500, 1_000))}\n${JSON.stringify(step(300, 9_000))}\n`)
    renderer.flush()
    assert.deepEqual(renderer.context?.(), { used: 9_300 })
    assert.equal(renderer.usage?.()?.cacheRead, 10_000)
  })
})

describe('a reading read back off the record', () => {
  it('keeps each half on its own, and drops one that is nothing at all', () => {
    assert.deepEqual(asContext({ used: 100, limit: 200 }), { used: 100, limit: 200 })
    assert.deepEqual(asContext({ used: 100 }), { used: 100, limit: undefined })
    assert.deepEqual(asContext({ limit: 200 }), { used: undefined, limit: 200 })
    assert.equal(asContext({ used: 0, limit: 0 }), undefined)
    assert.equal(asContext(undefined), undefined)
  })
})
