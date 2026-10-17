// Usage: SITE=http://127.0.0.1:4381 CDP_PORT=9381 node claude-code.mjs <proof dir>
import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4330'
const PATH = '/agents/kanban-for-claude-code'
const p = await open(1280, 900)
let log = ''
const h2 = (t) => `[...document.querySelectorAll('main h2')].find(h=>h.textContent.includes(${JSON.stringify(t)}))`
// a section: from its h2 to the next h2
const part = async (t) => p.ev(`(()=>{const h=${h2(t)};const hs=[...document.querySelectorAll('main h2')];const n=hs[hs.indexOf(h)+1];const r=document.createRange();r.setStartBefore(h);n?r.setEndBefore(n):r.setEndAfter(h.parentElement.lastChild);const b=h.getBoundingClientRect();const e=n?n.getBoundingClientRect().y:b.y+600;return {y:b.y+scrollY,h:e-b.y,text:r.toString().replace(/\\s*\\n\\s*/g,' | ')}})()`)
const shotPart = async (file, t, extra = 0) => { await p.ev(`(${h2(t)}).scrollIntoView({block:'center'})`); await p.sleep(800); const s = await part(t); await p.shot(D + file, { x: 0, y: s.y - 30, width: 1280, height: Math.min(1400, s.h + 10 + extra) }); return s }

await p.nav(B + PATH, 5000)
log += `# 1. Open ${PATH}\ntitle: ${await p.ev('document.title')}\nmeta description: ${await p.ev(`document.querySelector('meta[name=description]').content`)}\nh1: ${await p.ev(`document.querySelector('h1').innerText`)}\nabove h1: ${await p.ev(`document.querySelector('h1').previousElementSibling?.innerText ?? ''`)}\nbelow h1: ${await p.ev(`document.querySelector('h1').nextElementSibling?.innerText ?? ''`)}\nh2s: ${await p.ev(`[...document.querySelectorAll('main h2')].map(h=>h.innerText).join(' | ')`)}\n`
// paragraphs fade in as they scroll into view: pass over the page once
for (let y = 0; y < await p.ev('document.body.scrollHeight'); y += 400) { await p.ev(`scrollTo(0,${y})`); await p.sleep(150) }
await p.ev('scrollTo(0,0)'); await p.sleep(800)
await p.shot(D + '01-top.png', { x: 0, y: 0, width: 1280, height: 900 })
const media = `[...document.querySelectorAll('main video, main img')].map(m=>({tag:m.tagName,src:(m.currentSrc||m.getAttribute('src')||'').replace(/^https?:\\/\\/[^/]+/,''),alt:m.getAttribute('aria-label')||m.alt||m.closest('[aria-label]')?.getAttribute('aria-label'),paused:m.paused,t:m.currentTime&&+m.currentTime.toFixed(1),under:(()=>{let e=m;while(e&&e.tagName!=='MAIN'){let x=e.previousElementSibling;while(x){if(x.tagName==='H2')return x.innerText;x=x.previousElementSibling}e=e.parentElement}return '(intro)'})()}))`
log += `\nimages and videos in the body:\n${JSON.stringify(await p.ev(media), null, 1)}\n`
await p.ev(`document.querySelector('main video').scrollIntoView({block:'center'})`); await p.sleep(4000)
const v1 = await p.ev(`(()=>{const v=document.querySelector('main video');const r=v.closest('figure').getBoundingClientRect();return {src:v.currentSrc.replace(/^https?:\\/\\/[^/]+/,''),muted:v.muted,loop:v.loop,controls:v.controls,paused:v.paused,t:+v.currentTime.toFixed(1),y:r.y+scrollY,h:r.height}})()`)
log += `\n# 2. The recording under the intro, 4s after it scrolls into view\n${JSON.stringify({ ...v1, y: undefined, h: undefined })}\n`
await p.shot(D + '01b-intro-clip.png', { x: 0, y: v1.y - 140, width: 1280, height: v1.h + 170 })

let s = await shotPart('02-drafts.png', 'What can I review before')
log += `\n# 3. Read "What can I review before Claude Code builds?"\n${s.text}\n`

s = await shotPart('03-task-lists.png', "Claude Code's task lists")
log += `\n# 4. Read "How is AI4Kanban different from Claude Code's task lists?"\n${s.text}\n`

s = await shotPart('04-codex.png', 'Can I use Codex for writing')
log += `\n# 5. Read "Can I use Codex for writing and Claude Code for coding?"\n${s.text}\n`

s = await shotPart('05-follow-up.png', 'Find follow-up work')
log += `\n# 6. Read "Find follow-up work after delivery" and "Catch regressions with scheduled QA"\n${s.text}\n`
s = await shotPart('05b-qa.png', 'Catch regressions')
log += `${s.text}\n`

// the FAQ at the end: closed, then the first question open
const faq = `(()=>{const sec=document.querySelector('main .mdx-faq');const d=[...sec.querySelectorAll('details')];const q=d[0].querySelector('summary span:nth-child(2)');const cs=getComputedStyle(q);const h=getComputedStyle([...document.querySelectorAll('main h2')].find(h=>!h.closest('.mdx-faq')));const body=getComputedStyle(document.querySelector('main h2 ~ p'));const r=sec.getBoundingClientRect();return {heading:sec.querySelector('h2').innerText,questions:d.map(x=>x.querySelector('summary').innerText.replace(/[+–]$/,'').trim()),open:d.filter(x=>x.open).length,questionFont:cs.fontSize+' / '+cs.fontWeight,sectionHeadingFont:h.fontSize+' / '+h.fontWeight,bodyFont:body.fontSize,rowHeight:Math.round(d[1].getBoundingClientRect().height),y:r.y+scrollY,h:r.height}})()`
await p.ev(`document.querySelector('main .mdx-faq').scrollIntoView({block:'start'})`); await p.ev('scrollBy(0,-80)'); await p.sleep(1200)
let fq = await p.ev(faq)
log += `\n# 7. The FAQ\n${JSON.stringify({ ...fq, y: undefined, h: undefined }, null, 1)}\n`
await p.shot(D + '08-faq.png', { x: 0, y: fq.y - 30, width: 1280, height: fq.h + 60 })
await p.click(`document.querySelector('main .mdx-faq summary')`); await p.sleep(800)
fq = await p.ev(faq)
log += `after clicking the first question: open=${fq.open}\nanswer: ${await p.ev(`document.querySelector('main .mdx-faq details[open]')?.lastElementChild.innerText`)}\n`
await p.shot(D + '08b-faq-open.png', { x: 0, y: fq.y - 30, width: 1280, height: Math.min(fq.h + 60, 700) })

// every link on the page that stays on the site
const links = await p.ev(`[...new Set([...document.querySelectorAll('main a[href^="/"]')].map(a=>a.getAttribute('href')))]`)
log += `\n# 8. Follow each on-site link in the page body\n`
for (const l of links) { const r = await fetch(B + l.split('#')[0], { redirect: 'manual' }); log += `${r.status} ${l}\n` }
await p.close()

const txt = await (await fetch(B + '/llms.txt')).text()
log += `\n# 9. Read /llms.txt\n${txt.split('\n').filter(l => l.includes('kanban-for-claude-code')).join('\n')}\n`
const md = await fetch(B + PATH + '.md', { redirect: 'manual' })
log += `GET ${PATH}.md -> ${md.status}\n`
fs.writeFileSync(D + 'claude-code.log', log); console.log(log)
