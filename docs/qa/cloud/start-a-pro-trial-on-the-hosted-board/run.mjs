// Drives the hosted board (cloud-ui on :3796, against server.mjs) in headless Chrome and writes
// one record per step into <proof folder>. Run pg.sh first; server.mjs and the UI must be up.
//   node run.mjs <proof folder>
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'

const P = process.argv[2]
const Q = '/tmp/qa-cloud-trial'
const UI = 'http://localhost:3796'
const PORT = 9347
const NEW = '44444444-4444-4444-8444-444444444444'
const TRIED = '55555555-5555-4555-8555-555555555555'
const H = new URL('.', import.meta.url).pathname
fs.rmSync(P, { recursive: true, force: true }); fs.mkdirSync(P, { recursive: true })

const cookieFor = (sub) => execFileSync('node', [`${H}session.mjs`, sub]).toString()
const sql = (q) => execFileSync('psql', ['-h', `${Q}/pg`, '-p', '55492', '-U', 'postgres', '-At', '-c', q]).toString().trim()
let mark = 0
const worker = () => { const all = fs.readFileSync(`${Q}/server.log`, 'utf8'); const s = all.slice(mark); mark = all.length; return s.trim().split('\n').filter((l) => l && !/^listening|favicon|GET \/v1\/session/.test(l)).map((l) => `worker: ${l}`).join('\n') }

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${Q}/chrome`, '--lang=zh-CN', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let target
for (let i = 0; i < 50 && !target; i++) { await sleep(200); target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json()).catch(() => null) }
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0; const waiting = new Map(); const events = []
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id) } else events.push(d) }
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) }).then((d) => { if (d.error) throw new Error(`${method}: ${d.error.message}`); return d.result })
const evaluate = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value
const until = async (expr) => { for (let i = 0; i < 150; i++) { if (await evaluate(expr).catch(() => false)) return; await sleep(200) } throw new Error(`timed out: ${expr}`) }

await cdp('Page.enable'); await cdp('Network.enable')
await cdp('Network.setExtraHTTPHeaders', { headers: { 'accept-language': 'zh-CN,zh;q=0.9' } })
await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 900, deviceScaleFactor: 2, mobile: false })
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: "addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.head.append(s)})" })

const signIn = async (sub) => { await cdp('Network.deleteCookies', { name: 'akb_session', url: UI }); await cdp('Network.setCookie', { name: 'akb_session', value: cookieFor(sub), url: UI, httpOnly: true, sameSite: 'Lax' }) }
const PANEL = "[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === '套餐')"
const ready = `!!(${PANEL}) && document.readyState === 'complete'`
const go = async (path) => { await cdp('Page.navigate', { url: `${UI}${path}` }); await sleep(500); await until(ready) }
const press = async (label) => { await evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)}).click()`); await sleep(800) }
const page = async () => `url: ${(await evaluate('location.href')).replace(UI, '')}\npanel: ${(await evaluate(`${PANEL}.innerText`)).replace(/\n+/g, ' | ')}`
const shot = async (name) => {
  const b = await evaluate(`(() => { const r = (${PANEL}).getBoundingClientRect(); return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 } })()`)
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', clip: { ...b, scale: 1 } })
  fs.writeFileSync(`${P}/${name}`, Buffer.from(data, 'base64'))
}
const write = (name, lines) => fs.writeFileSync(`${P}/${name}`, lines.filter(Boolean).join('\n') + '\n')
const trials = () => `db: cloud.pro_trials (user|days) ${sql("select left(user_id::text, 8), round(extract(epoch from ends_at - starts_at) / 86400) from cloud.pro_trials order by starts_at").replace(/\n/g, '; ')}`

// 1. Never had Pro.
worker(); await signIn(NEW); await go('/settings')
write('01-untried.log', ['$ open /settings as an account that never had Pro', await page(), worker()]); await shot('01-untried.png')

// 2. The old purchase link.
await go('/billing/checkout?period=yearly')
write('02-checkout-refused.log', ['$ open /billing/checkout?period=yearly', await page(), worker()])

// 3. Start the trial.
await press('免费试用 7 天'); await until(ready)
const token = JSON.parse(Buffer.from(cookieFor(NEW), 'base64url')).accessToken
const billing = await fetch('http://127.0.0.1:8796/v1/billing', { headers: { authorization: `Bearer ${token}` } }).then((r) => r.text())
write('03-trialing.log', ['$ press 免费试用 7 天', await page(), trials(), worker().split('\n').filter((l) => !l.includes('GET /v1/billing')).join('\n'), '', '$ GET /v1/billing', billing])
await shot('03-trialing.png'); worker()

// 4. While it runs: no purchase, no second trial.
await go('/billing/checkout?period=monthly')
const a = await page()
await go('/billing/trial')
write('04-no-purchase-or-second-trial.log', ['$ open /billing/checkout?period=monthly', a, '', '$ open /billing/trial (the pricing page\'s button)', await page(), trials(), worker()])

// 5. Trial already over.
await signIn(TRIED); await go('/settings')
const b5 = await page(); await shot('05-trial-over.png')
await go('/billing/trial')
write('05-trial-over.log', ['$ open /settings as an account whose trial ended yesterday', b5, '', '$ open /billing/trial', await page(), trials(), worker()])

// 6. Buy.
await go('/settings'); worker()
await press('购买 Pro'); await until("document.title === 'Checkout'")
write('06-buy.log', ['$ keep 按年, press 购买 Pro', `url: ${await evaluate('location.href')}`, `title: ${await evaluate('document.title')}`, worker()])

ws.close(); chrome.kill()
