// /vs-orca: footer link, each section, the Pro tip on hover, then the zh page, .md mirror and llms.txt entry.
import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4330'
const p = await open(1280, 900)
let log = ''
const txt = (e) => `(${e}).innerText.replace(/\\n+/g,' | ')`
const h = (tag, s) => `[...document.querySelectorAll('main ${tag}')].find(h=>h.innerText.includes(${JSON.stringify(s)}))`
const shotSection = async (file, sel) => {
  await p.ev(`scrollTo(0,(${sel}).getBoundingClientRect().top+scrollY-100)`); await p.sleep(1500)
  const r = await p.ev(`(()=>{const r=(${sel}).getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`)
  await p.shot(D + file, { x: 0, y: r.y - 20, width: 1280, height: Math.min(r.h + 40, 800) })
}
await p.nav(B + '/', 5000)
const col = `[...document.querySelectorAll('footer *')].find(e=>e.children.length===0&&e.textContent.trim().toUpperCase()==='COMPARE')`
await p.click(`[...(${col}).parentElement.querySelectorAll('a')].find(a=>a.textContent.trim()==='Orca')`); await p.sleep(4000)
log += `# 6. Click "Orca" in the footer\nlocation: ${await p.ev('location.pathname')}  title: ${await p.ev('document.title')}\nh1: ${await p.ev(`document.querySelector('h1').innerText`)}\nlead: ${await p.ev(`document.querySelector('h1').parentElement.querySelector('p')?.innerText ?? ''`)}\n${await p.ev(txt(`${h('h2', 'What both support')}.parentElement.parentElement`))}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '06-orca-top.png', { x: 0, y: 0, width: 1280, height: 900 })
const orca = `${h('h2', 'Orca: a thin layer')}.closest('section')`
log += `\n# 7. Read section 01\n${await p.ev(txt(orca))}\nlinks: ${await p.ev(`[...${orca}.querySelectorAll('a')].map(a=>a.textContent.trim()+' -> '+a.href).join(' | ')`)}\n`
await shotSection('07-orca-codex.png', orca)
const ours = `${h('h2', 'AI4Kanban: you set')}.closest('section')`
const rows = `[...${ours}.querySelectorAll('svg[aria-label]')].reduce((a,s,i)=>{const row=s.closest('.grid').parentElement;if(i%2===0)a.push(row.firstElementChild.innerText+' — AI4Kanban: '+s.getAttribute('aria-label'));else a[a.length-1]+=', Orca: '+s.getAttribute('aria-label');return a},[]).join('\\n')`
log += `\n# 8. Read section 02's table, then hover the info icon\n${await p.ev(rows)}\n`
await shotSection('08-ours-table.png', `${ours}.querySelector('svg[aria-label]').closest('.grid').parentElement.parentElement`)
const tip = `document.querySelector('button[aria-describedby=pro-tip]')`
await p.ev(`${tip}.scrollIntoView({block:'center'})`); await p.sleep(1500)
log += `tip visible before hover: ${await p.ev(`getComputedStyle(document.getElementById('pro-tip')).visibility`)}\n`
const b = await p.ev(`(()=>{const b=${tip}.getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2}})()`)
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y }); await p.sleep(600)
log += `tip visible on hover: ${await p.ev(`getComputedStyle(document.getElementById('pro-tip')).visibility`)}  text: ${await p.ev(`document.getElementById('pro-tip').innerText`)}\n`
const vy = await p.ev('scrollY')
await p.shot(D + '08b-pro-tip.png', { x: 140, y: vy + b.y - 160, width: 1000, height: 220 })
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 })
const dec = `${h('h2', 'Which way')}.closest('section')`
log += `\n# 9. Read section 03\n${await p.ev(txt(dec))}\n`
await shotSection('09-which-way.png', dec)
await p.nav(B + '/zh/vs-orca', 4000)
log += `\n# 10. Open /zh/vs-orca\ntitle: ${await p.ev('document.title')}\nh1/h2/h3: ${await p.ev(`[...document.querySelectorAll('main h1,main h2,main h3')].map(h=>h.innerText.replace(/\\n/g,' ')).join(' | ')`)}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '10-orca-zh-top.png', { x: 0, y: 0, width: 1280, height: 900 })
await p.close()
const md = await (await fetch(B + '/vs-orca.md')).text()
const llms = await (await fetch(B + '/llms.txt')).text()
log += `\n# 10. GET /vs-orca.md (first 12 lines)\n${md.split('\n').slice(0, 12).join('\n')}\n\n# 10. llms.txt lines naming Orca\n${llms.split('\n').filter(l => /orca/i.test(l)).join('\n')}\n`
fs.writeFileSync(D + 'orca.log', log); console.log(log)
