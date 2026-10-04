import fs from 'node:fs'
import { open, byText } from './cdp.mjs'
const D = '/tmp/qa-site/contact/'
const p = await open(1280, 1600)
await p.send('Storage.clearDataForOrigin', { origin: 'http://localhost:3761', storageTypes: 'all' })
await p.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync('/tmp/qa-site/api-stand-in.js', 'utf8') })
await p.nav('http://localhost:3761/contact', 5000)
const form = `document.querySelector('main form')`
const shot = async (name) => { await p.ev('scrollTo(0,0)'); await p.sleep(400); const b = await p.ev(`(()=>{const h=document.querySelector('main h1');const panel=document.querySelector('main form')||[...document.querySelectorAll('main *')].find(e=>e.textContent.trim()==='Message received');let a=h;while(!a.contains(panel))a=a.parentElement;const r=a.getBoundingClientRect();return {y:h.getBoundingClientRect().y,b:r.bottom}})()`); await p.shot(D + name, { x: 70, y: b.y - 50, width: 1140, height: b.b - b.y + 70 }) }
// 1 empty send
await p.click(byText('main button', 'Send message')); await p.sleep(800)
await shot('01-empty.png')
const said = async () => p.ev(`[...document.querySelectorAll('main [role=alert], main [aria-live], main [id*=error], main .text-red-600, main [data-error]')].map(e=>e.innerText.trim()).filter(Boolean).join(' | ')`)
let log = `# 1. Send with nothing filled in\nthe form now reads:\n${await p.ev(`document.querySelector('main form').innerText`)}\nrequests to the API: ${await p.ev('window.__sent.length')}\n`
// 2 done-for-you
await p.click(byText('main label', 'Done-for-you agents')); await p.sleep(600)
await shot('02-done-for-you.png')
log += `\n# 2. Pick Done-for-you agents\nfields: ${await p.ev(`[...document.querySelectorAll('main form input:not([type=radio]),main form textarea')].map(e=>(e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||e.type).trim().replace(/\\n/g,' ')).join(' / ')`)}\n`
// 3 send
const fields = await p.ev(`[...document.querySelectorAll('main form input:not([type=radio]),main form textarea')].length`)
const fill = async (i, text) => { await p.ev(`[...document.querySelectorAll('main form input:not([type=radio]),main form textarea')][${i}].focus()`); await p.type(text) }
await fill(0, 'qa@example.com')
const vals = ['Every Monday I sort support emails into bugs and feature requests.', 'An agent that sorts our support inbox each morning.']
for (let i = 1; i < fields; i++) await fill(i, vals[(i - 1) % 2])
await p.click(byText('main button', 'Send message')); await p.sleep(2000)
await shot('03-sent.png')
log += `\n# 3. Fill in and send (the stand-in answers 200)\nrequest: ${JSON.stringify(await p.ev('window.__sent'), null, 2)}\npage says: ${await p.ev(`document.querySelector('main').innerText.split('Training')[0]`)}\n`
// 4 limited
await p.ev(`window.__replies['/v1/contact']={status:429,body:{error:{code:'contact_too_many_attempts',message:''}}}`)
await p.nav('http://localhost:3761/contact', 4000)
await p.ev(`window.__replies['/v1/contact']={status:429,body:{error:{code:'contact_too_many_attempts',message:''}}}`)
await fill(0, 'qa@example.com'); await fill(1, 'Where do I find the logs?')
await p.click(byText('main button', 'Send message')); await p.sleep(2000)
await shot('04-limited.png')
log += `\n# 4. Send again (the stand-in answers 429 contact_too_many_attempts)\nrequests: ${await p.ev('window.__sent.length')}\npage says: ${await p.ev(`document.querySelector('main').innerText.split('Training')[0]`)}\n`
fs.writeFileSync(D + 'contact.log', log)
console.log(log)
await p.close()
