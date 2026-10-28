import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { serviceRoot } from './env.mjs'

const migrationsDir = join(serviceRoot, 'migrations')

/** Every migration file in filename order, with its checksum. */
export async function readMigrations() {
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()
  if (files.length === 0) throw new Error(`no migrations in ${migrationsDir}`)
  return Promise.all(
    files.map(async (file) => {
      const sql = await readFile(join(migrationsDir, file), 'utf8')
      return { file, sql, checksum: createHash('sha256').update(sql).digest('hex') }
    }),
  )
}

/** The migrations not yet applied. `applied` maps a version to its recorded checksum. */
export function pendingMigrations(migrations, applied) {
  const pending = []
  for (const migration of migrations) {
    const seen = applied.get(migration.file)
    if (seen === undefined) {
      pending.push(migration)
    } else if (seen !== migration.checksum) {
      throw new Error(
        `${migration.file} was changed after it was applied. Migrations run forward only — add a new one instead.`,
      )
    }
  }
  return pending
}

/** Run one statement through the Supabase Management API. */
export async function query(ref, token, sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Supabase answered ${response.status}: ${body}`)
  const parsed = body ? JSON.parse(body) : []
  return Array.isArray(parsed) ? parsed : []
}
