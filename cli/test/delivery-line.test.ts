// Which sentence a delivery's line is, and the values it names (#1377): what a screen words
// in its own language, while `label` and `line` stay the terminal's English.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { boardCommand } from '../src/lib/agent/command.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { readStore, withStore } from '../src/lib/agent/store.ts'
import type { DeliveryLanding, DeliveryRecord } from '../src/lib/agent/types.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState } from './helpers/board.ts'

const base: DeliveryRecord = {
  deliveryId: 'aaa',
  cardId: 1,
  title: 'card one',
  status: 'active',
  startedAt: 1,
  sessions: [],
  approved: '',
  steps: [],
  commitMode: 'auto',
  targetBranch: 'main',
  worktree: 'akb/1-x',
}

const landing = (over: Partial<DeliveryLanding>): DeliveryRecord => ({
  ...base,
  landing: { status: 'waiting', attempts: 0, at: 1, ...over },
})

const stopped = (over: Partial<NonNullable<DeliveryRecord['review']>['stopped']>, record = base): DeliveryRecord => ({
  ...record,
  review: { rounds: [], stopped: { reason: 'uncommitted', why: 'git said no', at: 1, ...over } },
})

// The state without its English, which the cases below assert apart.
const said = (delivery: DeliveryRecord, questions = 0): Record<string, unknown> => {
  const { stage: _stage, label: _label, line: _line, paused: _paused, ...rest } = deliveryState(delivery, questions)
  return JSON.parse(JSON.stringify(rest))
}

describe('delivery progress', () => {
  it('keeps completed commit metadata visible', () => {
    assert.deepEqual(said(landing({ status: 'landed', commit: 'abc1234def' })), { kind: 'landed', branch: 'main', commit: 'abc1234' })
  })
  it('treats old Git queues as unfinished agent work', () => {
    for (const status of ['waiting', 'landing', 'conflict'] as const) {
      const state = deliveryState(landing({ status, conflictFiles: ['a.ts'], retryAt: 1 }), 0)
      assert.equal(state.stage, 'working')
      assert.equal(state.kind, 'building')
    }
  })
  it('holds for open questions and preserves execution failures', () => {
    assert.equal(deliveryState(base, 2).kind, 'questions')
    assert.equal(deliveryState(base, 2).paused, true)
    assert.equal(deliveryState(stopped({ why: 'Missing material' }), 0).raw, 'Missing material.')
  })
})

describe('the record keeps the kind', () => {
  it('reads a landing reason back, and an old hook stop as a plain stop', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-line-'))
    try {
      fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
      setBoardRoot(root)
      withStore((store) => {
        store.deliveries.push(
          { ...stopped({ reason: 'hook' as never }), deliveryId: 'one' },
          { ...landing({ why: 'no', reason: { kind: 'worktree-dirty', files: ['a.ts'] } }), deliveryId: 'two', cardId: 2 },
          { ...landing({ why: 'no', reason: { kind: 'queued', behind: '#1' } }), deliveryId: 'three', cardId: 3 },
          // A kind this copy does not know is dropped rather than trusted.
          { ...landing({ why: 'no', reason: { kind: 'later' } as never }), deliveryId: 'four', cardId: 4 },
        )
      })
      const [one, two, three, four] = readStore().deliveries
      assert.equal(one!.review?.stopped?.reason, 'session')
      assert.deepEqual(two!.landing?.reason, { kind: 'worktree-dirty', files: ['a.ts'] })
      assert.deepEqual(three!.landing?.reason, { kind: 'queued', behind: '#1' })
      assert.equal(four!.landing?.reason, undefined)
    } finally {
      forgetMachineState(root)
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
