// The bell without Cloud (#1817).
//
// The board keeps its own record of what it is asking, so a signed-out machine fills the bell
// and raises the same interruptions: a card that starts asking, a delivery that did not land.
// A restart reads the record back and raises nothing, and a signed-in machine draws a row
// Cloud also holds once.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { setBoardProvider } from '../src/lib/board/index.ts'
import { defaultBoardDir, enableCloudBoard } from '../src/lib/cloud/boards.ts'
import { readCloudCenter } from '../src/lib/cloud/center.ts'
import type { CloudEvent } from '../src/lib/cloud/events.ts'
import { linkLocalEvent, readLocalEvents } from '../src/lib/cloud/local-events.ts'
import { afterBoardWrite, recordCloudDeliveryState } from '../src/lib/cloud/publish.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { restoreMachineHome } from './helpers/board.ts'

let home = ''
let root = ''

const card = (id: number, status: string) => `---
title: Card ${id}
priority: med
roi: high
status: ${status}
blocked_by: []
related: []
modules: []
questions: []
---

Card ${id}.

## Worth noting

<!-- agent -->

## Scope
A requirement.

## Todo
- [ ] Do it.

## Decided by the agent
`

function writeCard(id: number, status: string): void {
  fs.writeFileSync(path.join(root, `docs/kanban/todo/${id}-card.md`), card(id, status))
}

/** A fresh board server: nothing held in memory, the record on disk. */
const restart = () => {
  delete (globalThis as { __akbCloudCenter?: unknown }).__akbCloudCenter
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-local-bell-home-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-local-bell-'))
  process.env.AI4KANBAN_HOME = home
  setBoardRoot(root)
  setBoardProvider(null)
  fs.mkdirSync(path.join(root, 'docs/kanban/todo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '9\n')
  fs.writeFileSync(path.join(root, 'docs/kanban/todo/README.md'), '# Tasks\n')
  writeCard(1, 'todo')
  restart()
})

afterEach(() => {
  mock.restoreAll()
  restart()
  fs.rmSync(home, { recursive: true, force: true })
  fs.rmSync(root, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_SUPABASE_ANON_KEY
  delete process.env.AI4KANBAN_CLOUD_URL
})

const onRail = () => readCloudCenter().rows.filter((r) => r.onRail)

describe('signed out', () => {
  it('fills the bell and raises a card that starts asking', async () => {
    await afterBoardWrite()
    readCloudCenter()
    writeCard(1, 'ready')
    await afterBoardWrite()
    const center = readCloudCenter()
    assert.equal(center.signedIn, false)
    assert.deepEqual(center.rows.map((r) => [r.taskId, r.state, r.unread]), [[1, 'actionable', true]])
    assert.equal(center.unread, 1)
    assert.deepEqual(center.alerts.map((a) => [a.taskId, a.kind]), [[1, 'actionable']])
    assert.equal(readCloudCenter().alerts.length, 0, 'raised once')
  })

  it('retires the row once the card needs nobody', async () => {
    writeCard(1, 'ready')
    await afterBoardWrite()
    writeCard(1, 'todo')
    await afterBoardWrite()
    assert.deepEqual(readLocalEvents().map((e) => e.state), ['stale'])
    assert.equal(onRail().length, 0)
  })

  it('raises a delivery that did not land, and files a landing without raising it', async () => {
    writeCard(1, 'ready')
    await afterBoardWrite()
    readCloudCenter()
    recordCloudDeliveryState(1, 'running')
    recordCloudDeliveryState(1, 'failed')
    assert.deepEqual(readCloudCenter().alerts.map((a) => [a.taskId, a.kind]), [[1, 'outcome']])

    await new Promise((resolve) => setTimeout(resolve, 5))
    writeCard(1, 'ready')
    await afterBoardWrite()
    readCloudCenter()
    recordCloudDeliveryState(1, 'running')
    recordCloudDeliveryState(1, 'completed')
    const center = readCloudCenter()
    assert.equal(center.alerts.length, 0)
    assert.deepEqual(
      center.rows.filter((r) => r.onRail).map((r) => r.state),
      ['completed'],
      'the earlier failure is taken over by the later delivery',
    )
  })

  it('reads the record back after a restart and raises nothing', async () => {
    await afterBoardWrite()
    writeCard(1, 'ready')
    await afterBoardWrite()
    restart()
    const center = readCloudCenter()
    assert.deepEqual(center.rows.map((r) => [r.taskId, r.unread]), [[1, true]])
    assert.equal(center.alerts.length, 0)
  })

  it('arrives read when the record is first made', async () => {
    writeCard(1, 'ready')
    await afterBoardWrite()
    assert.equal(readLocalEvents()[0]?.broughtIn, true)
  })
})

describe('signed in', () => {
  it('draws a row Cloud also holds once, from Cloud', async () => {
    process.env.AI4KANBAN_SUPABASE_URL = 'https://cloud.test'
    process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon'
    process.env.AI4KANBAN_CLOUD_URL = 'https://api.test'
    await afterBoardWrite()
    writeSession({
      version: 1,
      supabaseUrl: 'https://cloud.test',
      accessToken: 'a-token',
      refreshToken: 'r-token',
      expiresAt: Date.now() + 60 * 60_000,
      subject: '11111111-1111-4111-8111-111111111111',
    })
    const enabled = enableCloudBoard(defaultBoardDir(root), root)
    mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 503 }))
    writeCard(1, 'ready')
    await afterBoardWrite()
    const [local] = readLocalEvents()
    assert.ok(local)
    linkLocalEvent(1, local.fingerprint, 'cloud-1')
    readCloudCenter()

    const held = (globalThis as unknown as { __akbCloudCenter: { events: Map<string, CloudEvent>; alerts: unknown[] } })
      .__akbCloudCenter
    held.events.set('cloud-1', { ...local, id: 'cloud-1', boardId: enabled.id, workspaceId: '' })
    held.alerts.push({ eventId: 'cloud-1', boardId: enabled.id, taskId: 1, title: '#1 Card 1', body: '', kind: 'actionable', state: 'actionable', eventKind: 'ready_for_review' })

    const center = readCloudCenter()
    assert.deepEqual(center.rows.map((r) => r.eventId), ['cloud-1'])
    assert.equal(center.unread, 1)
    assert.equal(center.alerts.length, 0, 'the record already raised it')
  })
})
