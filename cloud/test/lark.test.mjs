import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { larkCallback, verifySignature } from '../src/lark-actions.ts'
import { deliverLark } from '../src/lark-deliver.ts'
import { cardFor, larkMd } from '../src/lark-message.ts'

// The Worker's half of Lark (#351): what a card is made of, what a callback has to prove
// before it is acted on, and which call one event's message costs. Whose action an event may
// carry and what a revision that has moved refuses are the migration's — they have to hold
// against two connectors pressing at once, and 0004 is where that lives.

const ENCRYPT_KEY = 'a-shared-encrypt-key'
const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'k',
  FEISHU_APP_ID: 'cli_feishu',
  FEISHU_APP_SECRET: 's',
  FEISHU_ENCRYPT_KEY: ENCRYPT_KEY,
}
const OWNER = '11111111-1111-4111-8111-111111111111'
const EVENT = '33333333-3333-4333-8333-333333333333'
const BOARD = '22222222-2222-4222-8222-222222222222'
/** How this account's Lark connection posts, as `api.connector_jobs` answers it. */
const POSTS = { cloud: 'feishu', tenantKey: 'T1', destinationId: 'oc_1', direct: false }
/** The same, once the schema names the account a reply's ask is addressed to (#353). */
const TOPIC_POSTS = { ...POSTS, openId: 'ou_1' }
const ACTOR = { ownerId: OWNER, cloud: 'feishu', revoked: false }

const anEvent = (over = {}) => ({
  id: EVENT,
  boardId: BOARD,
  boardName: 'ai4kanban',
  taskId: 351,
  taskTitle: 'Act on Cloud task events from Lark',
  release: '0.8.0',
  revision: '4f2a19c',
  kind: 'ready_for_review',
  decision: 'implement',
  state: 'actionable',
  questions: [],
  summary: '',
  notes: '',
  serverName: 'Wutao’s MacBook Pro',
  createdAt: '2026-08-01T10:00:00Z',
  changedAt: '2026-08-01T10:00:00Z',
  acted: false,
  ...over,
})

const said = (card) => JSON.stringify(card)

/** Every button on the card, flattened to what a reader presses. */
const buttons = (card) =>
  card.elements
    .filter((e) => e.tag === 'action')
    .flatMap((e) => e.actions)
    .map((b) => ({ label: b.text?.content, value: b.value, url: b.url }))

const form = (card) => card.elements.find((e) => e.tag === 'form')

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

describe('cardFor', () => {
  it('offers Implement for the exact ready revision, beside the card link', () => {
    const card = cardFor(anEvent())

    assert.match(card.header.title.content, /^#351 /)
    // Without `update_multi` a card in a group cannot be edited, and one event would leave a
    // chat a message per state it passed through.
    assert.equal(card.config.update_multi, true)

    const offered = buttons(card)
    assert.equal(offered[0].label, 'Implement')
    // The revision travels with the press, so one made against a card that has since moved
    // is refused rather than granted.
    assert.deepEqual(offered[0].value, { a: 'implement', eventId: EVENT, revision: '4f2a19c' })
    // The card link is an http address the service answers, because Lark takes no other.
    assert.match(offered[1].url, /^https:\/\/[^/]+\/card\//)
  })

  it('carries the card’s own words, as Lark’s markup rather than the board’s', () => {
    const card = cardFor(
      anEvent({
        summary: 'A task **waiting** on a decision arrives in [Lark](https://larksuite.com).',
        notes: '## Worth noting\n- **A Lark button decides**: it does not open the app.',
      }),
    )
    const shown = said(card)
    assert.match(shown, /\*\*waiting\*\*/)
    assert.match(shown, /\[Lark\]\(https:\/\/larksuite.com\)/)
    // A heading is a line rather than a size, and a list is a bullet rather than a syntax.
    assert.doesNotMatch(shown, /## Worth noting/)
    assert.match(shown, /• \*\*A Lark button decides\*\*/)
  })

  it('says only where a reply stands, and who it is still asking', () => {
    const card = cardFor(anEvent(), { openId: 'ou_1' })

    // The chat list and a phone's notification have nowhere but the title to name the card,
    // so a reply keeps it. The board and release, which the topic already opened on, go.
    assert.match(card.header.title.content, /^#351 /)
    assert.doesNotMatch(said(card), /release 0\.8\.0/)
    // A topic reply subscribes nobody, so the one account a press is accepted from is named —
    // in a `div`, because a mention in a `note` notifies nobody.
    assert.equal(card.elements[0].tag, 'div')
    assert.equal(card.elements[0].text.content, '👀 **Ready for review**  ·  <at id="ou_1"></at>')
    // And the decision is still in the reply.
    assert.deepEqual(
      buttons(card).map((b) => b.label),
      ['Implement', 'Open card in app'],
    )
  })

  it('names nobody in a reply with no decision left to make', () => {
    const card = cardFor(anEvent({ state: 'running', acted: true }), { openId: 'ou_1' })

    assert.equal(card.elements[0].tag, 'note')
    assert.equal(card.elements[0].elements[0].content, '🛠️ **Working on it**')
    assert.doesNotMatch(said(card), /<at /, 'a report is not an ask')
  })

  it('names the machine a decision waits for, and says when there is none', () => {
    const waiting = cardFor(anEvent({ state: 'waiting_for_server', acted: true }))
    assert.match(said(waiting), /On Wutao/)
    assert.deepEqual(
      buttons(waiting).map((b) => b.label),
      ['Open card in app'],
      'a decided event offers no second decision',
    )

    const orphan = cardFor(anEvent({ state: 'waiting_for_server', acted: true, serverName: '' }))
    assert.match(said(orphan), /no machine attached/)
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
      const card = cardFor(anEvent({ state, acted: true }))
      assert.match(said(card), new RegExp(`\\*\\*${name}\\*\\*`), `${state} reads as "${name}"`)
    }
  })

  it('puts one single-choice question’s options on buttons, and everything else in a form', () => {
    const one = cardFor(
      anEvent({
        kind: 'question',
        decision: 'answer',
        questions: [{ text: 'Which cloud?', mode: 'single', options: ['飞书', 'Lark'], recommend: [1] }],
      }),
    )
    assert.deepEqual(
      buttons(one).map((b) => b.label),
      ['⭐ 飞书', 'Lark', 'Open card in app'],
    )
    // A button cannot carry words, so the way past the card's own options is a box — the
    // same field the full form writes it in.
    assert.deepEqual(
      form(one).elements.map((e) => [e.name, e.tag]),
      [
        ['q0w', 'input'],
        ['submit', 'button'],
      ],
    )
    assert.deepEqual(buttons(one)[1].value, {
      a: 'option',
      q: 0,
      o: 2,
      eventId: EVENT,
      revision: '4f2a19c',
    })

    const many = cardFor(
      anEvent({
        kind: 'question',
        decision: 'answer',
        questions: [
          { text: 'One?', mode: 'single', options: ['a', 'b'], recommend: [] },
          { text: 'Two?' },
        ],
      }),
    )
    const held = form(many)
    // Every question in one form: Cloud records one action per event, so a press may not
    // spend it on the first question and forfeit the rest.
    assert.equal(held.name, 'answers')
    assert.deepEqual(
      held.elements.filter((e) => e.name).map((e) => [e.name, e.tag]),
      [
        ['q0', 'select_static'],
        ['q0w', 'input'],
        ['q1', 'input'],
        ['submit', 'button'],
      ],
    )
    assert.equal(held.elements.at(-1).action_type, 'form_submit')
    // Neither control is required: a question left alone stays open for the agent.
    assert.equal(held.elements.find((e) => e.name === 'q0').required, false)
  })

  it('cuts what does not fit at a boundary and leaves the rest behind the card link', () => {
    const card = cardFor(
      anEvent({
        summary: `${'A sentence about the work. '.repeat(60)}`,
        notes: `${'- **A note**: a paragraph about it that runs on and on.\n'.repeat(40)}`,
      }),
    )
    const shown = said(card)
    assert.match(shown, /\/card\//, 'the rest is behind the card link')
    // No message says it was trimmed: the link is on every one of them, and a line pointing
    // at a button already on the screen reads as filler.
    assert.doesNotMatch(shown, /Trimmed/)
    // Nothing is left half-emphasised: a stray `**` on the page reads as a bug.
    for (const element of card.elements) {
      const content = element.text?.content ?? element.elements?.[0]?.content ?? ''
      assert.equal((content.match(/\*\*/g) ?? []).length % 2, 0, content.slice(0, 60))
    }
  })
})

describe('larkMd', () => {
  it('leaves what Lark already understands and fixes what it does not', () => {
    assert.equal(larkMd('**bold** and *thin* and [a](b)'), '**bold** and *thin* and [a](b)')
    assert.equal(larkMd('# Heading'), '**Heading**')
    assert.equal(larkMd('- one\n- two'), '• one\n• two')
    // A card written at 100 columns must not arrive on a phone broken every eight words.
    assert.equal(larkMd('a wrapped\nparagraph'), 'a wrapped paragraph')
    // Code travels as the card meant it, literally.
    assert.equal(larkMd('run `- x` now'), 'run `- x` now')
  })
})

// ---------------------------------------------------------------------------
// The callback
// ---------------------------------------------------------------------------

const bytes = new TextEncoder()

const hex = (buffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** One callback as Lark sends it: encrypted under the Encrypt Key, and signed over the
 *  timestamp, the nonce, that key and the body it is about to post. */
async function sealed(payload, { key = ENCRYPT_KEY, signWith, age = 0, sign = true } = {}) {
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const digest = await crypto.subtle.digest('SHA-256', bytes.encode(key))
  const aes = await crypto.subtle.importKey('raw', digest, { name: 'AES-CBC' }, false, ['encrypt'])
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, aes, bytes.encode(JSON.stringify(payload))),
  )
  const joined = new Uint8Array(iv.length + cipher.length)
  joined.set(iv)
  joined.set(cipher, iv.length)
  const body = JSON.stringify({ encrypt: btoa(String.fromCharCode(...joined)) })

  const timestamp = String(Math.floor(Date.now() / 1000) - age)
  const nonce = 'nonce-1'
  const headers = {}
  if (sign) {
    headers['x-lark-request-timestamp'] = timestamp
    headers['x-lark-request-nonce'] = nonce
    headers['x-lark-signature'] = hex(
      await crypto.subtle.digest(
        'SHA-256',
        bytes.encode(`${timestamp}${nonce}${signWith ?? key}${body}`),
      ),
    )
  }
  return new Request('https://api.example/v1/lark/feishu/callback', {
    method: 'POST',
    headers,
    body,
  })
}

/** Stand in for PostgREST and for Lark, answering one function at a time and recording every
 *  call. */
function fakeDatabase(answers) {
  const calls = []
  mock.method(globalThis, 'fetch', async (url, init) => {
    const at = String(url)
    if (at.startsWith('https://open.feishu.cn/') || at.startsWith('https://open.larksuite.com/')) {
      calls.push({ lark: at.split('/open-apis/')[1], method: init.method, args: JSON.parse(init.body ?? '{}') })
      const refusal = answers.__lark
      if (refusal) return new Response(JSON.stringify(refusal), { status: 200 })
      return new Response(JSON.stringify({ code: 0, data: { message_id: 'om_1' } }), { status: 200 })
    }
    const fn = at.split('/rpc/')[1]
    calls.push({ fn, args: JSON.parse(init.body) })
    // `{ __refused: { code, message } }` is the schema raising one of its own SQLSTATEs, which
    // is how a second action on one event reaches the Worker.
    const held = answers[fn]
    if (held?.__refused) {
      return new Response(JSON.stringify(held.__refused), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      })
    }
    return new Response(JSON.stringify(held ?? null), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  return calls
}

const ctx = () => ({ waitUntil: (promise) => promise.catch(() => undefined) })

const press = (over = {}) => ({
  schema: '2.0',
  header: {
    event_id: 'cb-1',
    event_type: 'card.action.trigger',
    tenant_key: 'T1',
    app_id: 'cli_feishu',
  },
  event: {
    operator: { tenant_key: 'T1', open_id: 'ou_1', union_id: 'on_1' },
    action: { tag: 'button', value: { a: 'implement', eventId: EVENT, revision: '4f2a19c' } },
    context: { open_chat_id: 'oc_1' },
    ...over,
  },
})

describe('verifySignature', () => {
  it('accepts Lark’s own signature over the raw body', async () => {
    const request = await sealed(press())
    await verifySignature(request, await request.clone().text(), ENCRYPT_KEY)
  })

  it('refuses one that is unsigned, signed with something else, or old enough to replay', async () => {
    const unsigned = await sealed(press(), { sign: false })
    await assert.rejects(
      () => verifySignature(unsigned, '', ENCRYPT_KEY),
      /not signed/,
    )
    const wrong = await sealed(press(), { signWith: 'somebody else’s key' })
    await assert.rejects(
      async () => verifySignature(wrong, await wrong.clone().text(), ENCRYPT_KEY),
      /signed wrongly/,
    )
    const old = await sealed(press(), { age: 600 })
    await assert.rejects(
      async () => verifySignature(old, await old.clone().text(), ENCRYPT_KEY),
      /too old/,
    )
  })
})

describe('larkCallback', () => {
  it('answers Lark’s challenge before it is sent anything', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({})

    const answer = await larkCallback(
      ENV,
      'feishu',
      await sealed({ type: 'url_verification', challenge: 'c-1', token: 'v' }),
      ctx(),
    )

    assert.deepEqual(await answer.json(), { challenge: 'c-1' })
    assert.deepEqual(calls, [], 'confirming an address touches nothing')
  })

  it('answers the challenge Lark sends unsigned, and nothing else unsigned', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({})

    // Lark confirms an address without signing it, whatever the Encrypt Key is set to.
    const answer = await larkCallback(
      ENV,
      'feishu',
      await sealed({ type: 'url_verification', challenge: 'c-2', token: 'v' }, { sign: false }),
      ctx(),
    )
    assert.deepEqual(await answer.json(), { challenge: 'c-2' })

    // Everything past the confirmation still has to be signed, and a body encrypted under
    // somebody else's key is not readable in the first place.
    await assert.rejects(
      async () => larkCallback(ENV, 'feishu', await sealed(press(), { sign: false }), ctx()),
      /not signed/,
    )
    await assert.rejects(
      async () =>
        larkCallback(
          ENV,
          'feishu',
          await sealed({ type: 'url_verification', challenge: 'c-3' }, {
            key: 'somebody else’s key',
            sign: false,
          }),
          ctx(),
        ),
      /could not be decrypted|no readable payload/,
    )
    assert.deepEqual(calls, [], 'none of that touches the database')
  })

  it('holds the app ticket the platform pushes', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({})

    await larkCallback(
      ENV,
      'feishu',
      await sealed({
        schema: '2.0',
        header: { event_type: 'application.app_ticket', event_id: 'p-1' },
        event: { app_id: 'cli_feishu', app_ticket: 'ticket-1' },
      }),
      ctx(),
    )

    const held = calls.find((c) => c.fn === 'lark_app_ticket_pushed')
    assert.equal(held.args.p_cloud, 'feishu')
    assert.equal(held.args.p_app_ticket, 'ticket-1')
  })

  it('refuses a callback that is not encrypted, and a build that cannot check one', async (t) => {
    t.after(() => mock.restoreAll())
    fakeDatabase({})

    await assert.rejects(
      () =>
        larkCallback(
          ENV,
          'feishu',
          new Request('https://api.example/', {
            method: 'POST',
            headers: {
              'x-lark-request-timestamp': String(Math.floor(Date.now() / 1000)),
              'x-lark-request-nonce': 'n',
              'x-lark-signature': 'nope',
            },
            body: '{"type":"url_verification","challenge":"c"}',
          }),
          ctx(),
        ),
      /signed wrongly/,
    )

    // A build carrying no app for that cloud trusts nothing rather than trusting it blind.
    await assert.rejects(
      async () => larkCallback({ ...ENV, FEISHU_ENCRYPT_KEY: '' }, 'feishu', await sealed(press()), ctx()),
      /cannot verify/,
    )
  })

  it('records the press through the same action path a desktop click takes', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      lark_actor: ACTOR,
      read_event: anEvent(),
      record_event_action: anEvent({ state: 'waiting_for_server', acted: true }),
      connector_jobs: [],
    })

    const answer = await larkCallback(ENV, 'feishu', await sealed(press()), ctx())

    assert.equal(answer.status, 200)
    assert.equal((await answer.json()).toast.type, 'success')
    const recorded = calls.find((c) => c.fn === 'record_event_action')
    assert.equal(recorded.args.p_subject, OWNER)
    assert.equal(recorded.args.p_decision, 'implement')
    assert.equal(recorded.args.p_revision, '4f2a19c')
    // The press was not made at the board's machine, so it leaves a claimable request.
    assert.equal(recorded.args.p_state, 'waiting_for_server')
    // Lark's own retry of one press carries the same callback id, so it is recognised rather
    // than refused as a second action.
    assert.equal(recorded.args.p_op_id, `lark:${EVENT}:cb-1`)
    // Every connector this account has connected is redrawn, not just the one pressed in.
    assert.equal(calls.filter((c) => c.fn === 'connector_jobs').length, 2)
    assert.deepEqual(
      calls.filter((c) => c.fn === 'connector_jobs').map((c) => c.args.p_connector).sort(),
      ['lark', 'slack'],
    )
  })

  it('refuses an actor we have no account for, and records nothing', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({ lark_actor: null })

    const answer = await larkCallback(ENV, 'feishu', await sealed(press()), ctx())

    assert.equal(calls.some((c) => c.fn === 'record_event_action'), false)
    assert.match((await answer.json()).toast.content, /does not know who you are/)
  })

  it('refuses a press against a revision that has moved, and a second on one event', async (t) => {
    t.after(() => mock.restoreAll())
    let calls = fakeDatabase({ lark_actor: ACTOR, read_event: anEvent({ revision: 'moved-on' }) })
    let answer = await larkCallback(ENV, 'feishu', await sealed(press()), ctx())
    assert.equal(calls.some((c) => c.fn === 'record_event_action'), false)
    assert.match((await answer.json()).toast.content, /rewritten since this card/)

    // A second press is refused by the database rather than by a guess made here: only the
    // recorded op id tells one from this press's own retry.
    mock.restoreAll()
    calls = fakeDatabase({
      lark_actor: ACTOR,
      read_event: anEvent({ acted: true, state: 'waiting_for_server' }),
      record_event_action: {
        __refused: { code: 'AKB04', message: 'That event has already been answered.' },
      },
    })
    answer = await larkCallback(ENV, 'feishu', await sealed(press()), ctx())
    assert.equal((await answer.json()).toast.type, 'error')
  })

  it('settles Lark’s own retry of a press as that same action, not as a second one', async (t) => {
    t.after(() => mock.restoreAll())
    // What a retry finds: the action is already on record, because the first attempt landed
    // and only its answer was lost. Refusing on that alone would tell somebody whose press
    // worked that nothing happened.
    const calls = fakeDatabase({
      lark_actor: ACTOR,
      read_event: anEvent({ acted: true, state: 'waiting_for_server' }),
      record_event_action: anEvent({ state: 'waiting_for_server', acted: true }),
      connector_jobs: [],
    })

    const answer = await larkCallback(ENV, 'feishu', await sealed(press()), ctx())

    // The callback's own id, so 0004 answers it with the event as it stands rather than AKB04.
    const recorded = calls.find((c) => c.fn === 'record_event_action')
    assert.equal(recorded.args.p_op_id, `lark:${EVENT}:cb-1`)
    assert.equal((await answer.json()).toast.type, 'success')
  })

  it('submits every answer the form carried in one action', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      lark_actor: ACTOR,
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

    await larkCallback(
      ENV,
      'feishu',
      await sealed(
        press({
          action: {
            tag: 'button',
            name: 'submit',
            value: { a: 'answers', eventId: EVENT, revision: '4f2a19c' },
            form_value: { q0: '2', q1: 'my own words', q2: '' },
          },
        }),
      ),
      ctx(),
    )

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
      lark_actor: ACTOR,
      read_event: anEvent({
        kind: 'question',
        decision: 'answer',
        questions: [{ text: 'One?', mode: 'single', options: ['a', 'b'], recommend: [] }],
      }),
      record_event_action: anEvent({ state: 'waiting_for_server', acted: true }),
      connector_jobs: [],
    })

    await larkCallback(
      ENV,
      'feishu',
      await sealed(
        press({
          action: {
            tag: 'button',
            name: 'submit',
            value: { a: 'answers', eventId: EVENT, revision: '4f2a19c' },
            // "Something else" carries one past the card's options, so it is never a pick.
            form_value: { q0: '3', q0w: 'neither — do the third thing' },
          },
        }),
      ),
      ctx(),
    )

    const recorded = calls.find((c) => c.fn === 'record_event_action')
    assert.deepEqual(recorded.args.p_answers, [
      { picked: [], text: 'neither — do the third thing' },
    ])
  })

  it('refuses a pick and words together rather than dropping the words', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      lark_actor: ACTOR,
      read_event: anEvent({
        kind: 'question',
        decision: 'answer',
        questions: [{ text: 'One?', mode: 'single', options: ['a', 'b'], recommend: [] }],
      }),
      record_event_action: anEvent({ state: 'waiting_for_server', acted: true }),
      connector_jobs: [],
    })

    const answer = await larkCallback(
      ENV,
      'feishu',
      await sealed(
        press({
          action: {
            tag: 'button',
            name: 'submit',
            value: { a: 'answers', eventId: EVENT, revision: '4f2a19c' },
            form_value: { q0: '1', q0w: 'actually, something else' },
          },
        }),
      ),
      ctx(),
    )

    assert.match((await answer.json()).toast.content, /not both/)
    assert.equal(calls.find((c) => c.fn === 'record_event_action'), undefined)
  })

  it('does nothing at all when the card link is what was pressed', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({})

    await larkCallback(
      ENV,
      'feishu',
      await sealed(press({ action: { tag: 'button' } })),
      ctx(),
    )

    assert.deepEqual(calls, [], 'reading the card is not an action on the event')
  })
})

// ---------------------------------------------------------------------------
// The delivery
// ---------------------------------------------------------------------------

describe('deliverLark', () => {
  it('posts an event that has no message and edits the one that has', async (t) => {
    t.after(() => mock.restoreAll())
    let calls = fakeDatabase({
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, changedAt: '2026-08-01T10:00:00Z', posts: POSTS, messageRef: null, attempts: 0, event: anEvent() },
      ],
      lark_tenant_token: { token: 't-1' },
      record_event_delivery: anEvent(),
    })

    let run = await deliverLark(ENV)
    assert.deepEqual(run, { due: 1, sent: 1, failed: 0 })
    const posted = calls.find((c) => c.lark)
    assert.match(posted.lark, /^im\/v1\/messages\?receive_id_type=chat_id/)
    assert.equal(posted.args.receive_id, 'oc_1')
    assert.equal(posted.args.msg_type, 'interactive')
    const kept = calls.find((c) => c.fn === 'record_event_delivery')
    // The chat rides in the reference beside the message id (#353): Lark's reply endpoint
    // takes no destination, so where a message sits has to be known before the call.
    assert.equal(kept.args.p_external_ref, 'oc_1:om_1')
    assert.equal(kept.args.p_connector, 'lark')
    // What the message shows, not when it was written: an event that moved while Lark was
    // answering is still owed a rewrite.
    assert.equal(kept.args.p_rendered_at, '2026-08-01T10:00:00Z')

    mock.restoreAll()
    calls = fakeDatabase({
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, changedAt: '2026-08-01T11:00:00Z', posts: POSTS, messageRef: 'om_1', attempts: 0, event: anEvent({ state: 'running', acted: true }) },
      ],
      lark_tenant_token: { token: 't-1' },
      record_event_delivery: anEvent(),
    })

    run = await deliverLark(ENV, EVENT)
    assert.deepEqual(run, { due: 1, sent: 1, failed: 0 })
    // One event keeps one message however many times it moves.
    assert.equal(calls.find((c) => c.lark)?.method, 'PATCH')
    assert.match(calls.find((c) => c.lark).lark, /^im\/v1\/messages\/om_1$/)
  })

  it('posts to the person who connected when the destination is the direct message', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, changedAt: '2026-08-01T10:00:00Z', posts: { ...POSTS, destinationId: 'ou_1', direct: true }, messageRef: null, attempts: 0, event: anEvent() },
      ],
      lark_tenant_token: { token: 't-1' },
      record_event_delivery: anEvent(),
    })

    await deliverLark(ENV)

    assert.match(calls.find((c) => c.lark).lark, /receive_id_type=open_id/)
  })

  it('mints a tenant token from the pushed app ticket when it holds none', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = []
    mock.method(globalThis, 'fetch', async (url, init) => {
      const at = String(url)
      if (at.startsWith('https://open.feishu.cn/')) {
        const path = at.split('/open-apis/')[1]
        calls.push({ lark: path })
        if (path === 'auth/v3/app_access_token') {
          return new Response(JSON.stringify({ code: 0, app_access_token: 'a-1' }), { status: 200 })
        }
        if (path === 'auth/v3/tenant_access_token') {
          return new Response(
            JSON.stringify({ code: 0, tenant_access_token: 't-1', expire: 7200 }),
            { status: 200 },
          )
        }
        return new Response(JSON.stringify({ code: 0, data: { message_id: 'om_1' } }), { status: 200 })
      }
      const fn = at.split('/rpc/')[1]
      calls.push({ fn, args: JSON.parse(init.body) })
      const answers = {
        connector_jobs: [
          { ownerId: OWNER, eventId: EVENT, changedAt: '2026-08-01T10:00:00Z', posts: POSTS, messageRef: null, attempts: 0, event: anEvent() },
        ],
        lark_tenant_token: null,
        lark_app_ticket: { appTicket: 'ticket-1' },
      }
      return new Response(JSON.stringify(answers[fn] ?? { ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const run = await deliverLark(ENV)

    assert.deepEqual(run, { due: 1, sent: 1, failed: 0 })
    assert.deepEqual(
      calls.filter((c) => c.lark).map((c) => c.lark),
      [
        'auth/v3/app_access_token',
        'auth/v3/tenant_access_token',
        'im/v1/messages?receive_id_type=chat_id',
      ],
    )
    // Held in Cloud and renewed there, so a busy account mints a handful a day rather than
    // one per message.
    assert.equal(calls.find((c) => c.fn === 'lark_tenant_token_minted').args.p_expires_in, 7200)
  })

  it('shows a connection Lark has refused where it was made', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      __lark: { code: 232034, msg: 'The app is unavailable or inactivated by the tenant.' },
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, changedAt: '2026-08-01T10:00:00Z', posts: POSTS, messageRef: null, attempts: 0, event: anEvent() },
      ],
      lark_tenant_token: { token: 't-1' },
    })

    const run = await deliverLark(ENV)

    assert.deepEqual(run, { due: 1, sent: 0, failed: 1 })
    const failed = calls.find((c) => c.fn === 'record_event_delivery')
    assert.equal(failed.args.p_state, 'failed')
    assert.match(failed.args.p_last_error, /^232034: /)
    // Messages failing into silence read to the user as no work waiting, so the connection
    // says so where it was made.
    assert.equal(calls.find((c) => c.fn === 'lark_refused')?.args.p_owner, OWNER)
  })

  it('leaves a failure the user cannot fix to the next run, and the connection alone', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      // Lark having a bad minute — not a connection anybody has to mend.
      __lark: { code: 230020, msg: 'rate limited' },
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, changedAt: '2026-08-01T10:00:00Z', posts: POSTS, messageRef: null, attempts: 2, event: anEvent() },
      ],
      lark_tenant_token: { token: 't-1' },
    })

    const run = await deliverLark(ENV)

    assert.deepEqual(run, { due: 1, sent: 0, failed: 1 })
    assert.equal(calls.find((c) => c.fn === 'record_event_delivery').args.p_state, 'failed')
    assert.equal(calls.find((c) => c.fn === 'lark_refused'), undefined)
  })

  it('replies in the card’s 话题, and records the chat it posted to', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T10:00:00Z', posts: TOPIC_POSTS, messageRef: null, threadRef: 'oc_1:om_root', attempts: 0, event: anEvent() },
      ],
      lark_tenant_token: { token: 't-1' },
      record_event_delivery: anEvent(),
    })

    assert.deepEqual(await deliverLark(ENV), { due: 1, sent: 1, failed: 0 })

    const posted = calls.find((c) => c.lark)
    // A reply is a second endpoint, not a parameter — and `reply_in_thread` is what makes it
    // a 话题 rather than a quote.
    assert.equal(posted.lark, 'im/v1/messages/om_root/reply')
    assert.equal(posted.args.reply_in_thread, true)
    assert.equal(posted.args.msg_type, 'interactive')
    const card = JSON.parse(posted.args.content)
    assert.match(card.elements[0].text.content, /<at id="ou_1"><\/at>/)
    assert.doesNotMatch(said(card), /release 0\.8\.0/)
    // Lark's reply endpoint takes no destination, so where a message sits travels in the
    // reference: without it a root left in a chat the account has left would be replied to.
    assert.equal(calls.find((c) => c.fn === 'record_event_delivery').args.p_external_ref, 'oc_1:om_1')
  })

  it('is the top of the topic when the root is its own message', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T11:00:00Z', posts: TOPIC_POSTS, messageRef: 'oc_1:om_1', threadRef: 'oc_1:om_1', attempts: 0, event: anEvent({ state: 'running', acted: true }) },
      ],
      lark_tenant_token: { token: 't-1' },
      record_event_delivery: anEvent(),
    })

    await deliverLark(ENV, EVENT)

    const edited = calls.find((c) => c.lark)
    assert.equal(edited.method, 'PATCH')
    // The chat rides in the reference; the message id is what Lark is asked for.
    assert.equal(edited.lark, 'im/v1/messages/om_1')
    assert.match(said(JSON.parse(edited.args.content)), /release 0\.8\.0/, 'the card’s own message keeps its facts')
  })

  it('keeps patching a message recorded before the chat was written beside it', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T11:00:00Z', posts: TOPIC_POSTS, messageRef: 'om_old', threadRef: 'om_old', attempts: 0, event: anEvent({ state: 'running', acted: true }) },
      ],
      lark_tenant_token: { token: 't-1' },
      record_event_delivery: anEvent(),
    })

    await deliverLark(ENV, EVENT)

    assert.equal(calls.find((c) => c.lark).lark, 'im/v1/messages/om_old')
    // And it keeps the reference it had: the chat that message is in is not known, so
    // claiming it is this one would let a moved destination be replied into.
    assert.equal(calls.find((c) => c.fn === 'record_event_delivery').args.p_external_ref, 'om_old')
  })

  it('opens a topic in the chat it posts to now, not in the one it was moved away from', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T10:00:00Z', posts: TOPIC_POSTS, messageRef: null, threadRef: 'oc_left:om_root', attempts: 0, event: anEvent() },
      ],
      lark_tenant_token: { token: 't-1' },
      record_event_delivery: anEvent(),
    })

    await deliverLark(ENV)

    const posted = calls.find((c) => c.lark)
    assert.match(posted.lark, /^im\/v1\/messages\?receive_id_type=chat_id/)
    assert.equal(posted.args.receive_id, 'oc_1')
    assert.match(said(JSON.parse(posted.args.content)), /release 0\.8\.0/, 'a topic of its own is a whole card')
  })

  it('starts a topic of its own when the card has no message left to reply to', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T10:00:00Z', posts: TOPIC_POSTS, messageRef: null, threadRef: null, attempts: 0, event: anEvent() },
      ],
      lark_tenant_token: { token: 't-1' },
      record_event_delivery: anEvent(),
    })

    await deliverLark(ENV)

    const posted = calls.find((c) => c.lark)
    assert.match(posted.lark, /^im\/v1\/messages\?receive_id_type=chat_id/)
    assert.doesNotMatch(said(JSON.parse(posted.args.content)), /<at /)
  })

  it('keeps the direct message at one card per event', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({
      connector_jobs: [
        { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T10:00:00Z', posts: { ...TOPIC_POSTS, destinationId: 'ou_1', direct: true }, messageRef: null, threadRef: 'ou_1:om_root', attempts: 0, event: anEvent() },
      ],
      lark_tenant_token: { token: 't-1' },
      record_event_delivery: anEvent(),
    })

    await deliverLark(ENV)

    // Lark opens a topic in group chats only, so the direct message is left exactly as it was.
    const posted = calls.find((c) => c.lark)
    assert.match(posted.lark, /receive_id_type=open_id/)
    assert.equal(posted.args.reply_in_thread, undefined)
    assert.match(said(JSON.parse(posted.args.content)), /release 0\.8\.0/)
  })

  it('posts at the top level when Lark refuses the topic', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = []
    mock.method(globalThis, 'fetch', async (url, init) => {
      const at = String(url)
      if (at.startsWith('https://open.feishu.cn/')) {
        const path = at.split('/open-apis/')[1]
        calls.push({ lark: path, args: JSON.parse(init.body ?? '{}') })
        // The chat will not take a thread reply, or the root was recalled. Both land here,
        // and neither is a connection anybody has to mend.
        if (path.endsWith('/reply')) {
          return new Response(JSON.stringify({ code: 230071, msg: 'not supported' }), { status: 200 })
        }
        return new Response(JSON.stringify({ code: 0, data: { message_id: 'om_2' } }), { status: 200 })
      }
      const fn = at.split('/rpc/')[1]
      calls.push({ fn, args: JSON.parse(init.body) })
      const answers = {
        connector_jobs: [
          { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T10:00:00Z', posts: TOPIC_POSTS, messageRef: null, threadRef: 'oc_1:om_root', attempts: 0, event: anEvent() },
        ],
        lark_tenant_token: { token: 't-1' },
      }
      return new Response(JSON.stringify(answers[fn] ?? null), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    assert.deepEqual(await deliverLark(ENV), { due: 1, sent: 1, failed: 0 })

    const posts = calls.filter((c) => c.lark)
    assert.equal(posts.length, 2)
    assert.match(posts[1].lark, /^im\/v1\/messages\?receive_id_type=chat_id/)
    // A refused topic is not a refused connection.
    assert.equal(calls.find((c) => c.fn === 'lark_refused'), undefined)
    assert.equal(calls.find((c) => c.fn === 'record_event_delivery').args.p_external_ref, 'oc_1:om_2')
  })

  it('holds the root it took, so one card’s two events share one 话题', async (t) => {
    t.after(() => mock.restoreAll())
    const SECOND = '44444444-4444-4444-8444-444444444444'
    const calls = []
    let posted = 0
    mock.method(globalThis, 'fetch', async (url, init) => {
      const at = String(url)
      if (at.startsWith('https://open.feishu.cn/')) {
        posted += 1
        calls.push({ lark: at.split('/open-apis/')[1], args: JSON.parse(init.body ?? '{}') })
        return new Response(JSON.stringify({ code: 0, data: { message_id: `om_${posted}` } }), { status: 200 })
      }
      const fn = at.split('/rpc/')[1]
      calls.push({ fn, args: JSON.parse(init.body) })
      const answers = {
        // Both read the same root — the one the database held before either was written.
        connector_jobs: [
          { ownerId: OWNER, eventId: EVENT, contentAt: '2026-08-01T10:00:00Z', posts: TOPIC_POSTS, messageRef: null, threadRef: null, attempts: 0, event: anEvent() },
          { ownerId: OWNER, eventId: SECOND, contentAt: '2026-08-01T10:05:00Z', posts: TOPIC_POSTS, messageRef: null, threadRef: null, attempts: 0, event: anEvent({ id: SECOND, kind: 'question', decision: 'answer' }) },
        ],
        lark_tenant_token: { token: 't-1' },
      }
      return new Response(JSON.stringify(answers[fn] ?? null), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    assert.deepEqual(await deliverLark(ENV), { due: 2, sent: 2, failed: 0 })

    const posts = calls.filter((c) => c.lark)
    assert.match(posts[0].lark, /^im\/v1\/messages\?receive_id_type=chat_id/)
    assert.equal(posts[1].lark, 'im/v1/messages/om_1/reply')
  })

  it('costs nothing when nothing is owed', async (t) => {
    t.after(() => mock.restoreAll())
    const calls = fakeDatabase({ connector_jobs: [] })

    assert.deepEqual(await deliverLark(ENV), { due: 0, sent: 0, failed: 0 })
    assert.equal(calls.filter((c) => c.lark).length, 0)
  })
})
