#!/usr/bin/env node
// Answer invite requests without opening the SQL editor. Same statements as
// "Answer an invite request" in cloud/README.md, run through the management API.
//
//   node scripts/invite.mjs                    who is waiting
//   node scripts/invite.mjs approve <handle>   issue the code; the next hourly run mails it
//   node scripts/invite.mjs codes              every code, and what became of it
//
// Values come from the environment or from cloud/.env, which is not in git:
//   SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN

import { loadEnv, requireEnv } from './env.mjs'

const PENDING = `select handle, email, requested_at, notified_at, notify_attempts, notify_error
                 from cloud.invite_requests where closed_at is null order by requested_at;`

const CODES = `select code, email, note, issued_at, sent_at, send_attempts, send_error,
                      withdrawn_at, redeemed_by, redeemed_at
               from cloud.invitations order by issued_at desc limit 50;`

main().catch((error) => {
  console.error(`invite: ${error.message}`)
  process.exit(1)
})

async function main() {
  const [command = 'list', handle] = process.argv.slice(2)

  if (command === 'list') return show(await query(PENDING), 'nobody is waiting.')
  if (command === 'codes') return show(await query(CODES), 'no code has been issued.')
  if (command === 'approve') {
    if (!handle) throw new Error('usage: node scripts/invite.mjs approve <handle>')
    const [row] = await query(`select cloud.approve_invite_request(${literal(handle)}) as code;`)
    console.log(`${handle}: code ${row.code} — the next hourly run mails it.`)
    return
  }
  throw new Error(`unknown command "${command}" — list, approve or codes`)
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

/** A handle comes from a mail we were sent, so it is quoted rather than trusted. */
function literal(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function show(rows, whenEmpty) {
  if (rows.length === 0) console.log(`invite: ${whenEmpty}`)
  else console.table(rows)
}
