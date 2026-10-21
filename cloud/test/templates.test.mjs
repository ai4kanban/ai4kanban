// The shared template catalog (#1708): any sign-in searches and previews, Pro gates a Pro
// template's files, and only a publisher writes.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { jwksUrl, issuerFor, resetJwksCache } from '../src/auth.ts'
import worker from '../src/index.ts'

const SUPABASE_URL = 'https://project.supabase.co'
const FREE_USER = '11111111-1111-4111-8111-111111111111'
const PRO_USER = '22222222-2222-4222-8222-222222222222'
const PUBLISHER = '33333333-3333-4333-8333-333333333333'
const HANDLES = { [FREE_USER]: 'lin', [PRO_USER]: 'mei', [PUBLISHER]: 'neverchanje' }
const PRO = { id: 'sub_1', customer_id: 'c', period: 'yearly', status: 'active', current_period_end: null }
const SOURCE = {
  site: 'https://linear.app/',
  references: ['https://supahero.io/hero/linear'],
  captured: '2026-10-16T09:00:00+08:00',
  note: 'Supahero’s screenshot of linear.app, captured by the maintainer.',
}

const realFetch = globalThis.fetch
let keyPair
let rows
let bucket
let env

beforeEach(async () => {
  resetJwksCache()
  keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  rows = new Map()
  bucket = fakeBucket()
  env = { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'service-role', TEMPLATES: bucket }
  globalThis.fetch = async (url, init) => {
    const address = String(url)
    if (address === jwksUrl(SUPABASE_URL)) return json({ keys: [{ ...jwk, kid: 'k', alg: 'ES256' }] })
    const body = init?.body ? JSON.parse(init.body) : {}
    const fn = address.split('/rest/v1/rpc/')[1]
    if (fn === 'account_for_session') {
      return json({ admitted: false, handle: HANDLES[body.p_subject], name: null, avatar_url: null, account_id: null })
    }
    if (fn === 'subscriptions_for') return json(body.p_user_id === PRO_USER ? [PRO] : [])
    if (fn === 'seed_grant_for') return json(null)
    if (fn in db) return db[fn](body)
    throw new Error(`unexpected fetch of ${address}`)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
})

// What the migration's functions do, kept to what the routes rely on.
const db = {
  template_tags: ({ p_category }) => {
    const counts = {}
    for (const r of rows.values()) if (r.category === p_category) for (const t of r.tags) counts[t] = (counts[t] ?? 0) + 1
    return json(Object.entries(counts).map(([tag, count]) => ({ tag, count })))
  },
  search_templates: ({ p_category, p_tags, p_words, p_limit }) => {
    const hits = (r) => p_words.filter((w) => `${r.title} ${r.summary} ${r.description}`.toLowerCase().includes(w.toLowerCase())).length
    return json(
      [...rows.values()]
        .filter((r) => r.category === p_category && r.tags.some((t) => p_tags.includes(t)))
        .sort((a, b) => hits(b) - hits(a))
        .slice(0, p_limit),
    )
  },
  template: ({ p_name }) => json(rows.get(p_name) ?? null),
  template_catalog: () =>
    json([...rows.values()].map(({ files, evidence, source, description, ...r }) => ({ ...r, showcase: r.showcase ?? {} }))),
  set_template_showcase: ({ p_name, p_showcase }) => {
    const row = rows.get(p_name)
    if (!row) return json(null)
    const replaced = row.showcase ?? {}
    row.showcase = p_showcase
    return json({ replaced })
  },
  publish_template: (b) => {
    const old = rows.get(b.p_name)
    if (old && !b.p_replace) return json({ code: 'AKB19', message: `A template named ${b.p_name} already exists.` }, 400)
    rows.set(b.p_name, {
      name: b.p_name, category: b.p_category, tags: b.p_tags, title: b.p_title, summary: b.p_summary,
      description: b.p_description, source: b.p_source, access: b.p_access, files: b.p_files,
      previews: b.p_previews, evidence: b.p_evidence, revision: b.p_revision, published_at: '2026-10-16T00:00:00Z',
      showcase: old?.showcase ?? {},
    })
    return json({ revision: b.p_revision, replaced: old?.revision ?? null })
  },
  delete_template: ({ p_name }) => {
    const old = rows.get(p_name)
    rows.delete(p_name)
    return json(old ? { revision: old.revision } : null)
  },
}

describe('/v1/templates', () => {
  it('publishes the template, its previews and its evidence apart, and searches only metadata', async () => {
    const res = await publish(PUBLISHER, hero())
    assert.equal(res.status, 200, await res.clone().text())
    assert.deepEqual(await res.json(), { name: 'hero-tilted-screen', replaced: false, files: 2, previews: 1, evidence: 1 })

    const kinds = [...bucket.objects.keys()].map((k) => k.split('/')[0]).sort()
    assert.deepEqual(kinds, ['evidence', 'files', 'files', 'previews'])

    const found = await (await get(FREE_USER, '/v1/templates?category=ui&tags=hero&q=dark')).json()
    assert.equal(found.templates.length, 1)
    const [one] = found.templates
    assert.deepEqual(Object.keys(one).sort(), ['access', 'category', 'description', 'name', 'previews', 'publishedAt', 'summary', 'tags', 'title'])
    assert.deepEqual(one.previews, [{ path: 'cover.png', size: 3 }])

    const tags = await (await get(FREE_USER, '/v1/templates/tags?category=ui')).json()
    assert.deepEqual(tags, { tags: [{ tag: 'hero', count: 1 }, { tag: 'dark', count: 1 }] })
  })

  it('keeps previews and evidence out of the download list, and hashes each file', async () => {
    await publish(PUBLISHER, hero())
    const { template } = await (await get(FREE_USER, '/v1/templates/hero-tilted-screen')).json()
    assert.deepEqual(template.files.map((f) => f.path), ['src/hero.tsx', 'template.md'])
    assert.equal(template.files[1].sha256, createHash('sha256').update('# Hero').digest('hex'))

    const file = await get(FREE_USER, '/v1/templates/hero-tilted-screen/files/src/hero.tsx')
    assert.equal(await file.text(), 'export {}')
    assert.equal((await get(FREE_USER, '/v1/templates/hero-tilted-screen/files/cover.png')).status, 404)
    assert.equal(await (await get(FREE_USER, '/v1/templates/hero-tilted-screen/previews/cover.png')).text(), 'png')
    assert.equal((await (await get(FREE_USER, '/v1/templates/hero-tilted-screen/previews')).json()).previews[0].path, 'cover.png')

    const source = await (await get(FREE_USER, '/v1/templates/hero-tilted-screen/source')).json()
    assert.equal(source.source.captured, SOURCE.captured)
    assert.equal(await (await get(FREE_USER, '/v1/templates/hero-tilted-screen/evidence/linear.webp')).text(), 'shot')
  })

  it('gates a Pro template’s files on Pro, and nothing else', async () => {
    await publish(PUBLISHER, hero({ access: 'pro' }))
    const refused = await get(FREE_USER, '/v1/templates/hero-tilted-screen/files/template.md')
    assert.equal(refused.status, 403)
    assert.equal((await refused.json()).error.code, 'pro_required')
    assert.equal((await get(FREE_USER, '/v1/templates/hero-tilted-screen')).status, 403)
    assert.equal((await get(FREE_USER, '/v1/templates/hero-tilted-screen/previews/cover.png')).status, 200)
    assert.equal((await get(PRO_USER, '/v1/templates/hero-tilted-screen/files/template.md')).status, 200)
  })

  it('refuses a caller with no sign-in', async () => {
    const res = await worker.fetch(new Request('https://api.example/v1/templates/tags?category=ui'), env, ctx)
    assert.equal(res.status, 401)
  })

  it('lets only a publisher publish or delete', async () => {
    const res = await publish(FREE_USER, hero())
    assert.equal(res.status, 403)
    assert.equal(rows.size, 0)
    assert.equal(bucket.objects.size, 0)
    await publish(PUBLISHER, hero())
    assert.equal((await send(FREE_USER, '/v1/templates/hero-tilted-screen', { method: 'DELETE' })).status, 403)
    assert.equal((await send(PUBLISHER, '/v1/templates/hero-tilted-screen', { method: 'DELETE' })).status, 200)
    assert.equal(rows.size, 0)
    assert.equal(bucket.objects.size, 0)
  })

  it('refuses a taken name unless replacing, and a replacement drops the old files', async () => {
    await publish(PUBLISHER, hero())
    const taken = await publish(PUBLISHER, hero({ category: 'video' }))
    assert.equal(taken.status, 409)
    assert.equal((await taken.json()).error.code, 'template_exists')
    assert.equal(rows.get('hero-tilted-screen').category, 'ui')
    assert.equal(bucket.objects.size, 4)

    const replaced = await publish(PUBLISHER, hero({ replace: true, title: 'Hero, again' }))
    assert.equal((await replaced.json()).replaced, true)
    assert.equal(bucket.objects.size, 4)
    const revision = rows.get('hero-tilted-screen').revision
    assert.ok([...bucket.objects.keys()].every((k) => k.includes(revision)))
  })

  it('refuses a malformed template before writing anything', async () => {
    const refused = async (form, words) => {
      const res = await publish(PUBLISHER, form)
      assert.equal(res.status, 400)
      assert.match((await res.json()).error.message, words)
    }
    await refused(hero({ name: 'Linear Hero' }), /name/)
    await refused(hero({ tags: ['Hero'] }), /tag/)
    await refused(hero({ description: '' }), /description/)
    await refused(hero({ summary: 'two\nlines' }), /one line/)
    await refused(hero({ access: 'paid' }), /access/)
    await refused(hero({ source: { ...SOURCE, captured: '2026-10-16' } }), /time zone/)
    await refused(hero({ source: { ...SOURCE, note: '' } }), /note/)
    await refused(hero({}, { evidence: {} }), /evidence/)
    await refused(hero({}, { files: { 'hero.tsx': 'x' } }), /template\.md/)
    await refused(hero({}, { files: { 'template.md': '#', '../x': 'x' } }), /relative/)
    await refused(hero({}, { previews: { 'cover.mp4': 'x' } }), /image/)
    assert.equal(rows.size, 0)
    assert.equal(bucket.objects.size, 0)
  })

  it('takes an original with no evidence', async () => {
    const res = await publish(PUBLISHER, hero({ source: { original: true } }, { evidence: {} }))
    assert.equal(res.status, 200)
    assert.deepEqual(rows.get('hero-tilted-screen').source, { original: true })
  })

  it('bounds a search to ten and needs a tag', async () => {
    for (let i = 0; i < 12; i++) await publish(PUBLISHER, hero({ name: `hero-${i}` }))
    assert.equal((await (await get(FREE_USER, '/v1/templates?category=ui&tags=hero')).json()).templates.length, 5)
    assert.equal((await (await get(FREE_USER, '/v1/templates?category=ui&tags=hero&limit=50')).json()).templates.length, 10)
    assert.equal((await get(FREE_USER, '/v1/templates?category=ui')).status, 400)
    assert.equal((await (await get(FREE_USER, '/v1/templates?category=video&tags=hero')).json()).templates.length, 0)
  })

  it('says templates are unavailable when the build has no bucket', async () => {
    delete env.TEMPLATES
    const res = await get(FREE_USER, '/v1/templates/tags?category=ui')
    assert.equal(res.status, 503)
    assert.equal((await res.json()).error.code, 'templates_unavailable')
  })
})

describe('/v1/catalog', () => {
  it('lists every template by category to anyone, with nothing private in it', async () => {
    await publish(PUBLISHER, hero())
    for (let i = 0; i < 11; i++) await publish(PUBLISHER, hero({ name: `hero-${i}`, tags: ['other'] }))
    await publish(PUBLISHER, hero({ name: 'ui-walkthrough-launch', category: 'video', access: 'pro' }))
    const res = await anon('/v1/catalog')
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('access-control-allow-origin'), '*')
    const { categories } = await res.json()
    assert.deepEqual(categories.map((c) => [c.category, c.templates.length]), [['ui', 12], ['video', 1]])
    const [one] = categories[0].templates
    assert.deepEqual(Object.keys(one).sort(), ['access', 'category', 'clip', 'cover', 'duration', 'name', 'summary', 'tags', 'title'])
    assert.equal(one.clip, null)
    assert.match(one.cover, /\/v1\/catalog\/hero-tilted-screen\/media\/[^/]+\/cover\.png$/)
    assert.equal(await (await anon(new URL(one.cover).pathname)).text(), 'png')
  })

  it('answers a template’s public source and showcase, never its files or evidence', async () => {
    await publish(PUBLISHER, hero())
    assert.equal((await send(PUBLISHER, '/v1/templates/hero-tilted-screen/showcase', { method: 'PUT', body: showcase() })).status, 200)
    const { template } = await (await anon('/v1/catalog/hero-tilted-screen')).json()
    assert.deepEqual(template.source, { site: SOURCE.site, references: SOURCE.references, captured: SOURCE.captured })
    assert.equal(template.files, undefined)
    assert.equal(template.evidence, undefined)
    assert.equal(template.original.youtube, 'UAmKyyZ-b9E')
    assert.equal(template.original.video, null)
    assert.equal(template.recreation.duration, 69)
    assert.match(template.cover, /media\/[^/]+\/cover\.jpg$/)
    assert.equal(await (await anon(new URL(template.recreation.video).pathname)).text(), 'mp4')

    const revision = rows.get('hero-tilted-screen').revision
    for (const path of ['files/template.md', 'evidence/linear.webp']) {
      assert.equal((await anon(`/v1/catalog/hero-tilted-screen/${path}`)).status, 404)
    }
    assert.equal((await anon(`/v1/catalog/hero-tilted-screen/media/${revision}/linear.webp`)).status, 404)
    assert.equal((await anon('/v1/templates/hero-tilted-screen/files/template.md')).status, 401)
    assert.equal((await anon('/v1/catalog/nothing')).status, 404)
  })

  it('swaps a showcase whole, keeps it through a replacement, and drops it with the template', async () => {
    await publish(PUBLISHER, hero())
    await send(PUBLISHER, '/v1/templates/hero-tilted-screen/showcase', { method: 'PUT', body: showcase() })
    await send(PUBLISHER, '/v1/templates/hero-tilted-screen/showcase', { method: 'PUT', body: showcase() })
    const shown = () => [...bucket.objects.keys()].filter((k) => k.startsWith('showcase/'))
    assert.equal(shown().length, 3)
    await publish(PUBLISHER, hero({ replace: true }))
    assert.ok((await (await anon('/v1/catalog/hero-tilted-screen')).json()).template.recreation)
    await send(PUBLISHER, '/v1/templates/hero-tilted-screen', { method: 'DELETE' })
    assert.equal(shown().length, 0)
    assert.equal((await anon('/v1/catalog/hero-tilted-screen')).status, 404)
  })

  it('lets only a publisher register a showcase, and checks it before writing', async () => {
    await publish(PUBLISHER, hero())
    assert.equal((await send(FREE_USER, '/v1/templates/hero-tilted-screen/showcase', { method: 'PUT', body: showcase() })).status, 403)
    const refused = async (form, words) => {
      const res = await send(PUBLISHER, '/v1/templates/hero-tilted-screen/showcase', { method: 'PUT', body: form })
      assert.equal(res.status, 400)
      assert.match((await res.json()).error.message, words)
    }
    await refused(showcase({ cover: 'cover.mp4' }), /cover/)
    await refused(showcase({ original: { image: 'original.jpg', youtube: 'https://example.com/v' } }), /YouTube/)
    await refused(showcase({ original: { image: 'original.jpg', keyframe: true, youtube: 'https://youtu.be/UAmKyyZ-b9E' } }), /keyframe/)
    await refused(showcase({}, { 'extra.png': 'x' }), /never named/)
    await refused(showcase({ cover: 'missing.jpg' }), /not sent/)
    assert.equal([...bucket.objects.keys()].filter((k) => k.startsWith('showcase/')).length, 0)
    const missing = await send(PUBLISHER, '/v1/templates/nothing/showcase', { method: 'PUT', body: showcase() })
    assert.equal(missing.status, 404)
    assert.equal([...bucket.objects.keys()].filter((k) => k.startsWith('showcase/')).length, 0)
  })

  it('answers a carousel’s pages in order, and none without a showcase', async () => {
    await publish(PUBLISHER, hero({ name: 'long-read', category: 'carousel' }))
    assert.deepEqual((await (await anon('/v1/catalog/long-read')).json()).template.pages, [])
    const put = (form) => send(PUBLISHER, '/v1/templates/long-read/showcase', { method: 'PUT', body: form })
    const pages = { 'p2.png': 'two', 'p1.png': 'one' }
    const sides = { original: undefined, recreation: undefined }
    for (const bad of [[], 'p1.png', ['p1.mp4']]) {
      const res = await put(showcase({ ...sides, pages: bad }, pages))
      assert.equal(res.status, 400)
      assert.match((await res.json()).error.message, /pages/)
    }
    assert.equal((await put(showcase({ ...sides, cover: 'p1.png', pages: ['p2.png', 'p1.png'] }, pages))).status, 200)
    const { template } = await (await anon('/v1/catalog/long-read')).json()
    assert.deepEqual(await Promise.all(template.pages.map(async (u) => (await anon(new URL(u).pathname)).text())), ['two', 'one'])
    assert.match(template.cover, /\/p1\.png$/)
  })

  it('gives a motion’s tile its clip, and registers no motion showcase without one', async () => {
    await publish(PUBLISHER, hero({ name: 'card-widen', category: 'motion' }))
    const put = (form) => send(PUBLISHER, '/v1/templates/card-widen/showcase', { method: 'PUT', body: form })
    const still = await put(showcase({ original: undefined, recreation: { image: 'cover.jpg', keyframe: true } }))
    assert.equal(still.status, 400)
    assert.match((await still.json()).error.message, /recreation\.video/)
    assert.equal([...bucket.objects.keys()].filter((k) => k.startsWith('showcase/')).length, 0)

    assert.equal((await put(showcase({ original: undefined, recreation: { image: 'cover.jpg', video: 'clone.mp4', duration: 4 } }))).status, 200)
    const { categories } = await (await anon('/v1/catalog')).json()
    const [tile] = categories.find((c) => c.category === 'motion').templates
    assert.equal(tile.duration, 4)
    assert.equal(await (await anon(new URL(tile.clip).pathname)).text(), 'mp4')
  })
})

function showcase(meta = {}, extra = {}) {
  const form = new FormData()
  const m = {
    cover: 'cover.jpg',
    original: { image: 'original.jpg', youtube: 'https://www.youtube.com/watch?v=UAmKyyZ-b9E' },
    recreation: { image: 'cover.jpg', video: 'clone.mp4', duration: 69 },
    ...meta,
  }
  form.set('meta', JSON.stringify(m))
  const files = { 'cover.jpg': 'jpg', 'original.jpg': 'orig', 'clone.mp4': 'mp4', ...extra }
  const named = new Set([m.cover, ...(Array.isArray(m.pages) ? m.pages : []), m.original?.image, m.original?.video, m.recreation?.image, m.recreation?.video, ...Object.keys(extra)])
  for (const [path, text] of Object.entries(files)) if (named.has(path)) form.append(`media:${path}`, new Blob([text]), path)
  return form
}

const anon = (path) => worker.fetch(new Request(`https://api.example${path}`), env, ctx)

const ctx = { waitUntil() {} }

function hero(meta = {}, parts = {}) {
  const form = new FormData()
  form.set('meta', JSON.stringify({
    name: 'hero-tilted-screen', category: 'ui', tags: ['hero', 'dark'], title: 'Hero over a tilted screen',
    summary: 'A dark SaaS hero.', description: 'Layout from Linear’s hero; every word is a placeholder.',
    source: SOURCE, access: 'free', ...meta,
  }))
  const add = (kind, files) => {
    for (const [path, text] of Object.entries(files)) form.append(`${kind}:${path}`, new Blob([text]), path)
  }
  add('files', parts.files ?? { 'template.md': '# Hero', 'src/hero.tsx': 'export {}' })
  add('previews', parts.previews ?? { 'cover.png': 'png' })
  add('evidence', parts.evidence ?? { 'linear.webp': 'shot' })
  return form
}

const publish = (subject, form) => send(subject, '/v1/templates', { method: 'POST', body: form })
const get = (subject, path) => send(subject, path, {})

async function send(subject, path, init) {
  const request = new Request(`https://api.example${path}`, {
    ...init,
    headers: { authorization: `Bearer ${await token(subject)}` },
  })
  return worker.fetch(request, env, ctx)
}

function fakeBucket() {
  const objects = new Map()
  return {
    objects,
    async get(key) {
      const bytes = objects.get(key)
      if (!bytes) return null
      return { size: bytes.byteLength, body: new Blob([bytes]).stream(), arrayBuffer: async () => bytes }
    },
    async put(key, value) {
      objects.set(key, value)
    },
    async delete(keys) {
      for (const k of [keys].flat()) objects.delete(k)
    },
    async list({ prefix }) {
      return { objects: [...objects.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }
    },
  }
}

async function token(subject) {
  const now = Math.floor(Date.now() / 1000)
  const claims = { sub: subject, iss: issuerFor(SUPABASE_URL), aud: 'authenticated', exp: now + 3600 }
  const input = `${b64u(JSON.stringify({ alg: 'ES256', kid: 'k' }))}.${b64u(JSON.stringify(claims))}`
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, new TextEncoder().encode(input))
  return `${input}.${b64uBytes(new Uint8Array(signature))}`
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const b64u = (text) => b64uBytes(new TextEncoder().encode(text))

const b64uBytes = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
