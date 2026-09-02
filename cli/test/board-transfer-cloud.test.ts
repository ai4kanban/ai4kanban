// Carrying a board into a workspace and writing one back out, over the network (#315).
//
// `board-content.test.ts` checks the two pure halves — what a board packs into and what a
// payload writes back out. What is asked here is the half with the Worker in between, which
// is where the three things a passing round trip depends on live: a resumed import writing
// each file against the revision the workspace already holds, an export naming each delivery
// by the id the machine that ran it gave it, and `--to` being named rather than guessed at.
//
// The network is a fake `fetch` and nothing else is mocked.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { cmdCloud } from '../src/commands/cloud.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { exportBoard, importBoard } from '../src/lib/cloud/workspace-board.ts'
import { setBoardRoot } from '../src/lib/paths.ts'

const SUPABASE = 'https://cloud.test'
const API = 'https://api.test'
const WORKSPACE = 'ws-1'

let home = ''
let root = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-transfer-home-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-transfer-board-'))
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

afterEach(() => {
  mock.restoreAll()
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  delete process.env.AI4KANBAN_HOME
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

/** Every call the fake Worker was given, in order. */
interface Sent {
  url: string
  body: Record<string, unknown> | undefined
}

/** Stand in for the Worker. `answer` decides what each call comes back with. */
function fakeCloud(answer: (url: string, body: Record<string, unknown> | undefined) => Response): Sent[] {
  const seen: Sent[] = []
  mock.method(globalThis, 'fetch', async (url: string | URL, init?: RequestInit) => {
    const at = String(url)
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined
    seen.push({ url: at, body })
    return answer(at, body)
  })
  return seen
}

function write(rel: string, body: string): void {
  const file = path.join(root, 'docs', 'kanban', rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
}

const workspace = {
  id: WORKSPACE,
  name: 'A board',
  revision: '7',
  nextCardId: 44,
  createdAt: 'then',
  updatedAt: 'now',
}

describe('carrying a board into a workspace', () => {
  beforeEach(() => {
    write('next-id', '44\n')
    write('config.md', '# Project\n')
    write('memory/readme.md', '# What shipped\n')
  })

  it('writes each file against the revision a half-finished import already left', async () => {
    // The workspace was claimed and its documents written; the pass after that never landed.
    const sent = fakeCloud((url) => {
      if (url.endsWith('/import/begin')) return ok({ fingerprint: 'board-x', resuming: true, held: {} })
      if (url.endsWith(`/workspaces/${WORKSPACE}/export`)) {
        return ok({
          revision: '7',
          workspace,
          cards: [],
          documents: [
            { path: 'config.md', kind: 'config', body: '# Project\n', revision: '3' },
            { path: 'memory/readme.md', kind: 'memory', body: '# What shipped\n', revision: '1' },
          ],
          deliveries: [],
        })
      }
      if (url.endsWith('/import/finish')) return ok({ workspace, held: {} })
      return ok({ revision: '8', added: 0, cards: [], documents: [] })
    })

    const res = await importBoard(WORKSPACE)
    assert.ok(res.ok, res.ok ? '' : res.error)

    const write = sent.find((call) => call.url.endsWith(`/workspaces/${WORKSPACE}/documents`))
    assert.ok(write, 'no document was written')
    const at = new Map(
      (write.body?.documents as { path: string; expect: string }[]).map((doc) => [doc.path, doc.expect]),
    )
    // A document written with no expected revision is refused as a conflict with the
    // workspace's own earlier pass, which is what made a retried import unfinishable.
    assert.equal(at.get('config.md'), '3')
    assert.equal(at.get('memory/readme.md'), '1')
  })

  it('creates each file on a first import, expecting nothing to be there', async () => {
    const sent = fakeCloud((url) => {
      if (url.endsWith('/import/begin')) return ok({ fingerprint: 'board-x', resuming: false, held: {} })
      if (url.endsWith('/import/finish')) return ok({ workspace, held: {} })
      return ok({ revision: '8', added: 0, cards: [], documents: [] })
    })

    const res = await importBoard(WORKSPACE)
    assert.ok(res.ok, res.ok ? '' : res.error)
    const write = sent.find((call) => call.url.endsWith(`/workspaces/${WORKSPACE}/documents`))
    const expects = (write?.body?.documents as { expect: string }[]).map((doc) => doc.expect)
    assert.deepEqual(new Set(expects), new Set(['']))
    // And nothing read the workspace back: an import that is starting has nothing to read.
    assert.equal(sent.some((call) => call.url.endsWith(`/workspaces/${WORKSPACE}/export`)), false)
  })
})

describe('writing a workspace back out', () => {
  const delivery = {
    id: '9c1d7f2e-0000-4000-8000-000000000000',
    cardId: 12,
    record: { deliveryId: '2yfmw37a', cardId: 12, status: 'landed' },
    approved: '# the card as approved',
    finalBody: '',
  }

  const exported = () =>
    ok({
      revision: '7',
      workspace,
      cards: [],
      documents: [{ path: 'config.md', kind: 'config', body: '# Project\n', revision: '3' }],
      deliveries: [delivery],
    })

  it('names each delivery by the id the machine that ran it gave it', async () => {
    fakeCloud((url) => (url.includes('/export/events') ? ok({ events: [] }) : exported()))

    const to = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-transfer-out-'))
    try {
      const res = await exportBoard(WORKSPACE, to)
      assert.ok(res.ok, res.ok ? '' : res.error)
      const file = path.join(to, 'docs', 'kanban', 'deliveries', '2yfmw37a.json')
      assert.ok(fs.existsSync(file), 'the delivery was not written under its own id')
      const written = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
      assert.equal(written.approved, '# the card as approved')
      assert.equal(fs.existsSync(path.join(to, 'docs', 'kanban', 'deliveries', 'undefined.json')), false)
    } finally {
      fs.rmSync(to, { recursive: true, force: true })
    }
  })

  it('falls back to the workspace’s own id when the record carries none', async () => {
    fakeCloud((url) =>
      url.includes('/export/events')
        ? ok({ events: [] })
        : ok({
            revision: '7',
            workspace,
            cards: [],
            documents: [],
            deliveries: [{ ...delivery, record: { cardId: 12, status: 'landed' } }],
          }),
    )

    const to = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-transfer-out-'))
    try {
      assert.ok((await exportBoard(WORKSPACE, to)).ok)
      assert.ok(fs.existsSync(path.join(to, 'docs', 'kanban', 'deliveries', `${delivery.id}.json`)))
    } finally {
      fs.rmSync(to, { recursive: true, force: true })
    }
  })

  it('asks for the folder rather than guessing one', async () => {
    fakeCloud((url) => (url.includes('/export/events') ? ok({ events: [] }) : exported()))

    // An export writes a board rather than reading one, so there is no project it is about
    // and nothing to default `--to` to — including the board this command was run inside,
    // which it would only ever be refused for already holding one.
    await assert.rejects(cmdCloud(['export', WORKSPACE], 'akb'), /--to <folder>/)
  })

  it('writes into the folder --to names, with no board of its own to read', async () => {
    fakeCloud((url) => (url.includes('/export/events') ? ok({ events: [] }) : exported()))

    // Nothing under `root` — the machine holding this workspace's only copy is exactly the
    // one whose board is gone, so needing one to restore one would be circular.
    assert.equal(fs.existsSync(path.join(root, 'docs', 'kanban')), false)
    const to = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-transfer-out-'))
    try {
      const res = (await cmdCloud(['export', WORKSPACE, '--to', to], 'akb')) as { exported: { dir: string } }
      assert.equal(res.exported.dir, path.join(to, 'docs', 'kanban'))
    } finally {
      fs.rmSync(to, { recursive: true, force: true })
    }
  })
})
