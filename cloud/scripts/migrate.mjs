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

import { loadEnv, requireEnv } from './env.mjs'
import { pendingMigrations, query as run, readMigrations } from './migrations.mjs'

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

  const pending = pendingMigrations(await readMigrations(), applied)

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

const literal = (value) => `'${String(value).replace(/'/g, "''")}'`
