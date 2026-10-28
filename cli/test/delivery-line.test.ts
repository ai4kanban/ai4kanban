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

describe("a delivery line's kind and values", () => {
  it('keeps the English label and line word for word', () => {
    const cmd = boardCommand()
    const text = (delivery: DeliveryRecord, questions = 0): [string, string] => {
      const state = deliveryState(delivery, questions)
      return [state.label, state.line]
    }
    assert.deepEqual(text(landing({ status: 'landed', commit: 'abc1234def' })), [
      'Landed as abc1234',
      'On `main` as `abc1234`. The board is completing the card.',
    ])
    assert.deepEqual(text(landing({ status: 'landed' })), [
      'Landed — nothing to commit',
      'It changed nothing, so nothing was committed. The board is completing the card.',
    ])
    assert.deepEqual(text(stopped({})), ['Waiting on you', 'Git said no. Fix it, then `Build again`.'])
    assert.deepEqual(text(stopped({}, { ...base, cardId: null })), [
      'Waiting on you',
      `Git said no. \`${cmd} delivery cancel aaa\` ends it and leaves the branch.`,
    ])
    assert.deepEqual(text({ ...base, commitMode: 'manual', reviewed: { mark: 'x', at: 1 } }), [
      'Waiting for your commit',
      'The build is done — commit these changes yourself, and the delivery carries on.',
    ])
    assert.deepEqual(text(landing({}), 2), [
      'Held at landing',
      "Landing waits on this card's 2 open questions — answer them and it carries on.",
    ])
    assert.deepEqual(text(landing({ status: 'landing', conflictFiles: ['a.ts'], conflictFails: 2 })), [
      'Resolving a conflict',
      'Attempt 3: resolving `a.ts` against `main`. It lands by itself once the conflict is out — nothing is asked of you.',
    ])
    assert.deepEqual(text(landing({ conflictFiles: ['a.ts', 'b.ts'], conflictFails: 1, conflictAt: 1 })), [
      'Waiting to retry',
      'Attempt 1 left 2 files against `main` conflicted. It gave the landing slot up and opens attempt 2 now — another delivery can land while it waits.',
    ])
    assert.deepEqual(text(landing({ attempts: 1, retryAt: 1 })), [
      'Waiting to retry',
      '`main` moved on while this was landing. It gave the landing slot up and starts attempt 2 now — another delivery can land while it waits.',
    ])
    assert.deepEqual(text(landing({ why: 'in line behind #594 — one build lands at a time' })), [
      'In line to land',
      'In line behind #594 — one build lands at a time.',
    ])
    assert.deepEqual(text(landing({ why: 'it has no base commit to land against', reason: { kind: 'no-base' } })), [
      "Can't land yet",
      'It has no base commit to land against.',
    ])
    assert.deepEqual(text(base), [
      'In progress',
      'Building this card as it was approved when work started, to land on `main`.',
    ])
    assert.deepEqual(text({ ...base, cardId: null, commitMode: 'manual' }), ['In progress', 'Building what you typed.'])
  })

  it('names a landed commit, or that there was none', () => {
    assert.deepEqual(said(landing({ status: 'landed', commit: 'abc1234def' })), {
      kind: 'landed',
      branch: 'main',
      commit: 'abc1234',
    })
    assert.deepEqual(said(landing({ status: 'landed' })), { kind: 'landed-nothing', branch: 'main' })
  })

  it('carries every other stop in its own words, with the way out a card-less build has', () => {
    assert.deepEqual(said(stopped({})), { kind: 'uncommitted', raw: 'Git said no.' })
    assert.deepEqual(said(stopped({ reason: 'capability', why: 'a helper wrote nothing.' })), {
      kind: 'stopped',
      raw: 'A helper wrote nothing.',
    })
    assert.deepEqual(said(stopped({}, { ...base, cardId: null })), {
      kind: 'uncommitted',
      raw: 'Git said no.',
      command: `${boardCommand()} delivery cancel aaa`,
    })
  })

  it("counts the questions and names the user's own commit", () => {
    assert.deepEqual(said({ ...base, commitMode: 'manual', reviewed: { mark: 'x', at: 1 } }), { kind: 'commit' })
    assert.deepEqual(said(landing({}), 2), { kind: 'questions', questions: 2 })
  })

  it('names the files, the attempt and the seconds left on a retry', () => {
    assert.deepEqual(said(landing({ status: 'landing', conflictFiles: ['a.ts'], conflictFails: 2 })), {
      kind: 'conflict',
      files: ['a.ts'],
      branch: 'main',
      attempt: 3,
    })
    const waiting = said(landing({ conflictFiles: ['a.ts', 'b.ts'], conflictFails: 1, conflictAt: Date.now() + 40_000 }))
    assert.ok((waiting.retryIn as number) > 35 && (waiting.retryIn as number) <= 40)
    assert.deepEqual(
      { ...waiting, retryIn: 0 },
      { kind: 'conflict-wait', files: ['a.ts', 'b.ts'], branch: 'main', attempt: 2, retryIn: 0 },
    )
    assert.deepEqual(said(landing({ attempts: 1, retryAt: 1 })), {
      kind: 'target-moved',
      branch: 'main',
      attempt: 2,
      retryIn: 0,
    })
  })

  it('names what a queued delivery is behind', () => {
    const why = 'in line behind #594 — one build lands at a time'
    assert.deepEqual(said(landing({ why, reason: { kind: 'queued', behind: '#594' } })), { kind: 'queued', behind: '#594' })
    assert.deepEqual(said(landing({ why })), {})
  })

  it("says which refusal it is, or hands over git's own words", () => {
    const refused = (reason: DeliveryLanding['reason']): Record<string, unknown> => said(landing({ why: 'no', reason }))
    for (const kind of ['worktree-gone', 'no-base', 'target-gone', 'interrupted'] as const) {
      assert.deepEqual(refused({ kind }), { kind, branch: 'main', worktree: 'akb/1-x' })
    }
    assert.deepEqual(refused({ kind: 'worktree-dirty', files: ['a.ts'] }), {
      kind: 'worktree-dirty',
      files: ['a.ts'],
      branch: 'main',
      worktree: 'akb/1-x',
    })
    assert.deepEqual(refused(undefined), { kind: 'refused', raw: 'No.' })
    // A queue's reason left on the record is never read as a refusal.
    assert.deepEqual(refused({ kind: 'queued', behind: '#2' }), { kind: 'refused', raw: 'No.' })
  })

  it('names the branch a build lands on', () => {
    assert.deepEqual(said(base), { kind: 'building', branch: 'main' })
    assert.deepEqual(said({ ...base, commitMode: 'manual' }), { kind: 'building' })
    assert.deepEqual(said({ ...base, cardId: null }), { kind: 'building-typed', branch: 'main' })
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
