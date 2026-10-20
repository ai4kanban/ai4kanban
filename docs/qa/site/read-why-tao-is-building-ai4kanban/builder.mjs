import fs from 'node:fs'
import { open } from './cdp.mjs'
const D = process.argv[2] + '/'
const B = 'http://' + (process.env.SITE || '127.0.0.1:4330')
const FIG = `document.querySelector('main figure')`
// The 7s loop runs from page load, so wait on its own clock: ~2.75s in, two drafts out, not yet approved.
const DRAFTS = `new Promise(r=>{const t=setInterval(()=>{const a=document.querySelector('.br-pack').getAnimations()[0];const c=a&&a.currentTime%7000;if(c>2650&&c<2850){clearInterval(t);r(Math.round(c))}},20)})`
const figShot = async (pg, file, w) => {
  await pg.ev(`${FIG}.scrollIntoView({block:'center'})`); await pg.sleep(1000)
  const at = await pg.ev(DRAFTS)
  const b = await pg.ev(`(()=>{const r=${FIG}.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,w:r.width,h:r.height}})()`)
  await pg.shot(D + file, { x: Math.max(0, b.x - 24), y: b.y - 24, width: Math.min(w, b.w + 48), height: b.h + 48 })
  return `frame at: ${at}ms of 7000\nfigures: ${await pg.ev(`document.querySelectorAll('main figure').length`)}\n` + Object.entries(await pg.ev(`(()=>{const f=${FIG};return {role:f.getAttribute('role'),label:f.getAttribute('aria-label'),names:[...f.querySelectorAll('.br-name,.br-chip,.br-idea')].map(e=>e.innerText.trim()).join(' | '),figcaption:!!f.querySelector('figcaption'),svg:f.querySelectorAll('svg').length,width:Math.round(f.getBoundingClientRect().width),running:f.hasAttribute('data-on')}})()`)).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n'
}
// Watch the handoff scene's idea bubble for `ms`: each idea in turn, how visible the bubble was when
// its words changed, and at rest whether it stays on one line inside the scene.
const IDEAS = (ms) => `new Promise(r=>{const f=document.querySelector('main figure'),b=f.querySelector('.br-idea'),seen=[];let last=null;const t=setInterval(()=>{const s=b.querySelector('span'),op=+getComputedStyle(b).opacity;if(s.innerText!==last){last=s.innerText;seen.push({text:last,opacityAtChange:op})}const c=seen.at(-1);if(op>0.99&&c.lines==null){const g=document.createRange();g.selectNodeContents(s);const a=s.getBoundingClientRect(),fr=f.getBoundingClientRect();c.lines=new Set([...g.getClientRects()].map(x=>Math.round(x.top))).size;c.width=Math.round(a.width);c.insideScene=a.left>=fr.left&&a.right<=fr.right}},40);setTimeout(()=>{clearInterval(t);r({sceneWidth:Math.round(f.getBoundingClientRect().width),pageScrollsSideways:document.documentElement.scrollWidth>innerWidth,ideas:seen})},${ms})})`
// Body paragraphs opening with a number: the number, its font weight, the first words.
const NUMBERED = String.raw`[...document.querySelectorAll('main article .space-y-6 > p')].filter(x => /^\d+\. /.test(x.innerText)).map(x => {
  const n = x.firstElementChild.innerText.trim()
  return n + ' (weight ' + getComputedStyle(x.firstElementChild).fontWeight + ') ' + x.innerText.slice(n.length, n.length + 40).trim() + '…'
})`
const p = await open(1280, 900)
let log = ''
await p.nav(B + '/blog/spec-to-code', 5000)
log += `# 1. Click the author line on a blog post\nbyline: ${await p.ev(`document.querySelector('main a[href="/builder"]').innerText.replace(/\\n/g,' ')`)}\n`
await p.click(`document.querySelector('main a[href="/builder"]')`); await p.sleep(4000)
log += `location: ${await p.ev('location.pathname')}\ntitle: ${await p.ev('document.title')}\ndescription: ${await p.ev(`document.querySelector('meta[name=description]').content`)}\nh1: ${await p.ev(`document.querySelector('h1').innerText`)}\nh1 child elements (underline): ${await p.ev(`document.querySelector('h1').children.length`)}\nwho: ${await p.ev(`document.querySelector('main img').alt+' — '+document.querySelector('main img').nextElementSibling.innerText.replace(/\\n+/g,' / ')`)}\nlists: ${await p.ev(`document.querySelectorAll('main ul,main ol').length`)}, faq-like headings: ${await p.ev(`document.querySelectorAll('main h2,main h3').length`)}\nbody paragraphs: ${await p.ev(`document.querySelectorAll('main article .space-y-6 > p').length`)}\nnumbered:\n  ${(await p.ev(NUMBERED)).join('\n  ')}\n`
await p.ev('scrollTo(0,0)'); await p.sleep(1000)
await p.shot(D + '01-builder-top.png', { x: 0, y: 0, width: 1280, height: 900 })
log += `\n# 2. Read on to the animation after thought 1\nafter paragraph: ${await p.ev(`${FIG}.parentElement.previousElementSibling.innerText.slice(0,40)`)}…\n` + await figShot(p, '02-bridge-scene.png', 1280)
log += `ideas over six loops: ${JSON.stringify(await p.ev(IDEAS(43000)))}\n`
await p.ev(`[...document.querySelectorAll('main p')].find(x=>x.innerText.trim()==='Tao').scrollIntoView({block:'center'})`); await p.sleep(2000)
const LINKS = String.raw`[...document.querySelectorAll('main article a')].map(a => (a.innerText.trim() || a.getAttribute('aria-label')) + ' -> ' + a.getAttribute('href') + (a.target === '_blank' ? ' (new tab)' : '')).join('\n  ')`
log += '\n# 3. The end of the letter\n'
log += `last paragraph: ${await p.ev(`[...document.querySelectorAll('main article .space-y-6 > p')].at(-1).innerText.slice(0,60)`)}…\n`
log += `links in the body: ${await p.ev(`document.querySelectorAll('main article .space-y-6 a').length`)}\n`
log += `signature: ${await p.ev(`[...document.querySelectorAll('main article > p')].at(-1).innerText`)}\n`
log += `links: ${await p.ev(LINKS)}\n`
await p.shot(D + '03-signature.png', { x: 0, y: await p.ev('scrollY'), width: 1280, height: 900 })
await p.close()
const m = await open(390, 844, true)
await m.nav(B + '/builder', 5000)
log += `\n# 4. Same page on a 390px phone\nscrollWidth: ${await m.ev('document.documentElement.scrollWidth')} (viewport 390)\n` + await figShot(m, '04-phone-scene.png', 390)
log += `ideas over six loops: ${JSON.stringify(await m.ev(IDEAS(43000)))}\n`
await m.close()
log += `\n# 5. What an AI reads\n`
const label = await (async () => { const pg = await open(1280, 900); await pg.nav(B + '/builder', 4000); const l = await pg.ev(`${FIG}.getAttribute('aria-label')`); await pg.close(); return l })()
for (const path of ['/llms.txt', '/builder.md']) {
  const r = await fetch(B + path); const t = await r.text()
  log += `GET ${path} -> ${r.status} ${r.headers.get('content-type')}\n`
  if (path === '/llms.txt') { log += t.split('\n').filter(l => /builder/i.test(l)).join('\n') + '\n'; continue }
  const italic = t.split('\n').find(l => /^\*[^*].*\*$/.test(l))
  log += t.split('\n').slice(0, 6).join('\n') + '\n...\n' + t.trim().split('\n').slice(-3).join('\n') + '\n'
  log += `numbered: ${t.match(/^\*\*\d+\.\*\*/gm)?.join(' ')}\nitalic line: ${italic}\nitalic == aria-label: ${italic?.slice(1, -1) === label}\nold bullets/FAQ present: ${/FAQ|^- /m.test(t)}\n`
}
fs.writeFileSync(D + 'builder.log', log); console.log(log)
