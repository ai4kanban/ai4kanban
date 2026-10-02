// A stand-in Cloud for this case: it answers "this account has Pro" and nothing else, so
// Auto-sort draws unlocked. The account is made up; no real sign-in is involved.
//
//   node stand-in.mjs <port> <AI4KANBAN_HOME>
//
// It writes a fictional session.json into the given machine-settings folder. Start the board
// UI with AI4KANBAN_CLOUD_URL=http://127.0.0.1:<port>, AI4KANBAN_SUPABASE_URL=http://127.0.0.1:<port>
// and AI4KANBAN_SUPABASE_ANON_KEY=anon.

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const [port, home] = process.argv.slice(2)
if (!port || !home) {
  console.error('usage: node stand-in.mjs <port> <AI4KANBAN_HOME>')
  process.exit(1)
}
const url = `http://127.0.0.1:${port}`

fs.mkdirSync(home, { recursive: true })
fs.writeFileSync(
  path.join(home, 'session.json'),
  `${JSON.stringify({
    version: 1,
    supabaseUrl: url,
    accessToken: 'sample-access',
    refreshToken: 'sample-refresh',
    expiresAt: Date.now() + 365 * 24 * 60 * 60_000,
    subject: '00000000-0000-4000-8000-000000000001',
    email: 'sample@example.com',
  })}\n`,
)

const answers = {
  '/v1/billing': { billing: { plan: 'pro', periodEnd: null, grantEnd: null } },
  '/v1/session': { session: { admitted: true, subject: '00000000-0000-4000-8000-000000000001', email: 'sample@example.com' } },
}

http
  .createServer((req, res) => {
    const answer = answers[new URL(req.url, url).pathname]
    res.writeHead(answer ? 200 : 404, { 'content-type': 'application/json' })
    res.end(JSON.stringify(answer ?? { error: { code: 'not_found' } }))
  })
  .listen(Number(port), '127.0.0.1', () => console.log(`stand-in Cloud on ${url}`))
