#!/usr/bin/env node
// Which WildCrane Runner version launchers start (#2001). Runners pick it up on their next
// start; nothing is pushed to a running one.
//
//   node scripts/runner-release.mjs                         what is set now
//   node scripts/runner-release.mjs stable <version>        every machine, candidate cleared
//   node scripts/runner-release.mjs candidate <version> <percent>
//                                                           that share of machines, the rest stable
//   node scripts/runner-release.mjs rollback                candidate back to 0%
//
// Values come from the environment or from cloud/.env: SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN

import { loadEnv, requireEnv } from './env.mjs'

const SHOW = `select stable, candidate, candidate_percent, updated_at from cloud.runner_release;`

main().catch((error) => {
  console.error(`runner-release: ${error.message}`)
  process.exit(1)
})

async function main() {
  const [command = 'show', version, percent] = process.argv.slice(2)
  if (command === 'show') return console.table(await query(SHOW))
  const [now] = await query(SHOW)
  if (command === 'stable') {
    requireVersion(version)
    await set(version, null, 0)
  } else if (command === 'candidate') {
    requireVersion(version)
    const share = Number(percent)
    if (!Number.isInteger(share) || share < 0 || share > 100) throw new Error('the share is a whole percent, 0 to 100')
    if (!now.stable) throw new Error('set a stable version first')
    await set(now.stable, version, share)
  } else if (command === 'rollback') {
    await set(now.stable, now.candidate, 0)
  } else {
    throw new Error(`unknown command "${command}" — show, stable, candidate or rollback`)
  }
  console.table(await query(SHOW))
}

function requireVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? '')) throw new Error('name a version like 1.2.3')
}

const set = (stable, candidate, percent) =>
  query(`select cloud.set_runner_release(${literal(stable)}, ${literal(candidate)}, ${percent});`)

const literal = (value) => (value == null ? 'null' : `'${String(value).replace(/'/g, "''")}'`)

async function query(sql) {
  const [ref, token] = requireEnv(await loadEnv(), 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN')
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Supabase answered ${response.status}: ${body}`)
  return JSON.parse(body)
}
