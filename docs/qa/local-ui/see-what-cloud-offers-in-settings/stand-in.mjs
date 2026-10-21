// Stands in for Cloud with a signed-in account, made up. `node stand-in.mjs <port>`; the UI runs
// with AI4KANBAN_CLOUD_URL = AI4KANBAN_SUPABASE_URL = http://127.0.0.1:<port>, any anon key, and a
// session.json in AI4KANBAN_HOME naming that URL. GET /_set?plan=free|pro switches the plan; the
// free account never had Pro, so its plan page offers the trial (#1932).
import http from 'node:http'

const port = Number(process.argv[2] ?? 4795)
let plan = 'pro'
const billing = () =>
  plan === 'pro'
    ? { plan: 'pro', state: 'active', period: 'monthly', periodEnd: '2099-01-01T00:00:00Z', grantEnd: null, resumable: false, trialEnd: null, mayTrial: false }
    : { plan: 'free', state: 'free', period: null, periodEnd: null, grantEnd: null, resumable: false, trialEnd: null, mayTrial: true }
http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    if (url.pathname === '/_set') plan = url.searchParams.get('plan') ?? plan
    const body =
      url.pathname === '/_set' ? { plan }
      : url.pathname === '/v1/session' ? { session: { admitted: true, handle: 'qa-user', name: 'QA User' } }
      : url.pathname === '/v1/billing' ? { billing: billing(), credits: plan === 'pro' ? { total: 5000, left: 5000, resetsAt: '2099-01-01T00:00:00Z' } : null }
      : url.pathname === '/v1/billing/invoices' ? { invoices: [] }
      : null
    res.writeHead(body ? 200 : 404, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body ?? { error: { code: 'not_found', message: url.pathname } }))
  })
  .listen(port, '127.0.0.1')
