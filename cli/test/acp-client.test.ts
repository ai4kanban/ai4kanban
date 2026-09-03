// The two shapes the board's one ACP client has to read.
//
// ACP is the protocol, not the agent, and the two agents on it answer differently in the
// two places that reach the runs panel: where the session's model is named and picked, and
// where a finished turn puts what it spent. Both are pinned here against a fake agent, so
// teaching the client one shape can't quietly take the other away (#378).

import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { describe, it } from 'node:test'

import { createAcpClient } from '../src/lib/agent/wire/acp.ts'
import type { TurnEnd } from '../src/lib/agent/wire/client.ts'

interface Call {
  method: string
  params: Record<string, unknown>
}

/** Runs one turn against a fake agent that answers `session/new` and `session/prompt` with
 *  the shapes given, and reports every method it was asked for. */
async function turnAgainst(
  opened: Record<string, unknown>,
  done: Record<string, unknown>,
  model?: string,
): Promise<{ end: TurnEnd; calls: Call[]; model?: string }> {
  const stdout = new PassThrough()
  const stdin = new PassThrough()
  const calls: Call[] = []
  let named: string | undefined

  stdin.on('data', (chunk: Buffer) => {
    for (const line of chunk.toString().split('\n')) {
      if (!line.trim()) continue
      const msg = JSON.parse(line) as { id?: number; method?: string; params?: Record<string, unknown> }
      if (msg.id === undefined || !msg.method) continue
      calls.push({ method: msg.method, params: msg.params ?? {} })
      const answers: Record<string, Record<string, unknown>> = {
        initialize: { protocolVersion: 1 },
        'session/new': { sessionId: 's-1', ...opened },
        'session/load': { ...opened },
        'session/set_model': { _meta: { model: { Ok: model } } },
        'session/set_config_option': { configOptions: [{ id: 'model', currentValue: model }] },
        'session/prompt': { stopReason: 'end_turn', ...done },
      }
      stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: answers[msg.method] ?? {} })}\n`)
    }
  })

  const end = await createAcpClient({ model }).turn({
    stdout,
    stdin,
    prompt: 'do the work',
    cwd: '/tmp/project',
    log: () => {},
    gotResumeId: () => {},
    gotModel: (id) => {
      named = id
    },
  })
  return { end, calls, model: named }
}

// Grok answers `session/new` with ACP's own model list and puts the turn's spend under
// `_meta`, where `inputTokens` is the whole prompt with the cache already in it.
const GROK_OPENED = { models: { currentModelId: 'grok-4.6', availableModels: [] } }
const GROK_DONE = {
  _meta: {
    usage: {
      inputTokens: 53097,
      outputTokens: 166,
      cachedReadTokens: 41088,
      cacheCreationTokens: 0,
      costUsdTicks: 77448600,
    },
  },
}

// dsh reports its catalog as a config option and answers with `usage` on the reply itself,
// where `inputTokens` is the fresh input alone.
const DSH_OPENED = { configOptions: [{ id: 'model', currentValue: 'deepseek-v4-flash' }] }
const DSH_DONE = {
  usage: { inputTokens: 900, outputTokens: 100, cachedReadTokens: 40, cachedWriteTokens: 10 },
}

describe('what an ACP agent says the session is on', () => {
  it('reads the model off ACP\'s own list', async () => {
    const { model } = await turnAgainst(GROK_OPENED, GROK_DONE)
    assert.equal(model, 'grok-4.6')
  })

  it('reads it off a config option where that is what the agent offered', async () => {
    const { model } = await turnAgainst(DSH_OPENED, DSH_DONE)
    assert.equal(model, 'deepseek-v4-flash')
  })

  it('picks a model the way the session it just opened offered — never the other way', async () => {
    const grok = await turnAgainst(GROK_OPENED, GROK_DONE, 'grok-4.5')
    assert.ok(grok.calls.some((c) => c.method === 'session/set_model'))
    assert.ok(!grok.calls.some((c) => c.method === 'session/set_config_option'))
    assert.equal(grok.model, 'grok-4.5')

    const dsh = await turnAgainst(DSH_OPENED, DSH_DONE, 'deepseek-v4')
    assert.ok(dsh.calls.some((c) => c.method === 'session/set_config_option'))
    assert.ok(!dsh.calls.some((c) => c.method === 'session/set_model'))
    assert.equal(dsh.model, 'deepseek-v4')
  })
})

describe('what a finished ACP turn spent', () => {
  it('takes the counts and the price out of `_meta`, with the cache out of the input', async () => {
    const { end } = await turnAgainst(GROK_OPENED, GROK_DONE)
    assert.deepEqual(end.usage, { input: 12009, cacheCreation: 0, cacheRead: 41088, output: 166 })
    // 1 USD is 10^10 ticks.
    assert.equal(end.costUsd, 0.00774486)
  })

  it('takes them off the reply itself where the agent puts them there', async () => {
    const { end } = await turnAgainst(DSH_OPENED, DSH_DONE)
    assert.deepEqual(end.usage, { input: 900, cacheCreation: 10, cacheRead: 40, output: 100 })
    assert.equal(end.costUsd, undefined)
  })

  it('reports nothing rather than a zero when the agent priced nothing', async () => {
    const { end } = await turnAgainst(GROK_OPENED, {})
    assert.equal(end.usage, undefined)
    assert.equal(end.costUsd, undefined)
    assert.equal(end.ok, true)
  })
})
