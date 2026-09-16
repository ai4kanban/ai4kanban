// The contact form's Worker half (#784): what the route accepts, the two rate-limit keys it
// hands the database, the refusal a caller past either sees, and the outbox behind it. The
// counting itself is checked against a real Postgres in test/sql/checks.sql.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { CONTACT_RECEIVED, routeContact, sendPendingContactMail } from '../src/contact.ts'
import worker from '../src/index.ts'

const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  RESEND_API_KEY: 'resend-key',
}
const VOID = new Set(['mark_contact_mail_sent', 'mark_contact_mail_failed'])

const realFetch = globalThis.fetch
let answers
let refusals
let rpcCalls
let sends
let resendStatus
let deferred

beforeEach(() => {
  answers = { submit_contact: { id: 'row-1', created_at: '2026-09-16T00:00:00Z' }, pending_contact_mail: [] }
  refusals = {}
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
    const args = JSON.parse(init.body)
    rpcCalls.push({ fn, args })
    const refuse = refusals[fn]?.(args)
    if (refuse) return new Response(JSON.stringify(refuse), { status: 400 })
    if (VOID.has(fn)) return new Response(null, { status: 204 })
    return json(fn in answers ? answers[fn] : {})
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

const ctx = () => ({ waitUntil: (p) => deferred.push(p) })
const settle = () => Promise.all(deferred)

const form = (overrides = {}) => ({
  opId: 'op-1',
  reason: 'support',
  email: 'Lin@Example.com',
  message: 'The board will not open.\nVersion 1.2.3.',
  ...overrides,
})

const submitArgs = () => rpcCalls.find((c) => c.fn === 'submit_contact')?.args

/** What the database raises for a key past its window. */
const TOO_MANY = { code: 'AKB18', message: 'Too many booking attempts. Try again shortly.' }

describe('taking a message', () => {
  it('stores it and answers with words the page can show', async () => {
    const response = await routeContact(post(form()), ENV, ctx())

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { received: true, message: CONTACT_RECEIVED })
    const args = submitArgs()
    assert.equal(args.p_op_id, 'op-1')
    assert.equal(args.p_reason, 'support')
    assert.equal(args.p_email, 'Lin@Example.com')
    assert.equal(args.p_message, 'The board will not open.\nVersion 1.2.3.')
    assert.equal(args.p_workflow, '')
    assert.ok(args.p_daily_write_budget > 0)
  })

  it('keeps the workflow only for a customize request', async () => {
    await routeContact(post(form({ workflow: 'ignored' })), ENV, ctx())
    assert.equal(submitArgs().p_workflow, '')

    rpcCalls = []
    await routeContact(post(form({ reason: 'customize', workflow: 'Triage, then a PR.' })), ENV, ctx())
    assert.equal(submitArgs().p_reason, 'customize')
    assert.equal(submitArgs().p_workflow, 'Triage, then a PR.')
  })

  for (const [what, overrides] of [
    ['no id', { opId: '' }],
    ['no reason', { reason: undefined }],
    ['a reason the form does not offer', { reason: 'sales' }],
    ['an address that is not one', { email: 'lin@example' }],
    ['an address too long to be one', { email: `${'a'.repeat(200)}@example.com` }],
    ['an empty message', { message: '   ' }],
    ['a message past its limit', { message: 'x'.repeat(5001) }],
    ['a customize request with no workflow', { reason: 'customize' }],
    ['a workflow past its limit', { reason: 'customize', workflow: 'x'.repeat(5001) }],
  ]) {
    it(`refuses ${what} before it reaches the database`, async () => {
      await assert.rejects(routeContact(post(form(overrides)), ENV, ctx()), { code: 'bad_request' })
      assert.equal(submitArgs(), undefined)
    })
  }

  it('refuses anything but a POST', async () => {
    await assert.rejects(
      routeContact(new Request('https://api.ai4kanban.dev/v1/contact'), ENV, ctx()),
      { code: 'method_not_allowed' },
    )
  })
})

describe('the two rate-limit keys', () => {
  it('hashes the address and the lower-cased email, each under the contact prefix', async () => {
    await routeContact(post(form(), { 'cf-connecting-ip': '203.0.113.7' }), ENV, ctx())
    const args = submitArgs()

    assert.match(args.p_ip_key, /^contact:[0-9a-f]{32}$/)
    assert.match(args.p_email_key, /^contact:[0-9a-f]{32}$/)
    assert.notEqual(args.p_ip_key, args.p_email_key)
    assert.ok(!JSON.stringify(args.p_ip_key).includes('203.0.113.7'))
    assert.equal(args.p_attempt_limit, 5)
    assert.equal(args.p_attempt_window_seconds, 3600)

    rpcCalls = []
    await routeContact(post(form({ email: 'lin@example.com' }), { 'cf-connecting-ip': '203.0.113.7' }), ENV, ctx())
    assert.equal(submitArgs().p_email_key, args.p_email_key, 'the email key follows the case of the address')
  })

  it('counts by email alone when the request carries no address', async () => {
    await routeContact(post(form()), ENV, ctx())

    assert.equal(submitArgs().p_ip_key, '')
    assert.match(submitArgs().p_email_key, /^contact:/)
  })

  it('refuses in its own words when the address is past its limit', async () => {
    const ip = { 'cf-connecting-ip': '203.0.113.7' }
    await routeContact(post(form(), ip), ENV, ctx())
    const limited = submitArgs().p_ip_key
    refusals.submit_contact = (args) => (args.p_ip_key === limited ? TOO_MANY : null)

    const refusal = await rejection(routeContact(post(form({ email: 'other@example.com' }), ip), ENV, ctx()))
    assert.equal(refusal.code, 'contact_too_many_attempts')
    assert.equal(refusal.status, 429)
    assert.match(refusal.message, /support@ai4kanban\.dev/)
    assert.doesNotMatch(refusal.message, /booking/i)
  })

  it('refuses when the email is past its limit, from any address', async () => {
    await routeContact(post(form()), ENV, ctx())
    const limited = submitArgs().p_email_key
    refusals.submit_contact = (args) => (args.p_email_key === limited ? TOO_MANY : null)

    const refusal = await rejection(
      routeContact(post(form({ email: 'LIN@example.com' }), { 'cf-connecting-ip': '198.51.100.1' }), ENV, ctx()),
    )
    assert.equal(refusal.code, 'contact_too_many_attempts')
  })

  it('answers a refused submit with the page’s own origin and a retry-after', async () => {
    refusals.submit_contact = () => TOO_MANY
    const response = await worker.fetch(
      post(form(), { origin: 'https://ai4kanban.dev' }),
      ENV,
      ctx(),
    )

    assert.equal(response.status, 429)
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://ai4kanban.dev')
    assert.ok(Number(response.headers.get('retry-after')) > 0)
    const body = await response.json()
    assert.equal(body.error.code, 'contact_too_many_attempts')
  })

  it('answers the preflight for the site and not for anyone else', async () => {
    const preflight = (origin) =>
      worker.fetch(
        new Request('https://api.ai4kanban.dev/v1/contact', { method: 'OPTIONS', headers: { origin } }),
        ENV,
        ctx(),
      )

    const ours = await preflight('https://www.ai4kanban.dev')
    assert.equal(ours.status, 204)
    assert.equal(ours.headers.get('access-control-allow-origin'), 'https://www.ai4kanban.dev')

    const theirs = await preflight('https://example.com')
    assert.equal(theirs.headers.get('access-control-allow-origin'), null)
  })
})

describe('the message to support', () => {
  const queued = (overrides = {}) => ({
    id: 'row-1',
    reason: 'customize',
    email: 'lin@example.com',
    message: 'We want a triage agent.',
    workflow: 'Issues come in, a bot labels them.',
    created_at: '2026-09-16T00:00:00Z',
    ...overrides,
  })

  it('goes to support with the sender as its reply-to, and nothing to the sender', async () => {
    answers.pending_contact_mail = [queued()]
    await routeContact(post(form()), ENV, ctx())
    await settle()

    assert.equal(sends.length, 1)
    const [sent] = sends
    assert.deepEqual(sent.to, ['support@ai4kanban.dev'])
    assert.equal(sent.reply_to, 'lin@example.com')
    assert.equal(sent.subject, '[Customize agents] We want a triage agent.')
    assert.match(sent.text, /We want a triage agent\./)
    assert.match(sent.text, /Issues come in, a bot labels them\./)
    assert.ok(rpcCalls.some((c) => c.fn === 'mark_contact_mail_sent' && c.args.p_id === 'row-1'))
  })

  it('keeps a refused send queued for the hourly retry, and still answers the visitor', async () => {
    answers.pending_contact_mail = [queued({ reason: 'support', workflow: '' })]
    resendStatus = 500

    const response = await routeContact(post(form()), ENV, ctx())
    await settle()

    assert.equal(response.status, 200)
    const failed = rpcCalls.find((c) => c.fn === 'mark_contact_mail_failed')
    assert.equal(failed.args.p_id, 'row-1')
    assert.match(failed.args.p_error, /resend answered 500/)
    assert.ok(!rpcCalls.some((c) => c.fn === 'mark_contact_mail_sent'))
  })

  it('does nothing when nothing is owed, and sends nothing without a key', async () => {
    assert.deepEqual(await sendPendingContactMail(ENV), { queued: 0, sent: 0, failed: 0 })

    answers.pending_contact_mail = [queued()]
    assert.deepEqual(await sendPendingContactMail({ ...ENV, RESEND_API_KEY: undefined }), {
      queued: 1,
      sent: 0,
      failed: 0,
    })
    assert.equal(sends.length, 0)
  })

  it('cuts a long first line in the subject', async () => {
    answers.pending_contact_mail = [queued({ message: 'x'.repeat(100) })]
    await sendPendingContactMail(ENV)

    assert.equal(sends[0].subject, `[Customize agents] ${'x'.repeat(60)}…`)
  })
})

const json = (body) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

const post = (body, headers = {}) =>
  new Request('https://api.ai4kanban.dev/v1/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })

async function rejection(promise) {
  try {
    await promise
  } catch (error) {
    return error
  }
  assert.fail('the submit was not refused')
}
