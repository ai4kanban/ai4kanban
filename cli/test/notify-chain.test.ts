// When a card's chain of agents ends, as against when one agent does (#611).
//
// The board hands a card straight on — a run that broke the card format to the repair that
// fixes it, a build to its review, a landing to the run it wants — and for the length of
// that handoff the card is between records. A notification raised in it calls the user to a
// card an agent already has and every control is off for.
//
// So the watcher tells Cloud the card stopped being worked only once everything this close
// starts is written down. What is asked here is that ordering, end to end: the real watcher,
// the real record, the real publisher, and a fake Worker on the other end of `fetch`.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

import { closeRun, openResume, openRun, patch } from '../src/lib/agent/sessions.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { ALL_RELEASES, defaultBoardDir, enableCloudBoard } from '../src/lib/cloud/boards.ts'
import { afterBoardWrite, flushCloudOutbox } from '../src/lib/cloud/publish.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { setBoardRoot, SESSIONS_DIR } from '../src/lib/paths.ts'

const SUPABASE = 'https://cloud.test'
const API = 'https://api.test'

let home = ''
let root = ''
let file = ''

/** A card asking the user, so the board has something to raise the moment it is free. */
const ASKING = '[user] Which way?'
const CARD = `---
title: A feature
priority: med
roi: high
status: todo
release: ""
blocked_by: []
related: []
modules: []
questions:
  - "${ASKING}"
---

An observable feature.

## Worth noting

<!-- agent -->

## Scope
A requirement.

## Todo
- [ ] Implement it.

## Decided by the agent

### Overruled by the user
`

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-notify-chain-home-'))
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-notify-chain-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon'
  process.env.AI4KANBAN_CLOUD_URL = API
  setBoardRoot(root)
  setBoardProvider(null)
  file = path.join(root, 'docs/kanban/todo/1-feature.md')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, CARD)
  fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '2\n')
  fs.writeFileSync(path.join(path.dirname(file), 'README.md'), '# Tasks\n\n- [ ] #1 [A feature](1-feature.md)\n')
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'a-token',
    refreshToken: 'r-token',
    expiresAt: Date.now() + 60 * 60_000,
    subject: '11111111-1111-4111-8111-111111111111',
  })
  enableCloudBoard(defaultBoardDir(root), root, ALL_RELEASES)
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

/** Stand in for the Worker, and keep every task it was asked to raise a row for. */
function fakeCloud(): number[] {
  const raised: number[] = []
  mock.method(globalThis, 'fetch', async (url: string | URL, init?: RequestInit) => {
    const at = String(url)
    const body = init?.body ? (JSON.parse(String(init.body)) as { taskId?: number }) : undefined
    if (!at.endsWith('/v1/events')) {
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    }
    raised.push(body?.taskId ?? 0)
    return new Response(
      JSON.stringify({
        event: { id: `e-${raised.length}`, boardId: '', taskId: body?.taskId, state: 'actionable', changedAt: 'now', acted: false },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  })
  return raised
}

/** A run of a fake agent that breaks the card's format, so its close starts the repair. */
function brokenRun(): string {
  const script = path.join(root, 'fake-agent.cjs')
  fs.writeFileSync(
    script,
    `
    const fs = require('node:fs');
    const file = ${JSON.stringify(file)};
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('## Scope', '## Scpoe'));
    console.log(JSON.stringify({type: 'result', result: 'Done'}));
  `,
  )
  fs.writeFileSync(
    path.join(root, 'docs/kanban/ui.config.json'),
    JSON.stringify({ harness: 'claude-code', harnessSettings: { 'claude-code': { command: `${process.execPath} ${script}` } } }),
  )
  const opened = openRun({ action: 'clarify', id: 1 }, 'Work the card.', [])
  if ('error' in opened) throw new Error(opened.error)
  opened.spec.plan.argv = [process.execPath, script]
  opened.spec.plan.harness = 'claude-code'
  fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
  patch(opened.run.sessionId, (r) => { r.pid = process.pid })
  return opened.run.sessionId
}

describe('a run that hands its card to the next agent', () => {
  it('raises nothing as it closes, and raises the card once the chain really ends', async () => {
    const raised = fakeCloud()
    const first = brokenRun()

    // The repair is opened and left running, which is what the watcher's own handoff looks
    // like from the outside: the closing run is off the record and its successor is on it.
    let repair = ''
    await watchRun(first, async (previous) => {
      // A board write landing in the gap itself — which is what the close does on its way
      // here: the card's stage put back, a recurring card stamped. Every board write is a
      // pass, so this is the one the handoff has to survive.
      await afterBoardWrite()
      await flushCloudOutbox()
      const opened = await openResume(previous)
      if ('error' in opened) return opened
      patch(opened.run.sessionId, (r) => { r.pid = process.pid })
      repair = opened.run.sessionId
      return { run: opened.run, spawned: true }
    })
    await flushCloudOutbox()

    assert.ok(repair, 'the close started the format repair')
    assert.deepEqual(raised, [], 'the card is still being worked, so nobody was interrupted')

    // And the end of the chain, which is the one moment the board has finished and the user
    // has not.
    await closeRun(repair, { status: 'done', ok: true, code: 0 })
    await flushCloudOutbox()

    assert.deepEqual(raised, [1], 'the question is the user’s again, and asked once')
  })
})
