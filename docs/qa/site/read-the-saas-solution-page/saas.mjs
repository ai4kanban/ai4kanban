// Reads /solutions/saas: footer entry, the CSS 3D hero, the sections, the plan lines, the
// customize link, the zh/ja pages, a phone and reduced motion.
// Usage: SITE=127.0.0.1:4371 CDP_PORT=9371 OUT=<proof dir> node saas.mjs
import fs from 'node:fs'
import { open } from './cdp.mjs'
const SITE = `http://${process.env.SITE || '127.0.0.1:4330'}`, OUT = process.env.OUT || '.'
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(`${OUT}/saas.log`, s + '\n') }
let p = await open(1280, 900)
const head = `({url:location.pathname,title:document.title,kicker:document.querySelector('h1').previousElementSibling?.innerText,h1:document.querySelector('h1').innerText.replace(/\\n/g,' / '),lead:document.querySelector('h1').nextElementSibling?.innerText})`
const stage = `(()=>{const s=document.querySelector('.h3d-stage').getBoundingClientRect();const h=document.querySelector('.h3d');return {on:h.hasAttribute('data-on'),label:h.getAttribute('aria-label'),w:Math.round(s.width),h:Math.round(s.height),ratio:+(s.width/s.height).toFixed(2),lift:getComputedStyle(document.querySelector('.h3d-lift')).animationName,pageWidth:document.documentElement.scrollWidth}})()`
const heroShot = async (f) => { const b = await p.ev(`(()=>{const r=document.querySelector('.h3d').getBoundingClientRect();return {x:0,y:Math.max(0,r.y+scrollY-260),width:innerWidth,height:r.height+300}})()`); await p.shot(`${OUT}/${f}`, b) }

log('# 1. Footer entry'); await p.nav(`${SITE}/`, 4000)
await p.click(`[...document.querySelectorAll('footer a')].find(a=>a.textContent.trim()==='For SaaS')`); await p.sleep(4000)
log(await p.ev(head))

log('# 2. The 3D hero, in real time')
await p.ev('scrollTo(0,0)'); await p.sleep(500)
log('stage', await p.ev(stage))
await heroShot('02a-hero-start.png'); await p.sleep(2500); await heroShot('02b-hero-card-page.png')
const tilt = `getComputedStyle(document.querySelector('.h3d-cam')).getPropertyValue('--tx')+' '+getComputedStyle(document.querySelector('.h3d-cam')).getPropertyValue('--ty')`
log('tilt before', await p.ev(tilt))
const c = await p.ev(`(()=>{const r=document.querySelector('.h3d').getBoundingClientRect();return {x:r.right-60,y:r.top+60}})()`)
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y }); await p.sleep(800)
log('tilt with the pointer at the top right', await p.ev(tilt))

log('# 3. Sections')
log(await p.ev(`({toc:[...document.querySelectorAll('nav a[href^="#"]')].filter(a=>a.getBoundingClientRect().width>0).length,h2:[...document.querySelectorAll('main h2,article h2')].map(h=>h.innerText)})`))

log('# 4. Pro line and the customize link')
// every <Plan> line: a tag icon before a short muted paragraph
const plan = `[...document.querySelectorAll('p')].filter(e=>e.firstElementChild?.tagName==='svg'&&e.children.length===2&&e.children[1].tagName==='SPAN').map(e=>({section:(()=>{let n=e;while(n&&!/^H2$/.test(n.tagName)){n=n.previousElementSibling||n.parentElement}return n?.innerText})(),text:e.innerText,links:[...e.querySelectorAll('a')].map(a=>a.getAttribute('href'))}))`
log('plan', await p.ev(plan))
await p.box(`[...document.querySelectorAll('a')].find(a=>/reason=customize/.test(a.href))`); await p.sleep(1500)
await p.shot(`${OUT}/04-customize.png`, await p.ev(`(()=>{const r=[...document.querySelectorAll('a')].find(a=>/reason=customize/.test(a.href)).getBoundingClientRect();return {x:0,y:r.y+scrollY-320,width:innerWidth,height:420}})()`))
await p.click(`[...document.querySelectorAll('a')].find(a=>/reason=customize/.test(a.href))`); await p.sleep(4000)
log('after click', await p.ev(`({url:location.pathname+location.search,h1:document.querySelector('h1')?.innerText,checked:[...document.querySelectorAll('input:checked,select')].map(i=>i.value||i.labels?.[0]?.innerText)})`))

for (const lang of ['zh', 'ja']) {
  log(`# 5. /${lang}/solutions/saas`); await p.nav(`${SITE}/${lang}/solutions/saas`, 4000)
  log(await p.ev(head)); log('plan', await p.ev(plan))
  if (lang === 'zh') await heroShot('05-zh-hero.png')
}
await p.close()

log('# 6. Phone'); p = await open(390, 844, true); await p.nav(`${SITE}/solutions/saas`, 4000)
log('stage', await p.ev(stage)); await p.sleep(3000); await p.shot(`${OUT}/06-phone-hero.png`); await p.close()

log('# 7. Reduced motion'); p = await open(1280, 900)
await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await p.nav(`${SITE}/solutions/saas`, 3000); log('stage', await p.ev(stage)); await heroShot('07-reduced-motion.png'); await p.close()

log('# 4b. The marketing-material section'); p = await open(1280, 900); await p.nav(`${SITE}/solutions/saas`, 4000)
for (let y = 0; y < 3600; y += 400) { await p.ev(`scrollTo(0,${y})`); await p.sleep(150) }
const sec = `(()=>{const h=[...document.querySelectorAll('main h2,article h2')].find(h=>/marketing material/.test(h.innerText));const hs=[...document.querySelectorAll('main h2,article h2')];const n=hs[hs.indexOf(h)+1];const a=h.getBoundingClientRect(),b=n.getBoundingClientRect();const r=document.createRange();r.setStartBefore(h);r.setEndBefore(n);return {y:a.y+scrollY,h:b.y-a.y,text:r.toString().replace(/\\s*\\n\\s*/g,' | ')}})()`
await p.ev(`[...document.querySelectorAll('main h2,article h2')].find(h=>/marketing material/.test(h.innerText)).scrollIntoView({block:'start'})`); await p.sleep(1500)
const m = await p.ev(sec); log(m.text)
await p.shot(`${OUT}/03-marketing-material.png`, { x: 0, y: m.y - 30, width: 1280, height: m.h + 10 }); await p.close()
