// Carousel templates on the site: the catalog's skeleton and portrait covers, a live template's
// pages playing in view, a still one, the Chinese site, reduced motion, a page whose video fails,
// and a phone. Cloud's answers are held back where the skeleton is the point; EMPTY is the same site
// built while Cloud could not be read (catalog-stand-in.mjs), so its pages carry no snapshot.
// Usage: SITE=127.0.0.1:4914 EMPTY=127.0.0.1:4916 CDP_PORT=9414 OUT=<proof dir> node carousel.mjs
import fs from 'node:fs'
import { open } from './cdp.mjs'
const SITE = `http://${process.env.SITE || '127.0.0.1:4914'}`, EMPTY = `http://${process.env.EMPTY || '127.0.0.1:4916'}`, OUT = process.env.OUT || '.'
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(`${OUT}/carousel.log`, s + '\n') }
const short = (u) => u.replace(/^https?:\/\/[^/]+/, '').replace(/\/media\/[^/]+\//, '/media/…/')

// A page that can hold Cloud's catalog answers until `release()`, and fail chosen files.
async function page(w, h, { mobile = false, hold = false, fail = null, reduce = false } = {}) {
  const p = await open(w, h, mobile)
  p.media = []; p.on((d) => { if (d.method === 'Network.requestWillBeSent' && /\.(mp4|webm)$/.test(d.params.request.url)) p.media.push(short(d.params.request.url)) })
  const held = []; let holding = hold
  await p.send('Fetch.enable', { patterns: [{ urlPattern: '*/v1/catalog*' }] })
  p.on((d) => {
    if (d.method !== 'Fetch.requestPaused') return
    const { requestId, request } = d.params
    if (fail && fail.test(request.url)) return p.send('Fetch.failRequest', { requestId, errorReason: 'Failed' })
    if (holding && !/\/media\//.test(request.url)) return held.push(requestId)
    p.send('Fetch.continueRequest', { requestId })
  })
  // videos fetched through Fetch stall: once released, the page goes back to the plain network
  p.release = async () => { holding = false; for (const id of held.splice(0)) await p.send('Fetch.continueRequest', { requestId: id }); if (!fail) await p.send('Fetch.disable') }
  if (reduce) await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  return p
}
const tabs = `[...(document.querySelector('main nav')?.querySelectorAll('a,button')??[])].map(b=>b.innerText.replace(/\\s+/g,' ').trim()+(b.getAttribute('aria-current')?' (selected)':''))`
const tiles = `[...document.querySelectorAll('main a[href*="/templates/"] img')].map(i=>{const r=i.getBoundingClientRect();return {template:i.closest('a').getAttribute('href'),box:Math.round(r.width)+'x'+Math.round(r.height),image:i.naturalWidth+'x'+i.naturalHeight,fit:getComputedStyle(i).objectFit}})`
const strip = `(()=>{const s=document.querySelector('main .snap-x');if(!s)return null;const f=s.closest('figure');return {tag:f.querySelector('figcaption').innerText,pages:[...s.children].map((c,i)=>{const r=c.getBoundingClientRect(),v=c.querySelector('video'),inView=r.left<innerWidth&&r.right>0;return (i+1)+': '+Math.round(r.width)+'x'+Math.round(r.height)+(inView?' in view':' off')+(c.tagName==='BUTTON'?' · cover + play button':v?(v.getAttribute('src')?(v.paused?' · video paused':' · video playing'):' · video not loaded'):' · image')})}})()`
const bones = `(()=>{const b=[...document.querySelectorAll('main [aria-busy=true]')];return {busy:b.length,srText:b.map(x=>x.querySelector('.sr-only')?.innerText).filter(Boolean),blocks:document.querySelectorAll('main .animate-pulse, main [class*=animate-pulse]').length,shown:document.querySelector('main').innerText.replace(/\\s+/g,' ').slice(0,160)}})()`

log('# step 1: /templates#carousel with no snapshot, while Cloud has not answered')
let p = await page(1440, 900, { hold: true }); await p.nav(`${EMPTY}/templates#carousel`, 3000)
log('tabs:', await p.ev(tabs)); log('skeleton:', await p.ev(bones))
log('skeleton tiles:', await p.ev(`[...document.querySelectorAll('main section[aria-busy] > div > div')].filter(d=>d.getBoundingClientRect().width>0).map(d=>{const r=d.firstElementChild.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)})`))
await p.shot(`${OUT}/01-catalog-loading.png`)

log('# step 2: Cloud answers')
await p.release(); await p.sleep(3500)
log('tabs:', await p.ev(tabs)); log('url:', await p.ev('location.pathname+location.hash'))
log('tiles:', await p.ev(tiles)); await p.shot(`${OUT}/02-catalog-carousel.png`)
await p.ev(`document.querySelector('main a[href*="warm-explainer"]').scrollIntoView({block:'center'})`)
const hb = await p.ev(`(()=>{const r=document.querySelector('main a[href*="warm-explainer"] img').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hb.x, y: hb.y }); await p.sleep(2500)
log('hovering Warm animated explainer — videos requested:', p.media, 'video on the tile:', await p.ev(`!!document.querySelector('main a[href*="warm-explainer"] video')`))
await p.close()

log('# step 3: open Warm animated explainer, Cloud held back first: with no snapshot, then with one')
p = await page(1440, 900, { hold: true }); await p.nav(`${EMPTY}/templates/carousel/warm-explainer`, 3000)
log('no snapshot:', await p.ev(bones), 'back link:', await p.ev(`document.querySelector('main a[href*="#carousel"]')?.innerText`))
log('preview blocks:', await p.ev(`[...document.querySelectorAll('main [class*="aspect-[4/5]"]')].map(b=>{const r=b.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)})`))
await p.shot(`${OUT}/03-detail-loading-no-snapshot.png`); await p.release(); await p.sleep(4000)
log('then:', await p.ev(strip)); await p.close()
p = await page(1440, 900, { hold: true }); await p.nav(`${SITE}/templates/carousel/warm-explainer`, 3000)
log('before the fresh read:', await p.ev(bones)); log('strip yet:', await p.ev(strip))
await p.shot(`${OUT}/04-detail-loading.png`)
await p.release(); await p.sleep(5000)
log('after:', await p.ev(`({title:document.querySelector('main h1').innerText,back:document.querySelector('main a[href*="#carousel"]').innerText,tags:[...document.querySelectorAll('main h1 + div span')].map(s=>s.innerText)})`))
log('strip:', await p.ev(strip)); log('videos requested:', p.media)
await p.shot(`${OUT}/05-detail-playing.png`)
log('prompt:', await p.ev(`[...document.querySelectorAll('main aside *')].filter(e=>e.children.length===0&&/AI4Kanban/.test(e.textContent)).map(e=>e.textContent)`))
log('copy button:', await p.ev(`[...document.querySelectorAll('main aside button')].map(b=>b.innerText.trim())`))

log('# step 4: slide the strip to its end')
const before = p.media.length
await p.ev(`(()=>{const s=document.querySelector('main .snap-x');s.style.scrollBehavior='auto';s.scrollLeft=s.scrollWidth})()`); await p.sleep(5000)
log('strip:', await p.ev(strip)); log('videos requested since:', p.media.slice(before))
await p.shot(`${OUT}/06-detail-strip-end.png`); await p.close()

log('# step 5: Long read, a set of still pages')
p = await page(1440, 900); await p.nav(`${SITE}/templates/carousel/long-read`, 5000)
log('strip:', await p.ev(strip)); log('videos requested:', p.media)
await p.shot(`${OUT}/07-long-read.png`); await p.close()

log('# step 6: the Chinese site')
p = await page(1440, 900); await p.nav(`${SITE}/zh/templates#carousel`, 4500)
log('tabs:', await p.ev(tabs)); log('title:', await p.ev(`document.querySelector('main h1').innerText`))
await p.nav(`${SITE}/zh/templates/carousel/warm-explainer`, 5000)
log(await p.ev(`({back:document.querySelector('main a[href*="#carousel"]').innerText,tags:[...document.querySelectorAll('main h1 + div span')].map(s=>s.innerText),prompt:[...document.querySelectorAll('main aside *')].filter(e=>e.children.length===0&&/AI4Kanban/.test(e.textContent)).map(e=>e.textContent),copy:[...document.querySelectorAll('main aside button')].map(b=>b.innerText.trim())})`))
log('strip:', await p.ev(strip)); await p.shot(`${OUT}/08-zh-detail.png`); await p.close()

log('# step 7: reduced motion')
p = await page(1440, 900, { reduce: true }); await p.nav(`${SITE}/templates/carousel/warm-explainer`, 5000)
log('strip:', await p.ev(strip)); log('videos requested:', p.media)
log('play buttons:', await p.ev(`[...document.querySelectorAll('main .snap-x > button')].map(b=>b.getAttribute('aria-label'))`))
await p.shot(`${OUT}/09-reduced-covers.png`)
await p.click(`document.querySelector('main .snap-x > button')`); await p.sleep(3000)
log('after clicking the first play button:', await p.ev(strip), 'videos requested:', p.media)
await p.close()

log('# step 8: page 2 video fails to load')
p = await page(1440, 900, { fail: /page-4x5-02-en\.mp4$/ }); await p.nav(`${SITE}/templates/carousel/warm-explainer`, 6000)
log('strip:', await p.ev(strip))
const pg2 = await p.ev(`(()=>{const c=document.querySelector('main .snap-x').children[1];const r=c.getBoundingClientRect();return {x:Math.round(r.x)-8,y:Math.round(r.y+scrollY)-8,width:Math.round(r.width)+16,height:Math.round(r.height)+16,hasVideo:!!c.querySelector('video'),img:c.querySelector('img')?.naturalWidth+'x'+c.querySelector('img')?.naturalHeight}})()`)
log('page 2:', pg2); await p.shot(`${OUT}/10-page-2-failed.png`, pg2); await p.close()

log('# step 9: a 390px phone')
p = await page(390, 844, { mobile: true }); await p.nav(`${SITE}/templates/carousel/warm-explainer`, 5000)
await p.ev(`document.querySelector('main .snap-x').scrollIntoView({block:'center'})`); await p.sleep(2500)
log('strip:', await p.ev(strip)); log('overflowX:', await p.ev('document.documentElement.scrollWidth>innerWidth'))
await p.shot(`${OUT}/11-phone-detail.png`)
await p.nav(`${SITE}/templates#carousel`, 4500); log('phone tiles:', await p.ev(tiles)); await p.close()
