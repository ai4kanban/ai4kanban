// The invitation loop's Worker half (#327): the two refusals a code can come back with, and
// the outbox the hourly run drains. The database's own rules are checked against the live
// project — see the verify notes on the card.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { redeemInvitation, requestInvite, sendPendingMail } from '../src/invites.ts'

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

    await assert.rejects(requestInvite(ENV, SUBJECT), { code: 'no_verified_address' })
  })
})

describe('redeemInvitation', () => {
  const cases = [
    ['unknown', 'invitation_unknown'],
    ['redeemed', 'invitation_redeemed'],
    ['withdrawn', 'invitation_withdrawn'],
  ]

  for (const [reason, code] of cases) {
    it(`turns a ${reason} code into a refusal of its own`, async () => {
      answers.redeem_invitation = { ok: false, reason }

      await assert.rejects(redeemInvitation(ENV, SUBJECT, 'AK4B-0000-0000'), (error) => {
        assert.equal(error.code, code)
        assert.equal(error.status, 403)
        return true
      })
    })
  }

  it('admits the account when the code is good', async () => {
    answers.redeem_invitation = { ok: true, code: 'AK4B-7QF2-M3XD' }

    await redeemInvitation(ENV, SUBJECT, 'ak4b 7qf2 m3xd')

    assert.equal(rpcCalls[0].args.p_code, 'ak4b 7qf2 m3xd')
  })
})

describe('sendPendingMail', () => {
  const request = {
    kind: 'request',
    ref: '22222222-2222-4222-8222-222222222222',
    email: 'asker@example.com',
    handle: 'asker',
    code: null,
    queued_at: '2026-08-24T09:00:00Z',
  }
  const invitation = {
    kind: 'invitation',
    ref: 'AK4B-7QF2-M3XD',
    email: 'invited@example.com',
    handle: null,
    code: 'AK4B-7QF2-M3XD',
    queued_at: '2026-08-24T10:00:00Z',
  }

  it('does nothing at all when nothing is queued', async () => {
    answers.pending_mail = []

    assert.deepEqual(await sendPendingMail(ENV), { queued: 0, sent: 0, failed: 0 })
    assert.equal(sends.length, 0)
  })

  it('sends the code to the address it was issued for, replying to support', async () => {
    answers.pending_mail = [invitation]

    assert.deepEqual(await sendPendingMail(ENV), { queued: 1, sent: 1, failed: 0 })
    assert.deepEqual(sends[0].to, ['invited@example.com'])
    assert.equal(sends[0].reply_to, 'support@ai4kanban.dev')
    assert.match(sends[0].from, /invites@send\.ai4kanban\.dev/)
    assert.match(sends[0].text, /AK4B-7QF2-M3XD/)
    assert.match(sends[0].text, /Configuration/)
  })

  it('sends the notice to support, replying to whoever asked', async () => {
    answers.pending_mail = [request]

    await sendPendingMail(ENV)

    assert.deepEqual(sends[0].to, ['support@ai4kanban.dev'])
    assert.equal(sends[0].reply_to, 'asker@example.com')
    assert.match(sends[0].text, /@asker/)
    assert.match(sends[0].text, /approve_invite_request/)
  })

  it('marks a record sent the moment the provider accepts it', async () => {
    answers.pending_mail = [invitation]

    await sendPendingMail(ENV)

    const marked = rpcCalls.find((c) => c.fn === 'mark_mail_sent')
    assert.deepEqual(marked.args, { p_kind: 'invitation', p_ref: 'AK4B-7QF2-M3XD' })
  })

  it('counts it sent though the mark itself answers with no body', async () => {
    answers.pending_mail = [invitation]

    assert.deepEqual(await sendPendingMail(ENV), { queued: 1, sent: 1, failed: 0 })
    assert.equal(
      rpcCalls.some((c) => c.fn === 'mark_mail_failed'),
      false,
    )
  })

  it('keeps the provider’s own words on a record it would not take', async () => {
    answers.pending_mail = [invitation]
    resendStatus = 422

    assert.deepEqual(await sendPendingMail(ENV), { queued: 1, sent: 0, failed: 1 })
    const marked = rpcCalls.find((c) => c.fn === 'mark_mail_failed')
    assert.equal(marked.args.p_kind, 'invitation')
    assert.match(marked.args.p_error, /422/)
    assert.equal(
      rpcCalls.some((c) => c.fn === 'mark_mail_sent'),
      false,
    )
  })

  it('carries on through a failure rather than stopping the run', async () => {
    answers.pending_mail = [request, invitation]
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
    answers.pending_mail = [invitation]

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
