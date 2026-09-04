// The request a board's server claims, under the failures it will actually meet (#329).
//
// #318 got a press taken anywhere else to the machine that holds the board. What is asked
// here is what happens when that machine is not in the state Cloud believes: a card rewritten
// between the press and the claim, a machine that slept past its lease and came back with the
// delivery still running, a server row disabled from somewhere else, and a board taken over
// by a second machine while a delivery is going here.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { cloudBoardFor, enableCloudBoard, setCloudBoardServer } from '../src/lib/cloud/boards.ts'
import { heldClaims, holdClaim, notePublication, readOutbox } from '../src/lib/cloud/outbox.ts'
import {
  cancelCloudRequest,
  catchUpCloudRequests,
  refuseStart,
  renewCloudClaims,
  resumeCloudRequest,
  type CloudRequest,
} from '../src/lib/cloud/requests.ts'
import { readBoardServer } from '../src/lib/cloud/servers.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { thisMachine } from '../src/lib/machine/identity.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Card } from '../src/lib/view/types.ts'

const SUPABASE = 'https://cloud.test'
const API = 'https://api.test'
const SERVER = 's-1'

let home = ''
let root = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloud-req-home-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloud-req-board-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon'
  process.env.AI4KANBAN_CLOUD_URL = API
  setBoardRoot(root)
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'a-token',
    refreshToken: 'r-token',
    expiresAt: Date.now() + 60 * 60_000,
    subject: '11111111-1111-4111-8111-111111111111',
  })
  enableCloudBoard(root, '0.8.0')
  setCloudBoardServer(root, SERVER)
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

const card = (over: Partial<Card> = {}): Card =>
  ({
    id: 12,
    revision: 'r1',
    relPath: 'features/12-a.md',
    title: 'A task',
    priority: 'high',
    roi: 'high',
    status: 'ready',
    release: '0.8.0',
    blocked_by: [],
    related: [],
    questions: [],
    verify: [],
    modules: [],
    last_run: '',
    cadence: '',
    schedule: null,
    body: '',
    todos: { total: 0, done: 0 },
    ...over,
  }) as Card

const request = (over: Partial<CloudRequest> = {}): CloudRequest => ({
  id: 'req-1',
  boardId: cloudBoardFor(root)!.id,
  eventId: 'e-1',
  serverId: SERVER,
  claimedBy: SERVER,
  state: 'interrupted',
  leaseExpiresAt: null,
  taskId: 12,
  taskTitle: 'A task',
  revision: 'r1',
  decision: 'implement',
  answers: [],
  questions: [],
  ...over,
})

/** A delivery this machine is carrying right now, as the board's own record holds it. */
function deliveryRunning(cardId: number): void {
  fs.writeFileSync(
    path.join(root, 'docs', 'kanban', '.sessions.json'),
    JSON.stringify({
      runs: [],
      deliveries: [
        {
          deliveryId: 'd-1',
          cardId,
          status: 'active',
          branch: 'card/12/abcd',
          worktree: path.join(root, '.akb', 'worktrees', '12', 'abcd'),
          startedAt: Date.now(),
          stage: 'implement',
        },
      ],
      marks: {},
    }),
  )
}

/** Stand in for the Worker. */
function fakeCloud(answer: (url: string, body: unknown) => unknown): string[] {
  const seen: string[] = []
  mock.method(globalThis, 'fetch', async (url: string | URL, init?: RequestInit) => {
    const at = String(url)
    seen.push(at)
    return new Response(JSON.stringify(answer(at, init?.body ? JSON.parse(String(init.body)) : undefined)), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  return seen
}

describe('a task edited, resolved or moved after its message was created', () => {
  it('refuses a card whose revision has moved', () => {
    assert.match(
      String(refuseStart(card({ revision: 'r2' }), request())),
      /has changed since this was approved/,
    )
  })

  it('refuses a card that has left the board', () => {
    assert.match(String(refuseStart(null, request())), /no longer on this board/)
  })

  it('refuses a build on a card that is no longer ready', () => {
    assert.match(String(refuseStart(card({ status: 'todo' }), request())), /no longer ready to build/)
  })

  it('refuses an answer whose questions have changed', () => {
    const asking = card({
      status: 'todo',
      questions: [{ text: '[user] Which one?', options: [], recommend: [], mode: 'single' }],
    } as Partial<Card>)
    const refused = refuseStart(asking, request({ decision: 'answer', questions: [{ text: 'A different one' }] }))
    assert.match(String(refused), /open questions on #12 have changed/)
  })

  it('runs the one that still matches', () => {
    assert.equal(refuseStart(card(), request()), null)
  })
})

describe('a restart that finds an answer waiting', () => {
  it('claims it as the machine comes back up, and reports why it cannot run it', async () => {
    // The press landed in Slack while this machine was off, so its request is `waiting`. The
    // card it was granted against has since left the board.
    notePublication(12, 'e-1', 'actionable')
    const seen: string[] = []
    fakeCloud((url) => {
      seen.push(url)
      if (url.endsWith('/requests')) return { requests: [request({ state: 'waiting', claimedBy: null })] }
      if (url.endsWith('/claim')) return { claimed: true }
      return {}
    })

    await catchUpCloudRequests(root)

    assert.ok(seen.some((c) => c.endsWith('/claim')), 'the waiting request was claimed')
    // A claim that starts nothing and says nothing would sit there until its lease ran out.
    const outcomes = readOutbox().pending.filter((p) => p.kind === 'outcome')
    assert.equal(outcomes.length, 1)
    assert.equal(outcomes[0]?.kind === 'outcome' && outcomes[0].outcome, 'failed')
    assert.match(String(outcomes[0]?.kind === 'outcome' ? outcomes[0].reason : ''), /no longer on this board/)
    assert.deepEqual(heldClaims(), [], 'and the claim is let go rather than renewed forever')
  })

  it('leaves a request another machine is running alone', async () => {
    const seen: string[] = []
    fakeCloud((url) => {
      seen.push(url)
      if (url.endsWith('/requests')) return { requests: [request({ state: 'claimed' })] }
      return {}
    })

    await catchUpCloudRequests(root)

    assert.ok(!seen.some((c) => c.endsWith('/claim')), 'a live claim is never taken a second time')
  })
})

describe('a machine that slept past its lease and came back with its delivery still running', () => {
  it('takes the request back up without starting a second build', async () => {
    deliveryRunning(12)
    notePublication(12, 'e-1', 'running')
    holdClaim({ requestId: 'req-1', eventId: 'e-1', taskId: 12, decision: 'implement' })
    fakeCloud((url) => {
      if (url.endsWith('/requests')) return { requests: [request()] }
      if (url.endsWith('/claim')) return { claimed: true }
      return {}
    })

    const done = await resumeCloudRequest('e-1', root)

    assert.deepEqual(done, { ok: true })
    // `running` again, rather than the `failed` a second start over a card this checkout no
    // longer holds would have reported.
    const outcomes = readOutbox().pending.filter((p) => p.kind === 'outcome')
    assert.deepEqual(
      outcomes.map((p) => (p.kind === 'outcome' ? p.outcome : '')),
      ['running'],
    )
    assert.equal(heldClaims().length, 1)
  })

  it('is refused on a machine that no longer runs the board', async () => {
    setCloudBoardServer(root, '')
    const calls = fakeCloud(() => ({}))
    const done = await resumeCloudRequest('e-1', root)
    assert.equal(done.ok, false)
    assert.deepEqual(calls, [], 'nothing is asked of Cloud at all')
  })
})

describe('cancelling what a killed server left', () => {
  it('records the cancellation and lets the claim go', () => {
    notePublication(12, 'e-1', 'running')
    holdClaim({ requestId: 'req-1', eventId: 'e-1', taskId: 12, decision: 'implement' })

    assert.deepEqual(cancelCloudRequest(12, 'e-1'), { ok: true })

    const outcomes = readOutbox().pending.filter((p) => p.kind === 'outcome')
    assert.deepEqual(
      outcomes.map((p) => (p.kind === 'outcome' ? p.outcome : '')),
      ['cancelled'],
    )
    assert.deepEqual(heldClaims(), [])
  })

  it('works on a machine that never claimed it — the one that did may be the one that has gone', () => {
    assert.deepEqual(cancelCloudRequest(12, 'e-9'), { ok: true })
    assert.equal(readOutbox().published['12']?.eventId, 'e-9')
  })
})

describe('a claim this board is no longer working', () => {
  it('is let go rather than renewed forever', async () => {
    notePublication(12, 'e-1', 'running')
    holdClaim({ requestId: 'req-1', eventId: 'e-1', taskId: 12, decision: 'implement' })
    // No delivery on this card: the server died, or the delivery ended without reporting.
    const calls = fakeCloud(() => ({ renewed: true }))

    await renewCloudClaims(root)

    assert.deepEqual(heldClaims(), [])
    assert.deepEqual(calls, [], 'a claim nobody is working costs no write')
  })

  it('is let go when Cloud says this machine no longer holds it', async () => {
    deliveryRunning(12)
    notePublication(12, 'e-1', 'running')
    holdClaim({ requestId: 'req-1', eventId: 'e-1', taskId: 12, decision: 'implement' })
    fakeCloud(() => ({ renewed: false }))

    await renewCloudClaims(root)

    assert.deepEqual(heldClaims(), [])
  })

  it('is renewed while the delivery it covers is still going', async () => {
    deliveryRunning(12)
    notePublication(12, 'e-1', 'running')
    holdClaim({ requestId: 'req-1', eventId: 'e-1', taskId: 12, decision: 'implement' })
    const calls = fakeCloud(() => ({ renewed: true }))

    await renewCloudClaims(root)

    assert.equal(heldClaims().length, 1)
    assert.ok(calls.some((c) => c.endsWith('/renew')))
  })
})

describe('a board taken over by a second machine', () => {
  it('stops claiming as soon as it next looks, and the delivery here is untouched', async () => {
    deliveryRunning(12)
    const boardId = cloudBoardFor(root)!.id
    fakeCloud(() => ({
      servers: [{ id: 's-2', boardId, machineId: 'another-machine', machineName: 'the-other', enabled: true }],
    }))

    const server = await readBoardServer(root)

    assert.equal(server.attached, true)
    assert.equal(server.here, false)
    assert.equal(server.machineName, 'the-other')
    assert.ok(!cloudBoardFor(root)?.serverId, 'this machine drops its own server row')
  })

  it('keeps holding the board when Cloud still names this machine', async () => {
    const boardId = cloudBoardFor(root)!.id
    const machine = thisMachine()!
    fakeCloud(() => ({
      servers: [{ id: SERVER, boardId, machineId: machine.id, machineName: machine.name, enabled: true }],
    }))

    const server = await readBoardServer(root)

    assert.equal(server.here, true)
    assert.equal(cloudBoardFor(root)?.serverId, SERVER)
  })
})

describe('a machine that is signed out', () => {
  it('runs no board’s work, whatever its record says', async () => {
    fs.rmSync(path.join(home, 'session.json'))
    const calls = fakeCloud(() => ({}))

    await renewCloudClaims(root)
    const done = await resumeCloudRequest('e-1', root)

    assert.equal(done.ok, false)
    assert.deepEqual(calls, [])
  })
})
