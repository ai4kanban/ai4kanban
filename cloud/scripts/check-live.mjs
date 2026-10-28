#!/usr/bin/env node
// Read-only: is the live Cloud service what this checkout's HEAD would deploy? Compares the
// applied migrations and the Worker's commit (from /health) with HEAD, and checks that the
// component host still reaches the Worker.
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
// The all-zero hash names no component, so a healthy host answers with serveComponent's 404.
const COMPONENT_PROBE = 'https://00000000000000000000000000000000.wildcraneusercontent.com/'
const CERT_ERROR = /CERT|SELF_SIGNED|SSL|TLS/

/**
 * The verdict, from what `source` reads: `commit()` the live commit or undefined,
 * `applied()` the applied versions and checksums, `migrations()` the files, `known(sha)`
 * whether git has the commit, `unshipped(sha)` the Worker commits since it,
 * `componentHost()` why the component host does not open, or undefined. A read that
 * fails throws fixed text: it becomes the reason, and triage matches items by their words.
 */
export async function check(source) {
  const host = source.componentHost().then((reason) => (reason ? `Component host does not open: ${reason}` : undefined))
  let commit, applied, pending
  try {
    ;[commit, applied] = await Promise.all([source.commit(), source.applied()])
    pending = pendingMigrations(await source.migrations(), applied)
  } catch (error) {
    return { code: 2, lines: [error.message, ...[await host].filter(Boolean)] }
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
  const hostFailure = await host
  if (hostFailure) behind.push(hostFailure)
  else lines.push('Component host opens.')

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

async function componentHost() {
  let response
  try {
    response = await fetch(COMPONENT_PROBE, { signal: AbortSignal.timeout(10_000) })
  } catch (error) {
    const code = error.cause?.code ?? ''
    if (error.name === 'TimeoutError') return 'no answer within 10s.'
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'its name does not resolve.'
    if (CERT_ERROR.test(code)) return `its certificate is not valid (${code}).`
    return `it cannot be reached${code ? ` (${code})` : ''}.`
  }
  const type = response.headers.get('content-type') ?? ''
  const body = await response.text().catch(() => '')
  if (response.status === 404 && type.startsWith('text/plain') && body === 'Not found') return undefined
  return `${COMPONENT_PROBE} answered ${response.status} ${type || 'without a content type'}, not the Worker's 404.`
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
    componentHost,
  })
  console.log(lines.join('\n'))
  process.exit(code)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
