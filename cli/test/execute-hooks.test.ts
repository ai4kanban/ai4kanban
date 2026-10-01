// The hooks a delivery runs after its build (#1328): each `execute` hook of the workflow the
// delivery froze, in order, one run each — and the delivery goes on only after the last.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { carryOnHooks, joinActive, joinDelivery, settleDelivery } from '../src/lib/agent/deliveries.ts'
import { nextHookRun, owedHooks } from '../src/lib/agent/hooks.ts'
import { deliveryState } from '../src/lib/agent/pause.ts'
import { buildPrompt } from '../src/lib/agent/prompts.ts'
import { workflowRefusal } from '../src/lib/agent/start.ts'
import { readDeliveryRow, readStore, withStore } from '../src/lib/agent/store.ts'
import type { DeliveryRecord, RunRecord, RunStatus } from '../src/lib/agent/types.ts'
import { addWorkflowHelper, setWorkflowHelperExtra } from '../src/lib/agent/workflows.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''
const kanban = (): string => path.join(root, 'docs', 'kanban')

const card = (id: number, workflow = ''): void => {
  fs.writeFileSync(
    path.join(kanban(), 'todo', `${id}-a-card.md`),
    [
      '---',
      'title: A card',
      'priority: med',
      'roi: med',
      'status: ready',
      'release: ""',
      'blocked_by: []',
      'related: []',
      'modules: []',
      ...(workflow ? [`workflow: ${workflow}`] : []),
      'questions: []',
      '---',
      '',
      'What this card is for.',
      '',
      '## Todo',
      '- [ ] the first step',
      '',
    ].join('\n'),
  )
}

const hookAgent = (name: string): void => {
  const home = path.join(kanban(), 'agents', name)
  fs.mkdirSync(home, { recursive: true })
  fs.writeFileSync(
    path.join(home, 'AGENT.md'),
    ['---', `name: ${name}`, 'description: Use when.', 'akb:', '  stage: execute', '---', '', `You are ${name}.`, ''].join('\n'),
  )
  assert.equal(addWorkflowHelper('coding', 'execute', name).ok, true)
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-hooks-'))
  fs.mkdirSync(path.join(kanban(), 'todo'), { recursive: true })
  fs.writeFileSync(path.join(kanban(), 'next-id'), '9\n')
  fs.writeFileSync(path.join(kanban(), 'todo', 'README.md'), '# Tasks\n\n## Tasks\n')
  fs.writeFileSync(path.join(kanban(), 'config.md'), '- **Solution** — product\n')
  setBoardRoot(root)
  card(5)
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

let next = 0
const session = (over: Partial<RunRecord> = {}): RunRecord => ({
  sessionId: `h${++next}`,
  cardId: 5,
  action: 'implement',
  status: 'running',
  startedAt: 1_000 + next,
  harness: 'claude-code',
  logPath: path.join(root, `h${next}.log`),
  ...over,
})

const delivery = (): DeliveryRecord => readStore().deliveries[0]!

// One run of the delivery from open to close, the way openRun and closeRun write it.
async function run(action: 'implement' | 'hook', status: RunStatus, specAgent?: string): Promise<void> {
  const record = session({ action, specAgent })
  withStore((store) => {
    store.runs.push(record)
    if (action === 'implement') joinDelivery(store, record, 'A card', 'implement')
    else assert.ok(joinActive(store, record, 'hook'))
  })
  withStore((store) => {
    store.runs.find((r) => r.sessionId === record.sessionId)!.status = status
  })
  await settleDelivery({ ...record, status })
}

describe('the hooks after a build', () => {
  it('finishes on the build itself when the workflow has none', async () => {
    await run('implement', 'done')
    assert.equal(delivery().status, 'finished')
  })

  it('runs each in order, and delivers only after the last', async () => {
    hookAgent('lint-fixer')
    hookAgent('doc-writer')
    await run('implement', 'done')
    assert.equal(delivery().status, 'active')
    assert.deepEqual(owedHooks(delivery()), ['lint-fixer', 'doc-writer'])
    const first = nextHookRun(delivery())!
    assert.deepEqual(
      { action: first.action, id: first.id, specAgent: first.specAgent, deliveryId: first.deliveryId },
      { action: 'hook', id: 5, specAgent: 'lint-fixer', deliveryId: delivery().deliveryId },
    )
    assert.match(deliveryState(delivery(), 0).line, /Running the `lint-fixer` hook/)

    await run('hook', 'done', 'lint-fixer')
    assert.equal(delivery().status, 'active')
    assert.equal(nextHookRun(delivery())!.specAgent, 'doc-writer')

    await run('hook', 'done', 'doc-writer')
    assert.equal(delivery().status, 'finished')
    assert.deepEqual(delivery().hooks, { done: ['lint-fixer', 'doc-writer'] })
  })

  it('runs the ones the delivery froze, whatever the board says later', async () => {
    hookAgent('lint-fixer')
    withStore((store) => {
      const record = session()
      store.runs.push(record)
      joinDelivery(store, record, 'A card', 'implement')
    })
    hookAgent('doc-writer')
    await settleDelivery({ ...readStore().runs[0]!, status: 'done' })
    assert.deepEqual(owedHooks(delivery()), ['lint-fixer'])
  })

  it('stops the delivery on a hook that failed or was stopped, and carries on from that hook', async () => {
    hookAgent('lint-fixer')
    hookAgent('doc-writer')
    await run('implement', 'done')
    await run('hook', 'done', 'lint-fixer')
    await run('hook', 'error', 'doc-writer')

    const stopped = delivery()
    assert.equal(stopped.status, 'active')
    assert.equal(stopped.review?.stopped?.reason, 'hook')
    assert.match(stopped.review!.stopped!.why, /`doc-writer` hook failed/)
    assert.equal(nextHookRun(stopped), null)
    const state = deliveryState(stopped, 0)
    assert.equal(state.stage, 'stopped')
    assert.match(state.line, /delivery resume/)

    assert.equal(carryOnHooks(stopped.deliveryId)?.deliveryId, stopped.deliveryId)
    assert.equal(delivery().review?.stopped, undefined)
    assert.equal(nextHookRun(delivery())!.specAgent, 'doc-writer')

    await run('hook', 'stopped', 'doc-writer')
    assert.match(delivery().review!.stopped!.why, /`doc-writer` hook was stopped/)
    carryOnHooks(delivery().deliveryId)
    await run('hook', 'done', 'doc-writer')
    assert.equal(delivery().status, 'finished')
  })

  it('owes every hook again after another build', async () => {
    hookAgent('lint-fixer')
    await run('implement', 'done')
    await run('hook', 'error', 'lint-fixer')
    await run('implement', 'done')
    assert.equal(delivery().review?.stopped, undefined)
    assert.deepEqual(owedHooks(delivery()), ['lint-fixer'])
  })

  it('owes none while the build has not finished', async () => {
    hookAgent('lint-fixer')
    await run('implement', 'error')
    assert.deepEqual(owedHooks(delivery()), [])
    assert.equal(nextHookRun(delivery()), null)
    assert.equal(carryOnHooks(delivery().deliveryId), undefined)
  })

  it('runs none on a workflow that delivers in planning', () => {
    card(6, 'blog-post')
    const refused = workflowRefusal({ action: 'implement', id: 6 })
    assert.equal(refused?.reason, 'planDelivered')
  })

  it('keeps the finished hooks through the record reader', () => {
    assert.deepEqual(readDeliveryRow({ deliveryId: 'd1', hooks: { done: ['a', 7, ''] } })!.hooks, { done: ['a'] })
    assert.equal(readDeliveryRow({ deliveryId: 'd1' })!.hooks, undefined)
  })
})

describe('the words a hook run is given', () => {
  it('opens with the fixed lines, then the agent, then what the workflow asks of it', async () => {
    hookAgent('lint-fixer')
    assert.equal(setWorkflowHelperExtra('coding', 'execute', 'lint-fixer', 'Only touch cli/.').ok, true)
    await run('implement', 'done')
    const prompt = buildPrompt(nextHookRun(delivery())!)
    assert.ok(prompt.startsWith('You run after the build of card #5, in the folder holding its work.'))
    assert.match(prompt, /Do not land the work or start other agents\./)
    const own = prompt.indexOf('You are lint-fixer.')
    const extra = prompt.indexOf('Only touch cli/.')
    assert.ok(own > 0 && extra > own)
  })
})
