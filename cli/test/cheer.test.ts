// The moments the board cheers for (#1331, #1515): which archives count, and what each says.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cheersOf, type Completion } from '../src/lib/view/cheer.ts'

const DAY = new Date(2026, 9, 2).getTime()
const HOUR = 3_600_000

let n = 0
const done = (hour: number, over: Partial<Completion> = {}): Completion => {
  const id = 100 + ++n
  return { id, title: `card ${id}`, at: DAY + hour * HOUR, ...over }
}
const keyOf = (c: Completion): string => `${c.id}@${c.at}`

describe('what a day of archives cheers for', () => {
  it('cheers the first archive of the day, and no later plain one', () => {
    const first = done(9)
    assert.deepEqual(cheersOf([done(11), first], DAY), [
      { key: keyOf(first), at: first.at, kind: 'first', id: first.id, title: first.title },
    ])
  })

  it('cheers a closed group with its root and finished subtasks', () => {
    const closing = done(10, { group: { id: 250, title: 'Task import', done: 6 } })
    const cheers = cheersOf([done(9), closing], DAY)
    assert.deepEqual(cheers[0], { key: keyOf(closing), at: closing.at, kind: 'group', id: 250, title: 'Task import', count: 6 })
    assert.equal(cheers[1]!.kind, 'first')
  })

  it('cheers a finished release, ahead of everything else', () => {
    const shipped = done(12, { release: { id: 'v0.9', done: 12 } })
    const cheers = cheersOf([done(9), done(10, { group: { id: 250, title: 'g', done: 2 } }), shipped], DAY)
    assert.deepEqual(cheers.map((c) => c.kind), ['release', 'group', 'first'])
    assert.deepEqual(cheers[0], { key: keyOf(shipped), at: shipped.at, kind: 'release', release: 'v0.9', count: 12 })
  })

  it('says one thing for an archive that is several', () => {
    const all = done(9, { group: { id: 250, title: 'g', done: 2 }, release: { id: 'v1', done: 3 } })
    assert.deepEqual(cheersOf([all], DAY).map((c) => c.kind), ['release'])
  })

  it('cheers nothing from yesterday, and lets today’s first be today’s', () => {
    const today = done(9)
    const cheers = cheersOf([done(-2, { group: { id: 250, title: 'g', done: 2 } }), today], DAY)
    assert.deepEqual(cheers.map((c) => [c.kind, c.id]), [['first', today.id]])
  })
})
