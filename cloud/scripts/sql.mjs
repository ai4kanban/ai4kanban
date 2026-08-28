#!/usr/bin/env node
// Run one statement against the Cloud project, the same way migrate.mjs does.
//   node scripts/sql.mjs "select handle from cloud.admitted_accounts;"

import { loadEnv, requireEnv } from './env.mjs'

const [ref, token] = requireEnv(await loadEnv(), 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN')
const query = process.argv[2]
if (!query) throw new Error('usage: node scripts/sql.mjs "<sql>"')

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ query }),
})
const body = await response.text()
if (!response.ok) {
  console.error(`sql: Supabase answered ${response.status}: ${body}`)
  process.exit(1)
}
console.log(body)
