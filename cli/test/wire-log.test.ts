// Every agent's log reads alike — the thing each renderer claimed in a comment while keeping
// a copy of the code that did it. Now they share one `hint` (agent/wire/json.ts), so this
// pins the shape it writes and pins that they all still write the same one.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { argHint, hint } from '../src/lib/agent/wire/json.ts'
import { createStreamRenderer } from '../src/lib/agent/wire/claude-stream.ts'
import { createCursorStreamRenderer } from '../src/lib/agent/wire/cursor-stream.ts'
import { createKimiStreamRenderer } from '../src/lib/agent/wire/kimi-stream.ts'
import { createOpencodeStreamRenderer } from '../src/lib/agent/wire/opencode-stream.ts'

const LONG = 'x'.repeat(200)

// Kimi's renderer takes the run's folder, to find on disk what its stream leaves out. Only
// the log is under test here, and rendering a line never goes looking.
const kimi = () => createKimiStreamRenderer(process.cwd())

describe('the hint beside a tool call', () => {
  it('is the first line, parenthesised', () => {
    assert.equal(hint('npm test\nand more'), '(npm test)')
  })

  it('is bounded, with the cut marked', () => {
    // 93 characters, the mark, and the two brackets.
    const out = hint(LONG)
    assert.equal(out, `(${'x'.repeat(93)}…)`)
    assert.equal(hint('x'.repeat(96)), `(${'x'.repeat(96)})`)
  })

  it('is nothing at all when there is nothing to show', () => {
    assert.equal(hint(''), '')
    assert.equal(hint('   \n  '), '')
  })

  it('takes the first key that holds something, in the order given', () => {
    assert.equal(argHint({ path: 'a.ts', command: 'ls' }, ['command', 'path']), '(ls)')
    assert.equal(argHint({ path: 'a.ts', command: '  ' }, ['command', 'path']), '(a.ts)')
    assert.equal(argHint({ other: 'a.ts' }, ['command', 'path']), '')
  })
})

// One tool call, put down each agent's own stream. The wire shapes differ; the line the
// reader gets does not.
describe('one tool call, four agents', () => {
  const push = (r: { push(c: string): string }, ev: unknown) => r.push(`${JSON.stringify(ev)}\n`)

  it('claude writes the name and the argument', () => {
    const out = push(createStreamRenderer(), {
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test\nignored' } }] },
    })
    assert.equal(out, '⏺ Bash(npm test)\n')
  })

  it('cursor writes the name and the argument', () => {
    const out = push(createCursorStreamRenderer(), {
      type: 'tool_call',
      subtype: 'started',
      tool_call: { shellToolCall: { args: { command: 'npm test\nignored' } } },
    })
    assert.equal(out, '⏺ shell(npm test)\n')
  })

  it('opencode writes the name and the argument', () => {
    const out = push(createOpencodeStreamRenderer(), {
      type: 'tool_use',
      part: { tool: 'bash', state: { input: { command: 'npm test\nignored' } } },
    })
    assert.equal(out, '⏺ bash(npm test)\n')
  })

  it('kimi writes the name and the argument', () => {
    // Kimi's arguments arrive as a JSON string rather than an object.
    const out = push(kimi(), {
      role: 'assistant',
      tool_calls: [{ function: { name: 'Bash', arguments: JSON.stringify({ command: 'npm test\nignored' }) } }],
    })
    assert.equal(out, '⏺ Bash(npm test)\n')
  })

  it('logs a call with no recognisable argument by name alone', () => {
    const out = push(createStreamRenderer(), {
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'TodoWrite', input: { todos: [] } }] },
    })
    assert.equal(out, '⏺ TodoWrite\n')
  })
})

describe('a line that is not the protocol', () => {
  it('reaches the log untouched, on every renderer', () => {
    for (const make of [createStreamRenderer, createCursorStreamRenderer, createOpencodeStreamRenderer, kimi]) {
      assert.equal(make().push('npm WARN something\n'), 'npm WARN something\n')
    }
  })

  it('renders the last line even without its newline', () => {
    const r = createStreamRenderer()
    assert.equal(r.push('a stray warning'), '')
    assert.equal(r.flush(), 'a stray warning\n')
  })
})
