// Usage: SITE=http://127.0.0.1:4417 CDP_PORT=9417 node templates.mjs <proof dir>
import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4417'
let log = ''
const short = (u) => u.replace(/^https?:\/\/127\.0\.0\.1:\d+/, '').replace(/\/media\/[0-9a-f-]+\//, '/media/…/')
const media = (u) => /api\.ai4kanban|youtube|\.mp4|\.webm(\?|$)/.test(u)
const watch = (p) => { const r = []; p.on(d => { if (d.method === 'Network.requestWillBeSent' && media(d.params.request.url)) r.push(short(d.params.request.url)) }); return r }
const text = (p, sel = 'main') => p.ev(`document.querySelector(${JSON.stringify(sel)}).innerText.replace(/\\n+/g,' | ')`)
const mediaEls = (p) => p.ev(`[...document.querySelectorAll('main img, main video, main iframe')].map(m=>{const b=m.getBoundingClientRect();return m.tagName+' '+(m.currentSrc||m.src).replace(/\\/media\\/[0-9a-f-]+\\//,'/media/…/').replace(/^https?:\\/\\/[^/]+/,'')+(m.naturalWidth?' natural '+m.naturalWidth+'x'+m.naturalHeight:'')+' shown '+Math.round(b.width)+'x'+Math.round(b.height)}).join('\\n')`)
const btn = (t) => `[...document.querySelectorAll('main button, main a')].find(b=>b.innerText.includes(${JSON.stringify(t)}))`

// 1. catalog home
let p = await open(1280, 900); let req = watch(p)
await p.nav(B + '/templates', 6000)
for (let y = 0; y < await p.ev('document.body.scrollHeight'); y += 400) { await p.ev(`scrollTo(0,${y})`); await p.sleep(200) }
await p.ev('scrollTo(0,0)'); await p.sleep(800)
log += `# 1. Open /templates\ntitle: ${await p.ev('document.title')}\n${await text(p)}\nsections: ${await p.ev(`[...document.querySelectorAll('main section[id], main [id]')].map(s=>s.id).join(', ')`)}\nmedia requests after scrolling the whole page:\n${req.join('\n')}\nany video/iframe on the page: ${await p.ev(`document.querySelectorAll('video,iframe').length`)}\n`
await p.shot(D + '01-catalog-top.png', { x: 0, y: 0, width: 1280, height: 900 })
const props = `[...document.querySelectorAll('main h2')].find(h=>h.innerText==='Props')`
const pb = await p.box(props); const end = await p.ev(`document.querySelector('main').getBoundingClientRect().bottom+scrollY`)
await p.sleep(1200); await p.shot(D + '02-props-and-motion.png', { x: 0, y: pb.y - 30, width: 1280, height: end - pb.y + 30 })

// 2. open the video template
await p.click(`document.querySelector('main a[href="/templates/video/ui-walkthrough-launch"]')`); await p.sleep(5000)
req.length = 0
log += `\n# 2. Click "UI walkthrough launch"\nurl: ${short(await p.ev('location.href'))}\n${await text(p)}\nmedia on the page:\n${await mediaEls(p)}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '03-video-detail.png', { x: 0, y: 0, width: 1280, height: 900 })

// 3. play the original
req.length = 0
await p.click(`[...document.querySelectorAll('main button')][0]`); await p.sleep(6000)
log += `\n# 3. Click play on "Original video"\nrequests after the click:\n${req.join('\n')}\nmedia on the page:\n${await mediaEls(p)}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '04-original-playing.png', { x: 0, y: 0, width: 1280, height: 900 })

// 4. play the recreation
req.length = 0
await p.click(`[...document.querySelectorAll('main button')].at(-1)`); await p.sleep(6000)
log += `\n# 4. Click play on "Recreation"\nrequests after the click:\n${req.join('\n')}\nmedia on the page:\n${await mediaEls(p)}\nvideo state: ${JSON.stringify(await p.ev(`[...document.querySelectorAll('main video')].map(v=>({paused:v.paused,t:Math.round(v.currentTime*10)/10,ready:v.readyState,controls:v.controls}))`))}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '05-recreation-playing.png', { x: 0, y: 0, width: 1280, height: 900 })

// 5. back
await p.click(btn('Back to video templates')); await p.sleep(4000)
log += `\n# 5. Click "Back to video templates"\nurl: ${short(await p.ev('location.href'))}\nscrollY: ${await p.ev('Math.round(scrollY)')}  "Video templates" heading top in viewport: ${await p.ev(`Math.round([...document.querySelectorAll('main h2')].find(h=>h.innerText==='Video templates').getBoundingClientRect().y)`)}\n`
await p.shot(D + '06-back-to-video.png', { x: 0, y: await p.ev('scrollY'), width: 1280, height: 600 })
await p.close()

// 6. a prop
p = await open(1280, 1300); req = watch(p)
await p.nav(B + '/templates/prop/chrome-window', 6000)
log += `\n# 6. Open /templates/prop/chrome-window\ntitle: ${await p.ev('document.title')}\n${await text(p)}\nmedia on the page:\n${await mediaEls(p)}\n`
await p.shot(D + '07-prop-detail.png', { x: 0, y: 0, width: 1280, height: 1300 })
await p.close()

// 7. a motion, in Chinese
p = await open(1280, 1300); req = watch(p)
await p.nav(B + '/zh/templates/motion/logo-build', 6000)
log += `\n# 7. Open /zh/templates/motion/logo-build\ntitle: ${await p.ev('document.title')}\n${await text(p)}\nmedia on the page:\n${await mediaEls(p)}\n`
await p.shot(D + '08-motion-detail-zh.png', { x: 0, y: 0, width: 1280, height: 1300 })
await p.close()

// 8. phone
p = await open(390, 844, true); req = watch(p)
await p.nav(B + '/templates/video/ui-walkthrough-launch', 6000)
log += `\n# 8. Phone (390px) /templates/video/ui-walkthrough-launch\npage width: ${await p.ev('document.documentElement.scrollWidth')}\nmedia on the page:\n${await mediaEls(p)}\n`
await p.shot(D + '09-phone-video-detail.png', { x: 0, y: 0, width: 390, height: 1300 })
await p.nav(B + '/templates/prop/macos-open-panel', 6000)
log += `phone /templates/prop/macos-open-panel page width: ${await p.ev('document.documentElement.scrollWidth')}\nmedia on the page:\n${await mediaEls(p)}\n`
await p.shot(D + '10-phone-prop-detail.png', { x: 0, y: 0, width: 390, height: 1000 })
await p.close()

// 9. missing template
p = await open(1280, 900)
await p.nav(B + '/templates/prop/no-such-template', 6000)
log += `\n# 9. Open /templates/prop/no-such-template\ntitle: ${await p.ev('document.title')}\n${await text(p)}\nlinks: ${await p.ev(`[...document.querySelectorAll('main a')].map(a=>a.getAttribute('href')+' '+a.innerText).join(' | ')`)}\n`
await p.shot(D + '11-missing.png', { x: 0, y: 0, width: 1280, height: 600 })
await p.close()

fs.writeFileSync(D + 'templates.log', log)
console.log(log)
