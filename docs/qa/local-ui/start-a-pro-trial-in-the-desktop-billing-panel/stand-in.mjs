// Fake Cloud for the Billing panel's trial (#1932): a signed-in account that never had Pro.
// `node stand-in.mjs <port>`; POST /v1/billing/trial starts a 7-day trial with 1,000 credits,
// GET /_set?state=ended ends it. Checkout answers a made-up link. The account is made up.
import http from 'node:http'

const port = Number(process.argv[2] ?? 4862)
const DAY = 86_400_000
let trialEnd = null
let ended = false
const billing = () => ({
  plan: trialEnd ? 'pro' : 'free',
  state: 'free',
  period: null,
  periodEnd: null,
  grantEnd: null,
  resumable: false,
  trialEnd,
  mayTrial: !trialEnd && !ended,
})

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    const path = url.pathname
    let status = 200
    let body
    if (path === '/_set') {
      if (url.searchParams.get('state') === 'ended') (trialEnd = null), (ended = true)
      body = billing()
    } else if (path === '/v1/session') body = { session: { admitted: true, handle: 'qa-user', name: 'QA User' } }
    else if (path === '/v1/billing')
      body = { billing: billing(), credits: trialEnd ? { total: 1000, left: 1000, resetsAt: null } : null }
    else if (path === '/v1/billing/invoices') body = { invoices: [] }
    else if (path === '/v1/billing/trial' && req.method === 'POST') {
      if (billing().mayTrial) {
        trialEnd = new Date(Date.now() + 7 * DAY).toISOString()
        body = { ok: true }
      } else (status = 409), (body = { error: { code: 'trial_used', message: 'The trial was already used.' } })
    } else if (path === '/v1/billing/checkout' && req.method === 'POST') {
      body = billing().mayTrial || trialEnd ? { url: 'https://cloud.example/settings' } : { url: 'https://checkout.example/qa' }
    } else (status = 404), (body = { error: { code: 'not_found', message: path } })
    console.log(`${new Date().toISOString()} ${req.method} ${path} -> ${status}${path === '/v1/billing' ? ` plan=${billing().plan} trialEnd=${trialEnd} mayTrial=${billing().mayTrial}` : ''}`)
    // A slow start, so the button's busy state can be seen.
    setTimeout(() => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }, path === '/v1/billing/trial' ? 1500 : 0)
  })
  .listen(port, '127.0.0.1', () => console.log(`fake Cloud on 127.0.0.1:${port}`))
