// What a Claude Code run reports back, and the one thing about it the exit code cannot say.
//
// `claude -p` exits 0 on a closing `result` event that carries `is_error: true` — a budget
// it ran out of, a limit it hit. Every other agent the board runs exits non-zero for the
// same thing, so this renderer is the only one that reports a failure of its own
// (agent/wire/stream.ts), and `watch.ts` and `test.ts` read it beside the code. Without it
// a failed run closes as done, its card advances, and the refinements behind it run on work
// that never happened.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createStreamRenderer } from '../src/lib/agent/wire/claude-stream.ts'

/** Feed a renderer whole lines and hand back everything it logged. */
function render(events: Record<string, unknown>[]): { log: string; renderer: ReturnType<typeof createStreamRenderer> } {
  const renderer = createStreamRenderer()
  const log = events.map((ev) => renderer.push(`${JSON.stringify(ev)}\n`)).join('') + renderer.flush()
  return { log, renderer }
}

const SAID = {
  type: 'assistant',
  message: { model: 'claude-opus-5', content: [{ type: 'text', text: 'done' }] },
}

describe('a run that finished', () => {
  it('reports no failure, so the exit code stays the whole verdict', () => {
    const { renderer } = render([
      SAID,
      { type: 'result', subtype: 'success', is_error: false, result: 'done', total_cost_usd: 0.02 },
    ])
    assert.equal(renderer.failure?.(), undefined)
    assert.equal(renderer.result(), 'done')
    assert.equal(renderer.costUsd?.(), 0.02)
  })
})

describe('a run the CLI ended on a clean exit', () => {
  // The reproduction: `claude -p --max-budget-usd 0.0001 "<long task>"` prints this and
  // exits 0.
  const BUDGET = {
    type: 'result',
    is_error: true,
    subtype: 'error_max_budget_usd',
    terminal_reason: 'budget_exhausted',
    errors: ['Reached maximum budget ($0.0001)'],
  }

  it('reports the failure in the agent’s own words', () => {
    const { renderer } = render([SAID, BUDGET])
    assert.equal(renderer.failure?.(), 'Reached maximum budget ($0.0001)')
  })

  it('says so in the log, where the reason is read', () => {
    const { log } = render([SAID, BUDGET])
    assert.match(log, /\[error] Reached maximum budget/)
  })

  it('falls back to the name Claude Code gave it when there is no sentence', () => {
    const { renderer } = render([SAID, { type: 'result', is_error: true, subtype: 'error_during_execution' }])
    assert.equal(renderer.failure?.(), 'error_during_execution')
  })

  it('is never blank, however little the event carries', () => {
    const { renderer } = render([{ type: 'result', is_error: true }])
    assert.ok((renderer.failure?.() ?? '').length > 0)
  })
})

describe('the tool calls a run was refused', () => {
  it('are named, so a run that changed nothing doesn’t read as one that chose to', () => {
    const { log } = render([
      SAID,
      {
        type: 'result',
        is_error: false,
        result: 'done',
        permission_denials: [
          { tool_name: 'Edit', tool_use_id: 'a' },
          { tool_name: 'Bash', tool_use_id: 'b' },
        ],
      },
    ])
    assert.match(log, /\[refused] 2 tool calls were not allowed: Edit, Bash/)
  })

  it('leave the log alone when there were none', () => {
    const { log } = render([SAID, { type: 'result', is_error: false, result: 'done', permission_denials: [] }])
    assert.ok(!log.includes('[refused]'), log)
  })
})
