import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = 'http://127.0.0.1:4330'
const p = await open(1280, 900)
let log = ''
await p.nav(B + '/', 5000)
const col = `[...document.querySelectorAll('footer *')].find(e=>e.children.length===0&&e.textContent.trim().toUpperCase()==='COMPARE')`
log += `# 1. Scroll to the footer of /\nCompare column: ${await p.ev(`[...(${col}).parentElement.querySelectorAll('a')].map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join(' | ')`)}\n`
const fb = await p.box(`(${col}).parentElement`); await p.sleep(500)
const fb2 = await p.ev(`(()=>{const b=(${col}).parentElement.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()`)
const vp = await p.ev('scrollY')
await p.shot(D + '01-footer-compare.png', { x: Math.max(0, fb2.x - 20), y: vp + fb2.y - 20, width: fb2.w + 40, height: fb2.h + 40 })
await p.click(`[...(${col}).parentElement.querySelectorAll('a')].find(a=>a.textContent.trim()==='Multica')`); await p.sleep(4000)
log += `\n# 2. Click "Multica"\nlocation: ${await p.ev('location.pathname')}  title: ${await p.ev('document.title')}\nh1: ${await p.ev(`document.querySelector('h1').innerText.replace(/\\n/g,' ')`)}\nlead: ${await p.ev(`document.querySelector('h1').parentElement.querySelector('p')?.innerText ?? ''`)}\nh2s: ${await p.ev(`[...document.querySelectorAll('main h2')].map(h=>h.innerText.replace(/\\n/g,' ')).join(' | ')`)}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(500)
await p.shot(D + '02-multica-top.png', { x: 0, y: 0, width: 1280, height: 900 })
const h = `[...document.querySelectorAll('main h2')].find(h=>h.innerText.includes('Compare the details'))`
const sec = `(${h}).closest('section')`
await p.ev(`(${h}).scrollIntoView({block:'start'})`); await p.sleep(1500)
const t = await p.ev(`(()=>{const r=${sec}.getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`)
log += `\n# 3. Scroll to "Compare the details"\nrows: ${await p.ev(`${sec}.innerText.split('\\n').filter(l=>/^[A-Z][a-z].{3,40}$/.test(l.trim())&&!/[.:]$/.test(l.trim())).join(' | ')`)}\n`
await p.shot(D + '03-multica-details.png', { x: 0, y: t.y, width: 1280, height: Math.min(t.h, 1100) })
const last = `[...document.querySelectorAll('main h2')].at(-1)`
log += `\n# 4. Read the last section\n${await p.ev(`(${last}).closest('section')?.innerText.slice(0,700) ?? (${last}).innerText`)}\n`
for (const u of ['/vs-task-master', '/vs-hermes-kanban', '/zh/vs-multica']) {
  await p.nav(B + u, 4000)
  log += `\n# 5. Open ${u}\nh1: ${await p.ev(`document.querySelector('h1').innerText.replace(/\\n/g,' ')`)}  h2s: ${await p.ev(`[...document.querySelectorAll('main h2')].map(h=>h.innerText.replace(/\\n/g,' ')).join(' | ')`)}\n`
}
await p.close()
fs.writeFileSync(D + 'compare.log', log); console.log(log)
