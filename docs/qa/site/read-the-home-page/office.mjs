// The home page's running office: its title and line, one 18s loop as a GIF with each mover's facing,
// the card numbers moving on, the window and clock at four faked local times, what it loads, pausing
// off screen, a phone, reduced motion, and the English title.
// Usage: SITE=127.0.0.1:4914 CDP_PORT=9414 OUT=<proof dir> node office.mjs   (needs ffmpeg for the GIF)
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import { open } from './cdp.mjs'
const SITE = `http://${process.env.SITE || '127.0.0.1:4914'}`, OUT = process.env.OUT || '.'
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(`${OUT}/office.log`, s + '\n') }
// Local clock set to `hh:mm` today before the page loads; it runs on from there.
const at = (hhmm) => `(()=>{const [h,m]=${JSON.stringify(hhmm)}.split(':').map(Number);const R=Date,t=new R();t.setHours(h,m,0,0);const off=t-R.now();class D extends R{constructor(...a){a.length?super(...a):super(R.now()+off)}static now(){return R.now()+off}};window.Date=D})()`
const h2 = (t) => `[...document.querySelectorAll('main h2')].find(h=>h.innerText.replace(/\\n/g,'').startsWith(${JSON.stringify(t)}))`
const sec = (t) => `(${h2(t)}).closest('section')`
async function page(w, h, { mobile = false, time, reduce = false } = {}) {
  const p = await open(w, h, mobile)
  p.reqs = []; p.on((d) => { if (d.method === 'Network.responseReceived') p.reqs.push(d.params.response.url) })
  if (time) await p.send('Page.addScriptToEvaluateOnNewDocument', { source: at(time) })
  if (reduce) await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  return p
}
const room = (t) => `(${sec(t)}).querySelector('.of-leaver-bot').closest('div[aria-hidden]')`
const rect = async (p, sel) => p.ev(`(()=>{const r=(${sel}).getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y+scrollY),width:Math.round(r.width),height:Math.round(r.height)}})()`)
const scene = (p) => p.reqs.filter((u) => /run-scene/.test(u)).map((u) => u.replace(/^.*\/run-scene\//, ''))
// Where each mover is, which way it faces, its pose and card, and the clock.
const movers = `(()=>{const o={};for(const id of ['leaver','finisher','arrival']){const b=document.querySelector('.of-'+id+'-bot'),f=document.querySelector('.of-'+id+'-face');const r=b.getBoundingClientRect();const pose=['type','walk','sit'].find(p=>+getComputedStyle(document.querySelector('.of-'+id+'-'+p)).opacity>0.5);o[id]={x:Math.round(r.x),y:Math.round(r.y),on:+getComputedStyle(b).opacity>0.5,left:getComputedStyle(f).transform.startsWith('matrix(-1'),pose,card:document.querySelector('.of-'+id+'-down')?.innerText.trim()}}return o})()`

log('# /zh at 1440: the section, one loop')
let p = await page(1440, 900, { time: '12:00' }); await p.nav(`${SITE}/zh`, 3500)
log('sections:', await p.ev(`[...document.querySelectorAll('main h2')].map(h=>h.innerText.replace(/\\n/g,' / '))`))
await p.ev(`(${sec('专注真正重要的')}).scrollIntoView({block:'center'})`); await p.sleep(1500)
log(await p.ev(`(()=>{const s=${sec('专注真正重要的')};const r=${room('专注真正重要的')}.getBoundingClientRect();return {title:s.querySelector('h2').innerText,body:s.querySelector('p').innerText,roomWidth:Math.round(r.width),roomHeight:Math.round(r.height)}})()`))
const sr = await rect(p, sec('专注真正重要的'))
await p.shot(`${OUT}/21-zh-office.png`, { x: sr.x - 20, y: sr.y - 20, width: sr.width + 40, height: sr.height + 40 })
// one loop from where the leaver is about to stand: frames for the GIF, and every mover sampled as it goes
await p.ev(`new Promise(r=>{const e=document.querySelector('.of-leaver-bot');const t=setInterval(()=>{const a=e.getAnimations()[0];if(a&&a.currentTime%18000>17000){clearInterval(t);r()}},50)})`)
const fr = await rect(p, room('专注真正重要的'))
fs.mkdirSync(`${OUT}/.frames`, { recursive: true })
const samples = []; const t0 = Date.now()
for (let i = 0; i < 80; i++) {
  const r = await p.send('Page.captureScreenshot', { format: 'png', clip: { ...fr, scale: 1 } })
  fs.writeFileSync(`${OUT}/.frames/${String(i).padStart(3, '0')}.png`, Buffer.from(r.data, 'base64'))
  samples.push({ t: +((Date.now() - t0) / 1000).toFixed(1), ...(await p.ev(movers)) }); await p.sleep(120)
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(80 / ((Date.now() - t0) / 1000)), '-i', `${OUT}/.frames/%03d.png`, '-vf', 'scale=720:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', `${OUT}/22-zh-office-loop.gif`])
fs.rmSync(`${OUT}/.frames`, { recursive: true })
// facing vs. the way it actually moved, per sample; and what each did over the loop
const wrong = []
for (const id of ['leaver', 'finisher', 'arrival']) for (let i = 1; i < samples.length; i++) {
  const a = samples[i - 1][id], b = samples[i][id], dx = b.x - a.x
  if (a.on && b.on && b.pose === 'walk' && Math.abs(dx) > 2 && (dx < 0) !== b.left) wrong.push({ id, t: samples[i].t, dx, facingLeft: b.left })
}
log('walking against the facing (should be none):', wrong)
for (const id of ['leaver', 'finisher', 'arrival']) {
  const seq = []; for (const s of samples) { const m = s[id]; const k = `${m.on ? m.pose + (m.pose === 'walk' ? (m.left ? '←' : '→') : '') : 'gone'} ${m.card}`; if (seq.at(-1)?.k !== k) seq.push({ k, t: s.t }) }
  log(id, seq.map((x) => `${x.t}s ${x.k}`).join(' · '))
}
log('scene files loaded at noon:', scene(p))
log('clock at noon (hands, deg):', await p.ev(`[...document.querySelectorAll('section svg g[transform^="rotate"]')].map(g=>g.getAttribute('transform'))`))

log('# off screen: scroll to the top, then back')
await p.ev('scrollTo(0,0)'); await p.sleep(800)
const off = await p.ev(`(()=>{const r=${room('专注真正重要的')};const a=document.querySelector('.of-leaver-bot').getAnimations()[0];return {dataOff:r.hasAttribute('data-off'),playState:getComputedStyle(document.querySelector('.of-leaver-bot')).animationPlayState,t:Math.round(a.currentTime)}})()`)
await p.sleep(1500); log('off screen:', off, '1.5s later t =', await p.ev(`Math.round(document.querySelector('.of-leaver-bot').getAnimations()[0].currentTime)`))
await p.ev(`(${sec('专注真正重要的')}).scrollIntoView({block:'center'})`); await p.sleep(500)
log('back on screen:', await p.ev(`({dataOff:${room('专注真正重要的')}.hasAttribute('data-off'),playState:getComputedStyle(document.querySelector('.of-leaver-bot')).animationPlayState})`))
// two more loops: the card numbers move on
const cards = [await p.ev(movers)]
for (let i = 0; i < 2; i++) { await p.ev(`new Promise(r=>{const e=document.querySelector('.of-leaver-bot');let last=e.getAnimations()[0].currentTime%18000;const t=setInterval(()=>{const c=e.getAnimations()[0].currentTime%18000;if(c<last){clearInterval(t);setTimeout(r,300)}last=c},50)})`); cards.push(await p.ev(movers)) }
log('cards at the start of three loops (leaver / finisher / arrival):', cards.map((c) => [c.leaver.card, c.finisher.card, c.arrival.card].join(' / ')))
await p.close()

log('# four local times')
const times = [['06:30', 'dawn'], ['12:00', 'day'], ['18:30', 'dusk'], ['23:15', 'night']]
const crops = []
for (const [t, name] of times) {
  p = await page(1440, 900, { time: t }); await p.nav(`${SITE}/zh`, 3000)
  await p.ev(`(${sec('专注真正重要的')}).scrollIntoView({block:'center'})`); await p.sleep(2500)
  const r = await rect(p, room('专注真正重要的'))
  // the top of the room: both windows and the clock
  const file = `.t-${name}.png`; crops.push(file)
  await p.shot(`${OUT}/${file}`, { x: r.x, y: r.y, width: r.width, height: Math.round(r.height * 0.42) })
  log(t, { sceneFiles: scene(p), hands: await p.ev(`[...document.querySelectorAll('section svg g[transform^="rotate"]')].map(g=>g.getAttribute('transform')).join(' ')`) })
  await p.close()
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...crops.flatMap((f) => ['-i', `${OUT}/${f}`]), '-filter_complex', `vstack=inputs=${crops.length}`, `${OUT}/23-zh-office-four-times.png`])
for (const f of crops) fs.rmSync(`${OUT}/${f}`)

log('# phone 390x844')
p = await page(390, 844, { mobile: true, time: '12:00' }); await p.nav(`${SITE}/zh`, 3500)
await p.ev(`(${sec('专注真正重要的')}).scrollIntoView({block:'center'})`); await p.sleep(1500)
log(await p.ev(`(()=>{const r=${room('专注真正重要的')}.getBoundingClientRect();return {roomWidth:Math.round(r.width),roomHeight:Math.round(r.height),display:getComputedStyle(${sec('专注真正重要的')}).display,overflowX:document.documentElement.scrollWidth>innerWidth}})()`))
await p.shot(`${OUT}/24-phone-office.png`); await p.close()

log('# reduced motion')
p = await page(1440, 900, { time: '18:30', reduce: true }); await p.nav(`${SITE}/zh`, 3000)
await p.ev(`(${sec('专注真正重要的')}).scrollIntoView({block:'center'})`); await p.sleep(1000)
const a1 = await p.ev(movers); await p.sleep(4000); const a2 = await p.ev(movers)
log('movers, 4s apart:', a1, a2, 'same:', JSON.stringify(a1) === JSON.stringify(a2))
log('clouds animation:', await p.ev(`getComputedStyle(document.querySelector('.ex-drift')).animationName`), 'scene files:', scene(p))
const rr = await rect(p, sec('专注真正重要的'))
await p.shot(`${OUT}/25-reduced-office.png`, { x: rr.x - 20, y: rr.y - 20, width: rr.width + 40, height: rr.height + 40 }); await p.close()

log('# English')
p = await page(1440, 900, { time: '12:00' }); await p.nav(`${SITE}/`, 3000)
log(await p.ev(`(()=>{const s=${sec('Focus on what matters')};return {title:s.querySelector('h2').innerText.replace(/\\n/g,' / '),body:s.querySelector('p').innerText}})()`))
await p.close()
for (const l of ['es', 'fr', 'ja']) { p = await page(1440, 900); await p.nav(`${SITE}/${l}`, 3000); log(l, await p.ev(`(()=>{const h=[...document.querySelectorAll('main h2')];const s=h[1].closest('section');return {title:h[1].innerText.replace(/\\n/g,' / '),body:s.querySelector('p').innerText,hasRoom:!!s.querySelector('.of-leaver-bot')}})()`)); await p.close() }
log('index.md:', (await (await fetch(`${SITE}/index.md`)).text()).split('\n').filter((l) => /Focus on what matters|Complex work moves/.test(l)))
