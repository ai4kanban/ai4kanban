// Reads /privacy: the top and its contents, what is left about feedback, and the chat row.
// Usage: SITE=127.0.0.1:4371 CDP_PORT=9371 node privacy.mjs <proof dir>
import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/', SITE = 'http://' + (process.env.SITE || '127.0.0.1:4330')
let log = ''
const p = await open(1280, 1000)
await p.nav(SITE + '/privacy', 4000)
log += `# 1. The top\nh1: ${await p.ev(`document.querySelector('main h1').innerText`)}\neffective: ${await p.ev(`document.querySelector('main').innerText.match(/Effective[^\\n]*/i)?.[0]`)}\n`
log += `contents:\n  ${await p.ev(`[...document.querySelectorAll('nav a[href^="#"], aside a[href^="#"]')].map(a=>a.innerText.trim()).join('\\n  ')`)}\n`
await p.shot(D + '01-privacy-page.png', { x: 0, y: 0, width: 1280, height: 1000 })
log += `\n# 2. Feedback\nsections mentioning feedback: ${await p.ev(`[...document.querySelectorAll('main h2, main h3')].filter(h=>/feedback|partner/i.test(h.innerText)).map(h=>h.innerText).join(' | ') || '(none)'`)}\n`
log += `paragraphs mentioning feedback:\n  ${await p.ev(`[...document.querySelectorAll('main p, main li')].filter(e=>/feedback|partner/i.test(e.innerText)).map(e=>e.closest('section')?.querySelector('h2,h3')?.innerText+': '+e.innerText).join('\\n  ')`)}\n`
const kept = `[...document.querySelectorAll('main p, main li')].find(e=>/partner feedback/i.test(e.innerText))`
const where = async (e) => { await p.ev(`(()=>{const e=${e};scrollTo({top:e.getBoundingClientRect().top+scrollY-400,behavior:'instant'})})()`); await p.sleep(1200); return p.ev(`(()=>{const r=(${e}).getBoundingClientRect();return {y:r.y+scrollY,h:r.height,sy:scrollY}})()`) }
if (await p.ev(`!!${kept}`)) { const b = await where(kept); await p.sleep(800); log += `left of feedback, under: ${await p.ev(`(()=>{let e=${kept};while(e&&!/^H[23]$/.test(e.tagName)){e=e.previousElementSibling||e.parentElement} return e?.innerText})()`)}\n`; await p.shot(D + '02-what-is-left-of-feedback.png', { x: 0, y: b.y - 200, width: 1280, height: b.h + 280 }) }
log += `short version: ${await p.ev(`[...document.querySelectorAll('main *')].find(h=>h.children.length===0&&/^the short version$/i.test(h.innerText.trim()))?.parentElement.parentElement.innerText.replace(/\\n+/g,' / ').slice(0,1600)`)}\n`
const link = `[...document.querySelectorAll('a[href="#what-usage-reporting-sends"]')][0]`
await p.click(link); await p.sleep(1500)
log += `\n# 3. Contents -> What usage reporting sends\nhash: ${await p.ev('location.hash')}\n`
const row = `[...document.querySelectorAll('main tr')].find(r=>r.innerText.includes('A chat message was answered'))`
log += `chat row: ${await p.ev(`${row}?.innerText`)}\nrun row: ${await p.ev(`[...document.querySelectorAll('main tr')].find(r=>r.innerText.includes('A run started'))?.innerText`)}\n"A chat message was sent" on page: ${await p.ev(`document.body.innerText.includes('A chat message was sent')`)}\n`
const b = await where(row); await p.sleep(800)
await p.shot(D + '03-chat-message-row.png', { x: 0, y: b.y - 220, width: 1280, height: b.h + 280 })
await p.close()
fs.writeFileSync(D + 'privacy.log', log); console.log(log)
