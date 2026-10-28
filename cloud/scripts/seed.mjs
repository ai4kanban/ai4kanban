#!/usr/bin/env node
// Grant seed partners six months of Pro (#1039). Same statements as "Grant a seed partner" in
// cloud/README.md, run through the management API.
//
//   node scripts/seed.mjs                  every grant, and whether it still runs
//   node scripts/seed.mjs grant <handle>   six months of Pro from now; refused if they ever had one
//
// Values come from the environment or from cloud/.env, which is not in git:
//   SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN

import { loadEnv, requireEnv } from './env.mjs'

const GRANTS = `select handle, starts_at, ends_at, ends_at > now() as running
                from cloud.seed_grants order by starts_at desc;`

main().catch((error) => {
  console.error(`seed: ${error.message}`)
  process.exit(1)
})

async function main() {
  const [command = 'list', handle] = process.argv.slice(2)

  if (command === 'list') {
    const rows = await query(GRANTS)
    if (rows.length === 0) console.log('seed: nobody has been granted Pro.')
    else console.table(rows)
    return
  }
  if (command === 'grant') {
    if (!handle) throw new Error('usage: node scripts/seed.mjs grant <handle>')
    const [row] = await query(`select cloud.grant_seed(${literal(handle)}) as done;`)
    const done = row.done
    console.log(`@${done.handle}: Pro until ${done.ends_at.slice(0, 10)}, from their next sign-in. Reply to their application by hand.`)
    return
  }
  throw new Error(`unknown command "${command}" — list or grant`)
}

async function query(sql) {
  const env = await loadEnv()
  const [ref, token] = requireEnv(env, 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN')
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Supabase answered ${response.status}: ${body}`)
  return JSON.parse(body)
}

/** A handle comes from an application form, so it is quoted rather than trusted. */
function literal(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}
