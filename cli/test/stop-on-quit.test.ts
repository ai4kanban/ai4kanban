// A process told to quit takes its chat and test agents, and their commands, with it (#1385).
//
// The quitting process is this file again, run with `HOST` set: it starts a stand-in agent,
// tracks it, prints the pids, and waits for the signal.

import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { pidAlive } from '../src/lib/lock.ts'
import { leaveInterruptToCaller, markEnv, stopMark, trackAgent } from '../src/lib/agent/stop.ts'

const HOST = 'AKB_TEST_QUIT_HOST'
const NODE = JSON.stringify(process.execPath)
const IDLE = `${NODE} -e "setTimeout(() => {}, 60000)"`
// One command found by its mark, and one the system ships: `sleep` shows no environment on
// macOS and is reached as the agent's child.
const AGENT = `${IDLE} & echo $!; sleep 60 & echo $!; wait`
const QUITS = ['SIGTERM', 'SIGINT', 'SIGHUP'] as const

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function until(what: () => boolean, ms = 5_000): Promise<boolean> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (what()) return true
    await wait(50)
  }
  return what()
}

function sh(script: string, env: NodeJS.ProcessEnv): ChildProcess {
  return spawn('sh', ['-c', script], { env, stdio: ['ignore', 'pipe', 'ignore'] })
}

/** The first `count` lines `child` prints, as numbers. */
function pidsFrom(child: ChildProcess, count: number): Promise<number[]> {
  return new Promise((resolve) => {
    let out = ''
    child.stdout!.on('data', (d: Buffer) => {
      out += String(d)
      const lines = out.split('\n').filter(Boolean)
      if (lines.length >= count) resolve(lines.slice(0, count).map(Number))
    })
  })
}

function kill(pids: number[]): void {
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // already gone
    }
  }
}

function host(mode: string): void {
  if (mode === 'interrupt') leaveInterruptToCaller()
  // Someone else's shutdown, as Next's is: it has the exit, with its own code.
  if (mode === 'shared') process.on('SIGTERM', () => setTimeout(() => process.exit(7), 100))
  if (mode === 'interrupt') process.on('SIGINT', () => setTimeout(() => process.exit(7), 100))
  const mark = stopMark()
  const agent = sh(AGENT, markEnv(process.env, mark))
  trackAgent(agent, mark)
  agent.stdout!.pipe(process.stdout)
  setTimeout(() => {}, 60_000)
}

async function quitting(mode: string): Promise<{ proc: ChildProcess; pids: number[] }> {
  const proc = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, [HOST]: mode },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  return { proc, pids: await pidsFrom(proc, 2) }
}

const exited = (proc: ChildProcess) => proc.exitCode !== null || proc.signalCode !== null
const quitListeners = () => QUITS.map((sig) => process.listenerCount(sig))

if (process.env[HOST]) {
  host(process.env[HOST])
} else {
  describe('a process told to quit', { skip: process.platform === 'win32' }, () => {
    it('kills the commands its agent started, leaves the unmarked, and exits 143', async () => {
      const { proc, pids } = await quitting('alone')
      const theirs = sh(`${IDLE} & echo $!; wait`, process.env)
      const other = await pidsFrom(theirs, 1)
      try {
        assert.ok(pids.every(pidAlive), 'the commands are running')
        proc.kill('SIGTERM')
        assert.ok(await until(() => exited(proc)))
        assert.equal(proc.exitCode, 143)
        assert.ok(await until(() => !pids.some(pidAlive)), 'the marked commands are ended')
        assert.ok(pidAlive(other[0]), 'the unmarked one is left alone')
      } finally {
        kill([...pids, ...other, theirs.pid!, proc.pid!])
      }
    })

    it('leaves the exit to another listener', async () => {
      const { proc, pids } = await quitting('shared')
      try {
        proc.kill('SIGTERM')
        assert.ok(await until(() => exited(proc)))
        assert.equal(proc.exitCode, 7)
        assert.ok(await until(() => !pids.some(pidAlive)))
      } finally {
        kill([...pids, proc.pid!])
      }
    })

    it('leaves Ctrl-C alone where the caller spends it on the reply', async () => {
      const { proc, pids } = await quitting('interrupt')
      try {
        proc.kill('SIGINT')
        assert.ok(await until(() => exited(proc)))
        assert.equal(proc.exitCode, 7)
        assert.ok(pids.every(pidAlive), 'nothing was killed')
      } finally {
        kill([...pids, proc.pid!])
      }
    })

    it('listens only while an agent is running', async () => {
      const before = quitListeners()
      const mark = stopMark()
      const first = sh('sleep 60', markEnv(process.env, mark))
      const second = sh('sleep 60', markEnv(process.env, mark))
      try {
        trackAgent(first, mark)
        trackAgent(second, mark)
        assert.deepEqual(quitListeners(), before.map((n) => n + 1))
        first.kill('SIGKILL')
        assert.ok(await until(() => exited(first)))
        await wait(100)
        assert.deepEqual(quitListeners(), before.map((n) => n + 1), 'one is still running')
        second.kill('SIGKILL')
        assert.ok(await until(() => quitListeners().every((n, i) => n === before[i])), 'none left on the process')
      } finally {
        kill([first.pid!, second.pid!])
      }
    })

    it('does not track an agent that never started', async () => {
      const before = quitListeners()
      const missing = spawn('/nonexistent/akb-agent', [], { stdio: 'ignore' })
      missing.on('error', () => {})
      trackAgent(missing, stopMark())
      assert.deepEqual(quitListeners(), before)
    })
  })
}
