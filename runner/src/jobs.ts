// Running one job: claim it, check its folder, run the runtime there, stream the output
// back, and report how it ended. A lost lease, or the Runner stopping, stops the local process
// and the board runs a flow started. A task's job runs in
// the task's folder, brought up to Cloud first and sent back after (#2037). A flow job runs a
// board verb with akb instead of a prompt (#2020). Offline, a job runs on and its result waits
// until Cloud is reached again, while its lease still holds (#2081). A periodic agent's job
// runs on its project's board for no task (#2068). A chat's reply asked to stop ends there, and
// what it said so far is its reply (#2133).

import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { akbEnv, bundledAkb, type Akb } from './akb'
import type { RunEvent, TurnEnd } from '../../cli/src/lib/agent/wire'
import * as api from './api'
import type { AgentJob, Flow, Job, JobEvent, JobReport, RuntimeReport } from './api'
import { keepChat, keepCloudChat, markReviewed, reviewMarks, withChats } from './chats'
import { runAgent, runFlow, runReview, writeTranscript } from './flow'
import { builtWorkflow } from './built'
import { hold } from './cache'
import { allowedProjects } from './folders'
import { readIdeas, writeIdeas } from './ideas'
import { runnerHome } from './home'
import { detectRuntimes, forks, plan as realPlan, type Plan, type Settings } from './runtimes'
import { keepSecrets, secretsOf } from './secrets'
import { cardFile, openAgentFolder, openDiscussionFolder, openTaskFolder, pull, push, workflowFile, type Pushed, type TaskFolder } from './task-folder'

/** Output goes every 2 seconds while a page watches, every 15 or each 32 KB while none does,
 *  so the job's log object sleeps between batches (#2085). */
const WATCHED_MS = 2_000
const QUIET_MS = 15_000
const FLUSH_CHARS = 32 * 1024
/** Cloud's caps: events per message, and the text one event keeps. */
const BATCH_EVENTS = 500
const BATCH_CHARS = 512 * 1024
const EVENT_CHARS = 64 * 1024
const END_MS = 10_000
const RECONNECT_MS = [1_000, 2_000, 5_000, 10_000, 30_000]
/** Well inside the service's 15-minute lease. */
const RENEW_MS = 5 * 60_000
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

export interface Deps {
  machineId: string
  api: Pick<typeof api, 'claimJob' | 'renewJob' | 'openLog' | 'finishJob' | 'readTask' | 'readWorkflow' | 'listWorkflows' | 'readRejections' | 'markReviewed' | 'readChat'>
  plan: (runtime: Job['runtime'], prompt: string, cwd: string, resume?: string | null, model?: string | null, settings?: Settings, fork?: boolean) => Plan
  /** How often output goes while a page watches, and while none does. */
  flushMs: { watched: number; quiet: number }
  /** How long the end waits for the log to be stored before finishing anyway. */
  endMs: number
  testMs: number
  renewMs: number
  leaseMs: number
  retryMs: number
  stopMs: number
  /** How long a board change waits for the next before it goes; null watches no board. */
  watchMs: number | null
  akb: Akb
  runtimes: () => Promise<RuntimeReport[]>
}

export const defaultDeps = (machineId: string): Deps => ({
  machineId,
  api,
  plan: realPlan,
  flushMs: { watched: WATCHED_MS, quiet: QUIET_MS },
  endMs: END_MS,
  renewMs: RENEW_MS,
  leaseMs: LEASE_MS,
  retryMs: RETRY_MS,
  testMs: TEST_MS,
  stopMs: STOP_MS,
  watchMs: WATCH_MS,
  akb: bundledAkb(),
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
}

/** Output sent back over the job's log stream, and the lease kept; a lost lease stops what it
 *  adopted and what it was told to stop. Every event stays here, so a new connection sends what
 *  the log does not have yet. Cloud asking to stop, over the log or on a renewal, stops what it
 *  adopted too, the job still ours to finish. */
function streamOut(deps: Deps, id: string, lease: Lease) {
  const wire: JobEvent[] = []
  let pending: RunEvent[] = []
  let size = 0
  let lost = false
  let ending = false
  let closed = false
  let flushedAt = Date.now()
  const log = { ws: null as WebSocket | null, after: null as number | null, watched: false, tries: 0, retry: undefined as ReturnType<typeof setTimeout> | undefined }
  let ended = () => {}
  const stored = new Promise<void>((resolve) => (ended = resolve))
  const children = new Set<ChildProcess>()
  const kill = (child: ChildProcess) => {
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS).unref()
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
    if (halt) stopping = halt()
    onAsked()
  }
  const loseLease = () => {
    if (lost) return stopping
    lost = true
    for (const child of children) kill(child)
    if (halt) stopping = halt()
    return stopping
  }

  /** What the log does not have yet, then the end once asked for. */
  const send = () => {
    const ws = log.ws
    if (!ws || ws.readyState !== WebSocket.OPEN || log.after === null) return
    const after = log.after
    const unsent = wire.filter((e) => e.seq > after)
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
    if (pending.length) wire.push(...toWire(pending, wire.length))
    pending = []
    size = 0
    send()
  }
  const connect = async () => {
    log.retry = undefined
    const ws = await deps.api.openLog(deps.machineId, id).catch(() => null)
    if (closed) return ws?.close()
    if (!ws) return reconnect()
    log.ws = ws
    ws.addEventListener('message', (m) => {
      let said: { type?: string; after?: number; watched?: boolean; on?: boolean }
      try {
        said = JSON.parse(String(m.data))
      } catch {
        return
      }
      if (said.type === 'hello') {
        log.tries = 0
        log.after = Number.isInteger(said.after) ? said.after! : -1
        log.watched = said.watched === true
        send()
      } else if (said.type === 'watched') {
        log.watched = said.on === true
        if (log.watched) flush()
      } else if (said.type === 'ended') ended()
      else if (said.type === 'stop') ask()
    })
    ws.addEventListener('close', () => {
      if (log.ws !== ws) return
      log.ws = null
      log.after = null
      reconnect()
    })
    ws.addEventListener('error', () => {})
  }
  const reconnect = () => {
    if (log.retry || lost || closed) return
    log.retry = setTimeout(() => void connect(), RECONNECT_MS[Math.min(log.tries++, RECONNECT_MS.length - 1)])
  }
  void connect()

  const event = (e: RunEvent) => {
    if (e.kind === 'message') messages.push(e.data.text)
    pending.push(e)
    size += JSON.stringify(e.data).length
    if (size >= FLUSH_CHARS) flush()
  }
  const tick = Math.min(deps.flushMs.watched, 1_000)
  const flusher = setInterval(() => {
    if (pending.length && Date.now() - flushedAt >= (log.watched ? deps.flushMs.watched : deps.flushMs.quiet)) flush()
  }, tick)
  const renewer = setInterval(async () => {
    const renewed = await deps.api.renewJob(deps.machineId, id)
    if (renewed.ok && !renewed.value.renewed) return void loseLease()
    if (!renewed.ok) return
    lease.at = Date.now()
    if (renewed.value.stop) ask()
    // A run quiet for a while is still running: its log must not end itself.
    if (log.ws?.readyState === WebSocket.OPEN) log.ws.send(JSON.stringify({ type: 'alive' }))
  }, deps.renewMs)
  return {
    event,
    out: (text: string) => {
      if (text) event({ kind: 'log', data: { text } })
    },
    adopt: (child: ChildProcess) => {
      if (lost || asked) return kill(child)
      children.add(child)
      child.on('close', () => children.delete(child))
    },
    onStop: (stop: () => Promise<void>) => {
      halt = stop
      if (lost || asked) stopping = stop()
    },
    /** What stopping the job's board runs is still doing. */
    halted: () => stopping,
    stop: loseLease,
    lost: () => lost,
    asked: () => asked,
    whenAsked: askedOnce,
    /** The agent's messages so far. */
    said: () => messages.join('\n\n'),
    /** The rest sent and the log stored, or given up on after a while: `finish` comes after. */
    end: async () => {
      clearInterval(flusher)
      clearInterval(renewer)
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
    },
  }
}

/** Claim and run one job. Resolves once it has ended, or at once when it was not ours to run.
 *  `track` receives what stops it; a stopped job is left for Cloud to hand out again. */
export async function runJob(id: string, deps: Deps, track: (stop: () => Promise<void>) => void = () => {}): Promise<void> {
  const claim = await deps.api.claimJob(deps.machineId, id)
  if (!claim.ok || !claim.value.claimed) return
  const job = claim.value.job
  const held: (() => void)[] = []
  try {
    await runClaimed(job, deps, track, (dir) => held.push(hold(dir)))
  } finally {
    for (const release of held) release()
    fs.rmSync(attachmentsOf(job), { recursive: true, force: true })
  }
}

/** `keep` keeps a project folder out of the cache's cleanup until the job ends. */
async function runClaimed(job: Job, deps: Deps, track: (stop: () => Promise<void>) => void, keep: (dir: string) => void): Promise<void> {
  const id = job.id
  if (job.secret) return runSecret(job, deps)
  if (job.test) return runTest(job, deps)
  if (job.agent) return runAgentJob(job as Job & { agent: AgentJob }, deps, track, keep)

  // A task without a project folder here runs in its project's own folder; a review in its first task's.
  const task = job.task ?? job.review?.tasks[0] ?? null
  const folder = task && !job.projectDir ? null : folderFor(job)
  if (folder && 'refused' in folder) {
    await deps.api.finishJob(deps.machineId, id, 'failed', folder.refused)
    return
  }

  let ws: TaskFolder | null = null
  let cwd = folder?.cwd ?? ''
  let run: Plan | null = null
  let fresh: (() => Plan) | null = null
  let ideas: string | null = null
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
      const wrote = await writeIdeas({ ...job, discussion: job.discussion }, deps.api.listWorkflows)
      if ('error' in wrote) throw new Error(wrote.error)
      ideas = wrote.file
    }
    if (!job.flow && !job.review) {
      const head = folderLines(ws) + writeAttachments(job)
      const file = writeTranscript(job, attachmentsOf(job))
      const transcript = file ? `\n\nThis task came out of a discussion. Read it for what the card leaves out: ${file}` : ''
      // The Runner's lines go first, so Cloud's prompt, and its language line, stays last.
      const promptOf = (said: string) => {
        const lines = (head + said).trim()
        return lines ? `${lines}\n\n---\n\n${job.prompt}` : job.prompt
      }
      const planned = (resume: string | null | undefined, fork: boolean, said = '') => {
        let p = deps.plan(job.runtime, promptOf(said), cwd, resume, job.model, settingsOf(job), fork)
        // A task's chat changes its card with the akb the Runner carries, on the task's board.
        if (ws) p = { ...p, env: { ...p.env, ...akbEnv(deps.akb, ws.board, ws.task, job.languageLine ?? '') } }
        if (ideas) p = { ...p, env: { ...p.env, ...akbEnv(deps.akb, discussed, undefined, job.languageLine ?? ''), KANBAN_IDEAS: ideas } }
        return p
      }
      // A discussion task's session (#2146), else a new one reading the discussion.
      const carried = !!job.resume && (!job.fork || forks(job.runtime))
      run = carried ? planned(job.resume, !!job.fork) : planned(null, false, transcript)
      if (carried && transcript) fresh = () => planned(null, false, transcript)
    }
  } catch (e) {
    await deps.api.finishJob(deps.machineId, id, 'failed', e instanceof Error ? e.message : String(e))
    return
  }

  const lease: Lease = { at: Date.now() }
  const stream = streamOut(deps, id, lease)
  const told = (said: JobReport): JobReport => (ideas ? { ...said, ideas: readIdeas(ideas) } : said)
  track(stream.stop)

  const io = { show: stream.out, event: stream.event, track: stream.adopt, onStop: stream.onStop, lost: stream.lost }
  if (job.review) {
    // What is reviewed is what was said by now; a later message waits for the next review.
    for (const task of job.review.tasks) {
      const chat = await deps.api.readChat(task)
      if (chat.ok) keepCloudChat(task, chat.value.messages)
    }
    const tasks = withChats(job.review.tasks)
    const marks = reviewMarks(tasks)
    const ended = tasks.length ? await runReview(job, ws!, tasks, deps, io) : { ok: true as const, report: {} }
    await stream.end()
    if (stream.lost()) return
    if (!ended.ok) return finish(deps, id, lease, 'failed', ended.reason)
    return sendBack(deps, id, lease, ws!, ended.report, () => markReviewed(marks))
  }
  if (!run) {
    const ended = await runFlow(job as Job & { flow: Flow }, ws!, deps, io)
    // Stopped by the user (#2128), or its delivery cancelled (#59): kept here for a resume.
    const stopped = !ended.ok && (stream.asked() || ended.stopped === true)
    if (stopped && stream.asked()) await stream.halted()
    await stream.end()
    if (stream.lost()) return
    if (stopped) return finish(deps, id, lease, 'stopped')
    if (!ended.ok) return finish(deps, id, lease, 'failed', ended.reason)
    return sendBack(deps, id, lease, ws!, ended.report, () => keepChat(job, ended.report.reply))
  }

  if (run.converse) {
    const plan = run
    const converse = run.converse
    const child = spawn(plan.command, plan.args, { cwd, env: plan.env, stdio: ['pipe', 'pipe', 'pipe'] })
    stream.adopt(child)
    child.stdin.on('error', () => {})
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => stream.out(quietLines(plan, chunk)))
    const spawned = new Promise<string>((resolve) => child.on('error', (e) => resolve(e.message)))
    const end = await Promise.race([
      converse(child, stream.event),
      spawned.then((error): TurnEnd => ({ ok: false, error })),
      // Killed, the turn ends with what it said so far; one that never does is not waited on.
      stream.whenAsked.then(() => wait(KILL_GRACE_MS * 2)).then((): TurnEnd => ({ ok: true })),
    ])
    stop(child)
    await stream.end()
    if (stream.lost()) return
    const ok = end.ok || stream.asked()
    const said = told(stream.asked() ? cutShort(report(plan, end), stream.said()) : report(plan, end))
    if (!ok || !ws) return finish(deps, id, lease, ok ? 'done' : 'failed', ok ? '' : end.error ?? '', said)
    return sendBack(deps, id, lease, ws, said, () => keepChat(job, said.reply))
  }
  const printed = async (plan: Plan) => {
    const child = spawn(plan.command, plan.args, { cwd, env: plan.env, stdio: ['pipe', 'pipe', 'pipe'] })
    stream.adopt(child)
    child.stdin.on('error', () => {})
    const renderer = plan.renderer!
    if (plan.stdin) child.stdin.write(plan.stdin)
    else child.stdin.end()
    child.stdout.setEncoding('utf8')
    const structured = !!renderer.events
    const fromAgent = (text: string) => {
      if (!structured) stream.out(text)
      for (const e of renderer.events?.() ?? []) stream.event(e)
    }
    child.stdout.on('data', (chunk: string) => {
      fromAgent(renderer.push(chunk))
      // A runtime reading turns from stdin keeps going until stdin closes.
      if (plan.stdin && renderer.result() !== undefined && !child.stdin.writableEnded) child.stdin.end()
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => stream.out(quietLines(plan, chunk)))
    const ended = await new Promise<{ code: number | null; error?: string }>((resolve) => {
      child.on('error', (e) => resolve({ code: null, error: e.message }))
      child.on('close', (code) => resolve({ code }))
    })
    fromAgent(renderer.flush())
    return ended
  }
  let plan = run
  let ended = await printed(plan)
  // A carried session that is not here, or not copied, leaves a new one reading the discussion.
  if (fresh && ended.code !== 0 && plan.renderer!.result() === undefined && !stream.asked() && !stream.lost()) {
    plan = fresh()
    ended = await printed(plan)
  }
  const renderer = plan.renderer!
  await stream.end()
  if (stream.lost()) return

  const failure = stream.asked() ? undefined : ended.error ?? renderer.failure?.() ?? (ended.code === 0 ? undefined : `Exited with code ${ended.code}.`)
  const said = told(stream.asked() ? cutShort(report(plan), stream.said()) : report(plan))
  if (failure || !ws) return finish(deps, id, lease, failure ? 'failed' : 'done', failure, said)
  return sendBack(deps, id, lease, ws, said, () => keepChat(job, said.reply))
}

/** A periodic agent, on the project's folder here; a job for a project with none here fails. */
async function runAgentJob(job: Job & { agent: AgentJob }, deps: Deps, track: (stop: () => Promise<void>) => void, keep: (dir: string) => void): Promise<void> {
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
  const lease: Lease = { at: Date.now() }
  const stream = streamOut(deps, job.id, lease)
  track(stream.stop)
  const ended = await runAgent(job, ws, deps, { show: stream.out, event: stream.event, track: stream.adopt, onStop: stream.onStop, lost: stream.lost })
  await stream.end()
  if (stream.lost()) return
  if (!ended.ok) return finish(deps, job.id, lease, 'failed', ended.reason)
  return sendBack(deps, job.id, lease, ws, ended.report)
}

const quietLines = (plan: Plan, chunk: string) =>
  chunk.split('\n').filter((line) => line && !plan.quiet(line)).map((line) => `${line}\n`).join('')

const stop = (child: ChildProcess) => {
  child.kill('SIGTERM')
  setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS).unref()
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const held = (deps: Deps, lease: Lease) => Date.now() - lease.at < deps.leaseMs

/** Cloud unreached, try again while the lease holds, renewing it once Cloud answers. Past the
 *  lease Cloud refuses the result and runs the task's step again; this one is dropped. */
async function whileOffline<T extends object>(deps: Deps, id: string, lease: Lease, attempt: () => Promise<T>): Promise<T> {
  for (;;) {
    const out = await attempt()
    if (!('offline' in out && out.offline) || !held(deps, lease)) return out
    await wait(deps.retryMs)
    const renewed = await deps.api.renewJob(deps.machineId, id)
    if (renewed.ok && renewed.value.renewed) lease.at = Date.now()
    if (renewed.ok && !renewed.value.renewed) return out
  }
}

type Outcome = 'done' | 'failed' | 'conflict' | 'stopped'

/** Whether Cloud took the ending. */
async function ended(deps: Deps, id: string, lease: Lease, outcome: Outcome, reason = '', report?: JobReport): Promise<boolean> {
  const sent = await whileOffline(deps, id, lease, async () => {
    const done = await deps.api.finishJob(deps.machineId, id, outcome, reason, report)
    return { offline: !done.ok && !done.code, finished: done.ok && done.value.finished }
  })
  return sent.finished
}

async function finish(deps: Deps, id: string, lease: Lease, outcome: Outcome, reason = '', report?: JobReport): Promise<void> {
  await ended(deps, id, lease, outcome, reason, report)
}

/** What the job changed goes back, then how it ended; `landed` once both were taken. */
async function sendBack(deps: Deps, id: string, lease: Lease, ws: TaskFolder, said: JobReport, landed = () => {}): Promise<void> {
  const built = await builtWorkflow(ws, deps.akb)
  if (built && !built.ok) return finish(deps, id, lease, 'failed', built.reason, said)
  const report = built ? { ...said, workflow: { files: built.files } } : said
  const pushed = await whileOffline<Pushed>(deps, id, lease, () => push(ws, { id, machineId: deps.machineId }))
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
async function runSecret(job: Job, deps: Deps): Promise<void> {
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
async function runTest(job: Job, deps: Deps): Promise<void> {
  const finish = async (outcome: 'done' | 'failed', reason: string, ms?: number) => {
    await deps.api.finishJob(deps.machineId, job.id, outcome, reason, ms === undefined ? undefined : { ms })
  }
  const report = (await deps.runtimes()).find((r) => r.name === job.runtime)
  if (!report?.installed) return finish('failed', 'not_installed')
  if (report.loggedIn === false) return finish('failed', 'signed_out')
  const cwd = path.join(ownFolder(), 'test')
  fs.mkdirSync(cwd, { recursive: true })
  const run = deps.plan(job.runtime, job.prompt, cwd, null, job.model, settingsOf(job))
  const startedAt = Date.now()
  if (run.converse) {
    const child = spawn(run.command, run.args, { cwd, env: run.env, stdio: ['pipe', 'pipe', 'ignore'] })
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
  const ended = await new Promise<{ code: number | null; error?: NodeJS.ErrnoException; timedOut?: boolean; said: string }>((resolve) => {
    let said = ''
    const child = spawn(run.command, run.args, { cwd, env: run.env, stdio: ['pipe', 'pipe', 'pipe'] })
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
  if (ended.timedOut) return finish('failed', 'timeout', ms)
  if (ended.error?.code === 'ENOENT') return finish('failed', 'not_installed')
  renderer.flush()
  const failure = ended.error?.message ?? renderer.failure?.() ?? (ended.code === 0 ? undefined : ended.said.trim().split('\n').at(-1) || `Exited with code ${ended.code}.`)
  if (failure) return finish('failed', failure.slice(0, 300), ms)
  return finish('done', '', ms)
}

function report(run: Plan, turn?: TurnEnd): JobReport {
  const context = turn ? turn.context : run.renderer?.context?.()
  const usage = turn ? turn.usage : run.renderer?.usage?.()
  const costUsd = turn ? turn.costUsd : run.renderer?.costUsd?.()
  return {
    reply: turn ? turn.result : run.renderer?.result(),
    session: run.session(),
    ...(usage ? { usage } : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
    ...(context?.used !== undefined && context.limit ? { context: { used: context.used, limit: context.limit } } : {}),
  }
}

/** A reply stopped part way: what the agent said by then. */
const cutShort = (said: JobReport, text: string): JobReport => ({ ...said, reply: said.reply || text || undefined, stopped: true })

/** Where the task's card, workflow and memory are, for the agent. */
function folderLines(ws: TaskFolder | null): string {
  if (!ws) return ''
  const workflow = workflowFile(ws)
  return `\n\nTask card: ${cardFile(ws)}${workflow ? `\nWorkflow: ${workflow}` : ''}\nMemory: ${ws.board}/memory`
}
