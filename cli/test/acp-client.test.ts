// The two shapes the board's one ACP client has to read.
//
// ACP is the protocol, not the agent, and the two agents on it answer differently in the
// two places that reach the runs panel: where the session's model is named and picked, and
// where a finished turn puts what it spent. Both are pinned here against a fake agent, so
// teaching the client one shape can't quietly take the other away (#378).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { describe, it } from 'node:test'

import { createAcpClient } from '../src/lib/agent/wire/acp.ts'
import type { TurnEnd } from '../src/lib/agent/wire/client.ts'
import type { RunEvent } from '../src/lib/agent/wire/events.ts'

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
  resume?: { id: string; missing?: boolean },
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
      if (msg.method === 'session/load' && resume?.missing) {
        stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: 'session not found' } })}\n`)
        continue
      }
      stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: answers[msg.method] ?? {} })}\n`)
    }
  })

  const end = await createAcpClient({ model }).turn({
    stdout,
    stdin,
    prompt: 'do the work',
    resumeId: resume?.id,
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


describe('ACP saved conversations', () => {
  it('loads the DSH conversation and sends the next turn to its existing id', async () => {
    const { end, calls } = await turnAgainst(DSH_OPENED, DSH_DONE, undefined, { id: 'saved-dsh' })
    assert.equal(end.ok, true)
    assert.equal(calls.some((c) => c.method === 'session/new'), false)
    assert.equal(calls.find((c) => c.method === 'session/load')?.params.sessionId, 'saved-dsh')
    assert.equal(calls.find((c) => c.method === 'session/prompt')?.params.sessionId, 'saved-dsh')
  })

  it('fails without creating a fresh conversation when saved history is missing', async () => {
    const { end, calls } = await turnAgainst(DSH_OPENED, DSH_DONE, undefined, { id: 'missing', missing: true })
    assert.equal(end.ok, false)
    assert.match(end.error ?? '', /session not found/)
    assert.equal(calls.some((c) => ['session/new', 'session/prompt'].includes(c.method)), false)
  })
})

// Cursor lists its models with their parameters in the id, and `set_model` takes nothing less.
const CURSOR_OPENED = {
  models: {
    currentModelId: 'default[]',
    availableModels: [
      { modelId: 'default[]', name: 'Auto' },
      { modelId: 'gpt-5.5[context=272k,reasoning=medium,fast=false]', name: 'gpt-5.5' },
    ],
  },
}

describe('Cursor-shaped model lists', () => {
  it('reports the name of the model the session opened on', async () => {
    const { model } = await turnAgainst(CURSOR_OPENED, {})
    assert.equal(model, 'Auto')
  })

  it('asks for the full id when given the name or the part before the `[`', async () => {
    for (const typed of ['gpt-5.5', 'gpt-5.5[context=272k,reasoning=medium,fast=false]']) {
      const { calls, model } = await turnAgainst(CURSOR_OPENED, {}, typed)
      assert.equal(calls.find((c) => c.method === 'session/set_model')?.params.modelId, 'gpt-5.5[context=272k,reasoning=medium,fast=false]')
      assert.equal(model, 'gpt-5.5')
    }
  })
})

describe('what else an ACP session opens with and reports', () => {
  /** One turn against an agent that sends `before` as notifications or requests during the
   *  prompt, and answers `session/prompt` once every request it sent was answered. */
  async function scripted(before: Record<string, unknown>[], options: Parameters<typeof createAcpClient>[0] = {}) {
    const stdout = new PassThrough()
    const stdin = new PassThrough()
    const calls: Call[] = []
    const replies: unknown[] = []
    stdin.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        const msg = JSON.parse(line) as { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown }
        if (!msg.method) {
          replies.push(msg.result)
          continue
        }
        calls.push({ method: msg.method, params: msg.params ?? {} })
        if (msg.method === 'session/prompt') {
          before.forEach((m, i) => stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...(m.method === 'session/update' ? {} : { id: 100 + i }), ...m })}\n`))
        }
        const result = msg.method === 'session/new' ? { sessionId: 's' } : msg.method === 'session/prompt' ? { stopReason: 'end_turn' } : {}
        setTimeout(() => stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n`), 10)
      }
    })
    const events: RunEvent[] = []
    const end = await createAcpClient(options).turn({
      stdout, stdin, prompt: 'go', cwd: '/tmp', log: () => {}, gotResumeId: () => {}, gotModel: () => {}, event: (e) => events.push(e),
    })
    return { end, calls, replies, events }
  }

  it('reads how full the context is off `usage_update`', async () => {
    const { end } = await scripted([{ method: 'session/update', params: { update: { sessionUpdate: 'usage_update', used: 15891, size: 200000, cost: { amount: 0, currency: 'USD' } } } }])
    assert.deepEqual(end.context, { used: 15891, limit: 200000 })
  })

  it("turns Cursor's todo requests into plans, merged by id, and answers them", async () => {
    const todos = (list: unknown[], merge: boolean) => ({ method: 'cursor/update_todos', params: { toolCallId: 't', todos: list, merge } })
    const { events, replies } = await scripted([
      { method: 'session/update', params: { update: { sessionUpdate: 'tool_call', toolCallId: 't', title: 'Update TODOs', kind: 'other', rawInput: { _toolName: 'updateTodos' } } } },
      todos([{ id: '1', content: 'Read', status: 'in_progress' }, { id: '2', content: 'Write', status: 'pending' }], false),
      todos([{ id: '1', content: 'Read', status: 'completed' }], true),
    ])
    assert.deepEqual(events.filter((e) => e.kind !== 'plan'), [])
    assert.deepEqual(events.at(-1), { kind: 'plan', data: { entries: [{ content: 'Read', status: 'completed' }, { content: 'Write', status: 'pending' }] } })
    assert.deepEqual(replies, [{}, {}])
  })

  it('opens the session with the servers of an MCP config file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acp-mcp-'))
    const file = path.join(dir, 'mcp.json')
    fs.writeFileSync(file, JSON.stringify({ mcpServers: { docs: { command: 'npx', args: ['-y', 'docs-mcp'], env: { TOKEN: 'x' } } } }))
    const { calls } = await scripted([], { mcpConfig: file })
    assert.deepEqual(calls.find((c) => c.method === 'session/new')?.params.mcpServers, [
      { name: 'docs', command: 'npx', args: ['-y', 'docs-mcp'], env: [{ name: 'TOKEN', value: 'x' }] },
    ])
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
