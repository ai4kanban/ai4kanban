// What the bell does with a connection that missed things, or heard one thing twice (#329).
//
// Realtime carries hints and nothing else, so every path — a hint, a reconnect's catch-up
// read, the read a start makes — hands one event through the same rule. What is asked here is
// that the rule is the one thing deciding, and that it is right for all three: a broadcast
// delivered twice interrupts nobody, a broadcast never delivered costs nothing because the
// catch-up carries it, and a restart that finds a week of changes says nothing at all.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { alertFor } from '../src/lib/cloud/center.ts'
import type { CloudEvent, CloudEventState } from '../src/lib/cloud/events.ts'

const event = (over: Partial<CloudEvent> = {}): CloudEvent =>
  ({
    id: 'e-1',
    boardId: 'b-1',
    boardName: 'ai4kanban',
    taskId: 12,
    taskTitle: 'A task',
    release: '0.8.0',
    revision: 'r1',
    kind: 'ready_for_review',
    decision: 'implement',
    state: 'actionable' as CloudEventState,
    questions: [],
    summary: '',
    notes: '',
    serverName: '',
    createdAt: '2026-08-01T00:00:00Z',
    changedAt: '2026-08-01T00:00:00Z',
    acted: false,
    ...over,
  }) as CloudEvent

describe('a reconnect that missed broadcasts', () => {
  it('raises the actionable event the catch-up read carries', () => {
    const raise = alertFor(undefined, event(), false)
    assert.equal(raise?.kind, 'actionable')
    assert.equal(raise?.title, '#12 A task')
  })

  it('raises the outcome of a delivery that ended while the socket was down', () => {
    const before = event({ state: 'running', acted: true })
    const after = event({ state: 'completed', acted: true, changedAt: '2026-08-01T01:00:00Z' })
    assert.equal(alertFor(before, after, false)?.kind, 'outcome')
  })

  it('raises a delivery that both started and ended while the socket was down', () => {
    // No `before` at all, because this machine never saw it running. It is still the outcome
    // of something the user approved and may have walked away from.
    assert.equal(alertFor(undefined, event({ state: 'completed', acted: true }), false)?.kind, 'outcome')
  })

  it('says nothing about an event that ended with nobody acting on it', () => {
    // Retired as `stale`, or ended without an action: there was no delivery to report.
    assert.equal(alertFor(undefined, event({ state: 'stale' }), false), null)
    assert.equal(alertFor(undefined, event({ state: 'failed', acted: false }), false), null)
  })
})

describe('the same broadcast delivered twice', () => {
  it('interrupts nobody the second time', () => {
    const held = event()
    assert.ok(alertFor(undefined, held, false))
    assert.equal(alertFor(held, held, false), null)
  })

  it('interrupts nobody the second time an outcome arrives', () => {
    const before = event({ state: 'running', acted: true })
    const done = event({ state: 'completed', acted: true, changedAt: '2026-08-01T01:00:00Z' })
    assert.ok(alertFor(before, done, false))
    assert.equal(alertFor(done, done, false), null)
  })
})

describe('a refresh in place', () => {
  it('says nothing — it is the same piece of work the user was already told about', () => {
    const before = event()
    const moved = event({ revision: 'r2', changedAt: '2026-08-01T02:00:00Z' })
    assert.equal(alertFor(before, moved, false), null)
  })
})

describe('a restart across an event, an answer and a finished delivery', () => {
  it('draws all three and interrupts over none of them', () => {
    const landed = [
      event({ id: 'e-1' }),
      event({ id: 'e-2', state: 'accepted', acted: true }),
      event({ id: 'e-3', state: 'completed', acted: true }),
    ]
    // The person launching the app is in front of it, so the first read is silent.
    for (const one of landed) assert.equal(alertFor(undefined, one, true), null)
  })
})

describe('a cancellation', () => {
  it('interrupts nobody — the user is the one who did it', () => {
    const before = event({ state: 'running', acted: true })
    const gone = event({ state: 'cancelled', acted: true, changedAt: '2026-08-01T01:00:00Z' })
    assert.equal(alertFor(before, gone, false), null)
  })
})
