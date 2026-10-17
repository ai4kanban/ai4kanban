import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const SITE = 'http://' + (process.env.SITE || '127.0.0.1:4330')
const p = await open(1280, 900)
const reqs = []
p.on((e) => { if (e.method === 'Network.requestWillBeSent') reqs.push(e.params.request.url) })
let log = ''
const cols = `[...document.querySelectorAll('footer nav > div')].map(c=>[...c.children].map(g=>g.querySelector('h2').innerText+': '+[...g.querySelectorAll('a')].map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join(', ')).join(' / ')).join('\\n  ')`
const ncols = `getComputedStyle(document.querySelector('footer nav')).gridTemplateColumns.split(' ').length`
const footerShot = async (pg, file, w) => { await pg.ev(`document.querySelector('footer nav').scrollIntoView({block:'center'})`); await pg.sleep(1500); const b = await pg.ev(`(()=>{const r=document.querySelector('footer nav').getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`); await pg.shot(file, { x: 0, y: b.y - 24, width: w, height: b.h + 48 }) }
log += '# 1. Home footer, then click "For coding"\n'
for (const [path, file] of [['/zh', null], ['/', '01-footer-solutions.png']]) {
  await p.nav(SITE + path, 5000)
  log += `${path} (${await p.ev(ncols)} columns):\n  ${await p.ev(cols)}\n`
  if (file) await footerShot(p, D + file, 1280)
}
const ph = await open(390, 844, true)
await ph.nav(SITE + '/', 5000)
log += `phone: ${await ph.ev(ncols)} columns, page width ${await ph.ev('document.documentElement.scrollWidth')}\n`
await footerShot(ph, D + '01b-footer-phone.png', 390)
await ph.close()
await p.click(`[...document.querySelectorAll('footer a')].find(a=>a.textContent.trim()==='For coding')`); await p.sleep(5000)
log += `landed on: ${await p.ev('location.pathname')}\n`
const media = () => p.ev(`[...document.querySelectorAll('main video')].map(v=>({src:(v.currentSrc||v.querySelector('source')?.src||v.getAttribute('src')||'').replace(location.origin,''),poster:(v.poster||'').replace(location.origin,''),muted:v.muted,loop:v.loop,controls:v.controls,paused:v.paused,t:+v.currentTime.toFixed(1)}))`)
const vidReqs = () => reqs.filter(u => /\.(mp4|webm)(\?|$)/.test(u)).map(u => u.replace(/^https?:\/\/[^/]+/, ''))
log += `\n# 2. The page\ntitle: ${await p.ev('document.title')}\nh1: ${await p.ev(`document.querySelector('h1').innerText`)}\nh2s: ${await p.ev(`[...document.querySelectorAll('main h2')].map(h=>h.innerText).join(' | ')`)}\nvideos on page: ${JSON.stringify(await media())}\nvideo requests so far: ${JSON.stringify(vidReqs())}\ngif requests: ${reqs.filter(u=>/\.gif/.test(u)).length}\n`
const hero = `(()=>{const h=document.querySelector('.h3d');const r=h?.getBoundingClientRect();const img=h?.closest('[role=img],[aria-label]');return {pageBg:getComputedStyle(document.body).backgroundColor,headerBg:getComputedStyle(document.querySelector('header')).backgroundColor,art3d:!!h,label:img?.getAttribute('aria-label'),artWidth:Math.round(r?.width||0),artTop:Math.round((r?.top||0)+scrollY),matFrame:!!document.querySelector('main .bg-elev'),canvases:document.querySelectorAll('canvas').length,pageWidth:document.documentElement.scrollWidth}})()`
await p.ev('scrollTo(0,0)'); await p.sleep(1200)
await p.shot(D + '02-hero.png', { x: 0, y: 0, width: 1280, height: 900 }); await p.sleep(2500)
log += `hero: ${JSON.stringify(await p.ev(hero))}\n`
await p.shot(D + '02a-hero-board.png', { x: 0, y: 0, width: 1280, height: 900 })
const hp = await open(390, 844, true)
await hp.nav(SITE + '/workflows/coding', 7000)
log += `phone hero: ${JSON.stringify(await hp.ev(hero))}\n`
await hp.shot(D + '02b-hero-phone.png', { x: 0, y: 0, width: 390, height: 844 })
await hp.close()
const v = `document.querySelector('main video')`
if (await p.ev(`!!${v}`)) {
  await p.ev(`(${v}).scrollIntoView({block:'center'})`); await p.sleep(4000)
  log += `\n# 3. Scroll to the first recording\nvideo: ${JSON.stringify((await media())[0])}\nvideo requests: ${JSON.stringify(vidReqs())}\n`
  await p.shot(D + '03-recording-playing.png', { x: 0, y: await p.ev('scrollY'), width: 1280, height: 900 })
  await p.sleep(3000)
  log += `3s later: t=${(await media())[0].t} paused=${(await media())[0].paused}\n`
  await p.ev('scrollTo(0,0)'); await p.sleep(1500)
  log += `\n# 4. Scroll back to the top\nvideo paused: ${(await media())[0].paused}\n`
}
const links = await p.ev(`[...document.querySelectorAll('main a')].map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).filter(s=>/docs|download/.test(s)).join('\\n  ')`)
log += `\n# 5. Links onward\n  ${links}\n`
await p.close()
const r = await open(1280, 900)
await r.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await r.nav(SITE + '/workflows/coding', 5000)
await r.ev(`document.querySelector('main video')?.scrollIntoView({block:'center'})`); await r.sleep(4000)
log += `\n# 6. Same page with "reduce motion" on\nvideo: ${JSON.stringify(await r.ev(`(()=>{const v=document.querySelector('main video');return v&&{paused:v.paused,controls:v.controls,autoplay:v.autoplay,poster:!!v.poster,t:v.currentTime}})()`))}\n`
await r.shot(D + '06-reduced-motion.png', { x: 0, y: await r.ev('scrollY'), width: 1280, height: 900 })
await r.close()
// the first section's copy, in English and Chinese
const first = `(()=>{const h=document.querySelector('main h2');const ps=[];let e=h.nextElementSibling;while(e&&e.tagName!=='H2'){if(e.tagName==='P')ps.push(e.innerText);e=e.nextElementSibling}const b=h.getBoundingClientRect();return {title:document.title,description:document.querySelector('meta[name=description]').content,lead:document.querySelector('h1').nextElementSibling?.innerText,h2:h.innerText,paragraphs:ps,y:b.y+scrollY}})()`
const f = await open(1280, 900)
for (const path of ['/workflows/coding', '/zh/workflows/coding']) {
  await f.nav(SITE + path, 5000)
  for (let y = 0; y < 2400; y += 400) { await f.ev(`scrollTo(0,${y})`); await f.sleep(150) }
  const s = await f.ev(first)
  log += `\n# 2b. ${path}: title, lead and the first section\n${JSON.stringify({ ...s, y: undefined }, null, 1)}\n`
  if (path === '/workflows/coding') { await f.ev(`document.querySelector('main h2').scrollIntoView({block:'start'})`); await f.sleep(1200); await f.shot(D + '02c-first-section.png', { x: 0, y: s.y - 40, width: 1280, height: 520 }) }
}
await f.close()
fs.writeFileSync(D + 'coding.log', log); console.log(log)
