import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { verifySignature, slackCallback } from '../src/slack-actions.ts'
import { deliverSlack } from '../src/slack-deliver.ts'
import { answerView, bound, endingFor, logFor, messageFor, mrkdwn } from '../src/slack-message.ts'

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
/** How this account's Slack connection posts, as `api.connector_jobs` answers it. */
const POSTS = { botToken: 'xoxb', channelId: 'C1' }
/** The same, once the schema names the account a reply's ask is addressed to (#352). */
const ACTOR_POSTS = { ...POSTS, actorId: 'U1' }

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
    assert.match(textIn(waiting.blocks), /On Wutao/)
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
      ['accepted', 'Starting'],
      ['running', 'Working on it'],
      ['completed', 'Landed'],
      ['failed', 'Did not land'],
      ['interrupted', 'Interrupted'],
      ['cancelled', 'Stopped'],
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
      ['The app’s', ':star: Ask', 'Something else…', 'Open card in app'],
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
    const said = textIn(blocks)

    assert.match(said, /a note about the 0th thing/)
    assert.doesNotMatch(said, /a note about the 399th thing/, 'the rest is behind the card link')
    assert.ok(buttons(blocks).some((b) => b.action === 'open_card'))
    // No message says it was trimmed: the link is on every one of them, and a line pointing
    // at a button already on the screen reads as filler.
    assert.doesNotMatch(said, /Trimmed/)
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

  it('shows a note whole, on one line', () => {
    const notes = [
      '## Worth noting',
      '- **Nothing polls GitHub**: a maintainer imports an issue on purpose. The cost is that an',
      '  issue nobody looks at never reaches the board, which a schedule would fix at the price of',
      '  filling the board with cards nobody chose.',
    ].join('\n')
    const { blocks } = messageFor(anEvent({ notes }))
    const said = blocks.find((block) => block.text?.text?.includes('Worth noting')).text.text
    // The finding and the argument for it are one thought, so the note keeps both.
    assert.match(said, /• \*Nothing polls GitHub\*: a maintainer imports an issue on purpose\./)
    assert.match(said, /filling the board with cards nobody chose\.$/)
    // What is taken out is the card's own wrapping: one note is one line, not three.
    assert.equal(said.split('\n').filter((line) => line.startsWith('• ')).length, 1)
  })

  it('stops carrying the review notes once the decision is made', () => {
    const notes = '## Worth noting\n- **A note**: worth reading before deciding.'
    const open = textIn(messageFor(anEvent({ notes })).blocks)
    const settled = textIn(messageFor(anEvent({ notes, state: 'running', acted: true })).blocks)
    assert.match(open, /A note/)
    assert.doesNotMatch(settled, /A note/, 'a record of what happened is not re-reviewed')
    assert.match(settled, /On Wutao/)
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
      [':star: No', 'Yes', 'Something else…', 'Open card in app'],
      'a 75-character cut of a sentence is not an answer anyone can read',
    )
    // Cut on the button, whole in the message: a press never means less than the card said.
    assert.match(textIn(blocks), /:star: \*1\. No\* — ship on `gh auth token`/)
  })
})

describe('logFor', () => {
  it('is one line saying which event arrived, and who it is still asking', () => {
    const { text, blocks } = logFor(anEvent(), { actorId: 'U1' })

    // No card words: the thread already opened on the card, and repeating its title, board
    // and release under itself is what made one card scroll past the channel several times.
    assert.equal(blocks.length, 1)
    assert.doesNotMatch(textIn(blocks), /Harden the Cloud event flow/)
    assert.doesNotMatch(textIn(blocks), /release 0\.8\.0/)
    // A reply pings nobody, so the one account a press is accepted from is named — in a
    // section, because a mention in a context notifies nobody.
    assert.equal(blocks[0].type, 'section')
    assert.equal(blocks[0].text.text, ':eyes: *Ready for review*  ·  <@U1>')
    // The phone still says which card it is.
    assert.equal(text, 'Ready for review: #329 Harden the Cloud event flow')
  })

  it('carries no control — every one of them is at the top of the thread', () => {
    const questions = [{ text: 'Ship it?', mode: 'single', options: ['Yes', 'No'], recommend: [1] }]
    for (const event of [anEvent(), anEvent({ kind: 'question', decision: 'answer', questions })]) {
      assert.deepEqual(buttons(logFor(event, { actorId: 'U1' }).blocks), [])
    }
  })

  it('names nobody where there is no decision left to make', () => {
    const { blocks } = logFor(anEvent({ state: 'running', acted: true }), { actorId: 'U1' })

    assert.equal(blocks[0].type, 'context')
    assert.equal(blocks[0].elements[0].text, ':hammer_and_wrench: *Working on it*')
    assert.doesNotMatch(textIn(blocks), /<@U1>/, 'a report is not an ask')
  })
})

describe('endingFor', () => {
  it('says how the delivery ended and what to do about it, in one line the card cannot take back', () => {
    const { text, blocks } = endingFor(
      anEvent({
        state: 'failed',
        acted: true,
        reason: 'you have uncommitted changes in cli/src/lib/help.ts. Commit or stash these first.',
      }),
    )

    assert.equal(blocks.length, 1)
    // A section, not a context: what to fix is the point of the line, and a context sets it
    // in the grey a reader skips.
    assert.equal(blocks[0].type, 'section')
    assert.match(blocks[0].text.text, /^:x: \*Did not land\*\n/)
    assert.match(blocks[0].text.text, /uncommitted changes/)
    // A state name and a reason say what went wrong and neither says what happens next.
    assert.match(blocks[0].text.text, /back to \*Ready for review\*\. Fix that and press \*Implement\* again/)
    // The phone says the reason too — the top message has already moved on by the time
    // anybody opens the thread.
    assert.match(text, /^Did not land: #329 .* — you have uncommitted changes/)
  })

  it('pings nobody — the fresh ask under it is what asks', () => {
    const { blocks } = endingFor(anEvent({ state: 'failed', acted: true, reason: 'it broke.' }))

    assert.doesNotMatch(textIn(blocks), /<@/)
    assert.deepEqual(buttons(blocks), [], 'every control is at the top of the thread')
  })

  it('sends whoever reads it back to the one control, where the board takes the card back', () => {
    // Nothing to fix, so nothing to fix first: the card is simply there to press again.
    const stopped = endingFor(anEvent({ state: 'cancelled', acted: true }))
    assert.match(
      stopped.blocks[0].text.text,
      /^:no_entry_sign: \*Stopped\*\nThe card is back to \*Ready for review\*\. Press \*Implement\* again/,
    )

    // Cloud is told this one only when nothing is carrying the card, so it says that and
    // sends the reader to the same button rather than to a machine with nothing left on it.
    const gone = endingFor(anEvent({ state: 'interrupted', acted: true }))
    assert.match(textIn(gone.blocks), /stopped carrying it/)
    assert.match(textIn(gone.blocks), /Press \*Implement\* again/)
  })

  it('escapes the board’s own words, which are somebody’s filenames', () => {
    const { blocks } = endingFor(
      anEvent({ state: 'failed', acted: true, reason: 'the build wrote <script> & stopped.' }),
    )

    assert.match(blocks[0].text.text, /&lt;script&gt; &amp; stopped/)
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
      [':star: A & B', 'C', "Something else — I'll type it"],
      'the star marks the recommendation in the modal too, and typing is the last choice',
    )
  })

  it('gives every question a box for the user’s own words, options or not', () => {
    const { blocks } = answerView(
      anEvent({
        kind: 'question',
        decision: 'answer',
        questions: [
          { text: 'Which one?', mode: 'single', options: ['a', 'b'], recommend: [] },
          { text: 'What happens?' },
        ],
      }),
    )
    const inputs = blocks.filter((b) => b.type === 'input')
    assert.deepEqual(
      inputs.map((b) => [b.block_id, b.element.type]),
      [
        ['q0', 'radio_buttons'],
        ['q0w', 'plain_text_input'],
        ['q1', 'plain_text_input'],
      ],
    )
    // The box under a picker is labelled with the choice it belongs to, not the question
    // again — repeating the question there reads as a second question.
    assert.equal(inputs[1].label.text, "Something else — I'll type it")
    // Nothing is ever required: a question left alone stays open for the agent.
    assert.deepEqual(
      inputs.map((b) => b.optional),
      [true, true, true],
    )
    assert.ok(blocks.length <= 50, `${blocks.length} blocks`)
  })

  it('keeps a card of options questions inside Slack’s block limit', () => {
    const questions = Array.from({ length: 40 }, (_, at) => ({
      text: `Question ${at}`,
      mode: 'single',
      options: ['a', 'b'],
      recommend: [],
    }))
    const { blocks } = answerView(anEvent({ kind: 'question', decision: 'answer', questions }))
    assert.ok(blocks.length <= 50, `${blocks.length} blocks`)
    // What did not fit is said rather than dropped quietly.
    assert.match(JSON.stringify(blocks.at(-1)), /more on the card/)
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
function fakeDatabase(answers, refuses = () => '') {
  const calls = []
  // A `ts` per message posted, so a card's own message and the replies under it can be told
  // apart. `refuses` is the Slack error one call answers with, and '' for the ones that work.
  let posted = 0
  mock.method(globalThis, 'fetch', async (url, init) => {
    const at = String(url)
    if (at.startsWith('https://slack.com/')) {
      const api = at.split('/api/')[1]
      const args = JSON.parse(init.body)
      calls.push({ slack: api, args })
      const error = refuses(api, args)
      if (error) return new Response(JSON.stringify({ ok: false, error }), { status: 200 })
      if (api === 'chat.postMessage') posted += 1
      return new Response(JSON.stringify({ ok: true, ts: `1712.000${posted}` }), { status: 200 })
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
      connector_jobs: [],
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
      connector_jobs: [],
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
      connector_jobs: [],
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

  it('takes an options question’s own words over the choices the card wrote', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      slack_actor: { ownerId: OWNER, botToken: 'xoxb', channelId: 'C1', revoked: false },
      read_event: anEvent({
        kind: 'question',
        decision: 'answer',
        questions: [{ text: 'Which one?', mode: 'single', options: ['a', 'b'], recommend: [] }],
      }),
      record_event_action: anEvent({ state: 'waiting_for_server', acted: true }),
      connector_jobs: [],
    })

    const answer = await slackCallback(ENV, await signedRequest(submission({
      // "Something else" carries one past the card's options, so it is never a pick.
      q0: { answer: { selected_option: { value: '3' } } },
      q0w: { answer: { value: 'neither — do the third thing' } },
    })), ctx())

    assert.deepEqual(await answer.json(), { response_action: 'clear' })
    const recorded = calls.find((c) => c.fn === 'record_event_action')
    assert.deepEqual(recorded.args.p_answers, [
      { picked: [], text: 'neither — do the third thing' },
    ])
  })

  it('refuses a pick and words together, on the box, rather than dropping the words', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      slack_actor: { ownerId: OWNER, botToken: 'xoxb', channelId: 'C1', revoked: false },
      read_event: anEvent({
        kind: 'question',
        decision: 'answer',
        questions: [{ text: 'Which one?', mode: 'single', options: ['a', 'b'], recommend: [] }],
      }),
      record_event_action: anEvent({ state: 'waiting_for_server', acted: true }),
      connector_jobs: [],
    })

    const answer = await slackCallback(ENV, await signedRequest(submission({
      q0: { answer: { selected_option: { value: '1' } } },
      q0w: { answer: { value: 'actually, something else' } },
    })), ctx())

    const said = await answer.json()
    assert.equal(said.response_action, 'errors')
    assert.match(said.errors.q0w, /not both/)
    assert.equal(calls.find((c) => c.fn === 'record_event_action'), undefined)
  })
})

/** A modal submission carrying exactly these blocks. */
const submission = (values) =>
  new URLSearchParams({
    payload: JSON.stringify({
      type: 'view_submission',
      team: { id: 'T1' },
      user: { id: 'U1' },
      view: {
        id: 'V1',
        callback_id: 'answers',
        private_metadata: JSON.stringify({ eventId: EVENT, revision: '4f2a19c' }),
        state: { values },
      },
    }),
  }).toString()

// ---------------------------------------------------------------------------
// The delivery
// ---------------------------------------------------------------------------


/** One message a connector owes, as `api.connector_jobs` answers it. `card` follows the event
 *  unless a test says otherwise — a card whose newest event is the one being delivered. */
function aJob(over = {}) {
  const job = {
    ownerId: OWNER,
    eventId: EVENT,
    contentAt: '2026-08-01T10:00:00Z',
    posts: ACTOR_POSTS,
    messageRef: null,
    endingRef: null,
    cardRef: null,
    attempts: 0,
    event: anEvent(),
    ...over,
  }
  return { card: job.event, ...job }
}

describe('deliverSlack', () => {
  it('posts the card, then logs the event underneath it', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [aJob()],
      record_event_delivery: anEvent(),
    })

    assert.deepEqual(await deliverSlack(ENV), { due: 1, sent: 1, failed: 0 })

    const wrote = calls.filter((c) => c.slack)
    assert.deepEqual(wrote.map((w) => w.slack), ['chat.postMessage', 'chat.postMessage'])
    // The card first, at the top level, carrying the whole card and its controls.
    assert.equal(wrote[0].args.thread_ts, undefined)
    assert.equal(wrote[0].args.blocks[0].type, 'header')
    assert.deepEqual(buttons(wrote[0].args.blocks).map((b) => b.action), ['implement', 'open_card'])
    // Then one line under it, which is what pings the account Slack was connected as.
    assert.equal(wrote[1].args.thread_ts, '1712.0001')
    assert.equal(wrote[1].args.blocks.length, 1)
    assert.match(wrote[1].args.blocks[0].text.text, /<@U1>/)
    // A broadcast reply is a reference carrying no buttons: it would put the card's bulk back
    // in the timeline and take the decision out of the thread.
    assert.equal(wrote[1].args.reply_broadcast, undefined)

    // The card's message is recorded on its own — per board and task, not per event, and the
    // moment Slack answers rather than with the event's delivery.
    const card = calls.find((c) => c.fn === 'record_card_message')
    assert.equal(card.args.p_board, BOARD)
    assert.equal(card.args.p_task_id, 329)
    assert.equal(card.args.p_connector, 'slack')
    assert.equal(card.args.p_external_ref, '1712.0001')
    // The event's own delivery keeps the reply, and the version the card's message shows.
    const kept = calls.find((c) => c.fn === 'record_event_delivery')
    assert.equal(kept.args.p_external_ref, '1712.0002')
    assert.equal(kept.args.p_connector, 'slack')
    assert.equal(kept.args.p_rendered_at, '2026-08-01T10:00:00Z')
  })

  it('rewrites the card’s message as the card moves, and never the reply already posted', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        aJob({
          contentAt: '2026-08-01T11:00:00Z',
          messageRef: '1712.0002',
          cardRef: '1712.0001',
          event: anEvent({ state: 'running', acted: true }),
        }),
      ],
      record_event_delivery: anEvent(),
    })

    assert.deepEqual(await deliverSlack(ENV, EVENT), { due: 1, sent: 1, failed: 0 })

    const wrote = calls.filter((c) => c.slack)
    assert.deepEqual(wrote.map((w) => w.slack), ['chat.update'], 'a reply is written once')
    assert.equal(wrote[0].args.ts, '1712.0001')
    assert.equal(wrote[0].args.blocks[0].type, 'header')
    assert.match(textIn(wrote[0].args.blocks), /Working on it/)
    // The reply keeps its own timestamp, which is when that event arrived, and the card keeps
    // the message it already has.
    assert.equal(calls.find((c) => c.fn === 'record_event_delivery').args.p_external_ref, '1712.0002')
    assert.equal(calls.find((c) => c.fn === 'record_card_message'), undefined)
  })

  it('draws the card from its newest event, not from the one being delivered', async (t) => {
    t.after(() => mock.restoreAll())
    const SECOND = '44444444-4444-4444-8444-444444444444'
    const asking = anEvent({
      id: SECOND,
      kind: 'question',
      decision: 'answer',
      questions: [{ text: 'Ship it?', mode: 'single', options: ['Yes', 'No'], recommend: [1] }],
    })
    const calls = fakeDatabase({
      // The card's first event, long settled, redrawn because a pass came round to it.
      connector_jobs: [
        aJob({
          messageRef: '1712.0002',
          cardRef: '1712.0001',
          event: anEvent({ state: 'completed', acted: true }),
          card: asking,
        }),
      ],
      record_event_delivery: anEvent(),
    })

    await deliverSlack(ENV)

    const edited = calls.find((c) => c.slack === 'chat.update')
    assert.equal(edited.args.ts, '1712.0001')
    // The card is asking again, so that is what the top of the thread says — and the press it
    // offers binds the event that is asking.
    const said = textIn(edited.args.blocks)
    assert.match(said, /Question waiting/)
    assert.doesNotMatch(said, /Landed/)
    assert.deepEqual(
      buttons(edited.args.blocks).map((b) => b.action),
      ['answer_option:0:1', 'answer_option:0:2', 'open_answers', 'open_card'],
    )
  })

  it('shows a settled card where it ended, and none of the questions it answered', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        aJob({
          messageRef: '1712.9002',
          cardRef: '1712.9001',
          event: anEvent({
            kind: 'question',
            decision: 'answer',
            questions: [{ text: 'Ship it?', mode: 'single', options: ['Yes', 'No'], recommend: [] }],
            state: 'completed',
            acted: true,
          }),
        }),
      ],
      record_event_delivery: anEvent(),
    })

    await deliverSlack(ENV)

    // `completed` is where the card stopped, so it is drawn — the endings the board takes the
    // card back from are the ones that are not.
    const edited = calls.find((c) => c.slack === 'chat.update')
    const said = textIn(edited.args.blocks)
    assert.match(said, /Landed/)
    assert.doesNotMatch(said, /Ship it\?/, 'a settled card re-asks nothing')
    assert.deepEqual(buttons(edited.args.blocks).map((b) => b.action), ['open_card'])
  })

  it('never draws an ending the board takes the card back from at the top', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        aJob({
          contentAt: '2026-08-01T12:00:00Z',
          messageRef: '1712.9002',
          cardRef: '1712.9001',
          event: anEvent({ state: 'cancelled', acted: true }),
        }),
      ],
      record_event_delivery: anEvent(),
    })

    assert.deepEqual(await deliverSlack(ENV), { due: 1, sent: 1, failed: 0 })

    // The card is back to `ready` seconds later, so drawing this at the top would leave the
    // one message every control lives on offering none for as long as that takes. The reply
    // is where it goes, and the next event is what redraws the top.
    const wrote = calls.filter((c) => c.slack)
    assert.deepEqual(wrote.map((w) => w.slack), ['chat.postMessage'])
    assert.equal(wrote[0].args.thread_ts, '1712.9001')
    assert.match(textIn(wrote[0].args.blocks), /Press \*Implement\* again at the top of this thread/)
  })

  it('logs how a delivery ended, under the card, and records that line on its own', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        aJob({
          contentAt: '2026-08-01T12:00:00Z',
          messageRef: '1712.9002',
          cardRef: '1712.9001',
          event: anEvent({
            state: 'failed',
            acted: true,
            reason: 'you have uncommitted changes in kanban-ui/components/Cloud.tsx.',
          }),
        }),
      ],
      record_event_delivery: anEvent(),
    })

    assert.deepEqual(await deliverSlack(ENV), { due: 1, sent: 1, failed: 0 })

    const wrote = calls.filter((c) => c.slack)
    assert.deepEqual(wrote.map((w) => w.slack), ['chat.postMessage'], 'the top is left as it was')
    // The reason goes where the next rewrite cannot reach it, with the card link's own
    // control named rather than repeated down here.
    assert.equal(wrote[0].args.thread_ts, '1712.9001')
    assert.match(textIn(wrote[0].args.blocks), /uncommitted changes/)
    assert.deepEqual(buttons(wrote[0].args.blocks), [])
    // Recorded the moment Slack answers, against this event's delivery, so an hour's retry
    // does not log the same ending twice.
    const ended = calls.find((c) => c.fn === 'record_delivery_ending')
    assert.equal(ended.args.p_event, EVENT)
    assert.equal(ended.args.p_connector, 'slack')
    assert.equal(ended.args.p_external_ref, '1712.0001')
    // The event's own reply is untouched — it said the event arrived and still does.
    assert.equal(calls.find((c) => c.fn === 'record_event_delivery').args.p_external_ref, '1712.9002')
  })

  it('logs the event’s arrival before how it ended', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        aJob({ event: anEvent({ state: 'failed', acted: true, reason: 'the approval was refused.' }) }),
      ],
      record_event_delivery: anEvent(),
    })

    await deliverSlack(ENV)

    // A pass the batch limit cut short can reach an event only once it has already ended, and
    // a thread that says how something finished before it says it arrived reads backwards.
    const said = calls.filter((c) => c.slack).map((c) => textIn(c.args.blocks ?? []))
    assert.equal(said.length, 3)
    assert.match(said[1], /Did not land/)
    assert.doesNotMatch(said[1], /approval was refused/, 'the arrival line carries no reason')
    assert.match(said[2], /approval was refused/)
  })

  it('never logs one ending twice, and logs none for a delivery that landed', async (t) => {
    t.after(() => mock.restoreAll())
    const settled = { messageRef: '1712.9002', cardRef: '1712.9001' }
    const calls = fakeDatabase({
      connector_jobs: [
        // Already logged.
        aJob({
          ...settled,
          endingRef: '1712.0003',
          event: anEvent({ state: 'failed', acted: true, reason: 'it broke.' }),
        }),
        // Landed, so the top message goes on saying so and the thread stays quiet.
        aJob({ ...settled, eventId: '55555555-5555-4555-8555-555555555555', event: anEvent({ state: 'completed', acted: true }) }),
        // A schema older than 0014 keeps no reference, so it is never told to post one.
        aJob({ ...settled, eventId: '66666666-6666-4666-8666-666666666666', endingRef: undefined, event: anEvent({ state: 'failed', acted: true, reason: 'it broke.' }) }),
      ],
      record_event_delivery: anEvent(),
    })

    assert.deepEqual(await deliverSlack(ENV), { due: 3, sent: 3, failed: 0 })

    const wrote = calls.filter((c) => c.slack)
    assert.deepEqual(wrote.map((w) => w.slack), ['chat.update'], 'the card is redrawn once a pass')
    assert.equal(calls.find((c) => c.fn === 'record_delivery_ending'), undefined)
  })

  it('holds the card’s message, so its two events in one pass share it', async (t) => {
    t.after(() => mock.restoreAll())
    const SECOND = '44444444-4444-4444-8444-444444444444'
    const asking = anEvent({ id: SECOND, kind: 'question', decision: 'answer' })
    const calls = fakeDatabase({
      // Both read the same `cardRef` — the one the database held before either was written.
      connector_jobs: [
        aJob({ card: asking }),
        aJob({ eventId: SECOND, contentAt: '2026-08-01T10:05:00Z', event: asking, card: asking }),
      ],
      record_event_delivery: anEvent(),
    })

    assert.deepEqual(await deliverSlack(ENV), { due: 2, sent: 2, failed: 0 })

    const wrote = calls.filter((c) => c.slack)
    assert.equal(wrote.length, 3, 'one card message and one reply per event')
    assert.equal(wrote[0].args.thread_ts, undefined)
    assert.equal(wrote[1].args.thread_ts, '1712.0001')
    assert.equal(wrote[2].args.thread_ts, '1712.0001')
    // Drawn once, recorded once: the second event neither opens a message nor redraws the one
    // the first just drew.
    assert.equal(calls.filter((c) => c.fn === 'record_card_message').length, 1)
  })

  // A migration and a deploy do not land together, so for one window this reads a schema
  // that names the version token the other way — and sends no newest event, where the one
  // being delivered is the whole of the card there is.
  it('takes the version token under the name an older schema gives it', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, changedAt: '2026-08-01T10:00:00Z', posts: POSTS, messageRef: null, attempts: 0, event: anEvent() },
      ],
      record_event_delivery: anEvent(),
    })

    await deliverSlack(ENV)

    const kept = calls.find((c) => c.fn === 'record_event_delivery')
    assert.equal(kept.args.p_rendered_at, '2026-08-01T10:00:00Z')
    assert.equal(calls.find((c) => c.slack).args.blocks[0].type, 'header')
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
      const answers = { connector_jobs: [aJob()] }
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
      const answers = { connector_jobs: [aJob({ attempts: 2 })] }
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
    // The delivery record counts the attempt and nothing else moves: `api.connector_jobs`
    // hands this event back to the next hourly run until SLACK_MAX_ATTEMPTS.
    assert.equal(failed.args.p_rendered_at, '2026-08-01T10:00:00Z')
    assert.equal(calls.find((c) => c.fn === 'slack_refused'), undefined)
  })

  it('posts the card afresh when Slack no longer has the one recorded', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase(
      { connector_jobs: [aJob({ cardRef: '1712.0001' })], record_event_delivery: anEvent() },
      // Somebody deleted the card's message in the channel.
      (api) => (api === 'chat.update' ? 'message_not_found' : ''),
    )

    assert.deepEqual(await deliverSlack(ENV), { due: 1, sent: 1, failed: 0 })

    const wrote = calls.filter((c) => c.slack)
    assert.deepEqual(
      wrote.map((w) => w.slack),
      ['chat.update', 'chat.postMessage', 'chat.postMessage'],
    )
    assert.equal(wrote[1].args.thread_ts, undefined, 'the card opens a thread of its own again')
    assert.equal(wrote[1].args.blocks[0].type, 'header')
    assert.equal(wrote[2].args.thread_ts, '1712.0001')
    assert.equal(calls.find((c) => c.fn === 'record_card_message').args.p_external_ref, '1712.0001')
  })

  it('posts the card afresh when Slack will not reply under the one it has', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase(
      { connector_jobs: [aJob({ cardRef: '1712.9999' })], record_event_delivery: anEvent() },
      // The message is still there and still editable, and Slack will not thread under it.
      (api, args) =>
        api === 'chat.postMessage' && args.thread_ts === '1712.9999' ? 'cannot_reply_to_message' : '',
    )

    assert.deepEqual(await deliverSlack(ENV), { due: 1, sent: 1, failed: 0 })

    const wrote = calls.filter((c) => c.slack)
    assert.deepEqual(
      wrote.map((w) => w.slack),
      ['chat.update', 'chat.postMessage', 'chat.postMessage', 'chat.postMessage'],
    )
    assert.equal(wrote[2].args.thread_ts, undefined, 'the card is posted again')
    assert.equal(wrote[3].args.thread_ts, '1712.0001', 'and the event is logged under that one')
    assert.equal(calls.find((c) => c.fn === 'record_card_message').args.p_external_ref, '1712.0001')
  })

  it('costs nothing when nothing is owed', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({ connector_jobs: [] })

    assert.deepEqual(await deliverSlack(ENV), { due: 0, sent: 0, failed: 0 })
    assert.equal(calls.filter((c) => c.slack).length, 0)
  })
})
