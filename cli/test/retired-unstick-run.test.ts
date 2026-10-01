// The sweeper is gone (#1334), and the `unstick` runs it left in the record still read back.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { flowByCommand } from '../src/lib/agent/flows.ts'
import { agentRoster, roles } from '../src/lib/agent/roles.ts'
import { listRuns } from '../src/lib/agent/sessions.ts'
import { logPathOf, withStore } from '../src/lib/agent/store.ts'
import type { RunStatus } from '../src/lib/agent/types.ts'
import { RULES, SESSIONS, setBoardRoot, UI_CONFIG } from '../src/lib/paths.ts'
import { nextWork } from '../src/lib/view/dispatch.ts'
import { forgetMachineState } from './helpers/board.ts'

let root = ''

function run(sessionId: string, status: RunStatus): void {
  withStore((store) => {
    const logPath = logPathOf(sessionId)
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.writeFileSync(logPath, 'ran\n')
    store.runs.push({
      sessionId,
      cardId: 7,
      action: 'unstick',
      status,
      startedAt: 1,
      ...(status === 'running' ? {} : { endedAt: 2, ok: status === 'done' }),
      harness: 'claude-code',
      logPath,
    })
  })
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-retired-unstick-'))
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
  forgetMachineState(root)
  setBoardRoot(root)
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

describe('an unstick run from before the sweeper was removed', () => {
  it('is still listed', async () => {
    run('old-done', 'done')
    const [only] = await listRuns()
    assert.equal(only.action, 'unstick')
    assert.equal(only.status, 'done')
  })

  it('reads as an ordinary unfinished run when the upgrade caught it going', async () => {
    run('old-live', 'running')
    const [only] = await listRuns()
    assert.equal(only.action, 'unstick')
    assert.equal(only.status, 'interrupted')
  })

  it('has no command and no agent left to start another', () => {
    assert.equal(flowByCommand('unstick'), undefined)
    assert.ok(!roles().some((r) => r.name === 'sweeper'))
  })

  it('ignores what the sweeper left on disk', async () => {
    fs.mkdirSync(path.dirname(UI_CONFIG), { recursive: true })
    fs.writeFileSync(
      UI_CONFIG,
      JSON.stringify({ cardSweep: { cadence: '3d', lastRun: '2026-09-30 10:00' }, agentRuntime: { sweeper: 'global-default' } }),
    )
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(path.join(RULES, 'sweeper.md'), 'never discard a card in the current release\n')
    fs.mkdirSync(path.dirname(SESSIONS), { recursive: true })
    fs.writeFileSync(path.join(path.dirname(SESSIONS), 'sweeper-report.json'), JSON.stringify({ sweepId: 'x', status: 'running', rows: [] }))
    assert.ok(!agentRoster().some((a) => a.name === 'sweeper'))
    const work = await nextWork(() => Promise.resolve(true))
    assert.ok(!work.some((req) => req.action === 'unstick'))
    assert.deepEqual(await listRuns(), [])
  })
})
