// `akb cloud import --project <id|prefix> [--dry-run]` (#2123): this board's open cards, memory,
// rules and own workflows into an empty Cloud project. Cloud numbers the cards from the project's
// next number, in the order of their old ids, and every `#<id>` a card names follows. Everything
// is checked before anything is written; nothing on this computer is changed.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { BOARD_FILE_LIMIT, isBoardPath, workflowFolder } from '../../../cloud/src/board-files.ts'
import { checkWorkflowFiles } from '../../../cloud/src/v1/workflow-files.ts'
import { BUNDLED_AGENT_FILES } from '../lib/agents/bundled'
import { sharedMemory } from '../lib/agents/shared-memory'
import { LAND_ROLES, isBuiltinWorkflow, workflowById, workflows, type Workflow } from '../lib/agent/workflows'
import { idPrefix, walkMd } from '../lib/cards'
import { cloudEndpoints } from '../lib/cloud/config'
import { numberOf } from '../lib/cloud/tasks'
import { accessToken } from '../lib/cloud/session'
import { parseFrontmatter } from '../lib/frontmatter'
import { say } from '../lib/io'
import { AGENTS, ARCHIVE, ASSETS, CONFIG, DELIVERIES, KANBAN, MEMORY, MOCKUPS, MODULES_MD, RULES, TODO, TRIAGE, WORKFLOWS, die } from '../lib/paths'
import { openOf, parseQuestion } from '../lib/questions'
import type { Meta } from '../lib/types'

const BATCH = 50
const TITLE_LIMIT = 200
const APP_URL = 'https://app.wildcrane.ai'
const BOUNDARY = '<!-- agent -->'

type Said = { zh: string; en: string }

interface Card {
  id: number
  /** Under `todo/`, as this board names it. */
  rel: string
  text: string
  meta: Meta
  /** A subtask's group root id. */
  group: number | null
  root: boolean
  slug: string
}

interface Problem {
  file: string
  reason: Said
}

// ---- Cloud ----------------------------------------------------------------------

class Refused extends Error {
  constructor(message: string, readonly code?: string) {
    super(message)
  }
}

let token = ''

async function api<T>(method: string, route: string, body?: unknown, raw?: { bytes: Uint8Array; type: string }): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${cloudEndpoints().api}${route}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(raw ? { 'content-type': raw.type } : body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(raw ? { body: raw.bytes } : body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(120_000),
    })
  } catch (e) {
    throw new Refused(`Cloud could not be reached: ${e instanceof Error ? e.message : String(e)}`)
  }
  const parsed = (await res.json().catch(() => ({}))) as T & { error?: { code?: string; message?: string } }
  if (!res.ok) throw new Refused(parsed.error?.message ?? `Cloud answered ${res.status}.`, parsed.error?.code)
  return parsed
}

async function all<T>(route: string): Promise<T[]> {
  const out: T[] = []
  let after: string | null = null
  do {
    const sep = route.includes('?') ? '&' : '?'
    const page: { data: T[]; next: string | null } = await api('GET', `${route}${sep}limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`)
    out.push(...page.data)
    after = page.next
  } while (after)
  return out
}

interface Project {
  id: string
  name: string
  prefix: string
  workspace: string
}

async function findProject(asked: string): Promise<Project> {
  if (/^prj_/.test(asked)) return api<Project>('GET', `/v1/projects/${encodeURIComponent(asked)}`)
  const workspaces = await all<{ id: string }>('/v1/workspaces')
  for (const ws of workspaces) {
    const found = (await all<Project>(`/v1/projects?workspace=${encodeURIComponent(ws.id)}`))
      .find((p) => p.prefix.toLowerCase() === asked.toLowerCase())
    if (found) return found
  }
  throw new Refused(`No project of yours has the id or prefix "${asked}".`, 'not_found')
}

// ---- this board -------------------------------------------------------------------

const read = (file: string) => fs.readFileSync(file, 'utf8')
const bytes = (text: string) => Buffer.byteLength(text, 'utf8')

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...files(full))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

const posix = (p: string) => p.split(path.sep).join('/')

function openCards(): Card[] {
  const out: Card[] = []
  for (const file of walkMd(TODO)) {
    const rel = posix(path.relative(TODO, file))
    if (rel === 'README.md') continue
    const parts = rel.split('/')
    const text = read(file)
    const meta = parseFrontmatter(text).meta
    if (!meta) continue
    const name = parts[parts.length - 1]!
    const root = name === 'root.md' && parts.length === 2
    const id = root ? idPrefix(parts[0]!) : idPrefix(name)
    if (id === null) continue
    const group = !root && parts.length === 2 ? idPrefix(parts[0]!) : null
    const slug = (root ? parts[0]! : name.replace(/\.md$/, '')).replace(/^\d+-?/, '')
    out.push({ id, rel, text, meta, group, root, slug })
  }
  return out.sort((a, b) => a.id - b.id)
}

/** A body's problems, as Cloud refuses them: fences closed and one agent boundary at most. */
function bodyProblems(text: string): Said[] {
  const out: Said[] = []
  if (bytes(text) > BOARD_FILE_LIMIT) out.push({ zh: '超过 256 KB', en: 'over 256 KB' })
  let fence: { char: string; size: number } | null = null
  let boundaries = 0
  for (const line of text.split('\n')) {
    const mark = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    const run = mark?.[1] ?? ''
    if (fence) {
      if (run[0] === fence.char && run.length >= fence.size && !mark?.[2]?.trim()) fence = null
    } else if (run) fence = { char: run[0]!, size: run.length }
    else if (line.trim() === BOUNDARY) boundaries++
  }
  if (fence) out.push({ zh: '代码块未闭合', en: 'a code fence is never closed' })
  if (boundaries > 1) out.push({ zh: `\`${BOUNDARY}\` 出现多于一次`, en: `holds \`${BOUNDARY}\` more than once` })
  return out
}

/** A workflow as Cloud takes it: its `WORKFLOW.md` and the folder of every agent it names. */
function packWorkflow(flow: Workflow): Record<string, string> {
  const own = path.join(WORKFLOWS, flow.id)
  const out: Record<string, string> = {}
  for (const file of files(own)) out[posix(path.relative(own, file))] = read(file)
  const named = [...flow.previews, ...flow.land, ...flow.scheduled].map((h) => h.agent).filter((a) => !LAND_ROLES.includes(a))
  for (const agent of new Set(named)) {
    const dir = path.join(AGENTS, agent)
    if (fs.existsSync(path.join(dir, 'AGENT.md'))) {
      for (const file of files(dir)) out[`agents/${agent}/${posix(path.relative(dir, file))}`] = read(file)
      continue
    }
    for (const [key, text] of Object.entries(BUNDLED_AGENT_FILES)) {
      if (key.startsWith(`${agent}/`)) out[`agents/${key}`] = text
    }
  }
  return out
}

const builtinId = (id: string) => `wf_builtin_${id.replace(/-/g, '_')}`

// ---- references -------------------------------------------------------------------

/** `#<id>` outside code: a card imported takes its new number, any other is `old#<id>`. */
export function rewriteRefs(text: string, numbers: Map<number, number>): string {
  const swap = (s: string) =>
    s.replace(/(^|[^\w#&/])#(\d+)\b/g, (_, lead: string, n: string) => {
      const to = numbers.get(Number(n))
      return to === undefined ? `${lead}old#${n}` : `${lead}#${to}`
    })
  let fence: { char: string; size: number } | null = null
  return text.split('\n').map((line) => {
    const mark = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    const run = mark?.[1] ?? ''
    if (fence) {
      if (run[0] === fence.char && run.length >= fence.size && !mark?.[2]?.trim()) fence = null
      return line
    }
    if (run) {
      fence = { char: run[0]!, size: run.length }
      return line
    }
    return line.split(/(`+[^`]*`+)/).map((part, i) => (i % 2 ? part : swap(part))).join('')
  }).join('\n')
}

/** The card as Cloud keeps it: references renumbered, a build in flight back on review, an own
 *  workflow named by its Cloud folder. A blocker or relation not imported is done, so dropped. */
export function cardForCloud(text: string, numbers: Map<number, number>, workflow: string | null): string {
  const end = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text)?.[0].length ?? 0
  const front = end ? text.slice(0, end) : ''
  const lines = rewriteRefs(front, numbers).split('\n').map((line) => {
    const list = /^(blocked_by|related):\s*\[(.*)\]\s*$/.exec(line)
    if (list) {
      const kept = list[2]!.split(',').map((s) => numbers.get(Number(s.trim()))).filter((n) => n !== undefined)
      return `${list[1]}: [${kept.join(', ')}]`
    }
    if (/^status:\s*implementing\s*$/.test(line)) return 'status: ready'
    if (workflow && /^workflow:/.test(line)) return `workflow: ${workflow}`
    return line
  })
  return lines.join('\n') + rewriteRefs(text.slice(end), numbers)
}

/** On review when it waits on the user: `ready`, `implementing`, or an open `[user]` question;
 *  the first open one with options is what the review asks, as `runner/src/flow.ts` does. */
export function reviewOf(meta: Meta): true | { question: string; options: string[]; position: number } | null {
  const questions = meta.questions ?? []
  let open = false
  for (const [i, q] of questions.entries()) {
    const { tag, text } = parseQuestion(q.text)
    if (tag !== 'user' || !openOf([q]).length) continue
    open = true
    if (q.options?.length) return { question: text, options: q.options.slice(0, 8), position: i + 1 }
  }
  return open || meta.status === 'ready' || meta.status === 'implementing' ? true : null
}

/** Drafts a card names in its state folder: `.mockups/…` and `.assets/…`, found on disk. */
function draftsOf(text: string): { name: string; file: string }[] {
  const out = new Map<string, string>()
  for (const m of text.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)|\bsrc=["']([^"']+)["']/g)) {
    const name = (m[1] ?? m[2])!
    const at = /^\.(assets|mockups)\/(.+)$/.exec(name)
    if (!at) continue
    const base = at[1] === 'assets' ? ASSETS : MOCKUPS
    const file = path.resolve(base, at[2]!)
    if (file.startsWith(base + path.sep) && fs.statSync(file, { throwIfNoEntry: false })?.isFile()) out.set(name, file)
  }
  return [...out].map(([name, file]) => ({ name, file }))
}

const TYPES: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.pdf': 'application/pdf',
  '.html': 'text/html', '.md': 'text/markdown', '.mov': 'video/quicktime', '.wav': 'audio/wav', '.json': 'application/json',
}

function kindOf(ext: string): string {
  if (ext === '.html') return 'html'
  if (ext === '.md' || ext === '.mdx') return 'markdown'
  const type = TYPES[ext] ?? ''
  if (type.startsWith('image/')) return 'image'
  return type.startsWith('video/') || type.startsWith('audio/') ? 'video' : 'asset'
}

async function uploadDrafts(task: string, drafts: { name: string; file: string }[]): Promise<number> {
  const card = await api<{ version: number; body: string; assets: Record<string, unknown> }>('GET', `/v1/tasks/${task}/card`)
  if (Object.keys(card.assets ?? {}).length) return 0
  const assets: Record<string, { artifact: string; version: number }> = {}
  for (const { name, file } of drafts) {
    if (!card.body.includes(name)) continue
    const ext = path.extname(file).toLowerCase()
    const type = TYPES[ext] ?? 'application/octet-stream'
    const data = fs.readFileSync(file)
    const artifact = await api<{ id: string }>('POST', `/v1/tasks/${task}/artifacts`, { type: kindOf(ext), name: name.slice(0, 200) })
    const upload = await api<{ id: string }>('POST', `/v1/artifacts/${artifact.id}/uploads`, { content_type: type, size: Math.max(data.length, 1) })
    await api('PUT', `/v1/uploads/${upload.id}`, undefined, { bytes: data, type })
    const version = await api<{ version: number }>('POST', `/v1/artifacts/${artifact.id}/versions`, { upload: upload.id })
    assets[name] = { artifact: artifact.id, version: version.version }
  }
  if (!Object.keys(assets).length) return 0
  await api('PUT', `/v1/tasks/${task}/card`, { body: card.body, base_version: card.version, assets })
  return Object.keys(assets).length
}

// ---- the command ------------------------------------------------------------------

function stop(lines: string[]): never {
  die(lines.join('\n'), { kind: 'cloud-refused', bare: true })
}

export async function cloudImport(opts: { project?: string; dryRun?: boolean }, program: string): Promise<Record<string, unknown>> {
  if (!opts.project) {
    die(`Missing --project.\nusage: ${program} cloud import --project <id or prefix> [--dry-run]`, { kind: 'bad-args', bare: true, exitCode: 2 })
  }
  const held = await accessToken()
  if (!held.ok) {
    stop(held.reason === 'unreachable'
      ? ['无法连接 WildCrane Cloud。请检查网络后重试。', 'Could not reach WildCrane Cloud. Check your connection and try again.']
      : ['未登录 WildCrane Cloud。请在 WildCrane 应用的“配置 → Cloud”中登录后重试。',
          'Not signed in to WildCrane Cloud. Sign in from Configuration → Cloud in the WildCrane app, then try again.'])
  }
  token = held.token

  try {
    return await run(opts.project, !!opts.dryRun)
  } catch (e) {
    if (!(e instanceof Refused)) throw e
    stop(['导入已停止，Cloud 拒绝了请求：', 'The import stopped; Cloud refused it:', `  ${e.message}`,
      '修正后重新运行，已导入的内容不会重复。', 'Fix it and run again; what was imported is not imported twice.'])
  }
}

async function run(asked: string, dryRun: boolean): Promise<Record<string, unknown>> {
  const project = await findProject(asked)
  const cloudFlows = await all<{ id: string; name: string; builtin?: boolean }>(`/v1/workflows?workspace=${encodeURIComponent(project.workspace)}`)
  const board = crypto.createHash('sha256').update(fs.realpathSync(KANBAN)).digest('hex').slice(0, 16)
  const cards = openCards()
  const problems: Problem[] = []
  const where = (file: string) => posix(path.relative(KANBAN, file))

  // Own workflows, each with the agents it names.
  const own = workflows().filter((w) => !w.builtIn)
  const packed = new Map<string, Record<string, string>>()
  for (const flow of own) {
    const files = packWorkflow(flow)
    const checked = checkWorkflowFiles(files)
    if (!checked.ok) problems.push({ file: `workflows/${flow.id}`, reason: { zh: `${checked.file} ${checked.reason}`, en: `${checked.file} ${checked.reason}` } })
    else packed.set(flow.id, files)
  }

  for (const card of cards) {
    const file = `todo/${card.rel}`
    for (const reason of bodyProblems(card.text)) problems.push({ file, reason })
    if (!card.meta.title.trim()) problems.push({ file, reason: { zh: '没有标题', en: 'has no title' } })
    if (bytes(card.meta.title.trim()) > TITLE_LIMIT) problems.push({ file, reason: { zh: `标题超过 ${TITLE_LIMIT} 字节`, en: `the title is over ${TITLE_LIMIT} bytes` } })
    const wf = card.meta.workflow || 'coding'
    if (isBuiltinWorkflow(wf)) {
      if (!cloudFlows.some((w) => w.id === builtinId(wf))) {
        problems.push({ file, reason: { zh: `workflow \`${wf}\` 未在该 workspace 安装，请先在 Cloud 的 Workflows 页安装`, en: `workflow \`${wf}\` is not installed in this workspace; install it from Workflows in Cloud first` } })
      }
    } else if (!workflowById(wf)) {
      problems.push({ file, reason: { zh: `未知的 workflow \`${wf}\``, en: `unknown workflow \`${wf}\`` } })
    }
  }

  // Memory, rules and settings, by the paths the workspace's board keeps them at.
  const shared = sharedMemory(KANBAN)
  const root = `projects/${project.id}/`
  const boardFiles: { local: string; path: string; content: string }[] = []
  for (const file of [...files(MEMORY), ...files(RULES), CONFIG, MODULES_MD]) {
    if (!fs.existsSync(file)) continue
    const rel = where(file)
    if (!isBoardPath(rel)) continue
    const content = read(file)
    if (bytes(content) > BOARD_FILE_LIMIT) {
      problems.push({ file: rel, reason: { zh: '超过 256 KB', en: 'over 256 KB' } })
      continue
    }
    const isShared = rel.startsWith('memory/') && shared(rel.slice('memory/'.length))
    boardFiles.push({ local: rel, path: isShared ? rel : root + rel, content })
  }

  const listed = await all<{ key: string; source_context?: { import?: { board?: string; number?: number } } }>(
    `/v1/tasks?project=${project.id}&workspace=${encodeURIComponent(project.workspace)}`)
  if (listed.some((t) => t.source_context?.import?.board !== board)) {
    problems.push({ file: `${project.name} (${project.prefix})`, reason: { zh: '该项目已有自己的任务，请导入一个空项目', en: 'this project already has tasks of its own; import into an empty project' } })
  }

  const left = leftLocal(own)
  if (problems.length) {
    stop(['导入前检查发现问题，什么都没有写入：', 'The check before importing found problems; nothing was written:',
      ...problems.map((p) => `  ${p.file}: ${p.reason.zh} / ${p.reason.en}`)])
  }

  const reviews = cards.filter((c) => reviewOf(c.meta))
  if (dryRun) {
    const wouldShare = boardFiles.filter((f) => !f.path.startsWith(root)).length
    say(`预检通过 · Check passed — ${project.name} (${project.prefix})`)
    say(`  卡片 Cards: ${cards.length}（待审 on review: ${reviews.length}）`)
    say(`  自建 workflow Own workflows: ${own.length}`)
    say(`  项目文件 Project files: ${boardFiles.length - wouldShare} · workspace 记忆 Workspace memory: ${wouldShare}`)
    cards.forEach((c, i) => say(`  #${c.id} → ${project.prefix}-${i + 1}  ${c.meta.title}${reviewOf(c.meta) ? '  [待审 review]' : ''}`))
    sayLeft(left)
    return { dryRun: true, cards: cards.length, reviews: reviews.length, workflows: own.length, files: boardFiles.length, left }
  }

  // Own workflows: one already there by the same name is used as it is.
  const cloudOf = new Map<string, string>()
  for (const flow of own) {
    const found = cloudFlows.find((w) => !w.builtin && w.name === flow.name)
    const id = found?.id ?? (await api<{ id: string }>('POST', '/v1/workflows', { files: packed.get(flow.id), workspace: project.workspace })).id
    cloudOf.set(flow.id, id)
  }

  const { next } = await api<{ next: number }>('POST', `/v1/projects/${project.id}/import`, { board, cards: [] })
  // A card an earlier run imported keeps its number; the rest follow on from the project's next.
  const numbers = new Map<number, number>()
  for (const t of listed) {
    const at = t.source_context?.import
    if (at?.board === board && typeof at.number === 'number') numbers.set(at.number, numberOf(t.key))
  }
  let n = next
  for (const c of cards) if (!numbers.has(c.id)) numbers.set(c.id, n++)

  const ruleFile = (rel: string) => {
    const at = /^rules\/workflows\/([^/]+)\.md$/.exec(rel)
    const id = at && cloudOf.get(at[1]!)
    return id ? `rules/workflows/${workflowFolder(id)}.md` : rel
  }
  const sent = boardFiles.map((f) => ({ path: f.path.startsWith(root) ? root + ruleFile(f.local) : f.path, content: f.content }))

  const pathOf = (c: Card) => {
    const at = numbers.get(c.id)!
    if (c.root) return `todo/${at}-${c.slug || 'group'}/root.md`
    const group = c.group === null ? null : cards.find((x) => x.root && x.id === c.group)
    const name = `${at}-${c.slug || 'task'}.md`
    return group ? `todo/${numbers.get(group.id)}-${group.slug || 'group'}/${name}` : `todo/${name}`
  }
  const made: { ref: number; task: string; number: number }[] = []
  const kept: string[] = []
  for (let i = 0; i < Math.max(cards.length, 1); i += BATCH) {
    const batch = cards.slice(i, i + BATCH).map((c) => {
      const wf = c.meta.workflow || 'coding'
      const cloud = cloudOf.get(wf)
      const review = reviewOf(c.meta)
      return {
        ref: c.id,
        number: numbers.get(c.id)!,
        title: c.meta.title.trim(),
        workflow: cloud ?? builtinId(wf),
        path: pathOf(c),
        body: cardForCloud(c.text, numbers, cloud ? workflowFolder(cloud) : null),
        ...(review ? { review } : {}),
      }
    })
    const done = await api<{ cards: typeof made; kept: string[] }>('POST', `/v1/projects/${project.id}/import`,
      { board, cards: batch, ...(i === 0 ? { files: sent } : {}) })
    made.push(...done.cards)
    kept.push(...done.kept)
  }

  let drafts = 0
  for (const c of reviews) {
    const task = made.find((m) => m.ref === c.id)?.task
    const named = draftsOf(c.text)
    if (task && named.length) drafts += await uploadDrafts(task, named)
  }

  const memory = sent.filter((f) => /(^|\/)memory\//.test(f.path)).length - kept.length
  say(`已导入到 ${project.name} · Imported into ${project.name} (${project.prefix})`)
  say(`  卡片 Cards: ${made.length}（待审 on review: ${reviews.length}）`)
  say(`  自建 workflow Own workflows: ${cloudOf.size}`)
  say(`  记忆 Memory files: ${memory}${drafts ? ` · 草稿 Drafts: ${drafts}` : ''}`)
  if (kept.length) {
    say('  这些 workspace 记忆 Cloud 已有，保留了 Cloud 的版本 · Kept Cloud’s copy of these workspace memory files:')
    for (const k of kept) say(`    ${k}`)
  }
  say(`  ${APP_URL}/projects/${project.id}`)
  sayLeft(left)
  say('本地看板已不再生效，核对无误后请自行删除 `docs/kanban/`。')
  say('This local board is no longer used. Once you have checked Cloud, delete `docs/kanban/` yourself.')
  return { project: project.id, cards: made, workflows: [...cloudOf.values()], memory, drafts, kept, left }
}

/** What stays on this computer: archived cards, triage, delivery records, the metrics, and board
 *  agents no own workflow names. */
function leftLocal(own: Workflow[]): string[] {
  const out: string[] = []
  const count = (dir: string) => (fs.existsSync(dir) ? walkMd(dir).length : 0)
  const archived = count(ARCHIVE)
  if (archived) out.push(`.archive/ (${archived})`)
  const triage = count(TRIAGE)
  if (triage) out.push(`triage/ (${triage})`)
  if (fs.existsSync(DELIVERIES)) out.push('deliveries/')
  if (fs.existsSync(path.join(KANBAN, 'metrics.csv'))) out.push('metrics.csv')
  const named = new Set(own.flatMap((w) => [...w.previews, ...w.land, ...w.scheduled].map((h) => h.agent)))
  if (fs.existsSync(AGENTS)) {
    for (const e of fs.readdirSync(AGENTS, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith('.') && !named.has(e.name)) out.push(`agents/${e.name}/`)
    }
  }
  return out
}

function sayLeft(left: string[]): void {
  if (!left.length) return
  say('  留在本地、未导入 · Left on this computer, not imported:')
  for (const l of left) say(`    ${l}`)
}
