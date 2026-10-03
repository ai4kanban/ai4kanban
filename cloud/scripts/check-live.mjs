#!/usr/bin/env node
// Read-only: is the live Cloud service what this checkout's HEAD would deploy? Compares the
// applied migrations and the Worker's commit (from /health) with HEAD.
//
//   exit 0  up to date
//   exit 1  behind — lists the migrations to apply and the commits not live
//   exit 2  cannot check, with the reason
//
// Credentials as for `npm run migrate`; when neither the shell nor this checkout's cloud/.env
// has them, the main checkout's cloud/.env is read, so it runs from a worktree.

import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { WORKER_FILES, git } from './commit.mjs'
import { loadEnv, requireEnv } from './env.mjs'
import { pendingMigrations, query, readMigrations } from './migrations.mjs'

const HEALTH = 'https://api.ai4kanban.dev/health'
const CREDENTIALS = ['SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN']

/**
 * The verdict, from what `source` reads: `commit()` the live commit or undefined,
 * `applied()` the applied versions and checksums, `migrations()` the files, `known(sha)`
 * whether git has the commit, `unshipped(sha)` the Worker commits since it. A read that
 * fails throws fixed text: it becomes the reason, and triage matches items by their words.
 */
export async function check(source) {
  let commit, applied, pending
  try {
    ;[commit, applied] = await Promise.all([source.commit(), source.applied()])
    pending = pendingMigrations(await source.migrations(), applied)
  } catch (error) {
    return { code: 2, lines: [error.message] }
  }

  const lines = [`Live: commit ${commit ?? 'unknown'}, ${applied.size} migrations applied.`]
  const sha = commit?.replace(/\+dirty$/, '')
  const behind = []
  if (!commit) behind.push('The live Worker does not report its commit: it was not deployed with `npm run deploy`.')
  else if (!(await source.known(sha))) behind.push("The live commit is not in this repository's history.")
  else {
    if (commit !== sha) behind.push('The live Worker was deployed with uncommitted changes.')
    const commits = await source.unshipped(sha)
    if (commits.length > 0) behind.push('Commits not live:', ...commits.map((line) => `  ${line}`))
  }
  if (pending.length > 0) behind.push('Migrations to apply:', ...pending.map((m) => `  ${m.file}`))

  return behind.length === 0
    ? { code: 0, lines: [...lines, 'up to date'] }
    : { code: 1, lines: [...lines, ...behind] }
}

async function credentials() {
  const env = await loadEnv()
  if (CREDENTIALS.every((name) => env[name])) return env
  const main = dirname(git('rev-parse', '--path-format=absolute', '--git-common-dir'))
  return { ...(await loadEnv(join(main, 'cloud', '.env'))), ...env }
}

async function main() {
  const { code, lines } = await check({
    async commit() {
      let body
      try {
        const response = await fetch(HEALTH)
        if (!response.ok) throw new Error()
        body = await response.json()
      } catch {
        throw new Error(`Could not read ${HEALTH}.`)
      }
      return body.commit || undefined
    },
    async applied() {
      const [ref, token] = requireEnv(await credentials(), ...CREDENTIALS)
      let rows
      try {
        rows = await query(ref, token, 'select version, checksum from cloud.schema_migrations;')
      } catch {
        throw new Error('Could not read the applied migrations from Supabase.')
      }
      return new Map(rows.map((row) => [row.version, row.checksum]))
    },
    migrations: readMigrations,
    known(sha) {
      try {
        git('cat-file', '-e', `${sha}^{commit}`)
        return true
      } catch {
        return false
      }
    },
    unshipped: (sha) => git('log', '--oneline', `${sha}..HEAD`, '--', ...WORKER_FILES).split('\n').filter(Boolean),
  })
  console.log(lines.join('\n'))
  process.exit(code)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
