/**
 * The account's Local Runner and the jobs it runs (#2001).
 *
 * One computer per account registers as its Runner; a job is claimed once under a lease,
 * its output arrives in batches, and it ends done or failed. The desktop Runner (#2005) also
 * places projects on its computer, reads what needs the user, and shows its alerts. The rules
 * live in migrations/0048, 0049, 0053, 0055, 0059, 0062, 0074 and 0078 — this file shapes the request and checks the protocol.
 * A run's log goes through its `RunLog` (#2085), not Postgres.
 */

import { CHAT_KEEP_DAYS, RUNNER_LEASE_SECONDS, RUNNER_MIN_PROTOCOL } from './config.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { badRequest, notFound, runnerOutdated, serviceUnavailable } from './errors.ts'
import { bodyOf, json, requireMethod } from './http.ts'
import { shortName, uuid } from './input.ts'
import { requireOwner, type Owner } from './owner.ts'
import { readLimits } from './quota.ts'
import { idOf, taskIdOf } from './v1/http.ts'
import { poke } from './v1/stream.ts'
import { settleEndings } from './v1/endings.ts'
import { startIdea } from './v1/discussions.ts'
import { checkWorkflowFiles, landsOf } from './v1/workflow-files.ts'
import { BOARD_AGENTS, periodicAgents } from './runner-agents.ts'
import { answerDiff } from './diff.ts'
import { workspaceOfProject } from './board.ts'
import { anyUnlearned } from './triage.ts'

const RUNTIMES = ['claude-code', 'codex', 'cursor', 'opencode', 'kimi', 'dsh', 'zcode', 'grok'] as const
/** `conflict`: a task's job whose workspace write was refused, dispatched once more; `stopped`: a
 *  flow job the user stopped (#2128). */
const OUTCOMES = ['done', 'failed', 'conflict', 'stopped'] as const
/** A task's plan job, finished, submits its draft for review (#2040). */
const STAGES = ['plan', 'execute'] as const
const MAX_PROMPT = 256 * 1024
const MAX_PATH = 1024
const MAX_ATTACHMENTS = 5
/** Base64 characters across a job's attachments: about 4 MB of files, a chat's four pictures (#2133). */
const MAX_ATTACHMENT_CHARS = 5_600_000
const MAX_EVENTS_PER_BATCH = 500
const MAX_EVENT_TEXT = 64 * 1024
// The text a Runner cuts to, escaped, with room for the rest of the event around it.
const MAX_EVENT_DATA = 160 * 1024
const EVENT_KINDS = ['message', 'tool_call', 'tool_call_update', 'plan', 'error', 'log', 'context'] as const
const MAX_REPLY = 60_000
const MAX_QUESTION = 4000
const MAX_OPTIONS = 8
const MAX_OPTION = 200
const MAX_MODELS = 40
const MAX_MODEL_ID = 200
const MAX_MODEL_NAME = 80
const MAX_RUNTIMES = 100
/** A discussion's ideas (#2073): the whole state the agent left, dropped and started included. */
const MAX_IDEAS = 30
const MAX_IDEA_TITLE = 200
const MAX_OUTCOME = 32_000
const MAX_ACCEPTANCE = 20
const MAX_CHECK = 1000
const WORKFLOW_ID = /^wf_[0-9a-z_]{1,64}$/
const AGENT = /^[a-z0-9]+(-[a-z0-9]+)*$/

export interface RunnerRuntime {
  name: (typeof RUNTIMES)[number]
  installed: boolean
  loggedIn?: boolean
  models?: { id: string; name: string }[]
  /** What the connector takes, as the Runner's harness declares it (#2135). */
  settings?: SettingDecl[]
}

/** One setting a connector declares, as a form draws it: never how it reaches a run. */
export interface SettingDecl {
  key: string
  label: string
  kind: 'text' | 'select' | 'secret' | 'provider'
  help?: string
  placeholder?: string
  choices?: { value: string; label: string }[]
  providers?: { id: string; label: string; blurb: string; needs: string[] }[]
  defaultProvider?: string
}

/** A Runner that can show `comment` alerts asks for them with `comments=1`. */
export const listAlerts = (env: Env, owner: Owner, url: URL) =>
  call(env, 'list_desktop_alerts', {
    p_subject: owner.accountId,
    p_machine: uuid(url.searchParams.get('machine'), 'machine'),
    p_comments: url.searchParams.get('comments') === '1',
  })

/** Routes under `/v1/runner`. `rest` is the path after it, without slashes at either end. */
export async function routeRunner(request: Request, env: Env, url: URL, rest: string, ctx?: ExecutionContext): Promise<Response> {
  // The launcher asks before anybody has signed in, and the answer is no secret.
  if (rest === 'version') {
    requireMethod(request, 'GET')
    return json(await call(env, 'runner_version', { p_machine: uuid(url.searchParams.get('machine'), 'machine') }))
  }

  const owner = await requireOwner(request, env)
  if (rest === '') {
    if (request.method === 'GET') return json({ runner: await call(env, 'read_runner', { p_subject: owner.accountId }) })
    requireMethod(request, 'POST')
    return json({ runner: await registerRunner(env, owner, await bodyOf(request)) })
  }
  if (rest === 'release') {
    requireMethod(request, 'POST')
    const body = input(await bodyOf(request))
    return json(await mutate(env, 'release_runner', { p_subject: owner.accountId, p_machine: uuid(body.machineId, 'machine') }))
  }
  if (rest === 'presence') return presence(request, env, owner, url)
  if (rest === 'inbox') {
    requireMethod(request, 'GET')
    return json(await call(env, 'runner_inbox', { p_subject: owner.accountId }))
  }
  if (rest === 'alerts') {
    requireMethod(request, 'GET')
    return json({ alerts: await listAlerts(env, owner, url) })
  }
  const shown = /^alerts\/([^/]+)\/shown$/.exec(rest)
  if (shown) {
    requireMethod(request, 'POST')
    const body = input(await bodyOf(request))
    return json(await mutate(env, 'show_desktop_alert', {
      p_subject: owner.accountId,
      p_machine: uuid(body.machineId, 'machine'),
      p_alert: idOf(shown[1], 'alr', 'alert'),
    }))
  }
  if (rest === 'folders') {
    if (request.method === 'GET') {
      const args = { p_subject: owner.accountId, p_machine: uuid(url.searchParams.get('machine'), 'machine') }
      if (url.searchParams.get('elsewhere') === '1') return json({ projects: await call(env, 'list_elsewhere_projects', args) })
      return json({ folders: await call(env, 'list_project_folders', args) })
    }
    requireMethod(request, 'POST')
    return json({ folder: await addFolder(env, owner, await bodyOf(request)) })
  }
  const folder = /^folders\/([^/]+)\/(remove|notify)$/.exec(rest)
  if (folder) {
    requireMethod(request, 'POST')
    const body = input(await bodyOf(request))
    const args = { p_subject: owner.accountId, p_machine: uuid(body.machineId, 'machine'), p_project: idOf(folder[1], 'prj', 'project') }
    if (folder[2] === 'remove') return json(await mutate(env, 'remove_project_folder', args))
    if (typeof body.on !== 'boolean') throw badRequest('Say whether notifications are on.')
    return json({ folder: await mutate(env, 'set_project_folder_notify', { ...args, p_notify: body.on }) })
  }
  // The chats this computer reviews, and the review of some of them (#2065).
  if (rest === 'chats') {
    requireMethod(request, 'GET')
    const args = { p_subject: owner.accountId, p_machine: uuid(url.searchParams.get('machine'), 'machine'), p_days: CHAT_KEEP_DAYS }
    return json({ chats: (await call<unknown[] | null>(env, 'runner_chats', args)) ?? [] })
  }
  // This computer's running and queued tasks, for the plugin's Tasks tab (#18).
  if (rest === 'tasks') {
    requireMethod(request, 'GET')
    const args = { p_subject: owner.accountId, p_machine: uuid(url.searchParams.get('machine'), 'machine') }
    return json({ tasks: (await call<unknown[] | null>(env, 'list_machine_tasks', args)) ?? [] })
  }
  if (rest === 'reviews') {
    requireMethod(request, 'POST')
    return json({ job: await dispatchReview(env, owner, await bodyOf(request)) })
  }
  // A project's periodic agents, which the Runner judges due by its own clock (#2068).
  if (rest === 'agents') {
    requireMethod(request, 'GET')
    const project = idOf(url.searchParams.get('project'), 'prj', 'project')
    const held = await call<Parameters<typeof periodicAgents>[0]>(env, 'runner_agents', {
      p_subject: owner.accountId,
      p_machine: uuid(url.searchParams.get('machine'), 'machine'),
      p_project: project,
    })
    // Dismissals wait on the board (#2107).
    held.dismissalsWaiting ||= await anyUnlearned(env, await workspaceOfProject(env, project))
    return json({ agents: periodicAgents(held) })
  }
  if (rest === 'jobs') {
    if (request.method === 'GET') {
      const args = { p_subject: owner.accountId, p_machine: uuid(url.searchParams.get('machine'), 'machine') }
      const jobs = await call<unknown[] | null>(env, 'list_runner_jobs', { ...args, p_running_limits: await runningLimits(env, args) })
      return json({ jobs: jobs ?? [] })
    }
    requireMethod(request, 'POST')
    const body = await bodyOf(request)
    return json({ job: input(body).agent === undefined ? await dispatchJob(env, owner, body) : await requestAgent(env, owner, body) })
  }

  // A landed commit's diff, for the page waiting on it (#2109).
  const diff = /^diffs\/([^/]+)$/.exec(rest)
  if (diff) {
    requireMethod(request, 'POST')
    return json(await answerDiff(env, owner.accountId, diff[1]!, input(await bodyOf(request))))
  }

  const job = /^jobs\/([^/]+)(?:\/(claim|renew|finish|stream))?$/.exec(rest)
  if (!job) throw notFound()
  const [, raw = '', move] = job
  // One spelling of the id names its log object.
  const id = uuid(raw, 'job').toLowerCase()
  if (move === 'stream') return streamLog(request, env, owner, id, url)
  if (!move) {
    requireMethod(request, 'GET')
    const read = await call(env, 'read_runner_job', { p_subject: owner.accountId, p_job: id })
    if (!read) throw notFound()
    return json(read)
  }
  requireMethod(request, 'POST')
  const moved = await moveJob(env, owner, id, move, input(await bodyOf(request)))
  // A task's job moves its task (#2020): the workspace's open streams read again.
  if (ctx && (move === 'claim' || move === 'finish')) poke(env, ctx, owner.accountId)
  if (ctx && move === 'finish') ctx.waitUntil(settleEndings(env))
  return json(moved)
}

/** A run's log over a WebSocket (#2085): the Runner holding the job sends it with `?machine=`,
 *  and whoever may read the job watches it. */
async function streamLog(request: Request, env: Env, owner: Owner, job: string, url: URL): Promise<Response> {
  requireMethod(request, 'GET')
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') throw badRequest('Open this as a WebSocket.')
  if (!env.RUN_LOGS) throw serviceUnavailable()
  const machine = url.searchParams.get('machine')
  if (machine !== null) {
    if (!(await call<boolean>(env, 'runner_job_held', { p_subject: owner.accountId, p_machine: uuid(machine, 'machine'), p_job: job }))) {
      throw notFound('This Runner no longer holds that job.')
    }
  } else if (!(await call(env, 'read_runner_job', { p_subject: owner.accountId, p_job: job }))) {
    throw notFound()
  }
  const to = machine !== null ? 'https://run-log/runner' : `https://run-log/page?after=${afterOf(url)}`
  return env.RUN_LOGS.get(env.RUN_LOGS.idFromName(job)).fetch(to, { headers: request.headers })
}

/** The Runner's presence connection (#2163): while it pings, the machine counts as online. */
async function presence(request: Request, env: Env, owner: Owner, url: URL): Promise<Response> {
  requireMethod(request, 'GET')
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') throw badRequest('Open this as a WebSocket.')
  if (!env.RUNNER_PRESENCE) throw serviceUnavailable()
  const to = new URL('https://presence/connect')
  to.searchParams.set('account', owner.accountId)
  to.searchParams.set('machine', uuid(url.searchParams.get('machine'), 'machine').toLowerCase())
  return env.RUNNER_PRESENCE.get(env.RUNNER_PRESENCE.idFromName(owner.accountId)).fetch(to.href, { headers: request.headers })
}

/** The `seq` a reader already has, -1 for none. */
function afterOf(url: URL): number {
  const after = Number(url.searchParams.get('after') ?? -1)
  return Number.isInteger(after) ? after : -1
}

export async function registerRunner(env: Env, owner: Owner, body: unknown): Promise<unknown> {
  const held = input(body)
  const protocol = Number(held.protocol)
  if (!Number.isInteger(protocol) || protocol < RUNNER_MIN_PROTOCOL) throw runnerOutdated()
  const registered = await mutate(env, 'register_runner', {
    p_subject: owner.accountId,
    p_machine: uuid(held.machineId, 'machine'),
    p_machine_name: shortName(held.machineName),
    p_protocol: protocol,
    p_version: shortName(held.version),
    p_runtimes: runtimes(held.runtimes),
    p_notify: held.notify === true,
    p_lease_seconds: RUNNER_LEASE_SECONDS,
  })
  if (held.secrets !== undefined) {
    await call(env, 'report_runner_secrets', { p_subject: owner.accountId, p_machine: uuid(held.machineId, 'machine'), p_secrets: secretsHeld(held.secrets) })
  }
  return registered
}

/** `{ runtimeId: ["apiKey"] }`: which keys the Runner holds, by runtime. */
export function secretsHeld(value: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [id, keys] of Object.entries(input(value)).slice(0, MAX_RUNTIMES)) {
    if (!/^rt_[0-9A-Za-z_]{1,64}$/.test(id) || !Array.isArray(keys)) continue
    const held = keys.filter((k): k is string => typeof k === 'string' && /^[A-Za-z]\w{0,39}$/.test(k)).slice(0, 8)
    if (held.length) out[id] = [...new Set(held)]
  }
  return out
}

export async function dispatchJob(env: Env, owner: Owner, body: unknown): Promise<unknown> {
  const held = input(body)
  const runtime = RUNTIMES.find((r) => r === held.runtime)
  if (!runtime) throw badRequest(`A job runs on ${RUNTIMES.join(' or ')}.`)
  const prompt = typeof held.prompt === 'string' ? held.prompt : ''
  if (!prompt.trim()) throw badRequest('A job needs a prompt.')
  if (prompt.length > MAX_PROMPT) throw badRequest('That prompt is too long.')
  const stage = held.stage == null ? null : STAGES.find((s) => s === held.stage)
  if (stage === undefined) throw badRequest(`A job's stage is ${STAGES.join(' or ')}.`)
  if (stage && held.task == null) throw badRequest('Only a task\'s job has a stage.')
  return mutate(env, 'dispatch_runner_job', {
    p_subject: owner.accountId,
    p_runtime: runtime,
    p_project: held.project === undefined || held.project === null ? null : idOf(held.project, 'prj', 'project'),
    p_prompt: prompt,
    p_attachments: attachments(held.attachments),
    p_task: held.task === undefined || held.task === null ? null : await taskIdOf(env, owner.accountId, held.task),
    p_stage: stage,
  })
}

export async function dispatchReview(env: Env, owner: Owner, body: unknown): Promise<unknown> {
  const held = input(body)
  const runtime = RUNTIMES.find((r) => r === held.runtime)
  if (!runtime) throw badRequest(`A job runs on ${RUNTIMES.join(' or ')}.`)
  const tasks = Array.isArray(held.tasks) ? held.tasks : []
  if (!tasks.length || tasks.length > 100) throw badRequest('Name the tasks to review.')
  return mutate(env, 'dispatch_runner_review', {
    p_subject: owner.accountId,
    p_machine: uuid(held.machineId, 'machine'),
    p_project: idOf(held.project, 'prj', 'project'),
    p_tasks: tasks.map((t) => idOf(t, 'task', 'task')),
    p_runtime: runtime,
    p_model: typeof held.model === 'string' && held.model && held.model.length <= MAX_MODEL_ID ? held.model : null,
  })
}

/** An agent the Runner judged due: a board agent, or with `workflow` one it schedules. `seen` is
 *  the last pass that passed as the Runner read it. */
export async function requestAgent(env: Env, owner: Owner, body: unknown): Promise<unknown> {
  const held = input(body)
  const workflow = held.workflow == null ? null : typeof held.workflow === 'string' && WORKFLOW_ID.test(held.workflow) ? held.workflow : undefined
  if (workflow === undefined) throw badRequest('That is not a workflow id.')
  const agent = typeof held.agent === 'string' ? held.agent : ''
  if (workflow ? !AGENT.test(agent) : !BOARD_AGENTS.includes(agent)) throw badRequest('That agent does not run on its own.')
  const seen = held.seen == null ? null : typeof held.seen === 'string' && !Number.isNaN(Date.parse(held.seen)) ? held.seen : undefined
  if (seen === undefined) throw badRequest('`seen` is a time.')
  return mutate(env, 'request_agent_job', {
    p_subject: owner.accountId,
    p_machine: uuid(held.machineId, 'machine'),
    p_project: idOf(held.project, 'prj', 'project'),
    p_agent: agent,
    p_workflow: workflow,
    p_seen: seen,
  })
}

/** Each plan's running limit for the queued tasks this Runner may be handed (#2209). */
async function runningLimits(env: Env, args: { p_subject: string; p_machine: string; p_job?: string }): Promise<Record<string, number>> {
  const payers = (await call<string[] | null>(env, 'runner_job_payers', args)) ?? []
  return Object.fromEntries(await Promise.all(payers.map(async (p) => [p, (await readLimits(env, p)).tasks] as const)))
}

export async function moveJob(env: Env, owner: Owner, job: string, move: string, body: Record<string, unknown>): Promise<unknown> {
  const args = { p_subject: owner.accountId, p_machine: uuid(body.machineId, 'machine'), p_job: job }
  if (move === 'claim') {
    const claimed = await mutate<{ claimed?: boolean; job?: { secret?: boolean } }>(env, 'claim_runner_job', {
      ...args,
      p_lease_seconds: RUNNER_LEASE_SECONDS,
      p_running_limits: await runningLimits(env, args),
    })
    // A key job's keys go to the Runner that claimed it, once (#2135).
    if (!claimed.claimed || !claimed.job?.secret) return claimed
    return { ...claimed, job: { ...claimed.job, secrets: await call(env, 'take_runner_secrets', args) } }
  }
  if (move === 'renew') return mutate(env, 'renew_runner_job', { ...args, p_lease_seconds: RUNNER_LEASE_SECONDS })
  let outcome = OUTCOMES.find((o) => o === body.outcome)
  if (!outcome) throw badRequest('A job ends done, failed, conflict or stopped.')
  let reason = shortName(body.reason)
  // A Workflow builder task's files (#2004), checked again before the approval may save them.
  const built = outcome === 'done' ? builtOf(input(body.report).workflow) : null
  if (built && !built.ok) {
    outcome = 'failed'
    reason = shortName(built.reason)
  } else if (built) {
    await call(env, 'runner_built_workflow', { ...args, p_built: built.value })
  }
  const { discussion, start, ...done } = await mutate<{ discussion?: string | null; start?: string[] }>(env, 'finish_runner_job', {
    ...args, p_outcome: outcome, p_reason: reason, p_report: report(body.report),
  })
  // Ideas the agent started, as their creator would; a refusal leaves one unstarted.
  for (const idea of discussion ? start ?? [] : []) {
    await startIdea(env, owner.accountId, discussion!, idea, null)
      .catch((e) => console.error('cloud: idea not started', { idea, error: e instanceof Error ? e.message : String(e) }))
  }
  return done
}

/** `{ files }`, read as a workflow is; null when the report carries none. */
function builtOf(value: unknown): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } | null {
  if (value === undefined) return null
  const checked = checkWorkflowFiles(input(value).files)
  if (!checked.ok) return { ok: false, reason: `The workflow has a problem: ${checked.file} ${checked.reason}.` }
  const { name, description } = checked.def
  return { ok: true, value: { name: name.slice(0, 200), description: description.slice(0, 4000), ...landsOf(checked.def), files: checked.files } }
}

/** What the agent said, spent and where its session stands, for a job answering a chat (#2027); for a
 *  flow job (#2020) also the akb card it works on and the card's open question; for a discussion's
 *  job (#2073) its ideas; `stopped` for a reply stopped part way (#2133). A malformed field is dropped. */
export function report(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  const held = input(value)
  const count = (n: unknown) => (Number.isInteger(n) && (n as number) >= 0 ? (n as number) : undefined)
  const context = input(held.context)
  const used = count(context.used)
  const limit = count(context.limit)
  const review = cardQuestion(held.review)
  const usage = input(held.usage)
  const tokens = USAGE_KEYS.map((k) => count(usage[k]))
  const cost = held.costUsd
  return {
    ...(typeof held.reply === 'string' ? { reply: held.reply.slice(0, MAX_REPLY) } : {}),
    ...(held.stopped === true ? { stopped: true } : {}),
    ...(typeof held.session === 'string' && /^[\w.:-]{1,200}$/.test(held.session) ? { session: held.session } : {}),
    ...(used !== undefined && limit ? { context: { used, limit } } : {}),
    ...(tokens.every((n) => n !== undefined) ? { usage: Object.fromEntries(USAGE_KEYS.map((k, i) => [k, tokens[i]])) } : {}),
    ...(typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? { costUsd: cost } : {}),
    ...(count(held.card) ? { card: held.card } : {}),
    ...(count(held.ms) !== undefined ? { ms: held.ms } : {}),
    ...(review ? { review } : {}),
    ...(Array.isArray(held.ideas) ? { ideas: ideasOf(held.ideas) } : {}),
    ...landingOf(held.landing),
  }
}

/** The commit a build landed as and its branch (#2109); dropped when malformed. */
function landingOf(value: unknown): { landing?: { commit: string; branch: string } } {
  const held = input(value)
  if (typeof held.commit !== 'string' || !/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(held.commit)) return {}
  const branch = typeof held.branch === 'string' && held.branch.length <= 255 && !/[\x00-\x1f]/.test(held.branch) ? held.branch : ''
  return { landing: { commit: held.commit, branch } }
}

/** Each idea `{ id, title, outcome, acceptance, workflow, start?, dropped? }`; one with no id, or
 *  kept with no title, is dropped. */
function ideasOf(value: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const item of value.slice(0, MAX_IDEAS)) {
    const held = input(item)
    const id = typeof held.id === 'string' && /^[\w-]{1,80}$/.test(held.id) ? held.id : null
    const title = typeof held.title === 'string' ? held.title.trim().slice(0, MAX_IDEA_TITLE) : ''
    if (!id || (!title && held.dropped !== true)) continue
    out.push({
      id,
      title,
      outcome: typeof held.outcome === 'string' ? held.outcome.trim().slice(0, MAX_OUTCOME) : '',
      acceptance: Array.isArray(held.acceptance)
        ? held.acceptance.map((a) => (typeof a === 'string' ? a.trim().slice(0, MAX_CHECK) : '')).filter(Boolean).slice(0, MAX_ACCEPTANCE)
        : [],
      workflow: typeof held.workflow === 'string' && WORKFLOW_ID.test(held.workflow) ? held.workflow : 'wf_builtin_coding',
      ...(held.start === true ? { start: true } : {}),
      ...(held.dropped === true ? { dropped: true } : {}),
    })
  }
  return out
}

const USAGE_KEYS = ['input', 'cacheCreation', 'cacheRead', 'output'] as const

/** The card's first open `[user]` question, its options and its 1-based place in `questions:`. */
function cardQuestion(value: unknown): { question: string; options: string[]; position: number } | null {
  if (!value || typeof value !== 'object') return null
  const held = input(value)
  const question = typeof held.question === 'string' ? held.question.trim() : ''
  const options = Array.isArray(held.options)
    ? held.options.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean)
    : []
  const position = held.position
  if (!question || question.length > MAX_QUESTION || options.length < 1 || options.length > MAX_OPTIONS) return null
  if (!Number.isInteger(position) || (position as number) < 1) return null
  return { question, options: options.map((o) => o.slice(0, MAX_OPTION)), position: position as number }
}

const input = (body: unknown): Record<string, unknown> =>
  body && typeof body === 'object' ? (body as Record<string, unknown>) : {}

/** Which runtimes the Runner's computer has. Unknown names are dropped. */
export function runtimes(value: unknown): RunnerRuntime[] {
  if (!Array.isArray(value)) return []
  const out: RunnerRuntime[] = []
  for (const item of value) {
    const held = input(item)
    const name = RUNTIMES.find((r) => r === held.name)
    if (!name || out.some((r) => r.name === name)) continue
    out.push({
      name,
      installed: held.installed === true,
      ...(typeof held.loggedIn === 'boolean' ? { loggedIn: held.loggedIn } : {}),
      ...modelsOf(held.models),
      ...settingsOf(held.settings),
    })
  }
  return out
}

/** The models a connector offers on the Runner's computer (#2087), capped. */
function modelsOf(value: unknown): { models?: { id: string; name: string }[] } {
  if (!Array.isArray(value)) return {}
  const models: { id: string; name: string }[] = []
  for (const item of value) {
    const { id, name } = input(item)
    if (typeof id !== 'string' || !id.trim() || id.length > MAX_MODEL_ID || models.some((m) => m.id === id)) continue
    models.push({ id, name: typeof name === 'string' && name.trim() ? name.trim().slice(0, MAX_MODEL_NAME) : id })
    if (models.length === MAX_MODELS) break
  }
  return models.length ? { models } : {}
}

const SETTING_KINDS = ['text', 'select', 'secret', 'provider'] as const
const MAX_SETTINGS = 20
const MAX_CHOICES = 20
const MAX_TEXT = 400
const line = (v: unknown, max = MAX_TEXT) => (typeof v === 'string' ? v.slice(0, max) : '')

/** The settings a connector declares (#2135), capped; a malformed one is dropped. */
export function settingsOf(value: unknown): { settings?: SettingDecl[] } {
  if (!Array.isArray(value)) return {}
  const settings: SettingDecl[] = []
  for (const item of value.slice(0, MAX_SETTINGS)) {
    const held = input(item)
    const kind = SETTING_KINDS.find((k) => k === held.kind)
    const key = line(held.key, 40)
    if (!kind || !/^[A-Za-z]\w*$/.test(key) || settings.some((s) => s.key === key)) continue
    const choices = Array.isArray(held.choices)
      ? held.choices.slice(0, MAX_CHOICES).map(input).map((c) => ({ value: line(c.value, 80), label: line(c.label, 80) }))
      : undefined
    const providers = Array.isArray(held.providers)
      ? held.providers.slice(0, MAX_CHOICES).map(input).map((p) => ({
          id: line(p.id, 40),
          label: line(p.label, 80),
          blurb: line(p.blurb),
          needs: Array.isArray(p.needs) ? p.needs.filter((n): n is string => typeof n === 'string').slice(0, MAX_SETTINGS).map((n) => n.slice(0, 40)) : [],
        }))
      : undefined
    settings.push({
      key,
      label: line(held.label, 80) || key,
      kind,
      ...(held.help ? { help: line(held.help) } : {}),
      ...(held.placeholder ? { placeholder: line(held.placeholder, 200) } : {}),
      ...(choices ? { choices } : {}),
      ...(providers ? { providers } : {}),
      ...(held.defaultProvider ? { defaultProvider: line(held.defaultProvider, 40) } : {}),
    })
  }
  return settings.length ? { settings } : {}
}

/** A folder on the Runner's computer: a new project, or with `project` an existing one placed
 *  there. The Runner decides which folders it may add; this only keeps the shape sane. */
export async function addFolder(env: Env, owner: Owner, body: unknown): Promise<unknown> {
  const held = input(body)
  return mutate(env, 'add_project_folder', {
    p_subject: owner.accountId,
    p_machine: uuid(held.machineId, 'machine'),
    p_name: shortName(held.name) || 'project',
    p_path: folderPath(held.path),
    ...(held.project === undefined || held.project === null ? {} : { p_project: idOf(held.project, 'prj', 'project') }),
  })
}

/** An absolute folder on the Runner's computer. */
export function folderPath(value: unknown): string {
  const dir = typeof value === 'string' ? value : ''
  const absolute = dir.startsWith('/') || /^[A-Za-z]:[\\/]/.test(dir)
  if (!absolute || dir.length > MAX_PATH || dir.includes('\0')) throw badRequest('A project folder is an absolute path.')
  return dir
}

export function attachments(value: unknown): { name: string; content: string }[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS) {
    throw badRequest(`A job carries at most ${MAX_ATTACHMENTS} attachments.`)
  }
  let size = 0
  return value.map((item) => {
    const held = input(item)
    const name = typeof held.name === 'string' ? held.name.trim() : ''
    const content = typeof held.content === 'string' ? held.content : ''
    if (!/^[^/\\\0]{1,200}$/.test(name) || name === '.' || name === '..') {
      throw badRequest('An attachment needs a plain file name.')
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(content)) throw badRequest('An attachment is sent as base64.')
    size += content.length
    if (size > MAX_ATTACHMENT_CHARS) throw badRequest('Those attachments are too large.')
    return { name, content }
  })
}

/** A run's event (#2059); one that names no kind is log text, as an older Runner sends. */
export function jobEvents(value: unknown): { seq: number; text: string; kind: string; data?: Record<string, unknown> }[] {
  if (!Array.isArray(value) || value.length > MAX_EVENTS_PER_BATCH) {
    throw badRequest(`Send at most ${MAX_EVENTS_PER_BATCH} events at once.`)
  }
  return value.flatMap((item) => {
    const held = input(item)
    const seq = Number(held.seq)
    if (!Number.isInteger(seq) || seq < 0) throw badRequest('An event needs its sequence number.')
    const kind = held.kind ?? 'log'
    // A newer Runner's kind is dropped, not the whole batch.
    if (!EVENT_KINDS.includes(kind as never)) return []
    const text = typeof held.text === 'string' ? held.text.slice(0, MAX_EVENT_TEXT) : ''
    if (held.data === undefined || held.data === null) return [{ seq, text, kind: kind as string }]
    if (typeof held.data !== 'object' || Array.isArray(held.data)) throw badRequest("An event's data is an object.")
    if (JSON.stringify(held.data).length > MAX_EVENT_DATA) throw badRequest('That event is too large.')
    return [{ seq, text, kind: kind as string, data: held.data as Record<string, unknown> }]
  })
}
