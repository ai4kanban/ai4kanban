import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4330'
const p = await open(1280, 900)
await p.send('Storage.clearDataForOrigin', { origin: B, storageTypes: 'all' })
const menu = `document.querySelector('footer details')`
const items = (pg) => pg.ev(`[...(${menu}).querySelectorAll('a,span[aria-current]')].map(a=>a.textContent.trim()+(a.getAttribute('href')?' -> '+a.getAttribute('href'):' (current)')).join('\\n')`)
// Pages scroll smoothly: let the scroll settle before clicking.
const openMenu = async (pg) => { await pg.box(`(${menu}).querySelector('summary')`); await pg.sleep(1500); await pg.click(`(${menu}).querySelector('summary')`); await pg.sleep(700) }
const where = (pg) => pg.ev(`location.pathname+'  lang='+document.documentElement.lang+'  h1: '+document.querySelector('main h1').innerText.replace(/\\n/g,' ')`)
const shotMenu = async (pg, file) => {
  const m = await pg.ev(`(()=>{const d=${menu};const r=[d,...d.querySelectorAll('a,span')].map(e=>e.getBoundingClientRect()).filter(b=>b.width>0);return {x:Math.min(...r.map(b=>b.x)),y:Math.min(...r.map(b=>b.y))+scrollY,r:Math.max(...r.map(b=>b.right)),b:Math.max(...r.map(b=>b.bottom))+scrollY}})()`)
  await pg.shot(file, { x: Math.max(0, m.x - 200), y: m.y - 40, width: Math.min(1280, m.r + 40) - Math.max(0, m.x - 200), height: m.b - m.y + 80 })
}
await p.nav(B + '/pricing', 5000)
let log = `# 1. Open /pricing\n${await where(p)}\nheader: ${await p.ev(`document.querySelector('header nav').innerText.replace(/\\n+/g,' · ')`)}\n`
await openMenu(p)
log += `\n# 2. Click "English" in the footer\nthe menu offers:\n${await items(p)}\n`
await shotMenu(p, D + '01-footer-menu.png')
await p.click(`[...(${menu}).querySelectorAll('a')].find(a=>a.textContent.trim()==='中文')`); await p.sleep(4000)
log += `\n# 3. Pick 中文\n${await where(p)}\nheader: ${await p.ev(`document.querySelector('header nav').innerText.replace(/\\n+/g,' · ')`)}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(500)
await p.shot(D + '02-zh-pricing.png', { x: 0, y: 0, width: 1280, height: 560 })
await openMenu(p)
await p.click(`[...(${menu}).querySelectorAll('a')].find(a=>a.getAttribute('href')==='/pricing')`); await p.sleep(4000)
log += `\n# 4. Open the footer menu again and pick English\n${await where(p)}\n`
await p.nav(B + '/', 5000)
await openMenu(p)
log += `\n# 5. On the home page, open the footer menu\nthe menu offers:\n${await items(p)}\n`
await p.click(`[...(${menu}).querySelectorAll('a')].find(a=>a.getAttribute('href')==='/ja')`); await p.sleep(4000)
log += `\n# 6. Pick 日本語\n${await where(p)}\nheader: ${await p.ev(`document.querySelector('header nav').innerText.replace(/\\n+/g,' · ')`)}\n`
await p.close()
const m = await open(390, 844, true)
await m.nav(B + '/pricing', 5000)
await m.click(`document.querySelector('header details summary[aria-label="Menu"]')`); await m.sleep(800)
log += `\n# 7. On a 390px phone, open the header menu on /pricing\n${await m.ev(`document.querySelector('header details').innerText.replace(/\\n+/g,' · ')`)}\n`
await m.shot(D + '03-phone-drawer.png', { x: 0, y: 0, width: 390, height: 700 })
await m.click(`[...document.querySelectorAll('header details a')].find(a=>a.textContent.trim()==='中文')`); await m.sleep(4000)
log += `\n# 8. Tap 中文\n${await where(m)}\n`
await m.close()
fs.writeFileSync(D + 'switch.log', log); console.log(log)
