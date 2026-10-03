// Pruning as an agent rather than a card (#514).
//
// What is asked here: the schedule always runs, every 7 days unless somebody sets another
// cadence (#1208); an invalid cadence is refused; the first prune lands a whole cadence after
// the board first looks; a pass that failed does not fire again on the next tick; and a board
// still carrying the old "Prune the memory" card is migrated once — the card goes, its
// cadence stays.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { memoryPrune, setMemoryPrune, stampMemoryPrune } from '../src/lib/agent/settings.ts'
import { migratePruneMemoryCard } from '../src/lib/recurring.ts'
import { setBoardRoot, SESSIONS, UI_CONFIG } from '../src/lib/paths.ts'
import { nextWork } from '../src/lib/view/dispatch.ts'

let root = ''

const kanban = (): string => path.join(root, 'docs', 'kanban')

/** An old prune card, as a board made before this release carries one. */
const pruneCard = (cadence: string): void => {
  const dir = path.join(kanban(), 'todo', 'recurring')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(
    path.join(dir, '9-prune-the-memory.md'),
    [
      '---',
      'title: Prune the memory',
      'priority: med',
      'roi: med',
      'status: todo',
      `cadence: ${cadence}`,
      'blocked_by: []',
      'related: []',
      'modules: []',
      'questions: []',
      '---',
      '',
      'Squeeze the memory files back down.',
      '',
      '## Process',
      '1. Prune it.',
      '',
    ].join('\n'),
  )
}

/** One finished prune run in the record, so the dispatcher can see what the last pass did. */
const pastRun = (status: string, startedAt: number): void => {
  fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
  fs.writeFileSync(
    SESSIONS,
    JSON.stringify({
      runs: [
        {
          sessionId: 'past',
          cardId: null,
          action: 'prune-memory',
          status,
          startedAt,
          endedAt: startedAt + 1,
          harness: 'claude-code',
          logPath: '/dev/null',
        },
      ],
      deliveries: [],
    }),
  )
}

const work = (): Promise<{ action: string }[]> => nextWork(() => Promise.resolve(true))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-pruner-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '1\n')
  // A described project, so the project writer (#1268) is not due alongside.
  fs.mkdirSync(path.join(kanban(), 'memory'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'memory', 'project.md'), '# Project\n\n## What it is\n')
  setBoardRoot(root)
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe("the pruner's schedule", () => {
  it('runs every 7 days until somebody sets a cadence, and writes nothing down', () => {
    assert.deepEqual(memoryPrune(), { enabled: true, cadence: '7d', lastRun: '' })
    assert.equal(fs.existsSync(UI_CONFIG), false)
  })

  it('refuses a cadence it cannot act on, and leaves the saved one alone', () => {
    assert.equal(setMemoryPrune({ enabled: true, cadence: '1d at 09:30' }).ok, true)
    const bad = setMemoryPrune({ enabled: true, cadence: 'every so often' })
    assert.equal(bad.ok, false)
    assert.match(bad.error!, /isn't a cadence/)
    assert.deepEqual(memoryPrune(), { enabled: true, cadence: '1d at 09:30', lastRun: '' })
  })

  it('reads a hand-written cadence nothing parses as the default', () => {
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ memoryPrune: { enabled: true, cadence: 'soon' } }))
    assert.deepEqual(memoryPrune(), { enabled: true, cadence: '7d', lastRun: '' })
  })

  it('reads a schedule an earlier release switched off as on, at its saved cadence', () => {
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ memoryPrune: { enabled: false, cadence: '3d' } }))
    assert.deepEqual(memoryPrune(), { enabled: true, cadence: '3d', lastRun: '' })
  })

  it('saves Off as its own key, keeping the cadence and the stamps', () => {
    stampMemoryPrune(new Date(2026, 8, 8, 9, 30))
    assert.equal(setMemoryPrune({ enabled: false, cadence: '1d' }).ok, true)
    assert.deepEqual(memoryPrune(), { enabled: false, cadence: '1d', lastRun: '2026-09-08 09:30' })
    assert.equal(JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')).memoryPrune.off, true)
    assert.equal(setMemoryPrune({ enabled: true, cadence: '1d' }).ok, true)
    assert.equal(JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')).memoryPrune.off, undefined)
  })
})

describe('the prune the board starts on its own', () => {
  it('starts none on its first look, and counts the cadence from that look', async () => {
    assert.deepEqual(await work(), [])
    const since = JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')).memoryPrune.since
    assert.match(since, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    // Never run is still what the page says, and a cadence change keeps the start.
    assert.equal(memoryPrune().lastRun, '')
    setMemoryPrune({ enabled: true, cadence: '6h' })
    assert.equal(memoryPrune().since, since)
    assert.deepEqual(await work(), [])
  })

  it('starts one once a cadence has passed since that look', async () => {
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ memoryPrune: { since: '2026-01-01 09:00' } }))
    assert.deepEqual(await work(), [{ action: 'prune-memory' }])
  })

  it('starts one once the cadence has passed since the last pass', async () => {
    setMemoryPrune({ enabled: true, cadence: '30m' })
    stampMemoryPrune(new Date(Date.now() - 60 * 60_000))
    assert.deepEqual(await work(), [{ action: 'prune-memory' }])
  })

  it('waits out the interval after a pass that passed', async () => {
    setMemoryPrune({ enabled: true, cadence: '30m' })
    stampMemoryPrune()
    assert.deepEqual(await work(), [])
  })

  it('does not fire again after a pass that failed in the same window', async () => {
    setMemoryPrune({ enabled: true, cadence: '30m' })
    stampMemoryPrune(new Date(Date.now() - 60 * 60_000))
    pastRun('error', Date.now() - 1000)
    assert.deepEqual(await work(), [])
  })

  it('starts none while it is off', async () => {
    setMemoryPrune({ enabled: false, cadence: '30m' })
    stampMemoryPrune(new Date(Date.now() - 60 * 60_000))
    assert.deepEqual(await work(), [])
  })

  it('starts nothing while a pass is going', async () => {
    setMemoryPrune({ enabled: true, cadence: '30m' })
    stampMemoryPrune(new Date(Date.now() - 60 * 60_000))
    pastRun('running', Date.now() - 1000)
    assert.deepEqual(await work(), [])
  })

  it('comes round again once the failed window has passed', async () => {
    setMemoryPrune({ enabled: true, cadence: '30m' })
    // The stamp puts the next due time half an hour out; the failed run is older than that,
    // so it belongs to an earlier window and says nothing about this one.
    stampMemoryPrune(new Date(Date.now() - 60 * 60_000))
    pastRun('error', Date.now() - 45 * 60_000)
    assert.deepEqual(await work(), [{ action: 'prune-memory' }])
  })
})

describe('a board still carrying the prune card', () => {
  it('loses the card once and keeps its cadence', () => {
    pruneCard('1d at 09:30')
    const removed = migratePruneMemoryCard()
    assert.match(removed!, /9-prune-the-memory\.md$/)
    assert.deepEqual(memoryPrune(), { enabled: true, cadence: '1d at 09:30', lastRun: '' })
    assert.deepEqual(fs.readdirSync(path.join(kanban(), 'todo', 'recurring')), [])
    // And a second pass finds nothing to do, so re-running the repair is free.
    assert.equal(migratePruneMemoryCard(), null)
  })

  it('never overwrites a cadence already set on the agent', () => {
    setMemoryPrune({ enabled: true, cadence: '6h' })
    pruneCard('1d at 09:30')
    migratePruneMemoryCard()
    assert.deepEqual(memoryPrune(), { enabled: true, cadence: '6h', lastRun: '' })
  })

  it('takes a card with no cadence off without writing a preference', () => {
    pruneCard('')
    assert.ok(migratePruneMemoryCard())
    assert.equal(fs.existsSync(UI_CONFIG), false)
  })
})
