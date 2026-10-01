// Judging one triage item (#1221): only a Pro user reaches it, it is free, and the key never
// leaves the Worker.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { jwksUrl, issuerFor, resetJwksCache } from '../src/auth.ts'
import worker from '../src/index.ts'
import { DECISIONS_URL, JUDGE_MODEL } from '../src/judge.ts'

const SUPABASE_URL = 'https://project.supabase.co'
const ENV = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role', OPENROUTER_API_KEY: 'or-key' }
const SUBJECT = '11111111-1111-4111-8111-111111111111'
const PRO = { id: 'sub_1', customer_id: 'c', period: 'yearly', status: 'active', current_period_end: null }
const QUESTIONS = {
  verdict: { type: 'choice', instructions: 'What should become of this item?', criteria: { small: 'Small.', plan: 'Plan it.' } },
}
const ANSWER = {
  answers: { verdict: { type: 'choice', choice: 'plan', confidence: 0.7, probabilities: { small: 0.15, plan: 0.85 } } },
  model: 'typesafe/jev-1.13-20260917',
  usage: { cost: 0.0002, input_tokens: 3000, output_tokens: 20 },
}

const realFetch = globalThis.fetch
const realLog = console.log
let keyPair
let subscriptions
let provider
let sent
let spent
let logged

beforeEach(async () => {
  resetJwksCache()
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  subscriptions = { [SUBJECT]: [PRO] }
  provider = () => json(ANSWER)
  sent = []
  spent = 0
  logged = []
  console.log = (...args) => void logged.push(args.join(' '))
  globalThis.fetch = async (url, init) => {
    const address = String(url)
    if (address === jwksUrl(SUPABASE_URL)) return json({ keys: [{ ...jwk, kid: 'k', alg: 'ES256' }] })
    if (address.endsWith('/rest/v1/rpc/account_for_session')) {
      return json({ admitted: false, handle: 'lin', name: null, avatar_url: null, account_id: null })
    }
    const body = init?.body ? JSON.parse(init.body) : {}
    if (address.endsWith('/rest/v1/rpc/subscriptions_for')) return json(subscriptions[body.p_user_id] ?? [])
    if (address.endsWith('/rest/v1/rpc/seed_grant_for')) return json(null)
    if (address.endsWith('/rest/v1/rpc/credits_used')) return json(0)
    if (address.endsWith('/rest/v1/rpc/spend_credits')) {
      spent++
      return json(0)
    }
    if (address === DECISIONS_URL) {
      sent.push({ headers: init.headers, body })
      return provider()
    }
    throw new Error(`unexpected fetch of ${address}`)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
  console.log = realLog
})

describe('POST /v1/judge', () => {
  it('forwards the state and questions to Jev and answers each choice as it came back', async () => {
    const res = await call({ state: { item: 'Dark mode?' }, questions: QUESTIONS })

    assert.equal(res.status, 200)
    assert.deepEqual(await res.json(), {
      answers: { verdict: { choice: 'plan', confidence: 0.7, probabilities: { small: 0.15, plan: 0.85 } } },
      model: 'typesafe/jev-1.13-20260917',
    })
    assert.deepEqual(sent[0].body, { model: JUDGE_MODEL, state: { item: 'Dark mode?' }, questions: QUESTIONS })
    assert.equal(sent[0].headers.authorization, 'Bearer or-key')
  })

  it('spends no credits and logs what the answer cost', async () => {
    await call({ state: 'x', questions: QUESTIONS })
    assert.equal(spent, 0)
    assert.ok(logged.some((line) => line.includes('cloud: judged') && line.includes('"cost":0.0002')))
  })

  it('refuses a free user before reaching the provider', async () => {
    subscriptions[SUBJECT] = []
    const res = await call({ state: 'x', questions: QUESTIONS })

    assert.equal(res.status, 403)
    assert.equal((await res.json()).error.code, 'pro_required')
    assert.equal(sent.length, 0)
  })

  it('refuses a malformed ask before reaching the provider', async () => {
    const refused = async (body, words) => {
      const res = await call(body)
      assert.equal(res.status, 400)
      assert.match((await res.json()).error.message, words)
    }
    await refused({ questions: QUESTIONS }, /state/)
    await refused({ state: 'x' }, /questions/)
    await refused({ state: 'x', questions: {} }, /at least one/)
    await refused({ state: 'x', questions: { v: { type: 'noul', instructions: 'Is it?', criteria: { a: 'A', b: 'B' } } } }, /choice/)
    await refused({ state: 'x', questions: { v: { type: 'choice', instructions: 'Which?', criteria: { a: 'A' } } } }, /options/)
    await refused({ state: 'x'.repeat(200_001), questions: QUESTIONS }, /too long/)
    assert.equal(sent.length, 0)
  })

  it('asks as many questions as it is given', async () => {
    const names = ['verdict', 'duplicate', 'modules', 'priority', 'roi', 'workflow']
    const questions = Object.fromEntries(names.map((name) => [name, QUESTIONS.verdict]))
    provider = () => json({ ...ANSWER, answers: Object.fromEntries(names.map((name) => [name, ANSWER.answers.verdict])) })
    const res = await call({ state: 'x', questions })
    assert.equal(res.status, 200)
    assert.deepEqual(Object.keys((await res.json()).answers), names)
  })

  it('says so when this build carries no key', async () => {
    const res = await call({ state: 'x', questions: QUESTIONS }, { ...ENV, OPENROUTER_API_KEY: undefined })
    assert.equal(res.status, 503)
    assert.equal((await res.json()).error.code, 'judge_unavailable')
  })

  it('fails when the provider fails or leaves a question unanswered', async () => {
    provider = () => json({ error: { message: 'upstream' } }, 502)
    const failed = await call({ state: 'x', questions: QUESTIONS })
    assert.equal(failed.status, 502)
    assert.equal((await failed.json()).error.code, 'judge_failed')

    provider = () => json({ answers: {} })
    assert.equal((await call({ state: 'x', questions: QUESTIONS })).status, 502)

    provider = () => {
      throw new Error('offline')
    }
    assert.equal((await call({ state: 'x', questions: QUESTIONS })).status, 502)
  })
})

async function call(body, env = ENV) {
  const request = new Request('https://api.example/v1/judge', {
    method: 'POST',
    headers: { authorization: `Bearer ${await token(SUBJECT)}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return worker.fetch(request, env, { waitUntil() {} })
}

async function token(subject) {
  const now = Math.floor(Date.now() / 1000)
  const claims = { sub: subject, iss: issuerFor(SUPABASE_URL), aud: 'authenticated', exp: now + 3600 }
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
