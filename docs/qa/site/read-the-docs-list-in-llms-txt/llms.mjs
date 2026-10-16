// What an AI reads in /llms.txt's Documentation list, checked against each page and the docs rail.
import fs from 'node:fs'
const D = process.argv[2] + '/'
const B = 'http://' + (process.env.SITE || '127.0.0.1:4331')
const get = async (p) => { const r = await fetch(B + p); return { status: r.status, type: r.headers.get('content-type'), text: await r.text() } }
const pick = (html, re) => (html.match(re)?.[1] || '').replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim()
let log = ''
const llms = await get('/llms.txt')
const docs = llms.text.split('## Documentation')[1].split('\n## ')[0]
log += `# 1. GET /llms.txt\nstatus: ${llms.status} ${llms.type}\n## Documentation${docs}\n`
const items = [...docs.matchAll(/^- \[(.+?)\]\(https:\/\/ai4kanban\.dev(\S+?)\): (.+)$/gm)].map(m => ({ name: m[1], path: m[2], desc: m[3] }))
const home = await get('/docs')
const railName = (path) => pick(home.text, new RegExp(`href="${path}"[^>]*>(?:<svg[\\s\\S]*?</svg>)?([^<]*)</a>`))
log += `# 2. Open each Documentation link\n`
for (const it of items) {
  const p = await get(it.path)
  const h1 = pick(p.text, /<h1[^>]*>([\s\S]*?)<\/h1>/)
  const meta = pick(p.text, /<meta name="description" content="([^"]*)"/)
  log += `\n${it.path} -> ${p.status}\n  llms name: ${it.name}\n  rail name: ${railName(it.path)}  ${railName(it.path) === it.name ? '(same)' : '(DIFFERENT)'}\n  page h1:   ${h1}  ${h1 === it.name ? '(same)' : '(DIFFERENT)'}\n  title tag: ${pick(p.text, /<title>([\s\S]*?)<\/title>/)}\n  llms desc: ${it.desc}\n  page desc: ${meta}  ${meta === it.desc ? '(same)' : '(DIFFERENT)'}\n  "Copy page" button: ${/Copy page/.test(p.text) ? 'yes' : 'no'}\n`
}
const rail = [...new Set([...home.text.matchAll(/href="(\/docs(?:\/[a-z-]+)?)"/g)].map(m => m[1]))]
const listed = new Set(items.map(i => i.path))
log += `\n# 3. Compare with the docs rail on /docs\nrail links: ${rail.join(', ')}\nin the rail but not in llms.txt: ${rail.filter(r => !listed.has(r)).join(', ') || 'none'}\n`
fs.writeFileSync(D + 'llms.log', log)
console.log(log)
