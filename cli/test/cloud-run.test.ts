// A run's coding agent working a Cloud board (#398).
//
// The bracket a run puts around itself, against a fake Worker and nothing else mocked:
//
//   • the card is held for the length of the run, one lease every process here presents,
//     and a card another machine holds refuses the run outright,
//   • the copy's refresh stands down while a run is up — on open, and when the user asks —
//     so nothing writes the workspace's cards over what the agent has just typed,
//   • the close sends the card bodies the run is answerable for and the memory it wrote,
//     against the revisions the workspace holds at that moment,
//   • a run whose card is taken over drops what it wrote and reads that card back.
//
// A Local board does none of it, which is the last test here.

import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import {
  board,
  boardImage,
  carryRunEdits,
  dropRunCard,
  openBoard,
  refreshBoard,
  rereadRunCard,
  takeRunCard,
  withLease,
} from '../src/lib/board/index.ts'
import { resolveBoard } from '../src/lib/board-cli.ts'
import { heldLease, stampHolder } from '../src/lib/cloud/holds.ts'
import { writePointer } from '../src/lib/cloud/pointer.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Meta } from '../src/lib/types.ts'

const SUPABASE = 'https://cloud.test'
const API = 'https://api.test'
const WORKSPACE = 'ws-1'
const RUN = 'run-0001'

let home = ''
let root = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloudrun-home-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloudrun-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon'
  process.env.AI4KANBAN_CLOUD_URL = API
  setBoardRoot(root)
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'a-token',
    refreshToken: 'r-token',
    expiresAt: Date.now() + 60 * 60_000,
    subject: '11111111-1111-4111-8111-111111111111',
  })
})

afterEach(async () => {
  mock.restoreAll()
  // Leave the process on a Local board, so one test's provider is never another's.
  await openBoard(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloudrun-local-')))
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  delete process.env.AI4KANBAN_HOME
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

// ---- the workspace this fake Worker holds -----------------------------------

const meta = (over: Partial<Meta> = {}): Meta =>
  ({
    title: 'A card',
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

const wireCard = (id: number, revision: string) => ({
  id,
  revision,
  archived: false,
  archivedAt: null,
  data: { path: `todo/features/${id}-a-card.md`, meta: meta({ title: `Card ${id}` }), body: 'From the workspace.\n' },
})

/** The revision each card reads at, which one test moves under the run. */
let cardRevisions = new Map<number, string>()

const snapshot = () => ({
  revision: '7',
  workspace: {
    id: WORKSPACE,
    name: 'Shared board',
    revision: '7',
    nextCardId: 9,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
  cards: [wireCard(3, cardRevisions.get(3) ?? 'r3'), wireCard(4, cardRevisions.get(4) ?? 'r4')],
  documents: [
    { path: 'config.md', kind: 'config', revision: 'c1', body: '# Board\n' },
    { path: 'todo/README.md', kind: 'config', revision: 'c2', body: '# Open work\n' },
  ],
})

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
  new Response(JSON.stringify(error.code ? { error } : error), {
    status,
    headers: { 'content-type': 'application/json' },
  })

interface Call {
  method: string
  path: string
  body: Record<string, unknown>
}

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
    return answer(call) ?? standard(call)
  })
  return calls
}

/** A workspace that answers every call the way the service does when nothing is wrong. A
 *  lock is minted once per card and handed back to whoever presents it. */
function standard(call: Call): Response {
  const { path: p, method } = call
  if (p.endsWith('/snapshot')) return ok(snapshot())
  if (p.includes('/documents?kind=history')) return ok(HISTORY)
  if (p.includes('/documents?kind=summary')) return ok({ revision: '7', documents: [] })
  if (p.endsWith('/archive')) return ok({ revision: '7', cards: [] })
  if (p.endsWith('/nodes') && method === 'POST') {
    return ok({
      node: { id: 'node-1', workspaceId: WORKSPACE, name: 'here', machineId: 'm', machineName: 'here', runtimes: [], leaseExpiresAt: null, live: true },
    })
  }
  if (p.endsWith('/locks') && method === 'POST') {
    const cardId = call.body.cardId as number | null
    const lease = (call.body.lease as string) || `lease-${cardId ?? 0}`
    return ok({
      lock: {
        leaseId: lease,
        cardId,
        revision: cardId ? `r${cardId}` : '7',
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
    })
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

const pointed = (): void => writePointer(root, { workspace: WORKSPACE, name: 'Shared board' })

/** The runs on this machine, live: no pid yet and started a moment ago, which is what the
 *  record calls running while the command that wrote it is still spawning its watcher. */
function running(...runs: { sessionId: string; cardId: number | null }[]): void {
  const dir = path.join(root, 'docs', 'kanban')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, '.sessions.json'),
    JSON.stringify({
      runs: (runs.length ? runs : [{ sessionId: RUN, cardId: 3 }]).map((r) => ({
        ...r,
        action: 'implement',
        status: 'running',
        startedAt: Date.now(),
        logPath: path.join(dir, '.sessions', `${r.sessionId}.log`),
        flowId: 'flow-1',
      })),
      deliveries: [],
      marks: {},
    }),
  )
}

const cardFile = (id: number): string => path.join(root, 'docs', 'kanban', 'todo', 'features', `${id}-a-card.md`)
const write = (file: string, text: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
}
const cardsSent = (calls: Call[]) => calls.filter((c) => c.method === 'POST' && c.path.endsWith('/cards'))

/** The pid of a process that has certainly exited — a watcher that is gone. */
const deadPid = (): Promise<number> =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' })
    child.on('exit', () => resolve(child.pid!))
  })
const docsSent = (calls: Call[]) => calls.filter((c) => c.method === 'POST' && c.path.endsWith('/documents'))

// ---- the card's lock --------------------------------------------------------

describe("a run's hold on its card", () => {
  it('is taken before the run and presented by every write the run makes', async () => {
    const calls = worker()
    pointed()
    await openBoard(root)

    assert.deepEqual(await takeRunCard(RUN, 3), { ok: true })
    assert.equal(heldLease(WORKSPACE, 3), 'lease-3')

    // A board move over that card presents the lease the machine already has rather than
    // taking one of its own — `cloud.require_lock` would refuse a second.
    running()
    const res = await withLease({ card: 3 }, (env) => board().patchCard(3, { priority: 'high' }, env))
    assert.equal(res.ok, true)
    const locks = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/locks'))
    assert.equal(locks.length, 2)
    assert.equal(locks[1]!.body.lease, 'lease-3')
    assert.equal((cardsSent(calls)[0]!.body.cards as { lease?: string }[])[0]!.lease, 'lease-3')

    // …and giving that write's lease back does not unhold the card mid-run.
    assert.equal(calls.filter((c) => c.path.endsWith('/locks/release')).length, 0)
    assert.equal(heldLease(WORKSPACE, 3), 'lease-3')
  })

  it('is given back when the run ends', async () => {
    const calls = worker()
    pointed()
    await openBoard(root)
    await takeRunCard(RUN, 3)
    await dropRunCard(RUN)

    const released = calls.filter((c) => c.path.endsWith('/locks/release'))
    assert.equal(released.length, 1)
    assert.equal(released[0]!.body.lease, 'lease-3')
    assert.equal(heldLease(WORKSPACE, 3), '')
  })

  it('stays held while a second run on this machine has the same card', async () => {
    const calls = worker()
    pointed()
    await openBoard(root)
    await takeRunCard(RUN, 3)
    // A spec run joins the machine's lease rather than taking a second one.
    await takeRunCard('spec-1', 3)
    const locks = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/locks'))
    assert.equal(locks[1]!.body.lease, 'lease-3')

    await dropRunCard('spec-1')
    assert.equal(calls.filter((c) => c.path.endsWith('/locks/release')).length, 0)
    assert.equal(heldLease(WORKSPACE, 3), 'lease-3')
  })

  it('is given back even when a run whose watcher was killed is still written down beside it', async () => {
    const calls = worker()
    pointed()
    await openBoard(root)
    await takeRunCard(RUN, 3)
    // A second run that never closed out: its watcher was killed, so it stops holding the
    // card here and must not keep the lease alive for the run closing cleanly beside it.
    await takeRunCard('run-gone', 3)
    stampHolder('run-gone', await deadPid())

    await dropRunCard(RUN)
    const released = calls.filter((c) => c.path.endsWith('/locks/release'))
    assert.equal(released.length, 1)
    assert.equal(heldLease(WORKSPACE, 3), '')
  })

  it('refuses a run whose card another machine holds, and says when the hold runs out', async () => {
    worker((call) =>
      call.method === 'POST' && call.path.endsWith('/locks')
        ? refused(409, { code: 'card_locked', message: 'Another writer is holding card 3.', until: '2026-09-03T12:00:00Z' })
        : undefined,
    )
    pointed()
    await openBoard(root)

    const held = await takeRunCard(RUN, 3)
    assert.equal(held.ok, false)
    assert.match(held.ok === false ? held.error : '', /held by another machine/)
    assert.match(held.ok === false ? held.error : '', /2026-09-03T12:00:00Z/)
    assert.equal(heldLease(WORKSPACE, 3), '')
  })

  it('refuses a run that cannot reach the workspace', async () => {
    let reachable = true
    worker((call) => {
      if (!reachable && !call.path.endsWith('/snapshot')) throw new Error('socket hang up')
      return undefined
    })
    pointed()
    await openBoard(root)
    reachable = false

    const held = await takeRunCard(RUN, 3)
    assert.equal(held.ok, false)
    assert.match(held.ok === false ? held.error : '', /socket hang up|could not be reached/)
  })
})

// ---- the copy while a run is up ---------------------------------------------

describe('the copy while a run is working the board', () => {
  it('is left as it stands when another process opens the board', async () => {
    worker()
    pointed()
    await openBoard(root)
    running()

    // What the agent has typed and not yet uploaded.
    write(cardFile(3), `${serializeFrontmatter(meta({ title: 'Card 3' }))}\nThe agent wrote this.\n`)

    // A second process opening the same checkout — the board server, or the agent's own
    // `akb raw` — takes the workspace's revisions and writes over nothing.
    await openBoard(fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloudrun-other-')))
    setBoardRoot(root)
    const opened = await openBoard(root)
    assert.equal(opened.ok, true)
    assert.match(fs.readFileSync(cardFile(3), 'utf8'), /The agent wrote this\./)
  })

  it('refuses the refresh the user asks for, and says the run is what to wait for', async () => {
    worker()
    pointed()
    await openBoard(root)
    running()
    write(cardFile(3), `${serializeFrontmatter(meta({ title: 'Card 3' }))}\nThe agent wrote this.\n`)

    const asked = await refreshBoard()
    assert.equal(asked.ok, false)
    assert.match(asked.error ?? '', /is working this board/)
    assert.match(asked.error ?? '', /when the run ends/)
    assert.match(fs.readFileSync(cardFile(3), 'utf8'), /The agent wrote this\./)
  })
})

// ---- the upload at the close ------------------------------------------------

describe("a run's close", () => {
  it('sends the cards it is answerable for and the documents it wrote, at the revisions the workspace holds now', async () => {
    const calls = worker()
    pointed()
    await openBoard(root)
    await takeRunCard(RUN, 3)
    // …with a neighbouring run holding #4, which is what keeps that card out of this one's
    // upload: it is the neighbour's to send when it closes.
    running({ sessionId: RUN, cardId: 3 }, { sessionId: 'run-0002', cardId: 4 })

    const image = boardImage()
    assert.ok(image, 'a Cloud board has an image to bracket the run with')

    // What the agent wrote with its own tools while the run went: one card body, one memory
    // file — and one history file, which is the board's own bookkeeping and never a run's.
    write(cardFile(3), `${serializeFrontmatter(meta({ title: 'Card 3' }))}\nThe agent wrote this.\n`)
    write(cardFile(4), `${serializeFrontmatter(meta({ title: 'Card 4' }))}\nA neighbouring run wrote this.\n`)
    write(path.join(root, 'docs', 'kanban', 'memory', 'skill', 'readme.md'), '# Shipped\n\n- one line\n')
    write(path.join(root, 'docs', 'kanban', 'record.csv'), 'date,action,card,detail\n2026-09-03,edit,3,\n')

    // The card moved under the run — its own `akb raw` moves each write it — so the close
    // has to send against what the workspace holds now, not what it read at the start.
    cardRevisions.set(3, 'r3-moved')

    const sent = await carryRunEdits(image, RUN)
    assert.equal(sent?.ok, true)

    const cards = (cardsSent(calls).at(-1)!.body.cards ?? []) as { id: number; expect: string; lease?: string; data: { body: string } }[]
    assert.deepEqual(cards.map((c) => c.id), [3])
    assert.equal(cards[0]!.expect, 'r3-moved')
    assert.equal(cards[0]!.lease, 'lease-3')
    assert.match(cards[0]!.data.body, /The agent wrote this\./)

    const documents = (docsSent(calls).at(-1)!.body.documents ?? []) as { path: string }[]
    assert.deepEqual(documents.map((d) => d.path), ['memory/skill/readme.md'])

    cardRevisions.clear()
  })

  it('sends nothing when the run wrote nothing to the board', async () => {
    const calls = worker()
    pointed()
    await openBoard(root)
    running()

    const sent = await carryRunEdits(boardImage(), RUN)
    assert.deepEqual(sent, { ok: true, cards: 0, documents: 0 })
    assert.equal(cardsSent(calls).length, 0)
    assert.equal(docsSent(calls).length, 0)
  })

  it('leaves the archive out: a card off the board went under the move that archived it', async () => {
    const calls = worker()
    pointed()
    await openBoard(root)
    await takeRunCard(RUN, 3)
    running()

    const image = boardImage()
    // What `akb card archive 3` leaves behind in the copy — and what the app's archive screen
    // pulls into it. Either way the workspace already holds those cards, at revisions this
    // process never read: sending them would be a conflict, and would take the run's real
    // edits down with it.
    fs.rmSync(cardFile(3))
    write(
      path.join(root, 'docs', 'kanban', '.archive', '3-a-card.md'),
      `${serializeFrontmatter(meta({ title: 'Card 3', status: 'done' }))}\nFrom the workspace.\n`,
    )
    write(path.join(root, 'docs', 'kanban', 'memory', 'skill', 'readme.md'), '# Shipped\n')

    const sent = await carryRunEdits(image, RUN)
    assert.equal(sent?.ok, true)
    assert.equal(cardsSent(calls).length, 0, 'no card travels for a move that already sent it')
    const documents = (docsSent(calls).at(-1)!.body.documents ?? []) as { path: string }[]
    assert.deepEqual(documents.map((d) => d.path), ['memory/skill/readme.md'])
  })

  it('says the card was taken over when the workspace no longer holds this machine as its holder', async () => {
    const calls = worker((call) =>
      call.method === 'POST' && call.path.endsWith('/cards')
        ? refused(409, { code: 'card_locked', message: 'Another writer is holding card 3.' })
        : undefined,
    )
    pointed()
    await openBoard(root)
    await takeRunCard(RUN, 3)
    running()

    const image = boardImage()
    write(cardFile(3), `${serializeFrontmatter(meta({ title: 'Card 3' }))}\nThe agent wrote this.\n`)
    const sent = await carryRunEdits(image, RUN)
    assert.equal(sent?.ok, false)
    assert.equal(sent && !sent.ok && sent.takenOver, true)
    // One attempt, not three: a card somebody else is holding is an answer, not a hiccup.
    assert.equal(cardsSent(calls).length, 1)

    // …and that one card is read back from the workspace, over what the run wrote.
    await rereadRunCard(3)
    assert.match(fs.readFileSync(cardFile(3), 'utf8'), /From the workspace\./)
  })

  it('waits and sends again when a board move here is holding the documents, rather than calling it a takeover', async () => {
    let holding = true
    const calls = worker((call) => {
      if (call.method !== 'POST' || !call.path.endsWith('/documents')) return undefined
      // The BOARD's lock, not the card's: every `akb raw` move on this machine takes it
      // and gives it straight back, so a neighbour holding it says nothing about this card.
      if (!holding) return undefined
      holding = false
      return refused(409, { code: 'card_locked', message: 'Another writer is holding this board.' })
    })
    pointed()
    await openBoard(root)
    await takeRunCard(RUN, 3)
    running()

    const image = boardImage()
    write(path.join(root, 'docs', 'kanban', 'memory', 'skill', 'readme.md'), '# Shipped\n')
    const sent = await carryRunEdits(image, RUN)
    assert.equal(sent?.ok, true, 'the run keeps what it wrote and lands it on the next try')
    assert.equal(docsSent(calls).length, 2)
  })

  it('says so when the upload never lands, after trying again', async () => {
    const calls = worker((call) => {
      if (call.method === 'POST' && call.path.endsWith('/cards')) throw new Error('socket hang up')
      return undefined
    })
    pointed()
    await openBoard(root)
    await takeRunCard(RUN, 3)
    running()

    const image = boardImage()
    write(cardFile(3), `${serializeFrontmatter(meta({ title: 'Card 3' }))}\nThe agent wrote this.\n`)
    const sent = await carryRunEdits(image, RUN)
    assert.equal(sent?.ok, false)
    assert.equal(sent && !sent.ok && sent.takenOver, undefined)
    assert.ok(cardsSent(calls).length > 1, 'it was tried more than once')
    // What the run wrote is still in the checkout, for the next write from here to send.
    assert.match(fs.readFileSync(cardFile(3), 'utf8'), /The agent wrote this\./)
  })
})

// ---- reading one card back --------------------------------------------------

describe('reading a taken-over card back from the workspace', () => {
  it("replaces a group root's own file and leaves the subtasks beside it alone", async () => {
    worker((call) =>
      call.path.endsWith('/snapshot')
        ? ok({
            ...snapshot(),
            cards: [
              { ...wireCard(3, 'r3'), data: { ...wireCard(3, 'r3').data, path: 'todo/3-a-group/root.md' } },
              wireCard(4, 'r4'),
            ],
          })
        : undefined,
    )
    pointed()
    await openBoard(root)
    running()

    const group = path.join(root, 'docs', 'kanban', 'todo', '3-a-group')
    write(path.join(group, 'root.md'), `${serializeFrontmatter(meta({ title: 'Card 3' }))}\nThe agent wrote this.\n`)
    const subtask = path.join(group, 'features', '5-a-piece.md')
    write(subtask, `${serializeFrontmatter(meta({ title: 'Card 5' }))}\nA piece of it.\n`)

    await rereadRunCard(3)
    assert.match(fs.readFileSync(path.join(group, 'root.md'), 'utf8'), /From the workspace\./)
    assert.match(fs.readFileSync(subtask, 'utf8'), /A piece of it\./)
  })
})

// ---- a delivery's worktree --------------------------------------------------

describe("a delivery's worktree on a Cloud checkout", () => {
  it("opens the project's board rather than hydrating a second copy of its own", () => {
    pointed()
    const worktree = path.join(root, '.akb', 'worktrees', '12', 'd1')
    fs.mkdirSync(worktree, { recursive: true })
    // The pointer is committed, so the worktree carries one — and a board opened there would
    // write `docs/kanban/` into a checkout that is meant to hold only code.
    fs.copyFileSync(path.join(root, '.ai4kanban.json'), path.join(worktree, '.ai4kanban.json'))

    const found = resolveBoard('list', { dir: null, cwd: worktree, installHint: '`akb install`' })
    assert.equal(fs.realpathSync(found.root), fs.realpathSync(root))
  })
})

// ---- a Local board ----------------------------------------------------------

describe('a Local board', () => {
  it('locks nothing, uploads nothing, and refreshes nothing', async () => {
    const calls = worker()
    fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo', 'features'), { recursive: true })
    fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '1\n')
    await openBoard(root)

    assert.deepEqual(await takeRunCard(RUN, 3), { ok: true })
    assert.equal(boardImage(), null)
    assert.equal(await carryRunEdits(null, RUN), null)
    await dropRunCard(RUN)
    await rereadRunCard(3)
    assert.deepEqual(await refreshBoard(), { ok: true })
    assert.equal(calls.length, 0)
  })
})
