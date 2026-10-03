import { execFileSync } from 'node:child_process'

import { serviceRoot } from './copies.mjs'

/** What a deploy ships, relative to telemetry/. Migrations are compared on their own. */
export const WORKER_FILES = ['src', 'contract.ts', 'wrangler.jsonc', 'package.json', 'package-lock.json']

export const git = (...args) =>
  execFileSync('git', args, { cwd: serviceRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** HEAD's short commit, with `+dirty` when the Worker files have uncommitted changes. */
export function workerCommit() {
  const head = git('rev-parse', '--short', 'HEAD')
  return git('status', '--porcelain', '--', ...WORKER_FILES) ? `${head}+dirty` : head
}
