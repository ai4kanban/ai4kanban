// The real `Board` (#2081) on node:sqlite, behind a stand-in for its namespace.

import { DatabaseSync } from 'node:sqlite'

import { Board } from '../src/board.ts'

export function storageOn(db) {
  return {
    sql: {
      exec: (query, ...bindings) => {
        const statement = db.prepare(query)
        const rows = statement.columns().length ? statement.all(...bindings) : (statement.run(...bindings), [])
        return { toArray: () => rows.map((r) => ({ ...r })) }
      },
    },
    transactionSync: (fn) => {
      db.exec('begin')
      try {
        const out = fn()
        db.exec('commit')
        return out
      } catch (e) {
        db.exec('rollback')
        throw e
      }
    },
    deleteAll: async () => {
      for (const { name } of db.prepare(`select name from sqlite_master where type = 'table'`).all()) db.exec(`delete from ${name}`)
    },
    setAlarm: async () => {},
  }
}

/** `boards.of(workspace)` is the object itself, for checks reading what it holds; `boards.project(id)`
 *  the same for one project's files, by the paths its board names them. */
export function fakeBoards(env = {}, waitUntil = () => {}) {
  const held = new Map()
  const of = (name) => {
    if (!held.has(name)) held.set(name, new Board({ storage: storageOn(new DatabaseSync(':memory:')), waitUntil }, env))
    return held.get(name)
  }
  const project = (id, workspace = 'ws_1') => {
    const root = `projects/${id}/`
    const strip = (r) => ({ ...r, path: r.path.slice(root.length) })
    const board = of(workspace)
    return {
      commit: (files) => {
        const done = board.commit(files.map((f) => ({ ...f, path: root + f.path })))
        return { ...done, files: done.files.map(strip) }
      },
      read: (paths) => board.read(paths.map((p) => root + p)).map(strip),
      list: (prefix) => board.list(root + prefix).map(strip),
      diff: (since) => {
        const done = board.diff(since, [root])
        return { ...done, files: done.files.map(strip) }
      },
    }
  }
  return {
    of,
    project,
    idFromName: (name) => name,
    get: (name) => ({ fetch: (input, init) => of(name).fetch(new Request(input, init)) }),
  }
}
