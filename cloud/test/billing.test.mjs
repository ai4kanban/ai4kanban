// Pro through Creem (#1037): who counts as Pro and when, the signed notification, and a row
// that is always what Creem says now, whatever order the notifications arrive in.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { jwksUrl, issuerFor, resetJwksCache } from '../src/auth.ts'
import { billingOf, creemBase, isPro, signatureOf } from '../src/billing.ts'
import { creditsOf, MONTHLY_CREDITS } from '../src/credits.ts'
import worker from '../src/index.ts'

const SUPABASE_URL = 'https://project.supabase.co'
const ENV = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  CREEM_API_KEY: 'creem_live_key',
  CREEM_WEBHOOK_SECRET: 'whsec_test',
  CREEM_PRODUCT_MONTHLY: 'prod_month',
  CREEM_PRODUCT_YEARLY: 'prod_year',
}
const SUBJECT = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const NOW = Date.parse('2026-09-27T12:00:00Z')
const LATER = '2026-10-27T12:00:00.000Z'
const EARLIER = '2026-09-01T12:00:00.000Z'
const CANCELED_AT = '2026-09-27T12:05:00.000Z'
const REVOKED_NOW = '2026-09-27T13:00:00.000Z'
const NEXT = '2026-11-27T12:00:00.000Z'

const realFetch = globalThis.fetch
let keyPair
let rows
let creemSubs
let creemCalls
let creemDown
let creemTxs
let spent
let grants

beforeEach(async () => {
  resetJwksCache()
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  rows = new Map()
  creemSubs = new Map()
  creemCalls = []
  creemDown = false
  creemTxs = []
  spent = {}
  grants = {}
  globalThis.fetch = async (url, init = {}) => {
    const address = String(url)
    const body = init.body ? JSON.parse(init.body) : undefined
    if (address === jwksUrl(SUPABASE_URL)) return json({ keys: [{ ...jwk, kid: 'k', alg: 'ES256' }] })
    if (address.endsWith('/rest/v1/rpc/account_for_session')) {
      return json({ admitted: false, handle: 'lin', name: null, avatar_url: null, account_id: null })
    }
    // What 0029_subscriptions.sql does, which test/sql/checks.sql proves against a real database.
    if (address.endsWith('/rest/v1/rpc/record_subscription')) {
      const user = body.p_user_id ?? rows.get(body.p_id)?.user_id
      if (!user) return json(null)
      rows.set(body.p_id, {
        ...rows.get(body.p_id),
        id: body.p_id,
        user_id: user,
        customer_id: body.p_customer_id,
        period: body.p_period,
        status: body.p_status,
        current_period_end: body.p_current_period_end,
      })
      return json({ id: body.p_id, user_id: user })
    }
    // What 0034_refund_revocation.sql does: the refund only moves forward.
    if (address.endsWith('/rest/v1/rpc/record_refund')) {
      const found = rows.get(body.p_id)
      if (!found) return json(null)
      if (!found.refunded_through || body.p_refunded_through > found.refunded_through) {
        Object.assign(found, { refunded_through: body.p_refunded_through, revoked_at: body.p_revoked_at ?? REVOKED_NOW })
      }
      return json({ id: found.id, refunded_through: found.refunded_through })
    }
    if (address.endsWith('/rest/v1/rpc/credits_used')) return json(spent[body.p_user_id] ?? 0)
    if (address.endsWith('/rest/v1/rpc/seed_grant_for')) return json(grants[body.p_user_id] ?? null)
    if (address.endsWith('/rest/v1/rpc/subscriptions_for')) {
      return json([...rows.values()].filter((r) => r.user_id === body.p_user_id))
    }
    if (address.startsWith('https://api.creem.io/')) {
      creemCalls.push({ address, headers: init.headers, body })
      if (creemDown) return json({ message: 'down' }, 500)
      const path = address.slice('https://api.creem.io'.length)
      if (path === '/v1/checkouts') return json({ id: 'ch_1', checkout_url: 'https://checkout.creem.io/ch_1' })
      const txs = /^\/v1\/transactions\/search\?customer_id=([^&]+)/.exec(path)
      if (txs) return json({ items: creemTxs.filter((tx) => tx.customer === txs[1]), pagination: {} })
      if (path === '/v1/customers/billing') return json({ customer_portal_link: `https://creem.io/portal/${body.customer_id}` })
      const sub = /^\/v1\/subscriptions\?subscription_id=(.+)$/.exec(path)
      if (sub && creemSubs.has(sub[1])) return json(creemSubs.get(sub[1]))
      return json({ message: 'not found' }, 404)
    }
    throw new Error(`unexpected fetch of ${address}`)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const row = (status, end = LATER, extra = {}) => ({
  id: 'sub_1',
  customer_id: 'cust_1',
  period: 'monthly',
  status,
  current_period_end: end,
  ...extra,
})

describe('who is Pro', () => {
  it('is Pro while renewing, however far past its period', () => {
    for (const status of ['active', 'trialing', 'past_due']) {
      assert.equal(isPro(row(status, EARLIER), NOW), true, status)
    }
  })

  it('keeps an ending subscription Pro until its period ends, and not a moment after', () => {
    for (const status of ['scheduled_cancel', 'canceled']) {
      assert.equal(isPro(row(status, LATER), NOW), true, `${status} before the end`)
      assert.equal(isPro(row(status, EARLIER), NOW), false, `${status} after the end`)
      assert.equal(isPro(row(status, new Date(NOW).toISOString()), NOW), false, `${status} at the end`)
      assert.equal(isPro(row(status, null), NOW), false, `${status} with no end`)
    }
  })

  it('never counts any other status', () => {
    for (const status of ['expired', 'paused', 'unpaid', 'incomplete']) {
      assert.equal(isPro(row(status, LATER), NOW), false, status)
    }
  })

  it('takes the best of several, and reads a lapsed one as expired', () => {
    assert.deepEqual(billingOf([], null, NOW), { plan: 'free', state: 'free', period: null, periodEnd: null, grantEnd: null })
    assert.deepEqual(billingOf([row('expired', EARLIER)], null, NOW), {
      plan: 'free', state: 'expired', period: 'monthly', periodEnd: EARLIER, grantEnd: null,
    })
    const best = billingOf(
      [row('past_due'), row('canceled', LATER, { id: 'sub_2' }), row('active', LATER, { id: 'sub_3', period: 'yearly' })],
      null,
      NOW,
    )
    assert.deepEqual(best, { plan: 'pro', state: 'active', period: 'yearly', periodEnd: LATER, grantEnd: null })
    assert.equal(billingOf([row('past_due'), row('scheduled_cancel')], null, NOW).state, 'canceled')
    assert.equal(billingOf([row('expired'), row('past_due')], null, NOW).state, 'pastDue')
  })

  it('makes a seed partner Pro until the grant ends, leaving the subscription’s state its own (#1039)', () => {
    const grant = { starts_at: EARLIER, ends_at: LATER }
    assert.deepEqual(billingOf([], grant, NOW), { plan: 'pro', state: 'free', period: null, periodEnd: null, grantEnd: LATER })
    assert.deepEqual(billingOf([], { starts_at: EARLIER, ends_at: EARLIER }, NOW).plan, 'free')

    // A cancelled subscription that has run out: still Pro on the grant.
    const lapsed = billingOf([row('canceled', EARLIER)], grant, NOW)
    assert.equal(lapsed.plan, 'pro')
    assert.equal(lapsed.state, 'expired')
    // A grant that has run out: still Pro on the subscription.
    const paying = billingOf([row('active')], { starts_at: EARLIER, ends_at: EARLIER }, NOW)
    assert.deepEqual(paying, { plan: 'pro', state: 'active', period: 'monthly', periodEnd: LATER, grantEnd: null })
    // Both at once.
    assert.equal(billingOf([row('active')], grant, NOW).grantEnd, LATER)
  })

  it('ends Pro at once on a refund of the period it is in, and not on a later one', () => {
    const refunded = { refunded_through: LATER, revoked_at: CANCELED_AT }
    assert.equal(isPro(row('canceled', LATER, refunded), NOW), false)
    assert.equal(isPro(row('active', LATER, refunded), NOW), false)
    // Creem's two timestamps may differ by a little: still that period.
    assert.equal(isPro(row('canceled', '2026-10-28T11:00:00.000Z', refunded), NOW), false)
    // A renewal after the refund is a later period.
    assert.equal(isPro(row('active', NEXT, refunded), NOW), true)
    assert.deepEqual(billingOf([row('canceled', LATER, refunded)], null, NOW), {
      plan: 'free', state: 'expired', period: 'monthly', periodEnd: CANCELED_AT, grantEnd: null,
    })
  })

  it('picks the test store only for a test key', () => {
    assert.equal(creemBase('creem_test_abc'), 'https://test-api.creem.io')
    assert.equal(creemBase('creem_abc'), 'https://api.creem.io')
  })
})

describe('POST /v1/billing/webhook', () => {
  const event = (eventType, status) =>
    JSON.stringify({ id: 'evt_1', eventType, object: { id: 'sub_1', object: 'subscription', status } })

  beforeEach(() => {
    creemSubs.set('sub_1', creemSub('active'))
  })

  it('takes a correctly signed notification and writes what Creem says now', async () => {
    const body = event('subscription.paid', 'active')
    const res = await notify(body, await signatureOf(ENV.CREEM_WEBHOOK_SECRET, body))

    assert.equal(res.status, 200)
    assert.equal(rows.get('sub_1').status, 'active')
    assert.equal(rows.get('sub_1').user_id, SUBJECT)
    assert.equal(rows.get('sub_1').current_period_end, LATER)
  })

  it('refuses a tampered or missing signature and writes nothing', async () => {
    const body = event('subscription.paid', 'active')
    const signed = await signatureOf(ENV.CREEM_WEBHOOK_SECRET, body)
    assert.equal((await notify(body.replace('paid', 'expired'), signed)).status, 401)
    assert.equal((await notify(body, signed.replace(/.$/, (c) => (c === '0' ? '1' : '0')))).status, 401)
    assert.equal((await notify(body, undefined)).status, 401)
    assert.equal(rows.size, 0)
    assert.equal(creemCalls.length, 0)
  })

  it('ends on Creem’s state when a late notification contradicts it', async () => {
    creemSubs.set('sub_1', creemSub('expired', EARLIER))
    for (const body of [event('subscription.expired', 'expired'), event('subscription.paid', 'active')]) {
      assert.equal((await notify(body, await signatureOf(ENV.CREEM_WEBHOOK_SECRET, body))).status, 200)
    }
    assert.equal(rows.get('sub_1').status, 'expired')
  })

  it('leaves the row as it was when the same notification comes twice', async () => {
    const body = event('subscription.paid', 'active')
    const signature = await signatureOf(ENV.CREEM_WEBHOOK_SECRET, body)
    await notify(body, signature)
    const first = { ...rows.get('sub_1') }
    assert.equal((await notify(body, signature)).status, 200)
    assert.deepEqual(rows.get('sub_1'), first)
    assert.equal(rows.size, 1)
  })

  it('finds the subscription a completed checkout names', async () => {
    const body = JSON.stringify({ eventType: 'checkout.completed', object: { id: 'ch_1', object: 'checkout', subscription: { id: 'sub_1' } } })
    assert.equal((await notify(body, await signatureOf(ENV.CREEM_WEBHOOK_SECRET, body))).status, 200)
    assert.equal(rows.get('sub_1').status, 'active')
  })

  it('answers 200 and writes nothing for a subscription with no user', async () => {
    creemSubs.set('sub_1', { ...creemSub('active'), metadata: {} })
    const body = event('subscription.paid', 'active')
    assert.equal((await notify(body, await signatureOf(ENV.CREEM_WEBHOOK_SECRET, body))).status, 200)
    assert.equal(rows.size, 0)
  })

  it('answers 5xx when Creem cannot be read, so Creem retries', async () => {
    creemDown = true
    const body = event('subscription.paid', 'active')
    const res = await notify(body, await signatureOf(ENV.CREEM_WEBHOOK_SECRET, body))
    assert.ok(res.status >= 500)
    assert.equal(rows.size, 0)
  })

  it('refuses every billing route when this build carries no store', async () => {
    const body = event('subscription.paid', 'active')
    const env = { ...ENV, CREEM_API_KEY: undefined }
    const res = await notify(body, await signatureOf(ENV.CREEM_WEBHOOK_SECRET, body), env)
    assert.equal(res.status, 503)
    assert.equal((await res.json()).error.code, 'billing_unavailable')
    assert.equal((await signedIn('GET', '/v1/billing', undefined, env)).status, 503)
    assert.equal((await worker.fetch(new Request('https://api.example/health'), env, ctx)).status, 200)
  })
})

describe('the signed-in billing routes', () => {
  it('reads the plan for a sign-in Cloud has not admitted', async () => {
    rows.set('sub_1', { ...row('active'), user_id: SUBJECT })
    rows.set('sub_9', { ...row('active'), id: 'sub_9', user_id: OTHER, period: 'yearly' })
    const res = await signedIn('GET', '/v1/billing')
    assert.equal(res.status, 200)
    assert.deepEqual((await res.json()).billing, { plan: 'pro', state: 'active', period: 'monthly', periodEnd: LATER, grantEnd: null })
  })

  it('shows Pro this month\'s credits, and nobody else any', async () => {
    rows.set('sub_1', { ...row('active'), user_id: SUBJECT })
    spent[SUBJECT] = 1587.6
    const { credits } = await (await signedIn('GET', '/v1/billing')).json()
    assert.equal(credits.total, MONTHLY_CREDITS)
    assert.equal(credits.left, MONTHLY_CREDITS - 1588)

    rows.clear()
    assert.equal((await (await signedIn('GET', '/v1/billing')).json()).credits, null)
  })

  it('never shows fewer than none, and resets on the first of the next UTC month', () => {
    const late = creditsOf(MONTHLY_CREDITS + 40, Date.parse('2026-12-31T23:30:00Z'))
    assert.equal(late.left, 0)
    assert.equal(late.resetsAt, '2027-01-01T00:00:00.000Z')
  })

  it('refuses a caller with no sign-in', async () => {
    const res = await worker.fetch(new Request('https://api.example/v1/billing'), ENV, ctx)
    assert.equal(res.status, 401)
  })

  it('starts a checkout for the chosen period, carrying the user and their email', async () => {
    const res = await signedIn('POST', '/v1/billing/checkout', { period: 'yearly' })
    assert.equal(res.status, 200)
    assert.equal((await res.json()).url, 'https://checkout.creem.io/ch_1')
    assert.deepEqual(creemCalls[0].body, {
      product_id: 'prod_year',
      success_url: 'https://cloud.ai4kanban.dev/settings?checkout=done',
      metadata: { userId: SUBJECT },
      customer: { email: 'lin@example.com' },
    })
    assert.equal(creemCalls[0].headers['x-api-key'], 'creem_live_key')
  })

  it('lands a desktop checkout on the public done page, and any other on settings', async () => {
    await signedIn('POST', '/v1/billing/checkout', { period: 'monthly', source: 'desktop' })
    assert.equal(creemCalls[0].body.success_url, 'https://cloud.ai4kanban.dev/billing/done')
    await signedIn('POST', '/v1/billing/checkout', { period: 'monthly' })
    assert.equal(creemCalls[1].body.success_url, 'https://cloud.ai4kanban.dev/settings?checkout=done')
  })

  it('lists the caller’s charges newest first, and none with no subscription', async () => {
    const none = await signedIn('GET', '/v1/billing/invoices')
    assert.deepEqual((await none.json()).invoices, [])
    assert.equal(creemCalls.length, 0)

    rows.set('sub_1', { ...row('active'), user_id: SUBJECT })
    const tx = (id, status, created_at, customer = 'cust_1') => ({ id, customer, amount: 1500, currency: 'USD', status, created_at })
    creemTxs = [
      tx('tx_1', 'paid', 1_780_000_000_000),
      tx('tx_2', 'refunded', 1_790_000_000),
      tx('tx_3', 'pending', 1_795_000_000_000),
      tx('tx_4', 'declined', 1_785_000_000_000),
      tx('tx_9', 'paid', 1_799_000_000_000, 'cust_9'),
    ]
    const res = await signedIn('GET', '/v1/billing/invoices')
    assert.equal(res.status, 200)
    assert.deepEqual((await res.json()).invoices, [
      { id: 'tx_2', date: new Date(1_790_000_000_000).toISOString(), amount: 1500, currency: 'USD', status: 'refunded' },
      { id: 'tx_4', date: new Date(1_785_000_000_000).toISOString(), amount: 1500, currency: 'USD', status: 'failed' },
      { id: 'tx_1', date: new Date(1_780_000_000_000).toISOString(), amount: 1500, currency: 'USD', status: 'paid' },
    ])
  })

  it('sends somebody already on Pro to settings instead of a second subscription', async () => {
    rows.set('sub_1', { ...row('scheduled_cancel'), user_id: SUBJECT })
    const res = await signedIn('POST', '/v1/billing/checkout', { period: 'monthly' })
    assert.equal((await res.json()).url, 'https://cloud.ai4kanban.dev/settings')
    assert.equal(creemCalls.length, 0)
  })

  it('lets a seed partner subscribe early, and reports the grant (#1039)', async () => {
    grants[SUBJECT] = { starts_at: EARLIER, ends_at: '2099-01-01T00:00:00.000Z' }
    const read = await (await signedIn('GET', '/v1/billing')).json()
    assert.equal(read.billing.plan, 'pro')
    assert.equal(read.billing.grantEnd, '2099-01-01T00:00:00.000Z')
    assert.notEqual(read.credits, null)

    const res = await signedIn('POST', '/v1/billing/checkout', { period: 'yearly' })
    assert.equal((await res.json()).url, 'https://checkout.creem.io/ch_1')
  })

  it('refuses a period Pro does not sell, and says so when Creem fails', async () => {
    assert.equal((await signedIn('POST', '/v1/billing/checkout', { period: 'weekly' })).status, 400)
    creemDown = true
    const res = await signedIn('POST', '/v1/billing/checkout', { period: 'monthly' })
    assert.equal(res.status, 502)
    assert.equal((await res.json()).error.code, 'billing_failed')
  })

  it('confirms a returning checkout only when it is the caller’s', async () => {
    creemSubs.set('sub_1', creemSub('active'))
    creemSubs.set('sub_2', { ...creemSub('active'), id: 'sub_2', metadata: { userId: OTHER } })

    const theirs = await signedIn('POST', '/v1/billing/confirm', { subscriptionId: 'sub_2' })
    assert.equal((await theirs.json()).billing.plan, 'free')
    assert.equal(rows.size, 0)

    const mine = await signedIn('POST', '/v1/billing/confirm', { subscriptionId: 'sub_1' })
    assert.equal((await mine.json()).billing.plan, 'pro')
  })

  it('opens the portal for the caller’s customer, and refuses one with none', async () => {
    assert.equal((await signedIn('POST', '/v1/billing/portal')).status, 404)
    rows.set('sub_1', { ...row('past_due'), user_id: SUBJECT })
    const res = await signedIn('POST', '/v1/billing/portal')
    assert.equal((await res.json()).url, 'https://creem.io/portal/cust_1')
  })
})

describe('a refund or chargeback', () => {
  const tx = (id, status, extra = {}) => ({
    id, customer: 'cust_1', subscription: 'sub_1', amount: 1500, currency: 'USD', status,
    created_at: 1_790_000_000_000, period_end: Date.parse(LATER), ...extra,
  })
  const send = async (body) => {
    const res = await notify(body, await signatureOf(ENV.CREEM_WEBHOOK_SECRET, body))
    assert.equal(res.status, 200)
  }
  const refundEvent = JSON.stringify({ eventType: 'refund.created', object: { id: 'ref_1', object: 'refund', subscription: { id: 'sub_1' } } })
  const read = async () => (await signedIn('GET', '/v1/billing')).json()

  beforeEach(() => {
    creemSubs.set('sub_1', { ...creemSub('canceled'), canceled_at: CANCELED_AT })
  })

  for (const status of ['refunded', 'partialRefund', 'chargedBack', 'chargeback']) {
    it(`ends Pro and its credits at once on a ${status} charge`, async () => {
      creemTxs = [tx('tx_1', status)]
      await send(refundEvent)
      const { billing, credits } = await read()
      assert.deepEqual(billing, { plan: 'free', state: 'expired', period: 'monthly', periodEnd: CANCELED_AT, grantEnd: null })
      assert.equal(credits, null)
    })
  }

  it('ends Pro as a dispute opens, before the charge reads as charged back', async () => {
    creemSubs.set('sub_1', creemSub('active'))
    creemTxs = [tx('tx_1', 'paid')]
    const body = JSON.stringify({
      eventType: 'dispute.created',
      object: { id: 'dp_1', object: 'dispute', subscription: 'sub_1', transaction: tx('tx_1', 'paid') },
    })
    await send(body)
    const { billing } = await read()
    assert.equal(billing.plan, 'free')
    assert.equal(billing.periodEnd, REVOKED_NOW)
  })

  it('keeps a cancel with no refund Pro until its period ends', async () => {
    creemTxs = [tx('tx_1', 'paid')]
    await send(refundEvent)
    const { billing, credits } = await read()
    assert.deepEqual(billing, { plan: 'pro', state: 'canceled', period: 'monthly', periodEnd: LATER, grantEnd: null })
    assert.notEqual(credits, null)
  })

  it('ignores a refund of another subscription, or of a period long over', async () => {
    creemTxs = [tx('tx_1', 'refunded', { subscription: 'sub_9' }), tx('tx_0', 'refunded', { period_end: Date.parse(EARLIER) })]
    await send(refundEvent)
    assert.equal((await read()).billing.plan, 'pro')
  })

  it('makes a renewal after the refund Pro again', async () => {
    creemTxs = [tx('tx_1', 'refunded')]
    await send(refundEvent)
    creemSubs.set('sub_1', creemSub('active', NEXT))
    creemTxs.push(tx('tx_2', 'paid', { period_end: Date.parse(NEXT) }))
    await send(JSON.stringify({ eventType: 'subscription.paid', object: { id: 'sub_1', object: 'subscription' } }))
    const { billing } = await read()
    assert.deepEqual(billing, { plan: 'pro', state: 'active', period: 'monthly', periodEnd: NEXT, grantEnd: null })
  })

  it('lets a revoked subscriber buy again', async () => {
    creemTxs = [tx('tx_1', 'refunded')]
    await send(refundEvent)
    const res = await signedIn('POST', '/v1/billing/checkout', { period: 'monthly' })
    assert.equal((await res.json()).url, 'https://checkout.creem.io/ch_1')
  })

  it('lands on the same row whatever order and however often the notifications come', async () => {
    creemTxs = [tx('tx_1', 'refunded')]
    const cancel = JSON.stringify({ eventType: 'subscription.canceled', object: { id: 'sub_1', object: 'subscription' } })
    await send(refundEvent)
    const first = { ...rows.get('sub_1') }
    for (const body of [cancel, refundEvent, cancel]) await send(body)
    assert.deepEqual(rows.get('sub_1'), first)

    rows.clear()
    for (const body of [cancel, refundEvent]) await send(body)
    assert.deepEqual(rows.get('sub_1'), first)
  })
})

const ctx = { waitUntil() {} }

function creemSub(status, end = LATER) {
  return {
    id: 'sub_1',
    object: 'subscription',
    status,
    product: { id: 'prod_month', billing_period: 'every-month' },
    customer: { id: 'cust_1', email: 'lin@example.com' },
    current_period_end_date: end,
    metadata: { userId: SUBJECT },
  }
}

function notify(body, signature, env = ENV) {
  const headers = { 'content-type': 'application/json' }
  if (signature !== undefined) headers['creem-signature'] = signature
  return worker.fetch(
    new Request('https://api.example/v1/billing/webhook', { method: 'POST', headers, body }),
    env,
    ctx,
  )
}

async function signedIn(method, path, body, env = ENV) {
  const request = new Request(`https://api.example${path}`, {
    method,
    headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  return worker.fetch(request, env, ctx)
}

async function token() {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    sub: SUBJECT,
    email: 'lin@example.com',
    iss: issuerFor(SUPABASE_URL),
    aud: 'authenticated',
    exp: now + 3600,
  }
  const input = `${b64u(JSON.stringify({ alg: 'ES256', kid: 'k' }))}.${b64u(JSON.stringify(claims))}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    new TextEncoder().encode(input),
  )
  return `${input}.${b64uBytes(new Uint8Array(signature))}`
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const b64u = (text) => b64uBytes(new TextEncoder().encode(text))

const b64uBytes = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
