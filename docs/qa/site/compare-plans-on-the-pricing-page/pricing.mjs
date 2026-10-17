// Usage: SITE=http://127.0.0.1:4391 CDP_PORT=9391 node pricing.mjs <proof dir>
import fs from 'node:fs'
import { open, byText } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4330'
const p = await open(1280, 1000)
await p.send('Storage.clearDataForOrigin', { origin: B, storageTypes: 'all' })
await p.nav(B + '/pricing', 5000)
const plans = `(()=>{const a=${byText('main a', 'Get Pro')};let e=a;while(e&&!(e.getBoundingClientRect().width>900))e=e.parentElement;return e})()`
const area = async () => p.ev(`(()=>{const e=${plans};const t=${byText('main button, main [role=radio], main [role=tab]', 'Monthly')};const r=e.getBoundingClientRect();const tr=t.getBoundingClientRect();return {y:Math.min(r.y,tr.y)+scrollY,bottom:r.bottom+scrollY,text:e.innerText}})()`)
await p.ev(`(${plans}).scrollIntoView({block:'center'})`); await p.sleep(500)
let a = await area()
await p.shot(D + '01-yearly.png', { x: 150, y: a.y - 30, width: 980, height: a.bottom - a.y + 60 })
const hrefs = async (label) => `${label}\n` + await p.ev(`[...document.querySelectorAll('main a')].filter(a=>/Get Pro|Download|waitlist/i.test(a.textContent)).map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join('\\n')`) + '\n' + a.text.split('\n').filter(l=>/\\$|¥|€|\/ ?mo|year|month/i.test(l)).join('\n')
let log = await hrefs('# 1. Yearly (as the page opens)')
const board = `(()=>{const b=document.querySelector('.pr-board');const cards=[...b.querySelectorAll('.pr-lane > span')];const s=getComputedStyle(b);return {ariaHidden:b.getAttribute('aria-hidden'),text:JSON.stringify(b.innerText.trim()),lanes:b.querySelectorAll('.pr-lane').length,cards:cards.length,cardsWithText:cards.filter(c=>c.textContent.trim()).length,colours:[...new Set(cards.map(c=>getComputedStyle(c.firstElementChild).backgroundColor))],opacity:s.opacity,mask:s.maskImage||s.webkitMaskImage}})()`
log += `\n\n# 4. The backdrop behind the plans\n${JSON.stringify(await p.ev(board), null, 1)}\n`
const r = await p.ev(`(()=>{const r=document.querySelector('.pr-board').getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`)
await p.shot(D + '04-backdrop.png', { x: 0, y: r.y, width: 1280, height: Math.min(r.h, 1100) })
await p.click(byText('main button, main [role=radio], main [role=tab]', 'Monthly'))
await p.ev(`(${plans}).scrollIntoView({block:'center'})`); await p.sleep(2500)
a = await area()
await p.shot(D + '02-monthly.png', { x: 150, y: a.y - 30, width: 980, height: a.bottom - a.y + 60 })
log += '\n' + await hrefs('# 2-3. After clicking Monthly')
await p.close()
const zh = await open(1280, 1000)
await zh.nav(B + '/zh/pricing', 5000)
log += `\n\n# 4. /zh/pricing backdrop\n${JSON.stringify(await zh.ev(board))}\n`
await zh.close()
fs.writeFileSync(D + '03-links.log', log); console.log(log)
