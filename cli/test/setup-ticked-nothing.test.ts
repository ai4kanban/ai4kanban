// A setup run that exits cleanly without ticking a box did nothing (#909).
//
// Setup never stops to ask, so a clean exit that left every box as it was is a failure: it
// closes as one, says why, and is marked so the UI can tell it from any other failure.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { SESSIONS_DIR, SETUP_CHECKLIST, setBoardRoot } from '../src/lib/paths.ts'
import { closeRun, openResume, openRun, patch, peekRun } from '../src/lib/agent/sessions.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { tickSetupStep, writeSetupChecklist } from '../src/lib/setup.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''

/** A setup run of an agent that does `what` and then exits cleanly. */
function fakeSetup(what = ''): string {
  const script = path.join(root, 'fake-agent.cjs')
  fs.writeFileSync(script, `
    const fs = require('node:fs');
    ${what}
    console.log(JSON.stringify({type: 'result', result: 'Done'}));
  `)
  fs.writeFileSync(
    path.join(root, 'docs/kanban/ui.config.json'),
    JSON.stringify({ harness: 'claude-code', harnessSettings: { 'claude-code': { command: `${process.execPath} ${script}` } } }),
  )
  const opened = openRun({ action: 'setup' }, 'Set up this board.', [])
  if ('error' in opened) throw new Error(opened.error)
  opened.spec.plan.argv = [process.execPath, script]
  opened.spec.plan.harness = 'claude-code'
  fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
  patch(opened.run.sessionId, (r) => { r.pid = process.pid })
  // A finished record with no log is pruned out of the store.
  fs.writeFileSync(opened.run.logPath, '')
  return opened.run.sessionId
}

/** Tick box `name` from inside the fake agent. */
const ticks = (name: string): string =>
  `const f = ${JSON.stringify(SETUP_CHECKLIST)}; fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/- \\[ \\] \`${name}\`/, '- [x] \`${name}\`'));`

const watch = (id: string): Promise<number> => watchRun(id, async () => ({ error: 'no resume' }))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-setup-nothing-'))
  forgetMachineState(root)
  setBoardRoot(root)
  setBoardProvider(null)
  fs.mkdirSync(path.join(root, 'docs/kanban/todo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '1\n')
  fs.writeFileSync(path.join(root, 'docs/kanban/todo/README.md'), '# Tasks\n')
  writeSetupChecklist()
  for (const step of ['project', 'goal', 'agent']) tickSetupStep(step)
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('a setup run that exits cleanly', () => {
  it('fails, says why and is marked when it ticked nothing', async () => {
    const id = fakeSetup()
    await watch(id)
    const run = peekRun(id)!
    assert.equal(run.status, 'error')
    assert.equal(run.ok, false)
    assert.equal(run.tickedNothing, true)
    assert.match(run.error ?? '', /without completing any step/)
  })

  it('is done when it ticked a box', async () => {
    const id = fakeSetup(ticks('decisions'))
    await watch(id)
    assert.equal(peekRun(id)?.status, 'done')
    assert.equal(peekRun(id)?.tickedNothing, undefined)
  })

  it('is done when its last tick deleted the checklist', async () => {
    const id = fakeSetup(`fs.rmSync(${JSON.stringify(SETUP_CHECKLIST)});`)
    await watch(id)
    assert.equal(peekRun(id)?.status, 'done')
  })

  it('is done when there was no checklist to start with', async () => {
    fs.rmSync(SETUP_CHECKLIST)
    const id = fakeSetup()
    assert.equal(peekRun(id)?.setupTicked, undefined)
    await watch(id)
    assert.equal(peekRun(id)?.status, 'done')
  })
})

describe('a setup run that did not exit cleanly', () => {
  it('stays stopped when the user stopped it', async () => {
    const id = fakeSetup()
    patch(id, (r) => { r.stopping = true })
    await watch(id)
    assert.equal(peekRun(id)?.status, 'stopped')
    assert.equal(peekRun(id)?.tickedNothing, undefined)
  })
})

describe('a resumed setup run', () => {
  it('counts from where the run it continues started', async () => {
    const first = fakeSetup()
    const ticked = peekRun(first)!.setupTicked
    tickSetupStep('decisions')
    await closeRun(first, { status: 'interrupted' })
    const resumed = await openResume(first)
    if ('error' in resumed) throw new Error(resumed.error)
    assert.equal(resumed.run.setupTicked, ticked)
  })

  it('is done when the run it continues ticked a box, though it ticked none itself', async () => {
    const id = fakeSetup()
    patch(id, (r) => { r.setupTicked = 2 })
    await watch(id)
    assert.equal(peekRun(id)?.status, 'done')
  })
})
