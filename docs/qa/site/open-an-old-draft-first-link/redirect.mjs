// Old draft-first links: each language's /draft-first answers 301 to that language's home, a browser
// lands there, and the footer and llms.txt no longer point at draft-first.
// Usage: SITE=127.0.0.1:4914 CDP_PORT=9414 OUT=<proof dir> node redirect.mjs
import fs from 'node:fs'
import { open } from './cdp.mjs'
const SITE = `http://${process.env.SITE || '127.0.0.1:4914'}`, OUT = process.env.OUT || '.'
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(`${OUT}/redirect.log`, s + '\n') }

log('# step 1: what the server answers')
for (const path of ['/draft-first', '/zh/draft-first', '/es/draft-first', '/ja/draft-first', '/fr/draft-first', '/draft-first/']) {
  const r = await fetch(`${SITE}${path}`, { redirect: 'manual' })
  log(path, '->', r.status, (r.headers.get('location') || '').replace(SITE, ''))
}

log('# step 2: a browser follows /zh/draft-first')
const p = await open(1440, 900)
for (const path of ['/zh/draft-first', '/draft-first']) {
  await p.nav(`${SITE}${path}`, 3500)
  log(path, 'lands on', await p.ev(`location.pathname+' · '+document.title+' · '+document.querySelector('main h1').innerText.replace(/\\n/g,' / ')`))
  if (path === '/zh/draft-first') await p.shot(`${OUT}/01-zh-home.png`)
}

log('# step 3: footer and llms.txt')
log('footer links mentioning draft-first:', await p.ev(`[...document.querySelectorAll('footer a')].filter(a=>/draft/i.test(a.href+a.innerText)).map(a=>a.innerText)`))
log('footer columns:', await p.ev(`[...document.querySelectorAll('footer a')].map(a=>a.innerText.trim()).join(' · ')`))
const llms = await (await fetch(`${SITE}/llms.txt`)).text()
log('llms.txt lines mentioning draft-first:', llms.split('\n').filter((l) => /draft-first/i.test(l)), `(${llms.split('\n').length} lines)`)
await p.close()
