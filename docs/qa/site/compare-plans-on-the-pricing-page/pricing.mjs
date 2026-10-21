// Usage: SITE=http://127.0.0.1:4391 CDP_PORT=9391 node pricing.mjs <proof dir>
import fs from 'node:fs'
import { open, byText } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4330'
// a page-coordinate clip, also past the viewport
const shot = async (pg, file, clip) => { const r = await pg.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...clip, scale: 1 } }); fs.writeFileSync(D + file, Buffer.from(r.data, 'base64')) }
const plans = (label) => `(()=>{const a=${byText('main a', label)};let e=a;while(e&&!(e.getBoundingClientRect().width>900))e=e.parentElement;return e})()`
// from the page's h1 down to the bottom of the two plans
const area = (pg, label) => pg.ev(`(()=>{const h=document.querySelector('main h1').getBoundingClientRect();const e=${plans(label)}.getBoundingClientRect();return {y:h.y+scrollY-60,bottom:e.bottom+scrollY+30}})()`)
const head = (pg) => pg.ev(`({title:document.title,description:document.querySelector('meta[name=description]').content,ogDescription:document.querySelector('meta[property="og:description"]')?.content,h1:document.querySelector('main h1').innerText,lead:document.querySelector('main h1').nextElementSibling?.innerText})`)
// the price odometer's digit reels are skipped
const rows = async (pg, label) => (await pg.ev(`${plans(label)}.innerText`)).split('\n').filter(l => l.trim() && !/^[\d$]$/.test(l.trim())).join('\n')
const hrefs = (pg) => pg.ev(`[...document.querySelectorAll('main a')].filter(a=>/trial|Download|试用|下载/i.test(a.textContent)).map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join('\\n')`)
const folds = (pg) => pg.ev(`[...document.querySelectorAll('main button[aria-expanded]')].map(b=>b.innerText.replace(/\\n/g,' ')+' [expanded='+b.getAttribute('aria-expanded')+']'+(b.nextElementSibling?' => '+b.nextElementSibling.innerText.replace(/\\n/g,' | '):'')).join('\\n')`)
const PRO = 'Start 7-day free trial'
const p = await open(1280, 1000)
await p.send('Storage.clearDataForOrigin', { origin: B, storageTypes: 'all' })
await p.nav(B + '/pricing', 5000)
await p.ev('scrollTo(0,0)'); await p.sleep(500)
let a = await area(p, PRO)
await shot(p, '01-yearly.png', { x: 140, y: a.y, width: 1000, height: a.bottom - a.y })
let log = `# 1. Open /pricing (yearly, as the page opens)\n${JSON.stringify(await head(p), null, 1)}\n\n${await rows(p, PRO)}\n\n${await hrefs(p)}\n`
const board = `(()=>{const b=document.querySelector('.pr-board');const cards=[...b.querySelectorAll('.pr-lane > span')];const s=getComputedStyle(b);return {ariaHidden:b.getAttribute('aria-hidden'),text:JSON.stringify(b.innerText.trim()),lanes:b.querySelectorAll('.pr-lane').length,cards:cards.length,cardsWithText:cards.filter(c=>c.textContent.trim()).length,colours:[...new Set(cards.map(c=>getComputedStyle(c.firstElementChild).backgroundColor))],opacity:s.opacity,mask:s.maskImage||s.webkitMaskImage}})()`
log += `\n# 4. The backdrop behind the plans\n${JSON.stringify(await p.ev(board), null, 1)}\n`
const r = await p.ev(`(()=>{const r=document.querySelector('.pr-board').getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`)
await shot(p, '04-backdrop.png', { x: 0, y: r.y, width: 1280, height: Math.min(r.h, 1100) })
await p.click(byText('main button, main [role=radio], main [role=tab]', 'Monthly'))
await p.ev('scrollTo(0,0)'); await p.sleep(1500)
a = await area(p, PRO)
await shot(p, '02-monthly.png', { x: 140, y: a.y, width: 1000, height: a.bottom - a.y })
log += `\n# 2-3. After clicking Monthly\n${(await rows(p, PRO)).split('\n').filter(l => /\$|year|month/i.test(l)).join('\n')}\n${await hrefs(p)}\n`
log += `\n# 3. Folded rows, closed\n${await folds(p)}\n`
for (const cue of ['All 6 workflows', 'Credit costs']) { await p.click(byText('main button[aria-expanded]', cue)); await p.sleep(400) }
log += `\n# 3. Folded rows, opened\n${await folds(p)}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(500)
a = await area(p, PRO)
await shot(p, '03-folds-open.png', { x: 140, y: a.y, width: 1000, height: a.bottom - a.y })
const below = await p.ev(`(()=>{const e=${plans(PRO)};const out=[];let n=e.nextElementSibling;while(n){out.push(n.innerText.replace(/\\n+/g,' | '));n=n.nextElementSibling}return out.join('\\n')})()`)
log += `\n# below the two plans\n${below}\n`
await p.close()
const zh = await open(1280, 1000)
await zh.nav(B + '/zh/pricing', 5000)
await zh.ev('scrollTo(0,0)'); await zh.sleep(500)
const zl = await zh.ev(`[...document.querySelectorAll('main a')].find(a=>a.href.includes('/billing/trial'))?.textContent.trim()`)
a = await area(zh, zl)
await shot(zh, '05-zh-yearly.png', { x: 140, y: a.y, width: 1000, height: a.bottom - a.y })
for (const cue of ['全部 6 种工作流', '消耗标准']) { await zh.click(byText('main button[aria-expanded]', cue)); await zh.sleep(400) }
a = await area(zh, zl)
await shot(zh, '06-zh-folds-open.png', { x: 140, y: a.y, width: 1000, height: a.bottom - a.y })
log += `\n# 5. /zh/pricing\n${JSON.stringify(await head(zh), null, 1)}\n\n${await rows(zh, zl)}\n\n${await hrefs(zh)}\n\n${await folds(zh)}\n\nbackdrop: ${JSON.stringify(await zh.ev(board))}\n`
await zh.close()
fs.writeFileSync(D + 'links.log', log); console.log(log)
