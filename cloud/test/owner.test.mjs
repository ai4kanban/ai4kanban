import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { issuerFor, jwksUrl, resetJwksCache } from '../src/auth.ts'
import { readSession, requireOwned, requireOwner } from '../src/owner.ts'

const SUPABASE_URL = 'https://project.supabase.co'
const ENV = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role' }
const SUBJECT = '11111111-1111-4111-8111-111111111111'

const ADMITTED = {
  admitted: true,
  handle: 'neverchanje',
  name: 'Tao Wu',
  avatar_url: 'https://avatars.example/1',
  account_id: SUBJECT,
  invite_requested_at: null,
}
const REFUSED = {
  admitted: false,
  handle: 'someone-else',
  name: 'Someone Else',
  avatar_url: null,
  account_id: null,
  invite_requested_at: null,
}

const realFetch = globalThis.fetch
let keyPair
let jwks
let row
let rpcCalls

beforeEach(async () => {
  resetJwksCache()
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  jwks = { keys: [{ ...jwk, kid: 'signing-key', alg: 'ES256' }] }
  row = ADMITTED
  rpcCalls = []
  globalThis.fetch = async (url, init) => {
    if (String(url) === jwksUrl(SUPABASE_URL)) return json(jwks)
    if (String(url).endsWith('/rest/v1/rpc/account_for_session')) {
      rpcCalls.push(JSON.parse(init.body))
      return json(row)
    }
    throw new Error(`unexpected fetch of ${url}`)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('readSession', () => {
  it('reports an admitted account and the handle the provider attests', async () => {
    const session = await readSession(await signedIn(), ENV)

    assert.equal(session.admitted, true)
    assert.equal(session.accountId, SUBJECT)
    assert.equal(session.handle, 'neverchanje')
    assert.equal(session.name, 'Tao Wu')
    assert.deepEqual(rpcCalls[0].p_subject, SUBJECT)
  })

  it('names the account it will refuse, rather than refusing the report', async () => {
    row = REFUSED

    const session = await readSession(await signedIn(), ENV)

    assert.equal(session.admitted, false)
    assert.equal(session.handle, 'someone-else')
    assert.equal(session.accountId, null)
  })

  it('carries the open invite request, so the pane shows it in place of the button', async () => {
    row = { ...REFUSED, invite_requested_at: '2026-08-24T09:00:00Z' }

    const session = await readSession(await signedIn(), ENV)

    assert.equal(session.inviteRequestedAt, '2026-08-24T09:00:00Z')
  })

  it('refuses a request carrying no sign-in at all', async () => {
    await assert.rejects(readSession(new Request('https://api.example/v1/session'), ENV), {
      code: 'unauthenticated',
    })
  })

  it('refuses an expired sign-in', async () => {
    const request = await signedIn({ exp: Math.floor(Date.now() / 1000) - 3600 })

    await assert.rejects(readSession(request, ENV), { code: 'unauthenticated' })
  })

  it('refuses a malformed sign-in', async () => {
    const request = new Request('https://api.example/v1/session', {
      headers: { authorization: 'Bearer not-a-token' },
    })

    await assert.rejects(readSession(request, ENV), { code: 'unauthenticated' })
  })
})

describe('requireOwner', () => {
  it('hands a route the account every row hangs off', async () => {
    const owner = await requireOwner(await signedIn(), ENV)

    assert.equal(owner.accountId, SUBJECT)
    assert.equal(owner.handle, 'neverchanje')
  })

  it('refuses an account that is not in the preview, with a code of its own', async () => {
    row = REFUSED

    await assert.rejects(requireOwner(await signedIn(), ENV), (error) => {
      assert.equal(error.code, 'not_admitted')
      assert.equal(error.status, 403)
      assert.match(error.message, /invite-only preview/)
      // It names the two doors the pane offers (#327), not the mailbox #326 pointed at.
      assert.match(error.message, /invitation code/)
      return true
    })
  })
})

describe('requireOwned', () => {
  const owner = { accountId: SUBJECT, subject: SUBJECT, handle: 'neverchanje', name: null, avatarUrl: null, expiresAt: 0 }

  it('lets an account reach its own row', () => {
    assert.doesNotThrow(() => requireOwned(owner, SUBJECT))
  })

  it('refuses a row belonging to another account', () => {
    assert.throws(() => requireOwned(owner, '22222222-2222-4222-8222-222222222222'), {
      code: 'not_yours',
      status: 403,
    })
  })

  it('refuses a row that names no owner', () => {
    assert.throws(() => requireOwned(owner, null), { code: 'not_yours' })
  })
})

const json = (body) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

// Against the real clock: readSession verifies with the clock the Worker runs on, so a fixed
// date here would be a test that quietly expires.
const claims = () => ({
  sub: SUBJECT,
  iss: issuerFor(SUPABASE_URL),
  aud: 'authenticated',
  exp: Math.floor(Date.now() / 1000) + 3600,
  email: 'someone@example.com',
  app_metadata: { provider: 'github' },
})

async function signedIn(overrides = {}) {
  const header = { alg: 'ES256', kid: 'signing-key' }
  const signingInput = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify({ ...claims(), ...overrides }))}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  )
  const token = `${signingInput}.${b64uBytes(new Uint8Array(signature))}`
  return new Request('https://api.example/v1/session', {
    headers: { authorization: `Bearer ${token}` },
  })
}

const b64u = (text) => b64uBytes(new TextEncoder().encode(text))

const b64uBytes = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
