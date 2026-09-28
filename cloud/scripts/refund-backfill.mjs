#!/usr/bin/env node
// Revoke Pro on refunds made before #1188 shipped: a signed notification per subscription sends
// each row through the live webhook, which reads its refunds off Creem.
//
//   node scripts/refund-backfill.mjs          notify each row, then print what it reads as
//   node scripts/refund-backfill.mjs --list   print the rows and send nothing
//
// Values come from the environment or from cloud/.env, which is not in git:
//   SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN, CREEM_WEBHOOK_SECRET

import { createHmac } from 'node:crypto'

import { loadEnv, requireEnv } from './env.mjs'

const WEBHOOK = 'https://api.ai4kanban.dev/v1/billing/webhook'
const ROWS = `select id, status, current_period_end, refunded_through, revoked_at
              from cloud.subscriptions order by updated_at;`

main().catch((error) => {
  console.error(`refund-backfill: ${error.message}`)
  process.exit(1)
})

async function main() {
  const env = await loadEnv()
  const [ref, token] = requireEnv(env, 'SUPABASE_PROJECT_REF', 'SUPABASE_ACCESS_TOKEN')
  const query = (sql) => run(ref, token, sql)

  const rows = await query(ROWS)
  if (process.argv.includes('--list') || rows.length === 0) return console.table(rows)

  const [secret] = requireEnv(env, 'CREEM_WEBHOOK_SECRET')
  for (const row of rows) {
    const body = JSON.stringify({ eventType: 'subscription.update', object: { id: row.id, object: 'subscription' } })
    const response = await fetch(WEBHOOK, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'creem-signature': createHmac('sha256', secret).update(body).digest('hex'),
      },
      body,
    })
    if (!response.ok) console.error(`${row.id}: webhook answered ${response.status}: ${await response.text()}`)
  }
  console.table(await query(ROWS))
}

async function run(ref, token, sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const body = await response.text()
  if (!response.ok) throw new Error(`Supabase answered ${response.status}: ${body}`)
  return JSON.parse(body)
}
