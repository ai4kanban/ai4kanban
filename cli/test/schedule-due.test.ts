// When a scheduled agent may start (#1475): the gap, `auto`, failures in a row, and what
// holds a pass back once its time has come.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { scheduleDue, type DueAsk } from '../src/lib/agent/due.ts'
import type { RunStatus } from '../src/lib/agent/types.ts'

const HOUR = 3_600_000
const T0 = new Date('2026-10-01T09:00').getTime()

const ask = (over: Partial<DueAsk> = {}): DueAsk => ({
  cadence: 'auto',
  fallback: '1d',
  reads: true,
  from: T0,
  attempts: [],
  newWork: () => true,
  backlog: () => false,
  ...over,
})

const tries = (...statuses: RunStatus[]) => statuses.map((status, i) => ({ startedAt: T0 + i * 60_000, status }))

describe('the gap', () => {
  it('is an hour in auto for an agent that reads something', () => {
    assert.equal(scheduleDue(ask(), T0 + HOUR - 60_000).wait, 'tooSoon')
    assert.equal(scheduleDue(ask(), T0 + HOUR).wait, null)
  })

  it("is the agent's own default in auto when it reads nothing", () => {
    assert.equal(scheduleDue(ask({ reads: false }), T0 + 23 * HOUR).wait, 'tooSoon')
    assert.equal(scheduleDue(ask({ reads: false }), T0 + 24 * HOUR).wait, null)
  })

  it('is the cadence the user set, in place of auto', () => {
    assert.equal(scheduleDue(ask({ cadence: '6h' }), T0 + 5 * HOUR).wait, 'tooSoon')
    assert.equal(scheduleDue(ask({ cadence: '6h' }), T0 + 6 * HOUR).wait, null)
  })

  it('counts from the newest attempt', () => {
    const attempts = [{ startedAt: T0 + 2 * HOUR, status: 'done' as const }]
    assert.equal(scheduleDue(ask({ attempts }), T0 + 2.5 * HOUR).wait, 'tooSoon')
  })

  it('is no gap at all for a round that goes on', () => {
    assert.equal(scheduleDue(ask({ goesOn: true }), T0).wait, null)
  })
})

describe('failures in a row', () => {
  it('wait the plain gap after the first, then double it', () => {
    const last = (n: number) => T0 + (n - 1) * 60_000
    assert.equal(scheduleDue(ask({ attempts: tries('error') }), last(1) + HOUR).wait, null)
    assert.equal(scheduleDue(ask({ attempts: tries('error', 'error') }), last(2) + HOUR).wait, 'tooSoon')
    assert.equal(scheduleDue(ask({ attempts: tries('error', 'error') }), last(2) + 2 * HOUR).wait, null)
    assert.equal(scheduleDue(ask({ attempts: tries('error', 'error', 'error') }), last(3) + 3 * HOUR).wait, 'tooSoon')
    assert.equal(scheduleDue(ask({ attempts: tries('error', 'error', 'error') }), last(3) + 4 * HOUR).wait, null)
  })

  it('stop at a day', () => {
    const attempts = tries(...Array<RunStatus>(10).fill('error'))
    assert.equal(scheduleDue(ask({ attempts }), T0 + 9 * 60_000 + 24 * HOUR).wait, null)
  })

  it('count from the last pass that passed', () => {
    assert.equal(scheduleDue(ask({ attempts: tries('error', 'error', 'done') }), T0 + 2 * 60_000 + HOUR).wait, null)
  })
})

describe('once its time has come', () => {
  it('waits for something new', () => {
    assert.equal(scheduleDue(ask({ newWork: () => false }), T0 + HOUR).wait, 'nothingNew')
  })

  it('waits while what it sent to triage is unhandled', () => {
    assert.equal(scheduleDue(ask({ backlog: () => true }), T0 + HOUR).wait, 'unsorted')
  })

  it('waits while a card is being built', () => {
    assert.equal(scheduleDue(ask({ building: () => true }), T0 + HOUR).wait, 'building')
  })
})
