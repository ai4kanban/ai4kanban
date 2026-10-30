// One workspace's board files (#2081, #2114): a row per file and a workspace-wide change number.
// Each project's files sit under `projects/<id>/`, the workspace's shared memory under `memory/`.
// A write names the `seq` each file was read at; any file moved on since refuses the whole write.
// A write that changed something is hinted to the Runners keeping the projects it touched (#103).

import { call } from './db.ts'
import type { Env } from './env.ts'

export interface BoardRow {
  path: string
  /** Null for a deleted file. */
  content: string | null
  seq: number
}

export interface BoardWrite {
  path: string
  content: string | null
  /** The `seq` the writer read the file at; 0 for one it never saw. */
  base_seq: number
}

export type Committed = { ok: true; head_seq: number; files: { path: string; seq: number }[] } | { ok: false; files: BoardRow[] }

interface Stored {
  path: string
  content: string | null
  seq: number
  deleted: number
}

const rowOf = (r: Stored): BoardRow => ({ path: r.path, content: r.deleted ? null : r.content, seq: r.seq })

export class Board {
  private readonly sql: SqlStorage
  private readonly state: DurableObjectState
  private readonly env: Env

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sql = state.storage.sql
    this.sql.exec('create table if not exists files (path text primary key, content text, seq integer not null, deleted integer not null default 0)')
    this.sql.exec('create index if not exists files_seq on files (seq)')
    this.sql.exec('create table if not exists meta (key text primary key, value integer not null)')
  }

  async fetch(request: Request): Promise<Response> {
    const body = (await request.json()) as Record<string, unknown>
    const answer = (() => {
      switch (new URL(request.url).pathname) {
        case '/diff': return this.diff(body.since as number | null, body.prefixes as string[] | undefined)
        case '/read': return this.read(body.paths as string[])
        case '/list': return this.list(body.prefix as string)
        case '/match': return this.match(body.pattern as string)
        case '/commit': return this.commitAndHint(body.files as BoardWrite[], body.workspace as string, body.machine as string | undefined)
        case '/drop': return this.drop(body.prefix as string)
        case '/destroy': return this.destroy()
      }
      throw new Error('no such board call')
    })()
    return Response.json(await answer)
  }

  private head(): number {
    return (this.sql.exec<{ value: number }>(`select value from meta where key = 'head_seq'`).toArray()[0]?.value) ?? 0
  }

  /** What changed after `since`, deletions included; every live file without it. Only paths under
   *  one of `prefixes`, when given. */
  diff(since: number | null, prefixes?: string[]): { head_seq: number; files: BoardRow[] } {
    const rows = since === null
      ? this.sql.exec<Stored>('select * from files where deleted = 0 order by path').toArray()
      : this.sql.exec<Stored>('select * from files where seq > ? order by seq, path', since).toArray()
    const under = (p: string) => !prefixes || prefixes.some((prefix) => p.startsWith(prefix))
    return { head_seq: this.head(), files: rows.filter((r) => under(r.path)).map(rowOf) }
  }

  read(paths: string[]): BoardRow[] {
    return paths.flatMap((p) => this.sql.exec<Stored>('select * from files where path = ? and deleted = 0', p).toArray().map(rowOf))
  }

  list(prefix: string): BoardRow[] {
    return this.sql.exec<Stored>('select * from files where deleted = 0 and substr(path, 1, ?) = ? order by path', prefix.length, prefix)
      .toArray().map(rowOf)
  }

  /** Live files whose path matches a GLOB pattern. */
  match(pattern: string): BoardRow[] {
    return this.sql.exec<Stored>('select * from files where deleted = 0 and path glob ? order by path', pattern).toArray().map(rowOf)
  }

  /** All or nothing. A file already holding what is written is no conflict and keeps its `seq`. */
  commit(files: BoardWrite[]): Committed {
    return this.state.storage.transactionSync(() => {
      const held = new Map<string, Stored>()
      for (const f of files) {
        const row = this.sql.exec<Stored>('select * from files where path = ?', f.path).toArray()[0]
        if (row) held.set(f.path, row)
      }
      const stale = files.filter((f) => {
        const row = held.get(f.path)
        const now = row && !row.deleted ? row.content : null
        if (now === f.content) return false
        return !(row ? f.base_seq === row.seq || (row.deleted && f.base_seq === 0) : f.base_seq === 0)
      })
      if (stale.length) {
        return { ok: false as const, files: stale.map((f) => held.get(f.path)).map((r, i) => (r ? rowOf(r) : { path: stale[i]!.path, content: null, seq: 0 })) }
      }
      const changed = files.filter((f) => {
        const row = held.get(f.path)
        return (row && !row.deleted ? row.content : null) !== f.content
      })
      let head = this.head()
      if (changed.length) {
        head += 1
        this.sql.exec(`insert into meta (key, value) values ('head_seq', ?) on conflict (key) do update set value = excluded.value`, head)
        for (const f of changed) {
          this.sql.exec(`insert into files (path, content, seq, deleted) values (?, ?, ?, ?)
            on conflict (path) do update set content = excluded.content, seq = excluded.seq, deleted = excluded.deleted`,
          f.path, f.content ?? '', head, f.content === null ? 1 : 0)
        }
      }
      return {
        ok: true as const,
        head_seq: head,
        files: files.map((f) => ({ path: f.path, seq: changed.includes(f) ? head : held.get(f.path)?.seq ?? 0 })),
      }
    })
  }

  private commitAndHint(files: BoardWrite[], workspace: string, machine?: string): Committed {
    const before = this.head()
    const done = this.commit(files)
    if (!done.ok || done.head_seq === before) return done
    const paths = done.files.filter((f) => f.seq === done.head_seq).map((f) => f.path)
    const projects = paths.some((p) => p.startsWith(SHARED_MEMORY)) ? null
      : [...new Set(paths.map((p) => /^projects\/([^/]+)\//.exec(p)?.[1]).filter((p): p is string => !!p))]
    if (projects?.length === 0) return done
    this.state.waitUntil(call(this.env, 'hint_board', {
      p_workspace: workspace, p_projects: projects, p_head: done.head_seq, p_machine: machine ?? null,
    }).catch(() => {}))
    return done
  }

  /** A project is gone: so is every row under its prefix. */
  drop(prefix: string): { dropped: number } {
    if (!prefix.endsWith('/')) throw new Error('a board prefix ends in /')
    const n = this.sql.exec<{ n: number }>('select count(*) as n from files where substr(path, 1, ?) = ?', prefix.length, prefix).toArray()[0]?.n ?? 0
    this.sql.exec('delete from files where substr(path, 1, ?) = ?', prefix.length, prefix)
    return { dropped: n }
  }

  /** The workspace is gone: so is every row. */
  async destroy(): Promise<{ destroyed: true }> {
    await this.state.storage.deleteAll()
    return { destroyed: true }
  }
}

/** The Worker's side: one workspace's board, called over its namespace. */
export function boardOf(env: Env, workspace: string) {
  const ns = env.BOARDS
  if (!ns) throw new Error('This build has no board storage.')
  const stub = ns.get(ns.idFromName(workspace))
  const ask = async <T>(call: string, body: Record<string, unknown> = {}): Promise<T> => {
    const res = await stub.fetch(`https://board/${call}`, { method: 'POST', body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`board ${call} failed: ${res.status}`)
    return res.json() as Promise<T>
  }
  return {
    diff: (since: number | null, prefixes?: string[]) => ask<{ head_seq: number; files: BoardRow[] }>('diff', { since, prefixes }),
    read: (paths: string[]) => ask<BoardRow[]>('read', { paths }),
    list: (prefix: string) => ask<BoardRow[]>('list', { prefix }),
    match: (pattern: string) => ask<BoardRow[]>('match', { pattern }),
    /** `machine`: the computer that pushed it, which its hint names. */
    commit: (files: BoardWrite[], machine?: string) => ask<Committed>('commit', { files, workspace, machine }),
    drop: (prefix: string) => ask<{ dropped: number }>('drop', { prefix }),
    destroy: () => ask<{ destroyed: true }>('destroy'),
  }
}

export type WorkspaceBoard = ReturnType<typeof boardOf>

/** Where a project's files sit in its workspace's board. */
export const projectRoot = (project: string) => `projects/${project}/`

/** The workspace's shared memory. */
export const SHARED_MEMORY = 'memory/'

export interface BoardClient {
  read: (paths: string[]) => Promise<BoardRow[]>
  list: (prefix: string) => Promise<BoardRow[]>
  commit: (files: BoardWrite[]) => Promise<Committed>
}

/** One project's files, by the paths its board names them. */
export function projectBoard(board: WorkspaceBoard, project: string): BoardClient {
  const root = projectRoot(project)
  const strip = <T extends { path: string }>(r: T): T => ({ ...r, path: r.path.slice(root.length) })
  return {
    read: async (paths) => (await board.read(paths.map((p) => root + p))).map(strip),
    list: async (prefix) => (await board.list(root + prefix)).map(strip),
    commit: async (files) => {
      const done = await board.commit(files.map((f) => ({ ...f, path: root + f.path })))
      return done.ok ? { ...done, files: done.files.map(strip) } : { ...done, files: done.files.map(strip) }
    },
  }
}

/** A project never changes workspace, so what it is in is read once per isolate. */
const workspaces = new Map<string, string>()

export async function workspaceOfProject(env: Env, project: string): Promise<string> {
  let workspace = workspaces.get(project)
  if (!workspace) {
    workspace = await call<string>(env, 'v1_board_of', { p_project: project })
    workspaces.set(project, workspace)
  }
  return workspace
}

/** The project's files in its workspace's board. */
export const boardFor = async (env: Env, project: string) => projectBoard(boardOf(env, await workspaceOfProject(env, project)), project)

/** Read, change and write files the Worker holds no job for, again on a file moved on meanwhile. */
export async function rewrite(
  board: BoardClient,
  paths: string[],
  change: (held: Map<string, BoardRow>) => { path: string; content: string | null }[],
): Promise<Committed & { ok: true }> {
  for (let attempt = 0; ; attempt++) {
    const held = new Map((await board.read(paths)).map((r) => [r.path, r]))
    const writes = change(held).map((w) => ({ ...w, base_seq: held.get(w.path)?.seq ?? 0 }))
    const done = await board.commit(writes)
    if (done.ok) return done
    if (attempt >= 4) throw new Error('The board kept changing; try again.')
  }
}
