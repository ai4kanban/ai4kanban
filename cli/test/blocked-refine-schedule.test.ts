// A dependency carries its follow-up on the dependent card. Entering a blocked episode
// schedules one refine; cancelling it lasts for that episode; removing the blocker alone
// never earns the old inferred cross-card refine.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { cmdCreate, cmdUpdate } from '../src/commands/card.ts'
import { refinementRunsAfter, markBoard } from '../src/lib/agent/refine.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { setCardSchedule } from '../src/lib/view/edit.ts'
import type { Meta, Question } from '../src/lib/types.ts'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-blocked-refine-'))
const kanban = path.join(root, 'docs', 'kanban')
const track = path.join(kanban, 'todo', 'features')

beforeEach(() => {
  fs.rmSync(path.join(root, 'docs'), { recursive: true, force: true })
  fs.mkdirSync(track, { recursive: true })
  fs.writeFileSync(path.join(kanban, 'next-id'), '20\n')
  setBoardRoot(root)
})

after(() => fs.rmSync(root, { recursive: true, force: true }))

function cardFile(id: number): string {
  return path.join(track, `${id}-card-${id}.md`)
}

function writeCard(
  id: number,
  opts: {
    status?: string
    blockedBy?: number[]
    questions?: Question[]
    schedule?: Meta['schedule']
  } = {},
): void {
  const meta: Partial<Meta> = {
    title: `Card ${id}`,
    track: 'features',
    priority: 'med',
    roi: 'med',
    status: opts.status ?? 'todo',
    release: '',
    blocked_by: opts.blockedBy ?? [],
    related: [],
    modules: [],
    questions: opts.questions ?? [],
    schedule: opts.schedule ?? null,
  }
  fs.writeFileSync(
    cardFile(id),
    `${serializeFrontmatter(meta)}\n\nA card.\n\n## Todo\n\n- [ ] Build it.\n`,
  )
}

function scheduleOf(id: number): Meta['schedule'] {
  const name = fs.readdirSync(track).find((entry) => entry.startsWith(`${id}-`))
  assert.ok(name)
  const { meta } = parseFrontmatter(fs.readFileSync(path.join(track, name), 'utf8'))
  assert.ok(meta)
  return meta.schedule
}

describe('the default refine schedule', () => {
  it('is written when a new card starts blocked', () => {
    writeCard(1)
    fs.writeFileSync(path.join(kanban, 'next-id'), '2\n')

    const made = cmdCreate([
      '--title',
      'Dependent',
      '--track',
      'features',
      '--blocked-by',
      '1',
    ])

    assert.equal(made.schedule, 'refine')
    assert.equal(scheduleOf(2)?.action, 'refine')
  })

  it('is written when an existing card enters a blocked episode', () => {
    writeCard(1)
    writeCard(2)

    const changed = cmdUpdate(['2', '--blocked-by', '1'])

    assert.deepEqual(changed.changes, ['blocked_by', 'schedule→refine when unblocked'])
    assert.equal(scheduleOf(2)?.action, 'refine')
  })

  it('stays cancelled while the card remains blocked', () => {
    writeCard(1)
    writeCard(2)
    writeCard(3)
    cmdUpdate(['2', '--blocked-by', '1'])
    setCardSchedule(2, null)

    cmdUpdate(['2', '--blocked-by', '1,3'])

    assert.equal(scheduleOf(2), null)
  })

  it('returns for a new blocked episode', () => {
    writeCard(1)
    writeCard(2)
    cmdUpdate(['2', '--blocked-by', '1'])
    setCardSchedule(2, null)
    cmdUpdate(['2', '--blocked-by', ''])

    cmdUpdate(['2', '--blocked-by', '1'])

    assert.equal(scheduleOf(2)?.action, 'refine')
  })

  it('is not put on a card a refine cannot move', () => {
    writeCard(1)
    writeCard(2, { status: 'ready' })
    writeCard(3, {
      questions: [{ text: '[user] Pick the layout.', mode: 'single', options: ['A', 'B'], recommend: [0] }],
    })

    cmdUpdate(['2', '--blocked-by', '1'])
    cmdUpdate(['3', '--blocked-by', '1'])

    assert.equal(scheduleOf(2), null)
    assert.equal(scheduleOf(3), null)
  })

  it('stops the current refinement loop when the pass adds a blocker', () => {
    writeCard(1)
    writeCard(2)
    const before = markBoard()
    cmdUpdate(['2', '--blocked-by', '1'])
    const run: RunRecord = {
      sessionId: 'refine-2',
      cardId: 2,
      action: 'refine',
      status: 'done',
      startedAt: 0,
      harness: 'test',
      logPath: '/dev/null',
      refineRound: 1,
    }

    assert.deepEqual(refinementRunsAfter(run, before), { runs: [], stalled: undefined })
  })
})

describe('removing a blocker', () => {
  it('does not infer a refine after the schedule was cancelled', () => {
    writeCard(1)
    writeCard(2, { blockedBy: [1] })
    const before = markBoard()
    fs.rmSync(cardFile(1))
    writeCard(2)
    const run: RunRecord = {
      sessionId: 'archive-1',
      cardId: 1,
      action: 'archive',
      status: 'done',
      startedAt: 0,
      harness: 'test',
      logPath: '/dev/null',
    }

    assert.deepEqual(refinementRunsAfter(run, before).runs, [])
  })
})
