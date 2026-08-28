#!/usr/bin/env node
// Runs cloud/test/sql/checks.sql — what the schema does with a well-formed call (#329).
//
//   npm run test:sql              against a throwaway PostgreSQL started here and thrown away
//   npm run test:sql -- --project against the project SUPABASE_PROJECT_REF names
//
// The default needs `initdb`, `pg_ctl` and `psql` on PATH and nothing else: it makes a
// cluster in a temporary folder, stands up the pieces of a Supabase project the migrations
// lean on (test/sql/supabase.sql), applies every migration, runs the checks and removes the
// cluster. Nothing outside that folder is touched.
//
// `--project` is the same checks against a real project with the migrations already applied
// — the throwaway one the live pass uses. The checks roll back, so a project keeps exactly
// the rows it had; never point it at the project a workspace is using.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadEnv, requireEnv, serviceRoot } from './env.mjs'

const CHECKS = join(serviceRoot, 'test', 'sql', 'checks.sql')
const SUPABASE_STUB = join(serviceRoot, 'test', 'sql', 'supabase.sql')
const MIGRATIONS = join(serviceRoot, 'migrations')
const PORT = '55432'

main().catch((error) => {
  console.error(`sql: ${error.message}`)
  process.exit(1)
})

async function main() {
  if (process.argv.includes('--project')) return againstProject()
  return againstThrowaway()
}

// --- a real project -----------------------------------------------------------

async function againstProject() {
  const [ref, token] = requireEnv(await loadEnv(), 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN')
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: readFileSync(CHECKS, 'utf8') }),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`${ref} refused the checks: ${body}`)
  console.log(`sql: every check passed against ${ref}.`)
}

// --- a throwaway cluster ------------------------------------------------------

async function againstThrowaway() {
  for (const tool of ['initdb', 'pg_ctl', 'psql']) {
    if (spawnSync(tool, ['--version'], { stdio: 'ignore' }).status !== 0) {
      console.log(`sql: not run — ${tool} is not on PATH. Install PostgreSQL, or use --project.`)
      return
    }
  }

  const dir = mkdtempSync(join(tmpdir(), 'akb-cloud-sql-'))
  const data = join(dir, 'pg')
  try {
    must('initdb', ['-D', data, '-U', 'postgres', '--auth=trust'], 'could not make a cluster')
    must(
      'pg_ctl',
      ['-D', data, '-o', `-p ${PORT} -k ${dir} -c listen_addresses=''`, '-l', join(dir, 'pg.log'), '-w', 'start'],
      'could not start the cluster',
    )
    try {
      const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
      for (const file of [SUPABASE_STUB, ...files.map((f) => join(MIGRATIONS, f))]) {
        psql(dir, file, `${file} would not apply`)
      }
      psql(dir, CHECKS, 'a check failed')
      console.log(`sql: every check passed against a throwaway PostgreSQL (${files.length} migrations).`)
    } finally {
      spawnSync('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'ignore' })
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function psql(socketDir, file, what) {
  must('psql', ['-q', '-h', socketDir, '-p', PORT, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', file], what)
}

function must(command, args, what) {
  const run = spawnSync(command, args, { encoding: 'utf8' })
  if (run.status === 0) return
  const said = [run.stderr, run.stdout].filter(Boolean).join('\n').trim()
  throw new Error(`${what}\n${said}`)
}
