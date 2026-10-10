import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const p = await open(1280, 900)
const reqs = []
p.on((e) => { if (e.method === 'Network.requestWillBeSent') reqs.push(e.params.request.url) })
let log = ''
await p.nav('http://127.0.0.1:4330/workflows/coding', 6000)
const media = () => p.ev(`[...document.querySelectorAll('main video')].map(v=>({src:(v.currentSrc||v.querySelector('source')?.src||v.getAttribute('src')||'').replace(location.origin,''),poster:(v.poster||'').replace(location.origin,''),muted:v.muted,loop:v.loop,controls:v.controls,paused:v.paused,t:+v.currentTime.toFixed(1)}))`)
const vidReqs = () => reqs.filter(u => /\.(mp4|webm)(\?|$)/.test(u)).map(u => u.replace(/^https?:\/\/[^/]+/, ''))
log += `# 1. Open /workflows/coding\ntitle: ${await p.ev('document.title')}\nh1: ${await p.ev(`document.querySelector('h1').innerText`)}\nh2s: ${await p.ev(`[...document.querySelectorAll('main h2')].map(h=>h.innerText).join(' | ')`)}\nvideos on page: ${JSON.stringify(await media())}\nvideo requests so far: ${JSON.stringify(vidReqs())}\ngif requests: ${reqs.filter(u=>/\.gif/.test(u)).length}\n`
await p.shot(D + '01-hero.png', { x: 0, y: 0, width: 1280, height: 900 })
const v = `document.querySelector('main video')`
if (await p.ev(`!!${v}`)) {
  await p.ev(`(${v}).scrollIntoView({block:'center'})`); await p.sleep(4000)
  log += `\n# 2. Scroll to the first recording\nvideo: ${JSON.stringify((await media())[0])}\nvideo requests: ${JSON.stringify(vidReqs())}\n`
  await p.shot(D + '02-recording-playing.png', { x: 0, y: await p.ev('scrollY'), width: 1280, height: 900 })
  await p.sleep(3000)
  log += `3s later: t=${(await media())[0].t} paused=${(await media())[0].paused}\n`
  await p.ev('scrollTo(0,0)'); await p.sleep(1500)
  log += `\n# 3. Scroll back to the top\nvideo paused: ${(await media())[0].paused}\n`
}
const links = await p.ev(`[...document.querySelectorAll('main a')].map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).filter(s=>/docs|download/.test(s)).join('\\n  ')`)
log += `\n# 4. Links onward\n  ${links}\n`
await p.close()
const r = await open(1280, 900)
await r.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await r.nav('http://127.0.0.1:4330/workflows/coding', 5000)
await r.ev(`document.querySelector('main video')?.scrollIntoView({block:'center'})`); await r.sleep(4000)
log += `\n# 5. Same page with "reduce motion" on\nvideo: ${JSON.stringify(await r.ev(`(()=>{const v=document.querySelector('main video');return v&&{paused:v.paused,controls:v.controls,autoplay:v.autoplay,poster:!!v.poster,t:v.currentTime}})()`))}\n`
await r.shot(D + '05-reduced-motion.png', { x: 0, y: await r.ev('scrollY'), width: 1280, height: 900 })
await r.close()
fs.writeFileSync(D + 'coding.log', log); console.log(log)
