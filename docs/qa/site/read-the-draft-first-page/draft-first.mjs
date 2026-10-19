import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const SITE = 'http://' + (process.env.SITE || '127.0.0.1:4330')
let log = ''
const p = await open(1280, 900)
const reqs = []
p.on((e) => { if (e.method === 'Network.requestWillBeSent') reqs.push(e.params.request.url) })
await p.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: SITE })

log += '# 1. Home footer, then click "draft-first"\n'
await p.nav(SITE + '/', 5000)
log += `SOLUTIONS: ${await p.ev(`[...document.querySelectorAll('footer h2')].filter(h=>/solutions/i.test(h.innerText)).map(h=>[...h.parentElement.querySelectorAll('a')].map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join(', ')).join('')`)}\n`
log += `header nav mentions draft-first: ${await p.ev(`!!document.querySelector('header a[href*="draft-first"]')`)}\n`
await p.ev(`[...document.querySelectorAll('footer a')].find(a=>a.textContent.trim()==='draft-first').scrollIntoView({block:'center'})`); await p.sleep(1500)
const fb = await p.ev(`(()=>{const r=document.querySelector('footer nav').getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`)
await p.shot(D + '01-footer-link.png', { x: 0, y: fb.y - 24, width: 1280, height: fb.h + 48 })
await p.click(`[...document.querySelectorAll('footer a')].find(a=>a.textContent.trim()==='draft-first')`); await p.sleep(5000)
log += `landed on: ${await p.ev('location.pathname')}\ntitle: ${await p.ev('document.title')}\n`

log += '\n# 2. Hero\n'
await p.ev('scrollTo(0,0)'); await p.sleep(2000)
const vid = () => p.ev(`(()=>{const v=document.querySelector('main video');return {src:v.currentSrc.replace(/\\?.*/,''),muted:v.muted,loop:v.loop,paused:v.paused,t:+v.currentTime.toFixed(1)}})()`)
log += `h1: ${JSON.stringify(await p.ev(`document.querySelector('h1').innerText`))}\nlead: ${await p.ev(`document.querySelector('h1').nextElementSibling.innerText`)}\nupdate line: ${await p.ev(`[...document.querySelectorAll('main p')].find(e=>e.querySelector('a[href*="github.com"]')).innerText`)}\ncommand: ${await p.ev(`document.querySelector('main code').innerText`)}\nlogos: ${await p.ev(`[...document.querySelectorAll('main img[title]')].map(i=>i.alt).join(', ')`)}\n`
const v1 = await vid(); await p.sleep(3000); const v2 = await vid()
log += `video: ${JSON.stringify(v1)}\n3s later: t=${v2.t} paused=${v2.paused}\n`
await p.shot(D + '02-hero.png', { x: 0, y: 0, width: 1280, height: 900 })
const ph = await open(390, 844, true)
await ph.nav(SITE + '/draft-first', 5000)
log += `phone: page width ${await ph.ev('document.documentElement.scrollWidth')}, command box fits: ${await ph.ev(`(()=>{const b=document.querySelector('main code').parentElement.getBoundingClientRect();return b.left>=0&&b.right<=390})()`)}\n`
await ph.shot(D + '02b-hero-phone.png', { x: 0, y: 0, width: 390, height: 844 })
await ph.ev(`document.querySelector('main video').scrollIntoView({block:'center'})`); await ph.sleep(2500)
await ph.shot(D + '02c-video-phone.png', { x: 0, y: await ph.ev('scrollY'), width: 390, height: 844 })
await ph.close()

log += '\n# 3. Copy the install command\n'
const btn = `document.querySelector('main code').nextElementSibling`
log += `before: ${await p.ev(`${btn}.innerText`)}\n`
await p.click(btn); await p.sleep(400)
log += `after: ${await p.ev(`${btn}.innerText`)}\nclipboard: ${await p.ev(`navigator.clipboard.readText()`)}\n`
const cb = await p.ev(`(()=>{const r=document.querySelector('main code').parentElement.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height}})()`)
await p.shot(D + '03-copied.png', { x: cb.x - 40, y: cb.y - 20, width: cb.w + 80, height: cb.h + 60 })
await p.sleep(2500)
log += `2.5s later: ${await p.ev(`${btn}.innerText`)}\n`

log += '\n# 4. GitHub link under the command\n'
const gh = `[...document.querySelectorAll('main p a')].find(a=>a.textContent.trim()==='GitHub')`
log += `link: ${await p.ev(`${gh}.getAttribute('href')`)} target=${await p.ev(`${gh}.target||'(same tab)'`)}\n`
const gb = await p.ev(`(()=>{const r=${gh}.closest('p').getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height}})()`)
await p.shot(D + '04-github-link.png', { x: gb.x + gb.w / 2 - 280, y: gb.y - 80, width: 560, height: gb.h + 100 })
const repo = await fetch(await p.ev(`${gh}.href`), { redirect: 'manual' })
log += `GET ${await p.ev(`${gh}.href`)} -> ${repo.status}\n`
const llms = await (await fetch(SITE + '/llms.txt')).text()
log += `llms.txt draft-first line ends: ${llms.split('\n').find(l=>l.includes('/draft-first)')).split('. ').pop()}\n`

log += '\n# 5. Scroll through the sections\n'
const sec = async (n, file) => {
  const s = `[...document.querySelectorAll('main section')].filter(s=>!s.parentElement.closest('section'))[${n}]`
  await p.ev(`scrollTo(0, ${s}.getBoundingClientRect().top + scrollY - 100)`); await p.sleep(2500)
  const b = await p.ev(`(()=>{const r=${s}.getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`)
  await p.shot(D + file, { x: 0, y: b.y - 16, width: 1280, height: Math.min(b.h + 32, 1600) })
  return p.ev(`${s}.innerText.replace(/\\n+/g,' | ').slice(0,600)`)
}
log += `sections: ${await p.ev(`[...document.querySelectorAll('main section')].filter(s=>!s.parentElement.closest('section')).slice(1).map(s=>s.querySelector('h2')).map(h=>h.innerText).join(' | ')`)}\n`
log += `drafts: ${await sec(1, '05a-drafts.png')}\n`
log += `review: ${await sec(2, '05b-review.png')}\n`
log += `helpers: ${await sec(3, '05c-helpers.png')}\n`
log += `upgrade: ${await sec(4, '06-upgrade.png')}\n`
log += `AI4Kanban first named in section: ${await p.ev(`[...document.querySelectorAll('main section')].filter(s=>!s.parentElement.closest('section')).findIndex(s=>s.innerText.includes('AI4Kanban'))`)}\n`
log += `\n# 6. Upgrade links\n  ${await p.ev(`[...[...document.querySelectorAll('main section')].filter(s=>!s.parentElement.closest('section'))[4].querySelectorAll('a')].map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join('\\n  ')`)}\n`
log += `\n# 7. FAQ\n${await sec(5, '07-faq.png')}\n`

log += '\n# 8. Chinese page\n'
const z = await open(1280, 900)
await z.nav(SITE + '/zh/draft-first', 5000)
log += `title: ${await z.ev('document.title')}\nh1: ${JSON.stringify(await z.ev(`document.querySelector('h1').innerText`))}\nh2s: ${await z.ev(`[...document.querySelectorAll('main section')].filter(s=>!s.parentElement.closest('section')).slice(1).map(s=>s.querySelector('h2')).map(h=>h.innerText).join(' | ')`)}\nvideo: ${await z.ev(`document.querySelector('main video').currentSrc.replace(/\\?.*/,'')`)}\n`
await z.shot(D + '08-zh-hero.png', { x: 0, y: 0, width: 1280, height: 900 })
const zf = `[...document.querySelectorAll('main section')].filter(s=>!s.parentElement.closest('section'))[5]`
await z.ev(`scrollTo(0, ${zf}.getBoundingClientRect().top + scrollY - 100)`); await z.sleep(2500)
const zb = await z.ev(`(()=>{const r=${zf}.getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`)
await z.shot(D + '08b-zh-faq.png', { x: 0, y: zb.y - 16, width: 1280, height: Math.min(zb.h + 32, 1600) })
log += `FAQ: ${await z.ev(`${zf}.innerText.replace(/\\n+/g,' | ')`)}\n智能体 on the page: ${await z.ev(`(document.body.innerText.match(/智能体/g)||[]).length`)}\n`
await z.close()

log += '\n# 9. Blog post link\n'
await p.nav(SITE + '/blog/show-the-ui-first', 5000)
log += `${await p.ev(`[...document.querySelectorAll('article a, main a')].filter(a=>/draft-first/.test(a.href)).map(a=>a.closest('p').innerText+' ['+a.textContent+' -> '+a.getAttribute('href')+']').join('\\n')`)}\n`
await p.close()
fs.writeFileSync(D + 'draft-first.log', log); console.log(log)
