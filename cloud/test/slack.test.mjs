import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { verifySignature, slackCallback } from '../src/slack-actions.ts'
import { deliverSlack } from '../src/slack-deliver.ts'
import { answerView, bound, messageFor, mrkdwn } from '../src/slack-message.ts'

// The Worker's half of Slack (#320): what a message is made of, what a callback has to
// prove before it is acted on, and which call one event's message costs. Whose action an
// event may carry and what a revision that has moved refuses are the migration's — they
// have to hold against two surfaces pressing at once, and 0004 is where that lives.

const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'k',
  SLACK_SIGNING_SECRET: 'shhh',
}
const OWNER = '11111111-1111-4111-8111-111111111111'
const EVENT = '33333333-3333-4333-8333-333333333333'
const BOARD = '22222222-2222-4222-8222-222222222222'

const anEvent = (over = {}) => ({
  id: EVENT,
  boardId: BOARD,
  boardName: 'ai4kanban',
  taskId: 329,
  taskTitle: 'Harden the Cloud event flow',
  release: '0.8.0',
  revision: '4f2a19c',
  kind: 'ready_for_review',
  decision: 'implement',
  state: 'actionable',
  questions: [],
  summary: '',
  notes: '',
  reason: '',
  serverName: 'Wutao’s MacBook Pro',
  createdAt: '2026-08-01T10:00:00Z',
  changedAt: '2026-08-01T10:00:00Z',
  acted: false,
  ...over,
})

/** Every block of one kind, flattened to the text a reader would see. */
const textIn = (blocks) =>
  JSON.stringify(blocks)

const buttons = (blocks) =>
  blocks
    .filter((b) => b.type === 'actions')
    .flatMap((b) => b.elements)
    .map((e) => ({ label: e.text?.text, action: e.action_id, url: e.url }))

// ---------------------------------------------------------------------------
// The message
// ---------------------------------------------------------------------------

describe('messageFor', () => {
  it('offers Implement for the exact ready revision, beside the card link', () => {
    const { text, blocks } = messageFor(anEvent())

    assert.match(text, /Ready for review: #329/)
    const offered = buttons(blocks)
    assert.deepEqual(
      offered.map((b) => b.action),
      ['implement', 'open_card'],
    )
    // The revision travels with the press, so one made against a card that has since moved
    // is refused rather than granted.
    const press = blocks.find((b) => b.type === 'actions').elements[0]
    assert.deepEqual(JSON.parse(press.value), { eventId: EVENT, revision: '4f2a19c' })
    // The card link is an http address the service answers, because Slack takes no other.
    assert.match(offered[1].url, /^https:\/\/[^/]+\/card\//)
  })

  it('carries the card’s own words, as Slack’s markup rather than the board’s', () => {
    const { blocks } = messageFor(
      anEvent({
        summary: 'A task **waiting** on a decision arrives in [Slack](https://slack.com).',
        notes: '## Worth noting\n- **A Slack button decides**: it does not open the app.',
      }),
    )
    const said = textIn(blocks)
    assert.match(said, /\*waiting\*/)
    assert.doesNotMatch(said, /\*\*waiting\*\*/)
    assert.match(said, /<https:\/\/slack.com\|Slack>/)
    assert.match(said, /• \*A Slack button decides\*/)
  })

  it('names the machine a decision waits for, and says when there is none', () => {
    const waiting = messageFor(anEvent({ state: 'waiting_for_server', acted: true }))
    assert.match(textIn(waiting.blocks), /Waiting for Wutao/)
    assert.deepEqual(
      buttons(waiting.blocks).map((b) => b.action),
      ['open_card'],
      'a decided event offers no second decision',
    )

    const orphan = messageFor(anEvent({ state: 'waiting_for_server', acted: true, serverName: '' }))
    assert.match(textIn(orphan.blocks), /no machine attached/)
  })

  it('says why a delivery ended badly, and nothing where there is nothing to say', () => {
    const refused = messageFor(
      anEvent({
        state: 'failed',
        acted: true,
        reason: 'you have uncommitted changes in cli/src/lib/help.ts — commit or stash these first.',
      }),
    )
    assert.match(textIn(refused.blocks), /uncommitted changes/)

    const bare = messageFor(anEvent({ state: 'failed', acted: true }))
    assert.doesNotMatch(textIn(bare.blocks), /uncommitted/)
  })

  it('ends under the same state names every other surface shows', () => {
    for (const [state, name] of [
      ['accepted', 'Accepted'],
      ['running', 'Delivery running'],
      ['completed', 'Delivery completed'],
      ['failed', 'Delivery failed'],
      ['interrupted', 'Delivery interrupted'],
      ['cancelled', 'Delivery cancelled'],
      ['stale', 'No longer waiting'],
    ]) {
      const { text } = messageFor(anEvent({ state, acted: true }))
      assert.match(text, new RegExp(`^${name}: #329`), `${state} reads as "${name}"`)
    }
  })

  it('puts one single-choice question’s options in the message, and everything else in a modal', () => {
    const one = messageFor(
      anEvent({
        kind: 'question',
        decision: 'answer',
        questions: [
          { text: 'Which language?', mode: 'single', options: ['The app’s', 'Ask'], recommend: [2] },
        ],
      }),
    )
    // What the card recommends is a star on the option, not a sentence naming it again.
    assert.deepEqual(
      buttons(one.blocks).map((b) => b.label),
      ['The app’s', ':star: Ask', 'Open card in app'],
    )
    assert.doesNotMatch(textIn(one.blocks), /Recommended/)

    // Several questions, a multi-choice one, or one with no options: a press may not spend
    // the event's single action on one question and forfeit the rest.
    for (const questions of [
      [
        { text: 'One?', mode: 'single', options: ['a'], recommend: [] },
        { text: 'Two?', mode: 'single', options: ['b'], recommend: [] },
      ],
      [{ text: 'Which?', mode: 'multi', options: ['a', 'b'], recommend: [] }],
      [{ text: 'What happens?' }],
    ]) {
      const many = messageFor(anEvent({ kind: 'question', decision: 'answer', questions }))
      assert.deepEqual(
        buttons(many.blocks).map((b) => b.action),
        ['open_answers', 'open_card'],
      )
    }
  })

  it('stays inside Slack’s block limit', () => {
    const questions = Array.from({ length: 40 }, (_, at) => ({ text: `Question ${at}` }))
    const { blocks } = messageFor(anEvent({ kind: 'question', decision: 'answer', questions }))
    assert.ok(blocks.length <= 50, `${blocks.length} blocks`)
  })

  it('leaves what does not fit behind the card link rather than dropping it', () => {
    const long = Array.from({ length: 400 }, (_, at) => `- a note about the ${at}th thing`).join('\n')
    const { blocks } = messageFor(anEvent({ summary: long }))
    assert.match(textIn(blocks), /Trimmed to fit Slack/)
  })

  it('leads with the card, and says where it stands in one line', () => {
    const { blocks } = messageFor(anEvent())
    assert.deepEqual(blocks[0], {
      type: 'header',
      text: { type: 'plain_text', text: '#329 Harden the Cloud event flow', emoji: true },
    })
    // The state, the board and the release are one line rather than three. The revision is
    // on none of them: it binds the press, and says nothing to whoever reads the channel.
    assert.equal(blocks[1].type, 'context')
    assert.match(blocks[1].elements[0].text, /:eyes: \*Ready for review\*.+ai4kanban.+release 0\.8\.0/)
    assert.doesNotMatch(blocks[1].elements[0].text, /4f2a19c/)
  })

  it('shows what a note leads with, and leaves the argument on the card', () => {
    const notes = [
      '## Worth noting',
      '- **Nothing polls GitHub**: a maintainer imports an issue on purpose. The cost is that an',
      '  issue nobody looks at never reaches the board, which a schedule would fix at the price of',
      '  filling the board with cards nobody chose.',
    ].join('\n')
    const said = textIn(messageFor(anEvent({ notes })).blocks)
    assert.match(said, /• \*Nothing polls GitHub\*: a maintainer imports an issue on purpose\./)
    assert.doesNotMatch(said, /nobody chose/, 'the argument stays on the card')
    assert.match(said, /Trimmed to fit Slack/)
  })

  it('stops carrying the review notes once the decision is made', () => {
    const notes = '## Worth noting\n- **A note**: worth reading before deciding.'
    const open = textIn(messageFor(anEvent({ notes })).blocks)
    const settled = textIn(messageFor(anEvent({ notes, state: 'running', acted: true })).blocks)
    assert.match(open, /A note/)
    assert.doesNotMatch(settled, /A note/, 'a record of what happened is not re-reviewed')
    // Its own line is where the rest is read, so it carries no second pointer to the card.
    assert.doesNotMatch(settled, /Trimmed to fit Slack/)
    assert.match(settled, /Running on/)
  })

  it('gives a button the option’s lead and the message the whole of it', () => {
    const options = [
      'No — ship on `gh auth token` with a `GH_TOKEN` fallback; it costs us no account to keep alive',
      'Yes — register the OAuth app and enable its device flow; our name on every consent screen',
    ]
    const { blocks } = messageFor(
      anEvent({
        kind: 'question',
        decision: 'answer',
        questions: [{ text: 'Register an OAuth app?', mode: 'single', options, recommend: [1] }],
      }),
    )
    assert.deepEqual(
      buttons(blocks).map((b) => b.label),
      [':star: No', 'Yes', 'Open card in app'],
      'a 75-character cut of a sentence is not an answer anyone can read',
    )
    // Cut on the button, whole in the message: a press never means less than the card said.
    assert.match(textIn(blocks), /:star: \*1\. No\* — ship on `gh auth token`/)
  })
})

describe('answerView', () => {
  it('escapes an option where Slack reads markup, and nowhere it does not', () => {
    // A message's button is mrkdwn's neighbour and escapes what Slack reads as markup; a
    // modal's option is plain text, which would show the escape as written.
    const question = { text: 'Which one?', mode: 'single', options: ['A & B', 'C'], recommend: [1] }
    const event = anEvent({ kind: 'question', decision: 'answer', questions: [question] })

    assert.match(textIn(messageFor(event).blocks), /:star: A & B/)

    const picked = answerView(event).blocks.find((b) => b.type === 'input')?.element.options
    assert.deepEqual(
      picked.map((o) => o.text.text),
      [':star: A & B', 'C'],
      'the star marks the recommendation in the modal too',
    )
  })
})

describe('bound', () => {
  it('cuts at a bullet or paragraph boundary', () => {
    const bullets = ['- one', '- two', '- three', '- four'].join('\n')
    const cut = bound(bullets, 18)
    assert.equal(cut.cut, true)
    assert.ok(!cut.text.endsWith('thr'), 'never mid-word inside a bullet')
    assert.equal(cut.text, '- one\n- two')

    const whole = bound('short enough', 100)
    assert.deepEqual(whole, { text: 'short enough', cut: false })
  })
})

describe('mrkdwn', () => {
  it('escapes the three characters Slack reads as markup, before anything else', () => {
    assert.equal(mrkdwn('a < b & c > d'), 'a &lt; b &amp; c &gt; d')
    // A card that mentions a tag must not compose a link out of it.
    assert.equal(mrkdwn('<https://evil|click>'), '&lt;https://evil|click&gt;')
  })

  it('leaves code exactly as the card wrote it', () => {
    assert.equal(mrkdwn('run `akb implement 12` first'), 'run `akb implement 12` first')
    assert.equal(mrkdwn('`**not bold**`'), '`**not bold**`')
  })

  it('turns a heading into a line and a dash into a bullet', () => {
    assert.equal(mrkdwn('## Worth noting\n- one\n- two'), '*Worth noting*\n• one\n• two')
  })

  it('undoes the card’s own wrapping, and only inside a paragraph', () => {
    // A card is written at 100 columns; Slack keeps every one of those breaks.
    assert.equal(mrkdwn('a card wrapped\nacross two lines'), 'a card wrapped across two lines')
    assert.equal(mrkdwn('one\n\ntwo'), 'one\n\ntwo', 'a paragraph break is not a wrap')
    assert.equal(mrkdwn('## Heading\nunder it'), '*Heading*\nunder it')
    assert.equal(mrkdwn('- a note\n  wrapped\n- another'), '• a note wrapped\n• another')
  })
})

// ---------------------------------------------------------------------------
// The callback
// ---------------------------------------------------------------------------

/** Sign a body the way Slack does. */
async function sign(body, timestamp, secret = ENV.SLACK_SIGNING_SECRET) {
  const bytes = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    bytes.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, bytes.encode(`v0:${timestamp}:${body}`))
  return `v0=${[...new Uint8Array(signed)].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}

const signedRequest = async (body, { age = 0, secret } = {}) => {
  const timestamp = String(Math.floor(Date.now() / 1000) - age)
  return new Request('https://api.example/v1/slack/actions', {
    method: 'POST',
    headers: {
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': await sign(body, timestamp, secret),
    },
    body,
  })
}

describe('verifySignature', () => {
  it('accepts Slack’s own signature over the raw body', async () => {
    const body = 'payload=%7B%7D'
    await verifySignature(ENV, await signedRequest(body), body)
  })

  it('refuses one that is unsigned, signed with something else, or old enough to replay', async () => {
    const body = 'payload=%7B%7D'
    await assert.rejects(
      () =>
        verifySignature(
          ENV,
          new Request('https://api.example/', { method: 'POST', body }),
          body,
        ),
      /not signed/,
    )
    await assert.rejects(
      async () => verifySignature(ENV, await signedRequest(body, { secret: 'other' }), body),
      /signed wrongly/,
    )
    await assert.rejects(
      async () => verifySignature(ENV, await signedRequest(body, { age: 600 }), body),
      /too old/,
    )
    // A build that cannot check anything trusts nothing.
    await assert.rejects(
      async () =>
        verifySignature({ ...ENV, SLACK_SIGNING_SECRET: '' }, await signedRequest(body), body),
      /cannot verify/,
    )
  })
})

/** Stand in for PostgREST, answering one function at a time and recording every call. */
function fakeDatabase(answers) {
  const calls = []
  mock.method(globalThis, 'fetch', async (url, init) => {
    const at = String(url)
    if (at.startsWith('https://slack.com/')) {
      calls.push({ slack: at.split('/api/')[1], args: JSON.parse(init.body) })
      return new Response(JSON.stringify({ ok: true, ts: '1712.0001' }), { status: 200 })
    }
    if (at.startsWith('https://hooks.slack')) {
      calls.push({ ephemeral: JSON.parse(init.body).text })
      return new Response('ok', { status: 200 })
    }
    const fn = at.split('/rpc/')[1]
    calls.push({ fn, args: JSON.parse(init.body) })
    const answer = answers[fn]
    return new Response(JSON.stringify(answer ?? null), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  return calls
}

const ctx = () => ({ waitUntil: (promise) => promise.catch(() => undefined) })

const press = (over = {}) =>
  new URLSearchParams({
    payload: JSON.stringify({
      type: 'block_actions',
      team: { id: 'T1' },
      user: { id: 'U1' },
      response_url: 'https://hooks.slack.com/back',
      actions: [
        {
          action_id: 'implement',
          action_ts: '1712.5',
          value: JSON.stringify({ eventId: EVENT, revision: '4f2a19c' }),
        },
      ],
      ...over,
    }),
  }).toString()

describe('slackCallback', () => {
  it('records the press through the same action path a desktop click takes', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      slack_actor: { ownerId: OWNER, botToken: 'xoxb', channelId: 'C1', revoked: false },
      read_event: anEvent(),
      record_event_action: anEvent({ state: 'waiting_for_server', acted: true }),
      slack_jobs: [],
    })
    const body = press()

    const answer = await slackCallback(ENV, await signedRequest(body), ctx())

    assert.equal(answer.status, 200)
    const recorded = calls.find((c) => c.fn === 'record_event_action')
    assert.equal(recorded.args.p_subject, OWNER)
    assert.equal(recorded.args.p_decision, 'implement')
    assert.equal(recorded.args.p_revision, '4f2a19c')
    // The press was not made at the board's machine, so it leaves a claimable request.
    assert.equal(recorded.args.p_state, 'waiting_for_server')
    // A Slack retry of one press carries the same attempt id, so it is recognised rather
    // than refused as a second action.
    assert.equal(recorded.args.p_op_id, `slack:${EVENT}:1712.5`)
  })

  it('refuses an actor we have no account for, and records nothing', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({ slack_actor: null })

    await slackCallback(ENV, await signedRequest(press()), ctx())

    assert.equal(calls.some((c) => c.fn === 'record_event_action'), false)
    assert.match(calls.find((c) => c.ephemeral)?.ephemeral ?? '', /does not know who you are/)
  })

  it('refuses a press against a revision that has moved', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      slack_actor: { ownerId: OWNER, botToken: 'xoxb', channelId: 'C1', revoked: false },
      read_event: anEvent({ revision: 'moved-on' }),
    })

    await slackCallback(ENV, await signedRequest(press()), ctx())

    assert.equal(calls.some((c) => c.fn === 'record_event_action'), false)
    assert.match(calls.find((c) => c.ephemeral)?.ephemeral ?? '', /rewritten since this message/)
  })

  it('refuses a second action on one event', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      slack_actor: { ownerId: OWNER, botToken: 'xoxb', channelId: 'C1', revoked: false },
      read_event: anEvent({ acted: true }),
    })

    await slackCallback(ENV, await signedRequest(press()), ctx())

    assert.equal(calls.some((c) => c.fn === 'record_event_action'), false)
    assert.match(calls.find((c) => c.ephemeral)?.ephemeral ?? '', /already answered/)
  })

  it('recognises a replayed callback rather than acting on it twice', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      slack_actor: { ownerId: OWNER, botToken: 'xoxb', channelId: 'C1', revoked: false },
      read_event: anEvent(),
      record_event_action: anEvent({ state: 'waiting_for_server', acted: true }),
      slack_jobs: [],
    })
    const body = press()

    // The very same signed body, posted twice inside the five minutes it is good for.
    await slackCallback(ENV, await signedRequest(body), ctx())
    await slackCallback(ENV, await signedRequest(body), ctx())

    const recorded = calls.filter((c) => c.fn === 'record_event_action')
    assert.equal(recorded.length, 2)
    // One attempt id, so the second call is the first one's retry rather than a second
    // action: the database answers it with the event as it stands (0004's op_id is unique).
    assert.equal(recorded[0].args.p_op_id, recorded[1].args.p_op_id)
  })

  it('does nothing at all when the card link is what was pressed', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({})
    const body = press({ actions: [{ action_id: 'open_card' }] })

    await slackCallback(ENV, await signedRequest(body), ctx())

    assert.deepEqual(calls, [], 'reading the card is not an action on the event')
  })

  it('submits every answer the modal carried in one action', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      slack_actor: { ownerId: OWNER, botToken: 'xoxb', channelId: 'C1', revoked: false },
      read_event: anEvent({
        kind: 'question',
        decision: 'answer',
        questions: [
          { text: 'One?', mode: 'single', options: ['a', 'b'], recommend: [] },
          { text: 'Two?' },
          { text: 'Three?' },
        ],
      }),
      record_event_action: anEvent({ state: 'waiting_for_server', acted: true }),
      slack_jobs: [],
    })
    const body = new URLSearchParams({
      payload: JSON.stringify({
        type: 'view_submission',
        team: { id: 'T1' },
        user: { id: 'U1' },
        view: {
          id: 'V1',
          callback_id: 'answers',
          private_metadata: JSON.stringify({ eventId: EVENT, revision: '4f2a19c' }),
          state: {
            values: {
              q0: { answer: { selected_option: { value: '2' } } },
              q1: { answer: { value: 'my own words' } },
              q2: { answer: { value: '' } },
            },
          },
        },
      }),
    }).toString()

    const answer = await slackCallback(ENV, await signedRequest(body), ctx())

    assert.deepEqual(await answer.json(), { response_action: 'clear' })
    const recorded = calls.find((c) => c.fn === 'record_event_action')
    assert.deepEqual(recorded.args.p_answers, [
      { picked: [2], text: '' },
      { picked: [], text: 'my own words' },
      // Left alone, which is the board's own rule for a blank: the agent researches it.
      { picked: [], text: '' },
    ])
  })
})

// ---------------------------------------------------------------------------
// The delivery
// ---------------------------------------------------------------------------

describe('deliverSlack', () => {
  it('posts an event that has no message and edits the one that has', async (t) => {
    t.after(() => mock.restoreAll())
    let calls = fakeDatabase({
      slack_jobs: [
        { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T10:00:00Z', botToken: 'xoxb', channelId: 'C1', messageRef: null, attempts: 0, event: anEvent() },
      ],
      record_event_delivery: anEvent(),
    })

    let run = await deliverSlack(ENV)
    assert.deepEqual(run, { due: 1, sent: 1, failed: 0 })
    assert.equal(calls.find((c) => c.slack)?.slack, 'chat.postMessage')
    const kept = calls.find((c) => c.fn === 'record_event_delivery')
    assert.equal(kept.args.p_external_ref, '1712.0001')
    assert.equal(kept.args.p_connector, 'slack')
    // What the message shows, not when it was written: an event that moved while Slack was
    // answering is still owed a rewrite.
    assert.equal(kept.args.p_rendered_at, '2026-08-01T10:00:00Z')

    mock.restoreAll()
    calls = fakeDatabase({
      slack_jobs: [
        { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T11:00:00Z', botToken: 'xoxb', channelId: 'C1', messageRef: '1712.0001', attempts: 0, event: anEvent({ state: 'running', acted: true }) },
      ],
      record_event_delivery: anEvent(),
    })

    run = await deliverSlack(ENV, EVENT)
    assert.deepEqual(run, { due: 1, sent: 1, failed: 0 })
    // One event keeps one message however many times it moves.
    assert.equal(calls.find((c) => c.slack)?.slack, 'chat.update')
    assert.equal(calls.find((c) => c.slack)?.args.ts, '1712.0001')
  })

  // A migration and a deploy do not land together, so for one window this reads a schema
  // that names the version token the other way. Recording NULL for it would leave every
  // message in the channel due forever — rewritten on every pass until the two sides met.
  it('takes the version token under the name an older schema gives it', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      slack_jobs: [
        { ownerId: OWNER, eventId: EVENT, changedAt: '2026-08-01T10:00:00Z', botToken: 'xoxb', channelId: 'C1', messageRef: null, attempts: 0, event: anEvent() },
      ],
      record_event_delivery: anEvent(),
    })

    await deliverSlack(ENV)

    const kept = calls.find((c) => c.fn === 'record_event_delivery')
    assert.equal(kept.args.p_rendered_at, '2026-08-01T10:00:00Z')
  })

  it('shows a connection Slack has refused where it was made', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = []
    mock.method(globalThis, 'fetch', async (url, init) => {
      const at = String(url)
      if (at.startsWith('https://slack.com/')) {
        return new Response(JSON.stringify({ ok: false, error: 'not_in_channel' }), { status: 200 })
      }
      const fn = at.split('/rpc/')[1]
      calls.push({ fn, args: JSON.parse(init.body) })
      const answers = {
        slack_jobs: [
          { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T10:00:00Z', botToken: 'xoxb', channelId: 'C1', messageRef: null, attempts: 0, event: anEvent() },
        ],
      }
      return new Response(JSON.stringify(answers[fn] ?? { ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const run = await deliverSlack(ENV)

    assert.deepEqual(run, { due: 1, sent: 0, failed: 1 })
    const failed = calls.find((c) => c.fn === 'record_event_delivery')
    assert.equal(failed.args.p_state, 'failed')
    assert.equal(failed.args.p_last_error, 'not_in_channel')
    // Messages failing into silence read to the user as no work waiting, so the connection
    // says so where it was made.
    assert.equal(calls.find((c) => c.fn === 'slack_refused')?.args.p_owner, OWNER)
  })

  it('leaves a failure the user cannot fix to the next run, and the connection alone', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = []
    mock.method(globalThis, 'fetch', async (url, init) => {
      const at = String(url)
      // Slack having a bad minute — not a connection anybody has to mend.
      if (at.startsWith('https://slack.com/')) {
        return new Response(JSON.stringify({ ok: false, error: 'ratelimited' }), { status: 200 })
      }
      const fn = at.split('/rpc/')[1]
      calls.push({ fn, args: JSON.parse(init.body) })
      const answers = {
        slack_jobs: [
          { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T10:00:00Z', botToken: 'xoxb', channelId: 'C1', messageRef: null, attempts: 2, event: anEvent() },
        ],
      }
      return new Response(JSON.stringify(answers[fn] ?? { ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const run = await deliverSlack(ENV)

    assert.deepEqual(run, { due: 1, sent: 0, failed: 1 })
    const failed = calls.find((c) => c.fn === 'record_event_delivery')
    assert.equal(failed.args.p_state, 'failed')
    assert.equal(failed.args.p_last_error, 'ratelimited')
    // The delivery record counts the attempt and nothing else moves: `api.slack_jobs` hands
    // this event back to the next hourly run until SLACK_MAX_ATTEMPTS.
    assert.equal(failed.args.p_rendered_at, '2026-08-01T10:00:00Z')
    assert.equal(calls.find((c) => c.fn === 'slack_refused'), undefined)
  })

  it('costs nothing when nothing is owed', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({ slack_jobs: [] })

    assert.deepEqual(await deliverSlack(ENV), { due: 0, sent: 0, failed: 0 })
    assert.equal(calls.filter((c) => c.slack).length, 0)
  })
})
