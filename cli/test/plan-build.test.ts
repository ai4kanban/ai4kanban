// Build now under the plan handoff (#481): the plan is the requirement, the delivery is titled
// and bounded by the file, and the panel lets the plan go once its run has written a card.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { setChatPlan, setChatPlanRun } from '../src/lib/agent/chat.ts'
import { findDelivery, joinDelivery } from '../src/lib/agent/deliveries.ts'
import { readDiscuss } from '../src/lib/agent/discuss.ts'
import { resumePrompt } from '../src/lib/agent/prompts.ts'
import { openRun } from '../src/lib/agent/sessions.ts'
import { withStore } from '../src/lib/agent/store.ts'
import type { AgentRequest, RunRecord } from '../src/lib/agent/types.ts'
import { planFromText, planTitle } from '../src/lib/plans.ts'
import { PLANS, setBoardRoot } from '../src/lib/paths.ts'

const PLAN_REL = 'plans/12-one-outcome.md'
const PLAN_TEXT = ['# One outcome', '', 'The problem, in one sentence.', '', '- **An outcome**: one line.', ''].join('\n')

let root = ''
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-plan-build-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban'), { recursive: true })
  setBoardRoot(root)
  fs.mkdirSync(PLANS, { recursive: true })
  fs.writeFileSync(path.join(PLANS, '12-one-outcome.md'), PLAN_TEXT)
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

let next = 0
const session = (over: Partial<RunRecord> = {}): RunRecord => ({
  sessionId: `s${++next}`,
  cardId: null,
  action: 'implement',
  status: 'running',
  startedAt: Date.now(),
  harness: 'claude-code',
  logPath: path.join(root, 'docs', 'kanban', '.sessions', `s${next}.log`),
  ...over,
})

describe('the plan a run is pointed at', () => {
  it('reads back from the path a run carries, and answers with its title', () => {
    assert.equal(planFromText(`docs/kanban/${PLAN_REL}`), PLAN_REL)
    assert.equal(planTitle(PLAN_TEXT), 'One outcome')
  })

  it('is not a plan of this board when it names another folder or another file', () => {
    assert.equal(planFromText('docs/kanban/todo/12-a-card.md'), null)
    assert.equal(planFromText('plans/../todo/12-a-card.md'), null)
  })

  it('has no title while nothing is written in it', () => {
    assert.equal(planTitle('   \n\n'), '')
  })
})

describe('the delivery a plan build opens', () => {
  it('takes the plan as its title and its frozen requirements, and names the file', () => {
    const id = withStore((store) => {
      const run = session()
      store.runs.push(run)
      return joinDelivery(store, run, 'One outcome', 'implement', undefined, {
        title: 'One outcome',
        approved: PLAN_TEXT,
        plan: `docs/kanban/${PLAN_REL}`,
      }).deliveryId
    })
    const delivery = findDelivery(id)!
    assert.equal(delivery.title, 'One outcome')
    assert.equal(delivery.approved, PLAN_TEXT)
    assert.equal(delivery.plan, `docs/kanban/${PLAN_REL}`)
  })

  // A whole plan cannot be quoted the way a typed sentence is, so a resume that never got as
  // far as the card reads the copy the delivery froze.
  it('sets the approved copy out for a resume rather than quoting it as a sentence', () => {
    const id = withStore((store) => {
      const run = session()
      store.runs.push(run)
      return joinDelivery(store, run, 'One outcome', 'implement', undefined, {
        title: 'One outcome',
        approved: PLAN_TEXT,
        plan: `docs/kanban/${PLAN_REL}`,
      }).deliveryId
    })
    const prompt = resumePrompt(id, null, 'implement')
    assert.match(prompt, /write it from the plan this delivery was approved to build/)
    assert.match(prompt, new RegExp(`docs/kanban/${PLAN_REL}`))
    assert.match(prompt, /The problem, in one sentence\./)
    assert.doesNotMatch(prompt, /from this sentence/)
  })
})

describe('the run a plan build opens', () => {
  const openBuild = (plan: string) =>
    openRun({ action: 'implement', plan } as AgentRequest, 'build it')

  it('reads the file once, here, and freezes what it says as the delivery', () => {
    const opened = openBuild(`docs/kanban/${PLAN_REL}`)
    assert.ok(!('error' in opened))
    const delivery = findDelivery(opened.run.deliveryId as string)
    assert.equal(opened.run.cardId, null)
    assert.equal(delivery?.title, 'One outcome')
    assert.equal(delivery?.approved, PLAN_TEXT.trim())
    assert.equal(delivery?.plan, `docs/kanban/${PLAN_REL}`)
  })

  it('refuses a plan with nothing written in it, the way it refuses a missing one', () => {
    fs.writeFileSync(path.join(PLANS, '13-blank.md'), '   \n\n')
    for (const rel of ['plans/13-blank.md', 'plans/99-never-written.md']) {
      const opened = openBuild(`docs/kanban/${rel}`)
      assert.deepEqual(opened, { error: `there is nothing written in docs/kanban/${rel} yet, so there is nothing to build.` })
    }
  })
})

describe('what the plan panel does with the run it started', () => {
  const hold = (over: Partial<RunRecord>, answer: 'plan' | 'build' = 'build'): void => {
    const run = session(over)
    // The record drops a finished run whose log has gone, so give it one.
    fs.mkdirSync(path.dirname(run.logPath), { recursive: true })
    fs.writeFileSync(run.logPath, '')
    withStore((store) => {
      store.runs.push(run)
      return null
    })
    setChatPlan(null, PLAN_REL)
    setChatPlanRun(null, run.sessionId, answer)
  }

  it('names the answer that started it, so the line can say a build is running', async () => {
    hold({})
    const read = await readDiscuss()
    assert.equal(read.run?.running, true)
    assert.equal(read.run?.answer, 'build')
  })

  it('lets the plan go once the run has written a card, however that run then ended', async () => {
    hold({ status: 'error', ok: false, endedAt: Date.now(), createdCardIds: [9] })
    assert.deepEqual(await readDiscuss(), { plan: null, run: null })
  })

  it('holds the plan while that run is still working, card or no card', async () => {
    hold({ createdCardIds: [9] })
    assert.equal((await readDiscuss()).plan?.path, `docs/kanban/${PLAN_REL}`)
  })

  it('offers the plan again when the run ended having written none', async () => {
    hold({ status: 'error', ok: false, endedAt: Date.now() })
    const read = await readDiscuss()
    assert.equal(read.plan?.path, `docs/kanban/${PLAN_REL}`)
    assert.equal(read.run?.running, false)
    assert.equal(read.run?.answer, 'build')
  })
})
