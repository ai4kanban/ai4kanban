import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { issuerFor, jwksUrl, resetJwksCache, verifyAccessToken } from '../src/auth.ts'

const SUPABASE_URL = 'https://project.supabase.co'
const NOW = 1_800_000_000_000

const realFetch = globalThis.fetch
let keyPair
let jwks
let fetches

beforeEach(async () => {
  resetJwksCache()
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  jwks = { keys: [{ ...jwk, kid: 'signing-key', alg: 'ES256' }] }
  fetches = []
  globalThis.fetch = async (url) => {
    fetches.push(String(url))
    return new Response(JSON.stringify(jwks), {
      headers: { 'content-type': 'application/json' },
    })
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('verifyAccessToken', () => {
  it('accepts a token signed by a key the project publishes', async () => {
    const identity = await verifyAccessToken(await signIn(), SUPABASE_URL, NOW)

    assert.equal(identity.subject, 'user-1')
    assert.equal(identity.email, 'someone@example.com')
    assert.equal(identity.provider, 'github')
    assert.deepEqual(fetches, [jwksUrl(SUPABASE_URL)])
  })

  it('reuses the fetched keys across calls', async () => {
    await verifyAccessToken(await signIn(), SUPABASE_URL, NOW)
    await verifyAccessToken(await signIn(), SUPABASE_URL, NOW + 1000)

    assert.equal(fetches.length, 1)
  })

  it('refuses a token issued somewhere else', async () => {
    const token = await signIn({ iss: 'https://elsewhere.supabase.co/auth/v1' })

    await assert.rejects(verifyAccessToken(token, SUPABASE_URL, NOW), {
      code: 'unauthenticated',
    })
  })

  it('refuses a token that is not a signed-in session', async () => {
    const token = await signIn({ aud: 'anon' })

    await assert.rejects(verifyAccessToken(token, SUPABASE_URL, NOW), {
      code: 'unauthenticated',
    })
  })

  it('refuses an expired token', async () => {
    const token = await signIn({ exp: Math.floor(NOW / 1000) - 3600 })

    await assert.rejects(verifyAccessToken(token, SUPABASE_URL, NOW), {
      message: /expired/,
    })
  })

  it('refuses a token whose payload was changed after signing', async () => {
    const [header, , signature] = (await signIn()).split('.')
    const forged = b64u(JSON.stringify({ ...claims(), sub: 'user-2' }))

    await assert.rejects(verifyAccessToken(`${header}.${forged}.${signature}`, SUPABASE_URL, NOW), {
      message: /did not verify/,
    })
  })

  it('refuses a token signed by a key the project does not publish', async () => {
    const other = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])
    const token = await signIn({}, other.privateKey)
    jwks = { keys: [] }

    await assert.rejects(verifyAccessToken(token, SUPABASE_URL, NOW), {
      code: 'unauthenticated',
    })
  })

  it('refuses an unreadable signature rather than reporting a service failure', async () => {
    const [header, payload] = (await signIn()).split('.')

    await assert.rejects(verifyAccessToken(`${header}.${payload}.!!!!`, SUPABASE_URL, NOW), {
      code: 'unauthenticated',
    })
  })

  it('refuses a token that asks not to be verified', async () => {
    const token = await signIn({}, undefined, { alg: 'none', kid: 'signing-key' })

    await assert.rejects(verifyAccessToken(token, SUPABASE_URL, NOW), {
      message: /signed the wrong way/,
    })
  })
})

const claims = () => ({
  sub: 'user-1',
  iss: issuerFor(SUPABASE_URL),
  aud: 'authenticated',
  exp: Math.floor(NOW / 1000) + 3600,
  email: 'someone@example.com',
  app_metadata: { provider: 'github' },
})

async function signIn(overrides = {}, key, header = { alg: 'ES256', kid: 'signing-key' }) {
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify({ ...claims(), ...overrides }))}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key ?? keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${b64uBytes(new Uint8Array(signature))}`
}

const b64u = (text) => b64uBytes(new TextEncoder().encode(text))

const b64uBytes = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
