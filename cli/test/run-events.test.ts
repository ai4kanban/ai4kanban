// The structured events a run reports (#2059): one collector, fed by ACP updates, Claude Code's
// stream-json and Codex's exec --json, all landing in the same shape.

import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { describe, it } from 'node:test'

import { createAcpClient } from '../src/lib/agent/wire/acp.ts'
import { createStreamRenderer } from '../src/lib/agent/wire/claude-stream.ts'
import { createCodexStreamRenderer } from '../src/lib/agent/wire/codex-stream.ts'
import { createEventCollector, type RunEvent } from '../src/lib/agent/wire/events.ts'

const feed = (renderer: { push(c: string): string; flush(): string; events?(): RunEvent[] }, lines: unknown[]): RunEvent[] => {
  const out: RunEvent[] = []
  for (const line of lines) {
    renderer.push(`${JSON.stringify(line)}\n`)
    out.push(...(renderer.events?.() ?? []))
  }
  renderer.flush()
  return [...out, ...(renderer.events?.() ?? [])]
}

describe('the collector', () => {
  it('holds message chunks until another update arrives', () => {
    const c = createEventCollector()
    c.update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Looking ' } })
    c.update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'at it.' } })
    assert.deepEqual(c.events(), [])
    c.update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'Read a.ts', kind: 'read', status: 'pending', locations: [{ path: '/p/a.ts' }] })
    assert.deepEqual(c.events(), [
      { kind: 'message', data: { text: 'Looking at it.' } },
      { kind: 'tool_call', data: { toolCallId: 't1', title: 'Read a.ts', kind: 'read', status: 'pending', target: '/p/a.ts' } },
    ])
  })

  it('keeps tool results and plans, drops thoughts, and finishes a message at the end', () => {
    const c = createEventCollector()
    c.update({ sessionUpdate: 'agent_thought_chunk', content: { text: 'hmm' } })
    c.update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed', content: [{ type: 'content', content: { type: 'text', text: 'ok' } }] })
    c.update({ sessionUpdate: 'plan', entries: [{ content: 'Read', status: 'completed', priority: 'high' }, { content: '', status: 'pending' }] })
    c.update({ sessionUpdate: 'tool_call', toolCallId: 't2', title: 'x', kind: 'teleport' })
    c.update({ sessionUpdate: 'agent_message_chunk', content: { text: 'Done.' } })
    c.end()
    assert.deepEqual(c.events(), [
      { kind: 'tool_call_update', data: { toolCallId: 't1', status: 'completed', result: 'ok' } },
      { kind: 'plan', data: { entries: [{ content: 'Read', status: 'completed', priority: 'high' }] } },
      { kind: 'tool_call', data: { toolCallId: 't2', title: 'x', kind: 'other', status: 'pending' } },
      { kind: 'message', data: { text: 'Done.' } },
    ])
  })
})

describe('Claude Code', () => {
  it('maps text, tool calls, their results, TodoWrite and a failed result', () => {
    const events = feed(createStreamRenderer(), [
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Reading.' }, { type: 'tool_use', id: 'u1', name: 'Read', input: { file_path: '/p/a.ts' } }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'u1', content: [{ type: 'text', text: 'line 1' }] }] } },
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'u2', name: 'TodoWrite', input: { todos: [{ content: 'Fix', status: 'in_progress' }] } }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'u2', content: 'ok' }] } },
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'u3', name: 'Bash', input: { command: 'npm test' } }] } },
      { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'u3', content: 'boom', is_error: true }] } },
      { type: 'result', is_error: true, subtype: 'error_max_turns', result: '' },
    ])
    assert.deepEqual(events, [
      { kind: 'message', data: { text: 'Reading.' } },
      { kind: 'tool_call', data: { toolCallId: 'u1', title: 'Read', kind: 'read', status: 'in_progress', target: '/p/a.ts' } },
      { kind: 'tool_call_update', data: { toolCallId: 'u1', status: 'completed', result: 'line 1' } },
      { kind: 'plan', data: { entries: [{ content: 'Fix', status: 'in_progress' }] } },
      { kind: 'tool_call', data: { toolCallId: 'u3', title: 'Bash', kind: 'execute', status: 'in_progress', target: 'npm test' } },
      { kind: 'tool_call_update', data: { toolCallId: 'u3', status: 'failed', result: 'boom' } },
      { kind: 'error', data: { text: 'error_max_turns' } },
    ])
  })
})

describe('Codex', () => {
  it('maps messages, commands, file changes, the to-do list and a failed turn', () => {
    const events = feed(createCodexStreamRenderer(), [
      { type: 'item.started', item: { id: 'i0', type: 'todo_list', items: [{ text: 'Fix', completed: false }] } },
      { type: 'item.started', item: { id: 'i1', type: 'command_execution', command: "/bin/zsh -lc 'ls'", status: 'in_progress' } },
      { type: 'item.completed', item: { id: 'i1', type: 'command_execution', command: 'ls', aggregated_output: 'a.ts', exit_code: 0, status: 'completed' } },
      { type: 'item.completed', item: { id: 'i2', type: 'file_change', changes: [{ path: '/p/a.ts', kind: 'update' }], status: 'completed' } },
      { type: 'item.completed', item: { id: 'i3', type: 'agent_message', text: 'Fixed.' } },
      { type: 'turn.failed', error: { message: 'quota' } },
    ])
    assert.deepEqual(events, [
      { kind: 'plan', data: { entries: [{ content: 'Fix', status: 'pending' }] } },
      { kind: 'tool_call', data: { toolCallId: 'i1', title: 'Command', kind: 'execute', status: 'in_progress', target: 'ls' } },
      { kind: 'tool_call_update', data: { toolCallId: 'i1', status: 'completed', result: 'a.ts' } },
      { kind: 'tool_call', data: { toolCallId: 'i2', title: 'Edit', kind: 'edit', status: 'in_progress', target: '/p/a.ts' } },
      { kind: 'tool_call_update', data: { toolCallId: 'i2', status: 'completed', result: 'update /p/a.ts' } },
      { kind: 'message', data: { text: 'Fixed.' } },
      { kind: 'error', data: { text: 'quota' } },
    ])
  })
})

describe('ACP', () => {
  it('hands every update to the collector and reports a stop that is not end_turn', async () => {
    const stdout = new PassThrough()
    const stdin = new PassThrough()
    const note = (update: unknown) => stdout.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 's', update } })}\n`)
    stdin.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        const msg = JSON.parse(line) as { id?: number; method?: string }
        if (msg.id === undefined) continue
        if (msg.method === 'session/prompt') {
          note({ sessionUpdate: 'plan', entries: [{ content: 'Look', status: 'in_progress' }] })
          note({ sessionUpdate: 'agent_message_chunk', content: { text: 'Hi' } })
          note({ sessionUpdate: 'tool_call', toolCallId: 'c', title: 'ls', kind: 'execute', rawInput: { command: 'ls' } })
          note({ sessionUpdate: 'tool_call_update', toolCallId: 'c', status: 'completed', content: [{ type: 'content', content: { type: 'text', text: 'a' } }] })
        }
        const result = msg.method === 'session/new' ? { sessionId: 's' } : msg.method === 'session/prompt' ? { stopReason: 'max_tokens' } : {}
        stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })}\n`)
      }
    })
    const got: RunEvent[] = []
    await createAcpClient().turn({
      stdout, stdin, prompt: 'go', cwd: '/tmp', log: () => {}, gotResumeId: () => {}, gotModel: () => {}, event: (e) => got.push(e),
    })
    assert.deepEqual(got.map((e) => e.kind), ['plan', 'message', 'tool_call', 'tool_call_update', 'error'])
    assert.deepEqual(got[2]!.data, { toolCallId: 'c', title: 'ls', kind: 'execute', status: 'pending', target: 'ls' })
  })
})

describe('plans written as tool calls', () => {
  it("reports OpenCode's todowrite as the plan, and a call that opened naming nothing once its update does", () => {
    const c = createEventCollector()
    c.update({ sessionUpdate: 'tool_call', toolCallId: 'p', title: 'todowrite', kind: 'other', status: 'pending', rawInput: {} })
    c.update({ sessionUpdate: 'tool_call_update', toolCallId: 'p', status: 'in_progress', rawInput: { todos: [{ content: 'Read', status: 'in_progress', priority: 'high' }] } })
    c.update({ sessionUpdate: 'tool_call_update', toolCallId: 'p', status: 'completed', content: [{ type: 'content', content: { type: 'text', text: '[]' } }] })
    c.update({ sessionUpdate: 'tool_call', toolCallId: 'r', title: 'read', kind: 'read', status: 'pending', locations: [{ path: '/p' }], rawInput: { cwd: '/p' } })
    assert.deepEqual(c.events(), [{ kind: 'plan', data: { entries: [{ content: 'Read', status: 'in_progress', priority: 'high' }] } }])
    c.update({ sessionUpdate: 'tool_call_update', toolCallId: 'r', status: 'in_progress', locations: [{ path: '/p/a.txt' }], rawInput: { filePath: '/p/a.txt' } })
    assert.deepEqual(c.events(), [
      { kind: 'tool_call', data: { toolCallId: 'r', title: 'read', kind: 'read', status: 'pending', target: '/p/a.txt' } },
      { kind: 'tool_call_update', data: { toolCallId: 'r', status: 'in_progress' } },
    ])
  })

  it('normalises a todo status to pending, in_progress or completed', () => {
    const c = createEventCollector()
    c.plan([{ content: 'a', status: 'TODO_STATUS_IN_PROGRESS' }, { content: 'b', status: 'cancelled' }, { content: 'c', status: 'weird' }])
    assert.deepEqual(c.events(), [{ kind: 'plan', data: { entries: [
      { content: 'a', status: 'in_progress' }, { content: 'b', status: 'completed' }, { content: 'c', status: 'pending' },
    ] } }])
  })
})
