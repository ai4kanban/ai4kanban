// The sign-in case's stand-in (../sign-in-to-the-hosted-board/stand-in.mjs) with a board of
// three groups and one lone card, each written a set number of days before now. Every account,
// workspace and card here is made up.
//
//   node stand-in.mjs <port> <cloud-ui origin>
//   AI4KANBAN_SUPABASE_URL = AI4KANBAN_CLOUD_URL = http://127.0.0.1:<port>, any anon key. A host other than
//   the UI's keeps the two cross-site, as Supabase and GitHub are to cloud.ai4kanban.dev.
import http from 'node:http'

const port = Number(process.argv[2] || 8790)
const ui = process.argv[3] || 'http://localhost:3790'
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

let billing = { plan: 'free', state: 'free', period: null, periodEnd: null, grantEnd: null }
const signedOut = new Set()

const ago = (days) => new Date(Date.now() - days * 86_400_000).toISOString()
const meta = (title, status, over = {}) => ({ title, priority: 'med', roi: 'high', status, release: '', blocked_by: [], related: [], questions: [], modules: [], ...over })
const card = (id, days, path, m, body = '') => ({ id, revision: `r${id}`, updatedAt: ago(days), data: { path, meta: m, body } })
const group = (folder, rootId, title, subs) => [
  card(rootId, 20, `todo/${folder}/root.md`, meta(title, 'todo'), `## Subtasks\n\n${subs.map((s) => `- [ ] #${s[0]}`).join('\n')}\n`),
  ...subs.map(([id, days, t, status]) => card(id, days, `todo/${folder}/${id}-sub.md`, meta(t, status))),
]
const read = (id, name) => ({
  workspace: { id, name },
  cards: [
    // root 20 days ago; one subtask touched yesterday
    ...group('30-checkout-redesign', 30, '结账页改版', [[31, 1, '新的支付方式选择', 'todo'], [32, 30, '订单摘要', 'todo']]),
    // root 20 days ago; one subtask being built, itself untouched for 30 days
    ...group('40-translations', 40, '多语言', [[41, 30, '日语翻译', 'implementing']]),
    // the whole group idle: newest write 9 days ago
    ...group('50-old-reports', 50, '旧报表迁移', [[51, 9, '月报', 'todo'], [52, 30, '年报', 'todo']]),
    card(21, 7, 'todo/21-dark-mode.md', meta('深色模式', 'todo'), '跟随系统切换深色模式。\n'),
  ],
  documents: [],
})
const workspaces = [
  { id: 'ws-demo-shop', name: 'Demo Shop' },
  { id: 'ws-side-project', name: 'Side Project' },
]

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
const bodyOf = (req) => new Promise((ok) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => ok(s)) })
const authed = (req) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '')
  return token.startsWith('demo-access') && !signedOut.has(token)
}
let n = 0
const tokens = () => ({ access_token: `demo-access-${++n}`, refresh_token: `demo-refresh-${n}`, expires_in: 3600, user: { id: 'user-demo' } })

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`)
  const p = url.pathname
  log(req.method, p + (url.searchParams.get('grant_type') ? `?grant_type=${url.searchParams.get('grant_type')}` : ''))

  // Auth: GitHub's consent screen answers "allow" at once.
  if (p === '/auth/v1/authorize') {
    const back = new URL(url.searchParams.get('redirect_to'))
    back.searchParams.set('code', 'demo-code')
    res.writeHead(302, { location: back.toString() }); return res.end()
  }
  if (p === '/auth/v1/token' && req.method === 'POST') { await bodyOf(req); return json(res, 200, tokens()) }
  if (p === '/auth/v1/logout') {
    signedOut.add((req.headers.authorization || '').replace(/^Bearer /, ''))
    res.writeHead(204); return res.end()
  }

  // Creem's checkout and customer portal.
  if (p === '/creem/checkout') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    return res.end(`<!doctype html><title>Checkout</title><body style="font:16px system-ui;padding:40px"><h1>Creem checkout (stand-in)</h1><p>AI4Kanban Pro · ${url.searchParams.get('period')}</p><a id="pay" href="${ui}/settings?checkout=done&subscription_id=sub_demo">Pay</a></body>`)
  }
  if (p === '/creem/portal') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    return res.end(`<!doctype html><title>Portal</title><body style="font:16px system-ui;padding:40px"><h1>Creem customer portal (stand-in)</h1></body>`)
  }

  if (!p.startsWith('/v1/')) return json(res, 404, {})
  if (!authed(req)) return json(res, 401, { error: { message: 'unauthorized' } })

  if (p === '/v1/session') return json(res, 200, { session: { admitted: true, handle: 'demo-reader', name: 'Demo Reader', email: 'reader@example.com', avatarUrl: null } })
  if (p === '/v1/workspaces') return json(res, 200, { workspaces })
  const ws = p.match(/^\/v1\/workspaces\/([^/]+)\/(read|events)$/)
  if (ws) {
    const w = workspaces.find((x) => x.id === ws[1])
    if (!w) return json(res, 404, {})
    return ws[2] === 'read' ? json(res, 200, read(w.id, w.name)) : json(res, 200, { events: [] })
  }
  if (p === '/v1/billing') return json(res, 200, { billing })
  if (p === '/v1/billing/checkout') {
    const { period } = JSON.parse((await bodyOf(req)) || '{}')
    billing = { ...billing, period }
    return json(res, 200, { url: `http://127.0.0.1:${port}/creem/checkout?period=${period}` })
  }
  if (p === '/v1/billing/confirm') {
    await bodyOf(req)
    billing = { plan: 'pro', state: 'active', period: billing.period || 'yearly', periodEnd: '2027-10-04T00:00:00Z', grantEnd: null }
    return json(res, 200, { billing })
  }
  if (p === '/v1/billing/portal') { await bodyOf(req); return json(res, 200, { url: `http://127.0.0.1:${port}/creem/portal` }) }
  json(res, 404, {})
}).listen(port, () => log(`stand-in on ${port}, cloud-ui at ${ui}`))
