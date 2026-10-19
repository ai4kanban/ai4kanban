// Hosted music (#1822): only a Pro user reaches it, a track costs its flat credits once it is
// in hand, it ends at the length asked, and nothing it answers names the provider or model.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { jwksUrl, issuerFor, resetJwksCache } from '../src/auth.ts'
import worker from '../src/index.ts'
import { MONTHLY_CREDITS } from '../src/credits.ts'
import { endAt, MUSIC_MODEL } from '../src/music.ts'

const SUPABASE_URL = 'https://project.supabase.co'
const ENV = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role', OPENROUTER_API_KEY: 'or-key' }
const SUBJECT = '11111111-1111-4111-8111-111111111111'
const PRO = { id: 'sub_1', customer_id: 'c', period: 'yearly', status: 'active', current_period_end: null }
const RATE = 8000

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
  provider = () => stream([wav(40, 0.5).subarray(0, 1000), wav(40, 0.5).subarray(1000)], 0.08)
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
      assert.equal(body.p_use, 'music')
      used[body.p_user_id] = (used[body.p_user_id] ?? 0) + body.p_credits
      return json(used[body.p_user_id])
    }
    if (address.endsWith('/rest/v1/rpc/record_ai_call')) {
      if (recording === 'down') return json({ message: 'down' }, 500)
      recorded.push(body)
      return new Response(null, { status: 204 })
    }
    if (address === 'https://openrouter.ai/api/v1/chat/completions') {
      sent.push({ headers: init.headers, body: JSON.parse(init.body) })
      return provider()
    }
    throw new Error(`unexpected fetch of ${address}`)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('POST /v1/music', () => {
  it('answers a wav ending at the length asked, faded out, with no model named', async () => {
    const res = await call({ prompt: 'Upbeat synth pop, 120 BPM', seconds: 30 })

    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'audio/wav')
    assert.equal(res.headers.get('x-model'), null)
    const out = new Uint8Array(await res.arrayBuffer())
    const view = new DataView(out.buffer)
    assert.equal(view.getUint32(40, true), 30 * RATE * 2)
    assert.equal(out.length, 44 + 30 * RATE * 2)
    assert.equal(view.getUint32(4, true), out.length - 8)
    assert.ok(Math.abs(view.getInt16(out.length - 2, true)) < 100, 'the end was not faded out')
    assert.ok(Math.abs(view.getInt16(44 + 10 * RATE * 2, true)) > 10000, 'the middle was faded')

    assert.equal(sent[0].body.model, MUSIC_MODEL)
    assert.equal(sent[0].body.stream, true)
    assert.deepEqual(sent[0].body.modalities, ['text', 'audio'])
    assert.match(sent[0].body.messages[0].content, /^Upbeat synth pop, 120 BPM\n\nInstrumental only.*30 seconds/s)
    assert.equal(sent[0].headers.authorization, 'Bearer or-key')
  })

  it('cuts off a silent tail before the length asked', () => {
    const cut = endAt(wav(20, 0.5, 12), 20)
    assert.equal(cut.seconds, 12)
  })

  it('spends 160 credits per track and records it with what it cost', async () => {
    await call({ prompt: 'Calm piano', seconds: 30 })
    assert.equal(used[SUBJECT], 160)
    assert.deepEqual(recorded, [row('music', { p_usage: 30, p_cost_usd: 0.08, p_generation_id: 'gen-m1' })])
  })

  it('refuses a free user before reaching the provider', async () => {
    subscriptions[SUBJECT] = []
    const res = await call({ prompt: 'Calm piano', seconds: 30 })

    assert.equal(res.status, 403)
    assert.equal((await res.json()).error.code, 'pro_required')
    assert.equal(sent.length, 0)
  })

  it('stops a user whose credits are used up', async () => {
    used[SUBJECT] = MONTHLY_CREDITS
    const res = await call({ prompt: 'Calm piano', seconds: 30 })
    assert.equal(res.status, 429)
    assert.equal(sent.length, 0)
  })

  it('refuses what is out of bounds, naming the limit', async () => {
    const refused = async (body, words) => {
      const res = await call(body)
      assert.equal(res.status, 400)
      assert.match((await res.json()).error.message, words)
    }
    await refused({ prompt: ' ', seconds: 30 }, /prompt/)
    await refused({ prompt: 'x'.repeat(4001), seconds: 30 }, /4000/)
    await refused({ prompt: 'Calm piano' }, /5 to 180/)
    await refused({ prompt: 'Calm piano', seconds: 600 }, /5 to 180/)
    assert.equal(sent.length, 0)
  })

  it('charges nothing when the provider fails or answers no audio, naming neither', async () => {
    provider = () => json({ error: { message: 'upstream' } }, 500)
    const failed = await call({ prompt: 'Calm piano', seconds: 30 })
    assert.equal(failed.status, 502)
    const { error } = await failed.json()
    assert.equal(error.code, 'music_failed')
    assert.doesNotMatch(error.message, /lyria|google|openrouter/i)

    provider = () => stream([], null)
    assert.equal((await call({ prompt: 'Calm piano', seconds: 30 })).status, 502)
    assert.equal(used[SUBJECT], undefined)
    assert.deepEqual(recorded, Array(2).fill(row('music', { p_ok: false })))
  })

  it('says so when this build carries no key', async () => {
    const res = await call({ prompt: 'Calm piano', seconds: 30 }, { ...ENV, OPENROUTER_API_KEY: undefined })
    assert.equal(res.status, 503)
    const { error } = await res.json()
    assert.equal(error.code, 'music_unavailable')
    assert.doesNotMatch(error.message, /lyria|google|openrouter/i)
  })
})

/** A mono 16-bit wav of a loud square wave for `loud` seconds, then silence. */
function wav(seconds, level, loud = seconds) {
  const frames = seconds * RATE
  const out = new Uint8Array(44 + frames * 2)
  const view = new DataView(out.buffer)
  out.set(new TextEncoder().encode('RIFF'), 0)
  view.setUint32(4, out.length - 8, true)
  out.set(new TextEncoder().encode('WAVEfmt '), 8)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, RATE, true)
  view.setUint32(28, RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  out.set(new TextEncoder().encode('data'), 36)
  view.setUint32(40, frames * 2, true)
  for (let f = 0; f < loud * RATE; f++) view.setInt16(44 + f * 2, (f % 2 ? 1 : -1) * level * 32767, true)
  return out
}

function stream(parts, cost) {
  const events = parts.map((p, i) =>
    JSON.stringify({ id: 'gen-m1', choices: [{ delta: { audio: { data: Buffer.from(p).toString('base64') } } }], ...(cost !== null && i === parts.length - 1 && { usage: { cost } }) }),
  )
  const text = [...events.map((e) => `data: ${e}\n\n`), 'data: [DONE]\n\n'].join('')
  return new Response(text, { headers: { 'content-type': 'text/event-stream' } })
}

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
  const request = new Request('https://api.example/v1/music', {
    method: 'POST',
    headers: { authorization: `Bearer ${await token(SUBJECT)}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const waits = []
  const res = await worker.fetch(request, env, { waitUntil: (p) => waits.push(p) })
  await Promise.all(waits)
  return res
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
