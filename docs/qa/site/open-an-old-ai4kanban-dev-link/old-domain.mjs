// Old ai4kanban.dev links: the live server answers 301 to the same path and query on wildcrane.ai,
// a browser lands on the WildCrane page, and an old unsubscribe link is not sent away.
// Usage: CDP_PORT=9472 NODE_USE_ENV_PROXY=1 OUT=<proof dir> node old-domain.mjs
import fs from 'node:fs'
import { open } from './cdp.mjs'
const OUT = process.env.OUT || '.'
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); fs.appendFileSync(`${OUT}/old-domain.log`, s + '\n') }

log('# step 1: what the old server answers')
for (const u of ['https://ai4kanban.dev/', 'https://ai4kanban.dev/zh/docs/agents?ref=qa', 'https://www.ai4kanban.dev/blog', 'https://ai4kanban.dev/llms.txt']) {
  const r = await fetch(u, { redirect: 'manual' })
  log(u, '->', r.status, r.headers.get('location'))
}

log('# step 2: a browser follows an old /zh link')
const p = await open(1440, 900)
await p.nav('https://ai4kanban.dev/zh', 6000)
log('lands on', await p.ev(`location.href+' · '+document.title`))
log('canonical', await p.ev(`document.querySelector('link[rel=canonical]')?.href`))
await p.shot(`${OUT}/01-zh-home.png`, { x: 0, y: 0, width: 1440, height: 420 })

log('# step 3: an old unsubscribe link')
const r = await fetch('https://ai4kanban.dev/unsubscribe', { redirect: 'manual' })
const f = await fetch('https://ai4kanban.dev/unsubscribe-failed', { redirect: 'manual' })
log('GET https://ai4kanban.dev/unsubscribe ->', r.status, r.headers.get('location') ?? '(no redirect)')
log('GET https://ai4kanban.dev/unsubscribe-failed ->', f.status, f.headers.get('location') ?? '(no redirect)', '·', (await f.text()).match(/<title>([^<]*)/)?.[1])
await p.close()
