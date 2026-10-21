// Fake Cloud for the desktop Billing panel: a cancelled, resumable Pro subscription.
// `node stand-in.mjs <port> [--fail-resume]` — with the flag the first resume fails.
// Each resume answers after two seconds.
import http from 'node:http'

const port = Number(process.argv[2] ?? 4791)
let failNext = process.argv.includes('--fail-resume')
const billing = { plan: 'pro', state: 'canceled', period: 'monthly', periodEnd: '2026-11-14T00:00:00Z', grantEnd: null, resumable: true, trialEnd: null, mayTrial: false }
const invoices = [{ id: 'inv_1', date: '2026-10-14T00:00:00Z', amount: 1500, currency: 'USD', status: 'paid' }]

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

http
  .createServer((req, res) => {
    const path = req.url.split('?')[0]
    let status = 200
    let body
    if (path === '/v1/session') body = { session: { admitted: true, handle: 'qa-user', name: 'QA User' } }
    else if (path === '/v1/billing') body = { billing, credits: { total: 5000, left: 5000, resetsAt: '2026-11-01T00:00:00Z' } }
    else if (path === '/v1/billing/invoices') body = { invoices }
    else if (path === '/v1/billing/resume' && req.method === 'POST') {
      if (failNext) {
        failNext = false
        status = 502
        body = { error: { code: 'billing_unavailable', message: 'Creem did not answer.' } }
      } else {
        Object.assign(billing, { state: 'active', resumable: false })
        body = { ok: true }
      }
    } else {
      status = 404
      body = { error: { code: 'not_found' } }
    }
    console.log(`${new Date().toISOString()} ${req.method} ${path} -> ${status} ${path === '/v1/billing' ? `state=${billing.state} resumable=${billing.resumable}` : ''}`)
    // A slow resume, so the button's busy state can be seen.
    setTimeout(() => send(res, status, body), path === '/v1/billing/resume' ? 2000 : 0)
  })
  .listen(port, '127.0.0.1', () => console.log(`fake Cloud on 127.0.0.1:${port}`))
