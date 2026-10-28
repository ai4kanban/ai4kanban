/**
 * Triage kept as board files in the workspace's board (#2107): each project's items under its
 * `triage/`, synced to every Runner with the rest of the board. Postgres only checks who may
 * write and carries the events; the files are the record.
 *
 * - **Learning**: a user's dismissal waits for the rejection review until it has `reviewed_at`;
 *   a restore of one learned waits with `restored_at` until the review withdraws it.
 * - **Ids**: `tri_<project>_<file name>`. A move never renames the file, so an id outlives it.
 */

import { boardOf, projectRoot, workspaceOfProject } from './board.ts'
import type { BoardRow, BoardWrite, WorkspaceBoard } from './board.ts'
import { workflowName } from './board-files.ts'
import { call, mutate } from './db.ts'
import type { Env } from './env.ts'
import { conflict, notFound } from './errors.ts'
import {
  cloudWorkflowOf,
  itemAt,
  itemFileText,
  itemName,
  itemPath,
  itemPaths,
  ofTriageId,
  readItemFile,
  stampItem,
  stampOf,
  stampTime,
  triageId,
} from './triage-files.ts'
import type { ItemFile, TriageState } from './triage-files.ts'
import { sha256 } from './v1/http.ts'
import { poke } from './v1/stream.ts'

export interface TriageItem {
  id: string
  object: 'triage'
  workspace: string
  project: string
  title: string
  text: string
  source_task: string | null
  workflow: string | null
  state: TriageState
  dismissed_reason: string | null
  dismissed_by: string | null
  dismissed_at: string | null
  task: string | null
  created_at: string
  updated_at: string
}

/** One item file as the workspace's board holds it. */
export interface Held {
  project: string
  name: string
  state: TriageState
  /** Its path in the workspace's board. */
  path: string
  content: string
  seq: number
  file: ItemFile
}

const IN_PROJECT = /^projects\/([^/]+)\/(triage\/.+)$/

export function heldOf(row: BoardRow): Held | null {
  const m = IN_PROJECT.exec(row.path)
  const at = m ? itemAt(m[2]!) : null
  const file = at && row.content !== null ? readItemFile(row.content) : null
  if (!m || !at || !file?.fields.title) return null
  return { project: m[1]!, ...at, path: row.path, content: row.content!, seq: row.seq, file }
}

/** Every item of one project, or of every project in the workspace. */
export async function heldIn(board: WorkspaceBoard, project: string | null): Promise<Held[]> {
  const rows = project ? await board.list(`${projectRoot(project)}triage/`) : await board.match('projects/*/triage/*')
  return rows.map(heldOf).filter((h): h is Held => !!h)
}

async function heldAt(board: WorkspaceBoard, project: string, name: string): Promise<Held | null> {
  const rows = await board.read(itemPaths(name).map((p) => projectRoot(project) + p))
  return rows.map(heldOf).find((h): h is Held => !!h) ?? null
}

const iso = (stamp: string | undefined) => {
  const at = stampTime(stamp)
  return at === null ? null : new Date(at).toISOString()
}

/** The user's dismissal the review has not learned, or a learned one withdrawn since. */
export const unlearned = (h: Held) =>
  h.state === 'dismissed' ? h.file.fields.dismissed_by === 'user' && !h.file.fields.reviewed_at : h.state === 'open' && !!h.file.fields.restored_at

function jsonOf(workspace: string, h: Held, tasks: Map<string, string>): TriageItem {
  const f = h.file.fields
  const created = iso(f.imported_at) ?? iso(f.collected_at) ?? new Date(0).toISOString()
  const updated = [created, iso(f.dismissed_at), iso(f.archived_at), iso(f.restored_at)].filter((t): t is string => !!t).sort().at(-1)!
  const dismissed = h.state === 'dismissed'
  return {
    id: triageId(h.project, h.name),
    object: 'triage',
    workspace,
    project: h.project,
    title: f.title!,
    text: h.file.body,
    source_task: f.source_task || null,
    workflow: f.workflow ? cloudWorkflowOf(f.workflow) : null,
    state: h.state,
    dismissed_reason: dismissed ? f.dismissed_reason || null : null,
    dismissed_by: dismissed ? f.dismissed_by || null : null,
    dismissed_at: dismissed ? iso(f.dismissed_at) : null,
    task: f.task || tasks.get(`${h.project}#${f.card_id}`) || null,
    created_at: created,
    updated_at: updated,
  }
}

/** Items as the API answers them; one archived by akb names its card's number, read as its task. */
export async function itemsJson(env: Env, workspace: string, held: Held[]): Promise<TriageItem[]> {
  const cards = held.filter((h) => !h.file.fields.task && /^\d+$/.test(h.file.fields.card_id ?? ''))
    .map((h) => ({ project: h.project, number: Number(h.file.fields.card_id) }))
  const found = cards.length ? await call<{ project: string; number: number; task: string }[]>(env, 'v1_card_tasks', { p_cards: cards }) : []
  const tasks = new Map(found.map((t) => [`${t.project}#${t.number}`, t.task]))
  return held.map((h) => jsonOf(workspace, h, tasks))
}

const byTime = (a: TriageItem, b: TriageItem) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id)

export interface ListQuery {
  workspace: string | null
  project: string | null
  states: string[]
  desc: boolean
  after: string | null
  limit: number
}

/** A page of items, by when each last moved; `after` is the last item of the page before. */
export async function listTriage(env: Env, account: string, q: ListQuery): Promise<{ data: TriageItem[]; next: string | null }> {
  const { workspace } = await call<{ workspace: string }>(env, 'v1_triage_scope', {
    p_account: account,
    p_workspace: q.workspace,
    p_project: q.project,
  })
  const held = (await heldIn(boardOf(env, workspace), q.project)).filter((h) => !q.states.length || q.states.includes(h.state))
  let items = (await itemsJson(env, workspace, held)).sort((a, b) => (q.desc ? byTime(b, a) : byTime(a, b)))
  if (q.after) {
    const at = items.findIndex((i) => i.id === q.after)
    items = at < 0 ? [] : items.slice(at + 1)
  }
  const data = items.slice(0, q.limit)
  return { data, next: items.length > q.limit ? data.at(-1)!.id : null }
}

/** Whether the workspace has anything for the review to learn. */
export const anyUnlearned = async (env: Env, workspace: string) => (await heldIn(boardOf(env, workspace), null)).some(unlearned)

/** Every item in the workspace a review has to learn, oldest first. */
export async function unlearnedIn(env: Env, workspace: string): Promise<TriageItem[]> {
  const held = (await heldIn(boardOf(env, workspace), null)).filter(unlearned)
  return (await itemsJson(env, workspace, held)).sort(byTime).slice(0, 100)
}

async function emit(env: Env, ctx: ExecutionContext | undefined, workspace: string, type: string, item: TriageItem): Promise<void> {
  await call(env, 'v1_triage_emit', { p_workspace: workspace, p_type: type, p_data: item })
  if (ctx) poke(env, ctx, null, workspace)
}

/** The events a job's write makes, one per item it wrote; the items, as they now read. */
export async function emitWritten(env: Env, ctx: ExecutionContext, workspace: string, writes: BoardWrite[], seqs: { path: string; seq: number }[]) {
  const written = writes.flatMap((w) => {
    const h = w.content === null ? null : heldOf({ path: w.path, content: w.content, seq: seqs.find((s) => s.path === w.path)?.seq ?? 0 })
    return h ? [{ h, made: w.base_seq === 0 && h.state === 'open' }] : []
  })
  if (!written.length) return []
  const items = await itemsJson(env, workspace, written.map((x) => x.h))
  for (const [i, item] of items.entries()) await emit(env, undefined, workspace, written[i]!.made ? 'triage.created' : 'triage.updated', item)
  poke(env, ctx, null, workspace)
  return written.map((x) => x.h)
}

const MAX_TRIES = 5

/** Write one item's new file, the old one gone when it moved; again on a file moved on meanwhile. */
export async function rewriteItem(
  board: WorkspaceBoard,
  project: string,
  name: string,
  change: (h: Held | null) => { state: TriageState; content: string } | null,
): Promise<{ held: Held; seq: number } | null> {
  for (let attempt = 0; ; attempt++) {
    const h = await heldAt(board, project, name)
    const next = change(h)
    if (!next) return null
    const to = projectRoot(project) + itemPath(next.state, name)
    const [target] = to === h?.path ? [] : await board.read([to])
    const writes: BoardWrite[] = [
      ...(h && h.path !== to ? [{ path: h.path, content: null, base_seq: h.seq }] : []),
      { path: to, content: next.content, base_seq: to === h?.path ? h.seq : target?.seq ?? 0 },
    ]
    const done = await board.commit(writes)
    if (done.ok) {
      const seq = done.files.find((f) => f.path === to)!.seq
      return { held: heldOf({ path: to, content: next.content, seq })!, seq }
    }
    if (attempt >= MAX_TRIES) throw new Error('The board kept changing; try again.')
  }
}

const sourceIdOf = async (title: string, text: string) => `derived-${(await sha256(`${title}\n${text.trim()}`)).slice(0, 16)}`

export interface NewItem {
  title: string
  text?: string
  workspace?: string
  project?: string
  source_task?: string
  workflow: string
}

/** A new item, or the one already kept with the same words. */
export async function createItem(env: Env, ctx: ExecutionContext, account: string, fields: NewItem): Promise<{ item: TriageItem; created: boolean }> {
  const scope = await mutate<{ workspace: string; project: string }>(env, 'v1_triage_write', {
    p_account: account,
    p_workspace: fields.workspace ?? null,
    p_project: fields.project ?? null,
    p_source_task: fields.source_task ?? null,
    p_workflow: fields.workflow,
  })
  const board = boardOf(env, scope.workspace)
  const text = fields.text ?? ''
  const sourceId = await sourceIdOf(fields.title, text)
  for (let attempt = 0; ; attempt++) {
    const held = await heldIn(board, scope.project)
    const same = held.find((h) => h.file.fields.source_id === sourceId)
    if (same) return { item: (await itemsJson(env, scope.workspace, [same]))[0]!, created: false }
    const names = new Set(held.map((h) => h.name))
    const name = itemName(fields.title, (n) => names.has(n))
    const now = stampOf(new Date())
    const content = itemFileText({
      source_id: sourceId,
      title: fields.title,
      workflow: workflowName(fields.workflow),
      ...(fields.source_task ? { source_task: fields.source_task } : {}),
      collected_at: now,
      imported_at: now,
    }, text)
    const path = projectRoot(scope.project) + itemPath('open', name)
    const done = await board.commit([{ path, content, base_seq: 0 }])
    if (done.ok) {
      const [item] = await itemsJson(env, scope.workspace, [heldOf({ path, content, seq: done.files[0]!.seq })!])
      await emit(env, ctx, scope.workspace, 'triage.created', item!)
      return { item: item!, created: true }
    }
    if (attempt >= MAX_TRIES) throw new Error('The board kept changing; try again.')
  }
}

const missing = () => notFound('No triage item has this id.')

async function writable(env: Env, account: string, id: string) {
  const at = ofTriageId(id)
  if (!at) throw missing()
  const { workspace } = await mutate<{ workspace: string }>(env, 'v1_triage_write', {
    p_account: account, p_workspace: null, p_project: at.project, p_source_task: null, p_workflow: null,
  })
  return { ...at, workspace, board: boardOf(env, workspace) }
}

/** Dismissing a dismissed item again rewrites its reason, to be learned afresh. */
export async function dismissItem(env: Env, ctx: ExecutionContext, account: string, id: string, reason: string | null): Promise<TriageItem> {
  const at = await writable(env, account, id)
  const moved = await rewriteItem(at.board, at.project, at.name, (h) => {
    if (!h) throw missing()
    if (h.state === 'carded') throw conflict('A task was already made of this triage item.')
    return {
      state: 'dismissed',
      content: stampItem(h.content, {
        dismissed_at: stampOf(new Date()), dismissed_by: 'user', dismissed_reason: reason, reviewed_at: null, restored_at: null,
      }),
    }
  })
  const [item] = await itemsJson(env, at.workspace, [moved!.held])
  await emit(env, ctx, at.workspace, 'triage.updated', item!)
  return item!
}

/** Back to open; a dismissal already learned is withdrawn at the next review. */
export async function restoreItem(env: Env, ctx: ExecutionContext, account: string, id: string): Promise<TriageItem> {
  const at = await writable(env, account, id)
  const moved = await rewriteItem(at.board, at.project, at.name, (h) => {
    if (!h) throw missing()
    if (h.state !== 'dismissed') throw conflict('This triage item is not dismissed.')
    return {
      state: 'open',
      content: stampItem(h.content, {
        dismissed_at: null, dismissed_by: null, dismissed_reason: null, reviewed_at: null,
        restored_at: h.file.fields.reviewed_at ? stampOf(new Date()) : null,
      }),
    }
  })
  const [item] = await itemsJson(env, at.workspace, [moved!.held])
  await emit(env, ctx, at.workspace, 'triage.updated', item!)
  return item!
}

/** The open item a new task is made of: its project. */
export async function openItem(env: Env, id: string): Promise<{ project: string; name: string }> {
  const at = ofTriageId(id)
  if (!at) throw missing()
  const h = await heldAt(boardOf(env, await workspaceOfProject(env, at.project)), at.project, at.name).catch(() => null)
  if (!h) throw missing()
  if (h.state !== 'open') throw conflict('This triage item is not waiting to be sorted.')
  return at
}

/** A task was made of it: into `archived/`, with the card it becomes. One sorted meanwhile stays. */
export async function cardItem(env: Env, ctx: ExecutionContext | undefined, id: string, task: { id: string; key: string }): Promise<void> {
  const at = ofTriageId(id)
  if (!at) return
  const workspace = await workspaceOfProject(env, at.project)
  const number = /-(\d+)$/.exec(task.key)?.[1]
  const moved = await rewriteItem(boardOf(env, workspace), at.project, at.name, (h) =>
    h?.state === 'open'
      ? { state: 'carded', content: stampItem(h.content, { ...(number ? { card_id: number } : {}), archived_at: stampOf(new Date()), task: task.id }) }
      : null)
  if (!moved) return
  const [item] = await itemsJson(env, workspace, [moved.held])
  await emit(env, ctx, workspace, 'triage.updated', item!)
}

/** Learned: each leaves the review's list until dismissed or restored again. One the caller may
 *  not write is left as it is. */
export async function markLearned(env: Env, account: string, ids: string[]): Promise<number> {
  const boards = new Map<string, Promise<WorkspaceBoard | null>>()
  let n = 0
  for (const id of new Set(ids)) {
    const at = ofTriageId(id)
    if (!at) continue
    if (!boards.has(at.project)) boards.set(at.project, writable(env, account, id).then((w) => w.board, () => null))
    const board = await boards.get(at.project)!
    if (!board) continue
    const moved = await rewriteItem(board, at.project, at.name, (h) => {
      if (!h || !unlearned(h)) return null
      const learned: Record<string, string | null> = h.state === 'dismissed' ? { reviewed_at: stampOf(new Date()) } : { restored_at: null }
      return { state: h.state, content: stampItem(h.content, learned) }
    })
    if (moved) n++
  }
  return n
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Sorted items past the plan's keep, in one write; a user's dismissal the review has not learned
 *  waits for it. A write that loses a race is tried again next hour. */
export async function expireTriage(env: Env, workspace: string, days: number, now = Date.now()): Promise<number> {
  const board = boardOf(env, workspace)
  const gone = (await heldIn(board, null)).filter((h) => {
    if (h.state === 'open' || unlearned(h)) return false
    const at = stampTime(h.state === 'dismissed' ? h.file.fields.dismissed_at : h.file.fields.archived_at)
    return at !== null && at < now - days * DAY_MS
  })
  if (!gone.length) return 0
  const done = await board.commit(gone.map((h) => ({ path: h.path, content: null, base_seq: h.seq })))
  return done.ok ? gone.length : 0
}

interface Parked {
  id: string
  project: string
  title: string
  body: string
  source_task: string | null
  workflow: string | null
  state: TriageState
  dismissed_reason: string | null
  dismissed_by: string | null
  dismissed_at: string | null
  task: string | null
  task_number: number | null
  reviewed: boolean | null
  judged_at: string | null
  created_at: string
  updated_at: string
}

/** A one-off move (#2107): the items 0100 parked, written as files into the workspace's board,
 *  then dropped from Postgres. One the board already holds is not written twice. */
export async function moveTriage(env: Env, workspace: string): Promise<{ items: number }> {
  const parked = await call<Parked[]>(env, 'v1_triage_move', { p_workspace: workspace })
  if (!parked.length) return { items: 0 }
  const board = boardOf(env, workspace)
  const held = await heldIn(board, null)
  const writes: BoardWrite[] = []
  const stamp = (at: string | null) => stampOf(at ? new Date(at) : new Date())
  for (const p of parked) {
    const sourceId = await sourceIdOf(p.title, p.body)
    if (held.some((h) => h.project === p.project && h.file.fields.source_id === sourceId && h.state === p.state)) continue
    const names = new Set(held.filter((h) => h.project === p.project).map((h) => h.name))
    const name = itemName(p.title, (n) => names.has(n))
    const fields: Record<string, string> = {
      source_id: sourceId,
      title: p.title,
      ...(p.workflow ? { workflow: workflowName(p.workflow) } : {}),
      ...(p.source_task ? { source_task: p.source_task } : {}),
      collected_at: stamp(p.created_at),
      imported_at: stamp(p.created_at),
      ...(p.judged_at ? { judged_at: stamp(p.judged_at) } : {}),
    }
    if (p.state === 'dismissed') {
      Object.assign(fields, {
        dismissed_at: stamp(p.dismissed_at ?? p.updated_at),
        dismissed_by: p.dismissed_by ? 'user' : 'agent',
        ...(p.dismissed_reason ? { dismissed_reason: p.dismissed_reason } : {}),
        ...(p.dismissed_by && p.reviewed !== false ? { reviewed_at: stamp(p.updated_at) } : {}),
      })
    } else if (p.state === 'carded') {
      Object.assign(fields, {
        ...(p.task_number ? { card_id: String(p.task_number) } : {}),
        archived_at: stamp(p.updated_at),
        ...(p.task ? { task: p.task } : {}),
      })
    } else if (p.reviewed === false) {
      fields.restored_at = stamp(p.updated_at)
    }
    const path = projectRoot(p.project) + itemPath(p.state, name)
    const content = itemFileText(fields, p.body)
    writes.push({ path, content, base_seq: 0 })
    held.push(heldOf({ path, content, seq: 0 })!)
  }
  if (writes.length) {
    const done = await board.commit(writes)
    if (!done.ok) throw new Error('The board changed during the move; run it again.')
  }
  await call(env, 'v1_triage_moved', { p_workspace: workspace, p_ids: parked.map((p) => p.id) })
  return { items: writes.length }
}
