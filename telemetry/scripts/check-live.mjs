#!/usr/bin/env node
// Read-only: is the live endpoint at t.ai4kanban.dev what this checkout's HEAD would deploy?
// Compares the applied migrations and the Worker's commit (from /health) with HEAD.
//
//   exit 0  up to date
//   exit 1  behind — lists the migrations to apply and the commits not live
//   exit 2  cannot check, with the reason
//
// The database is read with wrangler; a checkout without node_modules, such as a worktree,
// runs the main checkout's.

import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { WORKER_FILES, git } from './commit.mjs'
import { COPIES, query, serviceRoot } from './copies.mjs'

const COPY = COPIES.production
const HEALTH = `${COPY.endpoint}/health`

/**
 * The verdict, from what `source` reads: `commit()` the live commit or undefined,
 * `applied()` the applied migration names, `migrations()` the files, `known(sha)` whether
 * git has the commit, `unshipped(sha)` the Worker commits since it. A read that fails throws
 * fixed text: it becomes the reason, and triage matches items by their words.
 */
export async function check(source) {
  let commit, applied, pending
  try {
    ;[commit, applied] = await Promise.all([source.commit(), source.applied()])
    pending = (await source.migrations()).filter((file) => !applied.has(file))
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
  if (pending.length > 0) behind.push('Migrations to apply:', ...pending.map((file) => `  ${file}`))

  return behind.length === 0
    ? { code: 0, lines: [...lines, 'up to date'] }
    : { code: 1, lines: [...lines, ...behind] }
}

/** Where wrangler is installed: this checkout's telemetry/, else the main checkout's. */
export function wranglerHome(roots) {
  return roots.find((root) => existsSync(join(root, 'node_modules', '.bin', 'wrangler')))
}

async function main() {
  const main = join(dirname(git('rev-parse', '--path-format=absolute', '--git-common-dir')), 'telemetry')
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
      const cwd = wranglerHome([serviceRoot, main])
      if (!cwd) throw new Error('wrangler is not installed: run `npm install` in telemetry/.')
      let rows
      try {
        rows = query(COPY, 'SELECT name FROM d1_migrations;', { cwd })
      } catch {
        throw new Error('Could not read the applied migrations from D1.')
      }
      return new Set(rows.map((row) => row.name))
    },
    migrations: async () => (await readdir(join(serviceRoot, 'migrations'))).filter((f) => f.endsWith('.sql')).sort(),
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
