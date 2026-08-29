// The invitation loop's Worker half (#327, #350): the refusal asking can come back with, and
// the outbox the hourly run drains. The database's own rules are checked against a real
// Postgres in test/sql/checks.sql.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { requestInvite, sendPendingMail } from '../src/invites.ts'

const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  RESEND_API_KEY: 'resend-key',
}
const SUBJECT = '11111111-1111-4111-8111-111111111111'
/** The `api` functions that return `void`, so a call to one comes back empty. */
const VOID = new Set(['mark_mail_sent', 'mark_mail_failed'])

const realFetch = globalThis.fetch
/** What each `api` function answers with, keyed by name. */
let answers
let rpcCalls
let sends
let resendStatus

beforeEach(() => {
  answers = {}
  rpcCalls = []
  sends = []
  resendStatus = 200
  globalThis.fetch = async (url, init) => {
    const address = String(url)
    if (address === 'https://api.resend.com/emails') {
      sends.push(JSON.parse(init.body))
      return new Response(JSON.stringify({ id: 'sent' }), { status: resendStatus })
    }
    const fn = address.split('/rest/v1/rpc/')[1]
    rpcCalls.push({ fn, args: JSON.parse(init.body) })
    // The two marks return `void`, and PostgREST answers those with no body at all.
    if (VOID.has(fn)) return new Response(null, { status: 204 })
    return json(answers[fn] ?? {})
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('requestInvite', () => {
  it('records the request and answers with when it was asked', async () => {
    answers.request_invite = { ok: true, requested_at: '2026-08-24T09:00:00Z' }

    assert.equal(await requestInvite(ENV, SUBJECT), '2026-08-24T09:00:00Z')
    assert.equal(rpcCalls[0].args.p_subject, SUBJECT)
  })

  it('refuses an account the provider attests no address for', async () => {
    answers.request_invite = { ok: false, reason: 'no_address' }

    await assert.rejects(requestInvite(ENV, SUBJECT), (error) => {
      assert.equal(error.code, 'no_verified_address')
      // Nothing is mailed to that account, so nothing names a code it could paste back.
      assert.doesNotMatch(error.message, /code/i)
      return true
    })
  })

  it('refuses a sign-in with no attested handle the way the session does', async () => {
    answers.request_invite = { ok: false, reason: 'no_provider' }

    await assert.rejects(requestInvite(ENV, SUBJECT), { code: 'not_admitted' })
  })
})

describe('sendPendingMail', () => {
  const REQUEST_ID = '22222222-2222-4222-8222-222222222222'
  const notice = {
    kind: 'request',
    ref: REQUEST_ID,
    email: 'asker@example.com',
    handle: 'asker',
    queued_at: '2026-08-24T09:00:00Z',
  }
  const approval = {
    kind: 'approval',
    ref: REQUEST_ID,
    email: 'asker@example.com',
    handle: 'asker',
    queued_at: '2026-08-24T10:00:00Z',
  }

  it('does nothing at all when nothing is queued', async () => {
    answers.pending_mail = []

    assert.deepEqual(await sendPendingMail(ENV), { queued: 0, sent: 0, failed: 0 })
    assert.equal(sends.length, 0)
  })

  it('tells the requester they are in, and asks them to paste nothing', async () => {
    answers.pending_mail = [approval]

    assert.deepEqual(await sendPendingMail(ENV), { queued: 1, sent: 1, failed: 0 })
    assert.deepEqual(sends[0].to, ['asker@example.com'])
    assert.equal(sends[0].reply_to, 'support@ai4kanban.dev')
    assert.match(sends[0].from, /invites@ai4kanban\.dev/)
    assert.match(sends[0].text, /approved/)
    assert.match(sends[0].text, /Configuration/)
    assert.doesNotMatch(sends[0].text, /code/i)
  })

  it('sends the notice to support, replying to whoever asked', async () => {
    answers.pending_mail = [notice]

    await sendPendingMail(ENV)

    assert.deepEqual(sends[0].to, ['support@ai4kanban.dev'])
    assert.equal(sends[0].reply_to, 'asker@example.com')
    assert.match(sends[0].text, /@asker/)
    assert.match(sends[0].text, /approve_invite_request/)
    // What approving does, so nobody reading it goes looking for a code to send on.
    assert.match(sends[0].text, /admits the account/)
    // The command is given ready to run, with the handle it approves in it.
    assert.match(sends[0].text, /npm run invite approve asker/)
  })

  it('marks a record sent by kind, so one request row can owe two messages', async () => {
    answers.pending_mail = [approval]

    await sendPendingMail(ENV)

    const marked = rpcCalls.find((c) => c.fn === 'mark_mail_sent')
    assert.deepEqual(marked.args, { p_kind: 'approval', p_ref: REQUEST_ID })
  })

  it('counts it sent though the mark itself answers with no body', async () => {
    answers.pending_mail = [approval]

    assert.deepEqual(await sendPendingMail(ENV), { queued: 1, sent: 1, failed: 0 })
    assert.equal(
      rpcCalls.some((c) => c.fn === 'mark_mail_failed'),
      false,
    )
  })

  it('keeps the provider’s own words on a record it would not take', async () => {
    answers.pending_mail = [approval]
    resendStatus = 422

    assert.deepEqual(await sendPendingMail(ENV), { queued: 1, sent: 0, failed: 1 })
    const marked = rpcCalls.find((c) => c.fn === 'mark_mail_failed')
    assert.equal(marked.args.p_kind, 'approval')
    assert.match(marked.args.p_error, /422/)
    assert.equal(
      rpcCalls.some((c) => c.fn === 'mark_mail_sent'),
      false,
    )
  })

  it('carries on through a failure rather than stopping the run', async () => {
    answers.pending_mail = [notice, approval]
    let first = true
    const send = globalThis.fetch
    globalThis.fetch = async (url, init) => {
      if (String(url) === 'https://api.resend.com/emails' && first) {
        first = false
        throw new Error('network down')
      }
      return send(url, init)
    }

    assert.deepEqual(await sendPendingMail(ENV), { queued: 2, sent: 1, failed: 1 })
  })

  it('sends nothing and says so when the key is not set', async () => {
    answers.pending_mail = [approval]

    assert.deepEqual(await sendPendingMail({ ...ENV, RESEND_API_KEY: undefined }), {
      queued: 1,
      sent: 0,
      failed: 0,
    })
    assert.equal(sends.length, 0)
  })
})

const json = (body) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
