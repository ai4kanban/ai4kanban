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

let s = await shotPart('02-drafts.png', 'What can I review before')
log += `\n# 2. Read "What can I review before Claude Code builds?"\n${s.text}\n`

s = await shotPart('03-task-lists.png', "Claude Code's task lists")
log += `\n# 3. Read "How is AI4Kanban different from Claude Code's task lists?"\n${s.text}\n`

s = await shotPart('04-codex.png', 'Can I use Codex for writing')
log += `\n# 4. Read "Can I use Codex for writing and Claude Code for coding?"\n${s.text}\n`

s = await shotPart('05-follow-up.png', 'Find follow-up work')
log += `\n# 5. Read "Find follow-up work after delivery" and "Catch regressions with scheduled QA"\n${s.text}\n`
s = await shotPart('05b-qa.png', 'Catch regressions')
log += `${s.text}\n`

// every link on the page that stays on the site
const links = await p.ev(`[...new Set([...document.querySelectorAll('main a[href^="/"]')].map(a=>a.getAttribute('href')))]`)
log += `\n# 6. Follow each on-site link in the page body\n`
for (const l of links) { const r = await fetch(B + l.split('#')[0], { redirect: 'manual' }); log += `${r.status} ${l}\n` }
await p.close()

const txt = await (await fetch(B + '/llms.txt')).text()
log += `\n# 7. Read /llms.txt\n${txt.split('\n').filter(l => l.includes('kanban-for-claude-code')).join('\n')}\n`
const md = await fetch(B + PATH + '.md', { redirect: 'manual' })
log += `GET ${PATH}.md -> ${md.status}\n`
fs.writeFileSync(D + 'claude-code.log', log); console.log(log)
