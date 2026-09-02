// A board whose authority is a Cloud workspace (#316).
//
// The three things a Cloud board is, checked against a fake Worker and nothing else mocked:
//
//   • the copy — a checkout with a pointer opens the WORKSPACE's board, over whatever
//     markdown is committed beside it, and reads every card from that copy afterwards,
//   • the write-back — what a move changed travels under the revision it was read at, a
//     refusal leaves the copy exactly as it was, and a lost reply is retried under the same
//     operation id,
//   • the four sentences a person gets when the board will not open or will not save: not
//     signed in, not this account's workspace, Cloud out of reach, and the service's own
//     free-tier refusal.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { board, boardState, openBoard, when, withLease } from '../src/lib/board/index.ts'
import { writePointer } from '../src/lib/cloud/pointer.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'

const SUPABASE = 'https://cloud.test'
const API = 'https://api.test'
const WORKSPACE = 'ws-1'

let home = ''
let root = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloudboard-home-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloudboard-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon'
  process.env.AI4KANBAN_CLOUD_URL = API
  setBoardRoot(root)
  signedIn()
})

afterEach(async () => {
  mock.restoreAll()
  // Leave the process on a Local board, so one test's provider is never another's.
  await openBoard(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloudboard-local-')))
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  delete process.env.AI4KANBAN_HOME
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

function signedIn(): void {
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'a-token',
    refreshToken: 'r-token',
    expiresAt: Date.now() + 60 * 60_000,
    subject: '11111111-1111-4111-8111-111111111111',
  })
}

// ---- the workspace this fake Worker holds -----------------------------------

const meta = (over: Partial<Meta> = {}): Meta =>
  ({
    title: 'A card',
    track: 'features',
    priority: 'med',
    roi: 'med',
    status: 'todo',
    release: '',
    blocked_by: [],
    related: [],
    modules: [],
    questions: [],
    schedule: null,
    ...over,
  }) as Meta

const wireCard = (id: number, revision: string, over: Partial<Meta> = {}, body = 'From the workspace.\n') => ({
  id,
  revision,
  archived: false,
  archivedAt: null,
  data: { path: `todo/features/${id}-a-card.md`, meta: meta({ title: `Card ${id}`, ...over }), body },
})

const SNAPSHOT = {
  revision: '7',
  workspace: {
    id: WORKSPACE,
    name: 'Shared board',
    revision: '7',
    nextCardId: 9,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
  cards: [wireCard(3, 'r3'), wireCard(4, 'r4')],
  documents: [
    { path: 'config.md', kind: 'config', revision: 'c1', body: '# Board\n' },
    { path: 'todo/README.md', kind: 'config', revision: 'c2', body: '# Open work\n' },
  ],
}

const HISTORY = {
  revision: '7',
  documents: [
    { path: 'record.csv', kind: 'history', revision: 'h1', body: 'date,action,card,detail\n' },
    { path: 'metrics.csv', kind: 'history', revision: 'h2', body: 'date,created\n' },
  ],
}

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

const refused = (status: number, error: Record<string, unknown>): Response =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } })

interface Call {
  method: string
  path: string
  body: Record<string, unknown>
}

/**
 * Stand a Worker in front of the board. `answer` gets every call and may hand back its own
 * response; anything it does not answer falls through to a workspace that simply works.
 */
function worker(answer: (call: Call) => Response | undefined = () => undefined): Call[] {
  const calls: Call[] = []
  mock.method(globalThis, 'fetch', async (input: string, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const call: Call = {
      method: init.method ?? 'GET',
      path: `${url.pathname}${url.search}`,
      body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
    }
    calls.push(call)
    const own = answer(call)
    if (own) return own
    return standard(call)
  })
  return calls
}

/** A workspace that answers every call the way the service does when nothing is wrong. */
function standard(call: Call): Response {
  const { path: p, method } = call
  if (p.endsWith('/snapshot')) return ok(SNAPSHOT)
  if (p.includes('/documents?kind=history')) return ok(HISTORY)
  if (p.includes('/documents?kind=summary')) return ok({ revision: '7', documents: [] })
  if (p.endsWith('/archive')) return ok({ revision: '7', cards: [] })
  if (p.endsWith('/nodes') && method === 'POST') {
    return ok({ node: { id: 'node-1', workspaceId: WORKSPACE, name: 'here', machineId: 'm', machineName: 'here', runtimes: [], leaseExpiresAt: null, live: true } })
  }
  if (p.endsWith('/locks') && method === 'POST') {
    const cardId = call.body.cardId as number | null
    return ok({ lock: { leaseId: `lease-${cardId ?? 0}`, cardId, revision: cardId ? `r${cardId}` : '7', grantedAt: '', expiresAt: '' } })
  }
  if (p.endsWith('/locks/release')) return ok({ released: true })
  if (p.endsWith('/cards') && method === 'POST') {
    const sent = (call.body.cards ?? []) as { id: number; data: unknown; archived?: boolean }[]
    return ok({
      revision: '8',
      cards: sent.map((c) => ({ id: c.id, revision: `${c.id}-next`, archived: c.archived === true, archivedAt: null, data: c.data })),
    })
  }
  if (p.endsWith('/documents') && method === 'POST') {
    const sent = (call.body.documents ?? []) as { path: string; kind: string; body: string }[]
    return ok({ revision: '8', documents: sent.map((d) => ({ ...d, revision: `${d.path}-next` })) })
  }
  return ok({})
}

/** Point this checkout at the workspace, and leave a card committed beside it — a checkout
 *  that used to be a Local board and still carries its markdown. */
function pointed(withCommittedCard = true): void {
  writePointer(root, { workspace: WORKSPACE, name: 'Shared board' })
  if (!withCommittedCard) return
  const track = path.join(root, 'docs', 'kanban', 'todo', 'features')
  fs.mkdirSync(track, { recursive: true })
  fs.writeFileSync(
    path.join(track, '99-left-behind.md'),
    `${serializeFrontmatter(meta({ title: 'Left behind' }))}\nCommitted in this checkout.\n`,
  )
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '100\n')
}

const cardFiles = (): string[] => {
  const dir = path.join(root, 'docs', 'kanban', 'todo', 'features')
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []
}

// ---- the copy ---------------------------------------------------------------

describe('a checkout that points at a workspace', () => {
  it('opens the workspace board over the cards committed beside it', async () => {
    worker()
    pointed()

    const opened = await openBoard(root)
    assert.equal(opened.ok, true)
    assert.equal(opened.ok && opened.kind, 'cloud')
    assert.equal(board().kind, 'cloud')

    // The workspace's two cards, and none of the checkout's own.
    assert.deepEqual(cardFiles(), ['3-a-card.md', '4-a-card.md'])
    const card = await board().readCard(3)
    assert.equal(card?.title, 'Card 3')
    assert.equal(await board().readCard(99), null)

    // The copy carries the workspace's own numbering, not the checkout's.
    assert.equal(fs.readFileSync(path.join(root, 'docs', 'kanban', 'next-id'), 'utf8').trim(), '9')
    // …and it is kept out of git, because it is a copy and not the record.
    assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /^docs\/kanban\/$/m)
  })

  it('says it is a Cloud board, live, with when the copy was read', async () => {
    worker()
    pointed(false)
    await openBoard(root)
    const state = boardState()
    assert.equal(state.kind, 'cloud')
    assert.equal(state.offline, false)
    assert.equal(state.workspaceName, 'Shared board')
    assert.ok(Date.parse(state.readAt) > 0)
  })

  it('leaves a checkout with no pointer on the Local board', async () => {
    worker()
    fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
    fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '1\n')
    const opened = await openBoard(root)
    assert.deepEqual(opened, { ok: true, kind: 'local' })
    assert.equal(board().kind, 'local')
    assert.equal(boardState().kind, 'local')
  })
})

// ---- the write-back ---------------------------------------------------------

describe('a write on a Cloud board', () => {
  it('sends the card it changed under the revision it was read at', async () => {
    const calls = worker()
    pointed(false)
    await openBoard(root)

    const res = await withLease({ card: 3 }, (env) => board().patchCard(3, { priority: 'high' }, env))
    assert.equal(res.ok, true)

    const wrote = calls.find((c) => c.method === 'POST' && c.path.endsWith('/cards'))
    assert.ok(wrote, 'the change reached the workspace')
    const sent = wrote.body.cards as { id: number; expect: string; lease?: string; data: { meta: Meta } }[]
    assert.equal(sent.length, 1)
    assert.equal(sent[0].id, 3)
    assert.equal(sent[0].expect, 'r3')
    assert.equal(sent[0].lease, 'lease-3')
    assert.equal(sent[0].data.meta.priority, 'high')
    // The machine registered itself, and the write is attributed to it.
    assert.equal(wrote.body.nodeId, 'node-1')

    // The revision the reply handed back is folded in, so the next write expects it rather
    // than re-reading the board.
    const again = await withLease({ card: 3 }, (env) => board().patchCard(3, { roi: 'high' }, env))
    assert.equal(again.ok, true)
    const second = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/cards')).at(-1)
    assert.equal((second!.body.cards as { expect: string }[])[0].expect, '3-next')
  })

  it('leaves the copy untouched when the workspace refuses it as stale, and re-reads', async () => {
    let refuseOnce = true
    const calls = worker((call) => {
      if (call.method === 'POST' && call.path.endsWith('/cards') && refuseOnce) {
        refuseOnce = false
        return refused(409, {
          code: 'revision_conflict',
          message: 'That changed since you read it.',
          current: 'r3-elsewhere',
        })
      }
      return undefined
    })
    pointed(false)
    await openBoard(root)
    const before = fs.readFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', '3-a-card.md'), 'utf8')

    const res = await withLease({ card: 3 }, (env) => board().patchCard(3, { priority: 'high' }, env))
    assert.equal(res.ok, false)
    assert.equal(res.kind, 'conflict')

    // Nothing was left behind on the copy…
    const after = fs.readFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', '3-a-card.md'), 'utf8')
    assert.equal(after, before)
    // …and the whole board was read again: two snapshots, the open and the re-read.
    assert.equal(calls.filter((c) => c.path.endsWith('/snapshot')).length, 2)
  })

  it('retries a write whose reply never came under the same operation id', async () => {
    let lost = 1
    const calls = worker((call) => {
      if (call.method === 'POST' && call.path.endsWith('/cards') && lost-- > 0) throw new Error('socket hang up')
      return undefined
    })
    pointed(false)
    await openBoard(root)

    const res = await withLease({ card: 3 }, (env) => board().patchCard(3, { priority: 'high' }, env))
    assert.equal(res.ok, true)

    const writes = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/cards'))
    assert.equal(writes.length, 2)
    assert.equal(writes[0].body.opId, writes[1].body.opId)
  })

  it('leaves the delivery records on this machine whole when a write is refused', async () => {
    worker((call) =>
      call.method === 'POST' && call.path.endsWith('/cards')
        ? refused(429, { code: 'daily_write_budget_reached', message: 'Out of writes today.' })
        : undefined,
    )
    pointed(false)
    await openBoard(root)

    // A delivery in flight: the workspace never sees the repository half of one, so undoing
    // a refused move must not write the record back from what a workspace write would carry.
    const file = path.join(root, 'docs', 'kanban', 'deliveries', 'abc12345.json')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const record = {
      deliveryId: 'abc12345',
      cardId: 3,
      status: 'active',
      base: 'a1b2c3d4',
      branch: 'card/3/abc12345',
      targetBranch: 'main',
      worktree: '.akb/worktrees/3/abc12345',
    }
    fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)

    const res = await withLease({ card: 3 }, (env) => board().patchCard(3, { priority: 'high' }, env))
    assert.equal(res.ok, false)

    // The branch, the base and the worktree are still there: without them the board could
    // neither land this delivery nor cancel it.
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')) as typeof record, record)
  })

  it('reads the board again when the cards landed and the documents beside them did not', async () => {
    const calls = worker((call) =>
      call.method === 'POST' && call.path.endsWith('/documents')
        ? refused(429, { code: 'storage_limit_reached', message: 'This workspace is full.' })
        : undefined,
    )
    pointed(false)
    await openBoard(root)

    // A create is the plainest move that is both: a new card, and the index beside it.
    const res = await withLease({ board: true }, (env) =>
      board().runMove('create', ['--title', 'A new one', '--track', 'features'], env),
    )
    assert.equal(res.ok, false)
    assert.match(res.ok === false ? res.error : '', /workspace is full/)

    // The cards went through and the documents did not, so undoing the move here put the
    // copy behind a change the workspace kept — only a fresh read squares the two.
    assert.ok(calls.some((c) => c.method === 'POST' && c.path.endsWith('/cards')))
    assert.ok(calls.some((c) => c.method === 'POST' && c.path.endsWith('/documents')))
    assert.equal(calls.filter((c) => c.path.endsWith('/snapshot')).length, 2)
  })

  it('shows a free-tier refusal in the service’s own words and keeps the copy as it was', async () => {
    worker((call) => {
      if (call.method === 'POST' && call.path.endsWith('/cards')) {
        return refused(429, {
          code: 'daily_write_budget_reached',
          message: 'Cloud has used up today’s free-tier writes. Your change was not saved — save it again after 00:00 UTC.',
        })
      }
      return undefined
    })
    pointed(false)
    await openBoard(root)
    const before = fs.readFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', '3-a-card.md'), 'utf8')

    const res = await withLease({ card: 3 }, (env) => board().patchCard(3, { priority: 'high' }, env))
    assert.equal(res.ok, false)
    assert.equal(res.kind, 'refused')
    assert.match(res.error, /free-tier writes/)
    assert.match(res.error, /not saved/)
    assert.equal(
      fs.readFileSync(path.join(root, 'docs', 'kanban', 'todo', 'features', '3-a-card.md'), 'utf8'),
      before,
    )
    // The board is still live: a refusal the workspace ANSWERED is not being offline.
    assert.equal(boardState().offline, false)
  })

  it('names a new card with the copy’s own number and writes it against nothing', async () => {
    const calls = worker()
    pointed(false)
    await openBoard(root)

    const made = await withLease({ board: true }, (env) =>
      board().runMove('create', ['--title', 'A new one', '--track', 'features'], env),
    )
    assert.equal(made.ok, true)

    const wrote = calls.find((c) => c.method === 'POST' && c.path.endsWith('/cards'))
    const sent = (wrote!.body.cards as { id: number; expect: string }[])[0]
    // The workspace's own `nextCardId`, and no revision — so a number another machine has
    // already taken is refused by the SERVICE rather than overwritten here.
    assert.equal(sent.id, 9)
    assert.equal(sent.expect, '')
  })

  it('reads the archive only when a release is closed', async () => {
    const calls = worker()
    pointed(false)
    await openBoard(root)
    assert.equal(calls.filter((c) => c.path.endsWith('/archive')).length, 0)

    await board().closePlan('v1')
    assert.equal(calls.filter((c) => c.path.endsWith('/archive')).length, 1)
  })

  it('says how long a card another writer holds is held for', async () => {
    worker((call) => {
      if (call.method === 'POST' && call.path.endsWith('/locks')) {
        return refused(409, {
          code: 'card_locked',
          message: 'Another writer is holding card 3.',
          until: '2026-09-02T10:30:00Z',
        })
      }
      return undefined
    })
    pointed(false)
    await openBoard(root)

    const got = await board().lease({ card: 3 })
    assert.equal(got.ok, false)
    assert.match(got.ok === false ? got.error : '', /Another writer is holding card 3/)
    assert.match(got.ok === false ? got.error : '', /2026-09-02T10:30:00Z/)
  })
})

// ---- Cloud out of reach ------------------------------------------------------

describe('a Cloud board Cloud cannot be reached from', () => {
  it('serves the copy read-only, marked offline with when it was read', async () => {
    worker()
    pointed(false)
    await openBoard(root)
    const readAt = boardState().readAt

    // The network goes away, and the board is opened again from the same checkout.
    mock.restoreAll()
    mock.method(globalThis, 'fetch', () => Promise.reject(new Error('getaddrinfo ENOTFOUND')))
    const { openCloudBoard } = await import('../src/lib/board/cloud.ts')
    const opened = await openCloudBoard(root, WORKSPACE)
    assert.equal(opened.ok, true)
    assert.ok(opened.ok)
    assert.equal(opened.board.state().offline, true)
    assert.equal(opened.board.state().readAt, readAt)

    // Reading still works…
    const card = await opened.board.provider.readCard(3)
    assert.equal(card?.title, 'Card 3')
    // …and saving does not, in a line that says how old the screen is.
    const wrote = await opened.board.provider.patchCard(3, { priority: 'high' }, { opId: 'x', expect: card!.revision })
    assert.equal(wrote.ok, false)
    assert.match(wrote.ok === false ? wrote.error : '', /offline/)
    // …naming how old the screen is, in the one spelling a terminal and a browser share.
    assert.ok((wrote.ok === false ? wrote.error : '').includes(when(readAt)))
  })

  it('says so rather than opening an empty board when the copy was never read', async () => {
    mock.method(globalThis, 'fetch', () => Promise.reject(new Error('getaddrinfo ENOTFOUND')))
    pointed(false)
    const opened = await openBoard(root)
    assert.equal(opened.ok, false)
    assert.equal(opened.ok === false && opened.reason, 'unreachable')
    assert.match(opened.ok === false ? opened.error : '', /never read its workspace/)
  })
})

// ---- the two sign-in refusals -------------------------------------------------

describe('a workspace this machine may not read', () => {
  it('tells a machine with no sign-in to sign in from the app', async () => {
    worker()
    fs.rmSync(path.join(home, 'session.json'), { force: true })
    pointed(false)
    const opened = await openBoard(root)
    assert.equal(opened.ok, false)
    assert.equal(opened.ok === false && opened.reason, 'signed-out')
    assert.match(opened.ok === false ? opened.error : '', /Configuration dialog/)
  })

  it('says the workspace is not this account’s rather than reporting a broken board', async () => {
    worker((call) =>
      call.path.endsWith('/snapshot')
        ? refused(403, { code: 'not_yours', message: 'That belongs to another account.' })
        : undefined,
    )
    pointed(false)
    const opened = await openBoard(root)
    assert.equal(opened.ok, false)
    assert.equal(opened.ok === false && opened.reason, 'not-yours')
    assert.match(opened.ok === false ? opened.error : '', /not this account/)

    // And the board installed behind it answers with that, rather than with the markdown
    // left in the checkout.
    await assert.rejects(() => board().readBoard(), /not this account/)
  })

  // A refusal is never this process's final answer. The remedy every one of them names is
  // something the user does elsewhere — sign in from the Configuration dialog, wait for
  // Cloud — so the next read has to open the board with nothing to press. The app calls
  // this before every read for exactly that.
  it('opens the board on the next read once the machine signs in', async () => {
    worker()
    fs.rmSync(path.join(home, 'session.json'), { force: true })
    pointed(false)
    assert.equal((await openBoard(root)).ok, false)

    signedIn()
    const opened = await openBoard(root)
    assert.equal(opened.ok, true)
    assert.equal(boardState().offline, false)
    assert.deepEqual((await board().readCards()).map((c) => c.id), [3, 4])
  })
})
