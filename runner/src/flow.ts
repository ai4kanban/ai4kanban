// A flow job (#2020): one board verb, run with the akb the Runner carries on the task's board
// and followed to its end — for `implement`, until the delivery has landed. A periodic agent's
// job (#2068) runs its own command the same way, on the project's board.

import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { parseFrontmatter } from '../../cli/src/lib/frontmatter'
import { asEvent, type RunEvent } from '../../cli/src/lib/agent/wire'
import { openOf, parseQuestion } from '../../cli/src/lib/view/rules'
import type * as api from './api'
import type { AgentJob, Flow, Job, JobReport, RuntimeReport } from './api'
import { answerOf, runAkb, type Akb, type Ran } from './akb'
import { quoteArg } from '../../cli/src/lib/agent/argv'
import { RAW_ARGS_KEY } from '../../cli/src/lib/agent/harnesses/types'
import { LABELS, providerKey, providerOf, secretKeys, settingKeys } from './runtimes'
import { secretsOf } from './secrets'
import { SKILL_FOLDERS, akbCardOf, cardAssetsDir, cardFile, findCard, mcpServersOf, pull, push, resetSorted, workspaceOf, type McpServers, type TaskFolder } from './task-folder'
import { workflowName } from '../../cloud/src/board-files.ts'
import { clearLaid, layOut } from './triage'
import { draftLine, isBuilder, placeDraft } from './built'

/** Why the runtime a job names cannot run here; null when it can. */
export function unavailable(wanted: Job['runtime'], reports: RuntimeReport[]): string | null {
  const report = reports.find((r) => r.name === wanted)
  if (!report?.installed) return `${LABELS[wanted]} is not installed on this computer.`
  if (report.loggedIn === false) return `${LABELS[wanted]} is not signed in on this computer.`
  return null
}

export interface FlowDeps {
  machineId: string
  akb: Akb
  runtimes: () => Promise<RuntimeReport[]>
  api: Pick<typeof api, 'readTask' | 'readWorkflow' | 'readRejections' | 'markReviewed'>
  /** How long stopping the job's board runs may take. */
  stopMs: number
}

export interface FlowIo {
  show: (text: string) => void
  event: (event: RunEvent) => void
  track: (child: ChildProcess) => void
  /** What stopping the job does beyond its own processes: the board runs it started. */
  onStop: (stop: () => Promise<void>) => void
  lost: () => boolean
}

export type FlowEnd = { ok: true; report: JobReport } | { ok: false; reason: string }

interface Run {
  sessionId: string
  result?: string
  startedAt?: number
  usage?: api.Usage
  costUsd?: number
}

/** What the runs this job started spent, summed; each part left out when none reported it. */
export function spentBy(runs: Run[]): Pick<JobReport, 'usage' | 'costUsd'> {
  const used = runs.filter((r) => r.usage)
  const costed = runs.filter((r) => typeof r.costUsd === 'number')
  const sum = (key: keyof api.Usage) => used.reduce((n, r) => n + (r.usage![key] || 0), 0)
  return {
    ...(used.length ? { usage: { input: sum('input'), cacheCreation: sum('cacheCreation'), cacheRead: sum('cacheRead'), output: sum('output') } } : {}),
    ...(costed.length ? { costUsd: costed.reduce((n, r) => n + r.costUsd!, 0) } : {}),
  }
}

/** What `raw setup-done` ticks, so no flow stops at "finish setup first". */
const SETUP_STEPS = ['project', 'agent', 'decisions', 'modules', 'tasks']

/** The card's first open `[user]` question with choices, as a review asks it. */
export function reviewOf(file: string): JobReport['review'] {
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return undefined
  }
  const questions = parseFrontmatter(text).meta?.questions ?? []
  for (const [i, q] of questions.entries()) {
    const { tag, text: question } = parseQuestion(q.text)
    if (tag === 'user' && openOf([q]).length && q.options?.length) {
      return { question, options: q.options.slice(0, 8), position: i + 1 }
    }
  }
  return undefined
}

/** The servers as a `--mcp-config` file, or null when there are none. */
export function mcpConfig(servers: McpServers, file: string): string | null {
  if (!Object.keys(servers).length) return null
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`)
  return file
}

/** The runtime's arguments that give this run, and no other, the workflow's MCP servers (#2030):
 *  Claude Code reads them from a file, Codex as config overrides. A CLI that talks takes the file
 *  as its `mcpConfig` setting instead; Kimi Code and ZCode take none. */
export function mcpArgs(runtime: Job['runtime'], servers: McpServers, file: string): string {
  const named = Object.entries(servers)
  if (!named.length || (runtime !== 'claude-code' && runtime !== 'codex')) return ''
  if (runtime === 'claude-code') return `--mcp-config ${quoteArg(mcpConfig(servers, file)!)}`
  return named
    .flatMap(([name, s]) => [
      `-c 'mcp_servers.${name}.command=${JSON.stringify(s.command)}'`,
      ...(s.args?.length ? [`-c 'mcp_servers.${name}.args=${JSON.stringify(s.args)}'`] : []),
    ])
    .join(' ')
}

const MCP_KEY = 'mcpConfig'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Stop the runs on card `id` started since `since` (0: all of them), until none is left or `ms`
 *  passed. A delivery can start its next run between two reads, so it reads again. `run stop`
 *  pauses a delivery and keeps its worktree; its sub-runs end with it. */
async function stopRuns(akb: Akb, ws: TaskFolder, id: number, since: number, ms: number): Promise<void> {
  const until = Date.now() + ms
  const call = (args: string[]) => runAkb(akb, [...args, '--board', ws.board], { cwd: ws.cwd, board: ws.board })
  while (Date.now() < until) {
    const runs = answerOf<{ runs?: (Run & { status?: string })[] }>(await call(['run', 'list', '--card', String(id), '--all', '--json']))?.runs
    const live = (runs ?? []).filter((r) => r.status === 'running' && (r.startedAt ?? 0) >= since)
    if (!live.length) return
    for (const r of live) await call(['run', 'stop', r.sessionId])
    await wait(250)
  }
}

/** The cards a job in this process works on, by board, with how many jobs hold each. */
const working = new Map<string, number>()
const workKey = (ws: TaskFolder, id: number) => `${ws.board}#${id}`

/** Stop the runs a force-quit Runner left on card `id` (#2120): a Runner's board is only the
 *  Runner's, so any run there that no job in this process holds has nobody to report to. */
export async function stopLeftBehind(akb: Akb, ws: TaskFolder, id: number, ms: number): Promise<void> {
  if (!working.has(workKey(ws, id))) await stopRuns(akb, ws, id, 0, ms)
}

const refusal = (ran: Ran) => ran.last.replace(/^akb( raw)?: /, '').slice(0, 300) || 'akb stopped with an error.'
const firstLine = (text?: string) => (text ?? '').split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 300)

/** What akb prints, as a terminal shows it: the JSON answer `--json` ends with gives back the
 *  prose it held, less the commands that only work on this computer. A line of
 *  `--follow --events` is an event, passed on as one (#2059). */
function logLines(show: (text: string) => void, event: (event: RunEvent) => void) {
  let held = ''
  const said = (line: string) => {
    if (line.startsWith('{"kind":')) {
      let parsed: RunEvent | undefined
      try {
        parsed = asEvent(JSON.parse(line))
      } catch {
        // not one after all
      }
      if (parsed) {
        event(parsed)
        return ''
      }
    }
    if (!line.startsWith('{"ok":')) return `${line}\n`
    let output = ''
    try {
      output = String((JSON.parse(line) as { output?: unknown }).output ?? '')
    } catch {
      return ''
    }
    return output.split('\n').filter((l) => !/^\s+(follow|stop) it:/.test(l)).map((l) => `${l}\n`).join('')
  }
  return {
    push: (chunk: string) => {
      const lines = (held + chunk).split('\n')
      held = lines.pop()!
      for (const line of lines) {
        const out = said(line)
        if (out) show(out)
      }
    },
    end: () => {
      const out = held ? said(held) : ''
      if (out) show(out)
    },
  }
}

/** akb, run on the task's board and followed to its end; with `task`, for that Cloud task. */
function boardAkb(job: Job, ws: TaskFolder, deps: FlowDeps, io: FlowIo, task?: string) {
  return async (args: string[], show = false) => {
    const at = args.includes('--') ? args.indexOf('--') : args.length
    const full = [...args.slice(0, at), '--board', ws.board, ...args.slice(at)]
    const log = show ? logLines(io.show, io.event) : undefined
    const ran = await runAkb(deps.akb, full, { cwd: ws.cwd, board: ws.board, task, lang: job.lang, show: log?.push, track: io.track })
    log?.end()
    return ran
  }
}

/** The board made, brought up to Cloud and set to run on the job's runtime; the refusal when not. */
async function setUp(job: Job, ws: TaskFolder, deps: FlowDeps, io: FlowIo): Promise<string | null> {
  const akb = boardAkb(job, ws, deps, io)
  const runtime = job.runtime
  const missing = unavailable(runtime, await deps.runtimes())
  if (missing) return missing

  if (!fs.existsSync(path.join(ws.board, 'config.md'))) {
    const init = await akb(['raw', 'init'])
    if (init.code !== 0) return refusal(init)
    for (const step of SETUP_STEPS) await akb(['raw', 'setup-done', step])
  }
  // Every run opens with the kanban skill's command; the project gets it, kept out of git.
  if (SKILL_FOLDERS.some((f) => !fs.existsSync(path.join(ws.cwd, f, 'SKILL.md')))) {
    const skill = await runAkb(deps.akb, ['skill', 'install', '--dir', ws.cwd], { cwd: ws.cwd, track: io.track })
    if (skill.code !== 0) return refusal(skill)
  }
  const pulled = await pull(ws)
  if (!pulled.ok) return pulled.error
  const used = await akb(['agent', 'use', runtime])
  if (used.code !== 0) return refusal(used)
  // The runtime's settings on the board's Global default, each one set or cleared (#2135); the
  // workflow's MCP servers ride on the extra arguments, or on `mcpConfig` for a CLI that talks.
  const servers = mcpServersOf(ws)
  const mcpFile = path.join(ws.board, '.sync', `${ws.task}.mcp.json`)
  const takes = new Set(settingKeys(runtime))
  const given = job.settings ?? {}
  const values: Record<string, string> = { ...given, model: job.model ?? '' }
  if (takes.has(MCP_KEY)) values[MCP_KEY] = mcpConfig(servers, mcpFile) ?? given[MCP_KEY] ?? ''
  else values[RAW_ARGS_KEY] = [given[RAW_ARGS_KEY], mcpArgs(runtime, servers, mcpFile)].filter(Boolean).join(' ')
  const secrets = secretsOf(job.runtimeId)
  const valueOf = (key: string) => (secretKeys(runtime).includes(key) ? secrets[key] : values[key]) ?? ''
  const set = async (key: string, value: string) => {
    const done = await akb(['agent', 'set', key, ...(value ? (key === RAW_ARGS_KEY ? ['--', value] : [value]) : [])])
    return done.code === 0 ? null : refusal(done)
  }
  // A provider is never cleared, and is picked only once what it needs is filled in; what it
  // no longer needs is cleared after.
  const provider = providerKey(runtime)
  const rest = [...takes].filter((k) => k !== provider)
  for (const key of rest.filter((k) => valueOf(k))) {
    const failed = await set(key, valueOf(key))
    if (failed) return failed
  }
  if (provider) {
    const failed = await set(provider, providerOf(runtime, job.model, { settings: job.settings, secrets }) ?? '')
    if (failed) return failed
  }
  for (const key of rest.filter((k) => !valueOf(k))) {
    const failed = await set(key, '')
    if (failed) return failed
  }
  return null
}

/** A review of the chats this computer keeps (#2065), on the project's board. */
export async function runReview(job: Job, ws: TaskFolder, tasks: string[], deps: FlowDeps, io: FlowIo): Promise<FlowEnd> {
  const since = Date.now()
  const failed = await setUp(job, ws, deps, io)
  if (failed) return { ok: false, reason: failed }
  const akb = boardAkb(job, ws, deps, io)
  const ran = await akb(['review-memory', '--task', ...tasks, '--follow', '--events', '--json'], true)
  if (io.lost()) return { ok: false, reason: '' }
  const answer = answerOf<{ result?: string; error?: { message?: string } }>(ran)
  if (ran.code !== 0) return { ok: false, reason: firstLine(answer?.error?.message?.replace(/^run \S+ ended \w+: /, '')) ?? refusal(ran) }
  const runs = answerOf<{ runs?: Run[] }>(await akb(['run', 'list', '--all', '--json']))?.runs ?? []
  return { ok: true, report: { ...(answer?.result?.trim() ? { reply: answer.result.trim() } : {}), ...spentBy(runs.filter((r) => (r.startedAt ?? 0) >= since)) } }
}

/** What the workspace's rejection review has not learned (#2067), laid out on the board,
 *  reviewed, sent back and marked learned. Its runs are answered, to count in what the job spent. */
async function reviewRejections(job: Job, ws: TaskFolder, deps: FlowDeps, io: FlowIo): Promise<{ runs: Run[]; failure?: string }> {
  const workspace = workspaceOf(ws)
  if (!workspace) return { runs: [] }
  const read = await deps.api.readRejections(workspace)
  if (!read.ok) return { runs: [], failure: read.error }
  if (!read.value.tasks.length && !read.value.triage.length) return { runs: [] }
  const since = Date.now()
  const akb = boardAkb(job, ws, deps, io)
  const laid = layOut(ws.board, read.value)
  const ran = await akb(['review-dismissals', '--all', '--follow', '--events', '--json'], true)
  clearLaid(ws.board)
  resetSorted(ws)
  const runs = (answerOf<{ runs?: Run[] }>(await akb(['run', 'list', '--all', '--json']))?.runs ?? []).filter((r) => (r.startedAt ?? 0) >= since)
  if (io.lost()) return { runs }
  if (ran.code !== 0) return { runs, failure: refusal(ran) }
  const sent = await push(ws, { id: job.id, machineId: deps.machineId })
  if (!sent.ok) return { runs, failure: sent.error }
  const marked = await deps.api.markReviewed(laid.tasks, laid.triage)
  return marked.ok ? { runs } : { runs, failure: marked.error }
}

/** Before a task is planned: the rejection review, a failure only logged. */
async function learnRejections(job: Job, ws: TaskFolder, deps: FlowDeps, io: FlowIo): Promise<Run[]> {
  const { runs, failure } = await reviewRejections(job, ws, deps, io)
  if (failure) console.error(`runner: rejections not learned: ${failure}`)
  return runs
}

/** A project's periodic agent (#2068): its command on the project's board, followed to its end. */
export async function runAgent(job: Job & { agent: AgentJob }, ws: TaskFolder, deps: FlowDeps, io: FlowIo): Promise<FlowEnd> {
  const since = Date.now()
  const failed = await setUp(job, ws, deps, io)
  if (failed) return { ok: false, reason: failed }
  const { name, workflow, tasks } = job.agent
  if (name === 'review-dismissals') {
    const { runs, failure } = await reviewRejections(job, ws, deps, io)
    if (io.lost()) return { ok: false, reason: '' }
    return failure ? { ok: false, reason: failure } : { ok: true, report: spentBy(runs) }
  }
  if (name === 'reflect' && !tasks?.length) return { ok: true, report: {} }
  const args = workflow ? ['agent', 'run', workflowName(workflow), name]
    : name === 'reflect' ? ['reflect', '--cards', ...tasks!.map((t) => String(t.number))]
    : [name]
  const akb = boardAkb(job, ws, deps, io, ws.cloudTask ?? undefined)
  // Listing reaps a run a stopped Runner left recorded as live, which would hold the agent for good.
  await akb(['run', 'list', '--all', '--json'])
  const ran = await akb([...args, '--follow', '--events', '--json'], true)
  if (io.lost()) return { ok: false, reason: '' }
  const answer = answerOf<{ result?: string; error?: { message?: string } }>(ran)
  if (ran.code !== 0) return { ok: false, reason: firstLine(answer?.error?.message?.replace(/^run \S+ ended \w+: /, '')) ?? refusal(ran) }
  const runs = answerOf<{ runs?: Run[] }>(await akb(['run', 'list', '--all', '--json']))?.runs ?? []
  return { ok: true, report: { ...(answer?.result?.trim() ? { reply: answer.result.trim() } : {}), ...spentBy(runs.filter((r) => (r.startedAt ?? 0) >= since)) } }
}

/** The discussion a task came from (#2146), written in `dir` for the agent to read; its path. */
export function writeTranscript(job: Pick<Job, 'transcript'>, dir: string): string {
  if (!job.transcript) return ''
  const file = path.join(dir, 'discussion.md')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, `${job.transcript}\n`)
  return file
}

/** The request's pictures (#2182), laid in the card's asset folder and shown on it. */
export function pictures(job: Pick<Job, 'attachments'>, ws: TaskFolder, id: number): string {
  const dir = cardAssetsDir(ws, id)
  if (!job.attachments.length || !dir) return ''
  fs.mkdirSync(dir, { recursive: true })
  return job.attachments.map((a, i) => {
    const file = `${i + 1}-${path.basename(a.name).replace(/[^\w.-]+/g, '-')}`
    fs.writeFileSync(path.join(dir, file), Buffer.from(a.content, 'base64'))
    return `\n<Asset src=".assets/${id}/${file}" label="${a.name.replace(/["<>]/g, '') || file}" />\n`
  }).join('')
}

/** `raw create`'s flags for a task's card fields: `related` and `blocked_by` name only the cards
 *  still open on this board, as akb takes them. */
export function cardFlags(ws: TaskFolder, fields: api.CardFields | undefined): string[] {
  if (!fields) return []
  const open = (keys: string[] | undefined) => (keys ?? []).map((k) => Number(/(\d+)$/.exec(k)?.[1]))
    .filter((n) => n > 0 && n !== ws.number && findCard(ws.board, n)?.startsWith(path.join(ws.board, 'todo') + path.sep))
  const lists: [string, (string | number)[]][] = [['--modules', fields.modules ?? []], ['--related', open(fields.related)], ['--blocked-by', open(fields.blocked_by)]]
  return [
    ...(fields.priority ? ['--priority', fields.priority] : []),
    ...(fields.roi ? ['--roi', fields.roi] : []),
    ...lists.flatMap(([flag, list]) => list.length ? [flag, list.join(',')] : []),
  ]
}

export async function runFlow(job: Job & { flow: Flow }, ws: TaskFolder, deps: FlowDeps, io: FlowIo): Promise<FlowEnd> {
  const { flow } = job
  const since = Date.now()
  const fail = (reason: string): FlowEnd => ({ ok: false, reason })
  const akb = boardAkb(job, ws, deps, io, ws.task)
  const made = (ran: Ran): api.Call<number> => {
    const answer = answerOf<{ id?: number; error?: { message?: string; kind?: string } }>(ran)
    return ran.code === 0 && answer?.id ? { ok: true, value: answer.id } : { ok: false, error: answer?.error?.message ?? refusal(ran), code: answer?.error?.kind }
  }

  const failed = await setUp(job, ws, deps, io)
  if (failed) return fail(failed)

  let id = akbCardOf(ws)
  // An unplanned build (#2139) has no plan for the review to inform.
  const learned = flow.verb === 'create' && !id && !flow.skip_plan ? await learnRejections(job, ws, deps, io) : []
  if (io.lost()) return fail('')
  if (flow.verb === 'create' && !id) {
    // Cloud sends the title and the request with the job; the task is read only when it did not.
    let said = { title: flow.title?.trim() ?? '', request: flow.text?.trim() ?? '' }
    if (!said.title) {
      const task = await deps.api.readTask(ws.task)
      if (!task.ok) return fail(task.error)
      said = { title: task.value.title?.trim() ?? '', request: task.value.request?.trim() ?? '' }
    }
    const title = said.title || 'Untitled'
    if (isBuilder(ws)) {
      const placed = await placeDraft(ws, deps.api)
      if (!placed.ok) return fail(placed.error)
    }
    const body = path.join(ws.board, '.sync', `${ws.task}.request.md`)
    fs.mkdirSync(path.dirname(body), { recursive: true })
    // The card takes the task's number (#2063), and no other.
    if (!ws.number) return fail('This task has no number yet.')
    fs.writeFileSync(body, `${said.request || title}\n${isBuilder(ws) ? `\n${draftLine(ws)}\n` : ''}${pictures(job, ws, ws.number)}`)
    const created = made(await akb(['raw', 'create', '--title', title, '--workflow', workflowName(flow.workflow), '--body-file', body,
      '--id', String(ws.number), ...cardFlags(ws, flow.metadata), '--json']))
    fs.rmSync(body, { force: true })
    if (!created.ok) return fail(created.error)
    id = created.value
  }
  if (!id) return fail('This task has no card on this computer.')
  const card = id
  // Held before the sweep, so a job here that starts meanwhile never sweeps this one's runs.
  const key = workKey(ws, card)
  const held = working.get(key) ?? 0
  working.set(key, held + 1)
  try {
    if (!held) await stopRuns(deps.akb, ws, card, 0, deps.stopMs)
    if (io.lost()) return fail('')
    return await workOn(card)
  } finally {
    fs.rmSync(path.join(ws.board, '.sync', `${ws.task}.discussion`), { recursive: true, force: true })
    const left = working.get(key)! - 1
    if (left) working.set(key, left)
    else working.delete(key)
  }

  async function workOn(id: number): Promise<FlowEnd> {
    io.onStop(() => stopRuns(deps.akb, ws, id, since, deps.stopMs))

    const verb = flow.verb === 'create' ? (flow.skip_plan ? 'implement' : 'refine') : flow.verb
    const text = flow.verb === 'create' ? '' : (flow.text ?? '').trim()
    if (verb === 'revise' && !text) return fail('Say what to change.')
    // A build held on a question carries on with the answer: resolved first, else handed to the
    // build as its note. A resumed one (#2128) resolved it already, and puts an ended delivery
    // back to work first.
    let note = verb === 'resolve' || verb === 'revise' ? text : ''
    if (verb === 'implement' && flow.resume) {
      const resumed = answerOf<{ landed?: boolean }>(await akb(['delivery', 'resume', String(id), '--json']))
      if (io.lost()) return fail('')
      if (resumed?.landed) return { ok: true, report: { card: id } }
    } else if (verb === 'implement' && text) {
      const resolved = await akb(['card', 'resolve', String(id), '--follow', '--events', '--json', '--', text], true)
      if (io.lost()) return fail('')
      if (resolved.code !== 0) note = text
    }
    // `implement` returns once the delivery landed and the card is archived.
    const ran = await akb(['card', verb, String(id), '--follow', '--events', '--json', ...carryArgs(verb), ...(note ? ['--', note] : [])], true)
    if (io.lost()) return fail('')
    type Ended = {
      ok?: boolean
      result?: string
      lastSessionId?: string
      agentSession?: string
      delivery?: { commit?: string; branch?: string }
      error?: { message?: string; result?: string; lastSessionId?: string; agentSession?: string }
    }
    const answer = answerOf<Ended>(ran)
    const review = reviewOf(cardFile(ws))
    // A build held on the user's question is reported as one, like a plan's.
    if (ran.code !== 0 && !(verb === 'implement' && answer?.error && review)) {
      return fail(firstLine(answer?.error?.message?.replace(/^run \S+ ended \w+: /, '')) ?? refusal(ran))
    }
    const last = answer?.lastSessionId ?? answer?.error?.lastSessionId
    const runs = answerOf<{ runs?: Run[] }>(await akb(['run', 'list', '--card', String(id), '--all', '--json']))?.runs ?? []
    const said = ((last ? runs.find((r) => r.sessionId === last)?.result : undefined) ?? answer?.result ?? answer?.error?.result)?.trim()
    const spent = spentBy([...learned, ...runs.filter((r) => (r.startedAt ?? 0) >= since)])
    const commit = ran.code === 0 ? answer?.delivery?.commit : undefined
    const landing = commit ? { landing: { commit, branch: answer?.delivery?.branch ?? '' } } : {}
    const session = answer?.agentSession ?? answer?.error?.agentSession
    return { ok: true, report: { ...(said ? { reply: said } : {}), ...(session ? { session } : {}), ...spent, card: id, ...(review ? { review } : {}), ...landing } }
  }

  /** A discussion task's planning step (#2146): the session it carries, and the discussion. */
  function carryArgs(verb: string): string[] {
    if (!['refine', 'resolve', 'revise'].includes(verb)) return []
    const transcript = writeTranscript(job, path.join(ws.board, '.sync', `${ws.task}.discussion`))
    return [
      ...(job.resume ? ['--session', job.resume, ...(job.fork ? ['--fork'] : [])] : []),
      ...(transcript ? ['--transcript', transcript] : []),
    ]
  }
}
