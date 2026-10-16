// `akb cloud template` (#1708): bounded search, previews apart from the template, a hashed
// download that never overwrites, and a publish that keeps previews and evidence out of the
// template's own files. Every refusal is bilingual and offers carrying on without a template.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { readTemplateMeta } from '../src/commands/cloud-template.ts'
import { runAgent } from '../src/lib/agent-cli.ts'
import { writeSession } from '../src/lib/cloud/session.ts'
import { restoreMachineHome } from './helpers/board.ts'

const SUPABASE = 'https://project.supabase.co'
const API = 'https://api.example.test'
const TEMPLATE_MD = `---
name: hero-tilted-screen
category: ui
tags: [hero, saas]
title: Hero over a tilted product screen
summary: A dark SaaS hero.
description: |
  Layout and motion from Linear's hero.
  Every word is a placeholder.
access: free
source:
  site: https://linear.app/
  references:
    - https://supahero.io/hero/linear
  captured: 2026-10-16T09:00:00+08:00
  note: Supahero's screenshot of linear.app, captured by the maintainer.
---

# Hero
`

let home = ''
const realFetch = globalThis.fetch
let sent: { url: string; method: string; body: unknown }[] = []

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'akb-template-'))
  process.env.AI4KANBAN_HOME = home
  process.env.AI4KANBAN_SUPABASE_URL = SUPABASE
  process.env.AI4KANBAN_CLOUD_URL = API
  sent = []
})

afterEach(() => {
  globalThis.fetch = realFetch
  fs.rmSync(home, { recursive: true, force: true })
  restoreMachineHome()
  delete process.env.AI4KANBAN_SUPABASE_URL
  delete process.env.AI4KANBAN_CLOUD_URL
})

function signIn(): void {
  writeSession({
    version: 1,
    supabaseUrl: SUPABASE,
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() + 60 * 60 * 1000,
    subject: '11111111-1111-4111-8111-111111111111',
  })
}

/** Answer each request by its path under /v1/templates. */
function serve(routes: Record<string, () => Response>): void {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const route = String(url).slice(`${API}/v1/templates`.length)
    sent.push({ url: route, method: init?.method ?? 'GET', body: init?.body })
    const answer = routes[route.split('?')[0] ?? '']
    if (!answer) throw new Error(`unexpected ${route}`)
    return answer()
  }) as typeof fetch
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status })
const refusal = (status: number, code: string) => json({ error: { code, message: code } }, status)
const sha = (text: string) => createHash('sha256').update(text).digest('hex')

async function akb(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = []
  const err: string[] = []
  const [log, error] = [console.log, console.error]
  console.log = (line: unknown) => void out.push(String(line))
  console.error = (line: unknown) => void err.push(String(line))
  try {
    const code = await runAgent(argv, { program: 'akb', cwd: home })
    return { code, out: out.join('\n'), err: err.join('\n') }
  } finally {
    console.log = log
    console.error = error
  }
}

describe('akb cloud template', () => {
  it('refuses while signed out, in both languages, offering to carry on without one', async () => {
    serve({})
    const { code, err } = await akb(['cloud', 'template', 'list-tags', '--category', 'ui'])
    assert.equal(code, 1)
    assert.match(err, /未登录 AI4Kanban Cloud/)
    assert.match(err, /可以不用模板继续。\nYou can continue without a template\./)
    assert.equal(sent.length, 0)
  })

  it('searches within a tag and says plainly when nothing matches', async () => {
    signIn()
    serve({
      '': json({
        templates: [{
          name: 'hero-tilted-screen', title: 'Hero', summary: 'A dark hero.', description: 'Layout from Linear.',
          tags: ['hero'], access: 'free', previews: [{ path: 'cover.png', size: 3 }],
        }],
      }),
    })
    const found = await akb(['cloud', 'template', 'search', '--category', 'ui', '--tags', 'hero', 'dark', 'saas'])
    assert.equal(found.code, 0)
    assert.equal(sent[0]?.url, '?category=ui&tags=hero&q=dark+saas')
    assert.match(found.out, /^hero-tilted-screen — Hero \[free\]\n {2}A dark hero\.\n {2}tags: hero · previews: cover\.png/)

    serve({ '': json({ templates: [] }) })
    const none = await akb(['cloud', 'template', 'search', '--category', 'ui', '--tags', 'hero'])
    assert.match(none.out, /没有匹配的模板/)
    assert.match(none.out, /No template matches/)

    const missing = await akb(['cloud', 'template', 'search', '--category', 'ui'])
    assert.equal(missing.code, 2)
  })

  it('reads a 404 on tags as the catalog being unavailable, not as a missing template', async () => {
    signIn()
    serve({ '/tags': refusal(404, 'not_found') })
    const tags = await akb(['cloud', 'template', 'list-tags', '--category', 'ui'])
    assert.equal(tags.code, 1)
    assert.match(tags.err, /模板库暂时无法使用，请稍后重试。\nTemplates are not available right now\. Try again later\./)
    assert.match(tags.err, /可以不用模板继续。\nYou can continue without a template\./)
    assert.doesNotMatch(tags.err, /没有这个模板|no template with this name/)

    serve({ '/hero-tilted-screen': refusal(404, 'not_found') })
    const named = await akb(['cloud', 'template', 'get', 'hero-tilted-screen', '--to', path.join(home, 'x')])
    assert.equal(named.code, 1)
    assert.match(named.err, /模板库里没有这个模板。/)
  })

  it('fetches previews under the template’s name, apart from the template', async () => {
    signIn()
    serve({
      '/hero-tilted-screen/previews': json({ previews: [{ path: 'cover.png', size: 3 }] }),
      '/hero-tilted-screen/previews/cover.png': () => new Response('png'),
    })
    const to = path.join(home, 'assets')
    const { code } = await akb(['cloud', 'template', 'preview', 'hero-tilted-screen', '--to', to])
    assert.equal(code, 0)
    assert.deepEqual(fs.readdirSync(to), ['hero-tilted-screen-cover.png'])
  })

  it('writes a template only when every file matches its hash, and never over a file', async () => {
    signIn()
    const files = { 'template.md': '# Hero', 'src/hero.tsx': 'export {}' }
    const manifest = json({
      template: { files: Object.entries(files).map(([p, t]) => ({ path: p, size: t.length, sha256: sha(t) })) },
    })
    serve({
      '/hero-tilted-screen': manifest,
      '/hero-tilted-screen/files/template.md': () => new Response(files['template.md']),
      '/hero-tilted-screen/files/src/hero.tsx': () => new Response('tampered'),
    })
    const to = path.join(home, 'out')
    const bad = await akb(['cloud', 'template', 'get', 'hero-tilted-screen', '--to', to])
    assert.equal(bad.code, 1)
    assert.match(bad.err, /未写入任何文件/)
    assert.equal(fs.existsSync(to), false)

    serve({
      '/hero-tilted-screen': manifest,
      '/hero-tilted-screen/files/template.md': () => new Response(files['template.md']),
      '/hero-tilted-screen/files/src/hero.tsx': () => new Response(files['src/hero.tsx']),
    })
    const good = await akb(['cloud', 'template', 'get', 'hero-tilted-screen', '--to', to])
    assert.equal(good.code, 0)
    assert.equal(fs.readFileSync(path.join(to, 'src', 'hero.tsx'), 'utf8'), 'export {}')

    fs.writeFileSync(path.join(to, 'template.md'), 'mine')
    fs.rmSync(path.join(to, 'src'), { recursive: true })
    const taken = await akb(['cloud', 'template', 'get', 'hero-tilted-screen', '--to', to])
    assert.equal(taken.code, 1)
    assert.match(taken.err, /目标文件夹已有同名文件：template\.md/)
    assert.equal(fs.readFileSync(path.join(to, 'template.md'), 'utf8'), 'mine')
    assert.equal(fs.existsSync(path.join(to, 'src')), false)
  })

  it('names Pro when a Pro template is refused', async () => {
    signIn()
    serve({ '/pro-hero': refusal(403, 'pro_required') })
    const { code, err } = await akb(['cloud', 'template', 'get', 'pro-hero', '--to', path.join(home, 'x')])
    assert.equal(code, 1)
    assert.match(err, /这个模板需要 Pro/)
    assert.match(err, /You can continue without a template/)
  })

  it('publishes the folder’s files apart from previews and evidence, leaving dotfiles home', async () => {
    signIn()
    const dir = path.join(home, 'hero')
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'template.md'), TEMPLATE_MD)
    fs.writeFileSync(path.join(dir, 'src', 'hero.tsx'), 'export {}')
    fs.writeFileSync(path.join(dir, '.DS_Store'), '')
    fs.writeFileSync(path.join(home, 'cover.png'), 'png')
    fs.writeFileSync(path.join(home, 'linear.webp'), 'shot')
    serve({ '': json({ name: 'hero-tilted-screen', replaced: false }) })
    const { code, out } = await akb([
      'cloud', 'template', 'publish', dir,
      '--preview', path.join(home, 'cover.png'), '--evidence', path.join(home, 'linear.webp'),
    ])
    assert.equal(code, 0, out)
    assert.match(out, /已发布 hero-tilted-screen：2 个文件。\nPublished hero-tilted-screen: 2 files\./)
    const form = sent[0]?.body as FormData
    const fields: string[] = []
    form.forEach((_, k) => void fields.push(k))
    assert.deepEqual(fields, ['meta', 'files:src/hero.tsx', 'files:template.md', 'previews:cover.png', 'evidence:linear.webp'])
    const meta = JSON.parse(String(form.get('meta')))
    assert.equal(meta.replace, false)
    assert.deepEqual(meta.tags, ['hero', 'saas'])
    assert.equal(meta.description, "Layout and motion from Linear's hero.\nEvery word is a placeholder.")
  })

  it('refuses a preview kept inside the template, and a clone with no evidence, before sending', async () => {
    signIn()
    serve({})
    const dir = path.join(home, 'hero')
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'template.md'), TEMPLATE_MD)
    fs.writeFileSync(path.join(dir, 'cover.png'), 'png')
    const inside = await akb(['cloud', 'template', 'publish', dir, '--preview', path.join(dir, 'cover.png'), '--evidence', path.join(dir, 'cover.png')])
    assert.equal(inside.code, 1)
    assert.match(inside.err, /预览图与来源凭证需放在模板文件夹之外/)
    const bare = await akb(['cloud', 'template', 'publish', dir])
    assert.match(bare.err, /--evidence/)
    assert.equal(sent.length, 0)
  })

  it('says a taken name left the files alone, and how to replace it', async () => {
    signIn()
    const dir = path.join(home, 'hero')
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'template.md'), TEMPLATE_MD.replace(/source:[\s\S]*?---/, 'source:\n  original: true\n---'))
    serve({ '': refusal(409, 'template_exists') })
    const { code, err } = await akb(['cloud', 'template', 'publish', dir])
    assert.equal(code, 1)
    assert.match(err, /本地文件未改动/)
    assert.match(err, /--replace/)
  })
})

describe('template.md frontmatter', () => {
  const fails = (text: string, words: RegExp) => assert.throws(() => readTemplateMeta(text), words)

  it('reads the fields the catalog keeps', () => {
    const meta = readTemplateMeta(TEMPLATE_MD)
    assert.equal(meta.name, 'hero-tilted-screen')
    assert.deepEqual(meta.source.references, ['https://supahero.io/hero/linear'])
    assert.equal(meta.source.captured, '2026-10-16T09:00:00+08:00')
  })

  it('refuses a brand name, a bad tag, a missing description and a capture date with no time', () => {
    fails(TEMPLATE_MD.replace('name: hero-tilted-screen', 'name: Linear Hero'), /name/)
    fails(TEMPLATE_MD.replace('[hero, saas]', '[Hero]'), /Hero/)
    fails(TEMPLATE_MD.replace(/description: \|\n.*\n.*\n/, ''), /description/)
    fails(TEMPLATE_MD.replace('2026-10-16T09:00:00+08:00', '2026-10-16'), /time zone/)
    fails(TEMPLATE_MD.replace('access: free', 'access: paid'), /access/)
  })
})
