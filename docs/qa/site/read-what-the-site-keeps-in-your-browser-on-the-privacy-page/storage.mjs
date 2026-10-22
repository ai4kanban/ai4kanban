// Reads what /privacy says the site keeps in the browser, then checks it against the browser:
// a footer language pick, a fresh visit, and a session on /demo.
// Usage: SITE=127.0.0.1:4471 CDP_PORT=9271 node storage.mjs <proof dir>
import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/', SITE = 'http://' + (process.env.SITE || '127.0.0.1:4330')
let log = ''
const p = await open(1280, 1000)
await p.send('Storage.clearDataForOrigin', { origin: SITE, storageTypes: 'all' })
// Everything this origin keeps: cookies, localStorage and sessionStorage (keys and value sizes).
const kept = async (pg) => {
  const { cookies } = await pg.send('Network.getCookies', { urls: [SITE] })
  const st = await pg.ev(`(()=>{const f=(s)=>Object.keys(s).sort().map(k=>k+' = '+(s.getItem(k).length>40?'('+s.getItem(k).length+' chars)':s.getItem(k)));return {local:f(localStorage),session:f(sessionStorage)}})()`)
  return `cookies: ${cookies.length ? cookies.map(c => c.name).join(', ') : 'none'}\nlocalStorage: ${st.local.join(' · ') || 'empty'}\nsessionStorage: ${st.session.join(' · ') || 'empty'}`
}
const para = (re) => `[...document.querySelectorAll('main p, main li')].find(e=>${re}.test(e.innerText))`
const shotOf = async (sel, file, pad = 30) => { await p.ev(`(()=>{const e=${sel};scrollTo({top:e.getBoundingClientRect().top+scrollY-200,behavior:'instant'})})()`); await p.sleep(1000); const b = await p.ev(`(()=>{const r=(${sel}).getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`); const r = await p.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: b.y - pad, width: 1280, height: b.h + 2 * pad, scale: 1 } }); fs.writeFileSync(D + file, Buffer.from(r.data, 'base64')) }
await p.nav(SITE + '/privacy', 4000)
log += `# 1. The short version\n${await p.ev(`${para('/^This site counts two things/')}.innerText`)}\n`
await shotOf(para('/^This site counts two things/'), '01-short-version.png')
const ul = `(${para('/^No cookies\\./')}).parentElement`
log += `\n# 2. Visiting the site\n${await p.ev(`[...(${ul}).children].map(l=>'- '+l.innerText).join('\\n')`)}\n`
await shotOf(`(()=>{const a=${para('/^No cookies\\./')},b=${para('/^The demo\\./')};const x=document.createElement('div');return {getBoundingClientRect:()=>{const r=a.getBoundingClientRect(),s=b.getBoundingClientRect();return {top:r.top,y:r.top,height:s.bottom-r.top}}}})()`, '02-visiting-the-site.png')
const cook = `[...document.querySelectorAll('main h2')].find(h=>h.innerText.trim()==='Cookies and tracking')`
log += `\n# 3. Cookies and tracking\n${await p.ev(`(()=>{let e=(${cook}).nextElementSibling,t=[];while(e&&e.tagName!=='H2'){t.push(e.innerText);e=e.nextElementSibling}return t.join('\\n')})()`)}\n`
log += `consent: ${await p.ev(`${para('/^We rely on consent/i')}.innerText`)}\n`
await shotOf(`(()=>{const h=${cook},n=h.nextElementSibling.nextElementSibling;return {getBoundingClientRect:()=>{const r=h.getBoundingClientRect(),s=n.getBoundingClientRect();return {top:r.top,y:r.top,height:s.bottom-r.top}}}})()`, '03-cookies-and-tracking.png')
log += `\n# 4. In the browser so far (read /privacy only)\n${await kept(p)}\n`
const menu = `document.querySelector('footer details')`
log += `footer language menu on /privacy: ${await p.ev(`${menu} ? [...(${menu}).querySelectorAll('a,span')].map(a=>a.innerText.trim()).join(', ') : '(none)'`)}\n`
await p.nav(SITE + '/', 6000)
// The home page grows while its previews load, so a click can miss the summary: retry until open.
for (let i = 0; i < 4 && !(await p.ev(`(${menu}).open`)); i++) { await p.box(`(${menu}).querySelector('summary')`); await p.sleep(1500); await p.click(`(${menu}).querySelector('summary')`); await p.sleep(700) }
await p.click(`[...(${menu}).querySelectorAll('a')].find(a=>a.getAttribute('href')==='/zh')`); await p.sleep(4000)
log += `\n# 5. Pick 中文 in the home page's footer\n${await p.ev('location.pathname')}\n${await kept(p)}\n`
await p.nav(SITE + '/demo', 8000)
log += `\n# 6. Open /demo\ntitle: ${await p.ev('document.title')}\n${await kept(p)}\n`
await p.click(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='New idea')`); await p.sleep(4000)
log += `\nclicked New idea, the idea typed itself: ${await p.ev('location.search')}\n${await kept(p)}\n`
await p.close()
fs.writeFileSync(D + 'storage.log', log); console.log(log)
