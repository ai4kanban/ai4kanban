// The outbox under the failures it will actually meet (#329).
//
// #319 made a publication durable before it is sent. What is asked here is what happens when
// the send does not get through: a board write made while Cloud is unreachable, a queue that
// drains once Cloud comes back on a board nobody writes to again, an item that runs out of
// attempts, a click pressed twice, and the first fill of a board that already holds more
// actionable cards than one pass should ever send.
//
// The network is a fake `fetch` and nothing else is mocked: the outbox file, the board record
// and the session are all the real ones, in a temporary home.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { withStore } from '../src/lib/agent/store.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { ALL_RELEASES, enableCloudBoard } from '../src/lib/cloud/boards.ts'
import { startCloudServer, stopCloudServer } from '../src/lib/cloud/board-server.ts'
import type { CloudEventState } from '../src/lib/cloud/events.ts'
import { duePending, notePublication, queue, readOutbox, unsentToCloud, type Pending } from '../src/lib/cloud/outbox.ts'
import {
  flushCloudOutbox,
  publishBoardEvents,
  recordCloudActionFor,
  recordBoardEvents,
  reportCloudRunEnd,
} from '../src/lib/cloud/publish.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { snapshotFor } from '../src/lib/cloud/snapshot.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import type { Card } from '../src/lib/view/types.ts'

const SUPABASE = 'https://cloud.test'
const API = 'https://api.test'

let home = ''
let root = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloud-outbox-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloud-board-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon'
  process.env.AI4KANBAN_CLOUD_URL = API
  setBoardRoot(root)
  signIn()
})

afterEach(() => {
  mock.restoreAll()
  stopCloudServer()
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  delete process.env.AI4KANBAN_HOME
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

function signIn(): void {
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'a-token',
    refreshToken: 'r-token',
    // Far enough out that nothing here ever refreshes.
    expiresAt: Date.now() + 60 * 60_000,
    subject: '11111111-1111-4111-8111-111111111111',
  })
}

const BOARD = () => enableCloudBoard(root, '0.8.0')

function card(over: Partial<Card> = {}): Card {
  return {
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
    body: 'What it is for.\n',
    todos: { total: 0, done: 0 },
    ...over,
  } as Card
}

/** Queue one publication for a card, exactly as the publisher would. */
function queuePublish(id: number): Pending {
  const snapshot = snapshotFor(card({ id }), BOARD())
  assert.ok(snapshot)
  const item: Pending = { opId: `op-${id}`, kind: 'publish', attempts: 0, snapshot }
  queue(item)
  return item
}

/** Stand in for the Worker. `answer` decides what each call comes back with. */
function fakeCloud(answer: (url: string, body: unknown) => Response): string[] {
  const seen: string[] = []
  mock.method(globalThis, 'fetch', async (url: string | URL, init?: RequestInit) => {
    const at = String(url)
    seen.push(at)
    return answer(at, init?.body ? JSON.parse(String(init.body)) : undefined)
  })
  return seen
}

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

const publishedEvent = (id: string, taskId: number) =>
  ok({ event: { id, boardId: BOARD().id, taskId, state: 'actionable', changedAt: 'now', acted: false } })

const unreachable = (): Response => {
  throw new TypeError('fetch failed')
}

describe('a board change made while Cloud is unreachable', () => {
  it('is queued, and stays queued with the attempt spent', async () => {
    BOARD()
    queuePublish(12)
    fakeCloud(unreachable)

    await flushCloudOutbox()

    const [held] = readOutbox().pending
    assert.equal(held?.opId, 'op-12')
    assert.equal(held?.attempts, 1)
    assert.match(String(held?.lastError), /could not be reached/)
  })

  it('waits out its backoff rather than spending every attempt on one outage', async () => {
    BOARD()
    queuePublish(12)
    fakeCloud(unreachable)

    await flushCloudOutbox()
    await flushCloudOutbox()
    await flushCloudOutbox()

    // One attempt, not three: the second and third passes found it inside its backoff.
    assert.equal(readOutbox().pending[0]?.attempts, 1)
    assert.equal(duePending().length, 0)
    assert.equal(duePending(Date.now() + 61_000).length, 1)
  })

  it('reaches Cloud on a board that makes no further write, from the board’s own tick', async () => {
    BOARD()
    queuePublish(12)
    fakeCloud(unreachable)
    await flushCloudOutbox()
    assert.equal(readOutbox().pending.length, 1)

    // Cloud is back, and nothing writes to the board again. The tick the local UI server
    // makes every minute is the only thing left that can send it.
    const calls = fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    // Past the first backoff, so the item is due.
    const held = readOutbox()
    held.pending[0]!.nextAt = Date.now() - 1
    fs.writeFileSync(path.join(root, '.akb', 'cloud-outbox.json'), `${JSON.stringify(held, null, 2)}\n`)

    startCloudServer(root)
    await flushCloudOutbox()

    assert.ok(calls.some((c) => c.endsWith('/v1/events')))
    assert.equal(readOutbox().pending.length, 0)
    assert.equal(readOutbox().published['12']?.eventId, 'e-1')
  })
})

describe('a queued item whose attempts have run out', () => {
  it('is not abandoned in silence — the board says it is out of step with Cloud', async () => {
    BOARD()
    const item = queuePublish(12)
    fakeCloud(unreachable)

    // Every attempt but the last, spent.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const held = readOutbox()
      const queued = held.pending.find((p) => p.opId === item.opId)
      if (!queued) break
      queued.nextAt = Date.now() - 1
      fs.writeFileSync(path.join(root, '.akb', 'cloud-outbox.json'), `${JSON.stringify(held, null, 2)}\n`)
      await flushCloudOutbox()
    }

    assert.equal(readOutbox().pending.length, 0)
    const [unsent] = unsentToCloud()
    assert.equal(unsent?.kind, 'publish')
    assert.equal(unsent?.taskId, 12)
    assert.match(String(unsent?.error), /could not be reached/)
  })

  it('stops saying so once a send about the same thing gets through', async () => {
    BOARD()
    queuePublish(12)
    fakeCloud(unreachable)
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const held = readOutbox()
      const queued = held.pending[0]
      if (!queued) break
      queued.nextAt = Date.now() - 1
      fs.writeFileSync(path.join(root, '.akb', 'cloud-outbox.json'), `${JSON.stringify(held, null, 2)}\n`)
      await flushCloudOutbox()
    }
    assert.equal(unsentToCloud().length, 1)

    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    queuePublish(12)
    await flushCloudOutbox()

    assert.deepEqual(unsentToCloud(), [])
  })
})

/** Spend every attempt on whatever is queued, ignoring the backoff between them. */
async function exhaust(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const held = readOutbox()
    const queued = held.pending[0]
    if (!queued) break
    queued.nextAt = Date.now() - 1
    fs.writeFileSync(path.join(root, '.akb', 'cloud-outbox.json'), `${JSON.stringify(held, null, 2)}\n`)
    await flushCloudOutbox()
  }
}

describe('an outcome that never got out', () => {
  it('stops being reported once a later outcome for the same event lands', async () => {
    BOARD()
    notePublication(12, 'e-1', 'accepted')
    queue({ opId: 'op-running', kind: 'outcome', attempts: 0, eventId: 'e-1', outcome: 'running' })
    fakeCloud(unreachable)
    await exhaust()

    assert.equal(unsentToCloud().length, 1, 'the state Cloud never heard about is written down')

    // The delivery ends after Cloud comes back. Cloud now holds where it ended, so the board
    // is no longer out of step over the `running` it missed.
    fakeCloud(() => ok({ event: { id: 'e-1', taskId: 12, state: 'completed', changedAt: 'now', acted: true } }))
    queue({ opId: 'op-done', kind: 'outcome', attempts: 0, eventId: 'e-1', outcome: 'completed' })
    await flushCloudOutbox()

    assert.deepEqual(unsentToCloud(), [])
  })
})

describe('the first fill of a board that already holds many actionable cards', () => {
  it('sends a bounded number in one pass and the rest on the next', async () => {
    BOARD()
    for (let id = 1; id <= 45; id += 1) queuePublish(id)

    let sent = 0
    fakeCloud((url) => {
      if (!url.endsWith('/v1/events')) return ok({})
      sent += 1
      return publishedEvent(`e-${sent}`, sent)
    })

    await flushCloudOutbox()
    assert.equal(sent, 20, 'one pass sends at most twenty')
    assert.equal(readOutbox().pending.length, 25)

    await flushCloudOutbox()
    assert.equal(sent, 40)

    await flushCloudOutbox()
    assert.equal(sent, 45, 'nothing is dropped — the rest go out on later passes')
    assert.equal(readOutbox().pending.length, 0)
  })
})

describe('the same button pressed twice', () => {
  it('records one action, and the second press queues nothing', async () => {
    BOARD()
    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    queuePublish(12)
    await flushCloudOutbox()

    recordCloudActionFor(12, 'implement', 'r1')
    const first = readOutbox().pending.filter((p) => p.kind === 'action')
    assert.equal(first.length, 1)

    recordCloudActionFor(12, 'implement', 'r1')
    const second = readOutbox().pending.filter((p) => p.kind === 'action')
    assert.equal(second.length, 1, 'the second press finds the event no longer actionable here')
    assert.equal(second[0]?.opId, first[0]?.opId)
  })
})

describe('an answer approved on this machine', () => {
  it('lets go of its event when the run it started ends, so the card can be raised again', async () => {
    BOARD()
    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    queuePublish(12)
    await flushCloudOutbox()
    recordCloudActionFor(12, 'answer', 'r1')
    assert.equal(readOutbox().published['12']?.state, 'accepted')

    // No claim: a click on this machine leaves none — that is what a request approved
    // somewhere else leaves. Without this the event stays `accepted` for good, and the
    // publisher may never refresh it.
    await reportCloudRunEnd('s-1', 12, 'completed')

    assert.equal(readOutbox().published['12']?.state, 'completed')
    const outcome = readOutbox().pending.find((p) => p.kind === 'outcome')
    assert.equal(outcome?.kind === 'outcome' && outcome.eventId, 'e-1')
  })

  it('holds on while a run is still working the card', async () => {
    BOARD()
    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    queuePublish(12)
    await flushCloudOutbox()
    recordCloudActionFor(12, 'answer', 'r1')
    working(12)

    await reportCloudRunEnd('s-1', 12, 'completed')

    assert.equal(readOutbox().published['12']?.state, 'accepted', 'the action is not over yet')
  })
})

describe('an action nothing on this board is carrying any more', () => {
  const ENDED = '/v1/events/e-1/outcome'

  /** The reconciliation at start, against a Cloud holding one event for card 12. The board
   *  watches every release: this temporary one has cut none, so a named release would read
   *  as closed and stop the pass before it reconciles. */
  async function reconcileAgainst(over: Record<string, unknown> = {}): Promise<string[]> {
    const held = enableCloudBoard(root, ALL_RELEASES)
    writeCardFile()
    notePublication(12, 'e-1', (over.state as CloudEventState) ?? 'accepted')
    const event = {
      id: 'e-1',
      boardId: held.id,
      taskId: 12,
      state: 'accepted',
      acted: true,
      changedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
      ...over,
    }
    const calls = fakeCloud((url, body) => {
      if (url.endsWith('/v1/events') && body === undefined) return ok({ events: [event] })
      if (url.endsWith('/v1/events')) return publishedEvent('e-2', 12)
      return ok({ event: { ...event, state: 'interrupted' } })
    })
    await publishBoardEvents({ reconcile: true })
    return calls
  }

  it('is written off at start, so the card it was granted against can be raised again', async () => {
    // Ended, not retired: Cloud will not retire an event somebody acted on, and only an
    // ended one lets the publisher raise the card afresh.
    assert.ok((await reconcileAgainst()).some((c) => c.endsWith(ENDED)))
  })

  it('is left alone while a run is still working the card', async () => {
    working(12)
    assert.ok(!(await reconcileAgainst()).some((c) => c.endsWith(ENDED)))
  })

  it('is left alone in the moment between a click and the run it starts', async () => {
    const calls = await reconcileAgainst({ changedAt: new Date().toISOString() })
    assert.ok(!calls.some((c) => c.endsWith(ENDED)))
  })

  it('leaves a decision waiting for a server where it is — that is what it says', async () => {
    const calls = await reconcileAgainst({ state: 'waiting_for_server' })
    assert.ok(!calls.some((c) => c.endsWith(ENDED)))
  })

  it('leaves another machine’s click to that machine, on a board checked out twice', async () => {
    // Nothing on record here: this publisher never made that click, so finishing it is not
    // its to do — and it cannot see the run carrying it.
    const calls = await reconcileAgainst({ id: 'e-9' })
    assert.ok(!calls.some((c) => c.endsWith('/v1/events/e-9/outcome')))
  })
})

/** The card `card()` describes, on disk, so the publisher has a board to read. */
function writeCardFile(release = '0.8.0'): void {
  const dir = path.join(root, 'docs', 'kanban', 'todo', 'features')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, '12-a-task.md'),
    [
      '---',
      'title: A task',
      'priority: high',
      'roi: high',
      'status: ready',
      `release: "${release}"`,
      'blocked_by: []',
      'related: []',
      'modules: []',
      'questions: []',
      'verify: []',
      '---',
      '',
      'What it is for.',
      '',
    ].join('\n'),
  )
}

/** Write down a live run on a card, the way `openRun` would. */
function working(cardId: number): void {
  withStore((store) =>
    store.runs.push({
      sessionId: `s-${cardId}`,
      cardId,
      action: 'resolve',
      status: 'running',
      startedAt: Date.now(),
      pid: process.pid,
      harness: 'claude-code',
      logPath: path.join(root, 'docs', 'kanban', '.sessions', `s-${cardId}.log`),
    } as RunRecord),
  )
}

describe('what a publication carries', () => {
  it('holds the event snapshot and nothing about the repository', () => {
    const snapshot = snapshotFor(
      card({
        relPath: 'features/12-a.md',
        body: 'What it is for.\n\n## Worth noting\n- **A note**: worth reading.\n',
      }),
      BOARD(),
    )
    assert.ok(snapshot)
    assert.deepEqual(Object.keys(snapshot).sort(), [
      'boardId',
      'boardName',
      'decision',
      'fingerprint',
      'kind',
      'notes',
      'questions',
      'release',
      'revision',
      'summary',
      'taskId',
      'taskTitle',
    ])
    const wire = JSON.stringify(snapshot)
    assert.ok(!wire.includes('features/12-a.md'), 'no path on the machine ever travels')
    assert.ok(!wire.includes(root), 'nor the checkout it lives in')
  })

  it('carries no branch, worktree or credential a card happens to be near', async () => {
    BOARD()
    fs.mkdirSync(path.join(root, 'docs', 'kanban'), { recursive: true })
    const sent: unknown[] = []
    fakeCloud((url, body) => {
      if (!url.endsWith('/v1/events')) return ok({})
      sent.push(body)
      return publishedEvent('e-1', 12)
    })
    queuePublish(12)
    await flushCloudOutbox()

    const [body] = sent as Array<Record<string, unknown>>
    assert.deepEqual(Object.keys(body ?? {}).sort(), [
      'boardId',
      'boardName',
      'decision',
      'fingerprint',
      'kind',
      'notes',
      'opId',
      'questions',
      'release',
      'revision',
      'summary',
      'taskId',
      'taskTitle',
    ])
  })
})

describe('a sign-in that ran out mid-delivery', () => {
  it('keeps what was queued rather than dropping it — signing in again is what fixes it', async () => {
    BOARD()
    queuePublish(12)
    // The access token has run out and Auth refuses the refresh token: the sign-in is over.
    writeSession({
      version: 1,
      supabaseUrl: SUPABASE,
      accessToken: 'a-token',
      refreshToken: 'r-token',
      expiresAt: Date.now() - 1,
      subject: '11111111-1111-4111-8111-111111111111',
    })
    const calls = fakeCloud((url) =>
      url.includes('/auth/v1/token')
        ? new Response(JSON.stringify({ error_description: 'Invalid Refresh Token' }), { status: 400 })
        : ok({}),
    )

    await flushCloudOutbox()

    assert.ok(calls.some((c) => c.includes('/auth/v1/token')))
    assert.ok(!calls.some((c) => c.endsWith('/v1/events')), 'nothing is sent without a token')
    const [held] = readOutbox().pending
    assert.equal(held?.attempts, 1, 'the publication waits for the next sign-in')
    assert.deepEqual(unsentToCloud(), [])
  })
})

// A revision is a hash of the whole card file, so any edit moves it — and #319 hashed the
// revision into the fingerprint, which made every edit news. Resetting a card's `release`
// re-marked its row unread over a change nobody was waiting on (#182).
describe('an edit the event cannot see', () => {
  /** The board on every release, one card published, and what the outbox holds for it. */
  async function published(): Promise<{ fingerprint: string; revision: string }> {
    const watching = enableCloudBoard(root, ALL_RELEASES)
    writeCardFile()
    // Not `publishedEvent`: that helper re-enables the board on one release, and this is
    // about a board watching all of them.
    const event = { id: 'e-1', boardId: watching.id, taskId: 12, state: 'actionable', changedAt: 'now', acted: false }
    fakeCloud((url) => (url.endsWith('/v1/events') ? ok({ event }) : ok({})))
    await publishBoardEvents()
    const held = readOutbox().published['12']
    assert.ok(held, 'the card was never published')
    return { fingerprint: held.fingerprint, revision: held.revision ?? '' }
  }

  it('sends the revision through without asking anybody to look again', async () => {
    const before = await published()
    writeCardFile('')

    await recordBoardEvents()

    const [queued] = readOutbox().pending
    assert.equal(queued?.kind, 'publish')
    assert.equal(
      queued?.kind === 'publish' ? queued.snapshot.fingerprint : '',
      before.fingerprint,
      'a release reset is not something to decide, so the fingerprint holds',
    )
    assert.notEqual(
      queued?.kind === 'publish' ? queued.snapshot.revision : '',
      before.revision,
      'the revision moved, and Cloud refuses an action against one it does not hold',
    )
    assert.equal(queued?.kind === 'publish' ? queued.snapshot.release : 'x', '')
  })

  it('queues nothing at all when the card has not moved', async () => {
    await published()

    await recordBoardEvents()

    assert.deepEqual(readOutbox().pending, [])
  })
})

describe('a machine that is not signed in', () => {
  it('sends nothing, and records nothing to send', async () => {
    BOARD()
    queuePublish(12)
    fs.rmSync(path.join(home, 'session.json'))
    const calls = fakeCloud(() => ok({}))

    await recordBoardEvents()
    await flushCloudOutbox()

    assert.deepEqual(calls, [])
    assert.equal(readOutbox().pending.length, 1, 'what was queued while signed in waits')
  })
})
