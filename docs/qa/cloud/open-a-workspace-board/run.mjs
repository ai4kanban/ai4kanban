// Drives the hosted board (cloud-ui on :3793, pointed at ../sign-in-to-the-hosted-board/stand-in.mjs
// on :8793, which this starts) in headless Chrome, writing one record per step.
//   node run.mjs <proof folder>
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const [P] = process.argv.slice(2)
const UI = 'http://localhost:3793'
const PORT = 9353
const H = new URL('.', import.meta.url).pathname
fs.rmSync(P, { recursive: true, force: true }); fs.mkdirSync(P, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const standIn = spawn('node', [`${H}../sign-in-to-the-hosted-board/stand-in.mjs`, '8793', UI], { stdio: 'ignore' })
fs.rmSync('/tmp/qa-cloud-tab/chrome', { recursive: true, force: true })
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/qa-cloud-tab/chrome', '--lang=zh-CN', '--no-first-run', 'about:blank'], { stdio: 'ignore' })
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
await cdp('Emulation.setDeviceMetricsOverride', { width: 1000, height: 700, deviceScaleFactor: 2, mobile: false })
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: "addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.head.append(s)})" })

const has = (text) => `document.readyState === 'complete' && document.body.innerText.includes(${JSON.stringify(text)})`
const go = async (url, text) => { await cdp('Page.navigate', { url: `${UI}${url}` }); await sleep(500); await until(has(text)) }
const el = (label) => `[...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().includes(${JSON.stringify(label)}))`
const click = async (label) => { await evaluate(`${el(label)}.click()`); await sleep(1000) }
const shot = async (name) => { const { data } = await cdp('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${P}/${name}`, Buffer.from(data, 'base64')) }
const key = (k, code, vk) => cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk }).then(() => cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk }))

// Signed in through the stand-in's GitHub, which agrees at once.
await go('/', '你的工作区')

await click('Demo Shop'); await until(has('跳过')); await sleep(500)
await shot('01-tour.png')

await click('跳过'); await until(has('导出发票为 CSV')); await sleep(500)
await shot('02-board.png')

await click('导出发票为 CSV'); await until(has('在应用中打开')); await sleep(500)
const card = await evaluate('location.pathname')
await shot('03-card.png')

await go('/ws-not-mine', '当前账号无法读取该看板'); await sleep(300)
await shot('04-not-yours.png')

await go(card, '在应用中打开')
await evaluate('document.activeElement.blur()')
for (let n = 0; n < 30 && !(await evaluate(`document.activeElement === ${el('在应用中打开')}`)); n++) await key('Tab', 'Tab', 9)
await sleep(300)
await shot('05-keyboard-focus.png')

// Headless Chrome draws no tab strip: lay the page's own icon and title out as a tab, in each scheme.
const icon = await evaluate("document.querySelector('link[rel~=icon]')?.href")
const title = await evaluate('document.title')
const tab = (bar, chip, text) => `<div style="background:${bar};padding:8px 8px 0"><div style="display:inline-flex;align-items:center;gap:8px;width:220px;height:34px;padding:0 12px;border-radius:8px 8px 0 0;background:${chip};color:${text};font:12px system-ui"><img src="${icon}" width="16" height="16">${title}</div></div>`
for (const [scheme, bar, chip, text, name] of [['light', '#dee1e6', '#ffffff', '#202124', '06-tab-light.png'], ['dark', '#202124', '#35363a', '#e8eaed', '07-tab-dark.png']]) {
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
  await cdp('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await evaluate(`document.body.style.margin = 0; document.body.innerHTML = ${JSON.stringify(tab(bar, chip, text))}; new Promise((r) => document.images[0].complete ? r(1) : (document.images[0].onload = r))`)
  await sleep(300)
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 252, height: 42, scale: 3 } })
  fs.writeFileSync(`${P}/${name}`, Buffer.from(data, 'base64'))
}

ws.close(); chrome.kill(); standIn.kill()
