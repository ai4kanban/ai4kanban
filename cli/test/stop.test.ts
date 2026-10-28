// Stopping an agent ends the commands it started too (#1302).
//
// The marked cases skip Windows, which has no environment to read. What it does instead
// (#1313) is at the bottom: which pids it picks runs everywhere, ending them only there.

import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'

import { RUN_ENV, STOP_ENV } from '../src/lib/agent/env.ts'
import { watcherEnv } from '../src/lib/agent/launch.ts'
import { pidAlive } from '../src/lib/lock.ts'
import { setBoardRoot } from '../src/lib/paths.ts'
import { openRun, patch } from '../src/lib/agent/sessions.ts'
import { readStore } from '../src/lib/agent/store.ts'
import { setBoardProvider } from '../src/lib/board/index.ts'
import {
  endAgent,
  killMarked,
  markEnv,
  marked,
  readProcList,
  startedUnder,
  stopMark,
  type Mark,
  type ProcList,
} from '../src/lib/agent/stop.ts'
import { forgetMachineState } from './helpers/board.ts'

const skip = process.platform === 'win32'
const NODE = JSON.stringify(process.execPath)
const IDLE = `${NODE} -e "setTimeout(() => {}, 60000)"`

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function until(what: () => boolean, ms = 5_000): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (what()) return true
    await wait(50)
  }
  return what()
}

/** A stand-in agent: a shell that runs `script` and prints the pid of what it left behind. */
async function agent(script: string, mark?: Mark): Promise<{ child: ChildProcess; pid: number }> {
  const child = spawn('sh', ['-c', script], {
    env: mark ? markEnv(process.env, mark) : process.env,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const pid = await new Promise<number>((resolve) => child.stdout!.once('data', (d: Buffer) => resolve(Number(String(d).trim()))))
  return { child, pid }
}

describe('ending an agent with its commands', { skip }, () => {
  it('ends a background command whose shell has already exited, and nothing unmarked', async () => {
    const mark = stopMark()
    // The shell exits at once; what it started is nobody's child any more.
    const ours = await agent(`${IDLE} & echo $!`, mark)
    const theirs = await agent(`${IDLE} & echo $!`)
    await until(() => ours.child.exitCode !== null)
    try {
      assert.ok(pidAlive(ours.pid), 'the command outlives its shell')
      assert.deepEqual(marked(mark), [ours.pid])

      endAgent(ours.child, mark, 200)

      assert.ok(await until(() => !pidAlive(ours.pid)), 'the marked command is ended')
      assert.ok(pidAlive(theirs.pid), 'the unmarked one is left alone')
    } finally {
      for (const pid of [ours.pid, theirs.pid]) {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          // already gone
        }
      }
    }
  })

  it('ends a command that ignores the ask, and one the system ships', async () => {
    const mark = stopMark()
    // `sleep` shows no environment on macOS; it is reached as the agent's child.
    const { child, pid } = await agent(`trap '' TERM; sleep 60 & echo $!; wait`, mark)
    try {
      endAgent(child, mark, 200)
      assert.ok(await until(() => !pidAlive(pid)), 'the child is ended')
      assert.ok(await until(() => child.exitCode !== null || child.signalCode !== null), 'and so is the agent')
    } finally {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        // already gone
      }
    }
  })

  it('ends the children of an agent that leaves at once', async () => {
    const mark = stopMark()
    const { child, pid } = await agent(`sleep 60 & echo $!; wait`, mark)
    endAgent(child, mark, 200)
    assert.ok(await until(() => !pidAlive(pid)))
  })

  it('kills what an unwatched run left behind', async () => {
    const mark = { name: RUN_ENV, value: stopMark().value }
    const { pid } = await agent(`${IDLE} & echo $!`, mark)
    killMarked(mark)
    assert.ok(await until(() => !pidAlive(pid)))
  })

  it('finds nothing under an empty mark', () => {
    assert.deepEqual(marked({ name: RUN_ENV, value: '' }), [])
  })
})

describe("the watcher's environment", () => {
  it('drops the marks of the run or chat it was started inside', () => {
    const env = watcherEnv({ PATH: '/bin', [RUN_ENV]: 'outer-run', [STOP_ENV]: 'outer-chat' })
    assert.deepEqual(env, { PATH: '/bin' })
  })
})

describe('what Windows ends under a recorded pid', () => {
  const BOOT = 1_000
  const SINCE = 5_000
  const list = (...procs: [pid: number, ppid: number, startedAt: number][]): ProcList => ({
    procs: procs.map(([pid, ppid, startedAt]) => ({ pid, ppid, startedAt })),
    bootedAt: BOOT,
  })

  it('finds the descendants of a root that has exited, deepest first', () => {
    const procs = list([20, 10, 6_000], [30, 20, 7_000], [40, 1, 6_000])
    assert.deepEqual(startedUnder(procs, 10, SINCE), [30, 20])
  })

  it('ends a root that is still there last', () => {
    const procs = list([10, 1, 4_900], [20, 10, 6_000])
    assert.deepEqual(startedUnder(procs, 10, SINCE), [20, 10])
  })

  it('leaves a root pid somebody else took, and what is under it', () => {
    const procs = list([10, 1, 8_000], [20, 10, 9_000])
    assert.deepEqual(startedUnder(procs, 10, SINCE), [])
  })

  it('leaves what is older than the record, or than its own parent', () => {
    const procs = list([20, 10, 4_000], [30, 10, 6_000], [31, 30, 5_500])
    assert.deepEqual(startedUnder(procs, 10, SINCE), [30])
  })

  it('ends nothing once the machine has restarted', () => {
    const procs = { ...list([20, 10, 6_000]), bootedAt: 5_500 }
    assert.deepEqual(startedUnder(procs, 10, SINCE), [])
  })

  it("takes a live root's own start when none was recorded", () => {
    const procs = list([10, 1, 4_000], [20, 10, 4_500])
    assert.deepEqual(startedUnder(procs, 10), [20, 10])
    assert.deepEqual(startedUnder(procs, 99), [])
  })

  it('reads the listing, and nothing out of one it cannot', () => {
    assert.deepEqual(readProcList('0 0 1\r\n20 10 6000\r\nboot 1000\r\n'), {
      procs: [{ pid: 0, ppid: 0, startedAt: 1 }, { pid: 20, ppid: 10, startedAt: 6_000 }],
      bootedAt: 1_000,
    })
    assert.equal(readProcList('20 10 6000\n'), undefined)
    assert.equal(readProcList('Get-CimInstance : Access denied\n'), undefined)
  })

  it('ends the child of a parent that is gone, and nothing unrelated', { skip: process.platform !== 'win32' }, async () => {
    const idle = 'setTimeout(() => {}, 60000)'
    // Detached, or the child would go with its parent: node ends its own children on exit.
    const parent = spawn(
      process.execPath,
      ['-e', `const c = require('child_process').spawn(process.execPath, ['-e', ${JSON.stringify(idle)}], { detached: true, stdio: 'ignore' }); console.log(c.pid); ${idle}`],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const since = Date.now()
    const other = spawn(process.execPath, ['-e', idle], { stdio: 'ignore' })
    const child = await new Promise<number>((resolve) => parent.stdout!.once('data', (d: Buffer) => resolve(Number(String(d).trim()))))
    try {
      parent.kill()
      assert.ok(await until(() => parent.exitCode !== null || parent.signalCode !== null))
      assert.ok(pidAlive(child), 'the child outlives its parent')

      killMarked(stopMark(), { pid: parent.pid!, since })

      assert.ok(await until(() => !pidAlive(child)), 'the child is ended')
      assert.ok(pidAlive(other.pid), 'the unrelated one is left alone')
    } finally {
      for (const pid of [child, other.pid!, parent.pid!]) {
        try {
          process.kill(pid)
        } catch {
          // already gone
        }
      }
    }
  })
})

describe("the run's record", () => {
  it('keeps the agent it started through a read', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-stop-'))
    forgetMachineState(root)
    setBoardRoot(root)
    setBoardProvider(null)
    fs.mkdirSync(path.join(root, 'docs/kanban/todo'), { recursive: true })
    fs.writeFileSync(path.join(root, 'docs/kanban/next-id'), '1\n')
    fs.writeFileSync(path.join(root, 'docs/kanban/todo/README.md'), '# Tasks\n')
    try {
      const opened = openRun({ action: 'setup' }, 'Set up this board.', [])
      if ('error' in opened) throw new Error(opened.error)
      fs.writeFileSync(opened.run.logPath, '')
      patch(opened.run.sessionId, (r) => {
        r.agentPid = 4321
        r.agentStartedAt = 1_700_000_000_000
      })
      // A second write is what drops a field the reader does not know.
      patch(opened.run.sessionId, (r) => { r.model = 'x' })
      const run = readStore().runs.find((r) => r.sessionId === opened.run.sessionId)!
      assert.equal(run.agentPid, 4321)
      assert.equal(run.agentStartedAt, 1_700_000_000_000)
    } finally {
      forgetMachineState(root)
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
