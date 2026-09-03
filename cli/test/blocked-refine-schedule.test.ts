// A dependency carries its follow-up on the dependent card. Entering a blocked episode
// schedules one refine; cancelling it lasts for that episode; removing the blocker alone
// never earns the old inferred cross-card refine.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, beforeEach, describe, it } from 'node:test'

import { claimChanges, refinementRunsAfter, markBoard } from '../src/lib/agent/refine.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { parseFrontmatter, serializeFrontmatter } from '../src/lib/frontmatter.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { setCardSchedule } from '../src/lib/view/edit.ts'
import type { Meta, Question } from '../src/lib/types.ts'
import { move, refuses } from './helpers/board.ts'

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

const blockedBy = (id: number, ids: string): Promise<Record<string, unknown>> =>
  move(root, ['update', String(id), '--blocked-by', ids])

describe('the default refine schedule', () => {
  it('is written when a new card starts blocked', async () => {
    writeCard(1)
    fs.writeFileSync(path.join(kanban, 'next-id'), '2\n')

    const made = await move(root, ['create', '--title', 'Dependent', '--track', 'features', '--blocked-by', '1'])

    assert.equal(made.schedule, 'refine')
    assert.equal(scheduleOf(2)?.action, 'refine')
  })

  it('is written when an existing card enters a blocked episode', async () => {
    writeCard(1)
    writeCard(2)

    const changed = await move(root, ['update', '2', '--blocked-by', '1'])

    assert.deepEqual(changed.changes, ['blocked_by', 'schedule→refine when unblocked'])
    assert.equal(scheduleOf(2)?.action, 'refine')
  })

  it('stays cancelled while the card remains blocked', async () => {
    writeCard(1)
    writeCard(2)
    writeCard(3)
    await blockedBy(2, '1')
    setCardSchedule(2, null)

    await blockedBy(2, '1,3')

    assert.equal(scheduleOf(2), null)
  })

  it('returns for a new blocked episode', async () => {
    writeCard(1)
    writeCard(2)
    await blockedBy(2, '1')
    setCardSchedule(2, null)
    await blockedBy(2, '')

    await blockedBy(2, '1')

    assert.equal(scheduleOf(2)?.action, 'refine')
  })

  it('is what --schedule writes on a card nothing is in the way of', async () => {
    fs.writeFileSync(path.join(kanban, 'next-id'), '1\n')

    const made = await move(root, ['create', '--title', 'Second slice', '--track', 'features', '--schedule', 'refine'])

    assert.equal(made.schedule, 'refine')
    assert.equal(scheduleOf(1)?.action, 'refine')
  })

  it('gives way to the action --schedule names on a blocked card', async () => {
    writeCard(1)
    fs.writeFileSync(path.join(kanban, 'next-id'), '2\n')

    const made = await move(root, [
      'create',
      '--title',
      'Dependent',
      '--track',
      'features',
      '--blocked-by',
      '1',
      '--schedule',
      'implement',
    ])

    assert.equal(made.schedule, 'implement')
    assert.equal(scheduleOf(2)?.action, 'implement')
  })

  it('refuses an unknown --schedule action before an id is spent', async () => {
    fs.writeFileSync(path.join(kanban, 'next-id'), '1\n')

    // The command declares the actions it takes, so the refusal comes from the parse.
    await refuses(
      root,
      ['create', '--title', 'Nope', '--track', 'features', '--schedule', 'review'],
      /--schedule .*implement \| refine/,
    )
    assert.equal(fs.readFileSync(path.join(kanban, 'next-id'), 'utf8').trim(), '1')
    assert.deepEqual(fs.readdirSync(track), [])
  })

  it('is not put on a card a refine cannot move', async () => {
    writeCard(1)
    writeCard(2, { status: 'ready' })
    writeCard(3, {
      questions: [{ text: '[user] Pick the layout.', mode: 'single', options: ['A', 'B'], recommend: [0] }],
    })

    await blockedBy(2, '1')
    await blockedBy(3, '1')

    assert.equal(scheduleOf(2), null)
    assert.equal(scheduleOf(3), null)
  })

  it('stops the current refinement loop when the pass adds a blocker', async () => {
    writeCard(1)
    writeCard(2)
    const before = markBoard()
    await blockedBy(2, '1')
    const run: RunRecord = {
      sessionId: 'refine-2',
      cardId: 2,
      action: 'clarify',
      status: 'done',
      startedAt: 0,
      harness: 'test',
      logPath: '/dev/null',
      refineRound: 1,
    }

    assert.deepEqual(refinementRunsAfter(run, claimChanges(before, run.sessionId), before), {
      runs: [],
      stalled: undefined,
    })
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

    assert.deepEqual(refinementRunsAfter(run, claimChanges(before, run.sessionId), before).runs, [])
  })
})
