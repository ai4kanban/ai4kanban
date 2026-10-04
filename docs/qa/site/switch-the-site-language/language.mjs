import fs from 'node:fs'
import { open, byText } from './cdp.mjs'
const D = '/tmp/qa-site/language/'
const p = await open(1280, 900)
await p.send('Storage.clearDataForOrigin', { origin: 'http://localhost:3761', storageTypes: 'all' })
await p.nav('http://localhost:3761/pricing', 5000)
const menu = `[...document.querySelectorAll('header details')].find(d=>d.getBoundingClientRect().width>0&&/English|中文|日本語|Español|Deutsch|Français|한국어/.test(d.querySelector('summary').textContent))`
let log = `# 1. Open /pricing\nlocation: ${await p.ev('location.pathname')}  lang=${await p.ev('document.documentElement.lang')}  h1: ${await p.ev(`document.querySelector('main h1').textContent`)}\n`
await p.click(`(${menu}).querySelector('summary')`); await p.sleep(600)
const items = await p.ev(`[...(${menu}).querySelectorAll('a')].map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join('\\n')`)
log += `\n# 2. Click "English" in the header\nthe menu offers:\n${items}\n`
const m = await p.ev(`(()=>{const r=(${menu}).getBoundingClientRect();const l=[...(${menu}).querySelectorAll('a')].map(a=>a.getBoundingClientRect());return {x:Math.min(r.x,...l.map(b=>b.x)),y:r.y,r:Math.max(r.right,...l.map(b=>b.right)),b:Math.max(r.bottom,...l.map(b=>b.bottom))}})()`)
await p.shot(D + '01-menu.png', { x: m.x - 400, y: 0, width: m.r - m.x + 440, height: m.b + 30 })
await p.click(`[...(${menu}).querySelectorAll('a')].find(a=>a.textContent.trim()==='中文')`); await p.sleep(4000)
log += `\n# 3. Pick 中文\nlocation: ${await p.ev('location.pathname')}  lang=${await p.ev('document.documentElement.lang')}  h1: ${await p.ev(`document.querySelector('main h1').textContent`)}\nheader: ${await p.ev(`document.querySelector('header nav')?.innerText.replace(/\\n+/g,' · ') ?? document.querySelector('header').innerText.replace(/\\n+/g,' · ')`)}\n`
await p.shot(D + '02-zh-pricing.png', { x: 0, y: 0, width: 1280, height: 560 })
await p.click(`(${menu}).querySelector('summary')`); await p.sleep(600)
await p.click(`[...(${menu}).querySelectorAll('a')].find(a=>a.getAttribute('href')==='/pricing')`); await p.sleep(4000)
log += `\n# 4. Open the menu again and pick the English entry (href /pricing)\nlocation: ${await p.ev('location.pathname')}  lang=${await p.ev('document.documentElement.lang')}  h1: ${await p.ev(`document.querySelector('main h1').textContent`)}\n`
await p.nav('http://localhost:3761/', 5000)
await p.click(`(${menu}).querySelector('summary')`); await p.sleep(600)
log += `\n# 5. Open the home page and click "English"\nthe menu offers:\n${await p.ev(`[...(${menu}).querySelectorAll('a')].map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join('\\n')`)}\n`
const m2 = await p.ev(`(()=>{const r=(${menu}).getBoundingClientRect();const l=[...(${menu}).querySelectorAll('a')].map(a=>a.getBoundingClientRect());return {x:Math.min(r.x,...l.map(b=>b.x)),y:r.y,r:Math.max(r.right,...l.map(b=>b.right)),b:Math.max(r.bottom,...l.map(b=>b.bottom))}})()`)
await p.shot(D + '03-home-menu.png', { x: m2.x - 400, y: 0, width: m2.r - m2.x + 440, height: m2.b + 30 })
await p.click(`[...(${menu}).querySelectorAll('a')].find(a=>a.getAttribute('href')==='/ja')`); await p.sleep(4000)
log += `\n# 6. Pick 日本語\nlocation: ${await p.ev('location.pathname')}  lang=${await p.ev('document.documentElement.lang')}  h1: ${await p.ev(`document.querySelector('main h1')?.textContent`)}\nheader: ${await p.ev(`document.querySelector('header').innerText.replace(/\\n+/g,' · ')`)}\n`
fs.writeFileSync(D + 'switch.log', log)
console.log(log)
await p.close()
