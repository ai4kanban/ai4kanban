import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = 'http://' + (process.env.SITE || '127.0.0.1:4330')
const FIG = (i) => `document.querySelectorAll('main figure')[${i}]`
const figShot = async (pg, i, file, w) => {
  await pg.ev(`${FIG(i)}.scrollIntoView({block:'center'})`); await pg.sleep(2000)
  const b = await pg.ev(`(()=>{const r=${FIG(i)}.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height}})()`)
  await pg.shot(D + file, { x: Math.max(0, b.x - 24), y: b.y - 24, width: Math.min(w, b.w + 48), height: b.h + 48 })
  return `figure ${i + 1}: ${JSON.stringify(await pg.ev(`(()=>{const f=${FIG(i)};return {label:f.querySelector('svg').getAttribute('aria-label'),caption:f.querySelector('figcaption')?.innerText,width:Math.round(f.getBoundingClientRect().width)}})()`))}\n`
}
const p = await open(1280, 900)
let log = ''
await p.nav(B + '/blog/spec-to-code', 5000)
log += `# 1. Click the author line on a blog post\nbyline: ${await p.ev(`document.querySelector('main a[href="/builder"]').innerText.replace(/\\n/g,' ')`)}\n`
await p.click(`document.querySelector('main a[href="/builder"]')`); await p.sleep(4000)
log += `location: ${await p.ev('location.pathname')}\ntitle: ${await p.ev('document.title')}\ndescription: ${await p.ev(`document.querySelector('meta[name=description]').content`)}\nh1: ${await p.ev(`document.querySelector('h1').innerText`)}\nwho: ${await p.ev(`document.querySelector('main img').alt+' — '+document.querySelector('main img').nextElementSibling.innerText.replace(/\\n/g,' / ')`)}\nlists: ${await p.ev(`document.querySelectorAll('main ul,main ol').length`)}, faq-like headings: ${await p.ev(`document.querySelectorAll('main h2,main h3').length`)}\nparagraphs: ${await p.ev(`document.querySelectorAll('main article p').length`)}\nbold: ${await p.ev(`[...document.querySelectorAll('main strong')].map(s=>s.innerText).join(' | ')`)}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(1000)
await p.shot(D + '01-builder-top.png', { x: 0, y: 0, width: 1280, height: 900 })
log += `\n# 2. Scroll to the first picture\n` + await figShot(p, 0, '02-asking-first.png', 1280)
log += `\n# 3. Scroll to the second picture\n` + await figShot(p, 1, '03-drafts-first.png', 1280)
await p.ev(`[...document.querySelectorAll('main p')].find(x=>x.innerText.trim()==='Tao').scrollIntoView({block:'center'})`); await p.sleep(2000)
log += `\n# 4. The end of the letter\nlast paragraph: ${await p.ev(`[...document.querySelectorAll('main article p')].at(-2).innerText`)}\nlinks: ${await p.ev(`[...document.querySelectorAll('main article a')].map(a=>(a.innerText.trim()||a.getAttribute('aria-label'))+' -> '+a.getAttribute('href')+(a.target==='_blank'?' (new tab)':'')).join('\\n  ')`)}\n`
await p.shot(D + '04-signature.png', { x: 0, y: await p.ev('scrollY'), width: 1280, height: 900 })
await p.close()
const m = await open(390, 844, true)
await m.nav(B + '/builder', 5000)
log += `\n# 5. Same page on a 390px phone\nscrollWidth: ${await m.ev('document.documentElement.scrollWidth')} (viewport 390)\n` + await figShot(m, 0, '05-phone-picture.png', 390)
await m.close()
log += `\n# 6. What an AI reads\n`
for (const path of ['/builder.md', '/llms.txt']) {
  const r = await fetch(B + path); const t = await r.text()
  log += `GET ${path} -> ${r.status} ${r.headers.get('content-type')}\n`
  log += path === '/llms.txt' ? t.split('\n').filter(l => /builder/i.test(l)).join('\n') + '\n' : t.split('\n').slice(0, 8).join('\n') + '\n...\n' + t.trim().split('\n').slice(-3).join('\n') + `\n(old bullets/FAQ present: ${/FAQ|^- /m.test(t)})\n`
}
fs.writeFileSync(D + 'builder.log', log); console.log(log)
