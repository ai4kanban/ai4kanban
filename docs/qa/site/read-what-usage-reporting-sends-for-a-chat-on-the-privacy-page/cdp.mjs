// Tiny CDP driver: one page, evaluate, click, type, screenshot, fetch stand-in.
import fs from 'node:fs'
const PORT = process.env.CDP_PORT || 9261
export async function open(width = 1280, height = 1000, mobile = false) {
  const t = await (await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  let id = 0
  const pending = new Map()
  const handlers = []
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(JSON.stringify(d.error))) : p.res(d.result) }
    else if (d.method) for (const h of handlers) h(d)
  })
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })) })
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const page = {
    send, sleep, on: (h) => handlers.push(h), target: t,
    async nav(url, wait = 2500) { await send('Page.navigate', { url }); await sleep(wait) },
    async ev(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed'); return r.result.value },
    async box(sel) { return page.ev(`(()=>{const e=${sel};if(!e)return null;e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return {x:b.x,y:b.y+scrollY,w:b.width,h:b.height,vy:b.y}})()`) },
    async click(sel) { const b = await page.box(sel); if (!b) throw new Error('no element: ' + sel); await sleep(1500); const b2 = await page.ev(`(()=>{const b=(${sel}).getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`)
      for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: b2.x, y: b2.y, button: 'left', clickCount: 1 }) },
    async type(text) { for (const ch of text) { await send('Input.insertText', { text: ch }); await sleep(15) } },
    async shot(file, clip) { const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')) },
    async close() { ws.close(); await fetch(`http://localhost:${PORT}/json/close/${t.id}`) },
  }
  return page
}
// Element by visible text: tag selector + exact/contains text, only visible ones.
export const byText = (tag, text) => `[...document.querySelectorAll(${JSON.stringify(tag)})].find(e=>e.getBoundingClientRect().width>0&&e.textContent.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}))`
