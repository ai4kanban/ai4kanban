// Staying connected: register, keep a Realtime topic open for hints, re-register on a timer
// to stay the account's Runner, keep a presence connection so Cloud sees it go (#2163), and
// read the waiting jobs on every connect and hint. The chats it answered are reviewed for
// memory once a day (#2065), the projects' periodic agents are looked at on the hour (#291),
// the cache is cleaned at the start and once a day (#2147), and the boards kept here go back to
// Cloud as they change (#59) and come down as Cloud's change (#103).

import { connectCloudLive, type LiveConnection } from '../../cli/src/lib/cloud/live'
import { adoptLegacy } from './folders'
import fs from 'node:fs'
import path from 'node:path'
import { runnerHome } from './home'
import { accountGeneration, executorRecord } from './settings-control'
import { readSession } from '../../cli/src/lib/cloud/session'
import { askDueAgents, nextHour } from './agents'
import { followAkb, sweepAkb } from './akb-version'
import * as api from './api'
import { SWEEP_MS, removeLegacy, sweepCache } from './cache'
import { pruneChats, reviewChats } from './chats'
import { watchBoards, type BoardWatch } from './board-watch'
import { answerHint } from './diff'
import { stopLeftBehind } from './flow'
import { replySpent, readCheckpoint, saveCheckpoint, stopReply, PREPARE_REASON, UPDATE_REASON, UNCERTAIN } from './recovery'
import { status, t } from './i18n'
import { holdMachine, type Holder } from './lock'
import { STOP_MS, defaultDeps, folderFor, runJob, type Deps } from './jobs'
import { keepPresence, type Presence } from './presence'
import { refreshModels } from './runtimes'
import { akbCardOf, openTaskFolder } from './task-folder'

/** Re-register this often: it is what keeps the computer counted as connected, inside Cloud's
 *  15-minute lease. */
const HEARTBEAT_MS = 10 * 60_000
/** How often to read the jobs when no Realtime hint can arrive. */
const POLL_MS = 60_000
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
/** A look later than this has slept past its hour, and waits for the next. */
const LOOK_LATE_MS = 60_000

/** Why the Runner stopped for good. */
export type Stop = { reason: 'elsewhere'; machine: string } | { reason: 'outdated' } | { reason: 'refused'; message: string }

export interface Options {
  registration: () => Promise<api.Registration>
  deps?: Deps
  heartbeatMs?: number
  pollMs?: number
  /** Called each time Cloud accepts the registration after it did not. */
  onConnected?: () => void
  /** When the periodic agents are next looked at. */
  nextLook?: (now: number) => number
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
  /** 保存正在执行的作业，停机但保留云端领取状态。 */
  update(): Promise<void>
  /** Register again now, to tell Cloud what changed. */
  renew(): void
}

export function startRunner(options: Options): Runner {
  adoptLegacy()
  const account = readSession()?.subject
  const generation = accountGeneration()
  const releaseRecord = executorRecord()
  let registration: api.Registration | null = null
  let connected = false
  let closed = false
  let ownsExecution = false
  let redetect = false
  let preparing = false
  let attempts = 0
  let live: LiveConnection | null = null
  let presence: Presence | null = null
  let boards: BoardWatch | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let reading = false
  let readAgain = false
  let readDone = Promise.resolve()
  const jobs = new Set<Promise<void>>()
  const running = new Map<string, (() => Promise<void>) | null>()
  const attempted = new Set<string>()
  let stop: (s: Stop) => void = () => {}
  const stopped = new Promise<Stop>((resolve) => (stop = resolve))

  const deps = (): Deps => {
    const base = options.deps ?? defaultDeps(registration!.machineId)
    return { ...base, ...(options.deps ? {} : { authorize: async (job: api.Job) => {
      if (!validAccount()) return false
      if (!job.projectDir) return true
      const folders = await api.listFolders(registration!.machineId)
      return validAccount() && folders.ok && folders.value.folders.some((f) => f.project === job.project && f.path === job.projectDir)
    } }), runtimes: () => base.runtimes().then(redetected) }
  }

  /** Tell Cloud where things stand, and hear which akb to run. */
  const register = async () => {
    const answer = await api.register(registration!)
    if (answer.ok) void followAkb(answer.value.akb)
    return answer
  }

  /** A job looked again — a test after an install or a sign-in: Cloud hears before the job ends. */
  const redetected = async (found: api.RuntimeReport[]) => {
    if (closed || !registration || JSON.stringify(found) === JSON.stringify(registration.runtimes)) return found
    registration = { ...registration, runtimes: found }
    await register()
    return found
  }
  const idle = () => (running.size ? t.running(running.size) : t.connected(registration!.machineName))

  const schedule = (ms: number) => {
    if (closed || !ownsExecution) return
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
  let agentsTimer: ReturnType<typeof setTimeout> | null = null
  const lookNext = () => {
    if (closed) return
    const at = (options.nextLook ?? nextHour)(Date.now())
    agentsTimer = setTimeout(() => {
      const late = Date.now() - at
      if (late >= 0 && late < LOOK_LATE_MS) void agentsDue()
      lookNext()
    }, at - Date.now())
    agentsTimer.unref?.()
  }
  lookNext()

  let sweeping = false
  let swept = false
  const sweep = async () => {
    if (sweeping || closed || !registration) return
    sweeping = true
    try {
      sweepAkb()
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

  const validAccount = () => readSession()?.subject === account && accountGeneration() === generation
  const tick = async () => {
    if (closed || !ownsExecution) return
    if (!validAccount()) return finish({ reason: 'refused', message: '账号已退出或切换。' })
    if (!registration || redetect) { redetect = false; registration = await options.registration() }
    else {
      const was = registration.runtimes
      const runtimes = await refreshModels(was)
      if (registration.runtimes === was) registration = { ...registration, runtimes }
    }
    if (!swept) {
      swept = true
      void sweep()
    }
    const answer = await register()
    if (closed) return
    if (!answer.ok) {
      if (answer.code === 'runner_elsewhere') {
        const held = await api.readRunner()
        return finish({ reason: 'elsewhere', machine: (held.ok && held.value.runner?.machineName) || '?' })
      }
      if (answer.code === 'runner_outdated') return finish({ reason: 'outdated' })
      if (answer.code) return finish({ reason: 'refused', message: answer.error })
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
      const { watchMs } = deps()
      if (watchMs !== null) boards ??= watchBoards(registration.machineId, watchMs)
      // The registration skipped the slow model lists; the full look follows.
      void deps().runtimes()
    }
    await readJobs()
    if (!live?.joined()) boards?.pullAll()
    void reviewDue()
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
        if (typeof payload.board === 'string') {
          if (typeof payload.head_seq === 'number') boards?.hint(payload.board, payload.head_seq, payload.machine as string | undefined)
          return
        }
        if (payload.jobId || !(payload.alertId || payload.taskId)) void readJobs()
      },
      onReady: () => {
        void readJobs()
        boards?.pullAll()
      },
    })
  }

  /** The catch-up read. One at a time; a hint during a read reads once more after it. */
  const readJobs = async (): Promise<void> => {
    if (closed || preparing || !registration) return
    if (reading) {
      readAgain = true
      return
    }
    reading = true
    let readEnded = () => {}
    readDone = new Promise<void>((resolve) => (readEnded = resolve))
    try {
      const list = await api.listJobs(registration.machineId)
      if (!list.ok || closed) return
      const listed = new Set(list.value.jobs.map((job) => job.id))
      for (const id of attempted) if (!listed.has(id) && !running.has(id)) attempted.delete(id)
      for (const job of list.value.jobs) {
        if (closed || preparing) break
        // 本地运行停止后，由 Cloud 自动恢复重启遗留的任务一次。
        if ((job.state === 'claimed' || job.state === 'interrupted') && !running.has(job.id) && (!attempted.has(job.id) || !job.flow && !!(job.chat || job.discussion))) {
          const failure = await stopLeftOn(job)
          if (closed || preparing) break
          const checkpoint = readCheckpoint(job.id)
          const reply = !job.flow && !!(job.chat || job.discussion)
          const processesStopped = reply ? await stopReply(job.id, deps().stopMs) : false
          const uncertain = !!checkpoint && (checkpoint.updating || reply) && !checkpoint.completed
            && (checkpoint.pending.length > 0 || checkpoint.opaque || (!job.flow && checkpoint.started && !checkpoint.session))
          if (checkpoint?.updating) status(uncertain ? UNCERTAIN : '正在恢复更新前的任务…')
          const reason = failure ?? (checkpoint?.updating ? uncertain ? UNCERTAIN : UPDATE_REASON : 'The Runner restarted while this job was running.')
          const report = { ...(checkpoint?.session ? { session: checkpoint.session } : {}),
            ...(reply && checkpoint && reason === UNCERTAIN ? replySpent(checkpoint, job.runtime) : {}),
            ...(processesStopped ? { processesStopped: true } : {}) }
          const recovered = await api.finishJob(registration.machineId, job.id, 'failed', reason, report)
          if (checkpoint && reason === UNCERTAIN && recovered.ok && recovered.value.finished) {
            checkpoint.completed = { outcome: 'failed', reason, report }
            saveCheckpoint(job.id, checkpoint)
          }
          if (recovered.ok && (reason === UPDATE_REASON || processesStopped && recovered.value.finished)) readAgain = true
          continue
        }
        // Cloud lists only the jobs the plan's running limit lets start (#2209).
        if (job.state !== 'waiting' || running.has(job.id)) continue
        start(job.id)
      }
    } finally {
      reading = false
      readEnded()
      if (readAgain) {
        readAgain = false
        void readJobs()
      }
    }
  }

  /** The board runs a flow job left on its card when the Runner was force-quit under it (#2120). */
  const stopLeftOn = async (job: api.Job): Promise<string | undefined> => {
    if (!job.flow || !job.task) return
    try {
      const folder = job.projectDir ? folderFor(job) : null
      if (folder && 'refused' in folder) return folder.refused
      const ws = openTaskFolder(job, folder?.cwd ?? null)
      const card = akbCardOf(ws)
      if (card) await stopLeftBehind(deps().akb(), ws, card, deps().stopMs)
    } catch (e) {
      return e instanceof Error ? e.message : String(e)
    }
  }

  let reviewing = false
  const reviewDue = async () => {
    if (reviewing || closed || !registration) return
    reviewing = true
    try {
      await reviewChats(registration.machineId, registration.runtimes)
    } catch (e) {
      console.error(`runner: the chats were not reviewed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      reviewing = false
    }
  }

  const start = (id: string) => {
    // 失去租约后的作业先停止进程，再申请一次带新身份的恢复。
    attempted.add(id)
    running.set(id, null)
    status(idle())
    const job = runJob(id, deps(), (halt) => {
      running.set(id, halt)
      if (closed) void halt()
    }, () => closed)
      .catch(() => {})
      .finally(() => {
        jobs.delete(job)
        running.delete(id)
        if (closed) return
        boards?.look()
        status(idle())
        void readJobs()
      })
    jobs.add(job)
  }

  const close = async (release = true, updating = false) => {
    if (closed) return
    if (updating) {
      preparing = true
      await readDone
      // 先让云端保留作业，断网时不开始停机。
      for (const id of running.keys()) {
        const prepared = await api.finishJob(registration!.machineId, id, 'failed', PREPARE_REASON)
        if (!prepared.ok || !prepared.value.prepared && !prepared.value.finished) {
          preparing = false
          void readJobs()
          throw new Error('更新暂缓：未能保存云端任务，稍后重试。')
        }
      }
    }
    closed = true
    if (updating) {
      for (const id of running.keys()) {
        const checkpoint = readCheckpoint(id) ?? { pending: [] }
        saveCheckpoint(id, { ...checkpoint, updating: true })
      }
    }
    if (timer) clearTimeout(timer)
    if (agentsTimer) clearTimeout(agentsTimer)
    clearInterval(sweepTimer)
    live?.close()
    presence?.close()
    boards?.close()
    // Each job's own stop is bounded; this bounds them all, should one hang.
    const stops = Promise.all([readDone, ...jobs, ...[...running.values()].map((halt) => halt?.())])
    let timeout: ReturnType<typeof setTimeout> | undefined
    if (updating) await stops
    else await Promise.race([stops, new Promise((resolve) => (timeout = setTimeout(resolve, (options.deps?.stopMs ?? STOP_MS) + 1_000)))])
    clearTimeout(timeout)
    if (release && !lock.waited() && registration) await api.release(registration.machineId)
    clearInterval(accountWatch)
    lock.release()
    releaseRecord()
  }

  let refresh = ''
  const accountWatch = setInterval(() => {
    try {
      const value = fs.readFileSync(path.join(runnerHome(), 'settings-refresh'), 'utf8')
      if (value !== refresh) { refresh = value; redetect = true; if (!closed) schedule(0) }
    } catch {}
    if (!closed && !validAccount()) void finish({ reason: 'refused', message: '账号已退出或切换。' })
  }, 200)
  accountWatch.unref()

  removeLegacy()
  pruneChats()
  const lock = holdMachine(options.kind, () => { ownsExecution = true; void tick() }, (holder) => {
    status(t.waitingHere(holder))
    options.onWaiting?.(holder)
  })
  return { stopped, close: () => close(true), update: () => close(false, true), renew: () => { redetect = true; schedule(0) } }
}
