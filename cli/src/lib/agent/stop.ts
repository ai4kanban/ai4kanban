// Ending an agent together with every command it started (#1302).
//
// Each agent is spawned with a mark in its environment that its commands inherit: the run's
// id for a run, a one-off id for a chat turn or a test. A command put in the background has
// left the agent's process group and often its process tree, and still carries the mark.

import { spawnSync, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

import { RUN_ENV, STOP_ENV } from './env'

export interface Mark {
  name: string
  value: string
}

/** The mark a run's agent already carries. */
export const runMark = (sessionId: string): Mark => ({ name: RUN_ENV, value: sessionId })

/** A mark for an agent no run stands behind — a chat turn, a test. */
export const stopMark = (): Mark => ({ name: STOP_ENV, value: randomUUID() })

export const markEnv = (env: NodeJS.ProcessEnv, mark: Mark): NodeJS.ProcessEnv => ({ ...env, [mark.name]: mark.value })

const WINDOWS = process.platform === 'win32'
// How long a killed process gets to go before the next look for survivors.
const KILL_ROUND_MS = 300
const KILL_ROUNDS = 3

// Linux: every process of ours shows its environment under /proc.
function markedInProc(entry: string): number[] {
  const pids: number[] = []
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue
    try {
      if (fs.readFileSync(`/proc/${name}/environ`, 'utf8').split('\0').includes(entry)) pids.push(Number(name))
    } catch {
      // someone else's, or gone since the listing
    }
  }
  return pids
}

// macOS and the BSDs: `ps -E` prints the environment after the command line. It prints none
// for a program the system ships (`/bin/sh`, `sleep`), so those are reached as children of
// what was found, or of `roots`.
function markedInPs(entry: string, roots: number[]): number[] {
  const ps = spawnSync('ps', ['-A', '-E', '-ww', '-o', 'pid=,ppid=,command='], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 5_000,
  })
  if (ps.status !== 0 || !ps.stdout) return []
  const children = new Map<number, number[]>()
  const listed = new Set<number>()
  const found = new Set<number>()
  for (const line of ps.stdout.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s(.*)$/.exec(line)
    if (!m) continue
    const pid = Number(m[1])
    const ppid = Number(m[2])
    listed.add(pid)
    children.set(ppid, [...(children.get(ppid) ?? []), pid])
    if (`${m[3]} `.includes(` ${entry} `)) found.add(pid)
  }
  const queue = [...found, ...roots.filter((pid) => listed.has(pid))]
  for (const pid of queue) {
    found.add(pid)
    for (const child of children.get(pid) ?? []) if (!found.has(child)) queue.push(child)
  }
  return [...found]
}

/** Every process started under the mark, never this one. `roots` are processes already known
 *  to be its own. Empty when the listing cannot be read, and on Windows. */
export function marked(mark: Mark, roots: number[] = []): number[] {
  if (WINDOWS || !mark.value) return []
  const entry = `${mark.name}=${mark.value}`
  try {
    const pids = process.platform === 'linux' ? markedInProc(entry) : markedInPs(entry, roots)
    return pids.filter((pid) => pid !== process.pid)
  } catch {
    return []
  }
}

function signal(pids: number[], sig: NodeJS.Signals): void {
  for (const pid of pids) {
    try {
      process.kill(pid, sig)
    } catch {
      // already gone
    }
  }
}

/** Kill what a run nobody is watching any more left behind. */
export function killMarked(mark: Mark): void {
  signal(marked(mark), 'SIGKILL')
}

/** Windows has no signal a process can catch and no environment to read, so a process is
 *  ended with everything under it at once. False anywhere else, and when that failed. */
export function killTreeOnWindows(pid?: number): boolean {
  if (!WINDOWS || !pid) return false
  const out = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 10_000 })
  return out.status === 0
}

function later(ms: number, fn: () => void): void {
  const t = setTimeout(fn, ms)
  if (typeof t.unref === 'function') t.unref()
}

/** End an agent and every command it started: asked now, killed after `graceMs`, and looked
 *  for again until none is left. A listing that fails still ends the agent itself. */
export function endAgent(child: ChildProcess, mark: Mark, graceMs: number): void {
  const term = (sig: NodeJS.Signals): void => {
    try {
      child.kill(sig)
    } catch {
      // already gone
    }
  }
  if (killTreeOnWindows(child.pid)) return
  // Listed before the agent is asked: once it is gone its children are nobody's.
  const seen = new Set(marked(mark, child.pid ? [child.pid] : []))
  term('SIGTERM')
  signal([...seen].filter((pid) => pid !== child.pid), 'SIGTERM')
  const round = (left: number): void => {
    const pids = marked(mark, [...seen])
    signal(pids, 'SIGKILL')
    for (const pid of pids) seen.add(pid)
    if (pids.length && left > 1) later(KILL_ROUND_MS, () => round(left - 1))
  }
  later(graceMs, () => {
    term('SIGKILL')
    round(KILL_ROUNDS)
  })
}
