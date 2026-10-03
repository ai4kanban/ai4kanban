// A run whose agent exits on its own ends the commands it left in the background (#1499).

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, it } from 'node:test'

import { patch } from '../src/lib/agent/sessions.ts'
import { startRun } from '../src/lib/agent/start.ts'
import { readRuns } from '../src/lib/agent/store.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { pidAlive } from '../src/lib/lock.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { forgetMachineState, move, uiConfigOf } from './helpers/board.ts'

let root = ''

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-run-end-'))
  forgetMachineState(root)
  setBoardRoot(root)
  setBoardProvider(null)
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'next-id'), '1\n')
  fs.writeFileSync(path.join(root, 'docs', 'kanban', 'todo', 'README.md'), '# Tasks\n')
  await move(root, ['create', '--title', 'Card one'])
})

afterEach(() => {
  forgetMachineState(root)
  fs.rmSync(root, { recursive: true, force: true })
})

it('ends what a finished run left in the background, even one holding its output', { skip: process.platform === 'win32' }, async () => {
  const left = path.join(root, 'left')
  const file = path.join(root, 'agent.mjs')
  // The command keeps the agent's stdout, so without the kill `close` would wait on it.
  fs.writeFileSync(
    file,
    `import { spawn } from 'node:child_process'
import fs from 'node:fs'
const c = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { detached: true, stdio: 'inherit' })
c.unref()
fs.writeFileSync(${JSON.stringify(left)}, String(c.pid))
console.log(JSON.stringify({ type: 'result', result: 'ok' }))
`,
  )
  fs.writeFileSync(
    uiConfigOf(root, 'docs', 'kanban'),
    JSON.stringify({ runtimes: [{ id: 'global', name: 'Global default', harness: 'claude-code', settings: { command: `node ${file}` } }] }),
  )
  const started = await startRun({ action: 'clarify', id: 1 })
  if ('error' in started) throw new Error(started.error)
  const run = started.run
  patch(run.sessionId, (r) => { r.pid = process.pid })
  fs.writeFileSync(run.logPath, '')

  const t = Date.now()
  await watchRun(run.sessionId, async () => ({ error: 'no resume' }))
  const pid = Number(fs.readFileSync(left, 'utf8'))
  try {
    assert.ok(Date.now() - t < 20_000)
    assert.equal(readRuns().find((r) => r.sessionId === run.sessionId)?.status, 'done')
    assert.equal(pidAlive(pid), false)
  } finally {
    try { process.kill(pid, 'SIGKILL') } catch { /* gone */ }
  }
})
