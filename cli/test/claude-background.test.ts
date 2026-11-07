// Claude Code's background tasks outlive the reply (#1540): its turns go in on stdin, and a run
// waits for them and writes their result into the same run.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { openRun, patch, peekRun } from '../src/lib/agent/sessions.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { BACKGROUND_WAIT } from '../src/lib/agent/settings.ts'
import { forgetMachineState, restoreMachineHome, uiConfigOf } from './helpers/board.ts'

let root = ''
let home = ''
const WAIT = BACKGROUND_WAIT.minutes

// A stand-in Claude Code: each stdin message puts a task in the background that ends after
// `after` ms (never, at -1). It exits when stdin closes.
function fakeClaude(after: number): string {
  const script = path.join(root, 'claude.mjs')
  const spawns = path.join(root, 'spawns.log')
  fs.writeFileSync(
    script,
    `import fs from 'node:fs'
fs.appendFileSync(${JSON.stringify(spawns)}, process.pid + '\\n')
const out = (ev) => process.stdout.write(JSON.stringify(ev) + '\\n')
let cost = 0
const turn = (text, background) => {
  out({ type: 'system', subtype: 'init', model: 'claude-test' })
  if (background !== undefined) out({ type: 'system', subtype: 'background_tasks_changed', tasks: background })
  out({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
  cost += 0.1
  out({ type: 'result', result: text, total_cost_usd: cost, usage: { input_tokens: 10, output_tokens: 5 } })
}
let buf = ''
process.stdin.on('data', (d) => {
  buf += d
  let end
  while ((end = buf.indexOf('\\n')) >= 0) {
    buf = buf.slice(end + 1)
    out({ type: 'system', subtype: 'task_started', task_id: 't1', is_backgrounded: true })
    turn('STARTED', [{ task_id: 't1' }])
    if (${after} >= 0) setTimeout(() => {
      out({ type: 'system', subtype: 'background_tasks_changed', tasks: [] })
      out({ type: 'system', subtype: 'task_notification', task_id: 't1', summary: 'Background command done' })
      turn('FINISHED')
    }, ${after})
  }
})
process.stdin.on('end', () => process.exit(0))
`,
  )
  return script
}

const spawns = (): number => fs.readFileSync(path.join(root, 'spawns.log'), 'utf8').trim().split('\n').length

function board(script: string, silenceMinutes: number): void {
  fs.writeFileSync(
    uiConfigOf(root, 'docs', 'kanban'),
    JSON.stringify({ harness: 'claude-code', silenceMinutes, harnessSettings: { 'claude-code': { command: `${process.execPath} ${script}` } } }),
  )
}

function run(script: string): string {
  const opened = openRun({ action: 'prune-memory' }, 'start', [])
  if ('error' in opened) throw new Error(opened.error)
  opened.spec.plan.argv = [process.execPath, script, '--input-format', 'stream-json']
  opened.spec.plan.harness = 'claude-code'
  fs.writeFileSync(path.join(SESSIONS_DIR, `${opened.run.sessionId}.plan.json`), JSON.stringify(opened.spec))
  patch(opened.run.sessionId, (r) => {
    r.pid = process.pid
  })
  return opened.run.sessionId
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-claude-bg-'))
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-claude-bg-home-'))
  process.env.AI4KANBAN_HOME = home
  forgetMachineState(root)
  fs.mkdirSync(path.join(root, 'docs', 'kanban', 'todo'), { recursive: true })
  setBoardRoot(root)
  setBoardProvider(null)
})

afterEach(() => {
  BACKGROUND_WAIT.minutes = WAIT
  forgetMachineState(root)
  restoreMachineHome()
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(home, { recursive: true, force: true })
})

describe('a run with a background task', () => {
  it('outlasts the silence limit, carries on in the same run, and ends once it is done', async () => {
    // 0.02 minutes is 1.2s of silence; the task stays quiet for 2s.
    board(fakeClaude(2000), 0.02)
    const id = run(fakeClaude(2000))
    await watchRun(id, async () => ({ error: 'no resume' }))
    const record = peekRun(id)!
    assert.equal(record.status, 'done', record.error)
    assert.equal(record.result, 'FINISHED')
    const log = fs.readFileSync(record.logPath, 'utf8')
    assert.match(log, /STARTED[\s\S]*Background command done[\s\S]*FINISHED/)
    assert.equal(spawns(), 1)
  })

  it('is ended with its reason once the background wait runs out', async () => {
    board(fakeClaude(-1), 0.02)
    BACKGROUND_WAIT.minutes = 0.03
    const id = run(fakeClaude(-1))
    await watchRun(id, async () => ({ error: 'no resume' }))
    const record = peekRun(id)!
    assert.equal(record.status, 'error')
    assert.match(record.error ?? '', /background tasks did not finish/)
    assert.deepEqual(record.errorWhy?.map((w) => w.kind), ['backgroundSilent'])
  })
})
