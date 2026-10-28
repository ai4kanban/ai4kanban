#!/usr/bin/env node
// The one-off move of every workspace's project boards and memory into one board (#2114).
// Migration 0084 parked the workspace memory in cloud.board_moves; the Worker writes each
// workspace's into its `Board`, beside every project's old board, and queues the old ones to go.
// Run right after the Worker carrying it is deployed, before the new Runner; run again to finish
// what an interrupted run left.
//
//   npm run board-move               every workspace still to move
//   npm run board-move -- --dry-run  print them and change nothing
//
// Needs SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN and SUPABASE_SERVICE_ROLE_KEY, in the
// environment or cloud/.env; CLOUD_URL when not api.ai4kanban.dev.

import { loadEnv, requireEnv } from './env.mjs'
import { query } from './migrations.mjs'

const env = await loadEnv()
const [ref, token, key] = requireEnv(env, 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY')
const cloud = (env.CLOUD_URL || 'https://api.ai4kanban.dev').replace(/\/+$/, '')

const rows = await query(ref, token, 'select distinct workspace_id from cloud.board_moves order by workspace_id;')
console.log(`board-move: ${rows.length} workspace(s) to move`)
if (process.argv.includes('--dry-run')) process.exit(0)

let failed = 0
for (const { workspace_id: workspace } of rows) {
  const res = await fetch(`${cloud}/internal/workspaces/${workspace}/board-move`, { method: 'POST', headers: { authorization: `Bearer ${key}` } })
  const body = await res.text()
  if (res.ok) console.log(`board-move: ${workspace} ${body}`)
  else {
    failed++
    console.error(`board-move: ${workspace} failed ${res.status} ${body}`)
  }
}
process.exit(failed ? 1 : 0)
