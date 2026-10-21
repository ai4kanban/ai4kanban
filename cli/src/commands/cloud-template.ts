// `akb cloud template` — the shared template catalog (#1708).
//
// Agents list a category's tags, search within one for bounded metadata, preview, and fetch
// the whole template. Maintainers publish. Every
// message is bilingual because an agent relays it as it is; a reader's failure always offers
// carrying on without a template.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { cloudEndpoints } from '../lib/cloud/config'
import { accessToken } from '../lib/cloud/session'
import { say } from '../lib/io'
import { die } from '../lib/paths'
import type { MoveResult } from '../lib/types'
import { SAID } from './cloud'
import type { Said } from './cloud'

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CAPTURED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/
const MAX_BYTES = 50 * 1024 * 1024

const WITHOUT: Said = { zh: '可以不用模板继续。', en: 'You can continue without a template.' }

const T = {
  pro_required: {
    zh: '这个模板需要 Pro。升级 Pro：https://ai4kanban.dev/pricing',
    en: 'This template needs Pro. Upgrade at https://ai4kanban.dev/pricing',
  },
  not_found: { zh: '模板库里没有这个模板。', en: 'There is no template with this name.' },
  failed: { zh: '模板库暂时无法使用，请稍后重试。', en: 'Templates are not available right now. Try again later.' },
  publisher_only: { zh: '只有模板库维护者可以发布或删除模板。', en: 'Only the catalog’s maintainers can publish or delete templates.' },
  exists: {
    zh: '模板库已有同名模板，本地文件未改动。确认替换时加 --replace 重新发布。',
    en: 'A template with this name already exists; your files are unchanged. Publish again with --replace to replace it.',
  },
  corrupt: {
    zh: '下载的文件与模板库记录不一致，未写入任何文件，请重试。',
    en: 'A downloaded file did not match the catalog, so nothing was written. Try again.',
  },
} satisfies Record<string, Said>

interface Entry {
  path: string
  size: number
  sha256?: string
}

interface TemplateMeta {
  name: string
  title: string
  summary: string
  description: string
  tags: string[]
  access: 'free' | 'pro'
  previews: Entry[]
}

function usage(problem: string, line: string): never {
  die(`${problem}\nusage: ${line}`, { kind: 'bad-args', bare: true, exitCode: 2 })
}

function refuse(m: Said, also?: Said): never {
  die([m.zh, m.en, ...(also ? [also.zh, also.en] : [])].join('\n'), { kind: 'cloud-refused', bare: true })
}

function invalid(zh: string, en: string): never {
  refuse({ zh: `模板未通过校验：${zh}`, en: `The template is not valid: ${en}` })
}

/** One call to the catalog. A refusal is turned into the bilingual words for it. A 404 on a
 *  route with no template name (tags, search) means the catalog itself is missing. */
async function ask(route: string, init: RequestInit = {}, fallback?: Said): Promise<Response> {
  const token = await accessToken()
  if (!token.ok) refuse(SAID[token.reason], fallback)
  let res: Response
  try {
    res = await fetch(`${cloudEndpoints().api}/v1/templates${route}`, {
      ...init,
      headers: { authorization: `Bearer ${token.token}` },
    })
  } catch {
    refuse(SAID.unreachable, fallback)
  }
  if (res.ok) return res
  const { error } = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
  if (res.status === 401) refuse(SAID.expired, fallback)
  if (error?.code === 'pro_required') refuse(T.pro_required, fallback)
  const named = route.startsWith('/') && !route.startsWith('/tags?')
  if (error?.code === 'not_found' && named) refuse(T.not_found, fallback)
  if (error?.code === 'owner_only') refuse(T.publisher_only)
  if (error?.code === 'template_exists') refuse(T.exists)
  if (res.status === 400) invalid(error?.message ?? '', error?.message ?? '')
  refuse(T.failed, fallback)
}

const asJson = async <T>(res: Response): Promise<T> => (await res.json()) as T

function category(value: string | undefined, line: string): string {
  if (!value) usage('Missing --category.', line)
  if (!SLUG.test(value)) usage(`--category ${value}: use a lowercase word, like ui or video.`, line)
  return value
}

// ---- reading -----------------------------------------------------------------------

/** `akb cloud template list-tags --category <category>` */
export async function templateTags(opts: { category?: string }, program: string): Promise<MoveResult> {
  const cat = category(opts.category, `${program} cloud template list-tags --category <category>`)
  const { tags } = await asJson<{ tags: { tag: string; count: number }[] }>(
    await ask(`/tags?category=${cat}`, {}, WITHOUT),
  )
  if (tags.length === 0) say(`这个类别还没有模板。${WITHOUT.zh}\nNo templates in this category yet. ${WITHOUT.en}`)
  for (const { tag, count } of tags) say(`${tag} (${count})`)
  return { category: cat, tags }
}

/** `akb cloud template search --category <category> --tags <tags> [--limit N] [words…]` */
export async function templateSearch(
  opts: { category?: string; tags?: string; limit?: string; words: string[] },
  program: string,
): Promise<MoveResult> {
  const line = `${program} cloud template search --category <category> --tags <tag[,tag]> [--limit N] [topic words…]`
  const cat = category(opts.category, line)
  const tags = (opts.tags ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  if (tags.length === 0) usage('Missing --tags.', line)
  const query = new URLSearchParams({ category: cat, tags: tags.join(',') })
  if (opts.words.length > 0) query.set('q', opts.words.join(' '))
  if (opts.limit) query.set('limit', opts.limit)
  const { templates } = await asJson<{ templates: TemplateMeta[] }>(await ask(`?${query}`, {}, WITHOUT))
  if (templates.length === 0) say(`没有匹配的模板。${WITHOUT.zh}\nNo template matches. ${WITHOUT.en}`)
  for (const t of templates) {
    say(`${t.name} — ${t.title} [${t.access}]`)
    say(`  ${t.summary}`)
    say(`  tags: ${t.tags.join(', ') || '-'} · previews: ${t.previews.map((p) => p.path).join(', ') || '-'}`)
    for (const l of t.description.split('\n')) say(`  ${l}`)
  }
  return { templates }
}

/** `akb cloud template preview <name> --to <dir>` — its catalog previews, as `<name>-<file>`
 * unless the file already starts with `<name>-`. */
export async function templatePreview(name: string, opts: { to?: string }, program: string): Promise<MoveResult> {
  if (!opts.to) usage('Missing --to.', `${program} cloud template preview <name> --to <dir>`)
  const at = encodeURIComponent(name)
  const { previews } = await asJson<{ previews: Entry[] }>(await ask(`/${at}/previews`, {}, WITHOUT))
  if (previews.length === 0) say(`这个模板没有预览图。\nThis template has no preview.`)
  const written: string[] = []
  for (const p of previews) {
    const bytes = Buffer.from(await (await ask(`/${at}/previews/${route(p.path)}`, {}, WITHOUT)).arrayBuffer())
    const file = path.basename(p.path)
    const out = path.join(opts.to, file.startsWith(`${name}-`) ? file : `${name}-${file}`)
    fs.mkdirSync(opts.to, { recursive: true })
    fs.writeFileSync(out, bytes)
    written.push(out)
    say(out)
  }
  return { name, previews: written }
}

/** `akb cloud template get <name> --to <dir>` — every file, checked against the catalog's
 *  hashes before any is written, and never over a file already there. */
export async function templateGet(name: string, opts: { to?: string }, program: string): Promise<MoveResult> {
  if (!opts.to) usage('Missing --to.', `${program} cloud template get <name> --to <dir>`)
  const to = opts.to
  const at = encodeURIComponent(name)
  const { template } = await asJson<{ template: { files: Entry[] } }>(await ask(`/${at}`, {}, WITHOUT))
  const fetched: { out: string; bytes: Buffer }[] = []
  for (const f of template.files) {
    const out = path.resolve(to, f.path)
    if (!out.startsWith(path.resolve(to) + path.sep)) refuse(T.corrupt, WITHOUT)
    const bytes = Buffer.from(await (await ask(`/${at}/files/${route(f.path)}`, {}, WITHOUT)).arrayBuffer())
    if (bytes.byteLength !== f.size || createHash('sha256').update(bytes).digest('hex') !== f.sha256) {
      refuse(T.corrupt, WITHOUT)
    }
    fetched.push({ out, bytes })
  }
  const taken = fetched.filter((f) => fs.existsSync(f.out)).map((f) => path.relative(to, f.out))
  if (taken.length > 0) {
    refuse({
      zh: `目标文件夹已有同名文件：${taken.join('、')}。请换一个文件夹，或先移走这些文件。`,
      en: `The folder already has ${taken.join(', ')}. Use another folder, or move those files first.`,
    })
  }
  for (const f of fetched) {
    fs.mkdirSync(path.dirname(f.out), { recursive: true })
    fs.writeFileSync(f.out, f.bytes)
  }
  say(`已取回 ${name}：${fetched.length} 个文件，位于 ${to}\nFetched ${name}: ${fetched.length} files into ${to}`)
  return { name, to, files: template.files.map((f) => f.path) }
}

const route = (p: string) => p.split('/').map(encodeURIComponent).join('/')

/** `akb cloud template source <name> [--to <dir>]` — where it came from, and the evidence
 *  captured at the time, which stays readable after the original site changes. */
export async function templateSource(name: string, opts: { to?: string }): Promise<MoveResult> {
  const at = encodeURIComponent(name)
  const { source, evidence } = await asJson<{ source: Record<string, unknown>; evidence: Entry[] }>(await ask(`/${at}/source`))
  if (source.original === true) say('原创模板，没有外部参考。\nAn original template, with no outside reference.')
  for (const [k, v] of Object.entries(source)) if (k !== 'original') say(`${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
  const written: string[] = []
  for (const e of evidence) {
    if (!opts.to) {
      say(`evidence: ${e.path}`)
      continue
    }
    const out = path.join(opts.to, `${name}-${path.basename(e.path)}`)
    fs.mkdirSync(opts.to, { recursive: true })
    fs.writeFileSync(out, Buffer.from(await (await ask(`/${at}/evidence/${route(e.path)}`)).arrayBuffer()))
    written.push(out)
    say(out)
  }
  return { name, source, evidence: written.length > 0 ? written : evidence.map((e) => e.path) }
}


// ---- publishing ---------------------------------------------------------------------

/** `akb cloud template publish <dir> [--preview <file>]… [--evidence <file>]… [--replace]` */
export async function templatePublish(
  dir: string,
  opts: { preview: string[]; evidence: string[]; replace?: boolean },
): Promise<MoveResult> {
  const root = path.resolve(dir)
  const manifest = path.join(root, 'template.md')
  if (!fs.existsSync(manifest)) invalid('文件夹顶层缺少 template.md。', 'template.md is missing from the folder’s top level.')
  const meta = readTemplateMeta(fs.readFileSync(manifest, 'utf8'))
  const files = walk(root)
  const total = files.reduce((sum, f) => sum + fs.statSync(path.join(root, f)).size, 0)
  if (total > MAX_BYTES) invalid('模板文件合计超过 50 MB。', 'the template’s files exceed 50 MB.')
  for (const extra of [...opts.preview, ...opts.evidence]) {
    if (!fs.existsSync(extra)) invalid(`找不到文件 ${extra}。`, `${extra} does not exist.`)
    if (path.resolve(extra).startsWith(root + path.sep)) {
      invalid(
        `${extra} 在模板文件夹内；预览图与来源凭证需放在模板文件夹之外。`,
        `${extra} is inside the template folder; keep previews and evidence outside it.`,
      )
    }
  }
  if (meta.source.original !== true && opts.evidence.length === 0) {
    invalid('参考外部作品的模板需要用 --evidence 附上采集的来源凭证。', 'a template cloned from a reference needs its captured evidence, via --evidence.')
  }

  const form = new FormData()
  form.set('meta', JSON.stringify({ ...meta, replace: !!opts.replace }))
  const add = (kind: string, name: string, file: string) =>
    form.append(`${kind}:${name}`, new Blob([fs.readFileSync(file)]), path.basename(name))
  for (const f of files) add('files', f, path.join(root, f))
  for (const f of opts.preview) add('previews', path.basename(f), f)
  for (const f of opts.evidence) add('evidence', path.basename(f), f)

  const done = await asJson<{ name: string; replaced: boolean }>(await ask('', { method: 'POST', body: form }))
  say(
    done.replaced
      ? `已替换 ${done.name}：${files.length} 个文件。\nReplaced ${done.name}: ${files.length} files.`
      : `已发布 ${done.name}：${files.length} 个文件。\nPublished ${done.name}: ${files.length} files.`,
  )
  return { name: done.name, replaced: done.replaced, files }
}

/** `akb cloud template delete <name>` — maintainers only. */
export async function templateDelete(name: string): Promise<MoveResult> {
  await ask(`/${encodeURIComponent(name)}`, { method: 'DELETE' })
  say(`已从模板库删除 ${name}。\nDeleted ${name} from the catalog.`)
  return { name, deleted: true }
}

/** `akb cloud template showcase <name> <dir>` — what the site shows for a published template,
 *  described by `<dir>/showcase.json` and kept apart from the template. Maintainers only. */
export async function templateShowcase(name: string, dir: string): Promise<MoveResult> {
  const file = path.join(dir, 'showcase.json')
  if (!fs.existsSync(file)) invalid(`${dir} 中缺少 showcase.json。`, `showcase.json is missing from ${dir}.`)
  let meta: Record<string, unknown>
  try {
    meta = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    return invalid('showcase.json 不是有效的 JSON。', 'showcase.json is not valid JSON.')
  }
  const sides = [meta.original, meta.recreation].filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
  const named = [meta.cover, ...sides.flatMap((s) => [s.image, s.video])].filter((p): p is string => typeof p === 'string')
  const form = new FormData()
  form.set('meta', JSON.stringify(meta))
  for (const p of new Set(named)) {
    const at = path.join(dir, p)
    if (!fs.existsSync(at)) invalid(`找不到文件 ${at}。`, `${at} does not exist.`)
    form.append(`media:${p}`, new Blob([fs.readFileSync(at)]), p)
  }
  const done = await asJson<{ files: number }>(await ask(`/${encodeURIComponent(name)}/showcase`, { method: 'PUT', body: form }))
  say(`已更新 ${name} 的展示资料：${done.files} 个文件。\nUpdated ${name}'s showcase: ${done.files} files.`)
  return { name, files: done.files }
}

/** Every file under the folder, as relative paths; dotfiles and `node_modules` stay home. */
function walk(root: string, sub = ''): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(path.join(root, sub), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const rel = sub ? `${sub}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...walk(root, rel))
    else if (entry.isFile()) out.push(rel)
  }
  return out.sort()
}

interface PublishMeta {
  name: string
  category: string
  tags: string[]
  title: string
  summary: string
  description: string
  access: 'free' | 'pro'
  source: Record<string, unknown>
}

/** `template.md`'s frontmatter, checked the way the catalog will check it. */
export function readTemplateMeta(text: string): PublishMeta {
  const m = /^---\n([\s\S]*?)\n---/.exec(text.replace(/\r\n/g, '\n'))
  if (!m) invalid('template.md 缺少 frontmatter。', 'template.md has no frontmatter.')
  const fm = parseYamlSubset(m[1] ?? '')
  const text_ = (k: string, oneLine = true): string => {
    const v = typeof fm[k] === 'string' ? (fm[k] as string).trim() : ''
    if (!v) invalid(`缺少 ${k}。`, `${k} is missing.`)
    if (oneLine && v.includes('\n')) invalid(`${k} 只能是一行。`, `${k} is one line.`)
    return v
  }
  const name = text_('name')
  if (!SLUG.test(name)) invalid(`name 只能由小写字母、数字和连字符组成，例如 hero-tilted-screen。`, `name is lowercase words joined by hyphens, like hero-tilted-screen.`)
  const cat = text_('category')
  if (!SLUG.test(cat)) invalid('category 只能是小写英文短词，例如 ui 或 video。', 'category is a lowercase word, like ui or video.')
  const rawTags = fm.tags === undefined || fm.tags === '' ? [] : fm.tags
  if (!Array.isArray(rawTags)) return invalid('tags 需要是列表，例如 [hero, saas]。', 'tags is a list, like [hero, saas].')
  const tags = [...new Set((rawTags as Yaml[]).map(String))]
  const bad = tags.filter((t) => !SLUG.test(t))
  if (bad.length > 0) invalid(`标签 ${bad.join('、')} 不合规：只能用小写英文短词。`, `tag ${bad.join(', ')}: use lowercase words joined by hyphens.`)
  const access = fm.access === undefined || fm.access === '' ? 'free' : fm.access
  if (access !== 'free' && access !== 'pro') return invalid('access 只能是 free 或 pro。', 'access is free or pro.')
  // An absent source means original; the creator answers for that.
  const source = fm.source === undefined || fm.source === '' ? { original: true } : fm.source
  if (typeof source !== 'object' || Array.isArray(source)) {
    invalid('source 写法不对；原创模板可以不写，或写 source: { original: true }。', 'source is malformed; an original can omit it or say original: true.')
  }
  const s = source as Record<string, unknown>
  if (s.original !== true) {
    if (typeof s.site !== 'string' || !/^https?:\/\//.test(s.site)) invalid('source.site 需要是原站网址。', 'source.site is the referenced site’s URL.')
    if (!Array.isArray(s.references) || s.references.length === 0) {
      invalid('source.references 需要列出实际参考资料的网址。', 'source.references lists the URLs actually referenced.')
    }
    if (typeof s.captured !== 'string' || !CAPTURED.test(s.captured)) {
      invalid('source.captured 需要带时区的采集时间，例如 2026-10-16T09:00:00+08:00。', 'source.captured is the capture time with its time zone, like 2026-10-16T09:00:00+08:00.')
    }
    if (typeof s.note !== 'string' || !s.note.trim()) {
      invalid('source.note 需要说明凭证是什么、由谁采集。', 'source.note says what the evidence is and who captured it.')
    }
  }
  return {
    name,
    category: cat,
    tags,
    title: text_('title'),
    summary: text_('summary'),
    description: text_('description', false),
    access,
    source: s,
  }
}

type Yaml = string | boolean | Yaml[] | { [k: string]: Yaml }

/** The YAML a template's frontmatter uses: scalars, `[a, b]` and `- item` lists, `|` and `>`
 *  blocks, and nested maps by indentation. */
export function parseYamlSubset(src: string): Record<string, Yaml> {
  const lines = src.split('\n')
  let i = 0
  const indentOf = (l: string) => l.length - l.trimStart().length
  const scalar = (raw: string): Yaml => {
    const v = raw.trim()
    if (v === 'true') return true
    if (v === 'false') return false
    if (v.startsWith('[') && v.endsWith(']')) {
      return v.slice(1, -1).split(',').map((x) => unquote(x.trim())).filter((x) => x !== '')
    }
    return unquote(v)
  }
  const block = (min: number, fold: boolean): string => {
    const out: string[] = []
    while (i < lines.length && (lines[i]!.trim() === '' || indentOf(lines[i]!) >= min)) out.push(lines[i++]!.slice(min))
    while (out.length && out[out.length - 1] === '') out.pop()
    return fold ? out.join(' ').replace(/\s+/g, ' ').trim() : out.join('\n')
  }
  const map = (indent: number): Record<string, Yaml> => {
    const out: Record<string, Yaml> = {}
    while (i < lines.length) {
      const line = lines[i]!
      if (!line.trim() || line.trim().startsWith('#')) { i++; continue }
      if (indentOf(line) < indent) break
      const kv = /^\s*([A-Za-z0-9_-]+):(?:\s+(.*))?$/.exec(line)
      if (!kv) { i++; continue }
      i++
      const [, key = '', rest = ''] = kv
      const next = lines[i] ?? ''
      if (rest === '|' || rest === '>') out[key] = block(indent + 2, rest === '>')
      else if (rest) out[key] = scalar(rest)
      else if (next.trim().startsWith('- ') && indentOf(next) >= indent) {
        const items: Yaml[] = []
        while (i < lines.length && lines[i]!.trim().startsWith('- ')) items.push(scalar(lines[i++]!.trim().slice(2)))
        out[key] = items
      } else if (indentOf(next) > indent) out[key] = map(indentOf(next))
      else out[key] = ''
    }
    return out
  }
  return map(0)
}

function unquote(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.length >= 2 ? v.slice(1, -1) : v
  }
  return v
}
