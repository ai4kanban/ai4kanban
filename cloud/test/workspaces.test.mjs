import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import { MAX_CARDS_PER_WRITE, NODE_LEASE_SECONDS } from '../src/config.ts'
import {
  PG_NODE_REMOVED,
  PG_NOT_IN_WORKSPACE,
  PG_OPERATION_REUSED,
  PG_REVISION_CONFLICT,
  refusalFor,
} from '../src/db.ts'
import { refusalResponse } from '../src/http.ts'
import {
  confirmDelivery,
  createWorkspace,
  registerNode,
  renewNode,
  routeWorkspace,
  writeCards,
} from '../src/workspaces.ts'

// The Worker's half of the control plane (#314): the shape of what a client sends, and the
// refusal a client acts on. Whose workspace it is, what a retried attempt answers and whether
// a batch commits whole are the migration's — they have to hold against two machines calling
// at once, and test/sql/checks.sql is where that lives.

const OWNER = {
  accountId: '11111111-1111-4111-8111-111111111111',
  subject: 'x',
  handle: 'a',
  name: null,
  avatarUrl: null,
  expiresAt: 0,
}
const WORKSPACE = '22222222-2222-4222-8222-222222222222'
const NODE = '33333333-3333-4333-8333-333333333333'
const MACHINE = '44444444-4444-4444-8444-444444444444'
const DELIVERY = '55555555-5555-4555-8555-555555555555'

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }

/** Stand in for PostgREST, and hand back the arguments the function was called with. */
function fakeDatabase(answer = {}) {
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

const post = (path, body) =>
  routeWorkspace(
    ENV,
    OWNER,
    new Request(`https://api.example/v1/workspaces/${path}`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
      headers: { 'content-type': 'application/json' },
    }),
    new URL(`https://api.example/v1/workspaces/${path}`),
    path,
  )

const get = (path) =>
  routeWorkspace(
    ENV,
    OWNER,
    new Request(`https://api.example/v1/workspaces/${path}`),
    new URL(`https://api.example/v1/workspaces/${path}`),
    path,
  )

describe('what a mutation has to carry', () => {
  it('refuses one that names no attempt, without touching the database', async () => {
    const calls = fakeDatabase()

    await assert.rejects(
      writeCards(ENV, OWNER, WORKSPACE, { cards: [{ expect: '' }] }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })

  it('refuses a workspace that is not an id, without touching the database', async () => {
    const calls = fakeDatabase()

    await assert.rejects(
      writeCards(ENV, OWNER, '../../etc', { opId: 'op-1', cards: [{ expect: '' }] }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })

  it('lets a create name none: the workspace it would deduplicate does not exist yet', async () => {
    const calls = fakeDatabase({ id: WORKSPACE })

    await createWorkspace(ENV, OWNER, { name: 'A board' })

    assert.equal(calls[0].fn, 'create_workspace')
    assert.equal(calls[0].args.p_op_id, '')
    assert.equal(calls[0].args.p_name, 'A board')
  })
})

describe('writing cards', () => {
  const cards = async (list) => {
    const calls = fakeDatabase({ revision: '2', cards: [] })
    await writeCards(ENV, OWNER, WORKSPACE, { opId: 'op-1', cards: list })
    return calls[0].args.p_cards
  }

  it('carries the number, the revision read and the card whole', async () => {
    assert.deepEqual(await cards([{ id: 7, expect: '3', data: { title: 'a' } }]), [
      { id: 7, expect: '3', data: { title: 'a' } },
    ])
  })

  it('takes a card the board has not numbered yet, expecting no revision', async () => {
    assert.deepEqual(await cards([{ data: { title: 'new' } }]), [{ id: null, expect: '', data: { title: 'new' } }])
  })

  it('refuses a write that names no card', async () => {
    const calls = fakeDatabase()
    for (const list of [[], undefined, 'nonsense']) {
      await assert.rejects(
        writeCards(ENV, OWNER, WORKSPACE, { opId: 'op-1', cards: list }),
        (e) => e.code === 'bad_request',
      )
    }
    assert.equal(calls.length, 0)
  })

  it('caps the batch, so one call cannot grow a transaction without bound', async () => {
    const calls = fakeDatabase()
    const many = Array.from({ length: MAX_CARDS_PER_WRITE + 1 }, () => ({ expect: '' }))

    await assert.rejects(
      writeCards(ENV, OWNER, WORKSPACE, { opId: 'op-1', cards: many }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })

  it('refuses a card number that is not one, and a body that is not an object', async () => {
    fakeDatabase()
    for (const bad of [{ id: 0, expect: '' }, { id: -3, expect: '' }, { id: 1.5, expect: '' }, { expect: '', data: [] }]) {
      await assert.rejects(
        writeCards(ENV, OWNER, WORKSPACE, { opId: 'op-1', cards: [bad] }),
        (e) => e.code === 'bad_request',
      )
    }
  })
})

describe('a workspace’s nodes', () => {
  it('takes names and nothing else off a registration', async () => {
    const calls = fakeDatabase({ id: NODE })

    await registerNode(ENV, OWNER, WORKSPACE, {
      machineId: MACHINE,
      machineName: 'studio',
      runtimes: [{ name: 'fast', harness: 'claude-code', apiKey: 'sk-ant-secret', path: '/Users/me/board' }],
    })

    assert.equal(calls[0].fn, 'register_node')
    assert.deepEqual(calls[0].args.p_runtimes, [{ name: 'fast', harness: 'claude-code' }])
  })

  it('renews on the lease the SERVICE sets, never one the client asked for', async () => {
    const calls = fakeDatabase({ id: NODE })

    await renewNode(ENV, OWNER, WORKSPACE, NODE)

    assert.equal(calls[0].fn, 'renew_node')
    assert.equal(calls[0].args.p_lease_seconds, NODE_LEASE_SECONDS)
  })
})

describe('confirming a delivery', () => {
  it('takes the three ways one ends and refuses anything else', async () => {
    const calls = fakeDatabase({ id: DELIVERY, state: 'failed' })

    await confirmDelivery(ENV, OWNER, WORKSPACE, DELIVERY, { opId: 'op-1', nodeId: NODE, outcome: 'failed' })
    assert.equal(calls[0].args.p_outcome, 'failed')
    assert.equal(calls[0].args.p_node, NODE)

    await assert.rejects(
      confirmDelivery(ENV, OWNER, WORKSPACE, DELIVERY, { opId: 'op-2', outcome: 'open' }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 1)
  })
})

describe('the refusals a client acts on', () => {
  it('carries the revision the resource holds now, so a client re-reads that one card', async () => {
    const refusal = refusalFor({ code: PG_REVISION_CONFLICT, message: 'moved', details: '12' }, 400)
    assert.equal(refusal.code, 'revision_conflict')
    assert.equal(refusal.current, '12')

    const body = await refusalResponse(refusal).json()
    assert.equal(body.error.code, 'revision_conflict')
    assert.equal(body.error.current, '12')
  })

  it('tells a reused operation id from a removed node from a card that is not there', () => {
    assert.equal(refusalFor({ code: PG_OPERATION_REUSED }, 400).code, 'operation_reused')
    assert.equal(refusalFor({ code: PG_NODE_REMOVED }, 400).code, 'node_removed')
    assert.equal(
      refusalFor({ code: PG_NOT_IN_WORKSPACE, message: 'This workspace holds no card 7.' }, 400).message,
      'This workspace holds no card 7.',
    )
  })

  it('says nothing extra on a refusal that has no revision to carry', async () => {
    const body = await refusalResponse(refusalFor({ code: PG_OPERATION_REUSED }, 400)).json()
    assert.ok(!('current' in body.error))
  })
})

describe('the routes', () => {
  it('reads the list, and makes one', async () => {
    const calls = fakeDatabase([])

    await get('')
    await post('', { name: 'A board' })

    assert.deepEqual(calls.map((c) => c.fn), ['list_workspaces', 'create_workspace'])
  })

  it('sends each move to its own function', async () => {
    const calls = fakeDatabase({})

    await get(WORKSPACE)
    await get(`${WORKSPACE}/cards`)
    await get(`${WORKSPACE}/audit`)
    await get(`${WORKSPACE}/nodes`)
    await post(`${WORKSPACE}/rename`, { opId: 'o', expect: '1', name: 'n' })
    await post(`${WORKSPACE}/delete`)
    await post(`${WORKSPACE}/nodes`, { machineId: MACHINE, machineName: 'm' })
    await post(`${WORKSPACE}/nodes/${NODE}/rename`, { opId: 'o', name: 'n' })
    await post(`${WORKSPACE}/nodes/${NODE}/remove`, { opId: 'o' })
    await post(`${WORKSPACE}/nodes/${NODE}/renew`)
    await post(`${WORKSPACE}/deliveries`, { opId: 'o', cardId: 3 })
    await post(`${WORKSPACE}/deliveries/${DELIVERY}/confirm`, { opId: 'o', outcome: 'completed' })

    assert.deepEqual(calls.map((c) => c.fn), [
      'read_workspace', 'read_cards', 'read_audit', 'list_nodes',
      'rename_workspace', 'delete_workspace', 'register_node',
      'rename_node', 'remove_node', 'renew_node', 'open_delivery', 'confirm_delivery',
    ])
  })

  it('refuses the wrong method rather than doing the move', async () => {
    const calls = fakeDatabase({})
    await assert.rejects(get(`${WORKSPACE}/delete`), (e) => e.code === 'method_not_allowed')
    assert.equal(calls.length, 0)
  })

  it('answers a path it does not have with no such endpoint, whatever the method', async () => {
    const calls = fakeDatabase({})
    const paths = [
      `${WORKSPACE}/nonsense`,
      `${WORKSPACE}/nodes/${NODE}/nonsense`,
      `${WORKSPACE}/cards/1`,
      // A move is the last thing a path says. Anything after one is a path this service does
      // not have, and answering it would let `…/delete/typo` remove a workspace for good.
      `${WORKSPACE}/delete/typo`,
      `${WORKSPACE}/rename/typo`,
      `${WORKSPACE}/nodes/${NODE}/remove/typo`,
      `${WORKSPACE}/deliveries/${DELIVERY}/confirm/typo`,
    ]
    for (const path of paths) {
      await assert.rejects(post(path, {}), (e) => e.code === 'not_found')
      await assert.rejects(get(path), (e) => e.code === 'not_found')
    }
    assert.equal(calls.length, 0)
  })

  it('takes the run of the trail off the query, bounded by the database', async () => {
    const calls = fakeDatabase([])
    await routeWorkspace(
      ENV,
      OWNER,
      new Request(`https://api.example/v1/workspaces/${WORKSPACE}/audit?limit=5`),
      new URL(`https://api.example/v1/workspaces/${WORKSPACE}/audit?limit=5`),
      `${WORKSPACE}/audit`,
    )
    assert.equal(calls[0].args.p_limit, 5)
  })
})
