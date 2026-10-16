// Walks /demo at 1600×1000: each step's ringed control, a click off the ring, ?step=, Replay
// and reduced motion. Usage: SITE=127.0.0.1:4371 CDP_PORT=9371 OUT=<proof dir> node demo.mjs
import fs from 'node:fs'
import { open } from './cdp.mjs'
const SITE = `http://${process.env.SITE || '127.0.0.1:4330'}`, OUT = process.env.OUT || '.'
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(`${OUT}/demo.log`, s + '\n') }
const p = await open(1600, 1000)
const state = () => p.ev(`(()=>{const r=document.querySelector('[data-demo-ring]');const b=r&&r.getBoundingClientRect();return {url:location.pathname+location.search,hint:r?.nextElementSibling?.textContent||null,progress:[...document.querySelectorAll('span')].find(s=>/^\\d+ \\/ \\d+$/.test(s.textContent.trim()))?.textContent.trim()||null,ring:b?{x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)}:null}})()`)
const ringed = async () => { const t = Date.now(); let s; while (Date.now() - t < 10000) { s = await state(); if (s.ring) return { ...s, waitedMs: Date.now() - t }; await p.sleep(100) } return s }
const tap = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }) }
const names = ['01-board', '02-idea-typed', '03-planned', '04-group', '05-draft', '06-revision-typed', '07-ready', '08-archive']
log('# open /demo'); await p.nav(`${SITE}/demo`, 3000)
log(await p.ev(`({title:document.title,robots:document.querySelector('meta[name=robots]')?.content})`))
for (let i = 1; i <= 8; i++) {
  const s = await ringed(); log(`step ${i}`, s); await p.sleep(400); await p.shot(`${OUT}/${names[i - 1]}.png`)
  if (i === 1) { await tap(800, 500); await p.sleep(800); log('clicked the board off the ring ->', await state()) }
  if (i === 7) log('#39 status', await p.ev(`[...document.querySelectorAll('[data-demo-body] main *')].map(e=>e.childNodes.length<=2&&e.textContent.trim()).find(t=>/ready/i.test(t||''))||null`))
  if (i === 8) log('archive view', await p.ev(`document.querySelector('[data-demo-body] main')?.innerText.slice(0,300)`))
  await tap(s.ring.x, s.ring.y)
}
await p.sleep(1000); log('# replay'); log('after Replay', await state())
log('# straight to ?step=4, and an out-of-range step')
await p.nav(`${SITE}/demo?step=4`, 3000); log('?step=4', await state())
await p.nav(`${SITE}/demo?step=99`, 3000); log('?step=99', await state())
log('# reduced motion: step 3 shows its result at once')
await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await p.nav(`${SITE}/demo?step=3`, 1500); log('reduced, 1.5s after load:', await state())
await p.close()
