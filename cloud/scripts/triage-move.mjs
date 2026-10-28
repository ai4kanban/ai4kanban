#!/usr/bin/env node
// The one-off move of every workspace's triage items into its board (#2107). Migration 0100
// parked them in cloud.triage_moves; the Worker writes each workspace's as files under each
// project's `triage/` and drops the rows. Run right after the Worker carrying it is deployed;
// run again to finish what an interrupted run left.
//
//   npm run triage-move               every workspace still to move
//   npm run triage-move -- --dry-run  print them and change nothing
//
// Needs SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN and SUPABASE_SERVICE_ROLE_KEY, in the
// environment or cloud/.env; CLOUD_URL when not api.ai4kanban.dev.

import { loadEnv, requireEnv } from './env.mjs'
import { query } from './migrations.mjs'

const env = await loadEnv()
const [ref, token, key] = requireEnv(env, 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY')
const cloud = (env.CLOUD_URL || 'https://api.ai4kanban.dev').replace(/\/+$/, '')

const rows = await query(ref, token, 'select distinct workspace_id from cloud.triage_moves order by workspace_id;')
console.log(`triage-move: ${rows.length} workspace(s) to move`)
if (process.argv.includes('--dry-run')) process.exit(0)

let failed = 0
for (const { workspace_id: workspace } of rows) {
  const res = await fetch(`${cloud}/internal/workspaces/${workspace}/triage-move`, { method: 'POST', headers: { authorization: `Bearer ${key}` } })
  const body = await res.text()
  if (res.ok) console.log(`triage-move: ${workspace} ${body}`)
  else {
    failed++
    console.error(`triage-move: ${workspace} failed ${res.status} ${body}`)
  }
}
process.exit(failed ? 1 : 0)
