// A D1, a limiter and an archive bucket the tests can hold. The database is a real SQLite
// with the real migration applied, so every statement the Worker runs is checked as SQL and
// not as a string somebody once believed in.

import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

import { AddressHour } from '../src/index.ts'

export function fakeDatabase() {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('../migrations/0001_events.sql', import.meta.url), 'utf8'))

  const d1 = {
    sqlite: db,
    prepare(sql) {
      let args = []
      const statement = {
        bind(...values) {
          args = values
          return statement
        },
        async run() {
          const result = db.prepare(sql).run(...args)
          return { results: [], success: true, meta: meta(Number(result.changes)) }
        },
        async all() {
          const results = db.prepare(sql).all(...args)
          return { results, success: true, meta: meta(0) }
        },
        async first() {
          return db.prepare(sql).all(...args)[0] ?? null
        },
      }
      return statement
    },
  }
  return d1
}

const meta = (changes) => ({ changes, rows_read: 0, rows_written: changes })

/** Real limiters, one per name, so the hourly count is the one the Worker will keep. */
export function fakeLimiter() {
  const held = new Map()
  return {
    idFromName: (name) => ({ toString: () => name }),
    get(id) {
      const name = id.toString()
      if (!held.has(name)) held.set(name, new AddressHour())
      return { fetch: async (url) => held.get(name).fetch(new Request(url)) }
    },
  }
}

/** The archive, as a map of key to file. `held` is what a test reads back and seeds. */
export function fakeBucket(held = new Map()) {
  return {
    held,
    async put(key, value) {
      held.set(key, value)
      return { key, size: value.length }
    },
    async list({ prefix = '', limit = 1000, cursor } = {}) {
      const keys = [...held.keys()]
        .filter((key) => key.startsWith(prefix) && (cursor === undefined || key > cursor))
        .sort()
      const page = keys.slice(0, limit)
      return {
        objects: page.map((key) => ({ key, size: held.get(key).length })),
        truncated: keys.length > limit,
        cursor: page.at(-1),
      }
    },
  }
}

export const fakeEnv = (over = {}) => ({
  DB: fakeDatabase(),
  LIMITER: fakeLimiter(),
  ARCHIVE: fakeBucket(),
  COPY: 'production',
  ...over,
})
