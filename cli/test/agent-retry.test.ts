// Retrying a run the provider dropped (#525).
//
// Two questions, and this file is the whole of the answer to both.
//
// WHAT COUNTS. A harness reads its own failure output and says transient or not, and the
// output is not made up: `CAPTURED` below is failure text this board really recorded, quoted
// with the file it came out of, so a CLI that changes its wording is caught here rather than
// on a user's run. `SHAPED` is the rest — failures whose EVENT shape the renderers already
// read (agent/wire/claude-stream.ts, agent/wire/codex-stream.ts) but which this board has
// never had one of. They are fed through the real renderer rather than asserted as strings,
// so a fixture can only pass by travelling the path a run does.
//
// WHAT HAPPENS NEXT. The policy is shared and has to hold whoever failed: three attempts,
// fifteen minutes from the first attempt's start, backoff capped and jittered, and a retry
// time the provider named taken over our own arithmetic.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { harnessGaps } from '../src/lib/agent/capabilities.ts'
import { HARNESSES, harnessByName } from '../src/lib/agent/harnesses/index.ts'
import { planRetry, RETRY_ATTEMPTS, RETRY_WINDOW_MS, retryLine } from '../src/lib/agent/retry.ts'
import { createStreamRenderer } from '../src/lib/agent/wire/claude-stream.ts'
import { createCodexStreamRenderer } from '../src/lib/agent/wire/codex-stream.ts'

const claude = harnessByName('claude-code')!
const codex = harnessByName('codex')!

// ---- what this board captured ----------------------------------------------

// Both are Claude Code's, and both arrived the same way: as a plain line on stdout, not as
// one of the CLI's events — which is why claude-code.ts reads an OFF-STREAM line behind the
// `API Error:` prefix at all. Neither ever reaches `result()` or `failure()`.
const CAPTURED = {
  // docs/kanban/.chats/card-263.json — the whole of that turn's reply, with
  // "stoppedWhy": "the agent exited with code 1". A conversation that died on it.
  dropped: 'API Error: Connection dropped (ECONNRESET)',
  // docs/kanban/.sessions/925d9f89-c1a3-4e55-9e79-e48d5c6539ac.log — printed mid-run; that
  // run recovered by itself and finished. Kept because it is the second wording this
  // provider really uses, and the next run to see it may not recover.
  lost: 'API Error: Connection lost mid-response. The response above may be incomplete.',
}

/** The captured line as a run hands it over: pushed through the real renderer, which is
 *  where a run's `transient` reads every one of its three signals from. */
const asARunSeesIt = (printed: string): Parameters<NonNullable<typeof claude.transient>>[0] => {
  const renderer = createStreamRenderer()
  renderer.push(`${printed}\n`)
  renderer.flush()
  return { failure: renderer.failure?.(), result: renderer.result(), offStream: renderer.offStream?.() }
}

// ---- failures whose event shape the renderers already read ------------------

/** What `claude -p --output-format stream-json` says when its `result` event failed. */
const claudeFailure = (errors: string[]): string | undefined => {
  const renderer = createStreamRenderer()
  renderer.push(`${JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true, errors })}\n`)
  renderer.flush()
  return renderer.failure?.()
}

/** And what `codex exec --json` says when its turn gave up. */
const codexFailure = (message: string): string | undefined => {
  const renderer = createCodexStreamRenderer()
  renderer.push(`${JSON.stringify({ type: 'turn.failed', error: { message } })}\n`)
  renderer.flush()
  return renderer.failure?.()
}

describe('a harness reading its own failure output (#525)', () => {
  it('reads both failures this board captured as a provider that stumbled', () => {
    for (const printed of [CAPTURED.dropped, CAPTURED.lost]) {
      const seen = asARunSeesIt(printed)
      // The shape the whole feature turns on: the CLI said this and nothing else, so a
      // reading that only looked at the result event or the failure event would see none
      // of it and the run would never try again.
      assert.equal(seen.result, undefined, printed)
      assert.equal(seen.failure, undefined, printed)
      const blip = claude.transient!(seen)
      assert.ok(blip, `${printed} should read as transient`)
      // The provider's own words travel with it — the runs view shows this line.
      assert.equal(blip.reason, printed)
      assert.equal(blip.retryAfterMs, undefined)
    }
  })

  it('reads words that are not the CLI saying so as prose, not a failure', () => {
    // This very card's own summary would otherwise classify itself — on either of the two
    // signals that carry the agent's own voice.
    const prose = 'Retried the run after the provider dropped the connection (ECONNRESET).'
    assert.equal(claude.transient!({ result: prose }), undefined)
    assert.equal(claude.transient!(asARunSeesIt(prose)), undefined)
  })

  it('reads a failed result event through the renderer that carries it', () => {
    const failure = claudeFailure(['API Error: 529 overloaded_error'])
    const blip = claude.transient!({ failure })
    assert.ok(blip)
    assert.match(blip.reason, /overloaded_error/)
  })

  it('reads a failed codex turn through the renderer that carries it', () => {
    const failure = codexFailure('stream error: 503 Service Unavailable')
    const blip = codex.transient!({ failure })
    assert.ok(blip)
    assert.match(blip.reason, /503/)
  })

  it("leaves a tool's own error out of the run's failure", () => {
    // An item that failed is the agent's problem to work around; the turn around it may
    // still finish, so it never becomes the run's reason to retry.
    const renderer = createCodexStreamRenderer()
    renderer.push(`${JSON.stringify({ type: 'item.completed', item: { type: 'error', message: 'ECONNRESET' } })}\n`)
    renderer.flush()
    assert.equal(renderer.failure?.(), undefined)
  })

  it('leaves every failure a second attempt would only repeat to a person', () => {
    const manual = [
      'API Error: 401 authentication_error: invalid x-api-key',
      'API Error: 429 rate_limit_error: usage limit reached',
      'Reached maximum budget ($0.0001)',
      'Credit balance is too low',
      'The user cancelled this request',
      'API Error: 403 permission denied',
      'model not found: gpt-nonexistent',
    ]
    for (const said of manual) {
      assert.equal(claude.transient!({ failure: said }), undefined, said)
      assert.equal(codex.transient!({ failure: said }), undefined, said)
    }
  })

  it('leaves output nobody has read alone', () => {
    for (const said of ['error_during_execution', 'the agent reported the session failed', '']) {
      assert.equal(claude.transient!({ failure: said }), undefined, said)
    }
  })

  it('stays manual when one sentence says both', () => {
    // The manual reading is taken first, so a rate limit dressed up as an outage does not
    // spend a card's attempts on a wait that cannot help.
    assert.equal(claude.transient!({ failure: 'rate limited: service unavailable' }), undefined)
  })

  it('carries a retry time the provider named', () => {
    const blip = claude.transient!({ failure: 'API Error: 529 overloaded_error (retry-after: 42)' })
    assert.ok(blip)
    assert.equal(blip.retryAfterMs, 42_000)
  })

  it('is declared by Claude Code and Codex, and by nobody else', () => {
    const declares = HARNESSES.filter((h) => h.transient).map((h) => h.name).sort()
    assert.deepEqual(declares, ['claude-code', 'codex'])
    // And the picker says as much: every other connector reports the gap.
    for (const harness of HARNESSES) {
      const gaps = harnessGaps(harness).map((g) => g.id)
      assert.equal(gaps.includes('retry'), !harness.transient, harness.name)
    }
  })
})

describe('the shared retry policy (#525)', () => {
  const blip = { reason: 'API Error: 529 overloaded_error' }
  const started = 1_000_000

  it('schedules a second attempt, jittered inside its own window', () => {
    for (const roll of [0, 0.5, 1]) {
      const again = planRetry(undefined, blip, started, started + 5_000, () => roll)
      assert.ok(again)
      assert.equal(again.attempt, 2)
      assert.equal(again.of, RETRY_ATTEMPTS)
      assert.equal(again.since, started)
      assert.equal(again.reason, blip.reason)
      const wait = again.at - (started + 5_000)
      assert.ok(wait > 11_000 && wait <= 15_000, `${wait}ms out of the first window`)
    }
  })

  it('waits longer each time, up to the cap', () => {
    const at = (attempt: number): number => {
      const prev = { attempt: attempt - 1, of: RETRY_ATTEMPTS, reason: blip.reason, at: started, since: started }
      return planRetry(prev, blip, started, started, () => 0)!.at - started
    }
    assert.ok(at(3) > at(2))
    assert.ok(at(3) <= 120_000)
  })

  it('takes the provider at its word when it named a time', () => {
    const again = planRetry(undefined, { ...blip, retryAfterMs: 90_000 }, started, started, () => 0)
    assert.equal(again!.at - started, 90_000)
  })

  it('stops after the third attempt', () => {
    const third = { attempt: RETRY_ATTEMPTS, of: RETRY_ATTEMPTS, reason: blip.reason, at: started, since: started }
    assert.equal(planRetry(third, blip, started, started, () => 0), null)
  })

  it('stops when the next attempt would start outside the window', () => {
    // The window runs from the FIRST attempt's start, so a chain that has been going for
    // fifteen minutes is over however few attempts it made — which is also how the time a
    // harness burned retrying inside an attempt counts against the same limit.
    const first = { attempt: 2, of: RETRY_ATTEMPTS, reason: blip.reason, at: started, since: started }
    const late = started + RETRY_WINDOW_MS - 1_000
    assert.equal(planRetry(first, blip, late, late, () => 0), null)
  })

  it('counts the window from the first attempt, not from this one', () => {
    const first = { attempt: 2, of: RETRY_ATTEMPTS, reason: blip.reason, at: started, since: started }
    const soon = started + 60_000
    const again = planRetry(first, blip, soon, soon, () => 0)
    assert.ok(again)
    assert.equal(again.since, started)
  })

  it('says the reason, the countdown and the attempt in one line', () => {
    const again = planRetry(undefined, blip, started, started, () => 0)!
    const said = retryLine(again, started)
    assert.match(said, /overloaded_error/)
    assert.match(said, /attempt 2 of 3/)
    assert.match(said, /\d+s/)
  })
})
