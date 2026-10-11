import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = 'http://' + (process.env.SITE || '127.0.0.1:4330')
const IMG = `document.querySelector('.blog-prose img')`
const style = (pg) => pg.ev(`(()=>{const i=${IMG};const s=getComputedStyle(i);return {border:s.borderTopWidth+' '+s.borderTopStyle,shadow:s.boxShadow,radius:s.borderRadius,width:Math.round(i.getBoundingClientRect().width),natural:i.naturalWidth,loaded:i.complete&&i.naturalWidth>0}})()`)
const p = await open(1280, 900)
let log = ''
await p.nav(B + '/blog', 5000)
await p.click(`[...document.querySelectorAll('main a[href="/blog/spec-to-code"]')].find(a=>a.getBoundingClientRect().height>0)`); await p.sleep(4000)
log += `# 1. Open the post from /blog\nlocation: ${await p.ev('location.pathname')}\nh1: ${await p.ev(`document.querySelector('h1').innerText`)}\nimages in the text: ${await p.ev(`document.querySelectorAll('.blog-prose img').length`)}\n`
await p.shot(D + '01-post-top.png', { x: 0, y: 0, width: 1280, height: 900 })
await p.ev(`${IMG}.scrollIntoView({block:'center'})`); await p.sleep(3000)
const b = await p.ev(`(()=>{const r=${IMG}.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height}})()`)
log += `\n# 2. Scroll to the first picture\nalt: ${await p.ev(`${IMG}.alt`)}\nstyle: ${JSON.stringify(await style(p))}\n`
await p.shot(D + '02-picture.png', { x: Math.max(0, b.x - 40), y: b.y - 120, width: b.w + 80, height: b.h + 200 })
await p.close()
const m = await open(390, 844, true)
await m.nav(B + '/blog/spec-to-code', 5000)
await m.ev(`${IMG}.scrollIntoView({block:'center'})`); await m.sleep(3000)
log += `\n# 3. Same picture on a 390px phone\nstyle: ${JSON.stringify(await style(m))}\nscrollWidth: ${await m.ev('document.documentElement.scrollWidth')} (viewport 390)\n`
await m.shot(D + '03-phone-picture.png', { x: 0, y: await m.ev('scrollY'), width: 390, height: 844 })
await m.close()
fs.writeFileSync(D + 'post.log', log); console.log(log)
