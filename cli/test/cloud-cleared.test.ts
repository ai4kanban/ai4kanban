// The bell after a card is answered or implemented again (#695).
//
// A delivery that did not land leaves a row waiting for a person, and a card tried several
// times leaves several of them. Picking the card up again — answering it, or pressing
// Implement — is somebody taking that work over, so those rows stop asking and the count
// stops counting them. What is asked here is the whole of the bell's behaviour, not the
// judgment on its own: the row goes, the number follows it, the landing stays, another
// card's row stays, and nobody is interrupted by the clearing.
//
// The network is a fake `fetch`; the session, the board record and the bell are the real
// ones, in a temporary home.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { defaultBoardDir, enableCloudBoard } from '../src/lib/cloud/boards.ts'
import { readCloudCenter, readHint, stopCloudCenter } from '../src/lib/cloud/center.ts'
import type { CloudEvent } from '../src/lib/cloud/events.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { restoreMachineHome } from './helpers/board.ts'

const SUPABASE = 'https://cloud.test'
const API = 'https://api.test'
const SUBJECT = '11111111-1111-4111-8111-111111111111'

let home = ''
let root = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cloud-cleared-'))
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
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

const BOARD = () => enableCloudBoard(defaultBoardDir(root), root, '0.8.0')

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

/** A delivery of that card that ended, as the Worker hands it back. */
const ended = (id: string, over: Partial<CloudEvent>): CloudEvent =>
  event(id, { state: 'failed', acted: true, ...over })

/** Stand in for the Worker: every event this test made, answered by id. */
function fakeCloud(events: CloudEvent[]): void {
  const held = new Map(events.map((e) => [e.id, e]))
  mock.method(globalThis, 'fetch', async (url: string | URL) => {
    const at = String(url)
    const id = at.split('/v1/events/')[1]
    const body = id && held.has(id) ? { event: held.get(id) } : {}
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })
}

/** Put these events into the bell, in the order given, and hand back what it draws. */
async function bellAfter(events: CloudEvent[]) {
  fakeCloud(events)
  for (const e of events) await readHint(e.id)
  const center = readCloudCenter()
  return {
    center,
    drawn: center.rows.filter((r) => r.onRail).map((r) => r.eventId),
    unread: center.unread,
  }
}

describe('a card handled again clears what its earlier tries left (#695)', () => {
  it('takes down every ended row on it, and the count comes down with them', async () => {
    const { drawn, unread, center } = await bellAfter([
      ended('did-not-land', { changedAt: '2026-09-01T01:00:00Z' }),
      ended('interrupted', { state: 'interrupted', changedAt: '2026-09-01T02:00:00Z' }),
      event('again', { state: 'accepted', acted: true, changedAt: '2026-09-01T03:00:00Z' }),
    ])
    assert.deepEqual(drawn, [])
    assert.equal(unread, 0)
    // Read-only: the events are still exactly what Cloud handed back, so the card page and
    // everything else reading this list is unchanged.
    assert.equal(center.rows.length, 3)
  })

  it('leaves the landing on the Landed tab, where it is a record rather than a job', async () => {
    const { drawn, unread } = await bellAfter([
      ended('landed', { state: 'completed', changedAt: '2026-09-01T01:00:00Z' }),
      event('again', { state: 'accepted', acted: true, changedAt: '2026-09-01T03:00:00Z' }),
    ])
    assert.deepEqual(drawn, ['landed'])
    // The Landed tab marks itself with a dot; the bell's number is the todo tab's.
    assert.equal(unread, 0)
  })

  it('leaves another card alone, whatever was done to this one', async () => {
    const { drawn, unread } = await bellAfter([
      ended('mine', { changedAt: '2026-09-01T01:00:00Z' }),
      ended('another-card', { taskId: 13, changedAt: '2026-09-01T01:00:00Z' }),
      event('again', { state: 'accepted', acted: true, changedAt: '2026-09-01T03:00:00Z' }),
    ])
    assert.deepEqual(drawn, ['another-card'])
    assert.equal(unread, 1)
  })

  it('draws the new failure when this handling did not land either', async () => {
    const { drawn, unread } = await bellAfter([
      ended('first-try', { changedAt: '2026-09-01T01:00:00Z' }),
      ended('second-try', { changedAt: '2026-09-01T04:00:00Z' }),
    ])
    assert.deepEqual(drawn, ['second-try'])
    assert.equal(unread, 1)
  })

  it('says nothing while it clears — the handling that takes a row down raises nobody', async () => {
    const { center } = await bellAfter([
      ended('did-not-land', { changedAt: '2026-09-01T01:00:00Z' }),
      event('again', { state: 'accepted', acted: true, changedAt: '2026-09-01T03:00:00Z' }),
    ])
    // One alert, and it is the failure itself when it arrived. Clearing it adds none.
    assert.deepEqual(
      center.alerts.map((a) => a.eventId),
      ['did-not-land'],
    )
  })
})

describe('a paged read (#1033)', () => {
  const at = (i: number) => `2026-09-01T${String(i).padStart(2, '0')}:00:00Z`
  const history = () => [
    ...Array.from({ length: 5 }, (_, i) =>
      event(`landed-${i}`, { taskId: 100 + i, state: 'completed', acted: true, changedAt: at(i) }),
    ),
    ...Array.from({ length: 3 }, (_, i) => event(`ask-${i}`, { taskId: 200 + i, changedAt: at(10 + i) })),
    event('working', { taskId: 300, state: 'running', acted: true, changedAt: at(20) }),
  ]

  it('hands back each tab up to its page, with the whole count and whether more is held', async () => {
    fakeCloud(history())
    for (const e of history()) await readHint(e.id)
    const center = readCloudCenter({ todo: 2, landed: 2 })
    assert.deepEqual(
      center.rows.map((r) => r.eventId),
      ['ask-2', 'ask-1', 'landed-4', 'landed-3'],
    )
    assert.deepEqual(center.more, { todo: true, landed: true })
    assert.deepEqual(center.tabUnread, { todo: 3, landed: 5 })
    assert.equal(center.unread, 3)
  })

  it('reads a card the page leaves out, including a state the rail never draws', async () => {
    fakeCloud(history())
    for (const e of history()) await readHint(e.id)
    const center = readCloudCenter({ todo: 1, landed: 1, cards: [300, 100] })
    assert.deepEqual(center.cards?.map((r) => r.eventId), ['working', 'landed-0'])
    assert.deepEqual(readCloudCenter({ todo: 9, landed: 9 }).more, { todo: false, landed: false })
  })

  it('keeps an unpaged read whole, as older apps ask for it', async () => {
    fakeCloud(history())
    for (const e of history()) await readHint(e.id)
    const center = readCloudCenter()
    assert.equal(center.rows.length, 9)
    assert.equal(center.more, undefined)
  })
})
