// Usage: SITE=http://127.0.0.1:4387 CDP_PORT=9387 NODE_USE_ENV_PROXY=1 node grill-me.mjs <proof dir>
import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4387'
const PATH = '/agents/kanban-for-grill-me'
const p = await open(1280, 900)
let log = ''
const h2 = (t) => `[...document.querySelectorAll('main h2')].find(h=>h.textContent.includes(${JSON.stringify(t)}))`
const part = async (t) => p.ev(`(()=>{const h=${h2(t)};const hs=[...document.querySelectorAll('main h2')];const n=hs[hs.indexOf(h)+1];const r=document.createRange();r.setStartBefore(h);n?r.setEndBefore(n):r.setEndAfter(h.parentElement.lastChild);const b=h.getBoundingClientRect();const e=n?n.getBoundingClientRect().y:b.y+600;return {y:b.y+scrollY,h:e-b.y,text:r.toString().replace(/\\s*\\n\\s*/g,' | ')}})()`)
const shotPart = async (file, t) => { await p.ev(`(${h2(t)}).scrollIntoView({block:'center'})`); await p.sleep(800); const s = await part(t); await p.shot(D + file, { x: 0, y: s.y - 30, width: 1280, height: Math.min(1600, s.h + 10) }); return s }
// a screenshot figure by its CDN key: whether the image loaded, its caption, and a shot of it
const fig = async (file, key) => {
  await p.ev(`[...document.querySelectorAll('main img')].find(i=>(i.currentSrc||i.src).includes(${JSON.stringify(key)})).scrollIntoView({block:'center'})`); await p.sleep(2500)
  const f = await p.ev(`(()=>{const i=[...document.querySelectorAll('main img')].find(i=>(i.currentSrc||i.src).includes(${JSON.stringify(key)}));const fg=i.closest('figure')||i.parentElement;const r=fg.getBoundingClientRect();return {src:(i.currentSrc||i.src).replace(/^https?:\\/\\//,''),alt:i.alt,loaded:i.complete&&i.naturalWidth>0,natural:i.naturalWidth+'x'+i.naturalHeight,caption:fg.querySelector('figcaption')?.innerText,y:r.y+scrollY,h:r.height}})()`)
  await p.shot(D + file, { x: 0, y: f.y - 20, width: 1280, height: f.h + 40 })
  return JSON.stringify({ ...f, y: undefined, h: undefined }, null, 1)
}

await p.nav(B + PATH, 6000)
log += `# 1. Open ${PATH}\ntitle: ${await p.ev('document.title')}\nmeta description: ${await p.ev(`document.querySelector('meta[name=description]').content`)}\nh1: ${await p.ev(`document.querySelector('h1').innerText`)}\nabove h1: ${await p.ev(`document.querySelector('h1').previousElementSibling?.innerText ?? ''`)}\nbelow h1: ${await p.ev(`document.querySelector('h1').nextElementSibling?.innerText ?? ''`)}\nh2s: ${await p.ev(`[...document.querySelectorAll('main h2')].map(h=>h.innerText).join(' | ')`)}\n`
for (let y = 0; y < await p.ev('document.body.scrollHeight'); y += 400) { await p.ev(`scrollTo(0,${y})`); await p.sleep(150) }
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '01-top.png', { x: 0, y: 0, width: 1280, height: 900 })
const intro = await p.ev(`(()=>{const out=[];let e=document.querySelector('main h2');while(e&&(e=e.previousElementSibling)){if(e.tagName==='P')out.unshift(e.innerText)}return out.join('\\n\\n')})()`)
const media = `[...document.querySelectorAll('main video, main img')].map(m=>({tag:m.tagName,src:(m.currentSrc||m.getAttribute('src')||'').replace(/^https?:\\/\\//,''),alt:m.alt||m.getAttribute('aria-label')}))`
log += `\nintro paragraphs:\n${intro}\n\nimages and videos in the body:\n${JSON.stringify(await p.ev(media), null, 1)}\n`

log += `\n# 2. The first screenshot, under the intro\n${await fig('02-group.png', 'grill-group-v2')}\n`

let s = await shotPart('03-layers.png', 'What are grill-me')
log += `\n# 3. Read "What are grill-me and grill-with-docs?"\n${s.text}\n`

s = await shotPart('04-why-kanban.png', 'Why put Grill Me on a Kanban')
log += `\n# 4. Read "Why put Grill Me on a Kanban?"\n${s.text}\n`

log += `\n# 5. The screenshot under "Does every card investigate before asking questions?"\n${await fig('05-questions.png', 'grill-questions-v2')}\n`

s = await part('How do multiple agents work')
log += `\n# 6. Read "How do multiple agents work without repeating each other?"\n${s.text}\n`
await p.ev(`(${h2('How do multiple agents work')}).scrollIntoView({block:'start'})`); await p.ev('scrollBy(0,-30)'); await p.sleep(800)
await p.shot(D + '06-multi-agents.png', { x: 0, y: s.y - 30, width: 1280, height: 900 })

s = await part('What does the human actually read')
log += `\n# 7. Read "What does the human actually read?"\n${s.text}\n${await fig('07-draft.png', 'grill-draft-v3')}\n`

const faq = `(()=>{const sec=document.querySelector('main .mdx-faq');const d=[...sec.querySelectorAll('details')];const r=sec.getBoundingClientRect();return {questions:d.map(x=>x.querySelector('summary').innerText.replace(/[+–]$/,'').trim()),open:d.filter(x=>x.open).length,y:r.y+scrollY,h:r.height}})()`
await p.ev(`document.querySelector('main .mdx-faq').scrollIntoView({block:'start'})`); await p.ev('scrollBy(0,-80)'); await p.sleep(1200)
const q = `[...document.querySelectorAll('main .mdx-faq summary')].find(s=>s.innerText.includes('replace Grill Me'))`
await p.click(q); await p.sleep(800)
const fq = await p.ev(faq)
log += `\n# 8. The FAQ, "Does WildCrane replace Grill Me?" opened\n${JSON.stringify({ ...fq, y: undefined, h: undefined }, null, 1)}\nanswer: ${await p.ev(`(${q}).parentElement.lastElementChild.innerText`)}\n`
await p.shot(D + '08-faq-replace.png', { x: 0, y: fq.y - 30, width: 1280, height: Math.min(fq.h + 60, 900) })
const cta = await p.ev(`(()=>{const h=[...document.querySelectorAll('main h2, main h3, main p')].find(e=>e.innerText.includes('Scale Grill Me from one plan'));const b=h.closest('section')||h.parentElement;return {text:b.innerText.replace(/\\n+/g,' | '),links:[...b.querySelectorAll('a')].map(a=>a.innerText.trim()+' -> '+a.getAttribute('href'))}})()`)
log += `\nCTA at the end: ${JSON.stringify(cta)}\n`

const links = await p.ev(`[...new Set([...document.querySelectorAll('main a[href^="/"]')].map(a=>a.getAttribute('href')))]`)
log += `\n# 9. Follow each on-site link in the page body\n`
for (const l of links) { const r = await fetch(B + l.split('#')[0], { redirect: 'manual' }); log += `${r.status} ${l}\n` }
for (const k of ['grill-group-v2', 'grill-questions-v2', 'grill-draft-v3', 'board-v2', 'card-questions-v1', 'card-plan-v1']) log += `page references ${k}: ${await p.ev(`document.documentElement.outerHTML.includes(${JSON.stringify(k)})`)}\n`
await p.close()

const txt = await (await fetch(B + '/llms.txt')).text()
log += `\n# 10. Read /llms.txt\n${txt.split('\n').filter(l => l.includes('kanban-for-grill-me')).join('\n') || '(no entry)'}\n`
const md = await fetch(B + PATH + '.md', { redirect: 'manual' })
log += `GET ${PATH}.md -> ${md.status}\n`
fs.writeFileSync(D + 'grill-me.log', log); console.log(log)
