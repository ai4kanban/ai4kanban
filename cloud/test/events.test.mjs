import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { PG_ALREADY_ACTED, PG_STALE_REVISION, refusalFor } from '../src/db.ts'
import { publishEvent, recordAction, recordOutcome } from '../src/events.ts'

// The Worker's half of an event (#319): the shape of the request, and the refusal a client
// is meant to act on. What the database does with a well-formed call is the migration's,
// and 0004 is where that lives.

const OWNER = { accountId: '11111111-1111-4111-8111-111111111111', subject: 'x', handle: 'a', name: null, avatarUrl: null, expiresAt: 0 }
const BOARD = '22222222-2222-4222-8222-222222222222'
const EVENT = '33333333-3333-4333-8333-333333333333'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }

/** Stand in for PostgREST, and hand back the arguments the function was called with. */
function fakeDatabase(answer) {
  const calls = []
  mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ fn: String(url).split('/rpc/')[1], args: JSON.parse(init.body) })
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  return calls
}

const anEvent = (over = {}) => ({ id: EVENT, boardId: BOARD, taskId: 12, state: 'actionable', ...over })

describe('publishEvent', () => {
  it('carries the questions and no other part of the card', async () => {
    const calls = fakeDatabase(anEvent())

    await publishEvent(ENV, OWNER, {
      boardId: BOARD,
      boardName: 'ai4kanban',
      taskId: 12,
      taskTitle: 'Sync actionable events',
      release: '0.8.0',
      revision: 'r1',
      kind: 'question',
      decision: 'answer',
      questions: [
        { text: 'Which one?', mode: 'single', options: ['a', 'b'], recommend: [1] },
        { text: 'A plain one' },
      ],
      fingerprint: 'f1',
      // Whatever else a client sends is not part of the contract and never reaches the row.
      body: 'the whole card body',
    })

    const [call] = calls
    assert.equal(call.fn, 'publish_event')
    assert.equal(call.args.p_task_title, 'Sync actionable events')
    assert.equal(call.args.p_revision, 'r1')
    assert.deepEqual(call.args.p_questions, [
      { text: 'Which one?', mode: 'single', options: ['a', 'b'], recommend: [1] },
      { text: 'A plain one' },
    ])
    assert.ok(!('body' in call.args), 'the card body must never reach the database')
  })

  it('refuses an event that names no kind, without touching the database', async () => {
    const calls = fakeDatabase(anEvent())

    await assert.rejects(
      publishEvent(ENV, OWNER, { boardId: BOARD, taskId: 1, kind: 'whatever', decision: 'answer' }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })

  it('refuses a board that is not an id', async () => {
    fakeDatabase(anEvent())

    await assert.rejects(
      publishEvent(ENV, OWNER, {
        boardId: '../../etc',
        taskId: 1,
        taskTitle: 't',
        revision: 'r',
        kind: 'question',
        decision: 'answer',
        fingerprint: 'f',
      }),
      (e) => e.code === 'bad_request',
    )
  })
})

describe('recordAction', () => {
  it('keeps the board’s own rule: a ticked option or typed words, never both', async () => {
    const calls = fakeDatabase(anEvent({ state: 'accepted' }))

    await recordAction(ENV, OWNER, EVENT, {
      opId: 'op-1',
      decision: 'answer',
      revision: 'r1',
      answers: [
        { picked: [2], text: 'and some words' },
        { picked: [], text: 'just words' },
        { picked: [], text: '' },
      ],
    })

    assert.deepEqual(calls[0].args.p_answers, [
      { picked: [2], text: '' },
      { picked: [], text: 'just words' },
      // A blank is an answer too: it means the agent researches that one.
      { picked: [], text: '' },
    ])
  })

  it('records an action taken on this machine as accepted', async () => {
    const calls = fakeDatabase(anEvent({ state: 'accepted' }))

    await recordAction(ENV, OWNER, EVENT, { opId: 'op-2', decision: 'implement', revision: 'r1' })

    assert.equal(calls[0].args.p_state, 'accepted')
  })

  it('refuses an action naming no attempt, so a retry can never be told apart from a second', async () => {
    const calls = fakeDatabase(anEvent())

    await assert.rejects(
      recordAction(ENV, OWNER, EVENT, { decision: 'implement', revision: 'r1' }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })
})

describe('recordOutcome', () => {
  it('refuses an outcome Cloud has no state for', async () => {
    const calls = fakeDatabase(anEvent())

    await assert.rejects(
      recordOutcome(ENV, OWNER, EVENT, { opId: 'op-3', outcome: 'exploded' }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })

  it('takes each of the five a delivery can reach', async () => {
    for (const outcome of ['running', 'completed', 'failed', 'cancelled', 'interrupted']) {
      const calls = fakeDatabase(anEvent({ state: outcome }))
      await recordOutcome(ENV, OWNER, EVENT, { opId: `op-${outcome}`, outcome })
      assert.equal(calls[0].args.p_outcome, outcome)
      mock.restoreAll()
    }
  })
})

describe('the two refusals an action can meet', () => {
  it('tells a revision that has moved from a second action', () => {
    const stale = refusalFor({ code: PG_STALE_REVISION }, 400)
    assert.equal(stale.code, 'stale_revision')
    assert.equal(stale.status, 409)

    const twice = refusalFor({ code: PG_ALREADY_ACTED }, 400)
    assert.equal(twice.code, 'already_acted')
    assert.equal(twice.status, 409)
  })
})
