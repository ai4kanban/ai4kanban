// Drives the hosted board (cloud-ui on :3797, pointed at ../sign-in-to-the-hosted-board/stand-in.mjs
// on :8797, which this starts) in headless Chrome, writing one record per step.
//   node run.mjs plan|resume <proof folder>
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const [CASE, P] = process.argv.slice(2)
const UI = 'http://localhost:3797'
const PORT = 9348
const H = new URL('.', import.meta.url).pathname
fs.rmSync(P, { recursive: true, force: true }); fs.mkdirSync(P, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let said = ''
const standIn = spawn('node', [`${H}../sign-in-to-the-hosted-board/stand-in.mjs`, '8797', UI, ...(CASE === 'resume' ? ['--fail-resume'] : [])])
standIn.stdout.on('data', (d) => (said += d))
const stood = () => { const s = said.trim().split('\n').filter((l) => !/stand-in on|favicon|\/v1\/session|\/v1\/workspaces/.test(l)).map((l) => `stand-in: ${l}`).join('\n'); said = ''; return s }

const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/qa-cloud-trial/chrome-${CASE}`, '--lang=zh-CN', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
let target
for (let i = 0; i < 50 && !target; i++) { await sleep(200); target = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json()).catch(() => null) }
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0; const waiting = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id) } }
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) }).then((d) => { if (d.error) throw new Error(`${method}: ${d.error.message}`); return d.result })
const evaluate = async (expr) => (await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value
const until = async (expr) => { for (let i = 0; i < 150; i++) { if (await evaluate(expr).catch(() => false)) return; await sleep(200) } throw new Error(`timed out: ${expr}`) }

await cdp('Page.enable')
await cdp('Network.enable'); await cdp('Network.setExtraHTTPHeaders', { headers: { 'accept-language': 'zh-CN,zh;q=0.9' } })
await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 900, deviceScaleFactor: 2, mobile: false })
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: "addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.head.append(s)})" })

const PANEL = "[...document.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === '套餐')"
const ready = `!!(${PANEL}) && document.readyState === 'complete'`
const go = async (url) => { await cdp('Page.navigate', { url: url.startsWith('http') ? url : `${UI}${url}` }); await sleep(500); await until(ready) }
const button = (label) => `[...document.querySelectorAll('button, a')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`
const press = async (label) => { await evaluate(`${button(label)}.click()`); await sleep(800) }
const page = async () => `url: ${(await evaluate('location.href')).replace(UI, '')}\npanel: ${(await evaluate(`${PANEL}.innerText`)).replace(/\n+/g, ' | ')}`
const shot = async (name) => {
  const b = await evaluate(`(() => { const r = (${PANEL}).getBoundingClientRect(); return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 } })()`)
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', clip: { ...b, scale: 1 } })
  fs.writeFileSync(`${P}/${name}`, Buffer.from(data, 'base64'))
}
const write = (name, lines) => fs.writeFileSync(`${P}/${name}`, lines.filter(Boolean).join('\n') + '\n')
const key = (k, code, vk) => cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }).then(() => cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }))
const awayFrom = async (host) => { for (let i = 0; i < 50; i++) { if (!(await evaluate('location.href')).startsWith(host)) return; await sleep(200) } }

// Signed in through the stand-in's GitHub, which agrees at once.
await go('/settings'); stood()

if (CASE === 'plan') {
  await shot('01-free-plan.png')
  await evaluate('document.activeElement.blur()')
  let n = 0
  while (!(await evaluate("document.activeElement?.name === 'period'")) && n++ < 30) await key('Tab', 'Tab', 9)
  await key('ArrowLeft', 'ArrowLeft', 37); await sleep(200)
  await shot('02-keyboard-focus.png')

  await press('购买 Pro'); await awayFrom(UI)
  write('03-get-pro.log', ['$ choose 按月, press 购买 Pro', `url: ${await evaluate('location.href')}`, `page: ${await evaluate('document.body.innerText.replace(/\\n+/g, " | ")')}`, stood()])

  await evaluate("document.getElementById('pay').click()"); await sleep(500); await until(ready)
  await until(`!${PANEL}.innerText.includes('确认')`).catch(() => {})
  write('04-paid.log', ['$ press Pay on the checkout page', await page(), stood()]); await shot('04-pro-plan.png')

  await press('管理账单'); await awayFrom(UI)
  write('05-manage.log', ['$ press 管理账单', `url: ${await evaluate('location.href')}`, `page: ${await evaluate('document.body.innerText.replace(/\\n+/g, " | ")')}`, stood()])

  await go('/billing/trial')
  write('06-already-pro.log', ['$ open /billing/trial (the pricing page\'s 免费试用 7 天)', await page(), stood()]); await shot('06-already-pro.png')
} else {
  // Pro · monthly, renewing: back from a paid checkout.
  await cdp('Page.navigate', { url: `${UI}/billing/checkout?period=monthly` }); await awayFrom(UI); await go(`${UI}/settings?checkout=done&subscription_id=sub_demo`)
  await until(`${PANEL}.innerText.includes('自动续费')`); stood()

  await press('管理账单'); await awayFrom(UI)
  await evaluate("document.getElementById('cancel').click()"); await sleep(500); await until(ready)
  write('01-cancel.log', ['$ press 管理账单, then Cancel renewal in the portal', await page(), stood()]); await shot('01-canceled.png')

  await go('/billing/trial')
  write('02-pricing-trial.log', ['$ open /billing/trial (the pricing page\'s 免费试用 7 天)', await page(), stood()]); await shot('02-pricing-trial.png')
  await go('/settings'); stood()

  await press('恢复续费'); await until(ready)
  write('03-resume-failed.log', ['$ press 恢复续费 (Creem fails)', await page(), stood()]); await shot('03-resume-failed.png')

  await press('恢复续费'); await until(ready)
  write('04-resumed.log', ['$ press 恢复续费 again', await page(), stood()]); await shot('04-resumed.png')
}

ws.close(); chrome.kill(); standIn.kill()
