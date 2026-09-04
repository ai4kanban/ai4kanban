import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'

import {
  CARD_LOCK_SECONDS,
  MAX_CARDS_PER_WRITE,
  MAX_DOCUMENTS_PER_WRITE,
  MAX_EVENTS_PER_IMPORT,
  NODE_LEASE_SECONDS,
} from '../src/config.ts'
import {
  PG_BOARD_NOT_EMPTY,
  PG_CARD_LOCKED,
  PG_HANDLE_NOT_ADMITTED,
  PG_LAST_OWNER,
  PG_NODE_REMOVED,
  PG_NOT_A_MEMBER,
  PG_NOT_IN_WORKSPACE,
  PG_OPERATION_REUSED,
  PG_OWNER_ONLY,
  PG_REVISION_CONFLICT,
  refusalFor,
} from '../src/db.ts'
import { refusalResponse } from '../src/http.ts'
import {
  addMember,
  beginImport,
  confirmDelivery,
  importDeliveries,
  createWorkspace,
  importEvents,
  recordDelivery,
  registerNode,
  releaseLock,
  removeMember,
  renewNode,
  routeWorkspace,
  setMemberRole,
  takeLock,
  writeCards,
  writeDocuments,
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
const LEASE = '66666666-6666-4666-8666-666666666666'
const ACCOUNT = '77777777-7777-4777-8777-777777777777'

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

describe('writing the board’s documents', () => {
  const docs = async (list) => {
    const calls = fakeDatabase({ revision: '2', documents: [] })
    await writeDocuments(ENV, OWNER, WORKSPACE, { opId: 'op-1', documents: list })
    return calls[0].args.p_documents
  }

  it('carries the path, the kind, the revision read and the body', async () => {
    assert.deepEqual(await docs([{ path: 'memory/cloud/readme.md', kind: 'memory', expect: '3', body: '# x' }]), [
      { path: 'memory/cloud/readme.md', kind: 'memory', expect: '3', body: '# x' },
    ])
  })

  it('sends an empty body through, which is how a rule is deleted', async () => {
    assert.deepEqual(await docs([{ path: 'rules/revise.md', kind: 'rule', expect: '4' }]), [
      { path: 'rules/revise.md', kind: 'rule', expect: '4', body: '' },
    ])
  })

  it('refuses a path that would write outside the board when it is exported', async () => {
    const calls = fakeDatabase()
    const escapes = [
      '../secrets.md',
      'memory/../../etc/passwd',
      '/etc/passwd',
      'C:/Windows/system.ini',
      'memory\\cloud\\readme.md',
      './readme.md',
      '',
    ]
    for (const path of escapes) {
      await assert.rejects(
        writeDocuments(ENV, OWNER, WORKSPACE, { opId: 'op-1', documents: [{ path, kind: 'memory', body: 'x' }] }),
        (e) => e.code === 'bad_request',
        `“${path}” was not refused`,
      )
    }
    assert.equal(calls.length, 0)
  })

  it('refuses a kind the board does not have, and a write that names no document', async () => {
    const calls = fakeDatabase()
    await assert.rejects(
      writeDocuments(ENV, OWNER, WORKSPACE, { opId: 'op-1', documents: [{ path: 'a.md', kind: 'secrets', body: 'x' }] }),
      (e) => e.code === 'bad_request',
    )
    for (const list of [[], undefined, 'nonsense']) {
      await assert.rejects(
        writeDocuments(ENV, OWNER, WORKSPACE, { opId: 'op-1', documents: list }),
        (e) => e.code === 'bad_request',
      )
    }
    assert.equal(calls.length, 0)
  })

  it('caps the batch, so one call cannot grow a transaction without bound', async () => {
    const calls = fakeDatabase()
    const many = Array.from({ length: MAX_DOCUMENTS_PER_WRITE + 1 }, (_, i) => ({
      path: `memory/${i}.md`,
      kind: 'memory',
      body: 'x',
    }))
    await assert.rejects(
      writeDocuments(ENV, OWNER, WORKSPACE, { opId: 'op-1', documents: many }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })
})

describe('the writer lock', () => {
  it('takes one over a card, on the lease the SERVICE sets', async () => {
    const calls = fakeDatabase({ leaseId: LEASE })

    await takeLock(ENV, OWNER, WORKSPACE, { cardId: 12, nodeId: NODE, leaseSeconds: 99999 })

    assert.equal(calls[0].fn, 'take_lock')
    assert.equal(calls[0].args.p_card, 12)
    assert.equal(calls[0].args.p_lease, null)
    assert.equal(calls[0].args.p_lease_seconds, CARD_LOCK_SECONDS)
  })

  it('takes one over the BOARD when no card is named — card 0, which no card can be', async () => {
    const calls = fakeDatabase({ leaseId: LEASE })

    await takeLock(ENV, OWNER, WORKSPACE, {})

    assert.equal(calls[0].args.p_card, 0)
  })

  it('presents the lease it already holds, so taking it again moves the expiry', async () => {
    const calls = fakeDatabase({ leaseId: LEASE })

    await takeLock(ENV, OWNER, WORKSPACE, { cardId: 12, lease: LEASE })

    assert.equal(calls[0].args.p_lease, LEASE)
  })

  it('releases only against the lease it was granted under', async () => {
    const calls = fakeDatabase({ released: true })

    await releaseLock(ENV, OWNER, WORKSPACE, { cardId: 12, lease: LEASE })
    assert.equal(calls[0].fn, 'release_lock')
    assert.equal(calls[0].args.p_lease, LEASE)

    await assert.rejects(
      releaseLock(ENV, OWNER, WORKSPACE, { cardId: 12 }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 1)
  })

  it('carries the lease a card write is made under', async () => {
    const calls = fakeDatabase({ revision: '2', cards: [] })

    await writeCards(ENV, OWNER, WORKSPACE, {
      opId: 'op-1',
      cards: [{ id: 12, expect: '3', lease: LEASE, data: {} }],
    })

    assert.equal(calls[0].args.p_cards[0].lease, LEASE)
  })
})

describe('archiving a card', () => {
  const cards = async (list) => {
    const calls = fakeDatabase({ revision: '2', cards: [] })
    await writeCards(ENV, OWNER, WORKSPACE, { opId: 'op-1', cards: list })
    return calls[0].args.p_cards
  }

  it('says so only when the caller means it — an ordinary save leaves the card where it is', async () => {
    const [ordinary] = await cards([{ id: 7, expect: '3', data: {} }])
    assert.ok(!('archived' in ordinary))

    const [archived] = await cards([{ id: 7, expect: '3', data: {}, archived: true }])
    assert.equal(archived.archived, true)

    const [back] = await cards([{ id: 7, expect: '3', data: {}, archived: false }])
    assert.equal(back.archived, false)
  })
})

describe('what a delivery leaves in the workspace', () => {
  it('sends the record, the approved body and the final body', async () => {
    const calls = fakeDatabase({ id: DELIVERY })

    await recordDelivery(ENV, OWNER, WORKSPACE, DELIVERY, {
      opId: 'op-1',
      nodeId: NODE,
      record: { deliveryId: 'd', cardId: 3 },
      approved: '# the card as approved',
      finalBody: '# the card as it ended',
    })

    assert.equal(calls[0].fn, 'record_delivery')
    assert.deepEqual(calls[0].args.p_record, { deliveryId: 'd', cardId: 3 })
    assert.equal(calls[0].args.p_approved, '# the card as approved')
    assert.equal(calls[0].args.p_final, '# the card as it ended')
  })

  it('refuses a record that is not an object, rather than storing a shape nothing reads back', async () => {
    const calls = fakeDatabase()
    await assert.rejects(
      recordDelivery(ENV, OWNER, WORKSPACE, DELIVERY, { opId: 'op-1', record: ['a'] }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })
})

describe('moving a board in', () => {
  it('names the source board, so a retry finds its own work', async () => {
    const calls = fakeDatabase({ resuming: false })

    await beginImport(ENV, OWNER, WORKSPACE, { opId: 'op-1', fingerprint: 'board-abc' })
    assert.equal(calls[0].args.p_fingerprint, 'board-abc')

    await assert.rejects(
      beginImport(ENV, OWNER, WORKSPACE, { opId: 'op-2', fingerprint: '  ' }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 1)
  })

  it('carries each history row’s own key and date, and attributes it to nobody', async () => {
    const calls = fakeDatabase({ added: 2 })

    await importEvents(ENV, OWNER, WORKSPACE, {
      opId: 'op-1',
      events: [
        { key: '1', at: '2026-04-02', action: 'card-created', cardId: 3, detail: { origin: 'asked' } },
        { key: '2', at: '2026-04-03', action: 'card-archived', cardId: 3 },
      ],
    })

    assert.deepEqual(calls[0].args.p_events, [
      { key: '1', at: '2026-04-02', action: 'card-created', cardId: 3, detail: { origin: 'asked' } },
      { key: '2', at: '2026-04-03', action: 'card-archived', cardId: 3, detail: {} },
    ])
  })

  it('refuses a history row with no key: a retry could not tell it from a second one', async () => {
    const calls = fakeDatabase()
    await assert.rejects(
      importEvents(ENV, OWNER, WORKSPACE, { opId: 'op-1', events: [{ at: '2026-04-02', action: 'x' }] }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
  })

  it('carries a finished delivery whole, under the id the source board gave it', async () => {
    const calls = fakeDatabase({ added: 1 })

    await importDeliveries(ENV, OWNER, WORKSPACE, {
      opId: 'op-1',
      deliveries: [{ sourceId: '2yfmw37a', cardId: 42, state: 'completed', record: { cardId: 42 }, approved: '# a' }],
    })

    assert.deepEqual(calls[0].args.p_deliveries, [
      { sourceId: '2yfmw37a', cardId: 42, state: 'completed', record: { cardId: 42 }, approved: '# a', finalBody: '' },
    ])
  })

  it('refuses a delivery with no id of its own, and settles a state that is not one', async () => {
    const calls = fakeDatabase({ added: 0 })
    await assert.rejects(
      importDeliveries(ENV, OWNER, WORKSPACE, { opId: 'op-1', deliveries: [{ cardId: 1 }] }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)

    await importDeliveries(ENV, OWNER, WORKSPACE, {
      opId: 'op-2',
      deliveries: [{ sourceId: 'd', cardId: 1, state: 'open' }],
    })
    assert.equal(calls[0].args.p_deliveries[0].state, 'completed')
  })

  it('caps one pass of history', async () => {
    const calls = fakeDatabase()
    const many = Array.from({ length: MAX_EVENTS_PER_IMPORT + 1 }, (_, i) => ({ key: String(i) }))
    await assert.rejects(
      importEvents(ENV, OWNER, WORKSPACE, { opId: 'op-1', events: many }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
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

describe('the accounts inside a workspace', () => {
  it('carries the handle and the role an owner named', async () => {
    const calls = fakeDatabase({ accountId: ACCOUNT, role: 'member' })

    await addMember(ENV, OWNER, WORKSPACE, { opId: 'op-1', handle: '  Teammate  ', role: 'member' })

    assert.equal(calls[0].fn, 'add_member')
    assert.equal(calls[0].args.p_handle, 'Teammate')
    assert.equal(calls[0].args.p_role, 'member')
  })

  it('refuses a role that is neither, so a typo is never a quiet demotion', async () => {
    const calls = fakeDatabase({})
    for (const role of ['Owner', 'admin', '', undefined]) {
      await assert.rejects(
        addMember(ENV, OWNER, WORKSPACE, { opId: 'op-1', handle: 'teammate', role }),
        (e) => e.code === 'bad_request',
      )
      await assert.rejects(
        setMemberRole(ENV, OWNER, WORKSPACE, ACCOUNT, { opId: 'op-1', role }),
        (e) => e.code === 'bad_request',
      )
    }
    assert.equal(calls.length, 0)
  })

  it('refuses a handle that is nothing, and an account that is not an id', async () => {
    const calls = fakeDatabase({})
    await assert.rejects(
      addMember(ENV, OWNER, WORKSPACE, { opId: 'op-1', handle: '   ', role: 'member' }),
      (e) => e.code === 'bad_request',
    )
    await assert.rejects(
      removeMember(ENV, OWNER, WORKSPACE, '../../etc', { opId: 'op-1' }),
      (e) => e.code === 'bad_request',
    )
    assert.equal(calls.length, 0)
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

  it('tells the four the workspace raises apart, and carries the database’s sentence', () => {
    // A signed-in stranger and a deleted workspace answer with this one, so nothing says
    // whether a workspace exists. Its own code, never a rewording of `not_yours`.
    assert.equal(refusalFor({ code: PG_NOT_A_MEMBER, message: 'Ask an owner.' }, 400).code, 'not_a_member')
    assert.equal(refusalFor({ code: PG_NOT_A_MEMBER, message: 'Ask an owner.' }, 400).message, 'Ask an owner.')
    // In the workspace, without the role — so the checkout is never told to ask to be added
    // to a board it can still read.
    assert.equal(refusalFor({ code: PG_OWNER_ONLY }, 400).code, 'owner_only')
    assert.equal(refusalFor({ code: PG_HANDLE_NOT_ADMITTED }, 400).code, 'handle_not_admitted')
    assert.equal(refusalFor({ code: PG_LAST_OWNER }, 400).code, 'last_owner')
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

  it('tells a held card from a workspace that already holds a board', async () => {
    const locked = refusalFor(
      { code: PG_CARD_LOCKED, message: 'Another writer is holding card 12.', details: '2026-09-02T10:00:00Z' },
      400,
    )
    assert.equal(locked.code, 'card_locked')
    const lockedBody = await refusalResponse(locked).json()
    assert.equal(lockedBody.error.message, 'Another writer is holding card 12.')
    assert.equal(lockedBody.error.until, '2026-09-02T10:00:00Z')
    // Not a conflict: nothing moved under the caller, so there is no revision to re-read.
    assert.ok(!('current' in lockedBody.error))

    const taken = refusalFor({ code: PG_BOARD_NOT_EMPTY, message: 'This workspace already holds a board.' }, 400)
    assert.equal(taken.code, 'board_not_empty')
    assert.equal(taken.message, 'This workspace already holds a board.')
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
    await get(`${WORKSPACE}/members`)
    await post(`${WORKSPACE}/members`, { opId: 'o', handle: 'teammate', role: 'member' })
    await post(`${WORKSPACE}/members/${ACCOUNT}/role`, { opId: 'o', role: 'owner' })
    await post(`${WORKSPACE}/members/${ACCOUNT}/remove`, { opId: 'o' })
    await post(`${WORKSPACE}/deliveries`, { opId: 'o', cardId: 3 })
    await post(`${WORKSPACE}/deliveries/${DELIVERY}/confirm`, { opId: 'o', outcome: 'completed' })

    assert.deepEqual(calls.map((c) => c.fn), [
      'read_workspace', 'read_cards', 'read_audit', 'list_nodes',
      'rename_workspace', 'delete_workspace', 'register_node',
      'rename_node', 'remove_node', 'renew_node',
      'list_members', 'add_member', 'set_member_role', 'remove_member',
      'open_delivery', 'confirm_delivery',
    ])
  })

  it('sends the board’s own content to its own function too', async () => {
    const calls = fakeDatabase({})

    await get(`${WORKSPACE}/snapshot`)
    await get(`${WORKSPACE}/cards/7`)
    await get(`${WORKSPACE}/archive`)
    await get(`${WORKSPACE}/documents`)
    await post(`${WORKSPACE}/documents`, { opId: 'o', documents: [{ path: 'config.md', kind: 'config', body: 'x' }] })
    await get(`${WORKSPACE}/locks`)
    await post(`${WORKSPACE}/locks`, { cardId: 3 })
    await post(`${WORKSPACE}/locks/release`, { cardId: 3, lease: LEASE })
    await get(`${WORKSPACE}/deliveries`)
    await post(`${WORKSPACE}/deliveries/${DELIVERY}/record`, { opId: 'o', record: {} })
    await post(`${WORKSPACE}/import/begin`, { opId: 'o', fingerprint: 'f' })
    await post(`${WORKSPACE}/import/events`, { opId: 'o', events: [{ key: '1' }] })
    await post(`${WORKSPACE}/import/deliveries`, { opId: 'o', deliveries: [{ sourceId: 'd', cardId: 1 }] })
    await post(`${WORKSPACE}/import/finish`, { opId: 'o' })
    await get(`${WORKSPACE}/export`)
    await get(`${WORKSPACE}/export/events`)

    assert.deepEqual(calls.map((c) => c.fn), [
      'read_snapshot', 'read_card', 'read_archive', 'read_documents', 'write_documents',
      'list_locks', 'take_lock', 'release_lock', 'read_deliveries', 'record_delivery',
      'begin_import', 'import_events', 'import_deliveries', 'finish_import',
      'export_board', 'export_events',
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
      `${WORKSPACE}/members/${ACCOUNT}/nonsense`,
      `${WORKSPACE}/members/${ACCOUNT}/remove/typo`,
      `${WORKSPACE}/cards/1/nonsense`,
      `${WORKSPACE}/locks/nonsense`,
      `${WORKSPACE}/import/nonsense`,
      `${WORKSPACE}/export/nonsense`,
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
