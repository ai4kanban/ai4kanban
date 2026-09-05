// What the app and the command report about their own use (#295).
//
// What is asked here: nothing is queued from a machine that said no, nothing is queued on
// the app before the disclosure step is answered, each event carries its surface and no
// card, the queue is capped, and the sender goes out at most once a day, clears only what
// it sent, and never turns a bad day at the endpoint into a retry loop.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { LIMITS, VERSION } from '../../telemetry/contract.ts'
import type { SentBatch, SentEvent } from '../../telemetry/contract.ts'
import { SKILL_VERSION } from '../src/version.ts'
import { runAgent } from '../src/lib/agent-cli.ts'
import {
  readUsageReporting,
  recordUsageDisclosure,
  setUsageReporting,
  usageQueueFile,
  usageStateFile,
} from '../src/lib/machine/telemetry.ts'
import {
  reportAppOpen,
  reportChatMessage,
  reportRun,
  reportUsage,
  sendUsage,
  usageDay,
} from '../src/lib/machine/usage.ts'

let home = ''

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-usage-'))
  process.env.AI4KANBAN_HOME = home
  // An `akb` an agent typed inside a run reports nothing, and this suite is not one.
  delete process.env.KANBAN_RUN
  delete process.env.KANBAN_DESKTOP
  delete process.env.AI4KANBAN_USAGE_URL
})

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true })
  delete process.env.AI4KANBAN_HOME
  delete process.env.AI4KANBAN_USAGE_URL
  delete process.env.KANBAN_DESKTOP
})

/** The queue as the sender would read it. */
const queued = (): SentEvent[] =>
  fs.existsSync(usageQueueFile())
    ? fs
        .readFileSync(usageQueueFile(), 'utf8')
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as SentEvent)
    : []

const names = (): string[] => queued().map((e) => e.name)

const state = (): Record<string, unknown> =>
  fs.existsSync(usageStateFile()) ? (JSON.parse(fs.readFileSync(usageStateFile(), 'utf8')) as Record<string, unknown>) : {}

const putState = (values: Record<string, unknown>): void => {
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(usageStateFile(), JSON.stringify(values))
}

/** Today's batch already attempted, so a queue test never posts anywhere. */
const dayAlreadySent = (): void => putState({ sentDay: usageDay() })

/** A command line run for what it reports rather than for what it prints. */
async function quietly(work: () => Promise<number>): Promise<void> {
  const said = { log: console.log, error: console.error }
  console.log = () => {}
  console.error = () => {}
  try {
    await work()
  } finally {
    console.log = said.log
    console.error = said.error
  }
}

describe('what is queued', () => {
  it('reports nothing at all from a machine that said no', () => {
    assert.deepEqual(setUsageReporting(false), { ok: true })
    reportAppOpen('command')
    reportRun('started', 'claude-code')
    reportChatMessage()
    assert.equal(fs.existsSync(usageQueueFile()), false)
    assert.equal(readUsageReporting().installId, '')
  })

  it('makes the install id on the first event and never before', () => {
    dayAlreadySent()
    assert.equal(readUsageReporting().installId, '')
    reportChatMessage()
    assert.notEqual(readUsageReporting().installId, '')
  })

  it('queues nothing on the app while the disclosure step is still owed', () => {
    dayAlreadySent()
    reportAppOpen('app')
    assert.deepEqual(names(), [])
    assert.deepEqual(recordUsageDisclosure(true), { ok: true })
    reportAppOpen('app')
    assert.deepEqual(names(), ['app_day', 'app_open'])
  })

  it('reports from a terminal without waiting for a step no terminal shows', () => {
    dayAlreadySent()
    reportAppOpen('command')
    assert.deepEqual(names(), ['app_day', 'app_open'])
  })

  it('says the version, the operating system and whether this is the first open', () => {
    dayAlreadySent()
    reportAppOpen('command')
    const open = queued().find((e) => e.name === 'app_open')!
    assert.equal(open.version, SKILL_VERSION)
    assert.equal(open.surface, 'command')
    assert.equal(open.first_run, true)
    assert.equal(typeof open.os, 'string')
    assert.equal(typeof open.arch, 'string')
    assert.equal(open.day, usageDay())
  })

  it('is not a first open once the install has one', () => {
    dayAlreadySent()
    reportAppOpen('command')
    putState({ ...state(), openDay: '' })
    reportAppOpen('command')
    const opens = queued().filter((e) => e.name === 'app_open')
    assert.deepEqual(
      opens.map((e) => e.first_run),
      [true, false],
    )
  })

  it("reports the command's open once a day, whatever an agent types in between", () => {
    dayAlreadySent()
    reportAppOpen('command')
    reportAppOpen('command')
    reportAppOpen('command')
    assert.equal(names().filter((n) => n === 'app_open').length, 1)
  })

  it('reports nothing from an `akb` the board itself started', () => {
    dayAlreadySent()
    process.env.KANBAN_RUN = 'a-session-id'
    try {
      reportAppOpen('command')
    } finally {
      delete process.env.KANBAN_RUN
    }
    assert.deepEqual(names(), [])
  })

  it('counts the command a person typed and not the watcher the board spawns', async () => {
    dayAlreadySent()
    // The watcher comes through the same door, one per run, on the environment that
    // started it — and on the app an open is counted on every launch, not once a day.
    process.env.KANBAN_DESKTOP = '1'
    assert.deepEqual(recordUsageDisclosure(true), { ok: true })
    await quietly(() => runAgent(['__watch', 'no-such-run']))
    await quietly(() => runAgent(['__watch', 'another-run']))
    assert.deepEqual(names(), [])
    await quietly(() => runAgent(['--help']))
    assert.deepEqual(names(), ['app_day', 'app_open'])
  })

  it('sends one "used today" in front of the day and no more', () => {
    dayAlreadySent()
    reportChatMessage()
    reportChatMessage()
    reportRun('started', 'codex')
    assert.deepEqual(names(), ['app_day', 'chat_message', 'chat_message', 'run_started'])
    assert.equal(state().dayEvent, usageDay())
  })

  it('carries the agent on a run and nothing about the card', () => {
    dayAlreadySent()
    reportRun('finished', 'claude-code')
    const run = queued().find((e) => e.name === 'run_finished')!
    assert.equal(run.harness, 'claude-code')
    assert.deepEqual(Object.keys(run).sort(), ['day', 'harness', 'id', 'name', 'surface', 'version'])
  })

  it('leaves out a harness the endpoint would refuse rather than sending it', () => {
    dayAlreadySent()
    reportRun('failed', 'an agent nobody named')
    const run = queued().find((e) => e.name === 'run_failed')!
    assert.equal(run.harness, undefined)
  })

  it('says `app` for everything under the board server the app starts', () => {
    dayAlreadySent()
    assert.deepEqual(recordUsageDisclosure(true), { ok: true })
    process.env.KANBAN_DESKTOP = '1'
    reportChatMessage()
    assert.deepEqual(
      queued().map((e) => e.surface),
      ['app', 'app'],
    )
  })

  it('caps the queue and drops the oldest', () => {
    dayAlreadySent()
    for (let i = 0; i < LIMITS.batchEvents + 20; i += 1) reportChatMessage()
    const all = queued()
    assert.equal(all.length, LIMITS.batchEvents)
    // The one event that was there first — the day's own — is the first to go.
    assert.equal(all.some((e) => e.name === 'app_day'), false)
  })

  it('drops what was queued, and what the sender remembers, when reporting is turned off', () => {
    dayAlreadySent()
    reportChatMessage()
    assert.equal(fs.existsSync(usageQueueFile()), true)
    assert.deepEqual(setUsageReporting(false), { ok: true })
    assert.equal(fs.existsSync(usageQueueFile()), false)
    assert.equal(fs.existsSync(usageStateFile()), false)
  })
})

// ---- the sender -------------------------------------------------------------

/** A stand-in for #294's endpoint: what it was posted, and what it answers. */
async function endpoint(status = 202): Promise<{ url: string; batches: SentBatch[]; close: () => Promise<void> }> {
  const batches: SentBatch[] = []
  const server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        batches.push(JSON.parse(body) as SentBatch)
      } catch {
        // a body that is not a batch is the test's problem, not the server's
      }
      res.writeHead(status, { 'content-type': 'application/json' }).end('{"ok":true}')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  return {
    url: `http://127.0.0.1:${port}/v1/batch`,
    batches,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

/** Reporting an event also asks the sender whether this is the moment, so a test that
 *  wants to watch ONE send parks that minute at the end of the day first, then lets the
 *  no-op attempts settle before moving it. */
const PARKED = 1439

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('the sender', () => {
  it('posts one batch under this machine’s install id, and clears what it sent', async () => {
    const at = await endpoint()
    process.env.AI4KANBAN_USAGE_URL = at.url
    try {
      putState({ sendMinute: PARKED })
      reportChatMessage()
      reportRun('started', 'codex')
      await settle()
      putState({ ...state(), sendMinute: 0 })
      await sendUsage()
      assert.equal(at.batches.length, 1)
      const batch = at.batches[0]!
      assert.equal(batch.v, VERSION)
      assert.equal(batch.install, readUsageReporting().installId)
      assert.deepEqual(
        batch.events.map((e) => e.name),
        ['app_day', 'chat_message', 'run_started'],
      )
      assert.deepEqual(queued(), [])
    } finally {
      await at.close()
    }
  })

  it('sends at most one batch a day', async () => {
    const at = await endpoint()
    process.env.AI4KANBAN_USAGE_URL = at.url
    try {
      putState({ sendMinute: 0 })
      reportChatMessage()
      await sendUsage()
      reportChatMessage()
      await sendUsage()
      assert.equal(at.batches.length, 1)
      assert.equal(state().sentDay, usageDay())
      // …and the event that came after it is still waiting, not lost.
      assert.deepEqual(names(), ['chat_message'])
    } finally {
      await at.close()
    }
  })

  it("waits for the minute the install picked before sending today's own events", async () => {
    const at = await endpoint()
    process.env.AI4KANBAN_USAGE_URL = at.url
    try {
      putState({ sendMinute: PARKED })
      reportChatMessage()
      await settle()
      await sendUsage(new Date(new Date().setHours(9, 0, 0, 0)))
      assert.equal(at.batches.length, 0)
      assert.equal(state().sentDay, undefined)
    } finally {
      await at.close()
    }
  })

  it('sends a queue left over from an earlier day at the first opportunity', async () => {
    const at = await endpoint()
    process.env.AI4KANBAN_USAGE_URL = at.url
    try {
      putState({ sendMinute: PARKED })
      reportChatMessage()
      await settle()
      // …and the day turns over with it still queued.
      const day = usageDay(new Date(Date.now() - 86_400_000))
      fs.writeFileSync(
        usageQueueFile(),
        `${queued()
          .map((e) => JSON.stringify({ ...e, day }))
          .join('\n')}\n`,
      )
      await sendUsage(new Date(new Date().setHours(9, 0, 0, 0)))
      assert.equal(at.batches.length, 1)
    } finally {
      await at.close()
    }
  })

  it('keeps its events and spends the day when the endpoint is down', async () => {
    // Nothing is listening on this port.
    process.env.AI4KANBAN_USAGE_URL = 'http://127.0.0.1:9/v1/batch'
    putState({ sendMinute: 0 })
    reportChatMessage()
    await sendUsage()
    assert.deepEqual(names(), ['app_day', 'chat_message'])
    assert.equal(state().sentDay, usageDay())
  })

  it('keeps its events when the endpoint refuses the batch', async () => {
    const at = await endpoint(500)
    process.env.AI4KANBAN_USAGE_URL = at.url
    try {
      putState({ sendMinute: 0 })
      reportChatMessage()
      await sendUsage()
      assert.deepEqual(names(), ['app_day', 'chat_message'])
    } finally {
      await at.close()
    }
  })

  it('sends nothing from a machine that said no, whatever is on disk', async () => {
    const at = await endpoint()
    process.env.AI4KANBAN_USAGE_URL = at.url
    try {
      putState({ sendMinute: PARKED })
      reportChatMessage()
      await settle()
      assert.deepEqual(setUsageReporting(false), { ok: true })
      putState({ sendMinute: 0 })
      await sendUsage()
      assert.equal(at.batches.length, 0)
    } finally {
      await at.close()
    }
  })

  it('never posts a batch bigger than the endpoint reads', async () => {
    const at = await endpoint()
    process.env.AI4KANBAN_USAGE_URL = at.url
    try {
      putState({ sendMinute: PARKED })
      for (let i = 0; i < LIMITS.batchEvents; i += 1) reportRun('started', 'claude-code')
      await settle()
      putState({ ...state(), sendMinute: 0 })
      await sendUsage()
      const batch = at.batches[0]!
      assert.ok(Buffer.byteLength(JSON.stringify(batch)) <= LIMITS.batchBytes)
      assert.ok(batch.events.length < LIMITS.batchEvents)
      // What did not fit is still queued rather than dropped.
      assert.ok(queued().length > 0)
    } finally {
      await at.close()
    }
  })

  it('never makes a caller wait on it', () => {
    process.env.AI4KANBAN_USAGE_URL = 'http://127.0.0.1:9/v1/batch'
    putState({ sendMinute: 0 })
    const started = Date.now()
    reportUsage('chat_message')
    assert.ok(Date.now() - started < 500)
  })
})
