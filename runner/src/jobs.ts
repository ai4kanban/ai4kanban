// 领取作业、运行并回写；断网只能运行到租约到期，失效后停止本地执行。

import { cloudLanguage, cloudPrompt } from '../../cli/src/lib/agent/language'
import { authorizedFolder, progressEvidence, progressFolder, restartFolder } from './handoff'
import { markEnv, stopMark } from '../../cli/src/lib/agent/stop'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { contextLimit, refreshCatalog } from '../../cli/src/lib/agent/catalog'
import { akbEnv, type Akb } from './akb'
import { currentAkb } from './akb-version'
import type { RunEvent, TurnEnd } from '../../cli/src/lib/agent/wire'
import * as api from './api'
import type { AgentJob, Flow, Job, JobEvent, JobReport, RuntimeReport } from './api'
import { keepChat, keepCloudChat, keepDecisions, markReviewed, reviewMarks } from './chats'
import { confirmFlowStopped, runAgent, runFlow, runReview, writeTranscript } from './flow'
import { builtWorkflow } from './built'
import { hold } from './cache'
import { allowedProjects } from './folders'
import { goalsFileOf, readGoals, writeGoals } from './goals'
import { replySpent, checkpointEvent, clearCheckpoint, readCheckpoint, saveCheckpoint, stopReply, replyRetry, replayable, resumable, UNCERTAIN, type Checkpoint } from './recovery'
import { runnerHome } from './home'
import { followProxy } from './proxy'
import { detectRuntimes, forks, plan as realPlan, type Plan, type Settings } from './runtimes'
import { keepSecrets, secretsOf } from './secrets'
import { cardFile, openAgentFolder, openDiscussionFolder, openTaskFolder, pull, push, undrawnPreviews, type Pushed, type TaskFolder } from './task-folder'

/** Output goes every 2 seconds or 32 KB while a page watches and not at all while none does:
 *  the job's log object costs nothing until someone opens it (#228). */
const FLUSH_MS = 2_000
const FLUSH_CHARS = 32 * 1024
/** Cloud's caps: events per message, and the text one event keeps. */
const BATCH_EVENTS = 500
const BATCH_CHARS = 512 * 1024
const EVENT_CHARS = 64 * 1024
const END_MS = 10_000
const RECONNECT_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
/** Well inside the service's 15-minute lease. */
const RENEW_MS = 5 * 60_000
/** A silent socket gets no error until written to, and a page opening the log waits on it. */
const LOG_PING_MS = 30_000
/** cloud/src/config.ts's RUNNER_LEASE_SECONDS: a job not renewed for this long is no longer ours. */
const LEASE_MS = 15 * 60_000
/** How often a result waiting offline tries Cloud again. */
const RETRY_MS = 30_000
const KILL_GRACE_MS = 5_000
/** Board changes this close together go to Cloud as one write (#59). */
const WATCH_MS = 1_000
/** How long stopping a job's board runs may take before the Runner exits anyway. */
export const STOP_MS = 10_000
/** A connection test's limit; cloud/src/config.ts's RUNTIME_TEST_SECONDS matches it. */
export const TEST_MS = 30_000

interface Shared {
  authorize?: (job: Job) => Promise<boolean>
  machineId: string
  api: Pick<typeof api, 'claimJob' | 'renewJob' | 'openLog' | 'finishJob' | 'readTask' | 'readWorkflow' | 'listWorkflows' | 'readRejections' | 'markReviewed' | 'readAgents' | 'readChat' | 'readDecisions' | 'listChats'>
  plan: (runtime: Job['runtime'], prompt: string, cwd: string, resume?: string | null, model?: string | null, settings?: Settings, fork?: boolean, language?: 'zh' | 'en' | null) => Plan
  /** How often output goes while a page watches. */
  flushMs: number
  logPingMs: number
  /** How long the end waits for the log to be stored before finishing anyway. */
  endMs: number
  testMs: number
  renewMs: number
  leaseMs: number
  retryMs: number
  replyBackoff?: (attempt: number) => number
  stopMs: number
  /** How long a board change waits for the next before it goes; null watches no board. */
  watchMs: number | null
  runtimes: () => Promise<RuntimeReport[]>
}

export interface Deps extends Shared {
  /** The akb a new step starts on. */
  akb: () => Akb
}

/** One step's, its akb chosen once: a release mid-step reaches the next one (#171). */
interface StepDeps extends Shared {
  akb: Akb
}

export const defaultDeps = (machineId: string): Deps => ({
  machineId,
  api,
  plan: realPlan,
  flushMs: FLUSH_MS,
  logPingMs: LOG_PING_MS,
  endMs: END_MS,
  renewMs: RENEW_MS,
  leaseMs: LEASE_MS,
  retryMs: RETRY_MS,
  testMs: TEST_MS,
  stopMs: STOP_MS,
  watchMs: WATCH_MS,
  akb: currentAkb,
  runtimes: detectRuntimes,
})

export const ownFolder = () => path.join(runnerHome(), 'work')

/** Where a job runs, or why it may not. A named folder must be inside one the user allowed;
 *  links and `..` are resolved first, so neither can step outside it. */
export function folderFor(job: Pick<Job, 'id' | 'projectDir'>): { cwd: string } | { refused: string } {
  if (!job.projectDir) {
    const cwd = path.join(ownFolder(), job.id)
    fs.mkdirSync(cwd, { recursive: true })
    return { cwd }
  }
  const real = realpath(job.projectDir)
  if (real && allowedProjects().some((root) => real === root || real.startsWith(root + path.sep))) return { cwd: real }
  return { refused: `This Runner is not allowed to work in ${job.projectDir}.` }
}

function realpath(p: string): string | null {
  try {
    return fs.realpathSync(p)
  } catch {
    return null
  }
}

const attachmentsOf = (job: Pick<Job, 'id'>) => path.join(runnerHome(), 'attachments', job.id)

/** The attachments, written beside the Runner's files, and the lines that tell the agent. They
 *  go once the job ends. */
function writeAttachments(job: Job): string {
  if (!job.attachments.length) return ''
  const dir = attachmentsOf(job)
  fs.mkdirSync(dir, { recursive: true })
  const files = job.attachments.map((a) => {
    const file = path.join(dir, path.basename(a.name))
    fs.writeFileSync(file, Buffer.from(a.content, 'base64'))
    return file
  })
  return `\n\nAttached files:\n${files.map((f) => `- ${f}`).join('\n')}`
}

const cut = (text: string) => (text.length > EVENT_CHARS ? text.slice(0, EVENT_CHARS) : text)

/** Events as Cloud keeps them: neighbouring log text joined, long text cut, one `seq` each. */
export function toWire(events: RunEvent[], first: number): JobEvent[] {
  const out: JobEvent[] = []
  let log = ''
  const endLog = () => {
    for (let at = 0; at < log.length; at += EVENT_CHARS) out.push({ seq: first + out.length, kind: 'log', text: log.slice(at, at + EVENT_CHARS) })
    log = ''
  }
  for (const e of events) {
    if (e.kind === 'log') {
      if (e.data.text.startsWith('[chat-recovery] ')) {
        endLog()
        out.push({ seq: first + out.length, kind: 'log', text: e.data.text })
        continue
      }
      log += e.data.text
      continue
    }
    endLog()
    const data: Record<string, unknown> = { ...e.data }
    for (const key of ['text', 'result'] as const) if (typeof data[key] === 'string') data[key] = cut(data[key] as string)
    out.push({ seq: first + out.length, kind: e.kind, text: '', data })
  }
  endLog()
  return out
}

/** When the lease was last renewed: the job is Cloud's again `leaseMs` after. */
interface Lease {
  at: number
  monotonic: number
  lost?: boolean
}

const leaseNow = (): Lease => ({ at: Date.now(), monotonic: performance.now() })

/** Output sent back over the job's log stream while a page watches, and the lease kept; a lost
 *  lease stops what it adopted and what it was told to stop. Every event stays here, so a page
 *  or a new connection gets what the log does not have yet. Cloud asking to stop, over the log
 *  or on a renewal, stops what it adopted too, the job still ours to finish. */
function streamOut(deps: Shared, id: string, lease: Lease) {
  const wire: JobEvent[] = []
  let firstSeq: number | null = null
  let pending: RunEvent[] = []
  let size = 0
  let lost = false
  let ending = false
  let closed = false
  let flushedAt = Date.now()
  const log = { ws: null as WebSocket | null, after: null as number | null, watched: false, heard: 0, tries: 0, retry: undefined as ReturnType<typeof setTimeout> | undefined }
  let ended = () => {}
  const stored = new Promise<void>((resolve) => (ended = resolve))
  const children = new Set<ChildProcess>()
  const groups = new Set<number>()
  let stopConfirmed = true
  const killed = new Set<Promise<void>>()
  const kill = (child: ChildProcess) => {
    if (!child.pid) return
    const exited = new Promise<void>((resolve) => child.once('close', () => resolve()))
    killed.add(exited)
    void exited.then(() => killed.delete(exited))
    signalTree(child, 'SIGTERM')
    const timer = setTimeout(() => signalTree(child, 'SIGKILL'), KILL_GRACE_MS)
    timer.unref()
    void exited.then(() => clearTimeout(timer))
  }
  let halt: (() => Promise<void>) | null = null
  let stopping = Promise.resolve()
  const messages: string[] = []
  let asked = false
  let onAsked = () => {}
  const askedOnce = new Promise<void>((resolve) => (onAsked = resolve))
  const ask = () => {
    if (asked || lost) return
    asked = true
    for (const child of children) kill(child)
    if (halt) stopping = halt().catch(() => { stopConfirmed = false })
    onAsked()
  }
  const loseLease = () => {
    if (lost) return stopping
    lost = true
    lease.lost = true
    for (const child of children) kill(child)
    stopping = Promise.all([halt?.(), ...killed]).then(() => {}).catch(() => { stopConfirmed = false })
    return stopping
  }
  const valid = () => {
    if (!held(deps, lease)) void loseLease()
    return !lost
  }

  /** What the log does not have yet, then the end once asked for. */
  const send = () => {
    if (!valid()) return
    const ws = log.ws
    if (!ws || ws.readyState !== WebSocket.OPEN || log.after === null) return
    const after = log.after
    const unsent = log.watched ? wire.filter((e) => e.seq > after) : []
    let batch: JobEvent[] = []
    let chars = 0
    const out = () => {
      if (batch.length) ws.send(JSON.stringify({ type: 'events', events: batch }))
      batch = []
      chars = 0
    }
    for (const e of unsent) {
      const n = JSON.stringify(e).length
      if (batch.length === BATCH_EVENTS || chars + n > BATCH_CHARS) out()
      batch.push(e)
      chars += n
    }
    out()
    if (unsent.length) log.after = unsent[unsent.length - 1]!.seq
    if (ending) ws.send(JSON.stringify({ type: 'end' }))
  }
  const flush = () => {
    flushedAt = Date.now()
    if (firstSeq !== null && pending.length) {
      wire.push(...toWire(pending, firstSeq + wire.length))
      pending = []
    }
    size = 0
    send()
  }
  const connect = async () => {
    log.retry = undefined
    const ws = await deps.api.openLog(deps.machineId, id).catch(() => null)
    if (closed || !valid()) return ws?.close()
    if (!ws) return reconnect()
    log.ws = ws
    log.heard = Date.now()
    ws.addEventListener('message', (m) => {
      log.heard = Date.now()
      let said: { type?: string; after?: number; watched?: boolean; on?: boolean }
      try {
        said = JSON.parse(String(m.data))
      } catch {
        return
      }
      if (said.type === 'hello') {
        log.tries = 0
        log.after = Number.isInteger(said.after) ? said.after! : -1
        firstSeq ??= log.after + 1
        log.watched = said.watched === true
        flush()
      } else if (said.type === 'watched') {
        log.watched = said.on === true
        if (log.watched) flush()
      } else if (said.type === 'ended') ended()
      else if (said.type === 'stop') ask()
    })
    ws.addEventListener('close', () => drop(ws))
    ws.addEventListener('error', () => {})
  }
  const drop = (ws: WebSocket) => {
    if (log.ws !== ws) return
    log.ws = null
    log.after = null
    reconnect()
  }
  const reconnect = () => {
    if (log.retry || lost || closed) return
    log.retry = setTimeout(() => void connect(), RECONNECT_MS[Math.min(log.tries++, RECONNECT_MS.length - 1)])
  }
  void connect()

  const event = (e: RunEvent) => {
    if (!valid()) return
    if (e.kind === 'message') messages.push(e.data.text)
    pending.push(e)
    size += JSON.stringify(e.data).length
    if (log.watched && size >= FLUSH_CHARS) flush()
  }
  const flusher = setInterval(() => {
    if (log.watched && pending.length && Date.now() - flushedAt >= deps.flushMs) flush()
  }, Math.min(deps.flushMs, 1_000))
  const pinger = setInterval(() => {
    const ws = log.ws
    if (ws?.readyState !== WebSocket.OPEN) return
    if (Date.now() - log.heard <= deps.logPingMs * 2) return ws.send('ping')
    drop(ws)
    ws.close()
  }, deps.logPingMs)
  // 不依赖网络响应；休眠唤醒后的回调也必须先检查截止时间。
  const expiry = setInterval(valid, Math.min(1_000, deps.leaseMs))
  let renewing = false
  const renewer = setInterval(async () => {
    if (renewing || !valid()) return
    renewing = true
    const requestedAt = leaseNow()
    const renewed = await deps.api.renewJob(deps.machineId, id).catch(() => null).finally(() => { renewing = false })
    if (!valid() || closed || !renewed) return
    if (renewed.ok && !renewed.value.renewed) return void loseLease()
    if (!renewed.ok) return
    Object.assign(lease, requestedAt)
    if (renewed.value.stop) ask()
    // A run quiet for a while is still running: its log must not end itself.
    if (!ending && log.ws?.readyState === WebSocket.OPEN) log.ws.send(JSON.stringify({ type: 'alive' }))
  }, deps.renewMs)
  return {
    event,
    out: (text: string) => {
      if (text) event({ kind: 'log', data: { text } })
    },
    adopt: (child: ChildProcess) => {
      if (child.pid) groups.add(child.pid)
      if (!valid() || asked) return kill(child)
      children.add(child)
      child.on('close', () => children.delete(child))
    },
    onStop: (stop: () => Promise<void>) => {
      halt = stop
      if (lost || asked) stopping = stop().catch(() => { stopConfirmed = false })
    },
    /** What stopping the job's board runs is still doing. */
    halted: () => stopping,
    confirmed: async () => {
      await stopping
      if (!stopConfirmed) return false
      const until = Date.now() + deps.stopMs
      const alive = (pid: number) => {
        try { process.kill(-pid, 0); return true } catch (e) { return (e as NodeJS.ErrnoException).code !== 'ESRCH' }
      }
      if (process.platform === 'win32') return children.size === 0
      while ([...groups].some(alive)) {
        if (Date.now() >= until) return false
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      return true
    },
    stop: loseLease,
    lost: () => !valid(),
    asked: () => asked,
    whenAsked: askedOnce,
    /** The agent's messages so far. */
    said: () => messages.join('\n\n'),
    /** The rest sent and the log stored, or given up on after a while: `finish` comes after. */
    end: async () => {
      if (closed) return
      clearInterval(flusher)
      clearInterval(pinger)
      clearInterval(renewer)
      clearInterval(expiry)
      ending = !lost
      flush()
      if (ending) {
        let timer: ReturnType<typeof setTimeout> | undefined
        await Promise.race([stored, new Promise<void>((resolve) => (timer = setTimeout(resolve, deps.endMs)))])
        clearTimeout(timer)
      }
      closed = true
      clearTimeout(log.retry)
      const ws = log.ws
      log.ws = null
      ws?.close()
      await stopping
    },
  }
}

/** Claim and run one job. Resolves once it has ended, or at once when it was not ours to run.
 *  `track` receives what stops it; a stopped job is left for Cloud to hand out again. */
export async function runJob(id: string, deps: Deps, track: (stop: () => Promise<void>) => void = () => {}, stopped = () => false): Promise<void> {
  followProxy()
  const lease = leaseNow()
  const claim = await deps.api.claimJob(deps.machineId, id)
  if (!claim.ok || !claim.value.claimed || stopped() || !held(deps, lease)) return
  const job = claim.value.job
  if (deps.authorize && !await deps.authorize(job)) {
    await deps.api.finishJob(deps.machineId, id, 'failed', '项目目录授权已撤销或暂时无法验证，请重新确认后重试。')
    return
  }
  const releases: (() => void)[] = []
  try {
    await runClaimed(job, { ...deps, akb: deps.akb() }, track, (dir) => releases.push(hold(dir)), lease)
  } finally {
    for (const release of releases) release()
    fs.rmSync(attachmentsOf(job), { recursive: true, force: true })
  }
}

/** `keep` keeps a project folder out of the cache's cleanup until the job ends. */
async function runClaimed(job: Job, deps: StepDeps, track: (stop: () => Promise<void>) => void, keep: (dir: string) => void, lease: Lease, replyStream?: ReturnType<typeof streamOut>): Promise<void> {
  const id = job.id
  const local = readCheckpoint(id)
  const previous = local ?? (job.recoveryOf ? readCheckpoint(job.recoveryOf) : null)
  const checkpoint: Checkpoint = previous ?? { pending: [], started: false, effects: false }
  const reply = !!(job.chat || job.discussion) && !job.flow
  const spent = (): JobReport | undefined => reply && checkpoint.attempts?.length && !(job.recoveryOf && !local && checkpoint.completed)
    ? { session: checkpoint.session, ...replySpent(checkpoint, job.runtime) } : undefined
  const finishClaimed = (outcome: Outcome, reason = '', said?: JobReport) => {
    const before = spent()
    const report = before ? { ...before, ...said } : said
    if (before && outcome === 'failed') {
      checkpoint.completed = { outcome, reason, report: report! }
      saveCheckpoint(id, checkpoint)
    }
    return finish(deps, id, lease, outcome, reason, report)
  }
  const replay = (job.manualRecovery === true && !!previous && replayable(previous))
    || (job.retryReplay === true && (!local || replayable(local)))
    || (!!previous?.retry?.at && replayable(previous))
  if (reply && job.recoveryOf && !previous && !replay) {
    return finishClaimed('failed', 'recovery_unsafe')
  }
  if (job.manualRecovery && (!previous && !replay || previous && !replayable(previous) && (previous.effects === undefined || previous.pending.length || previous.opaque || !previous.session))) {
    return finishClaimed('failed', 'recovery_unsafe')
  }
  if (job.manualRecovery && !local) checkpoint.retry = undefined
  if (reply) checkpoint.retry ??= { since: Date.now(), attempt: 1 }
  const recovering = checkpoint.updating === true || !!job.recoveryOf
  const persist = () => {
    checkpoint.updating ||= readCheckpoint(id)?.updating
    saveCheckpoint(id, checkpoint)
  }
  const manual = job.manualRecovery === true
  if (manual && !local && checkpoint.completed?.outcome === 'failed') {
    delete checkpoint.completed
    delete checkpoint.attempts
  }
  checkpoint.session ??= job.resume ?? undefined
  if (recovering && !checkpoint.completed && (checkpoint.pending.length || checkpoint.opaque || (!job.flow && checkpoint.started && !checkpoint.session && !replay))) {
    saveCheckpoint(id, checkpoint)
    return finishClaimed('failed', job.recoveryOf ? 'recovery_failed' : UNCERTAIN)
  }
  if (reply && previous?.started && checkpoint.completed?.outcome !== 'done' && !await stopReply(readCheckpoint(id) ? id : job.recoveryOf ?? id, deps.stopMs)) {
    return finishClaimed('failed', 'recovery_unsafe')
  }
  if (reply && recovering && !replyStream && previous?.started && !checkpoint.completed
      && !checkpoint.retry?.at && !(manual && !local)) {
    if (checkpoint.retry!.attempt >= 3 || Date.now() > checkpoint.retry!.since + 120_000) {
      return finishClaimed('failed', 'recovery_failed', {
        recovery: { safe: replayable(checkpoint), stopped: true, resumable: resumable(checkpoint) },
      })
    }
    checkpoint.retry!.attempt++
    persist()
  }
  if (recovering && checkpoint.session && !replay) job = { ...job, resume: checkpoint.session, fork: false }
  if (replay) {
    job = { ...job, resume: null, fork: false }
    checkpoint.session = undefined
  }
  if (!recovering) persist()
  if (job.handoff?.kind === 'execution') {
    if (recovering) job = { ...job, handoff: { ...job.handoff, recovering: true } }
    const handoff = job.handoff!

    const runtime = (await deps.runtimes()).find((r) => r.name === job.runtime)
    if (!runtime?.installed || runtime.loggedIn === false) return finishClaimed('failed', '目标运行工具已不可用，请安装并登录后重试。')
    const folder = authorizedFolder(job.projectDir)
    if (!folder) return finishClaimed('failed', '目标目录授权已变化。')
    if (handoff.action === 'runtime') job = { ...job, projectDir: folder, resume: null, fork: false }
    if (handoff.action === 'continue') {
      const progress = progressFolder(job, folder)
      if (!progress || !handoff.recovering && (!handoff.evidence || progressEvidence({ ...job, flow: job.flow ? { ...job.flow, verb: handoff.verb ?? job.flow.verb } : job.flow }, progress) !== handoff.evidence)) {
        return finishClaimed('failed', '本地进度已变化，请重新检查。')
      }
      job = { ...job, projectDir: progress }
    }
    if (handoff.action === 'restart') {
      try { job = { ...job, projectDir: restartFolder(job, folder), resume: null, fork: false } }
      catch { return finishClaimed('failed', '无法准备新隔离目录，已有文件已保留。') }
    }
  }
  if (job.secret) return runSecret(job, deps)
  if (job.test) return runTest(job, deps, lease)
  if (job.agent) return runAgentJob(job as Job & { agent: AgentJob }, deps, track, keep, lease, checkpoint, persist)

  // A task without a project folder here runs in its project's own folder; a review in its first task's.
  const task = job.task ?? job.review?.tasks[0] ?? null
  const folder = task && !job.projectDir ? null : folderFor(job)
  if (folder && 'refused' in folder) {
    return finishClaimed('failed', folder.refused)
  }

  let ws: TaskFolder | null = null
  let cwd = folder?.cwd ?? ''
  let run: Plan | null = null
  let fresh: (() => Plan) | null = null
  let missingSessionOnly = false
  let goalFile: string | null = null
  let discussed: string | undefined
  try {
    if (task) {
      ws = openTaskFolder({ ...job, task }, folder?.cwd ?? null)
      cwd = ws.cwd
      keep(cwd)
      // A flow job, and a review, pulls once its board is there.
      if (!job.flow && !job.review) {
        const pulled = await pull(ws, deps.machineId)
        if (!pulled.ok) throw new Error(pulled.error)
      }
    }
    if (checkpoint.completed) {
      const done = checkpoint.completed
      if (done.outcome === 'failed' || !ws) return finishClaimed(done.outcome, done.reason, done.report)
      return sendBack(deps, id, lease, ws, done.report, () => keepChat(job, done.report.reply))
    }
    if (job.flow && !ws) throw new Error('This job names no task.')
    // A discussion on a project folder here reads its board as Cloud has it now (#2110).
    if (job.discussion && job.projectDir && folder) {
      const board = openDiscussionFolder(job, folder.cwd)
      keep(board.cwd)
      const pulled = await pull(board, deps.machineId)
      if (!pulled.ok) throw new Error(pulled.error)
      discussed = board.board
    }
    if (job.discussion) {
      const wrote = recovering && fs.existsSync(goalsFileOf(job)) ? { file: goalsFileOf(job) } : await writeGoals({ ...job, discussion: job.discussion }, deps.api.listWorkflows)
      if ('error' in wrote) throw new Error(wrote.error)
      goalFile = wrote.file
    }
    if (!job.flow && !job.review) {
      // Behind the reply: until it lands, the catalogue on disk names the window.
      void refreshCatalog()
      const head = folderLines(ws) + writeAttachments(job)
      const file = writeTranscript(job, attachmentsOf(job))
      const transcript = file ? `\n\nThis task came out of a discussion. Read it for what the card leaves out: ${file}` : ''
      const promptOf = (said: string) => {
        const lines = (head + said).trim()
        const prompt = recovering && !replay && (checkpoint.started || job.recoveryOf)
          ? '连接恢复后继续之前中断的回复。先核对已有进度和结果，保留完成的工作，不要重复已经执行的操作。'
          : cloudPrompt(job)
        return lines ? `${lines}\n\n---\n\n${prompt}` : prompt
      }
      const planned = (resume: string | null | undefined, fork: boolean, said = '') => {
        let p = deps.plan(job.runtime, promptOf(said), cwd, resume, job.model, settingsOf(job), fork, cloudLanguage(job))
        // A task's chat changes its card with the akb the Runner carries, on the task's board.
        if (ws) p = { ...p, env: akbEnv(deps.akb, ws.board, ws.task, cloudLanguage(job), p.env) }
        if (goalFile) p = { ...p, env: { ...akbEnv(deps.akb, discussed, undefined, cloudLanguage(job), p.env), KANBAN_GOALS: goalFile, KANBAN_IDEAS: goalFile } }
        // A reply waits out a passing failure on the agent's own retries (#88).
        if (job.chat || job.discussion) {
          const { CLAUDE_CODE_MAX_RETRIES: _, ...env } = p.env
          p = { ...p, env }
        }
        return p
      }
      // A discussion task's session (#2146), else a new one reading the discussion.
      const carried = !!job.resume && (!job.fork || forks(job.runtime))
      run = carried ? planned(job.resume, !!job.fork) : planned(null, false, transcript)
      if (!carried) job = { ...job, resume: null, fork: false }
      if (!recovering && carried && transcript) fresh = () => planned(null, false, transcript)
      if (!recovering && carried && (job.chat || job.discussion)) {
        fresh = () => planned(null, false, transcript)
        missingSessionOnly = true
      }
    }
  } catch (e) {
    return finishClaimed('failed', e instanceof Error ? e.message : String(e))
  }

  if (deps.authorize && !await deps.authorize(job)) return finishClaimed('failed', '项目目录授权已变化，请重新确认后重试。')
  if (!held(deps, lease)) return
  if (reply && recovering) {
    const renewed = await deps.api.renewJob(deps.machineId, id)
    if (!renewed.ok || !renewed.value.renewed) return
    if (renewed.value.stop) return finishClaimed('stopped', '', { stopped: true })
  }
  const stream = replyStream ?? streamOut(deps, id, lease)
  if (run?.startNote) stream.out(`${run.startNote}\n`)
  let attempt: NonNullable<Checkpoint['attempts']>[number] | undefined
  const beginAttempt = () => {
    if (!reply) return
    attempt = { resume: job.resume }
    checkpoint.attempts ??= []
    checkpoint.attempts.push(attempt)
    persist()
  }
  const measure = (said: JobReport): JobReport => {
    if (!attempt || stream.lost()) return said
    Object.assign(attempt, { session: said.session, usage: said.usage, costUsd: said.costUsd })
    persist()
    const { usage: _usage, costUsd: _cost, ...rest } = said
    return { ...rest, ...replySpent(checkpoint, job.runtime) }
  }
  let replyProgress = false
  const remember = (event: RunEvent) => {
    if (['message', 'tool_call', 'tool_call_update'].includes(event.kind)) replyProgress = true
    if (stream.lost()) return
    checkpointEvent(checkpoint, event)
    const session = run?.session()
    if (session) checkpoint.session = session
    if (attempt && !run?.converse) measure(report(job, run!))
    persist()
    stream.event(event)
  }
  const retry = async (reason: string | undefined): Promise<boolean> => {
    if (!reply || !reason || stream.asked() || stream.lost()) return false
    const safe = replayable(checkpoint)
    if (checkpoint.pending.length || checkpoint.opaque || !safe && (!checkpoint.session || sessionMissing(reason))) return false
    const at = replyRetry(checkpoint, reason, Date.now(), deps.replyBackoff)
    if (at === null) return false
    if (!await stopReply(id, deps.stopMs) || !await stream.confirmed()) return false
    checkpoint.retry!.at = at
    persist()
    stream.event({ kind: 'log', data: { text: '[chat-recovery] waiting' } })
    await Promise.race([wait(Math.max(0, at - Date.now())), stream.whenAsked])
    if (stream.asked() || stream.lost()) return false
    if (Date.now() > checkpoint.retry!.since + 120_000) return false
    if (deps.authorize && !await deps.authorize(job)) return false
    const requestedAt = leaseNow()
    const renewed = await deps.api.renewJob(deps.machineId, id)
    if (!renewed.ok || !renewed.value.renewed || renewed.value.stop || stream.asked() || stream.lost()) return false
    Object.assign(lease, requestedAt)
    checkpoint.retry!.attempt++
    delete checkpoint.retry!.at
    checkpoint.updating = true
    persist()
    stream.event({ kind: 'log', data: { text: '[chat-recovery] running' } })
    await runClaimed({ ...job, manualRecovery: false, retryReplay: safe }, deps, track, keep, lease, stream)
    await stream.end()
    return true
  }
  const complete = (outcome: 'done' | 'failed', report: JobReport, reason?: string) => {
    if (stream.lost()) return
    checkpoint.completed = { outcome, report, reason }
    checkpoint.session = report.session ?? checkpoint.session
    persist()
  }
  let savedGoals: JobReport['goals']
  const told = (said: JobReport): JobReport => {
    if (goalFile) savedGoals ??= readGoals(goalFile)
    return savedGoals ? { ...said, ...(job.discussion?.goals !== undefined ? { goals: savedGoals } : { ideas: savedGoals }) } : said
  }
  track(stream.stop)

  if (reply && checkpoint.retry?.at) {
    stream.event({ kind: 'log', data: { text: '[chat-recovery] waiting' } })
    await Promise.race([wait(Math.max(0, checkpoint.retry.at - Date.now())), stream.whenAsked])
    if (stream.asked() || stream.lost() || Date.now() > checkpoint.retry.since + 120_000) {
      await stream.end()
      if (stream.lost()) return
      return finishClaimed(stream.asked() ? 'stopped' : 'failed', stream.asked() ? '' : 'recovery_failed')
    }
    checkpoint.retry.attempt++
    delete checkpoint.retry.at
    persist()
    stream.event({ kind: 'log', data: { text: '[chat-recovery] running' } })
  }
  const io = { show: stream.out, event: remember, track: stream.adopt, onStop: stream.onStop, lost: stream.lost }
  if (job.review) {
    checkpoint.started = true
    persist()
    // What is reviewed is what was said by now; a later message waits for the next review.
    for (const task of job.review.tasks) {
      const chat = await deps.api.readChat(task)
      if (chat.ok) keepCloudChat(task, chat.value.messages)
      await keepDecisions(task, deps.api.readDecisions)
    }
    const listed = await deps.api.listChats(deps.machineId)
    if (!listed.ok) {
      await stream.end()
      return finishClaimed('failed', listed.error)
    }
    // A task Cloud no longer lists has moved on since the review was asked for.
    const tasks = listed.value.chats.filter((c) => job.review!.tasks.includes(c.task))
    const marks = reviewMarks(tasks)
    const refs = tasks.map((c) => `${c.task}:${c.number}`)
    const ended = refs.length ? await runReview(job, ws!, refs, deps, io) : { ok: true as const, report: {} }
    if (ended.ok) complete('done', ended.report)
    await stream.end()
    if (stream.lost()) return
    if (!ended.ok) return finishClaimed('failed', ended.reason)
    return sendBack(deps, id, lease, ws!, ended.report, () => markReviewed(marks))
  }
  if (!run) {
    checkpoint.started = true
    persist()
    const ended = await runFlow(job as Job & { flow: Flow }, ws!, deps, io)
    if (ended.ok) complete('done', ended.report)
    // Stopped by the user (#2128), or its delivery cancelled (#59): kept here for a resume.
    const stopped = !ended.ok && (stream.asked() || ended.stopped === true)
    if (stopped && stream.asked()) await stream.halted()
    await stream.end()
    if (stream.lost()) return
    const boardStopped = await confirmFlowStopped(ws!, job, deps)
    const evidence = job.handoff?.action === 'continue' || job.handoff?.action === 'restart' ? progressEvidence(job, ws!.cwd) : null
    const proof = boardStopped && await stream.confirmed() ? { processesStopped: true, ...(evidence ? { evidence } : {}) } : {}
    if (ended.ok) complete('done', { ...ended.report, ...proof })
    if (stopped) return finishClaimed('stopped', '', proof)
    if (!ended.ok) return finishClaimed('failed', ended.reason, proof)
    return sendBack(deps, id, lease, ws!, { ...ended.report, ...proof }, () => keepChat(job, ended.report.reply))
  }

  checkpoint.mark = stopMark()
  checkpoint.started = true
  checkpoint.opaque = !run.converse && !run.renderer?.events
  checkpoint.session = run.session() ?? checkpoint.session
  persist()
  if (run.converse) {
    beginAttempt()
    const plan = run
    const converse = run.converse
    const child = spawn(plan.command, plan.args, { cwd, env: markEnv(plan.env, checkpoint.mark!), detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] })
    if (child.pid) { checkpoint.process = { pid: child.pid, since: Date.now() }; persist() }
    stream.adopt(child)
    child.stdin.on('error', () => {})
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => stream.out(quietLines(plan, chunk)))
    const spawned = new Promise<string>((resolve) => child.on('error', (e) => resolve(e.message)))
    const end = await Promise.race([
      converse(child, remember, false),
      spawned.then((error): TurnEnd => ({ ok: false, error })),
      // Killed, the turn ends with what it said so far; one that never does is not waited on.
      stream.whenAsked.then(() => wait(KILL_GRACE_MS * 2)).then((): TurnEnd => ({ ok: true })),
    ])
    const measured = measure(report(job, plan, end))
    if (!end.ok && !recovering && job.resume && (job.chat || job.discussion) && sessionMissing(end.error ?? '') && !replyProgress && !checkpoint.pending.length && (checkpoint.retry?.attempt ?? 1) < 3 && Date.now() <= (checkpoint.retry?.since ?? Date.now()) + 120_000 && !stream.asked() && !stream.lost()) {
      stop(child)
      if (!await stopReply(id, deps.stopMs) || !await stream.confirmed()) {
        await stream.end()
        return finishClaimed('failed', 'recovery_failed')
      }
      checkpoint.session = undefined
      checkpoint.started = false
      if (checkpoint.retry) checkpoint.retry.attempt++
      persist()
      await runClaimed({ ...job, resume: null, fork: false, sessionFallback: true }, deps, track, keep, lease, stream)
      await stream.end()
      return
    }
    if (!end.ok && sessionMissing(end.error ?? '') && !replayable(checkpoint)) {
      checkpoint.session = undefined
      persist()
    }
    if (await retry(end.ok ? undefined : end.error)) return
    const stopped = await stopReply(id, deps.stopMs)

    stop(child)
    const ok = end.ok || stream.asked()
    const unsafe = reply && !ok && (!stopped || !replayable(checkpoint) && !resumable(checkpoint))
    const said = {
      ...told(stream.asked() ? cutShort(measured, stream.said()) : measured),
      ...(reply ? { recovery: { safe: replayable(checkpoint), stopped, resumable: resumable(checkpoint) } } : {}),
    }
    if (!stream.asked()) complete(ok ? 'done' : 'failed', said, unsafe ? 'recovery_unsafe' : end.ok ? undefined : end.error)
    await stream.end()
    if (stream.lost()) return
    if (!ok || !ws) return finishClaimed(ok ? 'done' : 'failed', ok ? '' : unsafe ? 'recovery_unsafe' : replyReason(end.ok ? undefined : end.error, job), said)
    return sendBack(deps, id, lease, ws, said, () => keepChat(job, said.reply))
  }
  const printed = async (plan: Plan) => {
    const child = spawn(plan.command, plan.args, { cwd, env: markEnv(plan.env, checkpoint.mark!), detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] })
    if (child.pid) { checkpoint.process = { pid: child.pid, since: Date.now() }; persist() }
    stream.adopt(child)
    child.stdin.on('error', () => {})
    const renderer = plan.renderer!
    if (plan.stdin) child.stdin.write(plan.stdin)
    else child.stdin.end()
    child.stdout.setEncoding('utf8')
    const structured = !!renderer.events
    let stderr = ''
    let acted = false
    const fromAgent = (text: string) => {
      if (!structured) {
        if (text.trim()) acted = true
        stream.out(text)
      }
      if (attempt) measure(report(job, plan))
      for (const e of renderer.events?.() ?? []) {
        if (e.kind === 'message' || e.kind === 'tool_call' || e.kind === 'tool_call_update') acted = true
        remember(e)
      }
    }
    child.stdout.on('data', (chunk: string) => {
      fromAgent(renderer.push(chunk))
      // A runtime reading turns from stdin keeps going until stdin closes.
      if (plan.stdin && renderer.result() !== undefined && !child.stdin.writableEnded) child.stdin.end()
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-EVENT_CHARS)
      stream.out(quietLines(plan, chunk))
    })
    const ended = await new Promise<{ code: number | null; error?: string }>((resolve) => {
      child.on('error', (e) => resolve({ code: null, error: e.message }))
      child.on('close', (code) => resolve({ code }))
    })
    fromAgent(renderer.flush())
    return { ...ended, stderr, acted }
  }
  let plan = run
  beginAttempt()
  let ended = await printed(plan)
  let measured = measure(report(job, plan))
  // A carried session that is not here, or not copied, leaves a new one reading the discussion.
  if (fresh && ended.code !== 0 && plan.renderer!.result() === undefined && !ended.acted
      && (!missingSessionOnly || sessionMissing(`${ended.stderr}\n${plan.renderer!.failure?.() ?? ''}`))
      && (checkpoint.retry?.attempt ?? 1) < 3 && Date.now() <= (checkpoint.retry?.since ?? Date.now()) + 120_000
      && !checkpoint.pending.length && !checkpoint.effects && !stream.asked() && !stream.lost()
      && await stopReply(id, deps.stopMs) && await stream.confirmed()) {
    if (checkpoint.retry) checkpoint.retry.attempt++
    checkpoint.session = undefined
    persist()
    plan = fresh()
    job = { ...job, resume: null, fork: false, sessionFallback: missingSessionOnly }
    run = plan
    beginAttempt()
    ended = await printed(plan)
    measured = measure(report(job, plan))
  }
  const renderer = plan.renderer!
  const rawFailure = ended.error ?? renderer.failure?.() ?? (ended.code === 0 ? undefined : `Exited with code ${ended.code}.`)
  if (sessionMissing(rawFailure ?? '') && !replayable(checkpoint)) {
    checkpoint.session = undefined
    persist()
  }
  if (await retry(rawFailure)) return
  const stopped = await stopReply(id, deps.stopMs)
  const unsafe = reply && !!rawFailure && (!stopped || !replayable(checkpoint) && !resumable(checkpoint))
  const failure = stream.asked() ? undefined : unsafe ? 'recovery_unsafe' : replyReason(ended.error ?? renderer.failure?.() ?? (ended.code === 0 ? undefined : `Exited with code ${ended.code}.`), job)
  const said = {
    ...told(stream.asked() ? cutShort(measured, stream.said()) : measured),
    ...(reply ? { recovery: { safe: replayable(checkpoint), stopped, resumable: resumable(checkpoint) } } : {}),
  }
  if (!stream.asked()) complete(failure ? 'failed' : 'done', said, failure)
  await stream.end()
  if (stream.lost()) return
  if (failure || !ws) return finishClaimed(failure ? 'failed' : 'done', failure, said)
  return sendBack(deps, id, lease, ws, said, () => keepChat(job, said.reply))
}

/** A periodic agent, on the project's folder here; a job for a project with none here fails. */
async function runAgentJob(job: Job & { agent: AgentJob }, deps: StepDeps, track: (stop: () => Promise<void>) => void, keep: (dir: string) => void, lease: Lease, checkpoint: Checkpoint, persist: () => void): Promise<void> {
  const folder = job.projectDir ? folderFor(job) : { refused: 'This project has no folder on this computer.' }
  let ws: TaskFolder
  try {
    if ('refused' in folder) throw new Error(folder.refused)
    ws = openAgentFolder(job, folder.cwd)
    keep(ws.cwd)
  } catch (e) {
    await deps.api.finishJob(deps.machineId, job.id, 'failed', e instanceof Error ? e.message : String(e))
    return
  }
  if (!held(deps, lease)) return
  if (checkpoint.completed) return sendBack(deps, job.id, lease, ws, checkpoint.completed.report, () => {})
  checkpoint.started = true
  persist()
  const stream = streamOut(deps, job.id, lease)
  track(stream.stop)
  const ended = await runAgent(job, ws, deps, { show: stream.out, event: (event) => {
    if (stream.lost()) return
    checkpointEvent(checkpoint, event)
    persist()
    stream.event(event)
  }, track: stream.adopt, onStop: stream.onStop, lost: stream.lost })
  if (ended.ok && !stream.lost()) {
    checkpoint.completed = { outcome: 'done', report: ended.report }
    persist()
  }
  await stream.end()
  if (stream.lost()) return
  if (!ended.ok) return finish(deps, job.id, lease, 'failed', ended.reason)
  return sendBack(deps, job.id, lease, ws, ended.report)
}

const quietLines = (plan: Plan, chunk: string) =>
  chunk.split('\n').filter((line) => line && !plan.quiet(line)).map((line) => `${line}\n`).join('')

const replyReason = (reason: string | undefined, job: Job) => {
  if (!reason) return reason
  if (job.recoveryOf && !job.manualRecovery) return 'recovery_failed'
  if (job.sessionFallback && !/auth|login|log.in|permission|directory|ENOENT|not installed|rate.limit|network|connect|登录|权限|目录/i.test(reason)) return 'session_unavailable'
  return reason
}

const sessionMissing = (text: string) =>
  !/auth|unauthorized|forbidden|login|log.in|登录|权限/i.test(text) && (
  /\b(?:session|conversation|thread)\b[^\n]*(?:\bnot found\b|\bdoes not exist\b)/i.test(text)
  || /\bno (?:conversation|session|thread) found\b/i.test(text))

function signalTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return
  if (process.platform === 'win32') {
    const kill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    kill.on('error', () => child.kill(signal))
    return
  }
  try { process.kill(-child.pid, signal) } catch { child.kill(signal) }
}

/** A child that never spawned has no pid: killing it would signal this whole process group. */
const stop = (child: ChildProcess) => {
  if (!child.pid) return
  signalTree(child, 'SIGTERM')
  const timer = setTimeout(() => signalTree(child, 'SIGKILL'), KILL_GRACE_MS)
  timer.unref()
  child.once('close', () => clearTimeout(timer))
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const held = (deps: Shared, lease: Lease) => {
  // 墙上时钟覆盖休眠，单调时钟防止系统时间回拨延长租约。
  if (Math.max(Date.now() - lease.at, performance.now() - lease.monotonic) >= deps.leaseMs) lease.lost = true
  return !lease.lost
}

/** Cloud unreached, try again while the lease holds, renewing it once Cloud answers. Past the
 *  lease Cloud refuses the result and runs the task's step again; this one is dropped. */
async function whileOffline<T extends object>(deps: Shared, id: string, lease: Lease, attempt: () => Promise<T>): Promise<T | null> {
  while (held(deps, lease)) {
    const out = await attempt()
    if (!('offline' in out && out.offline) || !held(deps, lease)) return out
    await wait(deps.retryMs)
    if (!held(deps, lease)) return null
    const requestedAt = leaseNow()
    const renewed = await deps.api.renewJob(deps.machineId, id)
    if (!held(deps, lease)) return null
    if (renewed.ok && renewed.value.renewed) Object.assign(lease, requestedAt)
    if (renewed.ok && !renewed.value.renewed) return out
  }
  return null
}

type Outcome = 'done' | 'failed' | 'conflict' | 'stopped'

/** Whether Cloud took the ending. */
async function ended(deps: Shared, id: string, lease: Lease, outcome: Outcome, reason = '', report?: JobReport): Promise<boolean> {
  const sent = await whileOffline(deps, id, lease, async () => {
    const done = await deps.api.finishJob(deps.machineId, id, outcome, reason, report)
    return { offline: !done.ok && !done.code, finished: done.ok && done.value.finished }
  })
  if (sent?.finished && (outcome !== 'failed' || !report?.recovery)) clearCheckpoint(id)
  return sent?.finished ?? false
}

async function finish(deps: Shared, id: string, lease: Lease, outcome: Outcome, reason = '', report?: JobReport): Promise<void> {
  await ended(deps, id, lease, outcome, reason, report)
}

/** What the job changed goes back, then how it ended; `landed` once both were taken. */
async function sendBack(deps: StepDeps, id: string, lease: Lease, ws: TaskFolder, said: JobReport, landed = () => {}): Promise<void> {
  const built = await builtWorkflow(ws, deps.akb)
  if (built && !built.ok) return finish(deps, id, lease, 'failed', built.reason, said)
  const report = built ? { ...said, workflow: { files: built.files } } : said
  const pushed = await whileOffline<Pushed>(deps, id, lease, () => push(ws, { id, machineId: deps.machineId }))
  if (!pushed) return
  if (pushed.ok) {
    if (await ended(deps, id, lease, 'done', '', report)) landed()
    return
  }
  if (pushed.offline) return
  await finish(deps, id, lease, pushed.conflict ? 'conflict' : 'failed', pushed.error, report)
}

/** The runtime's settings and the keys this computer holds for it. */
export const settingsOf = (job: Job): Settings => ({ settings: job.settings, secrets: secretsOf(job.runtimeId) })

/** A runtime's keys (#2135), kept here and nowhere else; Cloud hears only that it is done. */
async function runSecret(job: Job, deps: Shared): Promise<void> {
  if (!job.runtimeId || !job.secrets) return void (await deps.api.finishJob(deps.machineId, job.id, 'failed', 'This job carries no keys.'))
  try {
    keepSecrets(job.runtimeId, job.secrets)
  } catch (e) {
    return void (await deps.api.finishJob(deps.machineId, job.id, 'failed', e instanceof Error ? e.message : String(e)))
  }
  await deps.api.finishJob(deps.machineId, job.id, 'done', '')
}

/** A connection test (#2074): the prompt alone, on the job's connector and model, reported as
 *  `not_installed`, `signed_out` or `timeout`, the connector's own words, or done with how long it took. */
async function runTest(job: Job, deps: Shared, lease: Lease): Promise<void> {
  const finish = async (outcome: 'done' | 'failed', reason: string, ms?: number) => {
    if (!await ended(deps, job.id, lease, outcome, reason, ms === undefined ? undefined : { ms })) {
      console.error(`runner: connection test ${job.id}: Cloud did not accept the result.`)
    }
  }
  const report = (await deps.runtimes()).find((r) => r.name === job.runtime)
  if (!report?.installed) return finish('failed', 'not_installed')
  if (report.loggedIn === false) return finish('failed', 'signed_out')
  const cwd = path.join(ownFolder(), 'test')
  fs.mkdirSync(cwd, { recursive: true })
  const run = deps.plan(job.runtime, job.prompt, cwd, null, job.model, settingsOf(job))
  const startedAt = Date.now()
  if (run.converse) {
    const child = spawn(run.command, run.args, { cwd, env: run.env, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'ignore'] })
    child.stdin.on('error', () => {})
    let timer: NodeJS.Timeout | undefined
    const end = await Promise.race([
      run.converse(child, () => {}),
      new Promise<'timeout'>((resolve) => (timer = setTimeout(() => resolve('timeout'), deps.testMs))),
      new Promise<NodeJS.ErrnoException>((resolve) => child.on('error', resolve)),
    ])
    clearTimeout(timer)
    stop(child)
    const ms = Date.now() - startedAt
    if (end === 'timeout') return finish('failed', 'timeout', ms)
    if (end instanceof Error) return end.code === 'ENOENT' ? finish('failed', 'not_installed') : finish('failed', end.message.slice(0, 300), ms)
    return end.ok ? finish('done', '', ms) : finish('failed', (end.error || 'The connector stopped.').slice(0, 300), ms)
  }
  const renderer = run.renderer!
  const exited = await new Promise<{ code: number | null; error?: NodeJS.ErrnoException; timedOut?: boolean; said: string }>((resolve) => {
    let said = ''
    const child = spawn(run.command, run.args, { cwd, env: run.env, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS).unref()
      resolve({ code: null, timedOut: true, said })
    }, deps.testMs)
    child.stdin.on('error', () => {})
    if (run.stdin) child.stdin.write(run.stdin)
    else child.stdin.end()
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      renderer.push(chunk)
      if (run.stdin && renderer.result() !== undefined && !child.stdin.writableEnded) child.stdin.end()
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      said += chunk.split('\n').filter((line) => line && !run.quiet(line)).map((line) => `${line}\n`).join('')
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({ code: null, error, said })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, said })
    })
  })
  const ms = Date.now() - startedAt
  if (exited.timedOut) return finish('failed', 'timeout', ms)
  if (exited.error?.code === 'ENOENT') return finish('failed', 'not_installed')
  renderer.flush()
  const failure = exited.error?.message ?? renderer.failure?.() ?? (exited.code === 0 ? undefined : exited.said.trim().split('\n').at(-1) || `Exited with code ${exited.code}.`)
  if (failure) return finish('failed', failure.slice(0, 300), ms)
  return finish('done', '', ms)
}

function report(job: Job, run: Plan, turn?: TurnEnd): JobReport {
  const context = turn ? turn.context : run.renderer?.context?.()
  const limit = context?.limit ?? contextLimit(job.runtime, run.model?.() ?? job.model ?? undefined)
  const usage = turn ? turn.usage : run.renderer?.usage?.()
  const costUsd = turn ? turn.costUsd : run.renderer?.costUsd?.()
  return {
    reply: turn ? turn.result : run.renderer?.result(),
    session: run.session(),
    ...(usage ? { usage } : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
    ...(context?.used !== undefined && limit ? { context: { used: context.used, limit } } : {}),
  }
}

/** A reply stopped part way: what the agent said by then. */
const cutShort = (said: JobReport, text: string): JobReport => ({ ...said, reply: said.reply || text || undefined, stopped: true })

/** Where the task's card, workflow and memory are, for the agent. */
function folderLines(ws: TaskFolder | null): string {
  if (!ws) return ''
  const undrawn = undrawnPreviews(ws)
  return `\n\nTask card: ${cardFile(ws)}\nMemory: ${ws.board}/memory` + (undrawn.length ? `\nPreviews that cannot be drawn:\n${undrawn.map(l => `- ${l}`).join('\n')}` : '')
}
