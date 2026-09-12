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

import { board, setBoardProvider } from '../src/lib/board/index.ts'
import { closeRelease, dropRelease } from '../src/lib/releases.ts'
import { withStore } from '../src/lib/agent/store.ts'
import type { DeliveryRecord, RunRecord } from '../src/lib/agent/types.ts'
import {
  ALL_RELEASES,
  cloudBoardFor,
  defaultBoardDir,
  enableCloudBoard,
  setCloudBoardRelease,
} from '../src/lib/cloud/boards.ts'
import { startCloudServer, stopCloudServer } from '../src/lib/cloud/board-server.ts'
import type { CloudEventState } from '../src/lib/cloud/events.ts'
import {
  duePending,
  notePublication,
  publishedFor,
  queue,
  readOutbox,
  unsentToCloud,
  type Pending,
} from '../src/lib/cloud/outbox.ts'
import {
  afterBoardWrite,
  flushCloudOutbox,
  publishBoardEvents,
  recordCloudActionFor,
  recordCloudDeliveryState,
  recordBoardEvents,
  reportCloudRunEnd,
  reportCloudRunStart,
  reportCloudStartFailure,
  takeWatchFill,
} from '../src/lib/cloud/publish.ts'
import {
  disableBoardNotifications,
  readBoardNotifications,
  setBoardNotify,
  watchRelease,
} from '../src/lib/cloud/notifications.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { snapshotFor } from '../src/lib/cloud/snapshot.ts'
import { setBoardDir, setBoardRoot } from '../src/lib/paths.ts'
import type { Card } from '../src/lib/view/types.ts'
import { restoreMachineHome } from './helpers/board.ts'

const SUPABASE = 'https://cloud.test'
const API = 'https://api.test'
const WORKSPACE = '99999999-9999-4999-8999-999999999999'

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
  mock.timers.reset()
  setBoardProvider(null)
  stopCloudServer()
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  restoreMachineHome()
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

const BOARD = () => enableCloudBoard(defaultBoardDir(root), root, '0.8.0')

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

/** How many times a queued item is tried before the board gives up on it (MAX_ATTEMPTS). */
const ATTEMPTS = 54

/** Bring everything queued forward, so the next pass tries it without waiting out its
 *  backoff for real. */
function due(): void {
  const held = readOutbox()
  for (const item of held.pending) item.nextAt = Date.now() - 1
  fs.writeFileSync(path.join(root, '.akb', 'cloud-outbox.json'), `${JSON.stringify(held, null, 2)}\n`)
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
    // And that wait is seconds, not a minute — the first failure is usually a passing one.
    assert.equal(duePending(Date.now() + 6_500).length, 1)
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

    startCloudServer(defaultBoardDir(root))
    await flushCloudOutbox()

    assert.ok(calls.some((c) => c.endsWith('/v1/events')))
    assert.equal(readOutbox().pending.length, 0)
    assert.equal(readOutbox().published['12']?.eventId, 'e-1')
  })
})

describe('a queued item whose attempts have run out', () => {
  it('is not abandoned in silence — the board says it is out of step with Cloud', async () => {
    BOARD()
    queuePublish(12)
    fakeCloud(unreachable)

    // Every attempt but the last, spent, adding up the waits between them.
    let waited = 0
    for (let attempt = 0; attempt < ATTEMPTS - 1; attempt += 1) {
      const before = Date.now()
      await flushCloudOutbox()
      waited += (readOutbox().pending[0]?.nextAt ?? 0) - before
      due()
    }
    assert.equal(readOutbox().pending.length, 1, 'the budget is not spent before the outage is over')
    // Roughly four hours of outage recovery, unchanged by the shorter waits at the front:
    // more attempts fit inside the same window.
    assert.ok(waited > 3.5 * 60 * 60_000, `only ${Math.round(waited / 60_000)} minutes of outage`)
    assert.ok(waited < 4.5 * 60 * 60_000, `${Math.round(waited / 60_000)} minutes of outage`)

    await flushCloudOutbox()

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
    await exhaust()
    assert.equal(unsentToCloud().length, 1)

    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    queuePublish(12)
    await flushCloudOutbox()

    assert.deepEqual(unsentToCloud(), [])
  })
})

/** Spend every attempt on whatever is queued, ignoring the backoff between them. */
async function exhaust(): Promise<void> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (readOutbox().pending.length === 0) break
    due()
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

describe('how long a failed send waits before it is tried again', () => {
  it('starts at five seconds, doubles, and caps at five minutes', async () => {
    BOARD()
    queuePublish(12)
    fakeCloud(unreachable)

    const waits: number[] = []
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const before = Date.now()
      await flushCloudOutbox()
      waits.push((readOutbox().pending[0]?.nextAt ?? 0) - before)
      due()
    }

    // Each wait is moved by up to a fifth either way, so a Cloud that dropped every board on
    // the account does not get all of them back on the same second.
    const want = [5, 10, 20, 40, 80, 160, 300, 300, 300]
    waits.forEach((wait, at) => {
      const target = want[at]! * 1_000
      const how = `attempt ${at + 1} waited ${wait}ms, wanted about ${target}ms`
      assert.ok(wait >= target * 0.8, how)
      // Plus the pass's own time, which the wait is measured from.
      assert.ok(wait <= target * 1.2 + 1_000, how)
    })
    assert.ok(new Set(waits.slice(6)).size > 1, 'the cap is jittered too')
  })
})

describe('a failed send whose backoff is up', () => {
  it('wakes the sender itself rather than waiting for the board\u2019s minute tick', async () => {
    BOARD()
    queuePublish(12)
    fakeCloud(unreachable)
    mock.timers.enable({ apis: ['setTimeout'] })
    await flushCloudOutbox()

    const nextAt = readOutbox().pending[0]?.nextAt ?? 0
    const waited = nextAt - Date.now()
    assert.ok(waited > 0, 'the failed send is inside its backoff')

    // Cloud is back. Nothing writes to the board and no tick runs, so the wake the outbox
    // scheduled for itself is the only thing left that can send it.
    let reached = (): void => {}
    const sent = new Promise<void>((resolve) => {
      reached = resolve
    })
    fakeCloud((url) => {
      if (!url.endsWith('/v1/events')) return ok({})
      reached()
      return publishedEvent('e-1', 12)
    })
    // The wake is what fires; the clock it fires on is the only thing this hurries along.
    due()
    mock.timers.tick(waited + 1)
    await sent
    await flushCloudOutbox()

    assert.deepEqual(readOutbox().pending, [])
    assert.equal(readOutbox().published['12']?.eventId, 'e-1', 'the retry raised the alert')
  })
})

describe('a publication that waited out a backoff', () => {
  /** One publication queued for card 12, failed once, and due again. */
  async function waited(): Promise<void> {
    BOARD()
    writeCardFile()
    queuePublish(12)
    fakeCloud(unreachable)
    await flushCloudOutbox()
    due()
  }

  it('is checked against the board, and dropped when the card no longer needs a person', async () => {
    await waited()
    // A run picked the card up while the send was waiting. Raising it now would ask about
    // work that is already being done.
    working(12)

    const calls = fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    await flushCloudOutbox()

    assert.ok(!calls.some((c) => c.endsWith('/v1/events')), 'nothing was raised')
    assert.deepEqual(readOutbox().pending, [])
    assert.equal(readOutbox().published['12'], undefined)
    assert.deepEqual(unsentToCloud(), [], 'a card nobody is waiting on is not a lost change')
  })

  it('goes out when the card is still waiting', async () => {
    await waited()

    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    await flushCloudOutbox()

    assert.equal(readOutbox().published['12']?.eventId, 'e-1')
  })

  it('goes out as it stands when the board read says nothing', async () => {
    BOARD()
    // No card on disk: a board does not empty, a read does, and a read that says nothing must
    // not drop what is queued.
    queuePublish(12)
    fakeCloud(unreachable)
    await flushCloudOutbox()
    due()

    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    await flushCloudOutbox()

    assert.equal(readOutbox().published['12']?.eventId, 'e-1')
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

describe('a click recorded before the run it starts (#640)', () => {
  /** A board holding card 12, with one live actionable event for it — what a click finds. */
  async function raised(): Promise<void> {
    BOARD()
    writeCardFile()
    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    queuePublish(12)
    await flushCloudOutbox()
  }

  const queued = (kind: Pending['kind']) => readOutbox().pending.filter((p) => p.kind === kind)

  it('leaves the row alone when the run it started picks the card up', async () => {
    await raised()
    recordCloudActionFor(12, 'implement', 'r1')
    // The run the click started now holds the card, and its start is a pass.
    working(12, 'implement')
    await recordBoardEvents()

    assert.equal(queued('retire').length, 0, 'the click’s own run retired the row it was granted on')
    assert.equal(readOutbox().published['12']?.state, 'accepted')
  })

  it('takes back a retirement that got into the queue ahead of it', async () => {
    await raised()
    // The order this card was written about: the run starts first, the pass finds the card
    // held and queues a retirement, and the click arrives behind it.
    working(12, 'implement')
    await recordBoardEvents()
    assert.equal(queued('retire').length, 1)

    recordCloudActionFor(12, 'implement', 'r1')

    assert.equal(queued('retire').length, 0, 'the row was retired and revived, which is two notifications')
    assert.equal(queued('action').length, 1)
  })

  it('is recorded against a record the retirement already reached', async () => {
    await raised()
    // The retirement got out: this board reads the row as stale, and Cloud revives it for
    // the action rather than refusing one.
    notePublication(12, 'e-1', 'stale')

    recordCloudActionFor(12, 'implement', 'r1')

    assert.equal(queued('action').length, 1)
    assert.equal(readOutbox().published['12']?.state, 'accepted')
  })

  it('ends the event when the run never started, and the card is raised afresh', async () => {
    await raised()
    recordCloudActionFor(12, 'implement', 'r1')

    reportCloudStartFailure(12, 'Another run is already on that card.')

    const outcome = queued('outcome')[0]
    assert.equal(outcome?.kind === 'outcome' && outcome.outcome, 'failed')
    assert.equal(outcome?.kind === 'outcome' && outcome.reason, 'Another run is already on that card.')

    // Nothing holds the card now, so the pass raises it again — as a new event, because the
    // one the click was granted against is finished.
    await recordBoardEvents()
    assert.equal(publishedFor(12), undefined)
    assert.equal(publications().length, 1)
  })
})

describe('an action Cloud refuses for good', () => {
  /** A click queued against e-1, and a Worker that refuses the action and answers a re-read
   *  with `event`. `landing` queues the delivery's own state behind the click, which is what
   *  a refusal has to decide the fate of. */
  async function refused(
    code: string,
    event: Record<string, unknown>,
    landing?: CloudEventState,
  ): Promise<string[]> {
    BOARD()
    writeCardFile()
    notePublication(12, 'e-1', 'actionable')
    recordCloudActionFor(12, 'implement', 'r1')
    if (landing) recordCloudDeliveryState(12, landing)
    const seen = fakeCloud((url) => {
      if (url.endsWith('/v1/events/e-1/action')) {
        return new Response(JSON.stringify({ error: { code, message: 'no' } }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.endsWith('/v1/events/e-1')) return ok({ event: { id: 'e-1', boardId: BOARD().id, taskId: 12, ...event } })
      return ok({ event: { id: 'e-1', boardId: BOARD().id, taskId: 12, state: 'running', acted: true } })
    })
    await flushCloudOutbox()
    return seen
  }

  it('writes Cloud’s own state back when the event turns out to carry an action', async () => {
    // Somebody else's click got there first and its delivery is already going. This board
    // guessed `accepted`; what Cloud holds is what the record has to say.
    await refused('already_acted', { state: 'running', acted: true })

    assert.equal(readOutbox().published['12']?.state, 'running', 'the board kept its own guess')
    // And the delivery here goes on reporting, because that action is something to report
    // against.
    recordCloudDeliveryState(12, 'completed')
    assert.equal(readOutbox().pending.filter((p) => p.kind === 'outcome').length, 1)
  })

  it('drops what was queued to report against a click that was never recorded', async () => {
    const seen = await refused('stale_revision', { state: 'actionable', acted: false }, 'running')

    assert.ok(!seen.some((at) => at.endsWith('/v1/events/e-1/outcome')), 'a state was reported anyway')
    assert.equal(readOutbox().pending.filter((p) => p.kind === 'outcome').length, 0)
    assert.equal(publishedFor(12), undefined, 'a record naming that event would keep the card off every pass')
  })

  it('leaves the row for the reconciliation, which retires it as stale', async () => {
    await refused('stale_revision', { state: 'actionable', acted: false }, 'running')
    // The card is still being built here, so the pass finds it held and the row on Cloud is
    // nobody's to answer.
    working(12, 'implement')
    const seen = fakeCloud((url, body) => {
      if (url.endsWith('/v1/events') && body === undefined) {
        return ok({ events: [{ id: 'e-1', boardId: BOARD().id, taskId: 12, state: 'actionable', acted: false }] })
      }
      return ok({ event: { id: 'e-1', boardId: BOARD().id, taskId: 12, state: 'stale', acted: false } })
    })

    await publishBoardEvents({ reconcile: true })

    assert.ok(seen.some((at) => at.endsWith('/v1/events/e-1/retire')))
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
    const held = enableCloudBoard(defaultBoardDir(root), root, ALL_RELEASES)
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

// ---------------------------------------------------------------------------
// Changing the watched scope raises nothing that was already waiting (#451)
// ---------------------------------------------------------------------------

/** One more card, in whichever release, so a switch has something to bring in. */
function writeCard(id: number, release: string, title = `Card ${id}`): void {
  const dir = path.join(root, 'docs', 'kanban', 'todo', 'features')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, `${id}-a-card.md`),
    [
      '---',
      `title: ${title}`,
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

const publications = () =>
  duePending().filter((p): p is Extract<Pending, { kind: 'publish' }> => p.kind === 'publish')

const summaries = () =>
  duePending().filter((p): p is Extract<Pending, { kind: 'summary' }> => p.kind === 'summary')

describe('widening the watched scope', () => {
  beforeEach(() => {
    writeCardFile()
    writeCard(13, '1.0')
    writeCard(14, '1.0')
    BOARD()
  })

  it('brings the waiting cards in quietly, and raises what starts waiting afterwards', async () => {
    // The board is already holding 0.8.0's card, published as ordinary news.
    notePublication(12, 'e-12', 'actionable')
    fakeCloud(unreachable)

    await watchRelease(ALL_RELEASES)

    const quiet = publications()
    assert.deepEqual(quiet.map((p) => p.snapshot.taskId).sort(), [13, 14])
    assert.ok(
      quiet.every((p) => p.snapshot.broughtIn),
      'a card the switch brought into view was published as news',
    )

    // A card that starts waiting after the switch is ordinary news, mark and all.
    writeCard(15, '1.0')
    await afterBoardWrite()
    const fresh = publications().find((p) => p.snapshot.taskId === 15)
    assert.equal(fresh?.snapshot.broughtIn, false)
  })

  it('sends one summary for the switch instead of a message each', async () => {
    notePublication(12, 'e-12', 'actionable')
    const sent: Array<Record<string, unknown>> = []
    fakeCloud((url, body) => {
      if (url.endsWith('/v1/watch-summary')) {
        sent.push(body as Record<string, unknown>)
        return ok({ summary: { summaryId: 's-1', posted: true } })
      }
      if (url.endsWith('/v1/events') && body === undefined) return ok({ events: [] })
      if (url.endsWith('/v1/events')) return publishedEvent('e-new', 13)
      return ok({})
    })

    await watchRelease(ALL_RELEASES)

    assert.equal(sent.length, 1)
    assert.equal(sent[0]?.watching, ALL_RELEASES)
    assert.equal(sent[0]?.cards, 2)
  })

  it('says the same thing in one line at the top of the bell, once', async () => {
    fakeCloud(unreachable)
    await watchRelease(ALL_RELEASES)

    assert.deepEqual(takeWatchFill(), { release: ALL_RELEASES, cards: 3 })
    assert.equal(takeWatchFill(), null, 'the line is handed out once')
  })

  it('queues nothing at all when the switch brings no waiting card in', async () => {
    notePublication(12, 'e-12', 'actionable')
    notePublication(13, 'e-13', 'actionable')
    notePublication(14, 'e-14', 'actionable')
    fakeCloud(unreachable)

    await watchRelease(ALL_RELEASES)

    assert.equal(summaries().length, 0)
    assert.equal(takeWatchFill(), null)
  })

  it('drops a summary that runs out of attempts rather than saying the board is out of step', async () => {
    fakeCloud(unreachable)
    await watchRelease(ALL_RELEASES)
    assert.equal(summaries().length, 1)

    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const held = readOutbox()
      const queued = held.pending.find((p) => p.kind === 'summary')
      if (!queued) break
      // Nothing else is due, so the summary is what each pass spends its attempt on.
      held.pending = [queued]
      queued.nextAt = Date.now() - 1
      fs.writeFileSync(path.join(root, '.akb', 'cloud-outbox.json'), `${JSON.stringify(held, null, 2)}\n`)
      await flushCloudOutbox()
    }

    assert.equal(summaries().length, 0)
    assert.deepEqual(unsentToCloud(), [], 'a lost summary is not a change the board must report')
  })
})

// The watch a Cloud checkout does not own (#328).
//
// On a board that lives in a workspace, the switch and the release belong to the MEMBER
// inside it rather than to this machine, so they follow them everywhere they open the board.
// This machine's record becomes the mirror of that answer: every read pulls it down, every
// move writes through, and the publisher — which cannot reach the network — reads the mirror.
describe('a shared board’s watch', () => {
  /** A checkout pointed at a workspace, with a card waiting in `0.8.0`. */
  function shared(): void {
    fs.writeFileSync(
      path.join(root, '.ai4kanban.json'),
      `${JSON.stringify({ version: 1, workspace: WORKSPACE }, null, 2)}\n`,
    )
    BOARD()
    writeCardFile()
    setBoardProvider({ readCards: async () => [card()] } as never)
  }

  /** What the workspace answers for this member's watch. */
  const watch = (over: Record<string, unknown> = {}) =>
    ok({ watch: { notify: true, watching: '0.8.0', carried: true, releases: ['0.8.0'], ...over } })

  /** The Worker, answering the watch and whatever else the section reads on the way. */
  const cloud = (over: Record<string, unknown> = {}) =>
    fakeCloud((url) => {
      if (url.endsWith('/v1/servers')) return ok({ servers: [] })
      if (url.endsWith('/watch/carry')) return watch({ ...over, carried: true })
      if (url.endsWith('/watch')) return watch(over)
      return ok({})
    })

  it('is pulled down into this machine’s record, and hands a chosen one over once', async () => {
    shared()
    // The user picked this release on this machine, so it is worth carrying up.
    setCloudBoardRelease(defaultBoardDir(root), '0.8.0')
    const seen = cloud({ carried: false })

    const state = await readBoardNotifications()

    assert.ok(
      seen.some((at) => at.endsWith(`/v1/workspaces/${WORKSPACE}/watch/carry`)),
      'a watch the workspace has never been handed is handed this machine’s',
    )
    assert.equal(state.shared, true)
    assert.equal(state.enabled, true)
    assert.equal(cloudBoardFor(defaultBoardDir(root))?.release, '0.8.0')
  })

  it('hands nothing over from a fresh clone, so an added member keeps the default', async () => {
    shared()
    const seen = cloud({ carried: false, watching: '1.0' })

    await readBoardNotifications()

    assert.equal(
      seen.filter((at) => at.endsWith('/watch/carry')).length,
      0,
      'the every-release default a signed-in machine mints is not a choice worth carrying',
    )
    assert.equal(cloudBoardFor(defaultBoardDir(root))?.release, '1.0')
  })

  it('is not handed over a second time, so a change made elsewhere stands', async () => {
    shared()
    const seen = cloud({ watching: ALL_RELEASES })

    await readBoardNotifications()

    assert.equal(seen.filter((at) => at.endsWith('/watch/carry')).length, 0)
    assert.equal(cloudBoardFor(defaultBoardDir(root))?.release, ALL_RELEASES)
  })

  it('switched off, publishes nothing from this machine', async () => {
    shared()
    cloud({ notify: false })
    await readBoardNotifications()

    const state = await readBoardNotifications()
    assert.equal(state.enabled, false, 'the switch is what the workspace says, not whether the record is here')

    await recordBoardEvents()
    assert.deepEqual(readOutbox().pending, [], 'a member whose own switch is off raises nothing')
  })

  it('turned off, leaves the workspace’s events alone', async () => {
    shared()
    const seen = fakeCloud((url, body) => {
      if (url.endsWith('/v1/servers')) return ok({ servers: [] })
      if (url.endsWith(`/v1/workspaces/${WORKSPACE}/watch`)) {
        return watch({ notify: (body as { notify?: boolean })?.notify !== false })
      }
      return ok({})
    })

    const done = await disableBoardNotifications()

    assert.equal(done.ok, true)
    assert.ok(
      seen.some((at) => at.endsWith(`/v1/workspaces/${WORKSPACE}/watch`)),
      'the switch is turned off in the workspace',
    )
    assert.equal(
      seen.some((at) => at.includes('/retire')),
      false,
      'one member going quiet must not retire a decision the rest of the team is still waiting on',
    )
    // The record stays, because it is the mirror of an answer that lives in the workspace.
    assert.equal(cloudBoardFor(defaultBoardDir(root))?.watchOff, true)
  })

  it('is turned back on from the same switch, and fills quietly', async () => {
    shared()
    let notify = false
    const seen = fakeCloud((url, body) => {
      if (url.endsWith('/v1/servers')) return ok({ servers: [] })
      if (url.endsWith(`/v1/workspaces/${WORKSPACE}/watch`)) {
        if (body) notify = (body as { notify?: boolean }).notify !== false
        return watch({ notify })
      }
      if (url.endsWith('/v1/events')) return publishedEvent('e-1', 12)
      return ok({})
    })

    assert.equal((await setBoardNotify(false)).ok, true)
    assert.equal(cloudBoardFor(defaultBoardDir(root))?.watchOff, true)

    assert.equal((await setBoardNotify(true)).ok, true)

    assert.equal(cloudBoardFor(defaultBoardDir(root))?.watchOff, undefined)
    const publication = readOutbox().pending.find((p) => p.kind === 'publish')
    const filled = seen.some((at) => at.endsWith('/v1/events'))
    assert.ok(
      publication || filled,
      'turning them back on fills the bell with what the board is already holding',
    )
  })

  it('watching another release, leaves the team’s row where it is', async () => {
    shared()
    // The workspace's card is live and was published from this very machine. Its member has
    // since narrowed to a release the card is not in.
    notePublication(12, 'e-12', 'actionable')
    cloud({ watching: '1.0' })

    await readBoardNotifications()
    await recordBoardEvents()

    assert.deepEqual(
      readOutbox().pending.filter((p) => p.kind === 'retire'),
      [],
      'a decision belongs to the workspace, so one member’s narrower watch must not take it down',
    )
    assert.deepEqual(
      readOutbox().pending.filter((p) => p.kind === 'publish'),
      [],
      'this machine still raises only what its own member watches',
    )
  })

  it('with nothing left to watch, still leaves them where they are', async () => {
    shared()
    notePublication(12, 'e-12', 'actionable')
    // The release this member was watching closed and they have not picked another — #319's
    // own state, and not a reason to empty the rest of the team's bell.
    cloud({ watching: '' })

    await readBoardNotifications()
    await recordBoardEvents()

    assert.equal(cloudBoardFor(defaultBoardDir(root))?.release, '')
    assert.deepEqual(readOutbox().pending.filter((p) => p.kind === 'retire'), [])
  })

  it('carries no switch on a Local board, where signed in means on', async () => {
    BOARD()
    fakeCloud(() => ok({}))

    const done = await setBoardNotify(false)

    assert.equal(done.ok, false)
    assert.equal(cloudBoardFor(defaultBoardDir(root))?.watchOff, undefined)
  })
})

// The one delivery that holds a card without working it (#565). Built, reviewed and queued,
// with nothing left to do but the card's open questions — the same wait a card with no
// delivery raises, which is why the publisher raises this one too.
describe('a delivery held at landing', () => {
  const ASKING = '[user] Which shade of blue?'

  /** A card asking the user, with a delivery on it in the stage `landing` gives it. */
  function held(landing?: DeliveryRecord['landing']): void {
    enableCloudBoard(defaultBoardDir(root), root, ALL_RELEASES)
    writeCardFile('0.8.0', [ASKING])
    setBoardProvider({
      readCards: async () => [card({ release: '0.8.0', status: 'implementing', questions: [{ text: ASKING }] })],
    } as never)
    withStore((store) =>
      store.deliveries.push({
        deliveryId: 'd-12',
        cardId: 12,
        title: 'A task',
        status: 'active',
        startedAt: Date.now(),
        sessions: [],
        approved: '',
        steps: [],
        commitMode: 'auto',
        targetBranch: 'main',
        landing,
      } as DeliveryRecord),
    )
  }

  /** What the pass queued for card 12, if anything. */
  const queued = () =>
    readOutbox().pending.find((p) => p.kind === 'publish' && p.snapshot.taskId === 12)

  it('raises its card, because the questions are all that is left', async () => {
    held({ status: 'waiting', attempts: 0, at: Date.now() })

    await recordBoardEvents()

    const publication = queued()
    assert.ok(publication, 'the card is raised while it waits on the user')
    assert.equal(publication.kind === 'publish' && publication.snapshot.kind, 'question')
    assert.equal(publication.kind === 'publish' && publication.snapshot.decision, 'answer')
  })

  it('keeps a retried publication, which is re-judged on the same terms that queued it', async () => {
    held({ status: 'waiting', attempts: 0, at: Date.now() })
    queuePublish(12)
    fakeCloud(unreachable)
    await flushCloudOutbox()
    due()

    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    await flushCloudOutbox()

    assert.equal(readOutbox().published['12']?.eventId, 'e-1', 'the card still waits on the user')
  })

  it('stays quiet while the delivery is still building it', async () => {
    // No landing record: review has not passed it yet, so the questions are a warning the
    // user already answered for rather than something the board is waiting on.
    held()

    await recordBoardEvents()

    assert.equal(queued(), undefined)
  })
})

// A run that NAMES a card without holding it (#568). A specialist is out of every lock, so
// the card's own loop carries on around it — but the card page turns its controls off all
// the same, and a row asking a question the card offers no way to answer is worse than
// silence.
describe('a card a specialist run is drafting', () => {
  const ASKING = '[user] Which shade of blue?'

  /** A card asking the user, in the watched release, with `drafting` deciding whether a
   *  `spec` run is live over it. */
  function asking({ drafting = false, landing = false } = {}): void {
    enableCloudBoard(defaultBoardDir(root), root, ALL_RELEASES)
    writeCardFile('0.8.0', [ASKING])
    setBoardProvider({
      readCards: async () => [card({ release: '0.8.0', status: 'implementing', questions: [{ text: ASKING }] })],
    } as never)
    if (landing) {
      withStore((store) =>
        store.deliveries.push({
          deliveryId: 'd-12',
          cardId: 12,
          title: 'A task',
          status: 'active',
          startedAt: Date.now(),
          sessions: [],
          approved: '',
          steps: [],
          commitMode: 'auto',
          targetBranch: 'main',
          landing: { status: 'waiting', attempts: 0, at: Date.now() },
        } as DeliveryRecord),
      )
    }
    if (drafting) working(12, 'spec')
  }

  /** What the pass queued for card 12, if anything. */
  const queued = () => readOutbox().pending.find((p) => p.kind === 'publish' && p.snapshot.taskId === 12)
  const retired = () => readOutbox().pending.find((p) => p.kind === 'retire' && p.eventId === 'e-12')

  it('raises nothing while the spec is still being written', async () => {
    asking({ drafting: true })

    await recordBoardEvents()

    assert.equal(queued(), undefined)
  })

  it('takes down a row already up, since the card stopped offering an answer', async () => {
    asking({ drafting: true })
    notePublication(12, 'e-12', 'actionable')

    await recordBoardEvents()

    const retirement = retired()
    assert.ok(retirement, 'the row comes down rather than sitting there unanswerable')
    assert.equal(retirement.kind === 'retire' && retirement.state, 'stale')
  })

  it('raises it once the drafting run ends and the question is still open', async () => {
    asking({ drafting: true })
    await recordBoardEvents()
    assert.equal(queued(), undefined)

    withStore((store) => store.runs.splice(0, store.runs.length))
    await recordBoardEvents()

    const publication = queued()
    assert.ok(publication, 'the run is over and the question is the user\u2019s again')
    assert.equal(publication.kind === 'publish' && publication.snapshot.kind, 'question')
  })

  it('holds a card held at landing back too, for the same reason', async () => {
    // #565 raises this one as if nothing held it. A live run over it still says no: the
    // controls the answer would be typed into are off.
    asking({ drafting: true, landing: true })

    await recordBoardEvents()

    assert.equal(queued(), undefined)
  })
})

// A card its creator has not finished writing (#564). The same reason as above, carried
// further: this card has no page at all, so a row about it would link to a screen that
// refuses to draw. Neither state is a run HOLDING the card — a creator names it in
// `createdCardIds`, and an unfinished one has no live run left.
describe('a card that is not finished being created', () => {
  const ASKING = '[user] Which shade of blue?'

  /** A card asking the user, written by a run that is still going or stopped short. */
  function askingMidCreation(state: 'creating' | 'unfinished'): void {
    enableCloudBoard(defaultBoardDir(root), root, ALL_RELEASES)
    writeCardFile('0.8.0', [ASKING])
    setBoardProvider({
      readCards: async () => [card({ release: '0.8.0', status: 'implementing', questions: [{ text: ASKING }] })],
    } as never)
    creating(12, state)
  }

  const queued = () => readOutbox().pending.find((p) => p.kind === 'publish' && p.snapshot.taskId === 12)

  it('raises nothing while its creator is still writing the plan', async () => {
    askingMidCreation('creating')

    await recordBoardEvents()

    assert.equal(queued(), undefined)
  })

  it('raises nothing either when its creator stopped short', async () => {
    askingMidCreation('unfinished')

    await recordBoardEvents()

    assert.equal(queued(), undefined, 'nothing but picking that run back up makes this a card')
  })

  it('takes down a row already up, since the card no longer offers an answer', async () => {
    askingMidCreation('creating')
    notePublication(12, 'e-12', 'actionable')

    await recordBoardEvents()

    const retirement = readOutbox().pending.find((p) => p.kind === 'retire' && p.eventId === 'e-12')
    assert.ok(retirement, 'the row comes down rather than sitting there unanswerable')
    assert.equal(retirement.kind === 'retire' && retirement.state, 'stale')
  })

  it('raises it once the creator finishes and the question is still open', async () => {
    askingMidCreation('creating')
    await recordBoardEvents()
    assert.equal(queued(), undefined)

    withStore((store) => {
      for (const r of store.runs) {
        r.status = 'done'
        r.pid = undefined
        r.endedAt = Date.now()
      }
    })
    await recordBoardEvents()

    const publication = queued()
    assert.ok(publication, 'the card is finished and the question is the user’s')
    assert.equal(publication.kind === 'publish' && publication.snapshot.kind, 'question')
  })
})

// A whole chain of agents on one card, rather than the one agent that happens to stop first
// (#611). The board hands a card straight on — a refine to a spec agent, a build to its
// review, a landing to the run it wants — and the run ending is not the card being free.

describe('a card handed straight to the next agent', () => {
  const ASKING = '[user] Which shade of blue?'

  /** A card asking the user, with `holder` deciding what is working it right now. */
  function asking(): void {
    enableCloudBoard(defaultBoardDir(root), root, ALL_RELEASES)
    writeCardFile('0.8.0', [ASKING])
    setBoardProvider({
      readCards: async () => [card({ release: '0.8.0', status: 'implementing', questions: [{ text: ASKING }] })],
    } as never)
  }

  /** What the pass queued for card 12, if anything. */
  const queued = () => readOutbox().pending.find((p) => p.kind === 'publish' && p.snapshot.taskId === 12)

  it('raises nothing in the gap, because the next agent is already written down', async () => {
    asking()
    // The run that just closed is gone from the record, and the one it started is on it —
    // which is the order the watcher reports in.
    working(12, 'spec')

    await reportCloudRunEnd('s-done', 12, 'completed')

    assert.equal(queued(), undefined, 'the chain is still going')
  })

  it('raises the card when the follow-up would not start, so a broken chain is not silence', async () => {
    asking()

    await reportCloudRunEnd('s-done', 12, 'completed')

    const publication = queued()
    assert.ok(publication, 'nothing holds the card, so the user hears about it')
    assert.equal(publication.kind === 'publish' && publication.snapshot.kind, 'question')
  })

  it('raises a card its delivery is holding at landing, which the chain has left behind', async () => {
    asking()
    withStore((store) =>
      store.deliveries.push({
        deliveryId: 'd-12',
        cardId: 12,
        title: 'A task',
        status: 'active',
        startedAt: Date.now(),
        sessions: [],
        approved: '',
        steps: [],
        commitMode: 'auto',
        targetBranch: 'main',
        landing: { status: 'waiting', attempts: 0, at: Date.now() },
      } as DeliveryRecord),
    )

    await reportCloudRunEnd('s-done', 12, 'completed')

    assert.ok(queued(), 'built, reviewed and queued — the questions are all that is left')
  })

  it('raises it once, however many endings the chain has left to report', async () => {
    asking()
    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-12', 12) : ok({})))

    await reportCloudRunEnd('s-one', 12, 'completed')
    await flushCloudOutbox()
    await reportCloudRunEnd('s-two', 12, 'completed')

    assert.equal(readOutbox().published['12']?.eventId, 'e-12')
    assert.equal(queued(), undefined, 'the row is up; a second ending is not a second message')
  })

  it('takes the row down again when the card goes back to work', async () => {
    asking()
    notePublication(12, 'e-12', 'actionable')
    working(12, 'spec')

    await reportCloudRunStart(12)

    const retirement = readOutbox().pending.find((p) => p.kind === 'retire' && p.eventId === 'e-12')
    assert.ok(retirement, 'a row nobody can act on comes down as the run picks the card up')
    assert.equal(retirement.kind === 'retire' && retirement.state, 'stale')
  })

  it('costs no pass at all when this board holds no row for the card', async () => {
    asking()
    const calls = fakeCloud(() => ok({}))

    await reportCloudRunStart(12)

    assert.deepEqual(calls, [])
    assert.deepEqual(readOutbox().pending, [])
  })
})

describe('a publication on its very first send', () => {
  it('is checked against the board too, and dropped when a run has the card', async () => {
    BOARD()
    writeCardFile()
    queuePublish(12)
    // The card went back to work between the write that queued this and the send — which is
    // exactly the length of one handoff.
    working(12)

    const calls = fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    await flushCloudOutbox()

    assert.ok(!calls.some((c) => c.endsWith('/v1/events')), 'nothing was raised')
    assert.equal(readOutbox().published['12'], undefined)
    assert.deepEqual(unsentToCloud(), [], 'a card nobody is waiting on is not a lost change')
  })

  it('goes out when the card is still waiting', async () => {
    BOARD()
    writeCardFile()
    queuePublish(12)

    fakeCloud((url) => (url.endsWith('/v1/events') ? publishedEvent('e-1', 12) : ok({})))
    await flushCloudOutbox()

    assert.equal(readOutbox().published['12']?.eventId, 'e-1')
  })

  it('is checked on a workspace board this member watches no release of', async () => {
    // The pass itself runs on such a board (#328). The check used to read it as no board at
    // all and let everything through, which is the one board where the queue holds the
    // team's rows.
    enableCloudBoard(defaultBoardDir(root), root, ALL_RELEASES)
    fs.writeFileSync(
      path.join(root, '.ai4kanban.json'),
      `${JSON.stringify({ version: 1, workspace: WORKSPACE }, null, 2)}\n`,
    )
    const snapshot = snapshotFor(card(), { ...cloudBoardFor(defaultBoardDir(root))!, release: ALL_RELEASES })
    assert.ok(snapshot)
    queue({ opId: 'op-12', kind: 'publish', attempts: 0, snapshot })
    setCloudBoardRelease(defaultBoardDir(root), '')
    setBoardProvider({ readCards: async () => [card()] } as never)
    working(12)

    const calls = fakeCloud(() => ok({}))
    await flushCloudOutbox()

    assert.ok(!calls.some((c) => c.endsWith('/v1/events')), 'the board was read, and the card is at work')
    assert.deepEqual(readOutbox().pending, [])
  })
})

/** Write down the run that created a card, the way `akb raw create` inside one would. */
function creating(cardId: number, state: 'creating' | 'unfinished'): void {
  const live = state === 'creating'
  // The record drops a finished run whose log is gone, so an ended creator needs one.
  const logPath = path.join(root, 'docs', 'kanban', '.sessions', `c-${cardId}.log`)
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, '')
  withStore((store) =>
    store.runs.push({
      sessionId: `c-${cardId}`,
      cardId: null,
      createdCardIds: [cardId],
      action: 'create',
      status: live ? 'running' : 'error',
      startedAt: Date.now(),
      endedAt: live ? undefined : Date.now(),
      pid: live ? process.pid : undefined,
      harness: 'claude-code',
      logPath,
    } as RunRecord),
  )
}

function writeCardFile(release = '0.8.0', questions: string[] = []): void {
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
      questions.length
        ? `questions:\n${questions.map((q) => `  - ${JSON.stringify(q)}`).join('\n')}`
        : 'questions: []',
      'verify: []',
      '---',
      '',
      'What it is for.',
      '',
    ].join('\n'),
  )
}

/** Write down a live run on a card, the way `openRun` would. */
function working(cardId: number, action: RunRecord['action'] = 'resolve'): void {
  withStore((store) =>
    store.runs.push({
      sessionId: `s-${cardId}`,
      cardId,
      action,
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
      'broughtIn',
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
      // The home the event belongs to (#364). Empty on a Local board, and never a path.
      'workspaceId',
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
      'broughtIn',
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
      'workspaceId',
    ])
  })
})

describe('a checkout that points at a workspace (#364)', () => {
  /** Point this checkout at a workspace, the way `akb cloud go` does. */
  const pointAt = (workspace: string) =>
    fs.writeFileSync(
      path.join(root, '.ai4kanban.json'),
      `${JSON.stringify({ version: 1, workspace }, null, 2)}\n`,
    )

  it('publishes into the workspace rather than into this machine’s board id', async () => {
    BOARD()
    pointAt(WORKSPACE)
    const sent: Array<Record<string, unknown>> = []
    fakeCloud((url, body) => {
      if (!url.endsWith('/v1/events')) return ok({})
      sent.push(body as Record<string, unknown>)
      return ok({ event: { id: 'e-1', boardId: '', workspaceId: WORKSPACE, taskId: 12, state: 'actionable', changedAt: 'now', acted: false } })
    })
    setBoardProvider({ readCards: async () => [card()] } as never)

    await publishBoardEvents()

    const [body] = sent
    assert.equal(body?.workspaceId, WORKSPACE)
    // One home and never both: a workspace card that also named a board would raise a second
    // row on the machine that opened the same workspace next.
    assert.equal(body?.boardId, '')
  })

  it('leaves a checkout with no pointer publishing into its board, exactly as before', async () => {
    const board = BOARD()
    const snapshot = snapshotFor(card(), board)
    assert.equal(snapshot?.boardId, board.id)
    assert.equal(snapshot?.workspaceId, '')
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
    const watching = enableCloudBoard(defaultBoardDir(root), root, ALL_RELEASES)
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


describe('release watch durability', () => {
  for (const fails of [false, true]) {
    it(`keeps publishing when the release list ${fails ? 'fails' : 'is temporarily empty'}`, async () => {
      BOARD()
      writeCardFile()
      setBoardProvider({ ...board(), readReleases: async () => {
        if (fails) throw new Error('unavailable')
        return []
      } })
      await recordBoardEvents()
      assert.equal(cloudBoardFor(defaultBoardDir(root))?.release, '0.8.0')
      assert.ok(duePending().some((p) => p.kind === 'publish' && p.snapshot.taskId === 12))
    })
  }

  it('retires existing events after an explicit close pauses publishing', async () => {
    writeCardFile()
    fs.writeFileSync(path.join(root, 'docs/kanban/releases.md'), '- **0.8.0**\n')
    BOARD()
    notePublication(12, 'e-12', 'actionable')
    fakeCloud(unreachable)
    closeRelease('0.8.0')
    await afterBoardWrite()
    await flushCloudOutbox()
    assert.ok(readOutbox().pending.some((p) => p.kind === 'retire' && p.eventId === 'e-12'))
  })

  for (const end of [closeRelease, dropRelease]) {
    for (const watch of ['0.8.0', '0.9.0', ALL_RELEASES]) {
      it(`${end.name} pauses only the watch for the ended release (${watch})`, () => {
        writeCardFile()
        fs.writeFileSync(path.join(root, 'docs/kanban/releases.md'), '- **0.8.0**\n- **0.9.0**\n')
        enableCloudBoard(defaultBoardDir(root), root, watch)
        end('0.8.0')
        assert.equal(cloudBoardFor(defaultBoardDir(root))?.release, watch === '0.8.0' ? '' : watch)
      })
    }
  }
})

// Two boards in one project (#407): `marketing/kanban` beside `docs/kanban`. They share the
// project, and so share `.akb/` — but they are two boards with two event streams, and a pass
// over one that read the other's record found every one of its rows among cards it had never
// heard of, retired all of them, and left the board they belong to to raise them again from
// nothing. One card, one notification, over and over.
describe('a second board in the same project', () => {
  /** `marketing/kanban`, holding one card of its own. */
  function second(): string {
    const dir = path.join(root, 'marketing', 'kanban')
    fs.mkdirSync(path.join(dir, 'todo', 'features'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'config.md'), '# Board\n')
    fs.writeFileSync(
      path.join(dir, 'todo', 'features', '3-a-post.md'),
      [
        '---',
        'title: A post',
        'priority: high',
        'roi: high',
        'status: ready',
        'release: "0.8.0"',
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
    return dir
  }

  it('is a board of its own, and leaves the first one’s rows exactly where they are', async () => {
    BOARD()
    writeCardFile()
    notePublication(12, 'e-12', 'actionable')
    const dir = second()

    setBoardDir(dir, root)
    const marketing = enableCloudBoard(dir, root, ALL_RELEASES)
    await recordBoardEvents()

    assert.notEqual(marketing.id, cloudBoardFor(defaultBoardDir(root))!.id, 'two boards, two ids')
    assert.equal(marketing.name, `${path.basename(root)}/marketing`)
    assert.deepEqual(
      readOutbox().pending.filter((p) => p.kind === 'retire'),
      [],
      'the first board’s events are not this board’s to retire',
    )
    assert.ok(
      readOutbox().pending.some((p) => p.kind === 'publish' && p.snapshot.taskId === 3),
      'and its own card is published',
    )

    setBoardRoot(root)
    assert.equal(readOutbox().published['12']?.state, 'actionable', 'the first board’s record is untouched')
    assert.deepEqual(readOutbox().pending, [], 'and its outbox is its own')
  })
})

// A board does not empty; a READ does. Retiring on one is how a bad read turns into every row
// being retired and raised again from nothing.
describe('a board read that comes back empty', () => {
  it('retires nothing while this board is holding live events', async () => {
    BOARD()
    writeCardFile()
    notePublication(12, 'e-12', 'actionable')
    setBoardProvider({ ...board(), readCards: async () => [] })

    await recordBoardEvents()

    assert.deepEqual(readOutbox().pending, [])
    assert.equal(readOutbox().published['12']?.state, 'actionable')
  })

  it('still retires what really left once a card is read', async () => {
    BOARD()
    writeCardFile()
    notePublication(12, 'e-12', 'actionable')
    notePublication(13, 'e-13', 'actionable')

    await recordBoardEvents()

    assert.ok(readOutbox().pending.some((p) => p.kind === 'retire' && p.eventId === 'e-13'))
  })
})
