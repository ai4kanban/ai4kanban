// Stopping an agent ends the commands it started too (#1302).
//
// Not on Windows: there the tree is ended by `taskkill`, and there is no environment to read.

import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { describe, it } from 'node:test'

import { RUN_ENV, STOP_ENV } from '../src/lib/agent/env.ts'
import { watcherEnv } from '../src/lib/agent/launch.ts'
import { pidAlive } from '../src/lib/lock.ts'
import { endAgent, killMarked, markEnv, marked, stopMark, type Mark } from '../src/lib/agent/stop.ts'

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
