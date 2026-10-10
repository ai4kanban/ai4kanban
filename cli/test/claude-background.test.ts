// Claude Code's background tasks outlive the reply (#1540): its turns go in on stdin, a run
// waits for them and writes their result into the same run, and a chat keeps the process for
// the next message and saves the turn the background starts as a reply of its own.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { CHATS_DIR, SESSIONS_DIR, setBoardRoot } from '../src/lib/paths.ts'
import { openRun, patch, peekRun } from '../src/lib/agent/sessions.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import { watchRun } from '../src/lib/agent/watch.ts'
import { readChat, readChatView, sendChatMessage, setChatShare, stopChatBackground } from '../src/lib/agent/chat.ts'
import { archiveDiscussion, startDiscussion } from '../src/lib/agent/discussions.ts'
import { BACKGROUND_WAIT } from '../src/lib/agent/settings.ts'
import { forgetMachineState, restoreMachineHome, uiConfigOf } from './helpers/board.ts'

let root = ''
let home = ''
const WAIT = BACKGROUND_WAIT.minutes

// A stand-in Claude Code: one turn per stdin message. `start` puts a task in the background
// that ends after `after` ms (never, at -1), `ping` answers at once, `leave` detaches a
// command with `nohup` the way a shell `&` does and writes its pid to `left.pid`. It exits
// when stdin closes.
function fakeClaude(after: number): string {
  const script = path.join(root, 'claude.mjs')
  const spawns = path.join(root, 'spawns.log')
  const left = path.join(root, 'left.pid')
  fs.writeFileSync(
    script,
    `import fs from 'node:fs'
import { execSync } from 'node:child_process'
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
    const said = JSON.parse(buf.slice(0, end)).message.content
    buf = buf.slice(end + 1)
    if (said.endsWith('ping')) turn('PONG')
    else if (said.endsWith('leave')) {
      // A program of our own rather than \`sleep\`: macOS shows no environment for the ones it ships.
      const pid = execSync('nohup ' + JSON.stringify(process.execPath) + ' -e "setInterval(() => {}, 1000)" >/dev/null 2>&1 & echo $!', { encoding: 'utf8' })
      fs.writeFileSync(${JSON.stringify(left)}, pid.trim())
      turn('LEFT')
    }
    else {
      out({ type: 'system', subtype: 'task_started', task_id: 't1', is_backgrounded: true })
      turn('STARTED', [{ task_id: 't1' }])
      if (${after} >= 0) setTimeout(() => {
        out({ type: 'system', subtype: 'background_tasks_changed', tasks: [] })
        out({ type: 'system', subtype: 'task_notification', task_id: 't1', summary: 'Background command done' })
        turn('FINISHED')
      }, ${after})
    }
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

const until = async (ok: () => boolean, ms = 5000): Promise<void> => {
  const end = Date.now() + ms
  while (!ok()) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 25))
  }
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

describe('a chat with a background task', () => {
  it('ends the reply at its turn, answers the next message in the same process, and saves the background result', async () => {
    board(fakeClaude(1500), 5)
    const first = await sendChatMessage(null, 'start')
    assert.ok('text' in first)
    assert.equal(first.text, 'STARTED')
    assert.equal(first.stoppedWhy, undefined)
    assert.equal(readChatView(null).background, 1)

    const second = await sendChatMessage(null, 'ping')
    assert.ok('text' in second)
    assert.equal(second.text, 'PONG')
    assert.equal(spawns(), 1)

    await until(() => !!readChat(null)?.messages.some((m) => m.afterBackground))
    const last = readChat(null)!.messages.at(-1)!
    assert.equal(last.afterBackground, true)
    assert.match(last.text, /FINISHED/)
    assert.ok(Math.abs(last.costUsd! - 0.1) < 1e-9, `the turn's own cost, not the session's: ${last.costUsd}`)
    await until(() => readChatView(null).background === undefined)
  })

  it('stops the agent and its background tasks on Stop', async () => {
    board(fakeClaude(-1), 5)
    await sendChatMessage(null, 'start')
    assert.equal(readChatView(null).background, 1)
    const pid = Number(fs.readFileSync(path.join(root, 'spawns.log'), 'utf8').trim())
    stopChatBackground(null)
    await until(() => {
      try {
        process.kill(pid, 0)
        return false
      } catch {
        return true
      }
    }, 10_000)
    assert.equal(readChatView(null).background, undefined)
    assert.ok(!readChat(null)!.messages.some((m) => m.afterBackground))
    assert.ok(fs.existsSync(CHATS_DIR))
  })
})

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const firstSpawn = (): number => Number(fs.readFileSync(path.join(root, 'spawns.log'), 'utf8').trim().split('\n')[0])

// #1603
describe('what a chat agent leaves behind', () => {
  it('a command it detached ends with the turn', async () => {
    board(fakeClaude(-1), 5)
    const reply = await sendChatMessage(null, 'leave')
    assert.ok('text' in reply)
    assert.equal(reply.text, 'LEFT')
    const left = Number(fs.readFileSync(path.join(root, 'left.pid'), 'utf8'))
    try {
      await until(() => !alive(firstSpawn()) && !alive(left), 10_000)
    } finally {
      if (alive(left)) process.kill(left, 'SIGKILL')
    }
  })

  it('End discussion ends the agent still holding a background task', async () => {
    board(fakeClaude(-1), 5)
    const target = startDiscussion()
    await sendChatMessage(target, 'start')
    assert.equal(readChatView(target).background, 1)
    try {
      assert.deepEqual(archiveDiscussion(target), { ok: true, plans: [] })
      await until(() => !alive(firstSpawn()), 10_000)
    } finally {
      stopChatBackground(target)
    }
  })

  it('an End discussion refused leaves the agent running', async () => {
    board(fakeClaude(-1), 5)
    const target = startDiscussion()
    await sendChatMessage(target, 'start')
    setChatShare(target, true)
    const refused = archiveDiscussion(target)
    assert.ok('error' in refused && refused.reason === 'share-needs-card')
    await new Promise((r) => setTimeout(r, 300))
    assert.ok(alive(firstSpawn()))
    stopChatBackground(target)
    await until(() => !alive(firstSpawn()), 10_000)
  })
})
