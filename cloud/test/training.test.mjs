// The training page's Worker half (#683): the schedule that turns UTC+8 configuration into
// absolute instants, what each public route will and will not accept, and the outbox behind a
// booking's two messages. The database's own rules — the hold, the retry, the token — are
// checked against a real Postgres in test/sql/checks.sql.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { availability, isScheduled, scheduledHours } from '../src/training-schedule.ts'
import { corsHeaders, routeTraining, sha256Hex } from '../src/training.ts'
import { sendPendingTrainingMail } from '../src/training-mail.ts'

const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  RESEND_API_KEY: 'resend-key',
}
/** The `api` functions that return `void`. */
const VOID = new Set(['mark_training_mail_sent', 'mark_training_mail_failed'])

const realFetch = globalThis.fetch
let answers
let rpcCalls
let sends
let resendStatus
/** A no-op `ExecutionContext` — the send a route hands off is awaited here on purpose, so a
 *  test can see what it did. */
let deferred

beforeEach(() => {
  answers = {}
  rpcCalls = []
  sends = []
  resendStatus = 200
  deferred = []
  globalThis.fetch = async (url, init) => {
    const address = String(url)
    if (address === 'https://api.resend.com/emails') {
      sends.push(JSON.parse(init.body))
      return new Response(JSON.stringify({ id: 'sent' }), { status: resendStatus })
    }
    const fn = address.split('/rest/v1/rpc/')[1]
    rpcCalls.push({ fn, args: JSON.parse(init.body) })
    if (VOID.has(fn)) return new Response(null, { status: 204 })
    return json(fn in answers ? answers[fn] : {})
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const ctx = () => ({ waitUntil: (p) => deferred.push(p) })
const settle = () => Promise.all(deferred)

// The sample schedule: Monday 10:00, Wednesday 22:00 and Friday 22:00, UTC+8.
// Monday 2026-09-14 10:00 +08 is 2026-09-14T02:00Z; Friday 2026-09-18 22:00 +08 is
// 2026-09-18T14:00Z — which is Friday morning in New York and Friday afternoon in Berlin.
const MONDAY_10 = '2026-09-14T02:00:00.000Z'
const WEDNESDAY_22 = '2026-09-16T14:00:00.000Z'
const FRIDAY_22 = '2026-09-18T14:00:00.000Z'

describe('the coach’s schedule, as instants', () => {
  it('turns UTC+8 wall-clock hours into the instants they really are', () => {
    const hours = scheduledHours(new Date('2026-09-14T00:00:00Z'), new Date('2026-09-21T00:00:00Z'))

    assert.deepEqual(
      hours.map((h) => h.toISOString()),
      [MONDAY_10, WEDNESDAY_22, FRIDAY_22],
    )
  })

  it('gives a visitor west of the coach the hour that falls in their own week', () => {
    // New York's week of 2026-09-13 (Sunday 00:00 local) through 2026-09-20. The coach's
    // Monday 10:00 +08 is Sunday 14:00 in New York — the previous UTC+8 week, and inside this
    // visitor's. Asking for the visitor's window has to find it.
    const from = new Date('2026-09-14T04:00:00Z') // Monday 00:00 America/New_York
    const to = new Date('2026-09-21T04:00:00Z')
    const hours = scheduledHours(from, to).map((h) => h.toISOString())

    assert.equal(hours.includes(MONDAY_10), false, 'that Monday starts before this window')
    // The NEXT Monday's hour, which is inside the visitor's week and in the coach's next one.
    assert.ok(hours.includes('2026-09-21T02:00:00.000Z'), 'the hour from the coach’s next week is missing')
    assert.ok(hours.includes(WEDNESDAY_22))
    assert.ok(hours.includes(FRIDAY_22))
  })

  it('crosses a month boundary without losing an hour', () => {
    // 2026-09-28 is a Monday, 2026-09-30 a Wednesday, 2026-10-02 a Friday.
    const hours = scheduledHours(
      new Date('2026-09-28T00:00:00Z'),
      new Date('2026-10-05T00:00:00Z'),
    ).map((h) => h.toISOString())

    assert.deepEqual(hours, [
      '2026-09-28T02:00:00.000Z',
      '2026-09-30T14:00:00.000Z',
      '2026-10-02T14:00:00.000Z',
    ])
  })

  it('takes a whole day out, and one hour out of a day', () => {
    const options = {
      exceptions: { closedDays: ['2026-09-16'], closedHours: ['2026-09-18T22'], openHours: [] },
    }
    const hours = scheduledHours(
      new Date('2026-09-14T00:00:00Z'),
      new Date('2026-09-21T00:00:00Z'),
      options,
    )

    assert.deepEqual(hours.map((h) => h.toISOString()), [MONDAY_10])
  })

  it('adds an hour the weekly pattern does not offer, and keeps a closure winning', () => {
    const options = {
      exceptions: {
        closedDays: [],
        closedHours: ['2026-09-15T09'],
        openHours: ['2026-09-15T09', '2026-09-15T21'],
      },
    }
    const hours = scheduledHours(
      new Date('2026-09-15T00:00:00Z'),
      new Date('2026-09-16T00:00:00Z'),
      options,
    ).map((h) => h.toISOString())

    // Tuesday 21:00 +08 is 13:00Z; the 09:00 the exception both opens and closes stays closed.
    assert.deepEqual(hours, ['2026-09-15T13:00:00.000Z'])
  })
})

describe('what the page is told is open', () => {
  const week = [new Date('2026-09-14T00:00:00Z'), new Date('2026-09-21T00:00:00Z')]

  it('marks an hour that is taken and leaves the rest open', () => {
    const slots = availability(week[0], week[1], [WEDNESDAY_22], new Date('2026-09-13T00:00:00Z'))

    assert.deepEqual(slots, [
      { at: '2026-09-14T02:00:00Z', state: 'open' },
      { at: '2026-09-16T14:00:00Z', state: 'booked' },
      { at: '2026-09-18T14:00:00Z', state: 'open' },
    ])
  })

  it('drops every hour that has already passed', () => {
    const slots = availability(week[0], week[1], [], new Date('2026-09-17T00:00:00Z'))

    assert.deepEqual(slots.map((s) => s.at), ['2026-09-18T14:00:00Z'])
  })

  it('answers with an empty week rather than pretending, when nothing is left', () => {
    const slots = availability(week[0], week[1], [], new Date('2026-09-20T00:00:00Z'))

    assert.deepEqual(slots, [])
  })

  it('never reports how many hours the schedule holds', () => {
    const slots = availability(week[0], week[1], [MONDAY_10, WEDNESDAY_22, FRIDAY_22], new Date('2026-09-13T00:00:00Z'))

    // Every hour is accounted for one way or the other; nothing carries a remaining count.
    assert.equal(slots.every((s) => Object.keys(s).join() === 'at,state'), true)
  })

  it('recognises exactly the instants it offered, and nothing beside them', () => {
    assert.equal(isScheduled(new Date(MONDAY_10)), true)
    assert.equal(isScheduled(new Date('2026-09-14T03:00:00Z')), false)
  })
})

describe('daylight saving is the visitor’s problem, not the schedule’s', () => {
  // The coach's clock never moves, so an hour keeps its UTC+8 wall time all year and its
  // absolute instant is unaffected by anybody's transition. What changes is where it lands for
  // the reader — which is the page's projection, and is why the server answers with instants.
  it('keeps the same absolute instant across a northern DST transition', () => {
    // 2026-11-01 is the Sunday the United States leaves DST; 2026-11-02 is a Monday.
    const before = scheduledHours(new Date('2026-10-26T00:00:00Z'), new Date('2026-10-27T00:00:00Z'))
    const after = scheduledHours(new Date('2026-11-02T00:00:00Z'), new Date('2026-11-03T00:00:00Z'))

    assert.deepEqual(before.map((h) => h.toISOString()), ['2026-10-26T02:00:00.000Z'])
    assert.deepEqual(after.map((h) => h.toISOString()), ['2026-11-02T02:00:00.000Z'])
    // Same wall clock for the coach both weeks. For a New York reader the very same Monday
    // morning slides an hour earlier into their Sunday evening, which is the whole reason the
    // server answers with instants and the page does the projecting.
    assert.equal(localHour(before[0], 'America/New_York'), '22')
    assert.equal(localHour(after[0], 'America/New_York'), '21')
  })

  it('lands a repeated local hour on one instant, told apart by its offset', () => {
    // 03:00 UTC on 2026-11-01 is 23:00 EDT the previous evening; 07:00 UTC is 02:00 EST. Both
    // are unambiguous because the instant is what is stored — a local "01:30" twice over never
    // reaches this side.
    const first = new Date('2026-11-01T05:00:00Z')
    const second = new Date('2026-11-01T06:00:00Z')

    assert.equal(localHour(first, 'America/New_York'), '01')
    assert.equal(localHour(second, 'America/New_York'), '01')
    assert.notEqual(first.getTime(), second.getTime())
  })
})

// Fix the clock the Sunday before the sample week, so its hours are still ahead.
const beforeTheSampleWeek = () => {
  beforeEach(() => mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-13T00:00:00Z') }))
  afterEach(() => mock.timers.reset())
}

const localHour = (at, zone) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', hour12: false }).format(at)

describe('the availability route', () => {
  beforeTheSampleWeek()

  it('answers a stranger with instants and a session length, and nothing else', async () => {
    answers.training_booked_slots = [WEDNESDAY_22]

    const body = await read(
      await routeTraining(
        get(`https://api.ai4kanban.dev/v1/training/availability?from=2026-09-14T00:00:00Z&to=2026-09-21T00:00:00Z`),
        ENV,
        ctx(),
        'availability',
      ),
    )

    assert.deepEqual(Object.keys(body).sort(), ['sessionMinutes', 'slots'])
    assert.equal(body.sessionMinutes, 60)
    assert.equal(body.slots.find((s) => s.at === '2026-09-16T14:00:00Z').state, 'booked')
  })

  it('refuses a window wider than a page ever asks for', async () => {
    await assert.rejects(
      routeTraining(
        get('https://api.ai4kanban.dev/v1/training/availability?from=2026-01-01T00:00:00Z&to=2027-01-01T00:00:00Z'),
        ENV,
        ctx(),
        'availability',
      ),
      { code: 'bad_request' },
    )
  })

  it('refuses a request that names no week at all', async () => {
    await assert.rejects(
      routeTraining(get('https://api.ai4kanban.dev/v1/training/availability'), ENV, ctx(), 'availability'),
      { code: 'bad_request' },
    )
  })
})

describe('booking an hour', () => {
  beforeTheSampleWeek()

  const submit = (overrides = {}) => ({
    opId: 'op-1',
    slotAt: FRIDAY_22,
    service: 'single',
    name: 'Lin Chen',
    email: 'lin@example.com',
    timezone: 'America/New_York',
    project: 'A subscription product.',
    ...overrides,
  })

  const booked = (overrides = {}) => ({
    reference: 'TR-8K42C1',
    slot_at: FRIDAY_22,
    service: 'single',
    price_cents: 9900,
    name: 'Lin Chen',
    email: 'lin@example.com',
    timezone: 'America/New_York',
    project: 'A subscription product.',
    state: 'booked',
    created_at: '2026-09-13T00:00:00Z',
    cancelled_at: null,
    ...overrides,
  })

  beforeEach(() => {
    answers.book_training = booked()
    answers.pending_training_mail = []
  })

  it('settles the price itself and ignores one the form sends', async () => {
    await routeTraining(post('/v1/training/bookings', submit({ priceCents: 1 })), ENV, ctx(), 'bookings')

    const call = rpcCalls.find((c) => c.fn === 'book_training')
    assert.equal(call.args.p_price_cents, 9900)
  })

  it('charges the monthly price for the monthly service', async () => {
    answers.book_training = booked({ service: 'monthly', price_cents: 34900 })
    await routeTraining(post('/v1/training/bookings', submit({ service: 'monthly' })), ENV, ctx(), 'bookings')

    assert.equal(rpcCalls.find((c) => c.fn === 'book_training').args.p_price_cents, 34900)
  })

  it('stores the hash of the manage token and hands the token back exactly once', async () => {
    const body = await read(await routeTraining(post('/v1/training/bookings', submit()), ENV, ctx(), 'bookings'))

    const call = rpcCalls.find((c) => c.fn === 'book_training')
    assert.equal(call.args.p_manage_token_hash, await sha256Hex(body.manage.token))
    assert.notEqual(call.args.p_manage_token_hash, body.manage.token)
    assert.match(body.manage.token, /^[0-9a-f]{64}$/)
    assert.match(body.manage.url, /\/training\?booking=TR-8K42C1&token=[0-9a-f]{64}$/)
  })

  it('refuses an hour the deployed schedule does not offer', async () => {
    await assert.rejects(
      routeTraining(post('/v1/training/bookings', submit({ slotAt: '2026-09-18T15:00:00Z' })), ENV, ctx(), 'bookings'),
      { code: 'training_slot_taken' },
    )
    assert.equal(rpcCalls.length, 0, 'an hour nobody offers still reached the database')
  })

  it('refuses an hour that has already passed', async () => {
    await assert.rejects(
      routeTraining(post('/v1/training/bookings', submit({ slotAt: '2020-09-18T14:00:00Z' })), ENV, ctx(), 'bookings'),
      { code: 'training_slot_taken' },
    )
  })

  it('refuses a submit with no id, so a retry could never be told apart', async () => {
    await assert.rejects(
      routeTraining(post('/v1/training/bookings', submit({ opId: '' })), ENV, ctx(), 'bookings'),
      { code: 'bad_request' },
    )
  })

  it('refuses an address that is not one, and a zone that is not one', async () => {
    await assert.rejects(
      routeTraining(post('/v1/training/bookings', submit({ email: 'lin@example' })), ENV, ctx(), 'bookings'),
      { code: 'bad_request' },
    )
    await assert.rejects(
      routeTraining(post('/v1/training/bookings', submit({ timezone: 'Mars/Olympus' })), ENV, ctx(), 'bookings'),
      { code: 'bad_request' },
    )
  })

  it('refuses a service nobody sells', async () => {
    await assert.rejects(
      routeTraining(post('/v1/training/bookings', submit({ service: 'free' })), ENV, ctx(), 'bookings'),
      { code: 'bad_request' },
    )
  })

  it('cuts a project note rather than storing a document', async () => {
    await routeTraining(post('/v1/training/bookings', submit({ project: 'x'.repeat(9000) })), ENV, ctx(), 'bookings')

    assert.equal(rpcCalls.find((c) => c.fn === 'book_training').args.p_project.length, 2000)
  })

  it('hands the caller’s address to the rate limit as a hash and never as itself', async () => {
    await routeTraining(post('/v1/training/bookings', submit(), { 'cf-connecting-ip': '203.0.113.7' }), ENV, ctx(), 'bookings')

    const call = rpcCalls.find((c) => c.fn === 'book_training')
    assert.match(call.args.p_fingerprint, /^[0-9a-f]{32}$/)
    assert.equal(JSON.stringify(call.args).includes('203.0.113.7'), false)
    assert.equal(call.args.p_attempt_limit, 8)
  })

  it('sends the visitor a confirmation and the coach the project note', async () => {
    answers.pending_training_mail = [
      { ...booked(), kind: 'visitor', booking_id: 'b-1', queued_at: '2026-09-13T00:00:00Z' },
      { ...booked(), kind: 'coach', booking_id: 'b-1', queued_at: '2026-09-13T00:00:00Z' },
    ]

    await routeTraining(post('/v1/training/bookings', submit()), ENV, ctx(), 'bookings')
    await settle()

    const [visitor, coach] = sends
    assert.deepEqual(visitor.to, ['lin@example.com'])
    assert.match(visitor.from, /training@ai4kanban\.dev/)
    assert.match(visitor.text, /TR-8K42C1/)
    // The visitor's own zone, and never the coach's.
    assert.match(visitor.text, /America\/New_York/)
    assert.doesNotMatch(visitor.text, /UTC\+8|Asia\/Shanghai/)
    // Nothing claims the mail arrived, only that the hour is held.
    assert.match(visitor.text, /Your session is booked/)
    assert.match(visitor.text, /\/training\?booking=TR-8K42C1&token=[0-9a-f]{64}/)

    assert.deepEqual(coach.to, ['support@ai4kanban.dev'])
    assert.equal(coach.reply_to, 'lin@example.com')
    assert.match(coach.text, /A subscription product\./)
  })

  it('answers the booking even when nothing could be mailed', async () => {
    answers.pending_training_mail = [
      { ...booked(), kind: 'visitor', booking_id: 'b-1', queued_at: '2026-09-13T00:00:00Z' },
    ]
    resendStatus = 422

    const body = await read(await routeTraining(post('/v1/training/bookings', submit()), ENV, ctx(), 'bookings'))
    await settle()

    assert.equal(body.booking.reference, 'TR-8K42C1')
    const marked = rpcCalls.find((c) => c.fn === 'mark_training_mail_failed')
    assert.equal(marked.args.p_kind, 'visitor')
    assert.match(marked.args.p_error, /422/)
  })
})

describe('the manage link', () => {
  it('sends the hash of the token rather than the token', async () => {
    answers.read_training_booking = { reference: 'TR-8K42C1', state: 'booked' }

    await routeTraining(
      get('https://api.ai4kanban.dev/v1/training/bookings/TR-8K42C1?token=deadbeef'),
      ENV,
      ctx(),
      'bookings/TR-8K42C1',
    )

    const call = rpcCalls.find((c) => c.fn === 'read_training_booking')
    assert.equal(call.args.p_manage_token_hash, await sha256Hex('deadbeef'))
  })

  it('answers a reference nobody holds the same way as a wrong token', async () => {
    answers.read_training_booking = null

    await assert.rejects(
      routeTraining(
        get('https://api.ai4kanban.dev/v1/training/bookings/TR-NOSUCH?token=deadbeef'),
        ENV,
        ctx(),
        'bookings/TR-NOSUCH',
      ),
      { code: 'not_found' },
    )
  })

  it('cancels and tells both sides, once', async () => {
    answers.cancel_training_booking = {
      reference: 'TR-8K42C1',
      slot_at: FRIDAY_22,
      service: 'single',
      price_cents: 9900,
      name: 'Lin Chen',
      email: 'lin@example.com',
      timezone: 'America/New_York',
      project: '',
      state: 'cancelled',
      created_at: '2026-09-13T00:00:00Z',
      cancelled_at: '2026-09-13T01:00:00Z',
    }
    answers.pending_training_mail = [
      {
        kind: 'cancelled',
        booking_id: 'b-1',
        reference: 'TR-8K42C1',
        slot_at: FRIDAY_22,
        service: 'single',
        price_cents: 9900,
        name: 'Lin Chen',
        email: 'lin@example.com',
        timezone: 'America/New_York',
        project: '',
        state: 'cancelled',
        queued_at: '2026-09-13T01:00:00Z',
      },
    ]

    const body = await read(
      await routeTraining(
        post('/v1/training/bookings/TR-8K42C1/cancel', { token: 'deadbeef' }),
        ENV,
        ctx(),
        'bookings/TR-8K42C1/cancel',
      ),
    )
    await settle()

    assert.equal(body.booking.state, 'cancelled')
    assert.deepEqual(sends[0].to, ['lin@example.com'])
    assert.match(sends[0].text, /open again/)
  })
})

describe('the operator’s records', () => {
  it('refuses a caller with no sign-in at all', async () => {
    await assert.rejects(
      routeTraining(get('https://api.ai4kanban.dev/v1/training/records'), ENV, ctx(), 'records'),
      (error) => {
        assert.equal(error.code, 'unauthenticated')
        return true
      },
    )
    assert.equal(rpcCalls.some((c) => c.fn === 'list_training_bookings'), false)
  })
})

describe('who may read the answer', () => {
  it('echoes the site’s own origin and refuses to echo anybody else’s', () => {
    assert.equal(
      corsHeaders(get('https://api.ai4kanban.dev/v1/training/availability', { origin: 'https://ai4kanban.dev' }))[
        'access-control-allow-origin'
      ],
      'https://ai4kanban.dev',
    )
    assert.deepEqual(
      corsHeaders(get('https://api.ai4kanban.dev/v1/training/availability', { origin: 'https://evil.example' })),
      {},
    )
    assert.deepEqual(corsHeaders(get('https://api.ai4kanban.dev/v1/training/availability')), {})
  })
})

describe('the outbox on its own', () => {
  it('does nothing at all when nothing is owed', async () => {
    answers.pending_training_mail = []

    assert.deepEqual(await sendPendingTrainingMail(ENV), { queued: 0, sent: 0, failed: 0 })
    assert.equal(sends.length, 0)
  })

  it('retrying a confirmation it cannot rebuild points at the page, not a made-up link', async () => {
    answers.pending_training_mail = [
      {
        kind: 'visitor',
        booking_id: 'b-1',
        reference: 'TR-8K42C1',
        slot_at: FRIDAY_22,
        service: 'single',
        price_cents: 9900,
        name: 'Lin Chen',
        email: 'lin@example.com',
        timezone: 'Asia/Shanghai',
        project: '',
        state: 'booked',
        queued_at: '2026-09-13T00:00:00Z',
      },
    ]

    // No `manage` argument: this is the hourly run, which never holds a token.
    assert.deepEqual(await sendPendingTrainingMail(ENV), { queued: 1, sent: 1, failed: 0 })
    assert.doesNotMatch(sends[0].text, /token=/)
    assert.match(sends[0].text, /manage link in the first copy/)
  })

  it('sends nothing and says so when the key is not set', async () => {
    answers.pending_training_mail = [
      {
        kind: 'coach',
        booking_id: 'b-1',
        reference: 'TR-8K42C1',
        slot_at: FRIDAY_22,
        service: 'single',
        price_cents: 9900,
        name: 'Lin Chen',
        email: 'lin@example.com',
        timezone: 'Asia/Shanghai',
        project: '',
        state: 'booked',
        queued_at: '2026-09-13T00:00:00Z',
      },
    ]

    assert.deepEqual(await sendPendingTrainingMail({ ...ENV, RESEND_API_KEY: undefined }), {
      queued: 1,
      sent: 0,
      failed: 0,
    })
    assert.equal(sends.length, 0)
  })
})

const json = (body) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

const get = (url, headers = {}) => new Request(url, { headers })

const post = (path, body, headers = {}) =>
  new Request(`https://api.ai4kanban.dev${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

const read = (response) => response.json()
