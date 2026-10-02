/**
 * Pro, sold through Creem (#1037). Creem is called over REST, with no SDK.
 *
 * Every route here is open to a verified sign-in, admitted or not: a subscription belongs to
 * the Supabase user, not to a Cloud account. A row is only ever written with what was just
 * read back from Creem, so repeated and out-of-order notifications converge on Creem's
 * current state. Whether a row is Pro is decided when it is read, so expiry needs nothing.
 *
 * A notification can be lost, so every checkout started is noted, and settled against Creem
 * when its user next reads their plan or starts another (#1251).
 */

import { CLOUD_UI_ORIGIN } from './config.ts'
import { creditsOf, creditsUsed } from './credits.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, billingFailed, billingUnavailable, notFound, unauthenticated } from './errors.ts'
import { bodyOf, json, requireMethod } from './http.ts'
import { readSession } from './owner.ts'
import { hex, sameString } from './verify.ts'

export type Period = 'monthly' | 'yearly'

/** A row as `api.subscriptions_for` returns it. */
export interface SubscriptionRow {
  id: string
  customer_id: string
  period: Period
  status: string
  current_period_end: string | null
  /** The latest refunded or charged-back period's end (#1188). */
  refunded_through?: string | null
  revoked_at?: string | null
}

/** A seed partner's grant (#1039), as `api.seed_grant_for` returns it. */
export interface GrantRow {
  starts_at: string
  ends_at: string
}

/** What `/settings` draws and #1038 gates on. `plan` is Pro through a subscription or a grant;
 *  `state`, `period` and `periodEnd` are the subscription's alone. */
export interface Billing {
  plan: 'free' | 'pro'
  state: 'free' | 'active' | 'canceled' | 'pastDue' | 'expired'
  period: Period | null
  /** The renewal date while `active` or `pastDue`, the end date otherwise. */
  periodEnd: string | null
  /** The grant's end, while it lasts. */
  grantEnd: string | null
}

/** Whether a subscription is being paid for — what stops a second checkout. */
export const subscribed = (billing: Billing) =>
  billing.state === 'active' || billing.state === 'canceled' || billing.state === 'pastDue'

const RENEWING = ['active', 'trialing', 'past_due']
const ENDING = ['scheduled_cancel', 'canceled']

const DAY = 24 * 60 * 60 * 1000

/** Whether a refund took back the period the row is in. A renewal after it is a later period. */
export const revoked = (row: SubscriptionRow) =>
  !!row.refunded_through &&
  (!row.current_period_end || Date.parse(row.current_period_end) <= Date.parse(row.refunded_through) + DAY)

export function isPro(row: SubscriptionRow, now = Date.now()): boolean {
  if (revoked(row)) return false
  if (RENEWING.includes(row.status)) return true
  if (!ENDING.includes(row.status) || !row.current_period_end) return false
  return now < Date.parse(row.current_period_end)
}

const stateOf = (row: SubscriptionRow): Billing['state'] =>
  row.status === 'past_due' ? 'pastDue' : ENDING.includes(row.status) ? 'canceled' : 'active'

const RANK: Record<string, number> = { active: 0, canceled: 1, pastDue: 2 }
const endOf = (row: SubscriptionRow) => (row.current_period_end ? Date.parse(row.current_period_end) : 0)
/** When the row stopped being Pro: its revoke, or its period's end. */
const endedAt = (row: SubscriptionRow) => (revoked(row) ? row.revoked_at ?? null : row.current_period_end)

/** The best of a user's subscriptions: a renewing one over one ending over one failing to
 *  pay, then the one that runs longest. None Pro reads as expired once any has ended, a
 *  refunded one on the day it was revoked. A grant
 *  still running makes the user Pro whatever the subscriptions say. */
export function billingOf(rows: SubscriptionRow[], grant: GrantRow | null = null, now = Date.now()): Billing {
  const grantEnd = grant && now < Date.parse(grant.ends_at) ? grant.ends_at : null
  const pro = rows
    .filter((row) => isPro(row, now))
    .sort((a, b) => RANK[stateOf(a)]! - RANK[stateOf(b)]! || endOf(b) - endOf(a))
  const best = pro[0]
  if (best) {
    return { plan: 'pro', state: stateOf(best), period: best.period, periodEnd: best.current_period_end, grantEnd }
  }
  const plan = grantEnd ? 'pro' : 'free'
  const ended = (row: SubscriptionRow) => Date.parse(endedAt(row) ?? '') || 0
  const last = rows.filter(ended).sort((a, b) => ended(b) - ended(a))[0]
  return last
    ? { plan, state: 'expired', period: last.period, periodEnd: endedAt(last), grantEnd }
    : { plan, state: 'free', period: null, periodEnd: null, grantEnd }
}

/** The routes under `/v1/billing`. */
export async function routeBilling(request: Request, env: Env, rest: string): Promise<Response> {
  if (rest === 'webhook') {
    requireMethod(request, 'POST')
    return webhook(request, env)
  }
  const creem = creemFor(env)
  const session = await readSession(request, env)

  if (rest === '') {
    requireMethod(request, 'GET')
    const [read, recovered] = await Promise.all([
      readBilling(env, session.subject),
      recoverCheckouts(env, creem, session.subject),
    ])
    const billing = recovered ? await readBilling(env, session.subject) : read
    // AI credits are Pro's alone (#1113): nobody else is granted any to show.
    const credits = billing.plan === 'pro' ? creditsOf(await creditsUsed(env, session.subject)) : null
    return json({ billing, credits })
  }

  if (rest === 'checkout') {
    requireMethod(request, 'POST')
    const { period, source } = ((await bodyOf(request)) ?? {}) as { period?: unknown; source?: unknown }
    if (period !== 'monthly' && period !== 'yearly') throw badRequest('Pick monthly or yearly.')
    // A payment whose notification was lost must not be taken a second time.
    await recoverCheckouts(env, creem, session.subject, true)
    // One subscription per person: a subscriber manages theirs instead. A grant alone may buy.
    if (subscribed(await readBilling(env, session.subject))) {
      return json({ url: `${CLOUD_UI_ORIGIN}/settings` })
    }
    const checkout = await creem<{ id?: string; checkout_url?: string }>('POST', '/v1/checkouts', {
      product_id: period === 'monthly' ? env.CREEM_PRODUCT_MONTHLY : env.CREEM_PRODUCT_YEARLY,
      // The desktop app has no browser sign-in to return to, so it lands on a public page.
      success_url: source === 'desktop' ? `${CLOUD_UI_ORIGIN}/billing/done` : `${CLOUD_UI_ORIGIN}/settings?checkout=done`,
      metadata: { userId: session.subject },
      ...(session.email ? { customer: { email: session.email } } : {}),
    })
    if (!checkout.checkout_url) throw billingFailed()
    try {
      if (!checkout.id) throw new Error('Creem gave the checkout no id')
      await mutate(env, 'record_pending_checkout', { p_id: checkout.id, p_user_id: session.subject })
    } catch (error) {
      console.error('cloud: checkout not noted', checkout.id, error)
    }
    return json({ url: checkout.checkout_url })
  }

  // The checkout's return. Written only when Creem says the subscription is this user's.
  if (rest === 'confirm') {
    requireMethod(request, 'POST')
    const { subscriptionId } = ((await bodyOf(request)) ?? {}) as { subscriptionId?: unknown }
    if (typeof subscriptionId !== 'string' || !subscriptionId) throw badRequest('Give the subscription id.')
    try {
      const sub = await creem<CreemSubscription>('GET', `/v1/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`)
      if (sub.metadata?.userId === session.subject) await record(env, sub, session.subject)
    } catch (error) {
      console.error('cloud: checkout return not confirmed', error)
    }
    return json({ billing: await readBilling(env, session.subject) })
  }

  if (rest === 'invoices') {
    requireMethod(request, 'GET')
    const rows = await call<SubscriptionRow[]>(env, 'subscriptions_for', { p_user_id: session.subject })
    const customers = [...new Set(rows.map((row) => row.customer_id))]
    const pages = await Promise.all(
      customers.map((customer) =>
        creem<{ items?: CreemTransaction[] }>(
          'GET',
          `/v1/transactions/search?customer_id=${encodeURIComponent(customer)}&page_size=50`,
        ),
      ),
    )
    const invoices = pages
      .flatMap((page) => page.items ?? [])
      .map(invoiceOf)
      .filter((invoice): invoice is Invoice => !!invoice)
      .sort((a, b) => b.date.localeCompare(a.date))
    return json({ invoices })
  }

  if (rest === 'portal') {
    requireMethod(request, 'POST')
    const rows = await call<SubscriptionRow[]>(env, 'subscriptions_for', { p_user_id: session.subject })
    const best = rows.find((row) => isPro(row)) ?? rows[0]
    if (!best) throw notFound('This account has no billing to manage.')
    const portal = await creem<{ customer_portal_link?: string }>('POST', '/v1/customers/billing', {
      customer_id: best.customer_id,
    })
    if (!portal.customer_portal_link) throw billingFailed()
    return json({ url: portal.customer_portal_link })
  }

  throw notFound()
}

/** One charge, as the desktop Billing tab lists it. Creem gives no per-charge receipt link, so
 *  a row opens the billing portal. */
export interface Invoice {
  id: string
  date: string
  /** Minor units, as Creem counts them. */
  amount: number
  currency: string
  status: 'paid' | 'refunded' | 'failed'
}

interface CreemTransaction {
  id: string
  amount: number
  amount_paid?: number | null
  currency: string
  status?: string
  created_at?: number
  subscription?: string | { id: string } | null
  period_end?: number | string | null
}

const INVOICE_STATUS: Record<string, Invoice['status']> = {
  paid: 'paid',
  partialRefund: 'refunded',
  refunded: 'refunded',
  chargedBack: 'refunded',
  declined: 'failed',
  uncollectible: 'failed',
}

/** A transaction worth listing, or null for one that never became a charge. */
export function invoiceOf(tx: CreemTransaction): Invoice | null {
  const status = INVOICE_STATUS[tx.status ?? '']
  const date = isoOf(tx.created_at)
  if (!status || typeof tx.created_at !== 'number' || !date) return null
  return {
    id: tx.id,
    date,
    amount: tx.amount_paid ?? tx.amount,
    currency: tx.currency,
    status,
  }
}

// Creem documents a timestamp without its unit; seconds and milliseconds both read right.
function isoOf(value: number | string | null | undefined): string | null {
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value ?? '')
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

export async function readBilling(env: Env, user: string): Promise<Billing> {
  const [rows, grant] = await Promise.all([
    call<SubscriptionRow[]>(env, 'subscriptions_for', { p_user_id: user }),
    call<GrantRow | null>(env, 'seed_grant_for', { p_user_id: user }),
  ])
  return billingOf(rows, grant)
}

// ---- Creem ------------------------------------------------------------------

interface CreemSubscription {
  id: string
  status: string
  customer: string | { id: string }
  product: string | { id: string }
  current_period_end_date?: string | null
  canceled_at?: string | null
  metadata?: { userId?: string } | null
}

type Creem = <T>(method: 'GET' | 'POST', path: string, body?: unknown) => Promise<T>

export const creemBase = (key: string) =>
  key.startsWith('creem_test_') ? 'https://test-api.creem.io' : 'https://api.creem.io'

/** A caller for this build's Creem store, or a refusal when it carries none. */
function creemFor(env: Env): Creem {
  const key = env.CREEM_API_KEY
  if (!key || !env.CREEM_WEBHOOK_SECRET || !env.CREEM_PRODUCT_MONTHLY || !env.CREEM_PRODUCT_YEARLY) {
    throw billingUnavailable()
  }
  return async <T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> => {
    let answer: Response
    try {
      answer = await fetch(`${creemBase(key)}${path}`, {
        method,
        headers: { 'x-api-key': key, 'content-type': 'application/json', accept: 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    } catch (error) {
      console.error('cloud: creem unreachable', path, error)
      throw billingFailed()
    }
    if (!answer.ok) {
      console.error('cloud: creem refused', path, answer.status, await answer.text().catch(() => ''))
      throw billingFailed()
    }
    return (await answer.json()) as T
  }
}

const idOf = (value: string | { id: string } | undefined) =>
  typeof value === 'string' ? value : value?.id

/** Write the row Creem holds. False when there is no user to hang it on, or the product is
 *  not one of Pro's. */
async function record(env: Env, sub: CreemSubscription, user: string | undefined): Promise<boolean> {
  const product = idOf(sub.product)
  const period =
    product === env.CREEM_PRODUCT_MONTHLY ? 'monthly' : product === env.CREEM_PRODUCT_YEARLY ? 'yearly' : null
  const customer = idOf(sub.customer)
  if (!period || !customer) {
    console.warn('cloud: subscription is not Pro', sub.id, product)
    return false
  }
  const written = await mutate<{ id: string } | null>(env, 'record_subscription', {
    p_id: sub.id,
    p_user_id: user ?? null,
    p_customer_id: customer,
    p_period: period,
    p_status: sub.status,
    p_current_period_end: sub.current_period_end_date ?? null,
  })
  return !!written
}

// Creem's dispute sample spells a charged-back transaction `chargeback`.
const REFUNDED = ['refunded', 'partialRefund', 'chargedBack', 'chargeback']

/** Record the latest period of `sub` that was refunded or charged back, reading Creem's
 *  transactions rather than the notification. A dispute is taken as it opens. */
async function recordRefunds(env: Env, creem: Creem, sub: CreemSubscription, disputed: string | CreemTransaction | undefined) {
  const customer = idOf(sub.customer)!
  const page = await creem<{ items?: CreemTransaction[] }>(
    'GET',
    `/v1/transactions/search?customer_id=${encodeURIComponent(customer)}&page_size=50`,
  )
  const txs = [...(page.items ?? []), ...(typeof disputed === 'object' ? [disputed] : [])]
  const disputedId = typeof disputed === 'object' ? disputed.id : disputed
  const through = txs
    .filter((tx) => idOf(tx.subscription ?? undefined) === sub.id)
    .filter((tx) => REFUNDED.includes(tx.status ?? '') || (!!disputedId && tx.id === disputedId))
    .map((tx) => isoOf(tx.period_end))
    .filter((end): end is string => !!end)
    .sort()
    .at(-1)
  if (!through) return
  await mutate(env, 'record_refund', {
    p_id: sub.id,
    p_refunded_through: through,
    p_revoked_at: sub.canceled_at ?? null,
  })
}

// ---- a lost notification ------------------------------------------------------

interface CreemCheckout {
  status?: string
  subscription?: string | { id: string } | null
}

/** Settle the checkouts `user` started that are due a look. True when any was looked at, so
 *  the plan is worth reading again. Never throws: the plan in the database still stands. */
async function recoverCheckouts(env: Env, creem: Creem, user: string, force = false): Promise<boolean> {
  let ids: string[]
  try {
    ids = await mutate<string[]>(env, 'claim_pending_checkouts', { p_user_id: user, p_force: force })
  } catch (error) {
    console.error('cloud: pending checkouts not read', error)
    return false
  }
  for (const id of ids) {
    try {
      if (await settled(env, creem, user, id)) {
        await mutate(env, 'drop_pending_checkout', { p_id: id, p_user_id: user })
      }
    } catch (error) {
      console.error('cloud: checkout not recovered', id, error)
    }
  }
  return ids.length > 0
}

/** Whether Creem has nothing more to say about this checkout, writing the subscription a
 *  completed one made. The user is the one who started it, never one Creem's answer names. */
async function settled(env: Env, creem: Creem, user: string, id: string): Promise<boolean> {
  const checkout = await creem<CreemCheckout>('GET', `/v1/checkouts?checkout_id=${encodeURIComponent(id)}`)
  if (checkout.status === 'expired') return true
  if (checkout.status !== 'completed') return false

  const subscriptionId = idOf(checkout.subscription ?? undefined)
  if (!subscriptionId) {
    console.warn('cloud: completed checkout has no subscription', id)
    return true
  }
  const sub = await creem<CreemSubscription>('GET', `/v1/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`)
  if (sub.metadata?.userId !== user) {
    console.warn('cloud: checkout made a subscription for somebody else', id, subscriptionId)
    return true
  }
  if (await record(env, sub, user)) await recordRefunds(env, creem, sub, undefined)
  return true
}

// ---- notifications ----------------------------------------------------------

export async function signatureOf(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)))
}

/**
 * A Creem notification. Only its subscription id is trusted, and only once signed: the row is
 * re-read from Creem, so a failed read is a 5xx for Creem to retry. Nothing to hang it on is
 * logged and answered 200, since retrying cannot change that.
 */
async function webhook(request: Request, env: Env): Promise<Response> {
  const creem = creemFor(env)
  const body = await request.text()
  const signature = request.headers.get('creem-signature') ?? ''
  if (!sameString(await signatureOf(env.CREEM_WEBHOOK_SECRET!, body), signature)) {
    throw unauthenticated('That notification is signed wrongly.')
  }

  const event = JSON.parse(body || '{}') as {
    eventType?: string
    object?: {
      id?: string
      object?: string
      subscription?: string | { id: string }
      transaction?: string | CreemTransaction
      metadata?: { userId?: string }
    }
  }
  const object = event.object ?? {}
  const subscriptionId = object.object === 'subscription' ? object.id : idOf(object.subscription)
  if (!subscriptionId) return json({ ok: true })

  const sub = await creem<CreemSubscription>('GET', `/v1/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`)
  const user = sub.metadata?.userId ?? object.metadata?.userId
  if (!(await record(env, sub, user))) {
    console.warn('cloud: notification not recorded', event.eventType, subscriptionId)
    return json({ ok: true })
  }
  await recordRefunds(env, creem, sub, event.eventType === 'dispute.created' ? object.transaction : undefined)
  return json({ ok: true })
}
