// Reads the home page: the /zh hero, the handoff scene, the pinned workflow row and its previews,
// the links under it, the tools, the closing band and footer, what the page loads, the English
// page, two phones and reduced motion.
// Usage: SITE=127.0.0.1:4391 CDP_PORT=9391 OUT=<proof dir> node home.mjs   (needs ffmpeg for the GIF)
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { open } from './cdp.mjs'
const SITE = `http://${process.env.SITE || '127.0.0.1:4330'}`, OUT = process.env.OUT || '.'
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(`${OUT}/home.log`, s + '\n') }
const W = 1440, H = 900
let p = await open(W, H)
const shotView = (f) => p.shot(`${OUT}/${f}`)
// the site scrolls smoothly; a scripted scroll must land at once
const go = async (pg, url, wait) => { await pg.nav(url, wait); await pg.ev(`document.documentElement.style.scrollBehavior='auto'`) }
// a page-coordinate clip, also past the viewport
const shotAt = async (f, clip, pg = p) => { const r = await pg.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...clip, scale: 1 } }); fs.writeFileSync(`${OUT}/${f}`, Buffer.from(r.data, 'base64')) }
const h2 = (t) => `[...document.querySelectorAll('main h2')].find(h=>h.innerText.replace(/\\n/g,'').startsWith(${JSON.stringify(t)}))`
const sec = (t) => `(${h2(t)}).closest('section')`
const rect = (sel, pg = p) => pg.ev(`(()=>{const r=(${sel}).getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y+scrollY),w:Math.round(r.width),h:Math.round(r.height),top:Math.round(r.top),bottom:Math.round(r.bottom)}})()`)
const reqs = []; p.on((d) => { if (d.method === 'Network.responseReceived') reqs.push({ url: d.params.response.url, type: d.params.type }) })
const video = `(()=>{const v=document.querySelector('main video');return v&&{src:v.currentSrc.split('/').pop(),paused:v.paused,muted:v.muted,loop:v.loop,controls:v.controls,t:+v.currentTime.toFixed(1),poster:v.poster.split('/').pop()}})()`

log('# step 1: /zh hero'); await go(p, `${SITE}/zh`, 4000)
log('title', await p.ev('document.title'))
log(await p.ev(`(()=>{const h=document.querySelector('main h1');const sec=h.closest('section')||h.parentElement.parentElement;const e=h.previousElementSibling;return {eyebrow:e?.innerText,eyebrowAlign:e&&getComputedStyle(e).textAlign,h1:h.innerText.replace(/\\n/g,' / '),lead:h.nextElementSibling?.innerText,buttons:[...sec.querySelectorAll('a')].map(a=>a.innerText.replace(/\\s+/g,' ').trim()+' -> '+a.href.replace(/arm64|x64/,'<arch>'))}})()`))
log('video', await p.ev(video)); await p.sleep(3000); log('3s later', await p.ev(video))
log('workflow previews before any scroll:', await p.ev(`[...document.querySelectorAll('.wf-track iframe')].map(f=>f.getAttribute('src'))`))
await shotView('01-zh-hero.png')

log('first screen text, before the recording plays:', await p.ev(`[...document.querySelectorAll('main section')][0].innerText.split('\\n').filter(Boolean).slice(0,6).join(' | ')`))
log('# step 2: the handoff section and its scene')
await p.ev(`(${sec('关键部分由你把关')}).scrollIntoView({block:'center'})`); await p.sleep(1500)
log(await p.ev(`(()=>{const s=${sec('关键部分由你把关')};const f=s.querySelector('figure');return {title:s.querySelector('h2').innerText.replace(/\\n/g,' / '),lead:s.querySelector('p').innerText,sceneWords:[...f.querySelectorAll('.br-name,.br-chip,.br-idea')].map(e=>e.innerText.trim()),label:f.getAttribute('aria-label'),playing:f.hasAttribute('data-on')}})()`))
const fig = await rect(`(${sec('关键部分由你把关')}).querySelector('figure')`)
const sr = await rect(sec('关键部分由你把关'))
await shotAt('02-zh-handoff.png', { x: sr.x - 20, y: sr.y - 20, width: sr.w + 40, height: sr.h + 40 })
// one 7s loop as a GIF, a frame every ~250ms
fs.mkdirSync(`${OUT}/.frames`, { recursive: true })
for (let i = 0; i < 28; i++) {
  const r = await p.send('Page.captureScreenshot', { format: 'png', clip: { x: fig.x, y: fig.y, width: fig.w, height: fig.h, scale: 1 } })
  fs.writeFileSync(`${OUT}/.frames/${String(i).padStart(3, '0')}.png`, Buffer.from(r.data, 'base64')); await p.sleep(200)
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '4', '-i', `${OUT}/.frames/%03d.png`, '-vf', 'scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', `${OUT}/03-zh-handoff-loop.gif`])
fs.rmSync(`${OUT}/.frames`, { recursive: true })

log('# step 3: the workflows pin and slide')
const wf = await rect(sec('不同的工作'))
log(await p.ev(`(()=>{const s=${sec('不同的工作')};return {title:s.querySelector('h2').innerText,lead:s.querySelector('h2').parentElement.nextElementSibling?.innerText??s.querySelector('p').innerText,cards:[...s.querySelectorAll('.wf-track>li')].map(l=>l.innerText.replace(/\\n+/g,' — ')),links:[...s.querySelectorAll('.wf-links a')].map(a=>a.innerText.trim()+' -> '+a.getAttribute('href'))}})()`))
await p.ev(`(${h2('不同的工作')}).scrollIntoView({block:'start'})`); await p.ev('scrollBy(0,-90)'); await p.sleep(1200)
await shotView('04-zh-workflows-title.png')
const pin = await p.ev(`(()=>{const e=document.querySelector('.wf-pin').getBoundingClientRect();return {top:Math.round(e.top+scrollY),h:Math.round(e.height),stick:Math.round(document.querySelector('.wf-stick').getBoundingClientRect().height)}})()`)
log('pin', pin)
const at = async (f) => { await p.ev(`scrollTo(0, ${Math.round(pin.top - 64 + f * (pin.h - pin.stick))})`); await p.sleep(2500) }
const state = () => p.ev(`(()=>{const s=document.querySelector('.wf-stick').getBoundingClientRect();const lis=[...document.querySelectorAll('.wf-track>li')];return {stickTop:Math.round(s.top),inView:lis.filter(l=>{const b=l.getBoundingClientRect();return b.right>40&&b.left<innerWidth-40}).map(l=>l.querySelector('h3').innerText+' '+Math.round(Math.max(0,Math.min(innerWidth,l.getBoundingClientRect().right)-Math.max(0,l.getBoundingClientRect().left))/l.getBoundingClientRect().width*100)+'%'),bar:Math.round(document.querySelector('.wf-bar span').getBoundingClientRect().width/document.querySelector('.wf-bar').getBoundingClientRect().width*100)+'%',linksVisible:document.querySelector('.wf-links').getBoundingClientRect().bottom<=innerHeight}})()`)
for (const [f, file] of [[0.02, '05-zh-workflows-first.png'], [0.5, '06-zh-workflows-middle.png'], [0.98, '07-zh-workflows-last.png']]) { await at(f); log('at', f, await state()); await shotView(file) }
log('previews after scrolling:', await p.ev(`[...document.querySelectorAll('.wf-track iframe')].map(f=>f.getAttribute('src')+': '+(f.contentDocument?.body?.innerText.split('\\n')[0]??'(blocked)'))`))
const xfo = await fetch(`${SITE}/demo/drafts/coding`, { method: 'HEAD' }); log('/demo/drafts/coding X-Frame-Options:', xfo.headers.get('x-frame-options'))
// the carousel preview stays on its slide grid: watch it for 10s
await at(0.75); const seen = new Set()
for (let i = 0; i < 20; i++) { seen.add(await p.ev(`(()=>{const d=document.querySelector('.wf-track iframe[src$="carousel"]').contentDocument;return (d.querySelector('[role=dialog]')?'dialog open':'no dialog')+' · '+(d.body.innerText.match(/\\d+ \\/ 8/)||[''])[0]})()`)); await p.sleep(500) }
log('carousel preview over 10s:', [...seen]); log('at', 0.75, await state())
log('clone preview video:', await p.ev(`(()=>{const d=document.querySelector('.wf-track iframe[src$="clone"]').contentDocument;return [...d.querySelectorAll('video')].map(v=>({t:+v.currentTime.toFixed(1),paused:v.paused}))})()`))
await shotView('08-zh-workflows-carousel-clone.png')

log('# step 4: the links under the row, then the gap to the next section')
log('links', await p.ev(`[...document.querySelectorAll('.wf-links a')].map(a=>a.innerText.trim()+' -> '+a.getAttribute('href'))`))
await p.ev(`scrollTo(0, ${pin.top + pin.h - H + 200})`); await p.sleep(1500)
const gap = await p.ev(`(()=>{const l=document.querySelector('.wf-links').getBoundingClientRect();const n=(${h2('继续用你熟悉的 AI 工具')}).getBoundingClientRect();return {linksBottomToNextTitle:Math.round(n.top-l.bottom)}})()`)
log('gap', gap); await shotView('09-zh-after-workflows.png')
for (const [label, want] of [['体验演示', '/demo'], ['查看全部 agent 与工作流', '/docs/agents']]) {
  const q = await open(W, H); await go(q, `${SITE}/zh`, 3000)
  await q.ev(`scrollTo(0, ${pin.top + pin.h - H + 200})`); await q.sleep(1500)
  await q.click(`[...document.querySelectorAll('.wf-links a')].find(a=>a.innerText.includes(${JSON.stringify(label)}))`); await q.sleep(3000)
  log(`clicked ${label}:`, await q.ev(`location.pathname+' · '+document.title`), '(wanted', want + ')'); await q.close()
}

log('# step 5: tools, the closing band and the footer')
await p.ev(`(${sec('继续用你熟悉的 AI 工具')}).scrollIntoView({block:'center'})`); await p.sleep(1500)
log(await p.ev(`(()=>{const s=${sec('继续用你熟悉的 AI 工具')};return {text:s.innerText.replace(/\\n+/g,' | '),logos:s.querySelectorAll('li img').length}})()`))
const tr = await rect(sec('继续用你熟悉的 AI 工具')); await shotAt('10-zh-tools.png', { x: tr.x - 20, y: tr.y - 30, width: tr.w + 40, height: tr.h + 60 })
await p.box(`document.getElementById('install')`); await p.sleep(2000)
log(await p.ev(`(()=>{const s=document.getElementById('install');return {title:s.querySelector('h2').innerText,text:s.innerText,links:[...s.querySelectorAll('a')].map(a=>a.innerText.replace(/\\s+/g,' ').trim()+' -> '+a.href.replace(/arm64|x64/,'<arch>'))}})()`))
await shotView('11-zh-start.png')
log('sections on the page:', await p.ev(`[...document.querySelectorAll('main h2')].map(h=>h.innerText.replace(/\\n/g,' / '))`))
await p.ev('scrollTo(0, document.body.scrollHeight)'); await p.sleep(3000)
const img = reqs.filter((r) => /Image|Media/.test(r.type) && !r.url.startsWith('data:') && !/\/demo\//.test(r.url)).map((r) => r.url.replace(SITE, '').replace(/^\/_next\/image\?url=([^&]+).*/, (m, u) => decodeURIComponent(u)))
log('images and media the page loaded, scrolled to the end:', [...new Set(img)])
log('any removed-section art requested (board/card shots, task graph, office, memory/follow-up scenes):', img.filter((u) => !u.startsWith('/home/drafts/') && /\/home\/demo-|task-?graph|office|memory|follow/i.test(u)))
log('footer 产品:', await p.ev(`(()=>{const h=[...document.querySelectorAll('footer *')].find(e=>e.children.length===0&&e.textContent.trim()==='产品');return [...h.parentElement.querySelectorAll('a')].map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join(' · ')})()`))
await p.close()

log('# step 6: English home')
p = await open(W, H); await go(p, `${SITE}/`, 3500)
log(await p.ev(`({title:document.title,description:document.querySelector('meta[name=description]').content,ogTitle:document.querySelector('meta[property="og:title"]')?.content,eyebrow:document.querySelector('main h1').previousElementSibling?.innerText,h1:document.querySelector('main h1').innerText.replace(/\\n/g,' / '),lead:document.querySelector('main h1').nextElementSibling?.innerText,h2s:[...document.querySelectorAll('main h2')].map(h=>h.innerText.replace(/\\n/g,' / ')),cards:[...document.querySelectorAll('.wf-track h3')].map(h=>h.innerText),links:[...document.querySelectorAll('.wf-links a')].map(a=>a.innerText.trim()+' -> '+a.getAttribute('href')),coding:[...document.querySelectorAll('main a')].some(a=>/Explore the coding workflow/i.test(a.innerText)),scene:[...document.querySelectorAll('main figure .br-name, main figure .br-chip, main figure .br-idea')].map(e=>e.innerText.trim())})`))
await p.ev(`(${h2('Review the key parts')}).closest('section').scrollIntoView({block:'center'})`); await p.sleep(1500)
await shotView('12-en-handoff.png')
await p.close()

log('# step 7: phone 390x844, /zh')
p = await open(390, 844, true); await go(p, `${SITE}/zh`, 3500)
await shotView('13-phone-hero.png')
await p.ev(`(${h2('不同的工作')}).scrollIntoView({block:'start'})`); await p.ev('scrollBy(0,-80)'); await p.sleep(1500)
await shotView('14-phone-workflows-title.png')
const ppin = await p.ev(`(()=>{const e=document.querySelector('.wf-pin').getBoundingClientRect();return {top:Math.round(e.top+scrollY),h:Math.round(e.height),stick:Math.round(document.querySelector('.wf-stick').getBoundingClientRect().height)}})()`)
const fits = (pg) => pg.ev(`(()=>{const s=document.querySelector('.wf-stick');const kids=[...s.children].map(k=>k.getBoundingClientRect());const lis=[...document.querySelectorAll('.wf-track>li')];const vis=lis.find(l=>{const b=l.getBoundingClientRect();return b.left>=-5&&b.left<innerWidth/2});return {viewport:innerHeight,stickTop:Math.round(s.getBoundingClientRect().top),contentTop:Math.round(Math.min(...kids.map(k=>k.top))),contentBottom:Math.round(Math.max(...kids.map(k=>k.bottom))),titleInPin:!!s.querySelector('h2'),card:vis?.querySelector('h3').innerText,cardWidth:vis&&Math.round(vis.getBoundingClientRect().width),links:[...s.querySelectorAll('.wf-links a')].map(a=>a.innerText.trim()),overflowX:document.documentElement.scrollWidth>innerWidth}})()`)
for (const [f, file] of [[0.02, '15-phone-workflows-pinned.png'], [0.98, '16-phone-workflows-last.png']]) { await p.ev(`scrollTo(0, ${Math.round(ppin.top - 64 + f * (ppin.h - ppin.stick))})`); await p.sleep(2500); log('phone at', f, await fits(p)); await shotView(file) }
await p.close()

log('# step 8: phone 375x667, English')
p = await open(375, 667, true); await go(p, `${SITE}/`, 3500)
await p.ev(`(${h2('The right workflow')}).scrollIntoView({block:'start'})`); await p.sleep(800)
const epin = await p.ev(`(()=>{const e=document.querySelector('.wf-pin').getBoundingClientRect();return {top:Math.round(e.top+scrollY),h:Math.round(e.height),stick:Math.round(document.querySelector('.wf-stick').getBoundingClientRect().height)}})()`)
await p.ev(`scrollTo(0, ${Math.round(epin.top - 64 + 0.3 * (epin.h - epin.stick))})`); await p.sleep(2500)
log('375 en pinned', await fits(p)); await shotView('17-phone-375-en-pinned.png'); await p.close()

log('# step 9: reduced motion, 1440 wide')
p = await open(W, H); await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await go(p, `${SITE}/zh`, 4000); log('hero video', await p.ev(video))
await p.ev(`(${sec('关键部分由你把关')}).scrollIntoView({block:'center'})`); await p.sleep(1500)
await shotView('18-reduced-handoff.png')
log('handoff scene', await p.ev(`(()=>{const f=document.querySelector('main figure');return {bothFrames:getComputedStyle(f.querySelector('.br-fb')).display!=='none',idea:getComputedStyle(f.querySelector('.br-idea')).display}})()`))
await p.ev(`(${h2('不同的工作')}).scrollIntoView({block:'start'})`); await p.ev('scrollBy(0,-80)'); await p.sleep(1500)
log('workflows', await p.ev(`(()=>{const t=document.querySelector('.wf-track');const s=document.querySelector('.wf-stick');return {position:getComputedStyle(s).position,columns:getComputedStyle(t).gridTemplateColumns.split(' ').length,pinHeight:Math.round(document.querySelector('.wf-pin').getBoundingClientRect().height)}})()`))
await shotView('19-reduced-workflows.png'); await p.close()
