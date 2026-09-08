// Pruning as an agent rather than a card (#514).
//
// What is asked here: the schedule is off until somebody asks for it and an invalid cadence
// can never turn it on, the board starts a prune only when an enabled schedule is due, a
// pass that failed does not fire again on the next tick, and a board still carrying the old
// "Prune the memory" card is migrated once — the card goes, its cadence stays, and
// recurrence stays off across a restart.

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
  setBoardRoot(root)
})

afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe("the pruner's schedule", () => {
  it('is off with no cadence until somebody asks for one', () => {
    assert.deepEqual(memoryPrune(), { enabled: false, cadence: '', lastRun: '' })
    // Nothing is written down until there is something to write: the file records what
    // somebody changed, never the default.
    assert.equal(fs.existsSync(UI_CONFIG), false)
  })

  it('refuses a cadence it cannot act on, and leaves the saved one alone', () => {
    assert.equal(setMemoryPrune({ enabled: true, cadence: '1d at 09:30' }).ok, true)
    const bad = setMemoryPrune({ enabled: true, cadence: 'every so often' })
    assert.equal(bad.ok, false)
    assert.match(bad.error!, /isn't a cadence/)
    assert.deepEqual(memoryPrune(), { enabled: true, cadence: '1d at 09:30', lastRun: '' })
  })

  it('reads a hand-written switch with no usable cadence as off', () => {
    fs.writeFileSync(UI_CONFIG, JSON.stringify({ memoryPrune: { enabled: true, cadence: 'soon' } }))
    assert.equal(memoryPrune().enabled, false)
  })

  it('keeps the last pass when the switch is turned off, and turning it off drops the key', () => {
    setMemoryPrune({ enabled: true, cadence: '30m' })
    stampMemoryPrune(new Date(2026, 8, 8, 9, 30))
    assert.equal(memoryPrune().lastRun, '2026-09-08 09:30')

    setMemoryPrune({ enabled: false, cadence: '30m' })
    assert.deepEqual(memoryPrune(), { enabled: false, cadence: '30m', lastRun: '2026-09-08 09:30' })
    assert.equal(JSON.parse(fs.readFileSync(UI_CONFIG, 'utf8')).memoryPrune.enabled, undefined)
  })
})

describe('the prune the board starts on its own', () => {
  it('starts nothing while recurrence is off, whatever cadence is saved', async () => {
    setMemoryPrune({ enabled: false, cadence: '30m' })
    assert.deepEqual(await work(), [])
  })

  it('starts one once an enabled schedule is due', async () => {
    setMemoryPrune({ enabled: true, cadence: '30m' })
    assert.deepEqual(await work(), [{ action: 'prune-memory' }])
  })

  it('waits out the interval after a pass that passed', async () => {
    setMemoryPrune({ enabled: true, cadence: '30m' })
    stampMemoryPrune()
    assert.deepEqual(await work(), [])
  })

  it('does not fire again after a pass that failed in the same window', async () => {
    setMemoryPrune({ enabled: true, cadence: '30m' })
    pastRun('error', Date.now() - 1000)
    assert.deepEqual(await work(), [])
  })

  it('starts nothing while a pass is going', async () => {
    setMemoryPrune({ enabled: true, cadence: '30m' })
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
  it('loses the card once and keeps its cadence, switched off', () => {
    pruneCard('1d at 09:30')
    const removed = migratePruneMemoryCard()
    assert.match(removed!, /9-prune-the-memory\.md$/)
    assert.deepEqual(memoryPrune(), { enabled: false, cadence: '1d at 09:30', lastRun: '' })
    assert.deepEqual(fs.readdirSync(path.join(kanban(), 'todo', 'recurring')), [])
    // And a second pass finds nothing to do, so re-running the repair is free.
    assert.equal(migratePruneMemoryCard(), null)
    assert.equal(memoryPrune().enabled, false)
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
    assert.deepEqual(memoryPrune(), { enabled: false, cadence: '', lastRun: '' })
  })

  it('stays off after a restart', async () => {
    pruneCard('30m')
    migratePruneMemoryCard()
    setBoardRoot(root) // the next process opens the same board
    assert.equal(memoryPrune().enabled, false)
    assert.deepEqual(await work(), [])
  })
})
