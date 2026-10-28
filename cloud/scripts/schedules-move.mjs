#!/usr/bin/env node
// The one-off move of each project's `schedules.md` into cloud.agent_schedules (#2138), and the
// file off its board. Run right after the Worker carrying it is deployed, before a Runner built
// without `schedules.md` as a board file, so every Runner drops its local copy at its next pull.
// Running it again moves nothing twice.
//
//   npm run schedules-move               every project
//   npm run schedules-move -- --dry-run  print them and change nothing
//
// Needs SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN and SUPABASE_SERVICE_ROLE_KEY, in the
// environment or cloud/.env; CLOUD_URL when not api.ai4kanban.dev.

import { loadEnv, requireEnv } from './env.mjs'
import { query } from './migrations.mjs'

const env = await loadEnv()
const [ref, token, key] = requireEnv(env, 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY')
const cloud = (env.CLOUD_URL || 'https://api.ai4kanban.dev').replace(/\/+$/, '')

const rows = await query(ref, token, 'select id from cloud.projects order by id;')
console.log(`schedules-move: ${rows.length} project(s)`)
if (process.argv.includes('--dry-run')) process.exit(0)

let failed = 0
for (const { id } of rows) {
  const res = await fetch(`${cloud}/internal/projects/${id}/schedules-move`, { method: 'POST', headers: { authorization: `Bearer ${key}` } })
  const body = await res.text()
  if (res.ok) console.log(`schedules-move: ${id} ${body}`)
  else {
    failed++
    console.error(`schedules-move: ${id} failed ${res.status} ${body}`)
  }
}
process.exit(failed ? 1 : 0)
