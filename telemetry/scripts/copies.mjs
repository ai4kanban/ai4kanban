// The two copies of the service, as the commands in this folder name them. These must match
// wrangler.jsonc — test/config.test.mjs is what checks they still do.

import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const serviceRoot = dirname(dirname(fileURLToPath(import.meta.url)))

// `flags` picks the copy for wrangler. The dev database is declared under `env.dev`, and
// wrangler only looks there when told to, so every command against it carries `--env dev`.
export const COPIES = {
  production: {
    database: 'ai4kanban-telemetry',
    bucket: 'ai4kanban-telemetry-archive',
    cases: 'ai4kanban-cases',
    endpoint: 'https://t.ai4kanban.dev',
    flags: [],
  },
  development: {
    database: 'ai4kanban-telemetry-dev',
    bucket: 'ai4kanban-telemetry-archive-dev',
    cases: 'ai4kanban-cases-dev',
    endpoint: 'https://t-dev.ai4kanban.dev',
    flags: ['--env', 'dev'],
  },
}

/** `--dev` on any of these commands means the copy our own work posts into. */
export const copyFrom = (argv) =>
  argv.includes('--dev') ? COPIES.development : COPIES.production

/**
 * Run wrangler with the proxy variables cleared — they break its API calls.
 *
 * `absentIf` names the one failure a caller expects — reading an archive file for a day the
 * bucket has none of. Everything else still throws, so a spent token or an unreachable bucket
 * is never read as a day that was never written.
 */
export function wrangler(args, { absentIf } = {}) {
  const env = { ...process.env }
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY']) {
    delete env[name]
    delete env[name.toLowerCase()]
  }
  const run = spawnSync('npx', ['--no-install', 'wrangler', ...args], {
    cwd: serviceRoot,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (run.status !== 0) {
    if (absentIf?.test(`${run.stderr}${run.stdout}`)) return null
    throw new Error(`wrangler ${args[0]} ${args[1] ?? ''} failed:\n${run.stderr || run.stdout}`)
  }
  return run.stdout
}

/**
 * One statement against a copy's database, with the account we already hold. There is no
 * endpoint that answers a read, so this is the only way any number leaves the service.
 */
export function statement(copy, sql) {
  const args = ['d1', 'execute', copy.database, ...copy.flags, '--remote', '--json']
  const out = wrangler([...args, '--command', sql])
  const start = out.indexOf('[')
  if (start < 0) throw new Error(`d1 execute returned no JSON:\n${out}`)
  return JSON.parse(out.slice(start))
}

export const query = (copy, sql) =>
  statement(copy, sql).flatMap((answer) => answer.results ?? [])
