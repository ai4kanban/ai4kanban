import { goalsOf } from './goals'
// The Runner's calls to Cloud (cloud/src/runners.ts), over plain `fetch`.
//
// Every call answers rather than throws: `code` is the service's refusal, and a missing
// code means Cloud was not reached.

import { cloudEndpoints } from '../../cli/src/lib/cloud/config'
import { accessToken } from '../../cli/src/lib/cloud/session'
import { AKB_CONTRACT } from './protocol'
import { secretsSet } from './secrets'

export type Call<T> = { ok: true; value: T } | { ok: false; error: string; code?: string; project?: string }

/** Every connector a job can run on, in the board's order. */
export const RUNTIMES = ['claude-code', 'codex', 'cursor', 'opencode', 'kimi', 'dsh', 'zcode', 'grok'] as const

export interface Job {
  handoff?: { kind: 'check' | 'execution'; action?: 'queue' | 'continue' | 'restart' | 'runtime'; started?: boolean; recovering?: boolean; isolation?: string; progressIsolation?: string | null; verb?: Flow['verb']; evidence?: string | null } | null
  id: string
  runtime: (typeof RUNTIMES)[number]
  /** The runtime the job runs as (#2135), whose keys this computer holds. */
  runtimeId?: string | null
  /** The runtime's model (#2074); null runs the connector's own default. */
  model?: string | null
  /** The runtime's own settings beside the model (#2135), by the harness's keys. Never a key. */
  settings?: Record<string, string> | null
  /** A runtime's connection test: the prompt is sent as it is, and nothing else happens. */
  test?: boolean
  /** A job handing over the runtime's keys (#2135): `secrets` on its claim, null to clear one. */
  secret?: boolean
  secrets?: Record<string, string | null> | null
  project?: string | null
  projectDir: string | null
  /** The task whose folder the job runs in (#2037). */
  task?: string | null
  /** The task's short number, which its card file starts with (#2081). */
  number?: number | null
  /** The task's workflow id, whose files its project's board holds under `workflows/` (#2081). */
  workflow?: string | null
  /** A task's `plan` job, finished, submits its draft for review (#2040). */
  stage?: 'plan' | 'execute' | null
  attempt?: number
  recoveryOf?: string | null
  manualRecovery?: boolean
  retryReplay?: boolean
  sessionFallback?: boolean
  /** The agent session a chat's job continues (#2027), or a discussion task's step (#2146). */
  resume?: string | null
  /** `resume` is a discussion's session, copied rather than continued (#2146). */
  fork?: boolean
  /** The discussion a task came from, as the agent reads it when no session is carried (#2146). */
  transcript?: string | null
  /** A board verb to run with akb (#2020); null for every other job. Its `prompt` is ignored. */
  flow?: Flow | null
  /** 目标讨论作业；ideas 是旧服务端的读取字段。 */
  discussion?: { id: string; workspace: string; goals?: Goal[]; ideas: Goal[] } | null
  /** A task chat's reply: the user's message it answers (#2065). */
  chat?: { message: string; body: string } | null
  /** A review of these tasks' chats, which this computer answered (#2065). */
  review?: { tasks: string[] } | null
  /** One of the project's periodic agents (#2068), on no task. */
  agent?: AgentJob | null
  prompt: string
  language?: 'zh' | 'en' | null
  /** 兼容迁移前的 Cloud 响应。 */
  languageLine?: string
  attachments: { name: string; content: string }[]
  state: 'waiting' | 'claimed' | 'interrupted' | 'finished'
}

export interface AgentJob {
  name: string
  /** A workflow's scheduled agent names its workflow. */
  workflow?: string
  /** A reflect's finished tasks, fixed as it was claimed. */
  tasks?: { id: string; number: number }[]
}

export interface Flow {
  verb: 'create' | 'resolve' | 'revise' | 'approve' | 'implement' | 'refine' | 'discard'
  /** The task's workflow id, e.g. `wf_builtin_coding`. */
  workflow: string
  /** The akb card id this Runner reported before. */
  card?: number
  text?: string
  title?: string
  /** Run again after a stop or a failure, carrying on the work kept here (#2128). */
  resume?: boolean
  /** On `create`: build the card straight after writing it, unplanned (#2139). */
  skip_plan?: boolean
  /** A first step's card fields; `related` and `blocked_by` as task keys. */
  metadata?: CardFields
}

export interface CardFields {
  previews?: string[]
  priority?: string
  modules?: string[]
  related?: string[]
  blocked_by?: string[]
}

export interface Goal {
  id: string
  title: string
  outcome: string
  acceptance: string[]
  previews?: string[]
  workflow: string
  task?: string | null
  start?: boolean
  dropped?: boolean
}

export interface RuntimeReport {
  name: Job['runtime']
  installed: boolean
  /** The version of the copy runs use here. */
  version?: string
  loggedIn?: boolean
  /** The models this connector offers here, for the model menu (#2087). */
  models?: { id: string; name: string }[]
  /** What the connector takes, for the runtime form (#2135). */
  settings?: SettingDecl[]
}

/** One setting as a form draws it. */
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

/** Raised by Cloud when it no longer takes this Runner's protocol. 9 keeps keys (#2135); 10 stops
 *  a flow job, pausing its board runs (#2128); 11 holds the computer's lock (#2161); 14 shares local settings and account revocation. */
export const PROTOCOL = 16

const TIMEOUT_MS = 20_000

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/** A file's bytes go as they are, with their type; anything else as JSON. */
async function send(method: Method, route: string, body: unknown, signedIn: boolean, ms: number, type?: string, extra: Record<string, string> = {}): Promise<Call<Response>> {
  const headers: Record<string, string> = { accept: 'application/json', ...extra }
  if (signedIn) {
    const token = await accessToken()
    if (!token.ok) {
      return token.reason === 'unreachable'
        ? { ok: false, error: token.error }
        : { ok: false, error: 'Sign in again.', code: 'unauthenticated' }
    }
    headers.authorization = `Bearer ${token.token}`
  }
  const raw = body instanceof Uint8Array
  if (body !== undefined) headers['content-type'] = raw ? type ?? 'application/octet-stream' : 'application/json'
  try {
    const response = await fetch(`${cloudEndpoints().api}${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : raw ? (body as Uint8Array<ArrayBuffer>) : JSON.stringify(body),
      signal: AbortSignal.timeout(ms),
    })
    return { ok: true, value: response }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

async function answerOf<T>(response: Response): Promise<Call<T>> {
  const answer = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string; project?: string } } | null
  if (response.ok) return { ok: true, value: answer as T }
  return {
    ok: false,
    error: answer?.error?.message ?? `Cloud answered ${response.status}`,
    code: answer?.error?.code ?? (response.status >= 500 ? undefined : 'refused'),
    ...(answer?.error?.project ? { project: answer.error.project } : {}),
  }
}

export async function request<T>(method: Method, route: string, body?: unknown, signedIn = true): Promise<Call<T>> {
  const sent = await send(method, route, body, signedIn, TIMEOUT_MS)
  return sent.ok ? answerOf<T>(sent.value) : sent
}

/** Files move slower than calls. */
const FILE_TIMEOUT_MS = 10 * 60_000

export async function download(route: string): Promise<Call<Uint8Array>> {
  const sent = await send('GET', route, undefined, true, FILE_TIMEOUT_MS)
  if (!sent.ok) return sent
  if (!sent.value.ok) return answerOf<never>(sent.value)
  try {
    return { ok: true, value: new Uint8Array(await sent.value.arrayBuffer()) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function upload<T>(route: string, bytes: Uint8Array, type: string): Promise<Call<T>> {
  const sent = await send('PUT', route, bytes, true, FILE_TIMEOUT_MS, type)
  return sent.ok ? answerOf<T>(sent.value) : sent
}

export interface Registration {
  machineId: string
  machineName: string
  version: string
  runtimes: RuntimeReport[]
  /** 兼容既有 Runner 的通知协议；当前客户端不发送。 */
  notify?: boolean
}

export const register = (r: Registration) =>
  request<{ runner: { machineName: string }; akb?: { version: string | null } }>('POST', '/v1/runner', { ...r, secrets: secretsSet(), protocol: PROTOCOL, akbContract: AKB_CONTRACT })

export const readRunner = () => request<{ runner: { machineName: string; connected: boolean; protocol?: number; machineId?: string } | null }>('GET', '/v1/runner')

export const release = (machineId: string) => request<{ released: boolean }>('POST', '/v1/runner/release', { machineId })

export const listJobs = (machineId: string) =>
  request<{ jobs: Job[] }>('GET', `/v1/runner/jobs?machine=${encodeURIComponent(machineId)}`)

const move = <T>(job: string, what: string, body: Record<string, unknown>) =>
  request<T>('POST', `/v1/runner/jobs/${encodeURIComponent(job)}/${what}`, body)

export const claimJob = (machineId: string, job: string) =>
  move<{ claimed: true; job: Job } | { claimed: false; reason: string }>(job, 'claim', { machineId })

/** `stop`: the user stopped the chat reply this job writes (#2133). */
export const renewJob = (machineId: string, job: string) => move<{ renewed: boolean; stop?: boolean }>(job, 'renew', { machineId })

/** One event as Cloud keeps it (#2059): a `log` carries its text, the rest their data. */
export interface JobEvent {
  seq: number
  kind: string
  text: string
  data?: Record<string, unknown>
}

/** The job's log stream (#2085), or null when no token can be had. The token goes as a
 *  subprotocol: a WebSocket carries no headers of its own. */
export async function openLog(machineId: string, job: string): Promise<WebSocket | null> {
  const token = await accessToken()
  if (!token.ok) return null
  const url = `${cloudEndpoints().api.replace(/^http/, 'ws')}/v1/runner/jobs/${encodeURIComponent(job)}/stream?machine=${encodeURIComponent(machineId)}`
  return new WebSocket(url, ['bearer', token.token])
}

/** The presence connection (#2163), or null when no token can be had. */
export async function openPresence(machineId: string): Promise<WebSocket | null> {
  const token = await accessToken()
  if (!token.ok) return null
  return new WebSocket(`${cloudEndpoints().api.replace(/^http/, 'ws')}/v1/runner/presence?machine=${encodeURIComponent(machineId)}`, ['bearer', token.token])
}

/** The presence route read over plain HTTP: `not_found` on a Cloud from before it. */
export const presenceRoute = (machineId: string) => request('GET', `/v1/runner/presence?machine=${encodeURIComponent(machineId)}`)

/** What the agent said and where its session stands. */
/** Tokens: fresh input, cache writes, cache reads, output. */
export interface Usage {
  input: number
  cacheCreation: number
  cacheRead: number
  output: number
}

export interface JobReport {
  recovery?: { safe: boolean; stopped: boolean; resumable: boolean }
  processesStopped?: boolean
  evidence?: string

  reply?: string
  session?: string
  context?: { used: number; limit: number }
  usage?: Usage
  costUsd?: number
  /** Claude session totals for each attempt, in execution order. */
  attemptCosts?: { resume?: string | null; session?: string; costUsd?: number }[]
  /** A flow job's akb card id on this Runner's board. */
  card?: number
  /** The card's first open question, `position` 1-based in its `questions:`. */
  review?: { question: string; options: string[]; position: number }
  /** How long a connection test took to answer. */
  ms?: number
  /** 讨论结束时的目标；写入只选择 goals 或兼容 ideas。 */
  goals?: Goal[]
  ideas?: Goal[]
  /** A Workflow builder task's workflow, checked (#2004). */
  workflow?: { files: Record<string, string> }
  /** The commit a build landed as, on the branch checked out in the project (#2109). */
  landing?: { commit: string; branch: string }
  /** A chat reply the user stopped part way (#2133). */
  stopped?: boolean
}

export const finishJob = (
  machineId: string,
  job: string,
  outcome: 'done' | 'failed' | 'conflict' | 'stopped',
  reason = '',
  report?: JobReport,
) => move<{ finished: boolean; prepared?: boolean }>(job, 'finish', { machineId, outcome, reason, ...(report ? { report } : {}) })

/** One file of a landed commit's diff (#2109); `patch` is its hunks, absent when too large. */
export interface DiffFile {
  path: string
  status: 'added' | 'modified' | 'deleted'
  added: number
  removed: number
  binary?: boolean
  patch?: string
}

export type DiffAnswer = { files: DiffFile[]; truncated: boolean } | { gone: true }

/** What Cloud asked for in a `diff` hint, answered to the page waiting on it. */
export const answerDiff = (machineId: string, id: string, answer: DiffAnswer) =>
  request<{ answered: boolean }>('POST', `/v1/runner/diffs/${encodeURIComponent(id)}`, { machineId, ...answer })

/** The archived tasks this computer reviews, chat or none (#2065, #165). */
export const listChats = (machineId: string) =>
  request<{ chats: { task: string; project: string; number: number; archivedAt: string }[] }>('GET', `/v1/runner/chats?machine=${encodeURIComponent(machineId)}`)

/** A task's whole chat as Cloud keeps it, whichever computer answered it (#2110). */
export const readChat = (task: string) =>
  request<{ messages: { id: string; role: 'user' | 'agent'; body: string; created_at: string }[] }>('GET', `/v1/tasks/${encodeURIComponent(task)}/chat`)

/** One page of a task's decisions: what the user wrote approving or sending it back (#212). */
export const readDecisions = (task: string, after?: string | null) =>
  request<{ data: { id: string; comment: string; created_at: string }[]; next: string | null }>('GET', `/v1/tasks/${q(task)}/decisions?limit=100${after ? `&after=${q(after)}` : ''}`)

/** A job reviewing these archived tasks, which only this computer runs. */
export const dispatchReview = (machineId: string, project: string, tasks: string[], runtime: Job['runtime'], model: string | null) =>
  request<{ job: Job }>('POST', '/v1/runner/reviews', { machineId, project, tasks, runtime, model })

/** A project's periodic agents and what Cloud knows of each, to judge them due here (#2068). */
export interface PeriodicAgent {
  name: string
  workflow?: string
  cadence: string
  fallback: string
  reads?: 'archived-cards' | 'chats' | 'dismissals'
  since: string | null
  lastSuccess: string | null
  attempts: { startedAt: string; status: 'running' | 'done' | 'error' }[]
  newWork: boolean
}

export const readAgents = (machineId: string, project: string) =>
  request<{ agents: PeriodicAgent[] }>('GET', `/v1/runner/agents?machine=${encodeURIComponent(machineId)}&project=${encodeURIComponent(project)}`)

/** A job for an agent judged due; null when one is open, or a pass passed after `seen`. */
export const requestAgent = (machineId: string, project: string, agent: string, workflow: string | null, seen: string | null) =>
  request<{ job: Job | null }>('POST', '/v1/runner/jobs', { machineId, project, agent, workflow, seen })

export const targetVersion = (machineId: string) =>
  request<{ version: string | null }>('GET', `/v1/runner/version?machine=${encodeURIComponent(machineId)}`, undefined, false)

// --- 项目与任务 ---------------------------------------------------------------

export interface Folder {
  project: string
  name: string
  path: string
  notify: boolean
}

/** A project of the account's workspaces with no folder on this computer (#2022). */
export interface Elsewhere {
  project: string
  name: string
  workspace: string
  workspace_name: string
  personal: boolean
}

const q = encodeURIComponent

export const listFolders = (machineId: string) => request<{ folders: Folder[] }>('GET', `/v1/runner/folders?machine=${q(machineId)}`)

export const listElsewhere = (machineId: string) =>
  request<{ projects: Elsewhere[] }>('GET', `/v1/runner/folders?machine=${q(machineId)}&elsewhere=1`)

/** A task this computer runs or holds waiting (#18); `stop` the route that stops it. */
export interface MachineTask {
  task: string
  key: string | null
  title: string
  project: string | null
  runtime: Job['runtime']
  state: 'running' | 'queued'
  since: string
  stop: 'task' | 'chat' | null
}

export const listMachineTasks = (machineId: string) => request<{ tasks: MachineTask[] }>('GET', `/v1/runner/tasks?machine=${q(machineId)}`)

export const stopTask = (task: string, how: 'task' | 'chat') =>
  request<unknown>('POST', how === 'chat' ? `/v1/tasks/${q(task)}/chat/stop` : `/v1/tasks/${q(task)}/stop`, {})

/** A new project from the folder, or with `project` that project placed there. */
export const addFolder = (machineId: string, name: string, path: string, project?: string) =>
  request<{ folder: Folder }>('POST', '/v1/runner/folders', { machineId, name, path, ...(project ? { project } : {}) })

export async function createProject(name: string, workspace: string, key: string): Promise<Call<{ id: string }>> {
  const sent = await send('POST', '/v1/projects', { name, workspace }, true, TIMEOUT_MS, undefined, { 'idempotency-key': key })
  return sent.ok ? answerOf<{ id: string }>(sent.value) : sent
}

export const removeFolder = (machineId: string, project: string) =>
  request<{ removed: boolean }>('POST', `/v1/runner/folders/${q(project)}/remove`, { machineId })

// --- a task's folder (#2037) ----------------------------------------------------

/** A path the body names → the artifact version it shows; no `version` follows the latest. */
/** `error` says why a preview could not be drawn; its artifact keeps the last drawn version, if any. */
export type Assets = Record<string, { artifact: string; version?: number; error?: string }>

/** One file of a workspace's board (#2081, #2114), by its path there; `content` null for a deleted one. */
export interface BoardFile {
  path: string
  content: string | null
  seq: number
}

export interface BoardWrite {
  path: string
  content: string | null
  /** The `seq` the file was read at; 0 for a new one. */
  base_seq: number
}

/** What changed after `since`, or the whole board without it. */
export const readBoard = (project: string, since: number | null) =>
  request<{ head_seq: number; files: BoardFile[] }>('GET', `/v1/projects/${q(project)}/board${since === null ? '' : `?since=${since}`}`)

/** Refused as `version_conflict`, `files` holds those that moved on, as they are now. */
export async function commitBoard(project: string, job: string | null, machine: string, files: BoardWrite[]):
  Promise<Call<{ head_seq: number; files: { path: string; seq: number }[] }> & { files?: BoardFile[] }> {
  const sent = await send('POST', `/v1/projects/${q(project)}/board/commits`, { job, machine, files }, true, TIMEOUT_MS)
  if (!sent.ok) return sent
  if (sent.value.status !== 409) return answerOf(sent.value)
  const answer = (await sent.value.json().catch(() => null)) as { error?: { code?: string; message?: string }; files?: BoardFile[] } | null
  return { ok: false, error: answer?.error?.message ?? 'Cloud answered 409', code: answer?.error?.code ?? 'refused', ...(answer?.files ? { files: answer.files } : {}) }
}

/** The workflow version a task runs on: `WORKFLOW.md` and its agents' folders (#2040). */
export interface TaskWorkflow {
  workflow: string
  version: number
  name?: string
  files: Record<string, string>
  /** A built-in: akb ships its workflow and agents, so only its skills are written. */
  builtin?: boolean
}

export const readTaskWorkflow = (task: string) => request<TaskWorkflow>('GET', `/v1/tasks/${q(task)}/workflow`)

export interface Workflow {
  previews?: { agent: string; title: { en?: string; zh?: string }; when: string }[]
  id: string
  name: string
  names?: { en: string; zh: string }
  description?: string | null
  when?: string
}

export const listWorkflows = (workspace: string, after?: string | null) =>
  request<{ data: Workflow[]; next: string | null }>('GET', `/v1/workflows?workspace=${q(workspace)}&limit=100${after ? `&after=${q(after)}` : ''}`)

/** `context.workflow`: the own workflow a Workflow builder task changes (#2004). */
export const readTask = (task: string) =>
  request<{ title: string; request: string; context?: { workflow?: string } }>('GET', `/v1/tasks/${q(task)}`)

export const readWorkflow = (id: string) => request<{ version: number; name?: string; files: Record<string, string> }>('GET', `/v1/workflows/${q(id)}`)

export const readProject = (project: string) => request<{ workspace?: string }>('GET', `/v1/projects/${q(project)}`)


export const readArtifact = (artifact: string) => request<{ latest_version: number | null; type: import('../../artifact-sdk/src/internal/references').Kind }>('GET', `/v1/artifacts/${q(artifact)}`)

export const readVersion = (artifact: string, version: number) =>
  request<{ content: unknown; file: { url: string } | null }>('GET', `/v1/artifacts/${q(artifact)}/versions/${version}`)

export const createArtifact = (task: string, name: string, type: string) =>
  request<{ id: string }>('POST', `/v1/tasks/${q(task)}/artifacts`, { type, name })

export const createUpload = (artifact: string, contentType: string, size: number) =>
  request<{ id: string }>('POST', `/v1/artifacts/${q(artifact)}/uploads`, { content_type: contentType, size })

export const createVersion = (artifact: string, upload: string) =>
  request<{ version: number }>('POST', `/v1/artifacts/${q(artifact)}/versions`, { upload })

// --- triage and the rejection review (#2067) -----------------------------------

export interface Triage {
  id: string
  project: string
  title: string
  text: string
  source_task: string | null
  /** The Cloud workflow that does its work; null on an item filed before #2139. */
  workflow: string | null
  state: 'open' | 'dismissed' | 'carded'
  dismissed_reason: string | null
  dismissed_at: string | null
  created_at: string
}

export interface Rejection {
  id: string
  number: number
  title: string
  request: string
  reason: string
  cancelled_at: string
}

/** What the workspace's rejection review has not learned yet. */
export const readRejections = (workspace: string) =>
  request<{ tasks: Rejection[]; triage: Triage[] }>('GET', `/v1/rejections?workspace=${q(workspace)}`)

export const markReviewed = (tasks: string[], triage: string[]) =>
  request<{ tasks: number; triage: number }>('POST', '/v1/rejections/reviewed', { tasks, triage })


// --- a Claude Code discussion (#2161) ------------------------------------------

export interface DraftGoal {
  id: string
  title: string
  outcome: string
  acceptance: string[]
  previews?: string[]
  workflow: string
  task: { id: string; key: string } | null
}

export interface Discussion {
  id: string
  workspace: string
  project: string | null
  title: string
  version: number
  goals?: DraftGoal[]
  ideas: DraftGoal[]
  updated_at: string
}

/** Without a project, the discussion is the personal workspace's, in no project. */
const openDiscussionCall = (project: string | null, requestId: string, host: 'claude-code' | 'codex' = 'claude-code') =>
  request<Discussion>('POST', '/v1/discussions/external', { ...(project ? { project } : {}), requestId, host })

const readDiscussionCall = (id: string) => request<Discussion>('GET', `/v1/discussions/${q(id)}`)

const goalDiscussions = new Set<string>()
function discussionAnswer(answer: Call<Discussion>): Call<Discussion> {
  if (!answer.ok) return answer
  const d = answer.value
  if (d.goals !== undefined) goalDiscussions.add(d.id)
  else goalDiscussions.delete(d.id)
  try { return { ...answer, value: { ...d, goals: goalsOf(d) } } }
  catch (e) { return { ok: false, code: 'bad_response', error: String(e) } }
}
export const openDiscussion = async (...args: Parameters<typeof openDiscussionCall>) => discussionAnswer(await openDiscussionCall(...args))
export const readDiscussion = async (id: string) => discussionAnswer(await readDiscussionCall(id))

/** 版本冲突时附带当前讨论。 */
export async function saveDraft(id: string, expectedVersion: number, goals: unknown[]): Promise<Call<Discussion> & { discussion?: Discussion }> {
  const sent = await send('PUT', `/v1/discussions/${q(id)}/draft`, { expectedVersion, ...(goalDiscussions.has(id) ? { goals } : { ideas: goals }) }, true, TIMEOUT_MS)
  if (!sent.ok) return sent
  if (sent.value.status !== 409) return discussionAnswer(await answerOf<Discussion>(sent.value))
  const answer = (await sent.value.json().catch(() => null)) as { error?: { code?: string; message?: string }; discussion?: Discussion } | null
  if (answer?.discussion) {
    const normalized = discussionAnswer({ ok: true, value: answer.discussion })
    if (!normalized.ok) return normalized
    answer.discussion = normalized.value
  }
  return { ok: false, error: answer?.error?.message ?? 'Cloud answered 409', code: answer?.error?.code ?? 'refused', ...(answer?.discussion ? { discussion: answer.discussion } : {}) }
}

export const setGoalWorkflow = (id: string, idea: string, workflow: string) =>
  request<Discussion>('PATCH', `/v1/discussions/${q(id)}/${goalDiscussions.has(id) ? 'goals' : 'ideas'}/${q(idea)}`, { workflow })

export const dropGoal = (id: string, idea: string) => request<Discussion>('DELETE', `/v1/discussions/${q(id)}/${goalDiscussions.has(id) ? 'goals' : 'ideas'}/${q(idea)}`)

/** `project` places an idea of a discussion opened in no project. */
export const startGoal = (id: string, idea: string, expectedVersion: number, project?: string) =>
  request<{ id: string; key?: string }>('POST', `/v1/discussions/${q(id)}/${goalDiscussions.has(id) ? 'goals' : 'ideas'}/${q(idea)}/start`, { expectedVersion, ...(project ? { project } : {}) })

// 旧版本类型名。
export type Idea = Goal
export type DraftIdea = DraftGoal

export { setGoalWorkflow as setIdeaWorkflow, dropGoal as dropIdea, startGoal as startIdea }
