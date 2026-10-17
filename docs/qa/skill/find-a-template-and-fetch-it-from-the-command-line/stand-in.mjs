// Fake Cloud: /v1/templates per cloud/endpoints.md. MODE=missing answers every route 404 not_found.
import http from 'node:http'
import crypto from 'node:crypto'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const files = {
  'hero-tilted-screen': { 'index.html': '<!doctype html><h1>Ship faster</h1>\n', 'template.md': '---\nname: hero-tilted-screen\n---\nA hero with a tilted product screen.\n' },
  'hero-gradient-glow': { 'index.html': '<h1>Glow</h1>\n', 'template.md': '---\nname: hero-gradient-glow\n---\n' },
  'pricing-three-tier': { 'index.html': '<h1>Pricing</h1>\n', 'template.md': '---\nname: pricing-three-tier\n---\n' },
}
const T = [
  { name: 'hero-tilted-screen', category: 'ui', title: 'Tilted screen hero', summary: 'Headline left, product screenshot tilted in 3D on the right.', description: 'Use for a SaaS landing page hero.\nSwap the screenshot for your own.', tags: ['hero', 'saas'], access: 'free', source: { site: 'https://example.com', references: ['https://example.com/'], captured: '2026-10-16T09:00:00+08:00', note: 'Full-page screenshot captured by the maintainer.' } },
  { name: 'hero-gradient-glow', category: 'ui', title: 'Gradient glow hero', summary: 'Centered headline over a soft gradient glow.', description: 'Use for a launch announcement.', tags: ['hero', 'launch'], access: 'pro', source: { original: true } },
  { name: 'pricing-three-tier', category: 'ui', title: 'Three-tier pricing', summary: 'Three plan cards with the middle one highlighted.', description: 'Use for a pricing section.', tags: ['pricing', 'saas'], access: 'free', source: { original: true } },
]
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
const meta = (t) => ({ name: t.name, category: t.category, title: t.title, summary: t.summary, description: t.description, tags: t.tags, access: t.access, previews: [{ path: 'preview.png', size: png.length }], publishedAt: '2026-10-16T01:00:00Z' })
const send = (res, code, body) => { res.writeHead(code, { 'content-type': Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json' }); res.end(Buffer.isBuffer(body) ? body : JSON.stringify(body)) }
const err = (res, code, c) => send(res, code, { error: { code: c, message: c } })
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x')
  console.log(req.method, u.pathname + u.search)
  if (!u.pathname.startsWith('/v1/templates')) return err(res, 404, 'not_found')
  if (process.env.MODE === 'missing') return err(res, 404, 'not_found')
  const rest = u.pathname.slice('/v1/templates'.length).split('/').filter(Boolean).map(decodeURIComponent)
  const cat = u.searchParams.get('category')
  if (rest[0] === 'tags') {
    const counts = {}
    for (const t of T.filter((t) => t.category === cat)) for (const g of t.tags) counts[g] = (counts[g] || 0) + 1
    return send(res, 200, { tags: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count })) })
  }
  if (rest.length === 0) {
    const tags = (u.searchParams.get('tags') || '').split(',')
    return send(res, 200, { templates: T.filter((t) => t.category === cat && t.tags.some((g) => tags.includes(g))).map(meta) })
  }
  const t = T.find((x) => x.name === rest[0])
  if (!t) return err(res, 404, 'not_found')
  if (rest[1] === 'previews') return rest[2] ? send(res, 200, png) : send(res, 200, { name: t.name, previews: meta(t).previews })
  if (rest[1] === 'source') return send(res, 200, { name: t.name, source: t.source, evidence: t.source.original ? [] : [{ path: 'capture.png', size: png.length }] })
  if (t.access === 'pro') return err(res, 403, 'pro_required')
  const f = files[t.name]
  if (rest[1] === 'files') return send(res, 200, Buffer.from(f[rest.slice(2).join('/')]))
  return send(res, 200, { template: { ...meta(t), source: t.source, files: Object.entries(f).map(([path, c]) => ({ path, size: Buffer.byteLength(c), sha256: sha(Buffer.from(c)) })), evidence: [] } })
}).listen(Number(process.env.PORT), '127.0.0.1', () => console.log('listening', process.env.PORT))
