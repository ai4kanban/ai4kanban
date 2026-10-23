// Usage: SITE=127.0.0.1:4371 CDP_PORT=9371 OUT=<proof dir> node download.mjs
import fs from 'node:fs'
import { open, byText } from './cdp.mjs'
const D = (process.env.OUT || '.') + '/'
const S = 'http://' + (process.env.SITE || '127.0.0.1:4330')
const p = await open()
await p.send('Storage.clearDataForOrigin', { origin: S, storageTypes: 'all' })
await p.nav(S + '/download', 5000)
let b = await p.box(`document.querySelector('main h1')`)
await p.ev('scrollTo(0,0)'); await p.sleep(300)
const all = await p.box(byText('main *', 'ALL DOWNLOADS'))
await p.ev('scrollTo(0,0)'); await p.sleep(300)
const dark = await p.ev(`(()=>{let e=${byText('main *', 'ALL DOWNLOADS')};while(e&&e.getBoundingClientRect().height<150)e=e.parentElement;const r=e.getBoundingClientRect();return r.bottom+scrollY})()`)
await p.shot(D + '01-mac.png', { x: 0, y: Math.max(0, b.y - 60), width: 1280, height: dark - b.y + 90 })
// first-open tabs
const fo = await p.box(byText('main h2, main h3, main p, main div', 'First open'))
await p.click(byText('main button, main [role=tab]', 'Windows'))
await p.sleep(600)
const sec = await p.ev(`(()=>{const h=[...document.querySelectorAll('main h2')].find(e=>/first open/i.test(e.textContent));const n=[...document.querySelectorAll('main h2')].find(e=>/use/i.test(e.textContent)&&e!==h);h.scrollIntoView({block:'start'});const a=h.getBoundingClientRect().y+scrollY;const z=n?n.getBoundingClientRect().y+scrollY:a+500;return {y:a,h:z-a-40,text:h.parentElement.parentElement.innerText}})()`)
await p.sleep(300)
await p.shot(D + '02-first-open-windows.png', { x: 0, y: sec.y - 30, width: 1280, height: Math.min(810, sec.h + 30) })
console.log(sec.text)
await p.click(byText('main button, main [role=tab]', 'Linux'))
await p.sleep(600)
await p.shot(D + '02b-first-open-linux.png', { x: 0, y: sec.y - 30, width: 1280, height: Math.min(810, sec.h + 30) })
const linux = await p.ev(`(()=>{const h=[...document.querySelectorAll('main h2')].find(e=>/first open/i.test(e.textContent));return h.parentElement.parentElement.innerText.split('\\n').filter(l=>/AppImage/.test(l)).join(' / ')})()`)
const files = await p.ev(`[...document.querySelectorAll('main a[href*="releases/download"]')].map(a=>a.href.split('/').pop())`)
fs.writeFileSync(D + '02b-linux.log', `First open, Linux: ${linux}\nfiles linked on the page: ${files.join(' · ')}\n`)
console.log(fs.readFileSync(D + '02b-linux.log', 'utf8'))
await p.click(byText('main button, main summary', 'in a terminal'))
await p.sleep(600)
const term = await p.ev(`(()=>{const b=${byText('main button, main summary', 'in a terminal')};const e=b.closest('details')||b.parentElement;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {y:r.y+scrollY,h:r.height,text:e.innerText}})()`)
await p.sleep(300)
await p.shot(D + '02c-terminal.png', { x: 0, y: term.y - 20, width: 1280, height: Math.min(700, term.h + 40) })
fs.appendFileSync(D + '02b-linux.log', `\nUse akb in a terminal, opened:\n${term.text}\n`)
const hrefs = await p.ev(`[...new Set([...document.querySelectorAll('main a[href*="releases/download"]')].map(a=>a.href))]`)
await p.close()
// Windows visitor
const w = await open()
await w.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36', platform: 'Win32' })
await w.nav(S + '/download', 5000)
b = await w.box(`document.querySelector('main h1')`)
await w.ev('scrollTo(0,0)'); await w.sleep(300)
await w.shot(D + '03-windows-visitor.png', { x: 0, y: Math.max(0, b.y - 40), width: 1280, height: 260 })
console.log('---', await w.ev(`[...document.querySelectorAll('main a')][0].innerText+' -> '+[...document.querySelectorAll('main a')][0].href`))
await w.close()
// What a shared link and an AI reader see
let meta = ''
for (const path of ['/download', '/zh/download', '/es/download', '/ja/download', '/fr/download']) {
  const m = await open(); await m.nav(S + path, 3000)
  meta += path + ' ' + await m.ev(`JSON.stringify({title:document.title,description:document.querySelector('meta[name=description]').content,ogTitle:document.querySelector('meta[property="og:title"]')?.content,ogDescription:document.querySelector('meta[property="og:description"]')?.content})`) + '\n'
  await m.close()
}
meta += '\n/site.webmanifest description: ' + (await (await fetch(S + '/site.webmanifest')).json()).description + '\n'
for (const f of ['/llms.txt', '/index.md']) meta += `\n${f}:\n` + (await (await fetch(S + f)).text()).split('\n').slice(0, 14).join('\n') + '\n'
fs.writeFileSync(D + '05-meta.log', meta); console.log(meta)
// the five download links, headers only
let links = ''
for (const u of hrefs) { const r = await fetch(u, { method: 'HEAD' }); links += `HEAD ${u}\n-> ${r.status} ${r.headers.get('content-type')}\n` }
fs.writeFileSync(D + '04-links.log', links); console.log(links)
