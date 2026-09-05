#!/usr/bin/env node
// Bring a copy's database up to date with migrations/.
//
//   npm run migrate          the endpoint at t.ai4kanban.dev
//   npm run migrate:dev      the copy our own work posts into
//
// Forward only, and wrangler keeps the record of what has been applied. Run this before
// deploying a Worker that needs a new table, and deploy the service before shipping a sender
// that emits a new event name.

import { copyFrom, wrangler } from './copies.mjs'

const copy = copyFrom(process.argv)
process.stdout.write(wrangler(['d1', 'migrations', 'apply', copy.database, '--remote']))
