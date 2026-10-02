// The moments the board cheers for (#1331): which landings count, and what each says.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { activeDelivery, listDeliveries } from '../src/lib/agent/deliveries.ts'
import { advanceLanding } from '../src/lib/agent/landing.ts'
import { closeRun, openRun } from '../src/lib/agent/sessions.ts'
import { setAutoCommit } from '../src/lib/agent/settings.ts'
import { withStore } from '../src/lib/agent/store.ts'
import { worktreeDir } from '../src/lib/agent/worktree.ts'
import type { DeliveryLanding, DeliveryRecord } from '../src/lib/agent/types.ts'
import { startCollecting, stopCollecting } from '../src/lib/io.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { cheersOf, readCheers } from '../src/lib/view/cheer.ts'

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

// A real landing on a real repository: what the archive closed is written on the record.
describe('what a landing writes down', () => {
  let root = ''
  const todo = () => path.join(root, 'docs', 'kanban', 'todo')

  const git = (args: string[]): void => {
    const out = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
    if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`)
  }

  const card = (title: string, release: string, body = 'What this card is for.'): string =>
    ['---', `title: ${title}`, 'priority: med', 'roi: med', 'status: ready', `release: "${release}"`, 'blocked_by: []', 'related: []', 'modules: []', 'questions: []', '---', '', body, ''].join('\n')

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-cheer-'))
    fs.mkdirSync(path.join(todo(), '50-a-group'), { recursive: true })
    fs.writeFileSync(path.join(root, 'shared.txt'), 'base\n')
    git(['init', '--quiet', '-b', 'main'])
    git(['config', 'user.email', 'test@example.com'])
    git(['config', 'user.name', 'test'])
    git(['add', '-A'])
    git(['commit', '--quiet', '-m', 'start'])
    setBoardRoot(root)
    setAutoCommit(true)
  })

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  async function land(id: number, title: string): Promise<DeliveryRecord> {
    const opened = openRun({ action: 'implement', id, title }, 'prompt', [])
    if ('error' in opened) throw new Error(opened.error)
    const started = activeDelivery(id)!
    fs.writeFileSync(path.join(worktreeDir(started.worktree!), `${id}.txt`), 'built\n')
    const record = withStore((store) => store.runs.find((r) => r.sessionId === opened.run.sessionId))
    fs.writeFileSync(record!.logPath, 'log\n')
    startCollecting()
    try {
      await closeRun(opened.run.sessionId, { status: 'done', ok: true, code: 0 })
      await advanceLanding()
    } finally {
      stopCollecting()
    }
    return listDeliveries().find((d) => d.deliveryId === started.deliveryId)!
  }

  it('records the group and the release its archive finished', async () => {
    fs.writeFileSync(path.join(todo(), '50-a-group', 'root.md'), card('The whole job', '', 'Root.\n\n## Todo\n- [ ] one #51\n- [ ] two #52'))
    fs.writeFileSync(path.join(todo(), '50-a-group', '51-one.md'), card('one', 'v1'))
    fs.writeFileSync(path.join(todo(), '50-a-group', '52-two.md'), card('two', 'v1'))

    const first = await land(51, 'one')
    assert.equal(first.status, 'finished')
    assert.deepEqual(first.landing!.closed, { group: undefined, release: undefined })

    const last = await land(52, 'two')
    assert.deepEqual(last.landing!.closed, {
      group: { id: 50, title: 'The whole job', done: 2 },
      release: { id: 'v1', done: 2 },
    })

    const cheers = readCheers()
    assert.deepEqual(cheers.map((c) => [c.key, c.kind]), [
      [last.deliveryId, 'release'],
      [first.deliveryId, 'first'],
    ])
  })
})
