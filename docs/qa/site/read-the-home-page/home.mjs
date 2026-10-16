// Reads the home page: /zh hero and its video, the pinned drafts section, 02/03, the flip deck,
// the closing band, the English hero, a phone and reduced motion.
// Usage: SITE=127.0.0.1:4371 CDP_PORT=9371 OUT=<proof dir> node home.mjs
import fs from 'node:fs'
import { open } from './cdp.mjs'
const SITE = `http://${process.env.SITE || '127.0.0.1:4330'}`, OUT = process.env.OUT || '.'
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(`${OUT}/home.log`, s + '\n') }
const W = 1440, H = 900
let p = await open(W, H)
const shotView = (f) => p.shot(`${OUT}/${f}`)
const video = `(()=>{const v=document.querySelector('main video');return v&&{src:v.currentSrc,paused:v.paused,muted:v.muted,loop:v.loop,controls:v.controls,t:+v.currentTime.toFixed(1),poster:v.poster.split('/').pop()}})()`

log('# step 1: /zh hero'); await p.nav(`${SITE}/zh`, 4000)
log(await p.ev(`(()=>{const h=document.querySelector('main h1');const sec=h.closest('section')||h.parentElement.parentElement;return {h1:h.innerText,lead:h.nextElementSibling?.innerText,buttons:[...sec.querySelectorAll('a')].map(a=>a.innerText.replace(/\\s+/g,' ').trim()+' -> '+a.href.replace(/arm64|x64/,'<arch>'))}})()`))
log('video', await p.ev(video)); await p.sleep(3000); log('3s later', await p.ev(video))
await shotView('01-zh-hero.png')

log('# step 2: drafts section pins and glides')
const top = await p.ev(`document.getElementById('drafts-stage').getBoundingClientRect().top+scrollY`)
log('stage', await p.ev(`getComputedStyle(document.getElementById('drafts-stage')).display`), 'stack', await p.ev(`getComputedStyle(document.getElementById('drafts-stack')).display`))
const RUN = 1.5 * H
for (let i = 0; i < 4; i++) {
  await p.ev(`scrollTo(0, ${top - 80 + (RUN * i) / 3})`); await p.sleep(900)
  const s = await p.ev(`(()=>{const g=document.querySelector('#drafts [data-glide]').getBoundingClientRect();const lis=[...document.querySelectorAll('#drafts-stage li:not([data-glide])')];const on=lis.find(l=>{const b=l.getBoundingClientRect();return Math.abs(b.top-g.top)<20});return {highlight:on?.querySelector('span')?.innerText,titleTop:Math.round(document.querySelector('#drafts-stage h2').getBoundingClientRect().top)}})()`)
  log('stop', i, s); if (i === 0) await shotView('02-zh-drafts-ui.png'); if (i === 2) await shotView('03-zh-drafts-script.png')
}

log('# step 3: 02 and 03')
for (const [n, f] of [['02', '04-zh-agents.png'], ['03', '05-zh-followups.png']]) {
  const b = await p.box(`[...document.querySelectorAll('main h2')].find(h=>h.closest('section')&&h.closest('section').innerText.startsWith('${n}'))?.closest('section')`)
  await p.sleep(1500)
  log(n, await p.ev(`(()=>{const s=[...document.querySelectorAll('main h2')].find(h=>h.closest('section')&&h.closest('section').innerText.startsWith('${n}')).closest('section');const i=s.querySelector('img');return {title:s.querySelector('h2').innerText,alt:i.alt,loaded:i.naturalWidth,framed:!!i.closest('[class*=ring],[class*=shadow]')}})()`))
  await shotView(f)
}

log('# step 4: flip deck')
await p.box(`document.querySelector('button[aria-pressed]')`); await p.sleep(2000)
const deck = `[...document.querySelectorAll('button[aria-pressed]')].map(b=>b.getAttribute('aria-label'))`
log(await p.ev(`[...document.querySelectorAll('button[aria-pressed] img')].map(i=>({src:i.src.split('/').pop(),loaded:i.naturalWidth}))`))
log('deck buttons', await p.ev(deck)); await shotView('06-zh-deck-board.png')
const ledge = await p.ev(`(()=>{const b=document.querySelector('button[aria-pressed=false]').getBoundingClientRect();return {x:b.right-20,y:b.bottom-15}})()`)
for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, ...ledge, button: 'left', clickCount: 1 })
await p.sleep(800)
log('after click', await p.ev(deck)); await shotView('07-zh-deck-card.png')

log('# step 5: closing band')
await p.box(`document.getElementById('install')`); await p.sleep(2000)
log(await p.ev(`(()=>{const s=document.getElementById('install');return {title:s.querySelector('h2').innerText,text:s.innerText,links:[...s.querySelectorAll('a')].map(a=>a.innerText.replace(/\\s+/g,' ').trim()+' -> '+a.href.replace(/arm64|x64/,'<arch>'))}})()`))
await shotView('08-zh-start.png')

log('# step 6: English hero')
await p.nav(`${SITE}/`, 3000)
log(await p.ev(`({h1:document.querySelector('main h1').innerText.replace(/\\n/g,' / '),title:document.title,description:document.querySelector('meta[name=description]').content,kinds:[...document.querySelectorAll('#drafts-stage li:not([data-glide]) span')].map(s=>s.innerText)})`))
await p.close()

log('# step 7: phone')
p = await open(390, 844, true); await p.nav(`${SITE}/zh`, 3500)
await p.box(`document.getElementById('drafts-stack')`); await p.sleep(1500)
log(await p.ev(`({stage:getComputedStyle(document.getElementById('drafts-stage')).display,stack:[...document.querySelectorAll('#drafts-stack h3')].map(h=>h.innerText+(h.parentElement.querySelector('[aria-hidden]')?' + picture':'')),overflow:document.documentElement.scrollWidth>innerWidth})`))
await shotView('09-phone-drafts.png'); await p.close()

log('# step 8: reduced motion')
p = await open(W, H); await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await p.nav(`${SITE}/zh`, 4000); log('reduced', await p.ev(video)); await p.close()
