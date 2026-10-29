// Staying connected: register, keep a Realtime topic open for hints, re-register on a timer
// to stay the account's Runner, keep a presence connection so Cloud sees it go (#2163), and
// read the waiting jobs on every connect and hint. The chats it answered are reviewed for
// memory once a day (#2065), the projects' periodic agents are looked at every minute (#2068),
// and the cache is cleaned at the start and once a day (#2147).

import { connectCloudLive, type LiveConnection } from '../../cli/src/lib/cloud/live'
import { readSession } from '../../cli/src/lib/cloud/session'
import { AGENTS_EVERY_MS, askDueAgents } from './agents'
import * as api from './api'
import { SWEEP_MS, removeLegacy, sweepCache } from './cache'
import { pruneChats, reviewChats } from './chats'
import { answerHint } from './diff'
import { stopLeftBehind } from './flow'
import { status, t } from './i18n'
import { holdMachine, type Holder } from './lock'
import { STOP_MS, defaultDeps, folderFor, runJob, type Deps } from './jobs'
import { keepPresence, type Presence } from './presence'
import { akbCardOf, openTaskFolder } from './task-folder'

/** Re-register this often: it is what keeps the computer counted as connected. */
const HEARTBEAT_MS = 5 * 60_000
/** How often to read the jobs when no Realtime hint can arrive. */
const POLL_MS = 60_000
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000]

/** Why the Runner stopped for good. */
export type Stop = { reason: 'elsewhere'; machine: string } | { reason: 'outdated' } | { reason: 'refused'; message: string }

export interface Options {
  registration: () => Promise<api.Registration>
  deps?: Deps
  heartbeatMs?: number
  pollMs?: number
  /** Called each time Cloud accepts the registration after it did not. */
  onConnected?: () => void
  /** Read on every register: whether this computer shows notifications. */
  notify?: () => boolean
  /** Every Realtime hint, and every (re)join — the desktop app reads what it shows on both. */
  onHint?: (payload: Record<string, unknown>) => void
  /** Cloud stopped answering; the next successful register calls onConnected again. */
  onDisconnected?: () => void
  /** How often the periodic agents are looked at. */
  agentsMs?: number
  /** What runs this Runner, told to any other one on this computer that waits behind it. */
  kind: Holder
  /** Another process on this computer runs its jobs; this one starts when that one stops. */
  onWaiting?: (holder?: Holder) => void
}

export interface Runner {
  /** Resolves when Cloud refuses this Runner for good. */
  stopped: Promise<Stop>
  /** Release the account, stop every job, and close. */
  close(): Promise<void>
  /** Register again now, to tell Cloud what changed. */
  renew(): void
}

export function startRunner(options: Options): Runner {
  let registration: api.Registration | null = null
  let connected = false
  let closed = false
  let attempts = 0
  let live: LiveConnection | null = null
  let presence: Presence | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let reading = false
  let readAgain = false
  const running = new Map<string, (() => Promise<void>) | null>()
  let stop: (s: Stop) => void = () => {}
  const stopped = new Promise<Stop>((resolve) => (stop = resolve))

  const deps = (): Deps => {
    const base = options.deps ?? defaultDeps(registration!.machineId)
    return { ...base, runtimes: () => base.runtimes().then(redetected) }
  }

  /** A job looked again — a test after an install or a sign-in: Cloud hears before the job ends. */
  const redetected = async (found: api.RuntimeReport[]) => {
    if (closed || !registration || JSON.stringify(found) === JSON.stringify(registration.runtimes)) return found
    registration = { ...registration, runtimes: found }
    await api.register(options.notify ? { ...registration, notify: options.notify() } : registration)
    return found
  }
  const idle = () => (running.size ? t.running(running.size) : t.connected(registration!.machineName))

  const schedule = (ms: number) => {
    if (closed) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(tick, ms)
  }

  let looking = false
  const agentsDue = async () => {
    if (looking || closed || !connected || !registration) return
    looking = true
    try {
      if (await askDueAgents(registration.machineId)) void readJobs()
    } catch (e) {
      console.error(`runner: the periodic agents were not looked at: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      looking = false
    }
  }
  const agentsTimer = setInterval(() => void agentsDue(), options.agentsMs ?? AGENTS_EVERY_MS)
  agentsTimer.unref?.()

  let sweeping = false
  let swept = false
  const sweep = async () => {
    if (sweeping || closed || !registration) return
    sweeping = true
    try {
      await sweepCache(registration.machineId)
    } catch (e) {
      console.error(`runner: the cache was not cleaned: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      sweeping = false
    }
  }
  const sweepTimer = setInterval(() => void sweep(), SWEEP_MS)
  sweepTimer.unref?.()

  const finish = async (s: Stop) => {
    await close(false)
    stop(s)
  }

  const tick = async () => {
    registration ??= await options.registration()
    if (!swept) {
      swept = true
      void sweep()
    }
    const answer = await api.register(options.notify ? { ...registration, notify: options.notify() } : registration)
    if (closed) return
    if (!answer.ok) {
      if (answer.code === 'runner_elsewhere') {
        const held = await api.readRunner()
        return finish({ reason: 'elsewhere', machine: (held.ok && held.value.runner?.machineName) || '?' })
      }
      if (answer.code === 'runner_outdated') return finish({ reason: 'outdated' })
      if (answer.code) return finish({ reason: 'refused', message: answer.error })
      if (connected) options.onDisconnected?.()
      connected = false
      status(t.reconnecting())
      return schedule(BACKOFF_MS[Math.min(attempts++, BACKOFF_MS.length - 1)]!)
    }
    attempts = 0
    if (!connected) {
      connected = true
      status(idle())
      options.onConnected?.()
      openLive()
      presence ??= keepPresence(registration.machineId)
      // The registration skipped the slow model lists; the full look follows.
      void deps().runtimes()
    }
    await readJobs()
    void reviewDue()
    void agentsDue()
    schedule(live?.joined() ? options.heartbeatMs ?? HEARTBEAT_MS : Math.min(options.pollMs ?? POLL_MS, options.heartbeatMs ?? HEARTBEAT_MS))
  }

  const openLive = () => {
    if (live) return
    const subject = readSession()?.subject
    if (!subject) return
    live = connectCloudLive({
      topic: `runner:${subject}`,
      onHint: (payload) => {
        if (payload.diff) {
          if (registration) void answerHint(registration.machineId, payload)
          return
        }
        if (payload.jobId || !(payload.alertId || payload.taskId)) void readJobs()
        options.onHint?.(payload)
      },
      onReady: () => {
        void readJobs()
        options.onHint?.({})
      },
    })
  }

  /** The catch-up read. One at a time; a hint during a read reads once more after it. */
  const readJobs = async (): Promise<void> => {
    if (closed || !registration) return
    if (reading) {
      readAgain = true
      return
    }
    reading = true
    try {
      const list = await api.listJobs(registration.machineId)
      if (!list.ok) return
      for (const job of list.value.jobs) {
        // Held by this computer and not running here: the Runner restarted under it.
        if (job.state === 'claimed' && !running.has(job.id)) {
          await stopLeftOn(job)
          await api.finishJob(registration.machineId, job.id, 'failed', 'The Runner restarted while this job was running.')
          continue
        }
        // Cloud lists only the jobs the plan's running limit lets start (#2209).
        if (job.state !== 'waiting' || running.has(job.id)) continue
        start(job.id)
      }
    } finally {
      reading = false
      if (readAgain) {
        readAgain = false
        void readJobs()
      }
    }
  }

  /** The board runs a flow job left on its card when the Runner was force-quit under it (#2120). */
  const stopLeftOn = async (job: api.Job) => {
    if (!job.flow || !job.task) return
    try {
      const folder = job.projectDir ? folderFor(job) : null
      if (folder && 'refused' in folder) return
      const ws = openTaskFolder(job, folder?.cwd ?? null)
      const card = akbCardOf(ws)
      if (card) await stopLeftBehind(deps().akb, ws, card, deps().stopMs)
    } catch (e) {
      console.error(`runner: the runs left on job ${job.id}'s card were not stopped: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  let reviewing = false
  const reviewDue = async () => {
    if (reviewing || closed || !registration) return
    reviewing = true
    try {
      await reviewChats(registration.machineId)
    } catch (e) {
      console.error(`runner: the chats were not reviewed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      reviewing = false
    }
  }

  const start = (id: string) => {
    running.set(id, null)
    status(idle())
    void runJob(id, deps(), (halt) => running.set(id, halt))
      .catch(() => {})
      .finally(() => {
        running.delete(id)
        if (closed) return
        status(idle())
        void readJobs()
      })
  }

  const close = async (release = true) => {
    if (closed) return
    closed = true
    lock.release()
    if (timer) clearTimeout(timer)
    clearInterval(agentsTimer)
    clearInterval(sweepTimer)
    live?.close()
    presence?.close()
    // Each job's own stop is bounded; this bounds them all, should one hang.
    const stops = Promise.all([...running.values()].map((halt) => halt?.()))
    let timeout: ReturnType<typeof setTimeout> | undefined
    await Promise.race([stops, new Promise((resolve) => (timeout = setTimeout(resolve, (options.deps?.stopMs ?? STOP_MS) + 1_000)))])
    clearTimeout(timeout)
    if (release && registration) await api.release(registration.machineId)
  }

  removeLegacy()
  pruneChats()
  const lock = holdMachine(options.kind, () => void tick(), (holder) => {
    status(t.waitingHere(holder))
    options.onWaiting?.(holder)
  })
  return { stopped, close: () => close(true), renew: () => schedule(0) }
}
