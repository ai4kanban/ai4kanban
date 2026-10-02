// Ending an agent together with every command it started (#1302).
//
// Each agent is spawned with a mark in its environment that its commands inherit: the run's
// id for a run, a one-off id for a chat turn or a test. A command put in the background has
// left the agent's process group and often its process tree, and still carries the mark.
//
// Windows shows nobody another process's environment, so there the commands are found as
// descendants of a recorded pid (#1313). One whose parent has already exited is not reached.

import { spawnSync, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'

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

export interface Proc {
  pid: number
  ppid: number
  /** When it was created, in epoch milliseconds. */
  startedAt: number
}

export interface ProcList {
  procs: Proc[]
  bootedAt: number
}

/** What to end under `root`, deepest first and `root` itself last when it is still there.
 *  `since` is when `root` was recorded; left out, `root` has to be listed and its own start
 *  stands in. A pid is reused, so nothing older than its parent or than `since` counts, a
 *  `root` started after `since` is somebody else's, and so is everything after a reboot. */
export function startedUnder(list: ProcList, root: number, since?: number): number[] {
  const self = list.procs.find((p) => p.pid === root)
  const from = since ?? self?.startedAt
  if (from === undefined || list.bootedAt > from) return []
  if (self && self.startedAt > from) return []
  const found: number[] = self ? [root] : []
  const seen = new Set([root])
  const queue = [{ pid: root, startedAt: from }]
  for (const parent of queue) {
    for (const p of list.procs) {
      if (p.ppid !== parent.pid || seen.has(p.pid) || p.startedAt < parent.startedAt) continue
      seen.add(p.pid)
      found.push(p.pid)
      queue.push(p)
    }
  }
  return found.reverse()
}

const LIST_PROCS = [
  "$ErrorActionPreference = 'Stop'",
  "Get-CimInstance Win32_Process | ForEach-Object { if ($_.CreationDate) { '{0} {1} {2}' -f $_.ProcessId, $_.ParentProcessId, ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } }",
  "'boot {0}' -f ([DateTimeOffset](Get-CimInstance Win32_OperatingSystem).LastBootUpTime).ToUnixTimeMilliseconds()",
].join('; ')

/** Read what the listing printed: `<pid> <ppid> <ms>` a process, then `boot <ms>`. */
export function readProcList(out: string): ProcList | undefined {
  const procs: Proc[] = []
  let bootedAt: number | undefined
  for (const line of out.split(/\r?\n/)) {
    const boot = /^boot (\d+)$/.exec(line.trim())
    if (boot) bootedAt = Number(boot[1])
    const m = /^(\d+) (\d+) (\d+)$/.exec(line.trim())
    if (m) procs.push({ pid: Number(m[1]), ppid: Number(m[2]), startedAt: Number(m[3]) })
  }
  return bootedAt !== undefined && procs.length ? { procs, bootedAt } : undefined
}

// Windows PowerShell ships with Windows 10 and 11; `wmic` no longer does.
function procsOnWindows(): ProcList | undefined {
  const ps = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', LIST_PROCS], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 5_000,
    windowsHide: true,
  })
  return ps.status === 0 && ps.stdout ? readProcList(ps.stdout) : undefined
}

/** Windows, where `taskkill /T` could not do it: force-end everything started under `pid`,
 *  then `pid` itself. Does nothing anywhere else, and when the processes cannot be listed. */
export function killUnderOnWindows(pid?: number, since?: number): void {
  if (!WINDOWS || !pid) return
  const list = procsOnWindows()
  if (!list) return
  const pids = startedUnder(list, pid, since).filter((p) => p !== process.pid)
  if (!pids.length) return
  spawnSync('taskkill', ['/F', ...pids.flatMap((p) => ['/PID', String(p)])], { stdio: 'ignore', windowsHide: true, timeout: 10_000 })
}

/** Kill what a run nobody is watching any more left behind. On Windows that is what was
 *  started under its recorded `agent`; a run with none recorded is left as it is. */
export function killMarked(mark: Mark, agent?: { pid: number; since: number }): void {
  if (WINDOWS) {
    if (agent) killUnderOnWindows(agent.pid, agent.since)
    return
  }
  signal(marked(mark), 'SIGKILL')
}

/** Windows has no signal a process can catch and no environment to read, so a process is
 *  ended with everything under it at once. False anywhere else, and when that failed —
 *  `killUnderOnWindows` is what is left then. */
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
  killUnderOnWindows(child.pid)
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

// ---- when this process is told to go (#1385) --------------------------------

// The chat and test agents this process is running. No run stands behind them, so nothing
// else would end what they started.
const running = new Map<ChildProcess, Mark>()
const QUIT_SIGNALS = ['SIGTERM', 'SIGINT', 'SIGHUP'] as const
type QuitSignal = (typeof QUIT_SIGNALS)[number]
const listening = new Map<QuitSignal, () => void>()
let interruptIsTheCallers = false

/** `akb chat` spends Ctrl-C on stopping the reply, so it is not a quit there. Called before
 *  the agent starts. */
export function leaveInterruptToCaller(): void {
  interruptIsTheCallers = true
}

// Killed outright and found synchronously: the process is on its way out, and no timer of
// its own is going to fire.
function killRunning(): void {
  for (const [child, mark] of running) {
    if (killTreeOnWindows(child.pid)) continue
    killUnderOnWindows(child.pid)
    signal(marked(mark, child.pid ? [child.pid] : []), 'SIGKILL')
    try {
      child.kill('SIGKILL')
    } catch {
      // already gone
    }
  }
  running.clear()
}

function unlisten(): void {
  for (const [sig, fn] of listening) process.removeListener(sig, fn)
  listening.clear()
}

function onQuit(sig: QuitSignal): void {
  killRunning()
  unlisten()
  // Ours was the only listener, so the signal's own ending is ours to carry out. Anyone
  // else listening (Next's shutdown) has the exit.
  if (process.listenerCount(sig) === 0) process.exit(128 + os.constants.signals[sig])
}

/** Keep `child` on the list of agents to kill, with their commands, if this process is told
 *  to quit before it has closed. The signals are listened for only while the list is not
 *  empty. */
export function trackAgent(child: ChildProcess, mark: Mark): void {
  // Never started: no `close` is promised to take it off again.
  if (!child.pid) return
  running.set(child, mark)
  child.once('close', () => {
    running.delete(child)
    if (!running.size) unlisten()
  })
  for (const sig of QUIT_SIGNALS) {
    if (listening.has(sig) || (sig === 'SIGINT' && interruptIsTheCallers)) continue
    const fn = (): void => onQuit(sig)
    listening.set(sig, fn)
    process.on(sig, fn)
  }
}
