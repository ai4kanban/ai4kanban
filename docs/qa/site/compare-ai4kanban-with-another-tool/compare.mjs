import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4330'
const p = await open(1280, 900)
let log = ''
await p.nav(B + '/', 5000)
const col = `[...document.querySelectorAll('footer *')].find(e=>e.children.length===0&&e.textContent.trim().toUpperCase()==='COMPARE')`
log += `# 1. Scroll to the footer of /\nCompare column: ${await p.ev(`[...(${col}).parentElement.querySelectorAll('a')].map(a=>a.textContent.trim()+' -> '+a.getAttribute('href')).join(' | ')`)}\n`
const fb = await p.box(`(${col}).parentElement`); await p.sleep(2000)
const fb2 = await p.ev(`(()=>{const b=(${col}).parentElement.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}})()`)
const vp = await p.ev('scrollY')
await p.shot(D + '01-footer-compare.png', { x: Math.max(0, fb2.x - 20), y: vp + fb2.y - 20, width: fb2.w + 40, height: fb2.h + 40 })
await p.click(`[...(${col}).parentElement.querySelectorAll('a')].find(a=>a.textContent.trim()==='Multica')`); await p.sleep(4000)
log += `\n# 2. Click "Multica"\nlocation: ${await p.ev('location.pathname')}  title: ${await p.ev('document.title')}\nh1: ${await p.ev(`document.querySelector('h1').innerText.replace(/\\n/g,' ')`)}\nlead: ${await p.ev(`document.querySelector('h1').nextElementSibling?.innerText ?? ''`)}\nh2s: ${await p.ev(`[...document.querySelectorAll('main h2')].map(h=>h.innerText.replace(/\\n/g,' ')).join(' | ')`)}\n`
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
// the five Chinese pages say "agent", never 智能体
log += `\n# 5b. Chinese pages: 智能体 vs agent\n`
for (const u of ['/zh/vs-task-master', '/zh/vs-hermes-kanban', '/zh/vs-multica', '/zh/vs-orca', '/zh/vs-plannotator']) {
  await p.nav(B + u, 4000)
  const t = await p.ev(`document.title+'\\n'+document.querySelector('main').innerText`)
  log += `${u}  智能体: ${(t.match(/智能体/g) || []).length}  agent: ${(t.match(/agent/gi) || []).length}  e.g. ${[...new Set(t.match(/[一-鿿]{0,4} ?agent ?[一-鿿]{0,4}/gi) || [])].slice(0, 4).join(' / ')}\n`
}
await p.nav(B + '/zh/vs-multica', 4000)
const m = `[...document.querySelectorAll('main h2')].find(h=>h.innerText.includes('逐项比较'))`
await p.ev(`(${m}).scrollIntoView({block:'start'})`); await p.sleep(1500)
const zt = await p.ev(`(()=>{const r=(${m}).closest('section').getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`)
await p.shot(D + '04-multica-zh-details.png', { x: 0, y: zt.y, width: 1280, height: Math.min(zt.h, 1100) })
// a row of "Compare the details" by its first cell
const row = (t) => `[...document.querySelectorAll('main section div.border-b')].find(r=>r.firstElementChild?.innerText.trim()===${JSON.stringify(t)})`
const rowText = (t) => p.ev(`(${row(t)}).innerText.replace(/\\n+/g,' | ')`)
const rowShot = async (t, file) => { await p.ev(`(${row(t)}).scrollIntoView({block:'center'})`); await p.sleep(1200); const b = await p.ev(`(()=>{const r=(${row(t)}).getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`); await p.shot(D + file, { x: 0, y: b.y - 50, width: 1280, height: b.h + 70 }) }
log += `\n# 5c. Multica: which workflows need Pro\n`
await p.nav(B + '/vs-multica', 4000)
log += `/vs-multica: ${await rowText('Built-in agents and workflows')}\n`
await rowShot('Built-in agents and workflows', '04b-multica-pro.png')
await p.nav(B + '/zh/vs-multica', 4000)
log += `/zh/vs-multica: ${await rowText('内置 agent 与工作流')}\n`
log += `\n# 5d. Hermes: control from chat apps\n`
await p.nav(B + '/vs-hermes-kanban', 4000)
log += `/vs-hermes-kanban: ${await rowText('Control from chat apps')}\n`
await rowShot('Control from chat apps', '04c-hermes-chat.png')
for (const l of ['zh', 'ja', 'es', 'fr']) {
  await p.nav(B + `/${l}/vs-hermes-kanban`, 3500)
  log += `/${l}/vs-hermes-kanban: ${await p.ev(`(()=>{const r=[...document.querySelectorAll('main section div.border-b')].find(r=>/Cloud/.test(r.innerText)&&/Slack/.test(r.innerText));return r?r.innerText.replace(/\\n+/g,' | '):'(no row)'})()`)}\n`
}
log += `/vs-hermes-kanban.md: ${(await (await fetch(B + '/vs-hermes-kanban.md')).text()).split('\n').filter(l => /Slack/.test(l) && /Cloud/.test(l)).join('\n')}\n`
await p.close()
fs.writeFileSync(D + 'compare.log', log); console.log(log)
