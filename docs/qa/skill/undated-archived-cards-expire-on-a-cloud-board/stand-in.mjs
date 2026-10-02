// A stand-in Cloud workspace for this case: a local HTTP server holding nine archived cards,
// and one pass of the board's own daily cleanup against it.
//
//   node stand-in.mjs <path to cli/dist/kanban.mjs>
//
// Only the workspace is fake. Opening the board, the cleanup and the delete call are the
// build's own. Everything lives in temp folders; no account and no real board is touched.

import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const DAY = 24 * 60 * 60_000
const WORKSPACE = 'ws-sample'
const ago = (days) => new Date(Date.now() - days * DAY)
const day = (date) => date.toISOString().slice(0, 10)

const card = (id, file, { archived, archivedAt }) => ({
  id,
  revision: `a${id}`,
  archived: true,
  archivedAt,
  data: {
    path: `.archive/${file}`,
    meta: {
      title: `Card ${id}`,
      priority: 'med',
      roi: 'med',
      status: 'done',
      release: '',
      blocked_by: [],
      related: [],
      modules: [],
      questions: [],
      schedule: null,
      ...(archived ? { archived } : {}),
    },
    body: 'Shipped.\n',
  },
})

// [card, what it is]
const SAMPLE = [
  [card(71, '71-undated-old.md', { archivedAt: ago(40).toISOString() }), 'no archived: day, archived on Cloud 40 days ago'],
  [card(72, '72-undated-young.md', { archivedAt: ago(10).toISOString() }), 'no archived: day, archived on Cloud 10 days ago'],
  [card(73, '73-undated-no-time.md', { archivedAt: null }), 'no archived: day, Cloud holds no archive time'],
  [card(74, '74-undated-bad-time.md', { archivedAt: 'no time' }), 'no archived: day, Cloud archive time unreadable'],
  [card(81, '81-young-group/root.md', { archived: day(ago(40)), archivedAt: ago(40).toISOString() }), 'group root, archived: 40 days ago'],
  [card(82, '81-young-group/features/82-part.md', { archivedAt: ago(10).toISOString() }), 'its part, no archived: day, Cloud 10 days ago'],
  [card(91, '91-old-group/root.md', { archived: day(ago(40)), archivedAt: ago(40).toISOString() }), 'group root, archived: 40 days ago'],
  [card(92, '91-old-group/features/92-part.md', { archivedAt: ago(35).toISOString() }), 'its part, no archived: day, Cloud 35 days ago'],
  [card(93, '93-dated-young.md', { archived: day(ago(10)), archivedAt: ago(40).toISOString() }), 'archived: 10 days ago, Cloud 40 days ago'],
]

let archive = SAMPLE.map(([c]) => c)
const deletes = []

const SNAPSHOT = {
  revision: '7',
  workspace: { id: WORKSPACE, name: 'Sample board', revision: '7', nextCardId: 100, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
  cards: [],
  documents: [
    { path: 'config.md', kind: 'config', revision: 'c1', body: '# Board\n' },
    { path: 'todo/README.md', kind: 'config', revision: 'c2', body: '# Open work\n' },
  ],
}

function answer(method, url, body) {
  const p = url.pathname + url.search
  if (p.endsWith('/snapshot')) return SNAPSHOT
  if (p.includes('/documents?kind=')) return { revision: '7', documents: [] }
  if (p.endsWith('/archive/delete')) {
    deletes.push(body.cards)
    archive = archive.filter((c) => !body.cards.includes(c.id))
    return { revision: '8', deleted: body.cards }
  }
  if (p.endsWith('/archive')) return { revision: '7', cards: archive }
  if (p.endsWith('/nodes') && method === 'POST') {
    return { node: { id: 'node-1', workspaceId: WORKSPACE, name: 'here', machineId: 'm', machineName: 'here', runtimes: [], leaseExpiresAt: null, live: true } }
  }
  if (p.endsWith('/locks') && method === 'POST') {
    return { lock: { leaseId: 'lease-0', cardId: body.cardId ?? null, revision: '7', grantedAt: '', expiresAt: '' } }
  }
  if (p.endsWith('/locks/release')) return { released: true }
  if (p.endsWith('/cards') && method === 'POST') {
    return { revision: '8', cards: (body.cards ?? []).map((c) => ({ id: c.id, revision: `${c.id}-next`, archived: c.archived === true, archivedAt: null, data: c.data })) }
  }
  if (p.endsWith('/documents') && method === 'POST') {
    return { revision: '8', documents: (body.documents ?? []).map((d) => ({ ...d, revision: `${d.path}-next` })) }
  }
  return {}
}

const server = http.createServer((req, res) => {
  let raw = ''
  req.on('data', (chunk) => (raw += chunk))
  req.on('end', () => {
    const out = answer(req.method, new URL(req.url, 'http://x'), raw ? JSON.parse(raw) : {})
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(out))
  })
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const api = `http://127.0.0.1:${server.address().port}`

// ---- a checkout pointed at that workspace, signed in as nobody real ----------------------

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-qa-home-'))
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-qa-board-'))
process.env.AI4KANBAN_HOME = home
process.env.AI4KANBAN_SUPABASE_URL = 'https://cloud.sample'
process.env.AI4KANBAN_SUPABASE_ANON_KEY = 'anon'
process.env.AI4KANBAN_CLOUD_URL = api
fs.writeFileSync(
  path.join(home, 'session.json'),
  JSON.stringify({ version: 1, supabaseUrl: 'https://cloud.sample', accessToken: 'sample', refreshToken: 'sample', expiresAt: Date.now() + 60 * 60_000, subject: '11111111-1111-4111-8111-111111111111' }),
)
fs.writeFileSync(path.join(root, '.ai4kanban.json'), JSON.stringify({ version: 1, workspace: WORKSPACE, name: 'Sample board' }))

const bundle = process.argv[2]
if (!bundle) throw new Error('usage: node stand-in.mjs <path to cli/dist/kanban.mjs>')
const bundleUrl = pathToFileURL(path.resolve(bundle)).href
// The bundle binds its paths to the working folder as it loads: never the caller's checkout.
process.chdir(root)
const akb = await import(bundleUrl)
akb.setBoardRoot(root)

const copy = () => {
  const dir = path.join(root, 'docs', 'kanban', '.archive')
  return fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.md')).sort() : []
}
const held = () => archive.map((c) => c.id).join(', ')

console.log(`today: ${day(new Date())}`)
console.log('\nthe workspace archive:')
for (const [c, what] of SAMPLE) console.log(`  #${c.id}  ${c.data.path.padEnd(46)} ${what}`)

const opened = await akb.openBoard(root)
console.log(`\nboard opened: ${opened.ok ? 'yes' : JSON.stringify(opened)}`)

await akb.nextWork()
console.log('\nafter the daily cleanup:')
console.log(`  delete calls sent to Cloud: ${deletes.length}${deletes.map((ids) => ` — cards ${[...ids].sort().join(', ')}`).join('')}`)
console.log(`  workspace archive holds:    ${held()}`)
console.log('  the local copy holds:')
for (const file of copy()) console.log(`    .archive/${file}`)

await akb.nextWork()
console.log('\nafter a second pass the same day:')
console.log(`  delete calls sent to Cloud: ${deletes.length}`)
console.log(`  workspace archive holds:    ${held()}`)

server.close()
fs.rmSync(home, { recursive: true, force: true })
fs.rmSync(root, { recursive: true, force: true })
process.exit(0)
