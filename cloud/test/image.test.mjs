// Generated video covers (#1114): only a Pro user reaches it, a cover costs its flat credits
// once the image is in hand, and the key never leaves the Worker.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { jwksUrl, issuerFor, resetJwksCache } from '../src/auth.ts'
import worker from '../src/index.ts'
import { CREDIT_RATES, MONTHLY_CREDITS } from '../src/credits.ts'
import { IMAGE_MODEL, MAX_REFERENCE_BYTES } from '../src/image.ts'

const SUPABASE_URL = 'https://project.supabase.co'
const ENV = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role', OPENROUTER_API_KEY: 'or-key' }
const SUBJECT = '11111111-1111-4111-8111-111111111111'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const REF = `data:image/png;base64,${Buffer.from(PNG).toString('base64')}`
const PRO = { id: 'sub_1', customer_id: 'c', period: 'yearly', status: 'active', current_period_end: null }

const realFetch = globalThis.fetch
let keyPair
let subscriptions
let used
let provider
let sent
let recorded
let recording

beforeEach(async () => {
  resetJwksCache()
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  subscriptions = { [SUBJECT]: [PRO] }
  used = {}
  provider = () =>
    json({
      id: 'gen-i1',
      data: [{ b64_json: Buffer.from(PNG).toString('base64'), media_type: 'image/png' }],
      usage: { cost: 0.04 },
    })
  sent = []
  recorded = []
  recording = 'up'
  globalThis.fetch = async (url, init) => {
    const address = String(url)
    if (address === jwksUrl(SUPABASE_URL)) return json({ keys: [{ ...jwk, kid: 'k', alg: 'ES256' }] })
    if (address.endsWith('/rest/v1/rpc/account_for_session')) {
      return json({ admitted: false, handle: 'lin', name: null, avatar_url: null, account_id: null })
    }
    const body = init?.body ? JSON.parse(init.body) : {}
    if (address.endsWith('/rest/v1/rpc/subscriptions_for')) return json(subscriptions[body.p_user_id] ?? [])
    if (address.endsWith('/rest/v1/rpc/credits_used')) return json(used[body.p_user_id] ?? 0)
    if (address.endsWith('/rest/v1/rpc/seed_grant_for')) return json(null)
    if (address.endsWith('/rest/v1/rpc/spend_credits')) {
      assert.equal(body.p_use, 'image')
      used[body.p_user_id] = (used[body.p_user_id] ?? 0) + body.p_credits
      return json(used[body.p_user_id])
    }
    if (address.endsWith('/rest/v1/rpc/record_ai_call')) {
      if (recording === 'down') return json({ message: 'down' }, 500)
      recorded.push(body)
      return new Response(null, { status: 204 })
    }
    if (address === 'https://openrouter.ai/api/v1/images') {
      sent.push({ headers: init.headers, body: JSON.parse(init.body) })
      return provider()
    }
    throw new Error(`unexpected fetch of ${address}`)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('POST /v1/image', () => {
  it('answers the image and its model, at medium quality, with the key held by the Worker', async () => {
    const res = await call({ prompt: 'A cover', aspect: '16:9', references: [REF] })

    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'image/png')
    assert.equal(res.headers.get('x-model'), IMAGE_MODEL)
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), PNG)
    assert.deepEqual(sent[0].body, {
      model: IMAGE_MODEL,
      prompt: 'A cover',
      aspect_ratio: '16:9',
      quality: 'medium',
      input_references: [{ type: 'image_url', image_url: { url: REF } }],
    })
    assert.equal(sent[0].headers.authorization, 'Bearer or-key')
  })

  it('spends 320 credits per image', async () => {
    await call({ prompt: 'A cover', aspect: '9:16' })
    assert.equal(CREDIT_RATES.image, 320)
    assert.equal(used[SUBJECT], 320)
    assert.equal(sent[0].body.input_references, undefined)
  })

  it('records the call with what it cost (#1355)', async () => {
    await call({ prompt: 'A cover', aspect: '16:9' })
    assert.deepEqual(recorded, [row('image', { p_usage: 1, p_cost_usd: 0.04, p_generation_id: 'gen-i1' })])
  })

  it('answers and charges all the same when the call cannot be recorded', async () => {
    recording = 'down'
    assert.equal((await call({ prompt: 'A cover', aspect: '16:9' })).status, 200)
    assert.equal(used[SUBJECT], 320)
  })

  it('refuses a free user before reaching the provider', async () => {
    subscriptions[SUBJECT] = []
    const res = await call({ prompt: 'A cover', aspect: '16:9' })

    assert.equal(res.status, 403)
    assert.equal((await res.json()).error.code, 'pro_required')
    assert.equal(sent.length, 0)
    assert.equal(recorded.length, 0)
  })

  it('stops a user whose credits are used up, and lets any credit left start one', async () => {
    used[SUBJECT] = MONTHLY_CREDITS
    const res = await call({ prompt: 'A cover', aspect: '16:9' })
    assert.equal(res.status, 429)
    assert.equal((await res.json()).error.code, 'credits_used_up')
    assert.equal(sent.length, 0)

    used[SUBJECT] = MONTHLY_CREDITS - 1
    assert.equal((await call({ prompt: 'A cover', aspect: '16:9' })).status, 200)
  })

  it('refuses what is out of bounds, naming the limit', async () => {
    const refused = async (body, words) => {
      const res = await call(body)
      assert.equal(res.status, 400)
      assert.match((await res.json()).error.message, words)
    }
    await refused({ prompt: ' ', aspect: '16:9' }, /prompt/)
    await refused({ prompt: 'x'.repeat(4001), aspect: '16:9' }, /4000/)
    await refused({ prompt: 'A cover', aspect: '4:5' }, /16:9/)
    await refused({ prompt: 'A cover', aspect: '16:9', references: [REF, REF, REF, REF] }, /at most 3/)
    await refused({ prompt: 'A cover', aspect: '16:9', references: ['https://example.com/a.png'] }, /data URL/)
    const big = `data:image/png;base64,${'A'.repeat((MAX_REFERENCE_BYTES * 4) / 3 + 100)}`
    await refused({ prompt: 'A cover', aspect: '16:9', references: [big] }, /8 MB/)
    assert.equal(sent.length, 0)
  })

  it('says so when this build carries no key', async () => {
    const res = await call({ prompt: 'A cover', aspect: '16:9' }, { ...ENV, OPENROUTER_API_KEY: undefined })

    assert.equal(res.status, 503)
    assert.equal((await res.json()).error.code, 'image_unavailable')
  })

  it('charges nothing when the provider fails or answers no image', async () => {
    provider = () => json({ error: { message: 'upstream' } }, 500)
    const failed = await call({ prompt: 'A cover', aspect: '16:9' })
    assert.equal(failed.status, 502)
    assert.equal((await failed.json()).error.code, 'image_failed')

    provider = () => json({ data: [] })
    assert.equal((await call({ prompt: 'A cover', aspect: '16:9' })).status, 502)
    assert.equal(used[SUBJECT], undefined)
    assert.deepEqual(recorded, Array(2).fill(row('image', { p_ok: false })))
  })
})

const row = (capability, over = {}) => ({
  p_user_id: SUBJECT,
  p_capability: capability,
  p_ok: true,
  p_usage: null,
  p_cost_usd: null,
  p_generation_id: null,
  ...over,
})

async function call(body, env = ENV) {
  const request = new Request('https://api.example/v1/image', {
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
