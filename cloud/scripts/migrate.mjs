#!/usr/bin/env node
// Applies the versioned migrations in cloud/migrations/ to the Cloud Supabase project,
// forward only. It talks to the Supabase Management API over HTTPS, so it needs no
// database driver and no connection string.
//
//   npm run migrate               apply everything not yet applied
//   npm run migrate -- --dry-run  print the plan and change nothing
//
// Credentials come from the environment, or from cloud/.env, which is not in git:
//   SUPABASE_PROJECT_REF    the project's 20-character ref
//   SUPABASE_ACCESS_TOKEN   a personal access token from supabase.com/dashboard/account/tokens

import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { loadEnv, requireEnv, serviceRoot } from './env.mjs'

const migrationsDir = join(serviceRoot, 'migrations')

const BOOTSTRAP = `
create schema if not exists cloud;
create table if not exists cloud.schema_migrations (
  version text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);
`

main().catch((error) => {
  console.error(`migrate: ${error.message}`)
  process.exit(1)
})

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const [ref, token] = requireEnv(
    await loadEnv(),
    'SUPABASE_PROJECT_REF',
    'SUPABASE_ACCESS_TOKEN',
  )

  await run(ref, token, BOOTSTRAP)
  const rows = await run(ref, token, 'select version, checksum from cloud.schema_migrations;')
  const applied = new Map(rows.map((row) => [row.version, row.checksum]))

  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()
  if (files.length === 0) throw new Error(`no migrations in ${migrationsDir}`)

  const pending = []
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), 'utf8')
    const checksum = createHash('sha256').update(sql).digest('hex')
    const seen = applied.get(file)
    if (seen === undefined) {
      pending.push({ file, sql, checksum })
    } else if (seen !== checksum) {
      throw new Error(
        `${file} was changed after it was applied. Migrations run forward only — add a new one instead.`,
      )
    }
  }

  if (pending.length === 0) {
    console.log(`migrate: up to date — ${applied.size} migration(s) applied.`)
    return
  }

  console.log(`migrate: ${pending.length} to apply — ${pending.map((m) => m.file).join(', ')}`)
  if (dryRun) return

  for (const { file, sql, checksum } of pending) {
    await run(
      ref,
      token,
      [
        'begin;',
        sql,
        `insert into cloud.schema_migrations (version, checksum) values (${literal(file)}, ${literal(checksum)});`,
        'commit;',
      ].join('\n'),
    )
    console.log(`migrate: applied ${file}`)
  }

  // PostgREST caches the schema; tell it to re-read so a new function is callable at once.
  await run(ref, token, "notify pgrst, 'reload schema';")
  console.log('migrate: done.')
}

async function run(ref, token, query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Supabase answered ${response.status}: ${body}`)
  const parsed = body ? JSON.parse(body) : []
  return Array.isArray(parsed) ? parsed : []
}

const literal = (value) => `'${String(value).replace(/'/g, "''")}'`
