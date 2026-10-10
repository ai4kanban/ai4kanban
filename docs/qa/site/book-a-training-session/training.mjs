import fs from 'node:fs'
import { open, byText } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = process.env.SITE || 'http://127.0.0.1:4330'
const AVAIL = process.argv[3]
const STEP = process.env.STEP || 'all'
const p = await open(1280, 1600)
await p.send('Storage.clearDataForOrigin', { origin: B, storageTypes: 'all' })
await p.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Shanghai' })
await p.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(new URL('./api-stand-in.js', import.meta.url), 'utf8') + `;window.__replies['/v1/training/availability']={status:200,body:${fs.readFileSync(AVAIL, 'utf8')}}` })
await p.nav(B + '/training', 6000)
const book = `(()=>{const h=[...document.querySelectorAll('main h2')].find(e=>/Start with a conversation/.test(e.textContent));let s=h;while(s.parentElement&&s.parentElement.tagName!=='MAIN')s=s.parentElement;return s})()`
const shot = async (name, sel = book) => { const b = await p.ev(`(()=>{const e=${sel};e.scrollIntoView({block:'start'});const r=e.getBoundingClientRect();return {y:r.y+scrollY,h:r.height}})()`); await p.sleep(500); await p.shot(D + name, { x: 0, y: b.y, width: 1280, height: Math.min(1500, b.h) }) }
let log = ''
await p.click(byText('main a, main button', 'Book a session')); await p.sleep(1500)
log += `# 1. Click "Book a session"\nscrolled to: ${await p.ev(`(()=>{const h=[...document.querySelectorAll('main h2')].find(e=>/Start with a conversation/.test(e.textContent));return 'h2 "'+h.textContent+'" at viewport y '+Math.round(h.getBoundingClientRect().y)})()`)}\nlocation: ${await p.ev('location.pathname+location.hash')}\nAPI calls: ${JSON.stringify(await p.ev('window.__sent'))}\nopen hours: ${await p.ev(`[...document.querySelectorAll('main button')].filter(b=>/available$/.test(b.getAttribute('aria-label')||'')).map(b=>b.getAttribute('aria-label')).join(' / ')`)}\n`
await shot('01-week.png')
await p.click(`document.querySelector('main button[aria-label="Monday 12 October at 10:00, available"]')`); await p.sleep(1000)
log += `\n# 2. Click Monday 12 October 10:00\n${await p.ev(`(${book}).innerText.split('Select an available time')[0].split('Not available\\nBooked\\nNot available').pop().split('\\n').filter(l=>l && !/^(Not available|Available|\\d\\d:00)$/.test(l.trim())).slice(-25).join('\\n')`)}\nfields: ${await p.ev(`[...(${book}).querySelectorAll('input,textarea,select')].map(e=>e.type+':'+(e.labels?.[0]?.innerText||e.name||e.getAttribute('aria-label'))).join(' / ')`)}\n`
await shot('02-form.png')
fs.writeFileSync(D + 'partial.log', log)
console.log(log)
if (STEP === 'peek') process.exit(0)
// 3. confirm (stand-in answers like the service: the booking and its manage link)
await p.ev(`window.__replies['/v1/training/bookings']=(url,init)=>{const b=JSON.parse(init.body);return {status:200,body:{booking:{reference:'TR-QA0001',slot_at:b.slotAt,service:b.service,price_cents:9900,name:b.name,email:b.email,timezone:b.timezone,project:b.project,state:'booked'},manage:{reference:'TR-QA0001',token:'stand-in-token',url:'https://ai4kanban.dev/training?booking=TR-QA0001&token=stand-in-token'}}}}`)
const fill = async (sel, text) => { await p.ev(`(${sel}).focus()`); await p.type(text) }
await fill(`[...(${book}).querySelectorAll('input')].find(e=>e.labels?.[0]?.innerText==='Name')`, 'QA Tester')
await fill(`(${book}).querySelector('input[type=email]')`, 'qa@example.com')
await fill(`(${book}).querySelector('textarea')`, 'A reading-notes app; the first release keeps slipping.')
await p.ev(`window.__sent.length=0`)
await p.click(byText('main button', 'Confirm booking')); await p.sleep(2000)
const sent = await p.ev('window.__sent')
log += `\n# 3. Fill in name, email, project and click "Confirm booking" (the stand-in answers 200)\nlocation: ${await p.ev('location.pathname+location.search+location.hash')}
API calls after clicking: ${JSON.stringify(sent, null, 2)}\npage says:\n${await p.ev(`(${book}).innerText`)}\n`
await shot('03-booked.png')
// 4. the hour was taken meanwhile
await p.nav('about:blank', 500); await p.nav(B + '/training', 6000); await p.click(byText('main a, main button', 'Book a session')); await p.sleep(1500)
await p.ev(`window.__replies['/v1/training/bookings']={status:409,body:{error:{code:'training_slot_taken',message:'That hour was just booked by someone else. Pick another one — what you typed is kept.'}}}`)
await p.click(`document.querySelector('main button[aria-label="Wednesday 14 October at 22:00, available"]')`); await p.sleep(1000)
await fill(`[...(${book}).querySelectorAll('input')].find(e=>e.labels?.[0]?.innerText==='Name')`, 'QA Tester')
await fill(`(${book}).querySelector('input[type=email]')`, 'qa@example.com')
await p.click(byText('main button', 'Confirm booking')); await p.sleep(2500)
log += `\n# 4. Open the page again, click "Book a session", pick Wednesday 14 October 22:00, confirm (the stand-in answers 409 training_slot_taken)\npage says:\n${await p.ev(`(${book}).innerText.split('Select an available time')[0].replace(/(\\n\\s*(Not available|Available|Booked)\\s*)+/g,'\\n').slice(0,1500)`)}\nform still holds: name=${await p.ev(`[...document.querySelectorAll('main input')].find(e=>e.labels?.[0]?.innerText==='Name')?.value ?? '(form gone)'`)} email=${await p.ev(`document.querySelector('main input[type=email]')?.value ?? '(form gone)'`)}\n`
await shot('04-taken.png')
fs.writeFileSync(D + 'booking.log', log)
fs.rmSync(D + 'partial.log')
console.log(log.split('# 3.')[1])
await p.close()

const m = await open(390, 844, true)
await m.send('Emulation.setTimezoneOverride', { timezoneId: 'Asia/Shanghai' })
await m.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(new URL('./api-stand-in.js', import.meta.url), 'utf8') + `;window.__replies['/v1/training/availability']={status:200,body:${fs.readFileSync(AVAIL, 'utf8')}}` })
await m.nav(B + '/training', 6000)
const wide = () => m.ev(`'page width '+document.documentElement.scrollWidth+' / viewport '+innerWidth`)
let ml = `\n# 5. Open /training on a 390px phone\ntop: ${await wide()}\n`
await m.shot(D + '05-phone-top.png', { x: 0, y: 0, width: 390, height: 844 })
await m.click(byText('main a, main button', 'Book a session')); await m.sleep(2000)
ml += `after "Book a session": ${await wide()}  scrollX: ${await m.ev('scrollX')}\n`
await m.ev('scrollBy(300,0)'); await m.sleep(300)
ml += `after trying to scroll right by 300px: scrollX ${await m.ev('scrollX')}\n`
await m.shot(D + '06-phone-week.png', { x: 0, y: await m.ev('scrollY'), width: 390, height: 844 })
await m.close()
fs.appendFileSync(D + 'booking.log', ml)
console.log(ml)
