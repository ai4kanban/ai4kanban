// Hosted narration (#1054): only an admitted account reaches it, the key never leaves the
// Worker, and a provider failure is a refusal rather than silence.

import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { jwksUrl, issuerFor, resetJwksCache } from '../src/auth.ts'
import worker from '../src/index.ts'
import { SPEECH_MODEL } from '../src/speech.ts'

const SUPABASE_URL = 'https://project.supabase.co'
const ENV = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role', OPENROUTER_API_KEY: 'or-key' }
const SUBJECT = '11111111-1111-4111-8111-111111111111'
const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x00])

const realFetch = globalThis.fetch
let keyPair
let admitted
let provider
let sent

beforeEach(async () => {
  resetJwksCache()
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  admitted = true
  provider = () => new Response(MP3, { headers: { 'content-type': 'audio/mpeg' } })
  sent = []
  globalThis.fetch = async (url, init) => {
    const address = String(url)
    if (address === jwksUrl(SUPABASE_URL)) return json({ keys: [{ ...jwk, kid: 'k', alg: 'ES256' }] })
    if (address.endsWith('/rest/v1/rpc/account_for_session')) {
      return json({ admitted, handle: 'lin', name: null, avatar_url: null, account_id: admitted ? SUBJECT : null })
    }
    if (address === 'https://openrouter.ai/api/v1/audio/speech') {
      sent.push({ headers: init.headers, body: JSON.parse(init.body) })
      return provider()
    }
    throw new Error(`unexpected fetch of ${address}`)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('POST /v1/speech', () => {
  it('answers mp3 in the named voice, with the key held by the Worker', async () => {
    const res = await call({ voice: 'kore', text: '안녕하세요' })

    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'audio/mpeg')
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), MP3)
    assert.deepEqual(sent[0].body, { model: SPEECH_MODEL, input: '안녕하세요', voice: 'Kore', response_format: 'mp3' })
    assert.equal(sent[0].headers.authorization, 'Bearer or-key')
  })

  it('refuses an account not admitted, before reaching the provider', async () => {
    admitted = false
    const res = await call({ voice: 'Kore', text: 'Hi' })

    assert.equal(res.status, 403)
    assert.equal((await res.json()).error.code, 'not_admitted')
    assert.equal(sent.length, 0)
  })

  it('refuses an unknown voice and an empty line', async () => {
    assert.equal((await call({ voice: 'alloy', text: 'Hi' })).status, 400)
    assert.equal((await call({ voice: 'Kore', text: ' ' })).status, 400)
    assert.equal(sent.length, 0)
  })

  it('says so when this build carries no key', async () => {
    const res = await call({ voice: 'Kore', text: 'Hi' }, { ...ENV, OPENROUTER_API_KEY: undefined })

    assert.equal(res.status, 503)
    assert.equal((await res.json()).error.code, 'speech_unavailable')
  })

  it('turns a provider failure into a refusal of its own', async () => {
    provider = () => json({ error: { message: 'upstream' } }, 500)
    const res = await call({ voice: 'Kore', text: 'Hi' })

    assert.equal(res.status, 502)
    assert.equal((await res.json()).error.code, 'speech_failed')
  })
})

async function call(body, env = ENV) {
  const request = new Request('https://api.example/v1/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return worker.fetch(request, env, { waitUntil() {} })
}

async function token() {
  const now = Math.floor(Date.now() / 1000)
  const claims = { sub: SUBJECT, iss: issuerFor(SUPABASE_URL), aud: 'authenticated', exp: now + 3600 }
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
