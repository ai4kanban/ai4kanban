import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { PG_SERVER_ELSEWHERE, refusalFor } from '../src/db.ts'
import { attachServer, claimRequest, listRequests, renewClaim } from '../src/servers.ts'

// The Worker's half of a board's server (#318): the shape of the request, and the refusal a
// client acts on. Whose claim a request is, and what an expired lease means, are the
// migration's — they have to hold against two machines calling at once, and 0005 is where
// that lives.

const OWNER = {
  accountId: '11111111-1111-4111-8111-111111111111',
  subject: 'x',
  handle: 'a',
  name: null,
  avatarUrl: null,
  expiresAt: 0,
}
const BOARD = '22222222-2222-4222-8222-222222222222'
const MACHINE = '44444444-4444-4444-8444-444444444444'
const SERVER = '55555555-5555-4555-8555-555555555555'
const REQUEST = '66666666-6666-4666-8666-666666666666'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }

/** Stand in for PostgREST, and hand back the arguments the function was called with. */
function fakeDatabase(answer) {
  const calls = []
  mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ fn: String(url).split('/rpc/')[1], args: JSON.parse(init.body) })
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  return calls
}

const aServer = (over = {}) => ({
  id: SERVER,
  boardId: BOARD,
  machineId: MACHINE,
  machineName: 'studio',
  enabled: true,
  runtimes: [],
  ...over,
})

describe('attachServer', () => {
  it('registers this machine, and takes the board over only when asked', async () => {
    const calls = fakeDatabase(aServer())

    await attachServer(ENV, OWNER, BOARD, { machineId: MACHINE, machineName: 'studio' })
    await attachServer(ENV, OWNER, BOARD, { machineId: MACHINE, machineName: 'studio', takeOver: true })

    assert.equal(calls[0].fn, 'attach_server')
    assert.equal(calls[0].args.p_machine, MACHINE)
    assert.equal(calls[0].args.p_machine_name, 'studio')
    assert.equal(calls[0].args.p_take_over, false)
    assert.equal(calls[1].args.p_take_over, true)
  })

  it('refuses a machine that is not an id, without touching the database', async () => {
    const calls = fakeDatabase(aServer())

    await assert.rejects(
      attachServer(ENV, OWNER, BOARD, { machineId: '../../etc' }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })
})

// What this machine runs the board's runtimes as (#345). The Worker's job is the shape:
// names only, bounded, and an entry it cannot read dropped rather than refused — a report is
// best-effort, and one bad line must never stop a machine registering.
describe('the runtimes a registration carries', () => {
  const attach = async (runtimes) => {
    const calls = fakeDatabase(aServer())
    await attachServer(ENV, OWNER, BOARD, { machineId: MACHINE, machineName: 'studio', runtimes })
    return calls[0].args.p_runtimes
  }

  it('carries the name, the harness, the model and the fallback mark', async () => {
    assert.deepEqual(
      await attach([
        { name: 'fast', harness: 'claude-code', model: 'claude-opus-5' },
        { name: 'docs', harness: 'codex', fallback: true },
      ]),
      [
        { name: 'fast', harness: 'claude-code', model: 'claude-opus-5' },
        { name: 'docs', harness: 'codex', fallback: true },
      ],
    )
  })

  it('takes names and nothing else', async () => {
    assert.deepEqual(
      await attach([
        { name: 'fast', harness: 'claude-code', apiKey: 'sk-ant-secret', command: '/usr/bin/claude --model x', path: '/Users/me/board' },
      ]),
      [{ name: 'fast', harness: 'claude-code' }],
    )
  })

  it('caps the count and each name, and drops an entry it cannot read', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ name: `r${i}`, harness: 'codex' }))
    assert.equal((await attach(many)).length, 32)

    assert.deepEqual(await attach([{ name: 'fast', harness: 'x'.repeat(500) }]), [
      { name: 'fast', harness: 'x'.repeat(200) },
    ])
    assert.deepEqual(await attach([{ harness: 'codex' }, { name: 'fast' }, null, 'nonsense']), [])
  })

  it('reports none when the board names none, and when nothing was sent at all', async () => {
    assert.deepEqual(await attach([]), [])
    assert.deepEqual(await attach(undefined), [])
  })
})

describe('claiming', () => {
  it('sends the lease the SERVICE sets, never one the client asked for', async () => {
    const calls = fakeDatabase({ claimed: true, request: {} })

    await claimRequest(ENV, OWNER, REQUEST, { serverId: SERVER, leaseSeconds: 99_999 })

    assert.equal(calls[0].fn, 'claim_request')
    assert.ok(calls[0].args.p_lease_seconds >= 60, 'the lease is the service’s own')
    assert.ok(!('leaseSeconds' in calls[0].args))
  })

  it('carries a refusal through as an answer rather than an error', async () => {
    fakeDatabase({ claimed: false, reason: 'That request is held by another machine.' })

    const answer = await claimRequest(ENV, OWNER, REQUEST, { serverId: SERVER })

    assert.equal(answer.claimed, false)
    assert.equal(answer.reason, 'That request is held by another machine.')
  })

  it('renews under the server that holds it', async () => {
    const calls = fakeDatabase({ renewed: true })

    await renewClaim(ENV, OWNER, REQUEST, { serverId: SERVER })

    assert.equal(calls[0].fn, 'renew_claim')
    assert.equal(calls[0].args.p_server, SERVER)
    assert.equal(calls[0].args.p_request, REQUEST)
  })
})

describe('listRequests', () => {
  it('answers an empty list rather than null', async () => {
    fakeDatabase(null)
    assert.deepEqual(await listRequests(ENV, OWNER, SERVER), { requests: [] })
  })
})

describe('a board that already has a server', () => {
  it('is its own refusal, and carries the database’s sentence naming the machine', () => {
    const refusal = refusalFor(
      { code: PG_SERVER_ELSEWHERE, message: 'This board already runs its work on studio.' },
      400,
    )
    assert.equal(refusal.code, 'server_elsewhere')
    assert.match(refusal.message, /studio/)
  })
})
