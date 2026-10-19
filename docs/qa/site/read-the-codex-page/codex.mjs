// Usage: SITE=http://127.0.0.1:4383 CDP_PORT=9383 node codex.mjs <proof dir>
import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4330'
const PATH = '/agents/kanban-for-codex'
const p = await open(1280, 900)
let log = ''
const h2 = (t) => `[...document.querySelectorAll('main h2')].find(h=>h.textContent.includes(${JSON.stringify(t)}))`
// a section: from its h2 to the next h2
const part = async (t) => p.ev(`(()=>{const h=${h2(t)};const hs=[...document.querySelectorAll('main h2')];const n=hs[hs.indexOf(h)+1];const r=document.createRange();r.setStartBefore(h);n?r.setEndBefore(n):r.setEndAfter(h.parentElement.lastChild);const b=h.getBoundingClientRect();const e=n?n.getBoundingClientRect().y:b.y+600;return {y:b.y+scrollY,h:e-b.y,text:r.toString().replace(/\\s*\\n\\s*/g,' | ')}})()`)
const shotPart = async (file, t, max = 1400) => { await p.ev(`(${h2(t)}).scrollIntoView({block:'center'})`); await p.sleep(800); const s = await part(t); await p.shot(D + file, { x: 0, y: s.y - 30, width: 1280, height: Math.min(max, s.h + 10) }); return s }
// a figure by its image key
const shotFig = async (file, key) => { await p.ev(`[...document.querySelectorAll('main img')].find(i=>(i.currentSrc||i.src).includes(${JSON.stringify(key)})).scrollIntoView({block:'center'})`); await p.sleep(1500); const r = await p.ev(`(()=>{const i=[...document.querySelectorAll('main img')].find(i=>(i.currentSrc||i.src).includes(${JSON.stringify(key)}));const f=i.closest('figure')||i;const b=f.getBoundingClientRect();return {y:b.y+scrollY,h:b.height,loaded:i.complete&&i.naturalWidth>0,src:(i.currentSrc||i.src).replace(/^https?:\\/\\/[^/]+/,''),alt:i.alt,caption:f.querySelector('figcaption')?.innerText??''}})()`); await p.shot(D + file, { x: 0, y: r.y - 20, width: 1280, height: r.h + 40 }); return r }

await p.nav(B + PATH, 5000)
log += `# 1. Open ${PATH}\ntitle: ${await p.ev('document.title')}\nmeta description: ${await p.ev(`document.querySelector('meta[name=description]').content`)}\nh1: ${await p.ev(`document.querySelector('h1').innerText`)}\nabove h1: ${await p.ev(`document.querySelector('h1').previousElementSibling?.innerText ?? ''`)}\nbelow h1: ${await p.ev(`document.querySelector('h1').nextElementSibling?.innerText ?? ''`)}\nh2s: ${await p.ev(`[...document.querySelectorAll('main h2')].map(h=>h.innerText).join(' | ')`)}\n`
// paragraphs fade in as they scroll into view: pass over the page once
for (let y = 0; y < await p.ev('document.body.scrollHeight'); y += 400) { await p.ev(`scrollTo(0,${y})`); await p.sleep(150) }
await p.ev('scrollTo(0,0)'); await p.sleep(800)
// stop above the board shot: it shows the maintainer's local project path
const top = await p.ev(`Math.floor([...document.querySelectorAll('main img')].find(i=>(i.currentSrc||i.src).includes('/shots/board-')).closest('figure,div').getBoundingClientRect().y)`)
await p.shot(D + '01-top.png', { x: 0, y: 0, width: 1280, height: Math.min(900, top - 10) })
log += `\nimages and videos in the body:\n${JSON.stringify(await p.ev(`[...document.querySelectorAll('main video, main img')].map(m=>({tag:m.tagName,src:(m.currentSrc||m.getAttribute('src')||'').replace(/^https?:\\/\\/[^/]+/,''),loaded:m.tagName==='IMG'?m.complete&&m.naturalWidth>0:undefined}))`), null, 1)}\n`

let s = await shotPart('02-idea-to-work.png', 'How does an idea become work')
log += `\n# 2. Read "How does an idea become work Codex can carry out?"\n${s.text}\n`

s = await part('What should I review before Codex starts')
log += `\n# 3. Read "What should I review before Codex starts?"\n${s.text}\n`
let f = await shotFig('03-review-draft.png', 'coding-draft-v')
log += `figure: ${JSON.stringify(f)}\n`

s = await shotPart('04-dev-and-marketing.png', 'development and marketing')
log += `\n# 4. Read "Can the same board handle development and marketing?"\n${s.text}\n`

s = await shotPart('04b-runtimes.png', 'alongside Claude Code')
const img = await p.ev(`(()=>{const i=[...document.querySelectorAll('main img')].find(i=>(i.currentSrc||i.src).includes('configuration-agents-codex'));return {src:i.currentSrc||i.src,loaded:i.complete&&i.naturalWidth>0,alt:i.alt}})()`)
const st = await fetch(img.src.replace(/^http:\/\/127\.0\.0\.1:\d+/, B)).then(r => r.status).catch(e => String(e))
log += `\n# 4b. Read "Can I use Codex alongside Claude Code?"\n${s.text}\nimage: ${JSON.stringify({ ...img, src: img.src.replace(/^https?:\/\/[^/]+/, '') })}  GET -> ${st}\n`

s = await part('How does parallel Codex work')
log += `\n# 5. Read "How does parallel Codex work reach my project?"\n${s.text}\n`
f = await shotFig('05-settings-shot.png', 'configuration-v')
log += `figure: ${JSON.stringify(f)}\n`

const faq = `(()=>{const sec=document.querySelector('main .mdx-faq');const d=[...sec.querySelectorAll('details')];const r=sec.getBoundingClientRect();return {heading:sec.querySelector('h2').innerText,questions:d.map(x=>x.querySelector('summary').innerText.replace(/[+–]$/,'').trim()),open:d.filter(x=>x.open).length,y:r.y+scrollY,h:r.height}})()`
await p.ev(`document.querySelector('main .mdx-faq').scrollIntoView({block:'start'})`); await p.ev('scrollBy(0,-80)'); await p.sleep(1200)
const third = `[...document.querySelectorAll('main .mdx-faq summary')].find(s=>s.innerText.includes('Codex skills'))`
await p.click(third); await p.sleep(800)
let fq = await p.ev(faq)
log += `\n# 6. The FAQ, then open "How do workflows fit with my Codex skills?"\n${JSON.stringify({ ...fq, y: undefined, h: undefined }, null, 1)}\nanswer: ${await p.ev(`(${third}).parentElement.lastElementChild.innerText`)}\n`
await p.shot(D + '06-faq-skills.png', { x: 0, y: fq.y - 30, width: 1280, height: Math.min(fq.h + 60, 1100) })

const links = await p.ev(`[...new Set([...document.querySelectorAll('main a[href^="/"]')].map(a=>a.getAttribute('href')))]`)
log += `\n# 7. Follow each on-site link in the page body\n`
for (const l of links) { const r = await fetch(B + l.split('#')[0], { redirect: 'manual' }); log += `${r.status} ${l}\n` }
await p.close()

const txt = await (await fetch(B + '/llms.txt')).text()
log += `\n# 8. Read /llms.txt\n${txt.split('\n').filter(l => l.includes('kanban-for-codex')).join('\n')}\n`
const md = await fetch(B + PATH + ".md", { redirect: "manual" })
log += `GET ${PATH}.md -> ${md.status}\n`
fs.writeFileSync(D + 'codex.log', log); console.log(log)
