// A hint whose read did not get through (#566).
//
// Realtime carries an identifier and the Worker holds what it means, so the read is where the
// alert is won or lost: a failed one used to be dropped, and with the socket joined nothing
// else was reading — the alert waited for the event to change again or for a reconnect. What
// is asked here is that a blip costs seconds, that an answer Cloud will keep giving is given
// up on at once, that a stopped center raises nobody, and that the catch-up read under a
// joined socket picks up what the wire lost without saying anything twice.
//
// The network is a fake `fetch` and the socket a fake `WebSocket`; the session, the board
// record and the bell are all the real ones, in a temporary home.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { ALL_RELEASES, defaultBoardDir, enableCloudBoard } from '../src/lib/cloud/boards.ts'
import {
  fetchCloudCenter,
  readCloudCenter,
  readHint,
  startCloudCenter,
  stopCloudCenter,
} from '../src/lib/cloud/center.ts'
import type { CloudEvent } from '../src/lib/cloud/events.ts'
import { notePublication } from '../src/lib/cloud/outbox.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { restoreMachineHome } from './helpers/board.ts'

const SUPABASE = 'https://cloud.test'
const API = 'https://api.test'
const SUBJECT = '11111111-1111-4111-8111-111111111111'

let home = ''
let root = ''
let socket: FakeSocket | null = null
let hadWebSocket: unknown

beforeEach(() => {
  hadWebSocket = (globalThis as { WebSocket?: unknown }).WebSocket
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloud-hint-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloud-board-'))
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
    subject: SUBJECT,
  })
  enableCloudBoard(defaultBoardDir(root), root, '0.8.0')
})

afterEach(() => {
  stopCloudCenter()
  mock.restoreAll()
  mock.timers.reset()
  socket = null
  const global = globalThis as { WebSocket?: unknown }
  if (hadWebSocket === undefined) delete global.WebSocket
  else global.WebSocket = hadWebSocket
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

const BOARD = () => enableCloudBoard(defaultBoardDir(root), root, '0.8.0')

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

/** A card waiting for a person, as the Worker hands it back. */
const event = (id: string, over: Partial<CloudEvent> = {}): CloudEvent =>
  ({
    id,
    boardId: BOARD().id,
    workspaceId: '',
    boardName: 'ai4kanban',
    taskId: 12,
    taskTitle: 'A task',
    release: '0.8.0',
    revision: 'r1',
    kind: 'ready_for_review',
    decision: 'implement',
    state: 'actionable',
    questions: [],
    summary: '',
    notes: '',
    serverName: '',
    createdAt: '2026-09-01T00:00:00Z',
    changedAt: '2026-09-01T00:00:00Z',
    acted: false,
    ...over,
  }) as CloudEvent

/** Cloud is there but the read did not get through. */
const unreachable = (): Response => {
  throw new TypeError('fetch failed')
}

/** A refusal `isTerminal` names — the event has been swept, and asking again cannot undo it. */
const swept = (): Response =>
  new Response(JSON.stringify({ error: { code: 'not_found', message: 'No such event.' } }), {
    status: 404,
    headers: { 'content-type': 'application/json' },
  })

/** Stand in for the Worker. `answer` decides what each call comes back with. */
function fakeCloud(answer: (url: string) => Response): string[] {
  const seen: string[] = []
  mock.method(globalThis, 'fetch', async (url: string | URL) => {
    const at = String(url)
    seen.push(at)
    return answer(at)
  })
  return seen
}

/** Let a read the retry started finish: it is several awaits deep and nobody hands it back. */
async function settle(): Promise<void> {
  for (let i = 0; i < 30; i += 1) await new Promise((done) => setImmediate(done))
}

const reads = (calls: string[], id: string) => calls.filter((c) => c.endsWith(`/v1/events/${id}`)).length
const lists = (calls: string[]) => calls.filter((c) => c.includes('/v1/events?')).length

describe('a hint whose read did not get through', () => {
  it('reads it again a second later, and the alert arrives', async () => {
    let tries = 0
    const calls = fakeCloud((url) => {
      if (!url.endsWith('/v1/events/e-1')) return ok({})
      tries += 1
      return tries === 1 ? unreachable() : ok({ event: event('e-1') })
    })
    mock.timers.enable({ apis: ['setTimeout'] })

    await readHint('e-1')
    assert.equal(reads(calls, 'e-1'), 1)
    assert.equal(readCloudCenter().alerts.length, 0, 'nothing is raised on the failed read')

    mock.timers.tick(1_000)
    await settle()

    assert.equal(reads(calls, 'e-1'), 2)
    assert.equal(readCloudCenter().alerts[0]?.eventId, 'e-1')
  })

  it('gives up after three goes, and says nothing about the hint it dropped', async () => {
    const calls = fakeCloud((url) => (url.endsWith('/v1/events/e-1') ? unreachable() : ok({})))
    mock.timers.enable({ apis: ['setTimeout'] })

    await readHint('e-1')
    for (const wait of [1_000, 2_000, 4_000]) {
      mock.timers.tick(wait)
      await settle()
    }
    // A fifth read would mean the retries never end; a fourth wait, that one is still pending.
    mock.timers.tick(60_000)
    await settle()

    assert.equal(reads(calls, 'e-1'), 4)
    const bell = readCloudCenter()
    assert.equal(bell.alerts.length, 0)
    assert.equal(bell.error, undefined, 'a given-up hint leaves the screen unchanged')
  })

  it('gives up at once on a refusal that asking again cannot change', async () => {
    const calls = fakeCloud((url) => (url.endsWith('/v1/events/e-1') ? swept() : ok({})))
    mock.timers.enable({ apis: ['setTimeout'] })

    await readHint('e-1')
    mock.timers.tick(60_000)
    await settle()

    assert.equal(reads(calls, 'e-1'), 1)
    assert.equal(readCloudCenter().alerts.length, 0)
  })

  it('drops a retry still waiting when the center stops', async () => {
    let tries = 0
    const calls = fakeCloud((url) => {
      if (!url.endsWith('/v1/events/e-1')) return ok({})
      tries += 1
      return tries === 1 ? unreachable() : ok({ event: event('e-1') })
    })
    mock.timers.enable({ apis: ['setTimeout'] })

    await readHint('e-1')
    // Signing out, or quitting.
    stopCloudCenter()
    mock.timers.tick(60_000)
    await settle()

    assert.equal(reads(calls, 'e-1'), 1, 'nothing is read for a center that is gone')
    assert.equal(readCloudCenter().alerts.length, 0)
  })
})

describe('the catch-up read under a joined socket', () => {
  it('picks up the hint the wire lost, and says nothing twice about the one it carried', async () => {
    const held = new Map<string, CloudEvent>()
    const calls = fakeCloud((url) => {
      if (url.includes('/v1/events?')) return ok({ events: [...held.values()], next: null })
      const id = url.slice(url.lastIndexOf('/') + 1)
      const one = held.get(id)
      return one ? ok({ event: one }) : swept()
    })
    mock.timers.enable({ apis: ['setTimeout', 'Date'] })
    await join()

    // The socket carried this one, so the bell already knows about it.
    held.set('e-1', event('e-1'))
    await readHint('e-1')
    await settle()

    // A second event is stored and its hint is lost on the wire. The socket is joined and
    // hears nothing more about it.
    held.set('e-2', event('e-2', { id: 'e-2', taskId: 13 }))
    const before = lists(calls)
    startCloudCenter(true)
    await settle()
    assert.equal(lists(calls), before, 'nothing is read again inside the five minutes')

    mock.timers.tick(5 * 60_000 + 1)
    startCloudCenter(true)
    await settle()

    assert.equal(lists(calls), before + 1, 'the durable read runs though the socket is joined')
    assert.match(calls.filter((c) => c.includes('/v1/events?')).at(-1) ?? '', /\?scope=open&/, 'it reads the open events alone')
    const alerts = readCloudCenter().alerts
    assert.deepEqual(
      alerts.map((a) => a.eventId),
      ['e-1', 'e-2'],
    )
  })
})

describe('the start read (#1245)', () => {
  /** A board watching every release — a named one this temporary board never cut reads as
   *  closed and stops the pass — holding one card that is not #12. */
  function board(): string {
    const id = enableCloudBoard(defaultBoardDir(root), root, ALL_RELEASES).id
    const dir = path.join(root, 'docs', 'kanban', 'todo')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, '99-other.md'),
      '---\ntitle: Other\npriority: high\nroi: high\nstatus: todo\nrelease: ""\nblocked_by: []\nrelated: []\nmodules: []\nquestions: []\n---\n\nSomething else.\n',
    )
    return id
  }

  /** Cloud holding `open`, answered a page of `size` at a time. */
  function cloudHolding(open: CloudEvent[], size = 100): string[] {
    return fakeCloud((url) => {
      if (url.includes('/v1/events?')) {
        const q = new URL(url).searchParams
        const from = Number(q.get('before') ?? 0)
        const page = open.slice(from, from + Math.min(size, Number(q.get('limit'))))
        return ok({ events: page, next: from + page.length < open.length ? String(from + page.length) : null })
      }
      const id = url.match(/\/v1\/events\/([^/]+)/)?.[1]
      const one = open.find((e) => e.id === id)
      return one ? ok({ event: one }) : ok({})
    })
  }

  it('reads the open events once, after the socket joins, and no landed history', async () => {
    const boardId = board()
    const calls = cloudHolding([event('e-1', { boardId, taskId: 99 })])
    ;(globalThis as { WebSocket?: unknown }).WebSocket = FakeSocket
    startCloudCenter(true)
    await settle()
    assert.equal(lists(calls), 0, 'nothing is read before the socket is listening')
    await join()
    const read = calls.filter((c) => c.includes('/v1/events?'))
    assert.deepEqual(read, [`${API}/v1/events?scope=open&limit=100`])
    const center = readCloudCenter()
    assert.equal(center.loading, false)
    assert.deepEqual(center.rows.map((r) => r.eventId), ['e-1'])
    assert.equal(center.alerts.length, 0, 'a start raises nobody')
  })

  it('follows the cursor when the open events fill more than one page', async () => {
    const boardId = board()
    const open = Array.from({ length: 5 }, (_, i) =>
      event(`e-${i}`, { boardId, taskId: 99, changedAt: `2026-09-01T00:0${i}:00Z` }),
    )
    const calls = cloudHolding(open, 2)
    await join()
    assert.equal(lists(calls), 3)
    assert.equal(readCloudCenter().rows.length, 5)
  })

  it('shows what the reconciliation retired as stale, from the same read', async () => {
    const boardId = board()
    // Card 12 is not on the board, so its row asks about nothing.
    const calls = cloudHolding([event('e-1', { boardId, taskId: 12 })])
    await join()
    await settle()
    assert.equal(lists(calls), 1, 'the reconciliation and the bell share one read')
    assert.ok(calls.some((c) => c.endsWith('/v1/events/e-1/retire')))
    assert.ok(
      calls.findIndex((c) => c.endsWith('/retire')) > calls.findIndex((c) => c.includes('/v1/events?')),
      'the outbox is sent after the read',
    )
    const center = await fetchCloudCenter({ todo: 30, landed: 0, cards: [12] })
    assert.deepEqual(center.cards?.map((r) => r.state), ['stale'])
    assert.deepEqual(center.rows.filter((r) => r.onRail), [])
  })

  it('raises nobody when the ending it wrote off comes back as a hint', async () => {
    const boardId = board()
    notePublication(12, 'e-1', 'accepted')
    const abandoned = event('e-1', {
      boardId,
      state: 'accepted',
      acted: true,
      changedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    })
    const calls = cloudHolding([abandoned])
    await join()
    await settle()
    assert.ok(calls.some((c) => c.endsWith('/v1/events/e-1/outcome')), 'it was written off')
    mock.method(globalThis, 'fetch', async () => ok({ event: { ...abandoned, state: 'interrupted' } }))
    await readHint('e-1')
    assert.equal(readCloudCenter().alerts.length, 0)
  })
})

// ---- the fake socket --------------------------------------------------------

class FakeSocket {
  onopen: (() => void) | null = null
  onmessage: ((message: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  sent: { topic: string; event: string }[] = []

  constructor(public url: string) {
    socket = this
  }

  send(raw: string): void {
    this.sent.push(JSON.parse(raw) as { topic: string; event: string })
  }

  close(): void {}
}

/** Open the center on a socket that really joins, and let its first, silent catch-up read
 *  finish — which is the state every test above starts from. */
async function join(): Promise<void> {
  ;(globalThis as { WebSocket?: unknown }).WebSocket = FakeSocket
  startCloudCenter(true)
  await settle()
  assert.ok(socket, 'the center opened a socket')
  socket.onopen?.()
  await settle()
  socket.onmessage?.({
    data: JSON.stringify({ topic: `realtime:account:${SUBJECT}`, event: 'phx_reply', payload: { status: 'ok' } }),
  })
  await settle()
}
