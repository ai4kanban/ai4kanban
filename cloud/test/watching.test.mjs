import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { watchSummaryFor as larkSummary } from '../src/lark-message.ts'
import { watchSummaryFor as slackSummary } from '../src/slack-message.ts'
import { deliverWatchSummary, recordWatchSummary } from '../src/watching.ts'

// The one message a scope change sends (#451). What the schema does with a well-formed call
// is 0019's; this is the Worker's half — the shape of the request, and the one message each
// connected destination gets.

const OWNER = {
  accountId: '11111111-1111-4111-8111-111111111111',
  subject: 'x',
  handle: 'a',
  name: null,
  avatarUrl: null,
  expiresAt: 0,
}
const BOARD = '22222222-2222-4222-8222-222222222222'
const SUMMARY = '33333333-3333-4333-8333-333333333333'
const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }

const recorded = (over = {}) => ({
  summaryId: SUMMARY,
  posted: true,
  boardName: 'ai4kanban',
  watching: '*',
  cards: 12,
  ...over,
})

/** Stand in for PostgREST, Slack and Lark at once, keeping every call in order. */
function fakeWorld(answers) {
  const calls = []
  mock.method(globalThis, 'fetch', async (url, init) => {
    const at = String(url)
    if (at.startsWith('https://slack.com/')) {
      calls.push({ slack: at.split('/api/')[1], args: JSON.parse(init.body) })
      return new Response(JSON.stringify({ ok: true, ts: '1712.0001' }), { status: 200 })
    }
    if (at.includes('feishu.cn') || at.includes('larksuite.com')) {
      calls.push({ lark: at, args: init.body ? JSON.parse(init.body) : null })
      return new Response(
        JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 't', data: { message_id: 'om_1' } }),
        { status: 200 },
      )
    }
    const fn = at.split('/rpc/')[1]
    calls.push({ fn, args: JSON.parse(init.body) })
    // The tenant token is held in Cloud and renewed there; a live one is what every Lark
    // message goes out on, so the fake hands one over rather than minting it.
    const held = fn === 'lark_tenant_token' ? { token: 't' } : answers[fn]
    return new Response(JSON.stringify(held ?? null), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  return calls
}

describe('recordWatchSummary', () => {
  it('writes the switch down under the attempt that made it', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeWorld({ record_watch_summary: recorded() })

    const answer = await recordWatchSummary(ENV, OWNER, {
      opId: 'op-1',
      boardId: BOARD,
      watching: '*',
      cards: 12,
    })

    assert.equal(answer.posted, true)
    const [call] = calls
    assert.equal(call.fn, 'record_watch_summary')
    assert.equal(call.args.p_op_id, 'op-1')
    assert.equal(call.args.p_board, BOARD)
    assert.equal(call.args.p_watching, '*')
    assert.equal(call.args.p_cards, 12)
  })

  it('refuses a switch that brought nothing in, without touching the database', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeWorld({ record_watch_summary: recorded() })

    await assert.rejects(
      recordWatchSummary(ENV, OWNER, { opId: 'op-1', boardId: BOARD, watching: '*', cards: 0 }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })

  it('refuses one that names no board', async (t) => {
    t.after(() => mock.restoreAll())
    fakeWorld({ record_watch_summary: recorded() })

    await assert.rejects(
      recordWatchSummary(ENV, OWNER, { opId: 'op-1', boardId: 'not-a-board', watching: '*', cards: 3 }),
      (e) => e.code === 'bad_request',
    )
  })
})

describe('deliverWatchSummary', () => {
  it('posts one message to each destination the account has connected', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeWorld({
      watch_summary_targets: [
        { connector: 'slack', posts: { botToken: 'xoxb', channelId: 'C1' } },
        {
          connector: 'lark',
          posts: {
            cloud: 'feishu',
            tenantKey: 'T1',
            destinationId: 'oc_1',
            direct: false,
            openId: 'ou_1',
          },
        },
      ],
    })

    await deliverWatchSummary(ENV, OWNER, recorded())

    const slack = calls.filter((c) => c.slack)
    assert.deepEqual(slack.map((c) => c.slack), ['chat.postMessage'], 'one message, not one per card')
    assert.equal(slack[0].args.channel, 'C1')
    assert.match(JSON.stringify(slack[0].args.blocks), /Watching every release/)
    assert.match(JSON.stringify(slack[0].args.blocks), /12 cards are waiting for you/)

    const posted = calls.filter((c) => c.lark && c.args?.msg_type === 'interactive')
    assert.equal(posted.length, 1)
    assert.equal(posted[0].args.receive_id, 'oc_1')
    assert.match(posted[0].args.content, /12 cards are waiting for you/)
  })

  it('keeps going when one chat refuses it', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = []
    mock.method(globalThis, 'fetch', async (url, init) => {
      const at = String(url)
      if (at.startsWith('https://slack.com/')) {
        calls.push({ slack: true })
        return new Response(JSON.stringify({ ok: false, error: 'channel_not_found' }), { status: 200 })
      }
      if (at.includes('feishu.cn')) {
        calls.push({ lark: true })
        return new Response(
          JSON.stringify({ code: 0, msg: 'ok', tenant_access_token: 't', data: { message_id: 'om_1' } }),
          { status: 200 },
        )
      }
      const fn = at.split('/rpc/')[1]
      calls.push({ fn })
      if (fn === 'lark_tenant_token') {
        return new Response(JSON.stringify({ token: 't' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(
        JSON.stringify([
          { connector: 'slack', posts: { botToken: 'xoxb', channelId: 'C1' } },
          {
            connector: 'lark',
            posts: { cloud: 'feishu', tenantKey: 'T1', destinationId: 'oc_1', direct: false },
          },
        ]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })

    // Best effort: it never throws, and the chat that was reachable still got its copy.
    await deliverWatchSummary(ENV, OWNER, recorded())
    assert.ok(calls.some((c) => c.lark), 'a refusal in one chat cost the other its message')
  })

  it('says nothing at all when no destination is connected', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeWorld({ watch_summary_targets: [] })

    await deliverWatchSummary(ENV, OWNER, recorded())

    assert.equal(calls.filter((c) => c.slack || c.lark).length, 0)
  })
})

describe('the summary as each chat draws it', () => {
  it('names one release when that is what is watched, and offers no control', () => {
    const drawn = slackSummary({ boardName: 'ai4kanban', watching: '1.0', cards: 1 })
    assert.match(JSON.stringify(drawn.blocks), /Watching release 1\.0/)
    assert.match(JSON.stringify(drawn.blocks), /1 card is waiting for you/)
    // It belongs to no card, so there is nothing to press and nothing to open.
    assert.equal(drawn.blocks.filter((b) => b.type === 'actions').length, 0)

    const card = larkSummary({ boardName: 'ai4kanban', watching: '1.0', cards: 1 })
    assert.equal(card.header.title.content, 'Watching release 1.0')
    assert.equal(card.elements.filter((e) => e.tag === 'action').length, 0)
  })
})
