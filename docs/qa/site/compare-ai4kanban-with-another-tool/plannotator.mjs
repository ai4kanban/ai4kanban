// /vs-plannotator: footer link, each section, the table row by row, the workflows tip on hover, then the zh page, .md mirror and llms.txt entry.
import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4330'
const p = await open(1280, 900)
let log = ''
const txt = (e) => `(${e}).innerText.replace(/\\n+/g,' | ')`
const sec = (s) => `[...document.querySelectorAll('main h2')].find(h=>h.innerText.includes(${JSON.stringify(s)})).closest('section')`
const shotSection = async (file, sel, max = 900) => {
  await p.ev(`scrollTo(0,(${sel}).getBoundingClientRect().top+scrollY-100)`); await p.sleep(1500)
  const r = await p.ev(`(()=>{const r=(${sel}).getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`)
  const clip = { x: 0, y: r.y - 20, width: 1280, height: Math.min(r.h + 40, max), scale: 1 }
  const s = await p.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true })
  fs.writeFileSync(D + file, Buffer.from(s.data, 'base64'))
}
await p.nav(B + '/', 5000)
const col = `[...document.querySelectorAll('footer *')].find(e=>e.children.length===0&&e.textContent.trim().toUpperCase()==='COMPARE')`
await p.click(`[...(${col}).parentElement.querySelectorAll('a')].find(a=>a.textContent.trim()==='Plannotator')`); await p.sleep(4000)
log += `# 12. Click "Plannotator" in the footer\nlocation: ${await p.ev('location.pathname')}  title: ${await p.ev('document.title')}\nh1: ${await p.ev(`document.querySelector('h1').innerText`)}\nlead: ${await p.ev(`document.querySelector('h1').nextElementSibling?.innerText ?? ''`)}\n${await p.ev(txt(sec('What both support')))}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '11-plannotator-top.png', { x: 0, y: 0, width: 1280, height: 900 })
const theirs = sec('Plannotator: review within')
log += `\n# 13. Read section 01\n${await p.ev(txt(theirs))}\nlinks: ${await p.ev(`[...${theirs}.querySelectorAll('a')].map(a=>a.textContent.trim()+' -> '+a.href).join(' | ')`)}\n`
await shotSection('12-plannotator-theirs.png', theirs)
const ours = sec('AI4Kanban: from key drafts')
log += `\n# 14. Read section 02, then hover the info icon\n${await p.ev(txt(ours))}\n`
await shotSection('13-plannotator-ours.png', ours, 1400)
const tip = `document.querySelector('button[aria-describedby=pro-tip]')`
await p.ev(`${tip}.scrollIntoView({block:'center'})`); await p.sleep(1500)
log += `tip visible before hover: ${await p.ev(`getComputedStyle(document.getElementById('pro-tip')).visibility`)}\n`
const b = await p.ev(`(()=>{const b=${tip}.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`)
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y }); await p.sleep(600)
log += `tip visible on hover: ${await p.ev(`getComputedStyle(document.getElementById('pro-tip')).visibility`)}  text: ${await p.ev(`document.getElementById('pro-tip').innerText`)}\n`
const vy = await p.ev('scrollY')
await p.shot(D + '13b-plannotator-workflows-tip.png', { x: 140, y: vy + b.y - 160, width: 1000, height: 220 })
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 })
const table = sec('What comes built in')
const rows = `[...${table}.querySelectorAll('div.sm\\\\:grid')].slice(1).map(r=>{const c=[...r.querySelectorAll(':scope > div.grid > div')].map(d=>{const s=d.querySelector('svg[aria-label]');return (s?s.getAttribute('aria-label'):'')+(d.innerText.replace(/^(Plannotator|AI4Kanban)\\n?/,'').trim()?' '+d.innerText.replace(/^(Plannotator|AI4Kanban)\\n?/,'').trim():'')});return r.firstElementChild.innerText+' — Plannotator: '+c[0]+', AI4Kanban: '+c[1]}).join('\\n')`
log += `\n# 15. Read "What comes built in"\n${await p.ev(rows)}\nnote: ${await p.ev(`${table}.querySelector('p.text-xs')?.innerText ?? ''`)}\n`
await shotSection('14-plannotator-table.png', table, 1300)
const dec = sec('Which fits')
log += `\n# 16. Read "Which fits your work?" and the end\n${await p.ev(txt(dec))}\n${await p.ev(txt(sec('Ready to coordinate')))}\n`
await shotSection('15-plannotator-which.png', dec)
await p.nav(B + '/zh/vs-plannotator', 4000)
log += `\n# 17. Open /zh/vs-plannotator\ntitle: ${await p.ev('document.title')}\nh1/h2/h3: ${await p.ev(`[...document.querySelectorAll('main h1,main h2,main h3')].map(h=>h.innerText.replace(/\\n/g,' ')).join(' | ')`)}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '16-plannotator-zh-top.png', { x: 0, y: 0, width: 1280, height: 900 })
for (const l of ['ja', 'es', 'fr']) {
  const r = await fetch(B + `/${l}/vs-plannotator`)
  log += `GET /${l}/vs-plannotator -> ${r.status}  <title>: ${((await r.text()).match(/<title>([^<]*)/) || [])[1]}\n`
}
await p.close()
const md = await (await fetch(B + '/vs-plannotator.md')).text()
const llms = await (await fetch(B + '/llms.txt')).text()
log += `\n# 17. GET /vs-plannotator.md (first 8 lines)\n${md.split('\n').slice(0, 8).join('\n')}\n\n# 17. llms.txt lines naming Plannotator\n${llms.split('\n').filter(l => /plannotator/i.test(l)).join('\n')}\n`
fs.writeFileSync(D + 'plannotator.log', log); console.log(log)
