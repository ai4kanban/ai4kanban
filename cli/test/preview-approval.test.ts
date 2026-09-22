// A video card is built only from shot previews the user approved (#991): dropping round 2's
// approval question records it, asking either round again withdraws it, and ready, the
// writing pass, the decider and every build start read it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { decidable } from '../src/lib/agent/decide.ts'
import { claimChanges, markBoard, refinementRunsAfter } from '../src/lib/agent/refine.ts'
import { setDecider } from '../src/lib/agent/settings.ts'
import { workflowRefusal } from '../src/lib/agent/start.ts'
import type { RunRecord } from '../src/lib/agent/types.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { validateSpec } from '../src/lib/spec-contract.ts'
import { findCard } from '../src/lib/view/read.ts'
import { forgetMachineState, move } from './helpers/board.ts'

let root = ''
const file = (): string => path.join(root, 'docs', 'kanban', 'todo', '1-a-video.md')
const text = (): string => fs.readFileSync(file(), 'utf8')

const write = ({ workflow = 'hyperframes-video', status = 'todo', approved = false } = {}): void => {
  fs.writeFileSync(
    file(),
    [
      '---',
      'title: A video',
      'priority: med',
      'roi: med',
      `status: ${status}`,
      'release: ""',
      'blocked_by: []',
      'related: []',
      'modules: []',
      `workflow: ${workflow}`,
      ...(approved ? ['preview_approved: true'] : []),
      'questions: []',
      '---',
      '',
      'One demo video.',
      '',
      '## Worth noting',
      '',
      '<!-- agent -->',
      '',
      '## Scope',
      '- **A shot**: something observable.',
      '',
      '## Todo',
      '- [ ] Render it',
      '',
      '## Decided by the agent',
      '',
    ].join('\n'),
  )
}

const ask = (agent: string): Promise<Record<string, unknown>> =>
  move(root, ['update-questions', '1', '--append', `[user] Round — approve?`, '--option', 'Approve', '--option', 'Needs changes', '--agent', agent])
const drop = (): Promise<Record<string, unknown>> => move(root, ['update-questions', '1', '--drop', '1'])
const approved = (): boolean => /^preview_approved: true$/m.test(text())
const build = () => workflowRefusal({ action: 'implement', id: 1, title: 'A video' })

const resolved = (): RunRecord => ({
  sessionId: 'resolve-1',
  cardId: 1,
  action: 'resolve',
  status: 'done',
  startedAt: 0,
  harness: 'test',
  logPath: '/dev/null',
})

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-preview-approval-'))
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'README.md'), '# Open tasks\n\n- [ ] #1 [A video](1-a-video.md)\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '2\n')
  forgetMachineState(root)
  setBoardRoot(root)
  setBoardProvider(null)
  write()
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('the preview approval', () => {
  it('is recorded when round 2 is approved, not when round 1 is', async () => {
    await ask('scriptwriter')
    await drop()
    assert.equal(approved(), false)
    await ask('hyperframes-assets')
    await drop()
    assert.equal(approved(), true)
    assert.equal(findCard(1)!.previewApproved, true)
    assert.deepEqual(validateSpec(file(), text(), 1), [])
  })

  it('is withdrawn when either round asks again', async () => {
    for (const agent of ['scriptwriter', 'hyperframes-assets']) {
      write({ approved: true })
      await ask(agent)
      assert.equal(approved(), false, agent)
    }
  })

  it('is never recorded by a skip or a clear', async () => {
    await ask('hyperframes-assets')
    await move(root, ['update-questions', '1', '--skip', '1'])
    assert.equal(approved(), false)
    await move(root, ['update-questions', '1', '--clear'])
    assert.equal(approved(), false)
  })

  it('is only a video card’s', async () => {
    write({ workflow: 'coding' })
    await ask('hyperframes-assets')
    await drop()
    assert.equal(approved(), false)
  })

  it('refuses any value but true', () => {
    const bad = text().replace('workflow: hyperframes-video', 'workflow: hyperframes-video\npreview_approved: yes')
    assert.deepEqual(validateSpec(file(), bad, 1).map((e) => e.rule), ['preview_approved'])
  })
})

describe('what waits on it', () => {
  it('keeps the card out of ready until previews are approved', async () => {
    await move(root, ['update', '1', '--status', 'ready'])
    assert.match(text(), /^status: todo$/m)
    write({ approved: true })
    await move(root, ['update', '1', '--status', 'ready'])
    assert.match(text(), /^status: ready$/m)
  })

  it('sends an approved script back to the scriptwriter instead of to writing', async () => {
    await ask('scriptwriter')
    const before = markBoard()
    await drop()
    const run = resolved()
    assert.deepEqual(refinementRunsAfter(run, claimChanges(before, run.sessionId), before).runs, [
      { action: 'clarify', id: 1, title: 'A video', refineRound: 1, refineEffort: 'standard' },
    ])
    // A QA pass that ended without asking round 2 stops rather than looping.
    const qa = { ...run, sessionId: 'clarify-1', action: 'clarify' as const, refineRound: 1 }
    assert.deepEqual(refinementRunsAfter(qa, [], markBoard()).runs, [])
  })

  it('hands approved previews their writing pass', async () => {
    await ask('hyperframes-assets')
    const before = markBoard()
    await drop()
    const run = resolved()
    assert.deepEqual(refinementRunsAfter(run, claimChanges(before, run.sessionId), before).runs, [
      { action: 'writing', id: 1, title: 'A video', refineRound: 1, refineEffort: 'standard' },
    ])
  })

  it('refuses a build until previews are approved', () => {
    assert.equal(build()?.reason, 'previewUnapproved')
    write({ approved: true })
    assert.equal(build(), null)
    write({ workflow: 'coding' })
    assert.equal(build(), null)
  })

  it('leaves both approvals to the user when the decider is on', async () => {
    setDecider(true)
    for (const agent of ['scriptwriter', 'hyperframes-assets']) {
      write()
      await ask(agent)
      assert.equal(decidable(findCard(1)!), false, agent)
    }
    write({ workflow: 'coding' })
    await ask('hyperframes-assets')
    assert.equal(decidable(findCard(1)!), true)
  })
})
