// The moments the board cheers for (#1331): which landings count, and what each says.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { DeliveryLanding, DeliveryRecord } from '../src/lib/agent/types.ts'
import { cheersOf } from '../src/lib/view/cheer.ts'

const DAY = new Date(2026, 9, 2).getTime()
const HOUR = 3_600_000

let n = 0
const delivery = (hour: number, landing: Partial<DeliveryLanding> | null, over: Partial<DeliveryRecord> = {}): DeliveryRecord => ({
  deliveryId: `d${++n}`,
  cardId: 100 + n,
  title: `card ${100 + n}`,
  status: 'finished',
  startedAt: DAY,
  endedAt: DAY + hour * HOUR,
  sessions: [],
  approved: '',
  steps: [],
  landing: landing ? { status: 'landed', attempts: 0, at: 0, commit: 'abc', closed: {}, ...landing } : undefined,
  ...over,
})

describe('what a day of landings cheers for', () => {
  it('cheers the first landing of the day, and no later plain one', () => {
    const first = delivery(9, {})
    const cheers = cheersOf([delivery(11, {}), first], DAY)
    assert.deepEqual(cheers, [
      { key: first.deliveryId, at: first.endedAt, kind: 'first', id: first.cardId, title: first.title },
    ])
  })

  it('cheers a closed group with its root and finished subtasks', () => {
    const closing = delivery(10, { closed: { group: { id: 250, title: 'Task import', done: 6 } } })
    const cheers = cheersOf([delivery(9, {}), closing], DAY)
    assert.deepEqual(cheers[0], {
      key: closing.deliveryId,
      at: closing.endedAt,
      kind: 'group',
      id: 250,
      title: 'Task import',
      count: 6,
    })
    assert.equal(cheers[1]!.kind, 'first')
  })

  it('cheers a finished release, ahead of everything else', () => {
    const shipped = delivery(12, { closed: { release: { id: 'v0.9', done: 12 } } })
    const cheers = cheersOf([delivery(9, {}), delivery(10, { closed: { group: { id: 250, title: 'g', done: 2 } } }), shipped], DAY)
    assert.deepEqual(cheers.map((c) => c.kind), ['release', 'group', 'first'])
    assert.deepEqual(cheers[0], { key: shipped.deliveryId, at: shipped.endedAt, kind: 'release', release: 'v0.9', count: 12 })
  })

  it('says one thing for a landing that is several', () => {
    const all = delivery(9, { closed: { group: { id: 250, title: 'g', done: 2 }, release: { id: 'v1', done: 3 } } })
    assert.deepEqual(cheersOf([all], DAY).map((c) => c.kind), ['release'])
  })

  it('cheers nothing that never landed a commit, nor anything from yesterday', () => {
    const quiet = [
      delivery(9, null), // manual commit mode: no landing at all
      delivery(9, { commit: undefined }), // ended with no change
      delivery(9, {}, { status: 'cancelled' }), // discarded or superseded
      delivery(9, {}, { status: 'failed' }),
      delivery(9, { closed: undefined }), // its card was never archived by the landing
      delivery(9, {}, { cardId: null }),
      delivery(-2, { closed: { group: { id: 250, title: 'g', done: 2 } } }),
    ]
    assert.deepEqual(cheersOf(quiet, DAY), [])
  })
})
