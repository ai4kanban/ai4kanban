// Stands in for Cloud with a signed-in Pro account, so Pro workflows can start. Made-up account.
// `node stand-in.mjs <port>`; the UI runs with AI4KANBAN_CLOUD_URL = AI4KANBAN_SUPABASE_URL =
// http://127.0.0.1:<port>, any anon key, and a session.json in AI4KANBAN_HOME naming that URL.
import http from 'node:http'

const port = Number(process.argv[2] ?? 4795)
const billing = { plan: 'pro', state: 'active', period: 'monthly', periodEnd: '2099-01-01T00:00:00Z', grantEnd: null, resumable: false }
http
  .createServer((req, res) => {
    const path = req.url.split('?')[0]
    const body =
      path === '/v1/session' ? { session: { admitted: true, handle: 'qa-user', name: 'QA User' } }
      : path === '/v1/billing' ? { billing, credits: { total: 5000, left: 5000, resetsAt: '2099-01-01T00:00:00Z' } }
      : null
    res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body ?? { error: { code: 'not_found', message: path } }))
  })
  .listen(port, '127.0.0.1')
