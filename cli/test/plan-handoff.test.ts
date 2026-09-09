// Clearing the discussion after a planning handoff (#551).
//
// The promise is that a discussion whose plan is already being turned into cards leaves the
// rail on its own: it goes the moment the run starts, its plan is filed away once that run
// has written cards, and it comes back if the run ends having written none.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { noteChatMessage, readChat, setChatPlan } from '../src/lib/agent/chat.ts'
import { startedPlanning } from '../src/lib/agent/discuss.ts'
import { archiveDiscussion, listDiscussions, startDiscussion } from '../src/lib/agent/discussions.ts'
import { withStore } from '../src/lib/agent/store.ts'
import type { DiscussionTarget, RunRecord } from '../src/lib/agent/types.ts'
import { dropPlan, planFile, readPlan } from '../src/lib/plans.ts'
import { PLANS, PLANS_ARCHIVE, TODO, setBoardRoot } from '../src/lib/paths.ts'

const PLAN_REL = 'plans/12-one-outcome.md'
const FILED_REL = 'plans/archive/12-one-outcome.md'

let root = ''
let home = ''
let realHome: string | undefined

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-plan-handoff-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-plan-handoff-home-'))
  realHome = process.env.HOME
  process.env.HOME = home
  fs.mkdirSync(path.join(root, 'docs', 'kanban'), { recursive: true })
  setBoardRoot(root)
  fs.mkdirSync(PLANS, { recursive: true })
  fs.writeFileSync(path.join(PLANS, '12-one-outcome.md'), '# One outcome\n')
  fs.mkdirSync(TODO, { recursive: true })
})

afterEach(() => {
  if (realHome === undefined) delete process.env.HOME
  else process.env.HOME = realHome
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
})

let next = 0

// A discussion with something said in it and a plan named, which is what the handoff needs.
const discussing = (): DiscussionTarget => {
  const target = startDiscussion()
  noteChatMessage(target, 'an idea worth a plan')
  setChatPlan(target, PLAN_REL, 'One outcome')
  return target
}

// A run in the record, as the handoff's own would be. `over` says how it ended and what it
// wrote; left running, it is one nobody is waiting on yet.
const run = (over: Partial<RunRecord> = {}): string => {
  const sessionId = `s${++next}`
  const logPath = path.join(root, 'docs', 'kanban', '.sessions', `${sessionId}.log`)
  // The record drops a finished run whose log has gone, so give it one.
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  fs.writeFileSync(logPath, '')
  withStore((store) => {
    store.runs.push({
      sessionId,
      cardId: null,
      action: 'create',
      status: 'running',
      startedAt: Date.now(),
      harness: 'claude-code',
      logPath,
      ...over,
    })
    return null
  })
  return sessionId
}

// That run, over, having written nothing.
const ended = (sessionId: string): void => {
  withStore((store) => {
    const found = store.runs.find((r) => r.sessionId === sessionId)
    if (found) Object.assign(found, { status: 'error', ok: false, endedAt: Date.now() })
    return null
  })
}

// The card a create run wrote, naming the plan the way the run was told to.
const card = (id: number): string => {
  const file = path.join(TODO, `${id}-a-card.md`)
  fs.writeFileSync(file, `---\ntitle: A card\n---\nThe requirement.\n\n## Source\n\n\`docs/kanban/${PLAN_REL}\`\n`)
  return file
}

const rowIsThere = (target: DiscussionTarget): boolean =>
  listDiscussions().some((r) => r.target === target)

const fileIsThere = (rel: string): boolean => fs.existsSync(planFile(rel) as string)

describe('the handoff itself', () => {
  it('takes the discussion out of the rail the moment the run starts', () => {
    const target = discussing()
    assert.equal(rowIsThere(target), true)

    startedPlanning(run(), 'plan', target)
    assert.equal(rowIsThere(target), false)
    assert.equal(readChat(target)?.archivedBy, 'board')
  })

  it('leaves the plan the run was handed exactly where it is', () => {
    const target = discussing()
    startedPlanning(run(), 'plan', target)
    assert.equal(fileIsThere(PLAN_REL), true)
    assert.equal(fileIsThere(FILED_REL), false)
  })

  it('leaves everything alone when no run ever started', () => {
    const target = discussing()
    assert.equal(rowIsThere(target), true)
    assert.equal(readChat(target)?.archived, false)
    assert.equal(fileIsThere(PLAN_REL), true)
  })
})

describe('the run that wrote cards', () => {
  it('files the plan away and repoints every card that run wrote', () => {
    const target = discussing()
    const first = card(9)
    const second = card(10)
    startedPlanning(
      run({ status: 'done', endedAt: Date.now(), createdCardIds: [9, 10] }),
      'plan',
      target,
    )

    listDiscussions()
    assert.equal(fileIsThere(PLAN_REL), false)
    assert.equal(fileIsThere(FILED_REL), true)
    for (const file of [first, second]) {
      assert.match(fs.readFileSync(file, 'utf8'), new RegExp(`docs/kanban/${FILED_REL}`))
    }
  })

  it('leaves the discussion out of the rail, and lets its plan go', () => {
    const target = discussing()
    card(9)
    startedPlanning(run({ status: 'done', endedAt: Date.now(), createdCardIds: [9] }), 'plan', target)

    listDiscussions()
    assert.equal(rowIsThere(target), false)
    // The mark is gone with it: the row is out the way one the user archived is.
    assert.equal(readChat(target)?.archivedBy, undefined)
    assert.equal(readChat(target)?.plans?.[0]?.done, true)
  })

  it('passes over a card that has moved on, and still moves the plan', () => {
    const target = discussing()
    startedPlanning(run({ status: 'done', endedAt: Date.now(), createdCardIds: [9] }), 'plan', target)

    listDiscussions()
    assert.equal(fileIsThere(FILED_REL), true)
  })

  it('holds the discussion out while that run is still working', () => {
    const target = discussing()
    startedPlanning(run({ createdCardIds: [9] }), 'plan', target)

    listDiscussions()
    assert.equal(rowIsThere(target), false)
    assert.equal(readChat(target)?.archivedBy, 'board')
    assert.equal(fileIsThere(PLAN_REL), true)
  })
})

describe('the run that wrote nothing', () => {
  it('gives the discussion back with its plan and its answers intact', () => {
    const target = discussing()
    const sessionId = run()
    startedPlanning(sessionId, 'plan', target)
    assert.equal(rowIsThere(target), false)
    ended(sessionId)

    // The next read of the rail is what notices, and the row is back on it.
    assert.equal(rowIsThere(target), true)
    assert.equal(readChat(target)?.archived, false)
    assert.equal(readChat(target)?.messages[0]?.text, 'an idea worth a plan')
    assert.equal(readChat(target)?.plans?.[0]?.run !== undefined, true)
    assert.equal(fileIsThere(PLAN_REL), true)
  })

  it('gives it back when the record no longer holds the run at all', () => {
    const target = discussing()
    startedPlanning('trimmed-away', 'plan', target)
    assert.equal(rowIsThere(target), true)
    assert.equal(fileIsThere(PLAN_REL), true)
  })
})

describe('an archive the user made', () => {
  it('stays archived whatever its run does', () => {
    const target = discussing()
    card(9)
    const sessionId = run()
    startedPlanning(sessionId, 'plan', target)
    ended(sessionId)
    // Back on the rail, and then put away by hand.
    assert.equal(rowIsThere(target), true)
    archiveDiscussion(target)

    assert.equal(rowIsThere(target), false)
    assert.equal(readChat(target)?.archivedBy, undefined)
    // And its plan is kept: the run it was handed to may still have named it (#496).
    assert.equal(fileIsThere(PLAN_REL), true)
  })
})

describe('a plan in either folder', () => {
  it('reads, and drops, the same in both', () => {
    fs.mkdirSync(PLANS_ARCHIVE, { recursive: true })
    fs.renameSync(path.join(PLANS, '12-one-outcome.md'), path.join(PLANS_ARCHIVE, '12-one-outcome.md'))

    assert.equal(readPlan(FILED_REL)?.text, '# One outcome\n')
    // And by the path it had before it was filed — the id is what follows it across.
    assert.equal(readPlan(PLAN_REL)?.path, FILED_REL)

    assert.equal(dropPlan(FILED_REL), true)
    assert.equal(fileIsThere(FILED_REL), false)
  })

  it('refuses anything that would climb out of either', () => {
    assert.equal(planFile('plans/archive/../../todo/9-a-card.md'), null)
    assert.equal(planFile('plans/archive/'), null)
  })
})
