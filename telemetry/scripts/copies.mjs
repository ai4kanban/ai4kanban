// The two copies of the service, as the commands in this folder name them. These must match
// wrangler.jsonc — test/config.test.mjs is what checks they still do.

import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const serviceRoot = dirname(dirname(fileURLToPath(import.meta.url)))

export const COPIES = {
  production: { database: 'ai4kanban-telemetry', endpoint: 'https://t.ai4kanban.dev' },
  development: { database: 'ai4kanban-telemetry-dev', endpoint: 'https://t-dev.ai4kanban.dev' },
}

/** `--dev` on any of these commands means the copy our own work posts into. */
export const copyFrom = (argv) =>
  argv.includes('--dev') ? COPIES.development : COPIES.production

/** Run wrangler with the proxy variables cleared — they break its API calls. */
export function wrangler(args) {
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
    throw new Error(`wrangler ${args[0]} ${args[1] ?? ''} failed:\n${run.stderr || run.stdout}`)
  }
  return run.stdout
}

/**
 * One statement against a copy's database, with the account we already hold. There is no
 * endpoint that answers a read, so this is the only way any number leaves the service.
 */
export function statement(copy, sql) {
  const out = wrangler(['d1', 'execute', copy.database, '--remote', '--json', '--command', sql])
  const start = out.indexOf('[')
  if (start < 0) throw new Error(`d1 execute returned no JSON:\n${out}`)
  return JSON.parse(out.slice(start))
}

export const query = (copy, sql) =>
  statement(copy, sql).flatMap((answer) => answer.results ?? [])
