/**
 * The public API (#2000): one route table, which openapi.json must match exactly
 * (test/v1.test.mjs). Every surface, WildCrane's own included, calls only these.
 */

import { bearerToken, verifyAccessToken } from '../auth.ts'
import { APP_URL, RUNTIME_TEST_SECONDS } from '../config.ts'
import { call, mutate } from '../db.ts'
import type { Env } from '../env.ts'
import {
  Refusal,
  artifactsUnavailable,
  badRequest,
  conflict,
  methodNotAllowed,
  notFound,
  payloadTooLarge,
  quotaExceeded,
  readOnly,
  sessionRequired,
  sharedRefusal,
  unauthenticated,
} from '../errors.ts'
import { uuid } from '../input.ts'
import { readLimits } from '../quota.ts'
import { bodyOf, json } from '../http.ts'
import openapi from '../../openapi.json' with { type: 'json' }
import { API_KEY_PREFIX, actorOf, authenticate, deprecationHeaders, idOf, idempotent, pageOf, readCapped, sha256, taskIdOf } from './http.ts'
import type { Caller } from './http.ts'
import {
  LIMITS,
  TASK_STATUSES,
  apiKeyInput,
  artifactInput,
  cardInput,
  importInput,
  chatInput,
  reviewPatch,
  commentInput,
  decisionInput,
  emailOf,
  guestInput,
  memberRoleInput,
  objectOf,
  projectInput,
  reasonInput,
  reviewedInput,
  runtimeInput,
  secretsInput,
  shareLinkInput,
  sharedDecisionInput,
  statsQuery,
  taskInput,
  taskPatch,
  TRIAGE_STATES,
  triageIdOf,
  triageInput,
  uploadInput,
  versionInput,
  workflowInput,
  workspaceInput,
} from './input.ts'
import { KEY_HIDDEN, eventSeq, openStream, poke, readEvents } from './stream.ts'
import { COMPONENT_LIMITS, artifactComponent, bundleUrl, componentInput, componentName, componentVersion, deleteVersion, putBundle, sharedComponent } from './components.ts'
import { BUILTIN_WORKFLOWS, builtinJson, builtinWorkflow, isBuiltin, workflowFor } from './workflows.ts'
import type { BuiltinWorkflow } from './workflows.ts'
import { guestInvite } from './guest-mail.ts'
import { chatCursor, discussionChatInput, discussionInput, draftInput, externalDiscussionInput, startIdea } from './discussions.ts'
import { restoreCard, settleEndings } from './endings.ts'
import { stopRun } from '../run-log.ts'
import type { Invite } from './guest-mail.ts'
import { sendMail } from '../mail.ts'
import { boardFor, boardOf, projectRoot, workspaceOfProject } from '../board.ts'
import { sortTriage } from '../triage-sort.ts'
import { cardItem, createItem, dismissItem, heldIn, itemCreator, listTriage as listTriageItems, markLearned, openItem, restoreItem, unlearnedIn } from '../triage.ts'
import type { NewItem } from '../triage.ts'
import { ofTriageId } from '../triage-files.ts'
import { listAgents, previewNamesOf, runAgent, updateAgent, updateWorkflowRule } from './agents.ts'
import { readTaskDiff } from '../diff.ts'
import {
  commitBoard,
  importBoard,
  moveCards,
  placeWorkflow,
  readBoard,
  readCard,
  readTaskWorkflow,
  saveCard,
  sinceOf,
  writeAssets,
} from './board.ts'

interface Call {
  env: Env
  ctx: ExecutionContext
  request: Request
  url: URL
  caller: Caller
  /** The path's `{…}` values, in order. */
  params: string[]
}

type Handler = (c: Call) => Promise<Response>

const page = (c: Call, prefix?: string) => ({ p_account: c.caller.accountId, ...pageOf(c.url.searchParams, prefix) })

/** `?workspace=`: which workspace a list reads; the caller's personal one when absent. */
const workspaceParam = (c: Call) => {
  const held = c.url.searchParams.get('workspace')
  return held ? idOf(held, 'ws', 'workspace') : null
}

/** The plan a workspace's usage counts against: its creator's. */
const limitsFor = async (c: Call, kind: string, id: string | null) =>
  readLimits(c.env, await call<string>(c.env, 'v1_payer', { p_account: c.caller.accountId, p_kind: kind, p_id: id }))

const read = async (c: Call, fn: string, args: Record<string, unknown>) =>
  json(await call(c.env, fn, { p_account: c.caller.accountId, ...args }))

/** A change: written, then the open streams of everyone it may concern told, and any task it
 *  ended handed on (#2064). */
async function write(c: Call, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const done = await mutate(c.env, fn, { p_account: c.caller.accountId, ...args })
  poke(c.env, c.ctx, c.caller.accountId)
  c.ctx.waitUntil(settleEndings(c.env))
  return done
}

const change = async (c: Call, fn: string, args: Record<string, unknown>) => json(await write(c, fn, args))

/** A chat's reply (#2133) or a task's run (#2128) stopped: a running one's Runner is told over its log. */
async function stopJob(c: Call, fn: string, args: Record<string, unknown>): Promise<Response> {
  const { job, stop, result } = (await write(c, fn, args)) as { job?: string | null; stop?: string[]; result: unknown }
  for (const held of [job, ...(stop ?? [])]) if (held) c.ctx.waitUntil(stopRun(c.env, held))
  return json(result)
}

/** A create: `201`, replayed under an `Idempotency-Key`. */
async function create(c: Call, fn: string, args: (body: Record<string, unknown>) => Record<string, unknown>) {
  const body = await bodyOf(c.request)
  const fields = args(objectOf(body))
  return idempotent(c.env, c.caller, c.request, body, async () => ({ status: 201, body: await write(c, fn, fields) }))
}

const id = (c: Call, prefix: string, what: string, at = 0) => idOf(c.params[at], prefix, what)

const taskId = (c: Call, value: unknown = c.params[0]) => taskIdOf(c.env, c.caller.accountId, value)

function requireSession(c: Call) {
  if (c.caller.key) throw sessionRequired()
}

function requireOwnWorkflow(c: Call): string {
  const wf = id(c, 'wf', 'workflow')
  if (isBuiltin(wf)) throw builtinWorkflow(wf) ? readOnly() : notFound('No workflow has this id.')
  return wf
}

/** The version number each built-in's current files have, or will have once first used. */
async function builtinVersions(c: Call, list: BuiltinWorkflow[]): Promise<Record<string, number>> {
  if (list.length === 0) return {}
  return call(c.env, 'v1_builtin_versions', { p_builtins: list.map(({ id, hash }) => ({ id, hash })) })
}

const secret = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function createApiKey(c: Call): Promise<Response> {
  requireSession(c)
  const { name } = apiKeyInput(objectOf((await bodyOf(c.request)) ?? {}))
  const key = API_KEY_PREFIX + secret()
  const row = await mutate<Record<string, unknown>>(c.env, 'v1_create_api_key', {
    p_account: c.caller.accountId,
    p_name: name,
    p_prefix: key.slice(0, 12),
    p_hash: await sha256(key),
  })
  return json({ ...row, key }, 201)
}

const workspaceId = (c: Call) => id(c, 'ws', 'workspace')

/** Its files leave R2 before its rows, so a failed delete is retried, never orphaned. */
async function deleteWorkspace(c: Call): Promise<Response> {
  const workspace = workspaceId(c)
  const held = await call<{ files: string[]; multipart: { key: string; id: string }[] }>(c.env, 'v1_workspace_files', {
    p_account: c.caller.accountId,
    p_id: workspace,
  })
  const bucket = c.env.ARTIFACTS
  if (bucket) {
    for (let at = 0; at < held.files.length; at += 1000) await bucket.delete(held.files.slice(at, at + 1000))
    await Promise.all(held.multipart.map((m) => bucket.resumeMultipartUpload(m.key, m.id).abort().catch(() => {})))
  } else if (held.files.length > 0 || held.multipart.length > 0) {
    throw artifactsUnavailable()
  }
  const done = await change(c, 'v1_delete_workspace', { p_id: workspace })
  await boardOf(c.env, workspace).destroy().catch((e) => console.error('cloud: board not destroyed', workspace, e))
  return done
}

/** Its open triage items are counted from its board. */
async function readProject(c: Call): Promise<Response> {
  const project = id(c, 'prj', 'project')
  const read = await call<{ workspace: string; counts: Record<string, number> }>(c.env, 'v1_project', { p_account: c.caller.accountId, p_id: project })
  const triage = (await heldIn(boardOf(c.env, read.workspace), project)).filter((h) => h.state === 'open').length
  return json({ ...read, counts: { ...read.counts, triage } })
}

/** Its tasks go with it, their runs stopped, then its files. */
async function deleteProject(c: Call): Promise<Response> {
  const project = id(c, 'prj', 'project')
  const workspace = await workspaceOfProject(c.env, project)
  const { stop, ...done } = await write(c, 'v1_delete_project', { p_id: project }) as { stop: string[]; [key: string]: unknown }
  for (const job of stop) c.ctx.waitUntil(stopRun(c.env, job))
  await boardOf(c.env, workspace).drop(projectRoot(project))
  return json(done)
}

/** A task moved to another project takes its card along. */
async function updateTask(c: Call): Promise<Response> {
  const fields = taskPatch(objectOf(await bodyOf(c.request)))
  const task = await taskId(c)
  const before = fields.project ? await call<{ project: string; path: string | null }>(c.env, 'v1_card', {
    p_account: c.caller.accountId, p_task: task,
  }).catch(() => null) : null
  const done = await write(c, 'v1_update_task', { p_id: task, p_fields: fields }) as { project: string; key: string }
  if (before?.path && before.project !== done.project) {
    const number = Number(/-(\d+)$/.exec(done.key)?.[1])
    await moveCards(c.env, c.caller.accountId, before.project, done.project, [{ task, path: before.path, number }])
  }
  return json(done)
}

const memberOf = (c: Call) => uuid(c.params[1], 'member')

const installedIn = (c: Call, workspace: string | null) =>
  call<string[]>(c.env, 'v1_installed_workflows', { p_account: c.caller.accountId, p_workspace: workspace })

/** The workspace's installed built-ins first, then its own. */
async function listWorkflows(c: Call): Promise<Response> {
  const args = { ...page(c, 'wf'), p_workspace: workspaceParam(c) }
  const own = await call<{ data: unknown[]; next: string | null }>(c.env, 'v1_list_workflows', args)
  const installed = args.p_after ? [] : await installedIn(c, args.p_workspace)
  const listed = BUILTIN_WORKFLOWS.filter((w) => installed.includes(w.id))
  const versions = await builtinVersions(c, listed)
  return json({ data: [...listed.map((w) => builtinJson(w, versions[w.id] ?? 1)), ...own.data], next: own.next })
}

/** Every official workflow, each saying whether the workspace has it installed (#2030). */
async function listMarketplace(c: Call): Promise<Response> {
  const installed = await installedIn(c, workspaceParam(c))
  const versions = await builtinVersions(c, BUILTIN_WORKFLOWS)
  return json({
    data: BUILTIN_WORKFLOWS.map((w) => ({ ...builtinJson(w, versions[w.id] ?? 1), installed: installed.includes(w.id) })),
    next: null,
  })
}

/** Install or uninstall one for a workspace, `{ workspace }` or the personal one: owners only. */
async function setInstalled(c: Call, installed: boolean): Promise<Response> {
  const builtin = builtinWorkflow(id(c, 'wf', 'workflow'))
  if (!builtin) throw notFound('No workflow has this id.')
  const body = await bodyOf(c.request)
  const held = body === null ? null : objectOf(body).workspace
  const workspace = held === undefined || held === null ? null : idOf(held, 'ws', 'workspace')
  const done = await write(c, 'v1_install_workflow', {
    p_workspace: workspace,
    p_workflow: builtin.id,
    p_installed: installed,
  }) as { workspace: string; installed: boolean }
  const versions = await builtinVersions(c, [builtin])
  return json({ ...builtinJson(builtin, versions[builtin.id] ?? 1), installed: done.installed })
}

async function getWorkflow(c: Call): Promise<Response> {
  const wf = id(c, 'wf', 'workflow')
  const builtin = builtinWorkflow(wf)
  if (builtin) return json({ ...builtinJson(builtin, (await builtinVersions(c, [builtin]))[wf] ?? 1), files: builtin.files })
  if (isBuiltin(wf)) throw notFound('No workflow has this id.')
  return read(c, 'v1_workflow', { p_id: wf })
}

async function createTask(c: Call): Promise<Response> {
  const body = await bodyOf(c.request)
  const { fields: held, workflow } = taskInput(objectOf(body))
  // A task made of a triage item (#2107) goes to its project; the item moves once it is made.
  const { triage, ...fields } = held as Record<string, unknown> & { triage?: string }
  const item = triage ? ofTriageId(triage)! : null
  if (item) fields.project ??= item.project
  const definition = workflowFor(workflow)
  const changes = (fields.context as { workflow?: string } | undefined)?.workflow
  if (changes && isBuiltin(changes)) throw builtinWorkflow(changes) ? readOnly() : notFound('No workflow has this id.')
  return idempotent(c.env, c.caller, c.request, body, async () => {
    if (item) {
      const open = await openItem(c.env, triage!)
      if (await workspaceOfProject(c.env, fields.project as string) !== await workspaceOfProject(c.env, item.project)) {
        throw notFound('No triage item has this id.')
      }
      fields.source_context = { ...(fields.source_context as object | undefined), ...itemCreator(open.fields) }
    }
    const task = await write(c, 'v1_create_task', { p_fields: fields, p_workflow: definition }) as { id: string; key: string }
    if (triage) await cardItem(c.env, c.ctx, triage, task)
    await placeWorkflow(c.env, c.caller.accountId, task.id)
    return { status: 201, body: task }
  })
}

const discussionId = (c: Call) => id(c, 'dsc', 'discussion')
const ideaId = (c: Call) => id(c, 'idea', 'idea', 1)

/** `{ machine? }`: the computer a task runs on (#2196), one of the caller's or one shared with them. */
const machineOf = (body: unknown) => {
  const held = body === null ? {} : objectOf(body)
  return held.machine == null ? null : uuid(held.machine, 'machine')
}

/** `{ project?, expectedVersion?, machine? }`: the task goes there, else into the discussion's project. */
async function startIdeaRoute(c: Call): Promise<Response> {
  const body = await bodyOf(c.request)
  const held = body === null ? {} : objectOf(body)
  const project = held.project == null ? null : idOf(held.project, 'prj', 'project')
  const machine = machineOf(body)
  if (held.expectedVersion != null && !Number.isInteger(held.expectedVersion)) throw badRequest('expectedVersion must be an integer.')
  const version = (held.expectedVersion as number | undefined) ?? null
  if (held.skip_plan != null && typeof held.skip_plan !== 'boolean') throw badRequest('skip_plan must be a boolean.')
  const skipPlan = held.skip_plan === true
  return idempotent(c.env, c.caller, c.request, body, async () => {
    const task = await startIdea(c.env, c.caller.accountId, discussionId(c), ideaId(c), project, version, skipPlan, machine)
    poke(c.env, c.ctx, c.caller.accountId)
    return { status: 201, body: task }
  })
}

/** A refused save answers the discussion as it stands, to read again and merge into. */
async function saveDraftRoute(c: Call): Promise<Response> {
  const fields = draftInput(objectOf(await bodyOf(c.request)))
  const done = (await write(c, 'v1_save_draft', { p_id: discussionId(c), ...fields })) as { saved: boolean; discussion: unknown }
  if (done.saved) return json(done.discussion)
  return json({ error: { code: 'version_conflict', message: 'The ideas changed since they were read.' }, discussion: done.discussion }, 409)
}

const runtimeId = (c: Call) => id(c, 'rt', 'runtime')

const TEST_PROMPT = 'Reply with OK and nothing else.'
/** The Runner gives up at RUNTIME_TEST_SECONDS; this waits a little longer for its report. */
const TEST_WAIT_MS = (RUNTIME_TEST_SECONDS + 10) * 1000
const TEST_POLL_MS = 2000
const TEST_RESULTS = ['not_installed', 'signed_out', 'timeout']

interface TestEnd {
  outcome: 'done' | 'failed'
  reason: string | null
  elapsed_ms: number | null
}

/** A test's or a key job's end, once the Runner has reported or the wait ran out. */
async function waitForJob(c: Call, job: string): Promise<TestEnd> {
  const deadline = Date.now() + TEST_WAIT_MS
  let end: TestEnd | null = null
  while (!end) {
    await new Promise((r) => setTimeout(r, TEST_POLL_MS))
    end = await call<TestEnd | null>(c.env, 'v1_runtime_test', {
      p_account: c.caller.accountId,
      p_job: job,
      p_limit_seconds: Date.now() >= deadline ? 0 : TEST_WAIT_MS / 1000,
    })
  }
  return end
}

/** One short prompt on the runtime's Runner; answers once it has reported, or timed out. */
async function testRuntime(c: Call): Promise<Response> {
  const runtime = runtimeId(c)
  const started = await mutate<{ job: string; connector: string; model: string | null }>(c.env, 'v1_test_runtime', {
    p_account: c.caller.accountId,
    p_id: runtime,
    p_prompt: TEST_PROMPT,
  })
  const end = await waitForJob(c, started.job)
  const result = end.outcome === 'done' ? 'passed' : TEST_RESULTS.includes(end.reason ?? '') ? end.reason : 'failed'
  return json({
    object: 'runtime_test',
    runtime,
    connector: started.connector,
    model: started.model,
    result,
    elapsed_ms: result === 'timeout' ? RUNTIME_TEST_SECONDS * 1000 : end.elapsed_ms,
    message: result === 'failed' ? end.reason : null,
  })
}

/** Keys go to the runtime's Runner in a job of their own and never into the runtime (#2135). */
async function keepSecrets(c: Call, runtime: string, secrets: Record<string, string | null>): Promise<void> {
  const { job } = await write(c, 'v1_set_runtime_secrets', { p_id: runtime, p_secrets: secrets }) as { job: string }
  const end = await waitForJob(c, job)
  if (end.outcome !== 'done') throw sharedRefusal('runner_offline')
}

async function createRuntime(c: Call): Promise<Response> {
  const body = objectOf(await bodyOf(c.request))
  const secrets = secretsInput(body)
  const made = await write(c, 'v1_create_runtime', { p_fields: runtimeInput(body) }) as { id: string }
  if (!secrets) return json(made, 201)
  await keepSecrets(c, made.id, secrets)
  return json(await runtimeOf(c, made.id), 201)
}

async function updateRuntime(c: Call): Promise<Response> {
  const body = objectOf(await bodyOf(c.request))
  const runtime = runtimeId(c)
  const secrets = secretsInput(body)
  const { secrets: _, ...rest } = body
  if (!secrets || Object.keys(rest).length) {
    const changed = await write(c, 'v1_update_runtime', { p_id: runtime, p_fields: runtimeInput(rest, true) })
    if (!secrets) return json(changed)
  }
  await keepSecrets(c, runtime, secrets)
  return json(await runtimeOf(c, runtime))
}

const runtimeOf = async (c: Call, runtime: string) =>
  ((await call<{ data: { id: string }[] }>(c.env, 'v1_list_runtimes', { p_account: c.caller.accountId })).data ?? [])
    .find((r) => r.id === runtime)

function listTriage(c: Call): Promise<Response> {
  const project = c.url.searchParams.get('project')
  const states = c.url.searchParams.get('state')?.split(',').filter(Boolean) ?? []
  if (states.some((s) => !(TRIAGE_STATES as readonly string[]).includes(s))) throw badRequest('That is not a triage state.')
  const order = c.url.searchParams.get('order') ?? 'asc'
  if (order !== 'asc' && order !== 'desc') throw badRequest('order must be asc or desc.')
  const { p_after, p_limit } = pageOf(c.url.searchParams)
  return listTriageItems(c.env, c.caller.accountId, {
    workspace: workspaceParam(c),
    project: project ? idOf(project, 'prj', 'project') : null,
    states,
    desc: order === 'desc',
    after: p_after,
    limit: p_limit,
  }).then((page) => json(page))
}

const triageId = (c: Call) => triageIdOf(c.params[0])

/** A new item is judged off the response (#2124); one already kept is answered as it is. */
async function createTriage(c: Call): Promise<Response> {
  const body = await bodyOf(c.request)
  const fields = triageInput(objectOf(body)) as unknown as NewItem
  return idempotent(c.env, c.caller, c.request, body, async () => {
    const { item, created } = await createItem(c.env, c.ctx, c.caller.accountId, fields)
    if (created) c.ctx.waitUntil(sortTriage(c.env, item.id, c.ctx))
    return { status: 201, body: item }
  })
}

/** What the review has not learned: rejected tasks in Postgres, dismissals on the board. */
async function listRejections(c: Call): Promise<Response> {
  const done = await call<{ workspace: string; tasks: unknown[] }>(c.env, 'v1_list_rejections', {
    p_account: c.caller.accountId,
    p_workspace: workspaceParam(c),
  })
  return json({ ...done, triage: await unlearnedIn(c.env, done.workspace) })
}

async function rejectionsReviewed(c: Call): Promise<Response> {
  const { p_tasks, p_triage } = reviewedInput(objectOf(await bodyOf(c.request)))
  const tasks = await write(c, 'v1_rejections_reviewed', { p_tasks }) as number
  return json({ tasks, triage: await markLearned(c.env, c.caller.accountId, p_triage) })
}

/** An empty body is no reason. */
async function reasonOf(c: Call): Promise<string | null> {
  const body = await bodyOf(c.request)
  return body === null ? null : reasonInput(objectOf(body))
}

async function cancelTask(c: Call): Promise<Response> {
  return stopJob(c, 'v1_cancel_task', { p_id: await taskId(c), p_reason: await reasonOf(c) })
}

/** A removed task back (#94), its card with it. */
async function restoreTask(c: Call): Promise<Response> {
  const task = await taskId(c)
  const done = await write(c, 'v1_restore_task', { p_id: task })
  await restoreCard(c.env, task)
  return json(done)
}

function listTasks(c: Call): Promise<Response> {
  const project = c.url.searchParams.get('project')
  const status = c.url.searchParams.get('status')
  if (status && !(TASK_STATUSES as readonly string[]).includes(status)) throw badRequest('That is not a task status.')
  return read(c, 'v1_list_tasks', {
    ...pageOf(c.url.searchParams, 'task'),
    p_workspace: workspaceParam(c),
    p_project: project ? idOf(project, 'prj', 'project') : null,
    p_status: status || null,
  })
}

/** `pin: true` is a component's save (#2006): an owner's, inline, and the card's pins move with it. */
async function createVersion(c: Call): Promise<Response> {
  const body = await bodyOf(c.request)
  const held = objectOf(body)
  const { p_content, p_upload } = versionInput(held)
  const artifact = id(c, 'art', 'artifact')
  if (held.pin !== undefined && typeof held.pin !== 'boolean') throw badRequest('pin must be true or false.')
  if (held.pin && p_upload) throw badRequest('A pinned version is inline content.')
  return idempotent(c.env, c.caller, c.request, body, async () => ({
    status: 201,
    body: held.pin ? await savePinned(c, artifact, p_content) : await write(c, 'v1_create_artifact_version', { p_artifact: artifact, p_content, p_upload }),
  }))
}

async function savePinned(c: Call, artifact: string, content: unknown): Promise<unknown> {
  const version = await write(c, 'v1_save_artifact_version', { p_artifact: artifact, p_content: content })
  const { task } = await call<{ task: string }>(c.env, 'v1_artifact', { p_account: c.caller.accountId, p_id: artifact })
  await writeAssets(c.env, c.caller.accountId, task)
  return version
}

const versionOf = (c: Call) => {
  const n = Number(c.params[1])
  if (!Number.isInteger(n) || n < 1) throw badRequest('That is not a version number.')
  return n
}

async function getVersion(c: Call): Promise<Response> {
  const { stored: _stored, ...version } = await call<Record<string, unknown>>(c.env, 'v1_artifact_version', {
    p_account: c.caller.accountId,
    p_artifact: id(c, 'art', 'artifact'),
    p_version: versionOf(c),
  })
  return json(version)
}

async function getVersionFile(c: Call): Promise<Response> {
  const bucket = c.env.ARTIFACTS
  if (!bucket) throw artifactsUnavailable()
  const { stored } = await call<{ stored: { key: string; content_type: string } | null }>(c.env, 'v1_artifact_version', {
    p_account: c.caller.accountId,
    p_artifact: id(c, 'art', 'artifact'),
    p_version: versionOf(c),
  })
  if (!stored) throw notFound('This version has no file.')
  const object = await bucket.get(stored.key)
  if (!object) throw notFound('This version has no file.')
  return new Response(object.body, {
    headers: { 'content-type': stored.content_type, 'content-length': String(object.size) },
  })
}

/**
 * An upload declaring a size above one part is sent in parts of `part_size`, all full but the
 * last, then completed. Either way the plan's file and storage limits are checked as it is
 * created and again as it finishes.
 */
async function createUpload(c: Call): Promise<Response> {
  const bucket = c.env.ARTIFACTS
  if (!bucket) throw artifactsUnavailable()
  const { type, size } = uploadInput(objectOf((await bodyOf(c.request)) ?? {}))
  const artifact = id(c, 'art', 'artifact')
  const limits = await limitsFor(c, 'artifact', artifact)
  if (size !== null && size > limits.file) throw quotaExceeded('file_size', limits.file)
  const args = { p_account: c.caller.accountId, p_artifact: artifact, p_content_type: type, p_size: size, p_storage_limit: limits.storage }
  if (size === null || size <= LIMITS.part) {
    const upload = await mutate<Record<string, unknown>>(c.env, 'v1_create_upload', args)
    return json({ ...upload, max_size: Math.min(limits.file, LIMITS.part) }, 201)
  }
  const key = await call<{ id: string; key: string }>(c.env, 'v1_new_upload_key', { p_account: c.caller.accountId, p_artifact: artifact })
  const multipart = await bucket.createMultipartUpload(key.key, { httpMetadata: { contentType: type } })
  let upload: Record<string, unknown>
  try {
    upload = await mutate(c.env, 'v1_create_upload', { ...args, p_id: key.id, p_multipart_id: multipart.uploadId })
  } catch (error) {
    await multipart.abort().catch(() => {})
    throw error
  }
  const count = Math.ceil(size / LIMITS.part)
  return json({
    ...upload,
    method: 'POST',
    url: `/v1/uploads/${key.id}/complete`,
    max_size: limits.file,
    parts: { count, size: LIMITS.part, url: `/v1/uploads/${key.id}/parts/{part}` },
  }, 201)
}

interface UploadTarget {
  key: string
  content_type: string
  size: number | null
  multipart_id: string | null
  parts: { part: number; etag: string }[]
  room: number | null
}

async function targetOf(c: Call, upload: string, storage: number): Promise<UploadTarget> {
  const target = await call<UploadTarget | null>(c.env, 'v1_upload_target', {
    p_account: c.caller.accountId,
    p_upload: upload,
    p_storage_limit: storage,
  })
  if (!target) throw notFound('No upload is waiting under this id.')
  return target
}

/** Read at most `max` bytes, refused as the quota the cap came from. */
async function readBody(c: Call, max: number, quota: () => Error): Promise<Uint8Array> {
  if (Number(c.request.headers.get('content-length') ?? 0) > max) throw quota()
  return readCapped(c.request, max, quota)
}

async function putUpload(c: Call): Promise<Response> {
  const bucket = c.env.ARTIFACTS
  if (!bucket) throw artifactsUnavailable()
  const upload = id(c, 'upl', 'upload')
  const limits = await limitsFor(c, 'upload', upload)
  const target = await targetOf(c, upload, limits.storage)
  if (target.multipart_id) throw conflict('This upload is sent in parts.')
  const single = Math.min(limits.file, LIMITS.part)
  const room = Math.max(0, target.room ?? Infinity)
  const bytes = await readBody(c, Math.min(single, room), () =>
    room < single ? quotaExceeded('storage', limits.storage)
    : single < limits.file ? payloadTooLarge(`A single PUT takes ${LIMITS.part / 1024 / 1024} MB; declare the size to send it in parts.`)
    : quotaExceeded('file_size', limits.file))
  await bucket.put(target.key, bytes, { httpMetadata: { contentType: target.content_type } })
  return json(await finishUpload(c, upload, target.key, bytes.length, limits.storage))
}

/** Record the file, or take it back out of R2 when the plan filled up meanwhile. */
async function finishUpload(c: Call, upload: string, key: string, size: number, storage: number) {
  try {
    return await mutate(c.env, 'v1_finish_upload', { p_account: c.caller.accountId, p_upload: upload, p_size: size, p_storage_limit: storage })
  } catch (error) {
    if (error instanceof Refusal && error.code === 'quota_exceeded') await c.env.ARTIFACTS!.delete(key)
    throw error
  }
}

const partOf = (c: Call, target: UploadTarget) => {
  const n = Number(c.params[1])
  const count = Math.ceil((target.size ?? 0) / LIMITS.part)
  if (!Number.isInteger(n) || n < 1 || n > count) throw badRequest(`part must be a whole number from 1 to ${count}.`)
  return { n, size: n < count ? LIMITS.part : target.size! - (count - 1) * LIMITS.part }
}

async function putUploadPart(c: Call): Promise<Response> {
  const bucket = c.env.ARTIFACTS
  if (!bucket) throw artifactsUnavailable()
  const upload = id(c, 'upl', 'upload')
  const target = await targetOf(c, upload, (await limitsFor(c, 'upload', upload)).storage)
  if (!target.multipart_id) throw conflict('This upload is sent whole, with PUT /v1/uploads/{id}.')
  const part = partOf(c, target)
  const bytes = await readBody(c, part.size, () => payloadTooLarge(`Part ${part.n} is ${part.size} bytes.`))
  if (bytes.length !== part.size) throw badRequest(`Part ${part.n} is ${part.size} bytes.`)
  const sent = await bucket.resumeMultipartUpload(target.key, target.multipart_id).uploadPart(part.n, bytes)
  return json(await mutate(c.env, 'v1_add_upload_part', {
    p_account: c.caller.accountId,
    p_upload: upload,
    p_part: sent.partNumber,
    p_etag: sent.etag,
  }))
}

async function completeUpload(c: Call): Promise<Response> {
  const bucket = c.env.ARTIFACTS
  if (!bucket) throw artifactsUnavailable()
  const upload = id(c, 'upl', 'upload')
  const limits = await limitsFor(c, 'upload', upload)
  const target = await targetOf(c, upload, limits.storage)
  if (!target.multipart_id) throw conflict('This upload is sent whole, with PUT /v1/uploads/{id}.')
  const count = Math.ceil((target.size ?? 0) / LIMITS.part)
  const missing = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !target.parts.some((p) => p.part === n))
  if (missing.length > 0) throw conflict(`Parts ${missing.join(', ')} have not arrived.`)
  await bucket
    .resumeMultipartUpload(target.key, target.multipart_id)
    .complete(target.parts.map((p) => ({ partNumber: p.part, etag: p.etag })))
  return json(await finishUpload(c, upload, target.key, target.size!, limits.storage))
}

function listAlerts(c: Call): Promise<Response> {
  const channel = c.url.searchParams.get('channel')
  if (channel && channel !== 'desktop' && channel !== 'web') throw badRequest('channel must be desktop or web.')
  return read(c, 'v1_list_alerts', { ...pageOf(c.url.searchParams, 'alr'), p_channel: channel || null })
}

const hiddenFor = (c: Call) => (c.caller.key ? KEY_HIDDEN : [])

async function listEvents(c: Call): Promise<Response> {
  const { p_limit } = pageOf(c.url.searchParams)
  return json(await readEvents(c.env, c.caller.accountId, eventSeq(c.url.searchParams.get('after')), p_limit, hiddenFor(c)))
}

/** The token is shown once, here; the database keeps only its hash. Never replayed. */
async function createShareLink(c: Call): Promise<Response> {
  const fields = shareLinkInput(objectOf(await bodyOf(c.request)))
  const token = secret()
  const task = await taskId(c)
  const link = await write(c, 'v1_create_share_link', {
    p_task: task,
    p_fields: fields,
    p_hash: await sha256(token),
  }) as Record<string, unknown>
  return json({ ...link, url: `${appSite(c.env)}/s/${token}` }, 201)
}

const appSite = (env: Env) => (env.APP_URL || APP_URL).replace(/\/+$/, '')

/** A guest new to the task is emailed the link the owner is sharing, there and then; a failed
 *  send is reported, not retried. */
async function addGuest(c: Call): Promise<Response> {
  const email = emailOf(c.params[1])
  const body = await bodyOf(c.request)
  const { share_token, lang } = guestInput(body === null ? {} : objectOf(body))
  const done = await write(c, 'v1_add_guest', {
    p_task: await taskId(c),
    p_email: email,
    p_share_hash: share_token ? await sha256(share_token) : null,
  }) as { guest: Record<string, unknown>; invite: Invite | null }
  if (!done.invite || !share_token) return json({ ...done.guest, mail: null })
  const site = appSite(c.env)
  try {
    await sendMail(c.env, guestInvite(email, done.invite, `${site}/s/${share_token}`, site, lang))
    return json({ ...done.guest, mail: 'sent' })
  } catch (e) {
    console.error('cloud: guest invite not sent', { task: done.guest.task, error: e instanceof Error ? e.message : String(e) })
    return json({ ...done.guest, mail: 'failed' })
  }
}

/** A version to publish, and where its bundle goes next. */
async function createComponent(c: Call): Promise<Response> {
  const fields = componentInput(objectOf(await bodyOf(c.request)))
  const made = await mutate<Record<string, unknown>>(c.env, 'v1_create_component', { p_account: c.caller.accountId, ...fields })
  const upload = { method: 'PUT', url: bundleUrl(fields.p_name, fields.p_version), content_type: 'application/x-tar', max_size: COMPONENT_LIMITS.bundle }
  return json({ ...made, upload }, 201)
}

/** Who opened a share link: a sign-in, or nobody. Admission and API keys play no part. */
interface Reviewer {
  p_subject: string | null
  p_email: string | null
}

interface SharedCall {
  env: Env
  ctx: ExecutionContext
  request: Request
  token: string
  reviewer: Reviewer
  params: string[]
}

type SharedHandler = (c: SharedCall) => Promise<Response>

async function reviewerOf(request: Request, env: Env): Promise<Reviewer> {
  if (!request.headers.get('authorization')) return { p_subject: null, p_email: null }
  const token = bearerToken(request)
  if (token.startsWith(API_KEY_PREFIX)) throw unauthenticated('Sign in to open a review; an API key cannot.')
  const identity = await verifyAccessToken(token, env.SUPABASE_URL)
  return { p_subject: identity.subject, p_email: identity.email?.toLowerCase() ?? null }
}

const SHARE_TOKEN = /^[\w-]{20,128}$/

const shared = async (c: SharedCall) => ({ p_hash: await sha256(c.token), ...c.reviewer })

const sharedFileUrl = (token: string, artifact: string, version: number) =>
  `/v1/shared/${token}/artifacts/${artifact}/versions/${version}/file`

interface SharedArtifact {
  id: string
  versions: { version: number; file: Record<string, unknown> | null }[]
}

async function getShared(c: SharedCall): Promise<Response> {
  const review = await call<{ artifacts: SharedArtifact[]; card: Record<string, unknown> | null; names?: Record<string, unknown> }>(c.env, 'v1_shared', await shared(c))
  review.names = {}
  if (review.card) {
    const { project, path, ...card } = review.card as { project: string; path: string }
    const [row] = await (await boardFor(c.env, project)).read([path])
    const body = row?.content ?? ''
    review.card = { ...card, body }
    review.names = await previewNamesOf(c.env, project, body)
  }
  for (const artifact of review.artifacts) {
    for (const v of artifact.versions) if (v.file) v.file.url = sharedFileUrl(c.token, artifact.id, v.version)
  }
  return json(review)
}

async function getSharedFile(c: SharedCall): Promise<Response> {
  const bucket = c.env.ARTIFACTS
  if (!bucket) throw artifactsUnavailable()
  const n = Number(c.params[2])
  if (!Number.isInteger(n) || n < 1) throw badRequest('That is not a version number.')
  const { stored } = await call<{ stored: { key: string; content_type: string } | null }>(c.env, 'v1_shared_file', {
    ...(await shared(c)),
    p_artifact: idOf(c.params[1], 'art', 'artifact'),
    p_version: n,
  })
  const object = stored && (await bucket.get(stored.key))
  if (!stored || !object) throw notFound('This version has no file.')
  return new Response(object.body, {
    headers: { 'content-type': stored.content_type, 'content-length': String(object.size), 'cache-control': 'private, no-store' },
  })
}

/** A write through a link, then the workspace's open streams told. */
async function sharedWrite(c: SharedCall, fn: string, args: Record<string, unknown>, status = 201): Promise<Response> {
  const done = await mutate<{ workspace: string; job?: string | null; result: unknown }>(c.env, fn, { ...(await shared(c)), ...args })
  poke(c.env, c.ctx, null, done.workspace)
  c.ctx.waitUntil(settleEndings(c.env))
  if (done.job) c.ctx.waitUntil(stopRun(c.env, done.job))
  return json(done.result, status)
}

export const SHARED_ROUTES: [string, string, SharedHandler][] = [
  ['GET', '/v1/shared/{token}', getShared],
  ['GET', '/v1/shared/{token}/artifacts/{id}/versions/{version}/file', getSharedFile],
  ['POST', '/v1/shared/{token}/comments', async (c) =>
    sharedWrite(c, 'v1_shared_comment', { p_body: commentInput(objectOf(await bodyOf(c.request))) })],
  ['POST', '/v1/shared/{token}/decisions', async (c) =>
    sharedWrite(c, 'v1_shared_decide', sharedDecisionInput(objectOf(await bodyOf(c.request))))],
  ['GET', '/v1/shared/{token}/chat', async (c) => json(await call(c.env, 'v1_shared_chat', await shared(c)))],
  ['POST', '/v1/shared/{token}/chat', async (c) =>
    sharedWrite(c, 'v1_shared_chat_send', chatInput(objectOf(await bodyOf(c.request))))],
  ['DELETE', '/v1/shared/{token}/chat', (c) => sharedWrite(c, 'v1_shared_chat_clear', {}, 200)],
  ['POST', '/v1/shared/{token}/chat/stop', (c) => sharedWrite(c, 'v1_shared_chat_stop', {}, 200)],
  ['GET', '/v1/shared/{token}/components/{name}/{version}', async (c) =>
    json(await sharedComponent(c.env, await shared(c), c.params[1]!, c.params[2]!))],
]

export const ROUTES: [string, string, Handler][] = [
  ['GET', '/v1/workspaces', (c) => read(c, 'v1_list_workspaces', pageOf(c.url.searchParams, 'ws'))],
  ['POST', '/v1/workspaces', (c) => create(c, 'v1_create_workspace', (b) => ({ p_fields: workspaceInput(b) }))],
  ['GET', '/v1/workspaces/{id}', (c) => read(c, 'v1_workspace', { p_id: workspaceId(c) })],
  ['PATCH', '/v1/workspaces/{id}', async (c) =>
    change(c, 'v1_update_workspace', { p_id: workspaceId(c), p_fields: workspaceInput(objectOf(await bodyOf(c.request))) })],
  ['DELETE', '/v1/workspaces/{id}', deleteWorkspace],
  ['GET', '/v1/workspaces/{id}/stats', (c) =>
    read(c, 'v1_workspace_stats', { p_workspace: workspaceId(c), ...statsQuery(c.url.searchParams) })],
  ['GET', '/v1/workspaces/{id}/members', (c) => read(c, 'v1_list_members', { p_workspace: workspaceId(c) })],
  ['POST', '/v1/workspaces/{id}/members', async (c) => {
    const email = emailOf(objectOf(await bodyOf(c.request)).email)
    return json(await write(c, 'v1_add_member', { p_workspace: workspaceId(c), p_email: email }), 201)
  }],
  ['PATCH', '/v1/workspaces/{id}/members/{account}', async (c) =>
    change(c, 'v1_update_member', {
      p_workspace: workspaceId(c),
      p_member: memberOf(c),
      p_role: memberRoleInput(objectOf(await bodyOf(c.request))),
    })],
  ['DELETE', '/v1/workspaces/{id}/members/{account}', (c) =>
    change(c, 'v1_remove_member', { p_workspace: workspaceId(c), p_member: memberOf(c) })],
  ['GET', '/v1/workspaces/{id}/runners', (c) => read(c, 'v1_list_workspace_runners', { p_workspace: workspaceId(c) })],
  ['DELETE', '/v1/workspaces/{id}/runners/{machine}', (c) =>
    stopJob(c, 'v1_remove_workspace_runner', { p_workspace: workspaceId(c), p_machine: uuid(c.params[1], 'machine') })],
  // Sharing a computer with the workspace's members (#2196); ending it stops their runs there.
  ['PUT', '/v1/workspaces/{id}/runners/{machine}/share', (c) =>
    stopJob(c, 'v1_share_runner', { p_workspace: workspaceId(c), p_machine: uuid(c.params[1], 'machine'), p_shared: true })],
  ['DELETE', '/v1/workspaces/{id}/runners/{machine}/share', (c) =>
    stopJob(c, 'v1_share_runner', { p_workspace: workspaceId(c), p_machine: uuid(c.params[1], 'machine'), p_shared: false })],

  ['PUT', '/v1/language', async (c) => {
    const { lang } = objectOf(await bodyOf(c.request))
    if (lang !== 'en' && lang !== 'zh') throw badRequest('lang must be en or zh.')
    return json(await mutate(c.env, 'v1_set_language', { p_account: c.caller.accountId, p_lang: lang }))
  }],

  ['GET', '/v1/api-keys', (c) => read(c, 'v1_list_api_keys', pageOf(c.url.searchParams, 'key'))],
  ['POST', '/v1/api-keys', createApiKey],
  ['DELETE', '/v1/api-keys/{id}', (c) => {
    requireSession(c)
    return change(c, 'v1_revoke_api_key', { p_id: id(c, 'key', 'API key') })
  }],

  ['GET', '/v1/projects', (c) => read(c, 'v1_list_projects', { ...pageOf(c.url.searchParams, 'prj'), p_workspace: workspaceParam(c) })],
  ['POST', '/v1/projects', (c) => create(c, 'v1_create_project', (b) => ({ p_fields: projectInput(b) }))],
  ['GET', '/v1/projects/{id}', readProject],
  ['PATCH', '/v1/projects/{id}', async (c) =>
    change(c, 'v1_update_project', { p_id: id(c, 'prj', 'project'), p_fields: projectInput(objectOf(await bodyOf(c.request)), true) })],
  ['DELETE', '/v1/projects/{id}', deleteProject],
  ['GET', '/v1/projects/{id}/board', (c) => readBoard(c.env, c.caller.accountId, id(c, 'prj', 'project'), sinceOf(c.url.searchParams.get('since')))],
  ['POST', '/v1/projects/{id}/board/commits', async (c) => {
    const done = await commitBoard(c.env, c.ctx, c.caller.accountId, id(c, 'prj', 'project'), objectOf(await bodyOf(c.request)))
    if (done.ok) poke(c.env, c.ctx, c.caller.accountId)
    return done
  }],
  ['POST', '/v1/projects/{id}/import', async (c) => {
    const done = await importBoard(c.env, c.caller.accountId, id(c, 'prj', 'project'), importInput(objectOf(await bodyOf(c.request))))
    poke(c.env, c.ctx, c.caller.accountId)
    return done
  }],
  ['GET', '/v1/projects/{id}/agents', (c) => listAgents(c.env, c.caller.accountId, id(c, 'prj', 'project'))],
  ['PUT', '/v1/projects/{id}/agents/{agent}', async (c) =>
    updateAgent(c.env, c.caller.accountId, id(c, 'prj', 'project'), c.params[1], await bodyOf(c.request))],
  ['POST', '/v1/projects/{id}/agents/{agent}/run', (c) => runAgent(c.env, c.caller.accountId, id(c, 'prj', 'project'), c.params[1])],
  ['PUT', '/v1/projects/{id}/workflows/{workflow}/rule', async (c) =>
    updateWorkflowRule(c.env, c.caller.accountId, id(c, 'prj', 'project'), c.params[1], await bodyOf(c.request))],

  ['GET', '/v1/workflows', listWorkflows],
  ['POST', '/v1/workflows', (c) => create(c, 'v1_create_workflow', (b) => ({ p_fields: workflowInput(b) }))],
  ['GET', '/v1/workflows/{id}', getWorkflow],
  ['PATCH', '/v1/workflows/{id}', async (c) => {
    const wf = requireOwnWorkflow(c)
    return change(c, 'v1_update_workflow', { p_id: wf, p_fields: workflowInput(objectOf(await bodyOf(c.request))) })
  }],
  ['DELETE', '/v1/workflows/{id}', (c) => change(c, 'v1_delete_workflow', { p_id: requireOwnWorkflow(c) })],

  ['GET', '/v1/marketplace/workflows', listMarketplace],
  ['POST', '/v1/marketplace/workflows/{id}/install', (c) => setInstalled(c, true)],
  ['POST', '/v1/marketplace/workflows/{id}/uninstall', (c) => setInstalled(c, false)],

  ['GET', '/v1/runtimes', (c) => read(c, 'v1_list_runtimes', {})],
  ['POST', '/v1/runtimes', createRuntime],
  ['PATCH', '/v1/runtimes/{id}', updateRuntime],
  ['DELETE', '/v1/runtimes/{id}', (c) => change(c, 'v1_delete_runtime', { p_id: runtimeId(c) })],
  ['POST', '/v1/runtimes/{id}/test', testRuntime],

  ['GET', '/v1/tasks', listTasks],
  ['POST', '/v1/tasks', createTask],
  ['GET', '/v1/tasks/{id}', async (c) => read(c, 'v1_task', { p_id: await taskId(c) })],
  ['PATCH', '/v1/tasks/{id}', updateTask],
  ['POST', '/v1/tasks/{id}/cancel', cancelTask],
  ['POST', '/v1/tasks/{id}/stop', async (c) => stopJob(c, 'v1_stop_task', { p_id: await taskId(c) })],
  ['POST', '/v1/tasks/{id}/restore', restoreTask],
  ['POST', '/v1/tasks/{id}/discard', async (c) => stopJob(c, 'v1_discard_task', { p_id: await taskId(c) })],
  ['POST', '/v1/tasks/{id}/resume', async (c) => change(c, 'v1_resume_task', { p_id: await taskId(c), p_machine: machineOf(await bodyOf(c.request)) })],
  ['GET', '/v1/tasks/{id}/workflow', async (c) => readTaskWorkflow(c.env, c.caller.accountId, await taskId(c))],
  ['GET', '/v1/tasks/{id}/card', async (c) => readCard(c.env, c.caller.accountId, await taskId(c))],
  ['GET', '/v1/tasks/{id}/diff', async (c) => readTaskDiff(c.env, c.caller.accountId, await taskId(c))],
  ['PUT', '/v1/tasks/{id}/card', async (c) => {
    const card = await saveCard(c.env, c.caller.accountId, await taskId(c), cardInput(objectOf(await bodyOf(c.request))))
    poke(c.env, c.ctx, c.caller.accountId)
    const { project: _project, path: _path, ...out } = card
    return json(out)
  }],

  ['GET', '/v1/tasks/{id}/chat', async (c) => read(c, 'v1_task_chat', { p_task: await taskId(c) })],
  ['POST', '/v1/tasks/{id}/chat', async (c) =>
    change(c, 'v1_task_chat_send', { p_task: await taskId(c), ...chatInput(objectOf(await bodyOf(c.request))) })],
  ['DELETE', '/v1/tasks/{id}/chat', async (c) => change(c, 'v1_task_chat_clear', { p_task: await taskId(c) })],
  ['POST', '/v1/tasks/{id}/chat/stop', async (c) => stopJob(c, 'v1_task_chat_stop', { p_task: await taskId(c) })],
  ['GET', '/v1/chats', (c) => read(c, 'v1_list_chats', {
    ...pageOf(c.url.searchParams), p_after: chatCursor(c.url.searchParams.get('after')), p_workspace: workspaceParam(c),
    p_external: c.url.searchParams.get('external') === '1',
  })],

  ['POST', '/v1/discussions', (c) => create(c, 'v1_create_discussion', (b) => ({ p_fields: discussionInput(b) }))],
  ['POST', '/v1/discussions/external', (c) =>
    create(c, 'v1_create_external_discussion', (b) => ({ p_fields: externalDiscussionInput(b) }))],
  ['GET', '/v1/discussions/{id}', (c) => read(c, 'v1_discussion', { p_id: discussionId(c) })],
  ['DELETE', '/v1/discussions/{id}', (c) => change(c, 'v1_delete_discussion', { p_id: discussionId(c) })],
  ['POST', '/v1/discussions/{id}/chat', async (c) =>
    change(c, 'v1_discussion_send', { p_id: discussionId(c), ...discussionChatInput(objectOf(await bodyOf(c.request))) })],
  ['DELETE', '/v1/discussions/{id}/chat', (c) => change(c, 'v1_discussion_clear', { p_id: discussionId(c) })],
  ['PUT', '/v1/discussions/{id}/draft', saveDraftRoute],
  ['POST', '/v1/discussions/{id}/chat/stop', (c) => stopJob(c, 'v1_discussion_stop', { p_id: discussionId(c) })],
  ['PATCH', '/v1/discussions/{id}/ideas/{idea}', async (c) => change(c, 'v1_update_idea', {
    p_discussion: discussionId(c), p_idea: ideaId(c), p_workflow: idOf(objectOf(await bodyOf(c.request)).workflow, 'wf', 'workflow'),
  })],
  ['DELETE', '/v1/discussions/{id}/ideas/{idea}', (c) =>
    change(c, 'v1_drop_idea', { p_discussion: discussionId(c), p_idea: ideaId(c) })],
  ['POST', '/v1/discussions/{id}/ideas/{idea}/start', startIdeaRoute],

  ['GET', '/v1/triage', listTriage],
  ['POST', '/v1/triage', createTriage],
  ['POST', '/v1/triage/{id}/dismiss', async (c) =>
    json(await dismissItem(c.env, c.ctx, c.caller.accountId, triageId(c), await reasonOf(c)))],
  ['POST', '/v1/triage/{id}/restore', async (c) => json(await restoreItem(c.env, c.ctx, c.caller.accountId, triageId(c)))],
  ['GET', '/v1/rejections', listRejections],
  ['POST', '/v1/rejections/reviewed', rejectionsReviewed],

  ['GET', '/v1/tasks/{id}/guests', async (c) => read(c, 'v1_list_guests', { p_task: await taskId(c) })],
  ['PUT', '/v1/tasks/{id}/guests/{email}', addGuest],
  ['DELETE', '/v1/tasks/{id}/guests/{email}', async (c) =>
    change(c, 'v1_remove_guest', { p_task: await taskId(c), p_email: emailOf(c.params[1]) })],

  ['PATCH', '/v1/tasks/{id}/review', async (c) =>
    change(c, 'v1_update_review', { p_task: await taskId(c), p_fields: reviewPatch(objectOf(await bodyOf(c.request))) })],

  ['GET', '/v1/tasks/{id}/comments', async (c) => {
    requireSession(c)
    return read(c, 'v1_list_comments', { p_task: await taskId(c), ...pageOf(c.url.searchParams, 'cmt') })
  }],
  ['POST', '/v1/tasks/{id}/comments', async (c) => {
    requireSession(c)
    const task = await taskId(c)
    const body = commentInput(objectOf(await bodyOf(c.request)))
    return json(await write(c, 'v1_create_comment', { p_task: task, p_body: body, p_author: actorOf(c.caller) }), 201)
  }],

  ['GET', '/v1/tasks/{id}/share-links', async (c) => read(c, 'v1_list_share_links', { p_task: await taskId(c) })],
  ['POST', '/v1/tasks/{id}/share-links', createShareLink],
  ['PATCH', '/v1/share-links/{id}', async (c) =>
    change(c, 'v1_update_share_link', { p_id: id(c, 'shr', 'share link'), p_fields: shareLinkInput(objectOf(await bodyOf(c.request)), true) })],
  ['DELETE', '/v1/share-links/{id}', (c) => change(c, 'v1_revoke_share_link', { p_id: id(c, 'shr', 'share link') })],

  ['GET', '/v1/tasks/{id}/artifacts', async (c) =>
    read(c, 'v1_list_artifacts', { p_task: await taskId(c), ...pageOf(c.url.searchParams, 'art') })],
  ['POST', '/v1/tasks/{id}/artifacts', async (c) => {
    const task = await taskId(c)
    return create(c, 'v1_create_artifact', (b) => ({ p_task: task, p_fields: artifactInput(b) }))
  }],
  ['GET', '/v1/artifacts/{id}', (c) => read(c, 'v1_artifact', { p_id: id(c, 'art', 'artifact') })],
  ['POST', '/v1/artifacts/{id}/versions', createVersion],
  ['GET', '/v1/artifacts/{id}/versions/{version}', getVersion],
  ['GET', '/v1/artifacts/{id}/versions/{version}/file', getVersionFile],
  ['GET', '/v1/artifacts/{id}/versions/{version}/component', async (c) =>
    json(await artifactComponent(c.env, c.caller.accountId, id(c, 'art', 'artifact'), versionOf(c)))],
  ['POST', '/v1/artifacts/{id}/uploads', createUpload],
  ['PUT', '/v1/uploads/{id}', putUpload],
  ['PUT', '/v1/uploads/{id}/parts/{part}', putUploadPart],
  ['POST', '/v1/uploads/{id}/complete', completeUpload],

  ['GET', '/v1/tasks/{id}/decisions', async (c) =>
    read(c, 'v1_list_decisions', { p_task: await taskId(c), ...pageOf(c.url.searchParams, 'dec') })],
  ['POST', '/v1/tasks/{id}/decisions', async (c) => {
    const task = await taskId(c)
    return create(c, 'v1_create_decision', (b) => ({ p_task: task, p_fields: decisionInput(b), p_actor: actorOf(c.caller) }))
  }],


  ['GET', '/v1/components', (c) => read(c, 'v1_list_components', {})],
  ['POST', '/v1/components', createComponent],
  ['GET', '/v1/components/{name}', (c) => read(c, 'v1_component', { p_name: componentName(c.params[0]) })],
  ['PUT', '/v1/components/{name}/versions/{version}/bundle', async (c) =>
    json(await putBundle(c.env, c.caller.accountId, componentName(c.params[0]), componentVersion(c.params[1]), c.request))],
  ['DELETE', '/v1/components/{name}/versions/{version}', async (c) =>
    json(await deleteVersion(c.env, c.caller.accountId, componentName(c.params[0]), componentVersion(c.params[1])))],

  ['GET', '/v1/alerts', listAlerts],
  ['POST', '/v1/alerts/{id}/read', (c) => change(c, 'v1_read_alert', { p_id: id(c, 'alr', 'alert') })],

  ['GET', '/v1/events', listEvents],
  ['GET', '/v1/events/stream', (c) => openStream(c.env, c.caller.accountId, c.request, hiddenFor(c))],
]

const patternOf = (path: string) => new RegExp(`^${path.replace(/\{[^}]+\}/g, '([^/]+)')}$`)

const MATCHERS = [
  ...ROUTES.map(([method, path, handler]) => ({ method, path, handler, shared: false as const, pattern: patternOf(path) })),
  ...SHARED_ROUTES.map(([method, path, handler]) => ({ method, path, handler, shared: true as const, pattern: patternOf(path) })),
]

/** Any browser origin may call the public API: it is bearer-authenticated, never by cookie. */
export const V1_CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE',
  'access-control-allow-headers': 'authorization, content-type, idempotency-key, last-event-id, x-akb-lang',
  'access-control-expose-headers': 'deprecation, sunset, link, idempotent-replayed, retry-after',
  'access-control-max-age': '86400',
}

export const isV1Path = (pathname: string) =>
  pathname === '/v1/openapi.json' || MATCHERS.some((m) => m.pattern.test(pathname))

/**
 * Whether a request is the public API's. `GET /v1/events` is shared with the v0.11 event
 * feed until it retires: it is this one when the request carries `after` or an API key.
 */
export function isV1Request(request: Request, url: URL): boolean {
  if (url.pathname === '/v1/events') {
    const bearer = request.headers.get('authorization') ?? ''
    return url.searchParams.has('after') || bearer.slice(7).trim().startsWith(API_KEY_PREFIX)
  }
  return isV1Path(url.pathname)
}

export async function routeV1(request: Request, base: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  const lang = request.headers.get('x-akb-lang')
  const env: Env = lang === 'en' || lang === 'zh' ? { ...base, REQUEST_LANG: lang } : base
  if (url.pathname === '/v1/openapi.json') {
    if (request.method !== 'GET') throw methodNotAllowed()
    return json(openapi)
  }
  const matched = MATCHERS.filter((m) => m.pattern.test(url.pathname))
  const route = matched.find((m) => m.method === request.method)
  if (!route) throw matched.length > 0 ? methodNotAllowed() : notFound()
  const params = (route.pattern.exec(url.pathname) ?? []).slice(1).map(decodeURIComponent)
  let response: Response
  if (route.shared) {
    const token = params[0] ?? ''
    if (!SHARE_TOKEN.test(token)) throw sharedRefusal('invalid')
    response = await route.handler({ env, ctx, request, token, reviewer: await reviewerOf(request, env), params })
  } else {
    response = await route.handler({ env, ctx, request, url, caller: await authenticate(request, env), params })
  }
  const deprecation = deprecationHeaders(`${route.method} ${route.path}`)
  if (Object.keys(deprecation).length === 0) return response
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(deprecation)) headers.set(name, value)
  return new Response(response.body, { status: response.status, headers })
}
