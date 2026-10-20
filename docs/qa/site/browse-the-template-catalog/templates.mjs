// Usage: SITE=http://127.0.0.1:4583 CDP_PORT=9583 node templates.mjs <proof dir>
// The live catalog list does not carry motion clips until Cloud is redeployed (#1873), so
// steps 3 and 11 answer /v1/catalog with the live list plus each motion's registered clip;
// step 4 adds ten copies of the motions to see the pager. Everything else is live.
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4583'
const API = 'https://api.ai4kanban.dev/v1/catalog'
let log = ''
const curl = (u) => JSON.parse(execSync(`curl -s --max-time 20 ${u}`).toString())
const live = curl(API)
const withClips = structuredClone(live)
const motion = withClips.categories.find((c) => c.category === 'motion')
for (const t of motion.templates) t.clip = curl(`${API}/${t.name}`).template.recreation.video
const fourteen = structuredClone(withClips)
const m14 = fourteen.categories.find((c) => c.category === 'motion')
m14.templates = Array.from({ length: 14 }, (_, i) => { const t = motion.templates[i % 4]; return i < 4 ? t : { ...t, name: `${t.name}-copy${i}`, title: `${t.title} (copy ${i})` } })

const short = (u) => u.replace(/^https?:\/\/127\.0\.0\.1:\d+/, '').replace(/\/media\/[0-9a-f-]+\//, '/media/…/')
const media = (u) => /api\.ai4kanban|youtube|\.mp4|\.webm(\?|$)/.test(u)
const watch = (p) => { const r = []; p.on(d => { if (d.method === 'Network.requestWillBeSent' && media(d.params.request.url)) r.push(short(d.params.request.url)) }); return r }
const text = (p, sel = 'main') => p.ev(`document.querySelector(${JSON.stringify(sel)}).innerText.replace(/\\n+/g,' | ')`)
const mediaEls = (p) => p.ev(`[...document.querySelectorAll('main img, main video, main iframe')].map(m=>{const b=m.getBoundingClientRect();return m.tagName+' '+(m.currentSrc||m.src).replace(/\\/media\\/[0-9a-f-]+\\//,'/media/…/').replace(/^https?:\\/\\/[^/]+/,'')+(m.naturalWidth?' natural '+m.naturalWidth+'x'+m.naturalHeight:'')+' shown '+Math.round(b.width)+'x'+Math.round(b.height)+' at x'+Math.round(b.x)}).join('\\n')`)
const videos = (p) => p.ev(`JSON.stringify([...document.querySelectorAll('main video')].map(v=>({src:v.src.split('/').pop(),paused:v.paused,t:Math.round(v.currentTime*10)/10,muted:v.muted,loop:v.loop,controls:v.controls,width:Math.round(v.getBoundingClientRect().width)})))`)
const tabs = (p) => p.ev(`[...document.querySelectorAll('main nav a')].map(a=>(a.getAttribute('aria-current')?'[on] ':'')+a.innerText.replace(/\\n/g,' ')+' color '+getComputedStyle(a).color+' bg '+getComputedStyle(a).backgroundColor).join('\\n')`)
const btn = (t) => `[...document.querySelectorAll('main button, main a')].find(b=>b.innerText.trim()===${JSON.stringify(t)}||b.getAttribute('aria-label')===${JSON.stringify(t)})`
const tile = (name) => `document.querySelector('main a[href$="/${name}"]')`
const move = async (p, x, y) => p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
async function stub(p, body) {
  await p.send('Fetch.enable', { patterns: [{ urlPattern: API }] })
  p.on(async (d) => {
    if (d.method !== 'Fetch.requestPaused') return
    await p.send('Fetch.fulfillRequest', { requestId: d.params.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }, { name: 'access-control-allow-origin', value: '*' }], body: Buffer.from(JSON.stringify(body)).toString('base64') })
  })
}

// 1. catalog home
let p = await open(1280, 900); let req = watch(p)
await p.nav(B + '/templates', 7000)
log += `# 1. Open /templates\ntitle: ${await p.ev('document.title')}\n${await text(p)}\ntabs:\n${await tabs(p)}\nmedia requests:\n${req.join('\n')}\nhistory.length: ${await p.ev('history.length')}\n`
await p.shot(D + '01-catalog-ui-tab.png', { x: 0, y: 0, width: 1280, height: 900 })

// 2. Motion tab, live list
req.length = 0
await p.click(`[...document.querySelectorAll('main nav a')].find(a=>a.innerText.startsWith('Motion'))`); await p.sleep(3000)
log += `\n# 2. Click the "Motion" tab (live catalog)\nurl: ${short(await p.ev('location.href'))}  history.length: ${await p.ev('history.length')}\n${await text(p)}\ntabs:\n${await tabs(p)}\nmedia on the page:\n${await mediaEls(p)}\nmedia requests after the click:\n${req.join('\n')}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(600)
await p.shot(D + '02-motion-tab.png', { x: 0, y: 0, width: 1280, height: 900 })
const b0 = await p.ev(`(()=>{const b=${tile('card-widen')}.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+60}})()`)
req.length = 0
await move(p, b0.x, b0.y); await p.sleep(3000)
log += `hover "card-widen" with the live list: videos ${await videos(p)}  requests: ${req.join(', ') || 'none'}\n`
await move(p, 5, 5)
await p.close()

// 3. hover plays the clip (stand-in list with clips)
p = await open(1280, 900); req = watch(p); await stub(p, withClips)
await p.nav(B + '/templates#motion', 7000)
log += `\n# 3. Hover a motion tile (catalog answered with each motion's registered clip)\nvideos before hovering: ${await videos(p)}  clip requests: ${req.filter(r => r.endsWith('.mp4')).length}\n`
const b1 = await p.ev(`(()=>{const b=${tile('card-widen')}.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+60}})()`)
await move(p, b1.x, b1.y); await p.sleep(1500)
log += `hovering card-widen after 1.5s: ${await videos(p)}\n`
await p.sleep(1000)
await p.shot(D + '03-hover-plays.png', { x: 0, y: 0, width: 1280, height: 900 })
log += `after 2.5s: ${await videos(p)}  progress bar: ${await p.ev(`!!${tile('card-widen')}.querySelector('[role=progressbar], .h-\\\\[3px\\\\], [style*=width]')`)}\nclip requests: ${req.filter(r => r.endsWith('.mp4')).join(', ')}\n`
await move(p, 5, 5); await p.sleep(1200)
log += `pointer moved away: ${await videos(p)}\n`
await p.shot(D + '04-hover-left.png', { x: 0, y: 0, width: 1280, height: 900 })
await p.close()

// 4. pager (stand-in: 14 motions)
p = await open(1280, 900); await stub(p, fourteen)
await p.nav(B + '/templates#motion', 7000)
log += `\n# 4. A tab with 14 templates (stand-in list)\ntiles: ${await p.ev(`document.querySelectorAll('main section a[href*="/templates/"]').length`)}\npager: ${await text(p, 'main nav[aria-label="Pages"]')}\n`
const pg = await p.box(`document.querySelector('main nav[aria-label="Pages"]')`)
await p.shot(D + '05-pager.png', { x: 0, y: pg.y - 500, width: 1280, height: 620 })
await p.click(btn('Next')); await p.sleep(2000)
log += `click "Next": tiles ${await p.ev(`document.querySelectorAll('main section a[href*="/templates/"]').length`)}  current page: ${await p.ev(`document.querySelector('main nav[aria-label="Pages"] [aria-current]').innerText`)}  scrollY ${await p.ev('Math.round(scrollY)')}  grid top in viewport ${await p.ev(`Math.round(document.querySelector('main section .grid').getBoundingClientRect().y)`)}\n`
await p.shot(D + '06-page-2.png', { x: 0, y: await p.ev('scrollY'), width: 1280, height: 900 })
await p.click(`[...document.querySelectorAll('main nav a')].find(a=>a.innerText.startsWith('Props'))`); await p.sleep(1500)
log += `switch to "Props": pager ${await p.ev(`document.querySelector('main nav[aria-label="Pages"]')?'shown':'none'`)}  tiles ${await p.ev(`document.querySelectorAll('main section a[href*="/templates/"]').length`)}\n`
await p.click(`[...document.querySelectorAll('main nav a')].find(a=>a.innerText.startsWith('Motion'))`); await p.sleep(1500)
log += `back to "Motion": current page ${await p.ev(`document.querySelector('main nav[aria-label="Pages"] [aria-current]').innerText`)}\n`
await p.close()

// 5–8. video template
p = await open(1280, 900); req = watch(p)
await p.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: B })
await p.nav(B + '/templates#video', 7000)
await p.click(tile('ui-walkthrough-launch')); await p.sleep(5000)
log += `\n# 5. Open "UI walkthrough launch" from the Video tab\nurl: ${short(await p.ev('location.href'))}\ntitle: ${await p.ev('document.title')}\n${await text(p)}\nmedia on the page:\n${await mediaEls(p)}\nlinks in the sidebar: ${await p.ev(`[...document.querySelectorAll('main aside a, main a')].map(a=>a.getAttribute('href')).filter(h=>/download|pricing/.test(h)).join(', ')||'no download or pricing link'`)}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '07-video-detail.png', { x: 0, y: 0, width: 1280, height: 900 })
await p.click(btn('Copy prompt')); await p.sleep(400)
log += `\n# 6. Click "Copy prompt"\nbutton now: ${await p.ev(`[...document.querySelectorAll('main button')].map(b=>b.innerText.trim()).filter(Boolean).join(' | ')`)}\nclipboard: ${await p.ev('navigator.clipboard.readText()')}\n`
await p.shot(D + '08-copied.png', { x: 0, y: 0, width: 1280, height: 900 })
await p.sleep(2500)
log += `2.9s later: ${await p.ev(`[...document.querySelectorAll('main button')].map(b=>b.innerText.trim()).filter(Boolean).join(' | ')`)}\n`
req.length = 0
await p.click(`[...document.querySelectorAll('main button')].find(b=>(b.getAttribute('aria-label')||'').includes('Original'))`); await p.sleep(6000)
log += `\n# 7. Play "Original video"\nrequests after the click:\n${req.join('\n')}\nmedia:\n${await mediaEls(p)}\n`
req.length = 0
await p.click(`[...document.querySelectorAll('main button')].find(b=>(b.getAttribute('aria-label')||'').includes('Recreation'))`); await p.sleep(6000)
log += `play "Recreation": requests ${req.join(', ')}  videos ${await videos(p)}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '09-both-playing.png', { x: 0, y: 0, width: 1280, height: 900 })
await p.click(btn('Back to video templates')); await p.sleep(4000)
log += `\n# 8. Click "Back to video templates"\nurl: ${short(await p.ev('location.href'))}\ntabs:\n${await tabs(p)}\ntiles: ${await p.ev(`[...document.querySelectorAll('main section a[href*="/templates/"]')].map(a=>a.getAttribute('href')).join(', ')`)}\n`
await p.shot(D + '10-back-to-video.png', { x: 0, y: 0, width: 1280, height: 900 })
await p.close()

// 9. a prop
p = await open(1280, 1100)
await p.nav(B + '/templates/prop/chrome-window', 6000)
log += `\n# 9. Open /templates/prop/chrome-window\n${await text(p)}\nmedia:\n${await mediaEls(p)}\n`
await p.shot(D + '11-prop-detail.png', { x: 0, y: 0, width: 1280, height: 1100 })
await p.close()

// 10. a motion in Chinese
p = await open(1280, 1000); req = watch(p)
await p.nav(B + '/zh/templates/motion/card-widen', 7000)
log += `\n# 10. Open /zh/templates/motion/card-widen\ntitle: ${await p.ev('document.title')}\n${await text(p)}\nmedia:\n${await mediaEls(p)}\nvideos: ${await videos(p)}\n`
await p.shot(D + '12-motion-zh-playing.png', { x: 0, y: 0, width: 1280, height: 1000 })
await p.sleep(5000)
log += `5s later: ${await videos(p)}\n`
await p.click(btn('暂停')); await p.sleep(1500)
log += `click 暂停: ${await videos(p)}  button now: ${await p.ev(`[...document.querySelectorAll('main button')].map(b=>b.getAttribute('aria-label')).filter(Boolean).join(' | ')`)}\n`
await p.shot(D + '13-motion-zh-paused.png', { x: 0, y: 0, width: 1280, height: 1000 })
await p.close()

// 11. reduced motion
p = await open(1280, 900); await stub(p, withClips)
await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await p.nav(B + '/templates#motion', 7000)
const b2 = await p.ev(`(()=>{const b=${tile('card-widen')}.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+60}})()`)
await move(p, b2.x, b2.y); await p.sleep(2500)
log += `\n# 11. Reduced motion\nhover card-widen on the list: videos ${await videos(p)}\n`
await p.nav(B + '/templates/motion/card-widen', 7000)
log += `motion page: videos ${await videos(p)}  buttons: ${await p.ev(`[...document.querySelectorAll('main button')].map(b=>b.getAttribute('aria-label')||b.innerText.trim()).join(' | ')`)}\n`
await p.shot(D + '14-reduced-motion-detail.png', { x: 0, y: 0, width: 1280, height: 900 })
await p.close()

// 12. phone
p = await open(390, 844, true); await stub(p, withClips)
await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await p.nav(B + '/templates', 7000)
log += `\n# 12. Phone (390px) /templates\npage width: ${await p.ev('document.documentElement.scrollWidth')}  tab row scrollWidth ${await p.ev(`document.querySelector('main nav div').scrollWidth`)} clientWidth ${await p.ev(`document.querySelector('main nav div').clientWidth`)}\n`
await p.shot(D + '15-phone-catalog.png', { x: 0, y: 0, width: 390, height: 844 })
await p.click(`[...document.querySelectorAll('main nav a')].find(a=>a.innerText.startsWith('Motion'))`); await p.sleep(2000)
for (const n of ['platform-orbit', 'gather-into-icon']) { await p.ev(`${tile(n)}.scrollIntoView({block:'center'})`); await p.sleep(2500); log += `scrolled ${n} into view: ${await videos(p)}\n` }
await p.shot(D + '16-phone-motion-visible-plays.png', { x: 0, y: await p.ev('scrollY'), width: 390, height: 844 })
await p.nav(B + '/templates/video/ui-walkthrough-launch', 6000)
log += `phone video page width: ${await p.ev('document.documentElement.scrollWidth')}\nmedia:\n${await mediaEls(p)}\n`
await p.shot(D + '17-phone-video-detail.png', { x: 0, y: 0, width: 390, height: 1400 })
await p.close()

// 13. missing template
p = await open(1280, 900)
await p.nav(B + '/templates/prop/no-such-template', 6000)
log += `\n# 13. Open /templates/prop/no-such-template\ntitle: ${await p.ev('document.title')}\n${await text(p)}\nlinks: ${await p.ev(`[...document.querySelectorAll('main a')].map(a=>a.getAttribute('href')+' '+a.innerText).join(' | ')`)}\n`
await p.shot(D + '18-missing.png', { x: 0, y: 0, width: 1280, height: 600 })
await p.close()

fs.writeFileSync(D + 'templates.log', log)
console.log(log)
