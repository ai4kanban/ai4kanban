import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = 'http://127.0.0.1:4330'
const p = await open(1280, 900)
let log = ''
await p.nav(B + '/', 5000)
const res = `[...document.querySelectorAll('header nav details summary')].find(s=>s.textContent.includes('Resources'))`
const b0 = await p.box(res); await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b0.x + b0.w / 2, y: b0.vy + b0.h / 2 }); await p.sleep(800)
log += `# 1. Hover "Resources" in the header on /\nopen: ${await p.ev(`(${res}).parentElement.open`)}\npanel: ${await p.ev(`(${res}).parentElement.querySelector('div').innerText.replace(/\\n+/g,' · ')`)}\n`
await p.shot(D + '01-resources.png', { x: 560, y: 0, width: 720, height: 300 })
await p.click(`[...document.querySelectorAll('header nav details a')].find(a=>a.getAttribute('href')==='/blog')`); await p.sleep(3500)
const GRID = `document.querySelectorAll('main section .grid > div').length`
const TITLES = `[...document.querySelectorAll('main section .grid > div')].map(d=>d.innerText.split('\\n').filter(Boolean).slice(0,2).join(' — ')).join('\\n  ')`
const cards = `[...document.querySelectorAll('main article, main li')].filter(e=>e.querySelector('a[href^="/blog/"]')&&e.getBoundingClientRect().height>0)`
log += `\n# 2. Click "Blog"\nlocation: ${await p.ev('location.pathname + location.search')}  h1: ${await p.ev(`document.querySelector('h1').innerText`)}\nfilters: ${await p.ev(`[...document.querySelectorAll('main a[href^="/blog?"], main a[href="/blog"], main button')].map(b=>b.textContent.trim()).filter(Boolean).join(' | ')`)}\nfeatured: ${await p.ev(`document.querySelectorAll('main section').length > 1 ? 'yes' : 'no'`)}  grid tiles: ${await p.ev(GRID)}\n`
await p.shot(D + '02-blog-index.png', { x: 0, y: 0, width: 1280, height: 900 })
await p.click(`[...document.querySelectorAll('main a, main button')].find(a=>a.textContent.trim()==='The board')`); await p.sleep(2500)
const topics = `[...new Set([...document.querySelectorAll('main a[href^="/blog/"]')].filter(a=>a.getBoundingClientRect().height>0).map(a=>a.closest('article,li')?.innerText.split('\\n').find(l=>/^[A-Z ]+$/.test(l.trim())&&l.trim().length>3)))].join(', ')`
log += `\n# 3. Click "The board"\nlocation: ${await p.ev('location.pathname + location.search')}\ntiles: ${await p.ev(GRID)}\n  ${await p.ev(TITLES)}\n`
await p.shot(D + '03-board-topic.png', { x: 0, y: 0, width: 1280, height: 900 })
await p.send('Page.navigateToHistoryEntry', { entryId: (await p.send('Page.getNavigationHistory')).entries.at(-2).id }); await p.sleep(2000)
log += `\n# 4. Press Back\nlocation: ${await p.ev('location.pathname + location.search')}\nfeatured: ${await p.ev(`document.querySelectorAll('main section').length > 1 ? 'yes' : 'no'`)}  grid tiles: ${await p.ev(GRID)}\n`
await p.close()
const m = await open(390, 844, true)
await m.nav(B + '/blog?topic=agents', 5000)
log += `\n# 5. Open /blog?topic=agents on a 390px phone\nscrollWidth: ${await m.ev('document.documentElement.scrollWidth')}  (viewport 390)\nselected: ${await m.ev(`[...document.querySelectorAll('main [aria-current], main [aria-pressed="true"], main [data-state="on"]')].map(e=>e.textContent.trim()).join(', ')`)}\ntiles: ${await m.ev(GRID)}\n`
await m.shot(D + '05-phone-agents.png', { x: 0, y: 0, width: 390, height: 844 })
await m.close()
fs.writeFileSync(D + 'blog.log', log); console.log(log)
