// A project's board files (#2081), kept in its workspace's board beside the shared memory (#2114):
// the Runner reads what changed since it last read and writes back what a job changed; Web and
// the review read single files. The card index on `tasks` is written here, as each write lands,
// with the paths as the project's board names them.

import { SHARED_MEMORY, boardFor, boardOf, projectBoard, projectRoot, rewrite, workspaceOfProject } from '../board.ts'
import type { BoardClient, BoardWrite } from '../board.ts'
import { stagesFrom } from './workflow-files.ts'
import { BOARD_FILE_LIMIT, assetsFile, cardFront, groupOfCard, isBoardPath, numberOfCard, taskOfAssets, workflowFolder } from '../board-files.ts'
import { call, mutate } from '../db.ts'
import type { Env } from '../env.ts'
import { Refusal, badRequest, payloadTooLarge, versionConflict } from '../errors.ts'
import { json } from '../http.ts'
import { uuid } from '../input.ts'
import { objectOf } from './input.ts'
import type { importInput } from './input.ts'
import { workflowFor } from './workflows.ts'
import { parseFrontmatter, serializeFrontmatter } from '../../../cli/src/lib/frontmatter.ts'
import { emitWritten } from '../triage.ts'
import { triageId } from '../triage-files.ts'
import { sortTriage } from '../triage-sort.ts'

const MAX_FILES = 2000
const bytes = (text: string) => new TextEncoder().encode(text).length

/** `?since=`: a whole number, or absent for the whole board. */
export function sinceOf(value: string | null): number | null {
  if (value === null || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) throw badRequest('since must be a whole number from 0 up.')
  return n
}

/** A path a project's job may write: its own board's, or the workspace's shared memory. */
export function inProject(project: string, path: string): boolean {
  const root = projectRoot(project)
  if (path.startsWith(root)) return isBoardPath(path.slice(root.length))
  return path.startsWith(SHARED_MEMORY) && isBoardPath(path)
}

export function commitInput(project: string, body: Record<string, unknown>): { job: string; machine: string; files: BoardWrite[] } {
  const job = uuid(body.job, 'job')
  const machine = uuid(body.machine, 'computer')
  if (!Array.isArray(body.files)) throw badRequest('files must be a list.')
  if (body.files.length > MAX_FILES) throw payloadTooLarge(`files has at most ${MAX_FILES} entries.`)
  const seen = new Set<string>()
  const files = body.files.map((v, i) => {
    const f = objectOf(v)
    const at = `files[${i}]`
    if (typeof f.path !== 'string' || !inProject(project, f.path)) throw badRequest(`${at}.path is not a board file Cloud keeps.`)
    if (seen.has(f.path)) throw badRequest(`${at}.path is named twice.`)
    seen.add(f.path)
    if (f.content !== null && typeof f.content !== 'string') throw badRequest(`${at}.content must be text or null.`)
    if (typeof f.content === 'string' && bytes(f.content) > BOARD_FILE_LIMIT) {
      throw payloadTooLarge(`${f.path} is over ${BOARD_FILE_LIMIT / 1024} KB; send it as an asset instead.`)
    }
    if (!Number.isInteger(f.base_seq) || (f.base_seq as number) < 0) throw badRequest(`${at}.base_seq must be a whole number from 0 up.`)
    return { path: f.path, content: f.content as string | null, base_seq: f.base_seq as number }
  })
  return { job, machine, files }
}

/** What the card index learns from files written: each card where it is now, by its task's
 *  number, deletions first; a subtask names its group's number as `parent`. */
export function indexEntries(files: { path: string; content: string | null; seq: number }[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const f of files) {
    const number = numberOfCard(f.path)
    if (number !== null && f.content === null) out.push({ number, path: f.path, deleted: true })
  }
  for (const f of files) {
    const number = numberOfCard(f.path)
    if (number === null || f.content === null) continue
    out.push({ number, path: f.path, seq: f.seq, front: cardFront(f.content), links: cardLinks(f.content), ...groupOf(f.path) })
  }
  for (const f of files) {
    const task = taskOfAssets(f.path)
    if (!task) continue
    let held: unknown = {}
    try {
      held = f.content === null ? {} : JSON.parse(f.content)
    } catch {
      // A broken list shows nothing.
    }
    out.push({ task, assets: held && typeof held === 'object' && !Array.isArray(held) ? held : {} })
  }
  return out
}

const groupOf = (path: string) => {
  const parent = groupOfCard(path)
  return parent === null ? {} : { parent }
}

/** The card's `blocked_by`, `related` and `schedule` (#2064), as the board reads them. */
function cardLinks(content: string): Record<string, unknown> | undefined {
  const { meta } = parseFrontmatter(content)
  return meta ? { blocked_by: meta.blocked_by, related: meta.related, schedule: meta.schedule } : undefined
}

/** `metadata.blocked_by` and `metadata.schedule` go into the card's frontmatter, where the board
 *  reads them; `blocked_by` as the numbers its tasks have in the project. */
async function withLinks(env: Env, account: string, task: string, body: string, metadata: Record<string, unknown>): Promise<string> {
  if (metadata.blocked_by === undefined && metadata.schedule === undefined) return body
  const { meta, body: rest } = parseFrontmatter(body)
  if (!meta) throw badRequest('metadata.blocked_by and metadata.schedule need the card to open with frontmatter.')
  if (metadata.blocked_by !== undefined) {
    meta.blocked_by = await call<number[]>(env, 'v1_card_numbers', { p_account: account, p_task: task, p_refs: metadata.blocked_by })
  }
  if (metadata.schedule !== undefined) meta.schedule = metadata.schedule as typeof meta.schedule
  return serializeFrontmatter(meta) + '\n' + rest
}

/** Written, then indexed; an index that fails is caught up by the next write, never undone. */
export async function index(env: Env, account: string, project: string, entries: Record<string, unknown>[]): Promise<void> {
  if (!entries.length) return
  try {
    await mutate(env, 'v1_index_cards', { p_account: account, p_project: project, p_cards: entries })
  } catch (e) {
    console.error('cloud: card index not written', { project, error: e instanceof Error ? e.message : String(e) })
  }
}

/** The project's own files a write changed, as its board names them. */
const written = (project: string, writes: { path: string; content: string | null }[], seqs: { path: string; seq: number }[]) => {
  const root = projectRoot(project)
  return writes.filter((w) => w.path.startsWith(root))
    .map((w) => ({ path: w.path.slice(root.length), content: w.content, seq: seqs.find((s) => s.path === w.path)?.seq ?? 0 }))
}

export async function readBoard(env: Env, account: string, project: string, since: number | null): Promise<Response> {
  const { workspace } = await call<{ workspace: string }>(env, 'v1_project', { p_account: account, p_id: project })
  return json(await boardOf(env, workspace).diff(since, [projectRoot(project), SHARED_MEMORY]))
}

/** The card and the shared memory a job changed land together or not at all. */
export async function commitBoard(env: Env, ctx: ExecutionContext, account: string, project: string, body: Record<string, unknown>): Promise<Response> {
  const { job, machine, files } = commitInput(project, body)
  await call(env, 'v1_board_job', { p_account: account, p_project: project, p_job: job, p_machine: machine })
  const workspace = await workspaceOfProject(env, project)
  const done = await boardOf(env, workspace).commit(files)
  if (!done.ok) {
    return json({ error: { code: 'version_conflict', message: 'These files changed since they were read.' }, files: done.files }, 409)
  }
  await index(env, account, project, indexEntries(written(project, files, done.files)))
  ctx.waitUntil(triageWritten(env, ctx, workspace, files, done.files))
  return json({ head_seq: done.head_seq, files: done.files })
}

/** The triage items a job wrote (#2107): told, and each new one sorted. */
async function triageWritten(env: Env, ctx: ExecutionContext, workspace: string, files: BoardWrite[], seqs: { path: string; seq: number }[]) {
  try {
    const items = await emitWritten(env, ctx, workspace, files, seqs)
    for (const h of items) if (h.state === 'open' && !h.file.fields.judged_at) await sortTriage(env, triageId(h.project, h.name), ctx)
  } catch (e) {
    console.error('cloud: triage written not handled', { workspace, error: e instanceof Error ? e.message : String(e) })
  }
}

interface CardIndex {
  task: string
  project: string
  path: string
  version: number
  metadata: Record<string, unknown>
  assets: Record<string, unknown>
}

const withBody = async (env: Env, card: CardIndex) => {
  const [row] = await (await boardFor(env, card.project)).read([card.path])
  return { ...card, body: row?.content ?? '' }
}

export async function readCard(env: Env, account: string, task: string): Promise<Response> {
  const { project: _project, path: _path, ...card } = await withBody(env, await call<CardIndex>(env, 'v1_card', { p_account: account, p_task: task }))
  return json(card)
}

/** A card written outside a job: on the version read, refused when the file moved on since. */
export async function saveCard(env: Env, account: string, task: string, input: { p_fields: Record<string, unknown>; p_base: number }) {
  const { p_fields: fields, p_base: base } = input
  const { blocked_by: _blocked, schedule: _schedule, ...metadata } = (fields.metadata ?? {}) as Record<string, unknown>
  const body = await withLinks(env, account, task, fields.body as string, (fields.metadata ?? {}) as Record<string, unknown>)
  const place = await mutate<CardIndex>(env, 'v1_card_place', { p_account: account, p_task: task, p_assets: fields.assets ?? null })
  const board = await boardFor(env, place.project)
  const writes: BoardWrite[] = [{ path: place.path, content: body, base_seq: base }]
  if (fields.assets !== undefined) {
    const [list] = await board.read([assetsFile(task)])
    writes.push({ path: assetsFile(task), content: `${JSON.stringify(fields.assets, null, 2)}\n`, base_seq: list?.seq ?? 0 })
  }
  const done = await board.commit(writes)
  if (!done.ok) throw versionConflict(`The card changed since version ${base}; read it and write against that.`)
  const seq = done.files[0]!.seq
  await index(env, account, place.project, [{
    task,
    path: place.path,
    seq,
    front: cardFront(body),
    links: cardLinks(body),
    ...groupOf(place.path),
    metadata: fields.metadata ? metadata : cardMetadata(body),
    ...(fields.assets !== undefined ? { assets: fields.assets } : {}),
  }])
  return withBody(env, await call<CardIndex>(env, 'v1_card', { p_account: account, p_task: task }))
}

function cardMetadata(body: string): Record<string, unknown> {
  const { phase, previews, stages } = cardFront(body)
  return { ...(phase ? { phase } : {}), ...(previews ? { previews } : {}), ...(stages ? { stages } : {}) }
}

/** After a pinned save moved the index's pins: the task's assets file says the same. */
export async function writeAssets(env: Env, account: string, task: string): Promise<void> {
  const card = await call<CardIndex>(env, 'v1_card', { p_account: account, p_task: task }).catch(() => null)
  if (!card) return
  await rewrite(await boardFor(env, card.project), [assetsFile(task)], () => [
    { path: assetsFile(task), content: `${JSON.stringify(card.assets, null, 2)}\n` },
  ])
}

interface TaskWorkflow {
  project: string
  workflow: string
  files: Record<string, string>
  [key: string]: unknown
}

/** The version's files under `workflows/<folder>/`, where the project's board keeps the one it
 *  uses; a file an earlier version had and this one does not goes. */
export async function writeWorkflow(board: BoardClient, workflow: string, files: Record<string, string>): Promise<void> {
  const root = `workflows/${workflowFolder(workflow)}/`
  const paths = Object.keys(files).map((name) => root + name).filter(isBoardPath)
  const gone = (await board.list(root)).map((r) => r.path).filter((p) => !paths.includes(p))
  await rewrite(board, [...paths, ...gone], () => [
    ...paths.map((p) => ({ path: p, content: files[p.slice(root.length)]! })),
    ...gone.map((p) => ({ path: p, content: null })),
  ])
}

/** A task's workflow version, its files as the project's board holds them; written there first
 *  when the board has none of them yet. */
export async function readTaskWorkflow(env: Env, account: string, task: string): Promise<Response> {
  const version = await call<TaskWorkflow>(env, 'v1_task_workflow', { p_account: account, p_task: task })
  const board = await boardFor(env, version.project)
  const root = `workflows/${workflowFolder(version.workflow)}/`
  let rows = await board.list(root)
  if (!rows.length && Object.keys(version.files).length) {
    await writeWorkflow(board, version.workflow, version.files)
    rows = await board.list(root)
  }
  const { project: _project, previews, ...out } = version
  const files = Object.fromEntries(rows.map((r) => [r.path.slice(root.length), r.content ?? '']))
  return json({ ...out, stages: stagesFrom(files, Array.isArray(previews) ? previews.map(String) : []), files })
}

/** A new task's workflow, written into its project's board. Never fails the create. */
export async function placeWorkflow(env: Env, account: string, task: string): Promise<void> {
  try {
    const version = await call<TaskWorkflow>(env, 'v1_task_workflow', { p_account: account, p_task: task })
    await writeWorkflow(await boardFor(env, version.project), version.workflow, version.files)
  } catch (e) {
    if (e instanceof Refusal && e.code === 'not_found') return
    console.error('cloud: workflow not written to the board', { task, error: e instanceof Error ? e.message : String(e) })
  }
}

/** Cards that left one project for another go with their assets lists, in one write to their
 *  workspace's board, renamed to the number each task has there. */
export async function moveCards(env: Env, account: string, from: string, to: string, moved: { task: string; path: string; number: number }[]) {
  if (!moved.length || from === to) return
  const board = boardOf(env, await workspaceOfProject(env, from))
  const [source, target] = [projectRoot(from), projectRoot(to)]
  const rows = await projectBoard(board, from).read(moved.flatMap((m) => [m.path, assetsFile(m.task)]))
  if (!rows.length) return
  const renamed = (path: string) => {
    const m = moved.find((x) => x.path === path)
    return m ? renumbered(path, m.number) : path
  }
  const paths = rows.flatMap((r) => [source + r.path, target + renamed(r.path)])
  const done = await rewrite(board, paths, () => rows.flatMap((r) => [
    { path: source + r.path, content: null },
    { path: target + renamed(r.path), content: r.content },
  ]))
  await index(env, account, to, indexEntries(rows.map((r) => ({
    path: renamed(r.path),
    content: r.content,
    seq: done.files.find((f) => f.path === target + renamed(r.path))?.seq ?? 0,
  }))))
}

/** A card's path under another number: a group root's folder, else the file. */
export const renumbered = (path: string, number: number) =>
  /\/root\.md$/.test(path) ? path.replace(/\d+(-[^/]+\/root\.md)$/, `${number}$1`) : path.replace(/\d+(-[^/]*\.md)$/, `${number}$1`)

interface Parked {
  projects: string[]
  files: { path: string; content: string }[]
}

/** A one-off move (#2114): each project's own board, and the memory 0083 parked, into the
 *  workspace's board under the paths it keeps them at; then indexed, and the old boards queued
 *  to go. A workspace moved already has nothing parked. */
export async function moveBoard(env: Env, workspace: string): Promise<{ files: number }> {
  const parked = await call<Parked>(env, 'v1_board_move', { p_workspace: workspace })
  const files = new Map<string, string>()
  for (const project of parked.projects) {
    for (const r of (await boardOf(env, project).diff(null)).files) {
      if (r.content !== null && isBoardPath(r.path)) files.set(projectRoot(project) + r.path, r.content)
    }
  }
  for (const f of parked.files) if (!files.has(f.path)) files.set(f.path, f.content)
  const board = boardOf(env, workspace)
  const done = files.size
    ? await rewrite(board, [...files.keys()], () => [...files].map(([path, content]) => ({ path, content })))
    : null
  const cards = (done?.files ?? []).flatMap((f) => {
    const [, project, path] = /^projects\/([^/]+)\/(.+)$/.exec(f.path) ?? []
    const number = path ? numberOfCard(path) : null
    return number === null ? [] : [{ project, number, path, seq: f.seq }]
  })
  await call(env, 'v1_board_moved', { p_workspace: workspace, p_cards: cards })
  return { files: files.size }
}

interface Imported {
  ref: number
  task: string
  number: number
  carded: boolean
}

/** A local board's cards and files (#2123): the tasks made in order, then the cards of those not
 *  yet written and the files in one write, indexed, and the cards on review put there. A shared
 *  memory file the workspace already has is kept as Cloud holds it, and named in `kept`; `next` is
 *  the number the project's next task takes. */
export async function importBoard(env: Env, account: string, project: string, input: ReturnType<typeof importInput>): Promise<Response> {
  const { board: from, cards, files } = input
  const bad = files.find((f) => !inProject(project, f.path) || numberOfCard(f.path.slice(projectRoot(project).length)) !== null)
  if (bad) throw badRequest(`${bad.path} is not a board file Cloud keeps.`)
  const workflows = Object.fromEntries([...new Set(cards.map((c) => c.workflow))].map((wf) => [wf, workflowFor(wf)]))
  const { cards: made, next } = await mutate<{ cards: Imported[]; next: number }>(env, 'v1_import_tasks', {
    p_account: account,
    p_project: project,
    p_board: from,
    p_cards: cards.map(({ ref, number, title, workflow }) => ({ ref, number, title, workflow })),
    p_workflows: workflows,
  })
  const fresh = made.filter((m) => !m.carded)
  for (const wf of Object.keys(workflows)) {
    const first = fresh.find((m) => cards.find((c) => c.ref === m.ref)?.workflow === wf)
    if (first) await placeWorkflow(env, account, first.task)
  }

  const root = projectRoot(project)
  const writes = new Map<string, string>()
  for (const m of fresh) {
    const card = cards.find((c) => c.ref === m.ref)!
    writes.set(root + card.path, card.body)
  }
  for (const f of files) writes.set(f.path, f.content)
  const kept: string[] = []
  if (writes.size) {
    const done = await rewrite(boardOf(env, await workspaceOfProject(env, project)), [...writes.keys()], (held) => {
      kept.length = 0
      return [...writes].filter(([path, content]) => {
        const theirs = path.startsWith(root) ? null : held.get(path)?.content
        if (theirs != null && theirs !== content) kept.push(path)
        return theirs == null
      }).map(([path, content]) => ({ path, content }))
    })
    await index(env, account, project, indexEntries(written(project,
      [...writes].map(([path, content]) => ({ path, content })).filter((w) => !kept.includes(w.path)), done.files)))
  }

  const reviews = cards.flatMap((c) => {
    const m = made.find((x) => x.ref === c.ref)
    return c.review && m ? [{ task: m.task, review: c.review === true ? null : c.review }] : []
  })
  if (reviews.length) await mutate(env, 'v1_import_reviews', { p_account: account, p_project: project, p_reviews: reviews })
  return json({ cards: made.map(({ ref, task, number }) => ({ ref, task, number })), kept, next })
}
