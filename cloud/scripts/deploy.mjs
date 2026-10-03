#!/usr/bin/env node
// `wrangler deploy`, stamped with the commit it ships so `/health` can name it and
// `npm run check:live` can compare it. Extra arguments pass through to wrangler.

import { spawnSync } from 'node:child_process'

import { workerCommit } from './commit.mjs'

const commit = workerCommit()
const env = { ...process.env }
for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']) delete env[name]

const { status } = spawnSync(
  'wrangler',
  ['deploy', '--var', `COMMIT:${commit}`, '--message', commit, ...process.argv.slice(2)],
  { stdio: 'inherit', env },
)
process.exit(status ?? 1)
