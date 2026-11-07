/**
 * A workflow as files (#2040): `WORKFLOW.md` and the folders of the agents it runs,
 * `agents/<name>/AGENT.md` and whatever sits beside it — the layout of a board, read by the
 * same code akb reads them with. Used by the API and by the build that packs the built-ins.
 * An official workflow may also carry skills, `skills/<name>/SKILL.md` and its files, and the
 * MCP servers its runs get, `mcp.json` (#2030).
 */

import { parseWorkflowFile, stagesOf, type WorkflowDef } from '../agent/workflow-def.ts'
import { AGENT_NAME, parseSpecAgent, type SpecAgent } from '../agents/parse.ts'
import { workflowDiagram, type WorkflowDiagram } from '../agent/workflow-diagram.ts'

export type WorkflowFiles = Record<string, string>

export const WORKFLOW_FILE = 'WORKFLOW.md'
export const MCP_FILE = 'mcp.json'

const KB = 1024
export const FILE_LIMITS = { file: 256 * KB, total: 2 * KB * KB, count: 500, path: 512 }

export type Checked =
  | { ok: true; def: WorkflowDef; files: WorkflowFiles }
  | { ok: false; file: string; reason: string; tooLarge?: boolean }

/** What Cloud's approval reads of a workflow: whether a card's last approval lands it or archives
 *  it. How many approvals there are is the card's own `stages` (#2154). */
export const landsOf = (def: WorkflowDef) => ({ lands: def.land.some((h) => !h.off) })

/** The approvals a card's chosen previews make (#2154), each agent's `after` read from the
 *  workflow's own files, as the board stages them. */
export function stagesFrom(files: WorkflowFiles, chosen: string[]): string[][] {
  const read = parseWorkflowFile('workflow', files[WORKFLOW_FILE] ?? '', WORKFLOW_FILE)
  if ('problem' in read) return []
  const previews = read.def.previews.filter((h) => !h.off).map((h) => h.agent)
  const after = (name: string): string[] => {
    const text = files[`agents/${name}/AGENT.md`]
    const parsed = text === undefined ? null : parseSpecAgent(text, name, () => null, false)
    return parsed && 'agent' in parsed ? parsed.agent.after.filter((other) => previews.includes(other)) : []
  }
  return stagesOf(previews.filter((name) => chosen.includes(name)), after)
}

/** Its `icon` (#461), or null when unset or unreadable. */
export function iconFrom(files: WorkflowFiles) {
  const read = parseWorkflowFile('workflow', files[WORKFLOW_FILE] ?? '', WORKFLOW_FILE)
  return 'def' in read ? read.def.icon ?? null : null
}

/** The workflow drawn for its detail page (#451), as akb draws a card's; null when unreadable. */
export function diagramFrom(files: WorkflowFiles): WorkflowDiagram | null {
  const read = parseWorkflowFile('workflow', files[WORKFLOW_FILE] ?? '', WORKFLOW_FILE)
  if ('problem' in read) return null
  return workflowDiagram(read.def, (name) => {
    const text = files[`agents/${name}/AGENT.md`]
    const parsed = text === undefined ? null : parseSpecAgent(text, name, () => null, false)
    return parsed && 'agent' in parsed ? parsed.agent : null
  })
}

const SEGMENT = /^[\w.-]+$/

/** An official workflow's marketplace details (#437): `ABOUT.md`, `ABOUT.<lang>.md` and the
 *  images under `screenshots/`, each held as a data URL. */
export const isAboutFile = (file: string) =>
  /^ABOUT(\.[a-z]{2})?\.md$/.test(file) || /^screenshots\/[\w.-]+\.(png|jpe?g|webp)$/.test(file)

/** Its `ABOUT` in `lang`, else English: the Markdown, with each `![caption](screenshots/…)`
 *  line taken out as a screenshot. */
export function aboutFrom(files: WorkflowFiles, lang: string | null) {
  const text = (lang && files[`ABOUT.${lang}.md`]) || files['ABOUT.md'] || ''
  const screenshots: { url: string; caption: string }[] = []
  const about = text.split('\n').filter((line) => {
    const shot = /^!\[([^\]]*)\]\((screenshots\/[^)\s]+)\)\s*$/.exec(line.trim())
    const url = shot && files[shot[2] as string]
    if (url) screenshots.push({ url, caption: shot[1] as string })
    return !url
  }).join('\n').trim()
  return { about, screenshots }
}

const bytes = (text: string) => new TextEncoder().encode(text).length

/** `<top>/<name>/<path>` → `[name, path]`; null for any other path. */
function folderPath(file: string, top: string): [string, string] | null {
  const parts = file.split('/')
  if (parts.length < 3 || parts[0] !== top || !AGENT_NAME.test(parts[1] as string)) return null
  if (parts.slice(2).some((p) => !SEGMENT.test(p) || p === '.' || p === '..')) return null
  return [parts[1] as string, parts.slice(2).join('/')]
}

/** `{ mcpServers: { <name>: { command, args? } } }`: local servers that need no credentials. */
function mcpProblem(text: string): string | null {
  let read: unknown
  try {
    read = JSON.parse(text)
  } catch {
    return 'is not JSON'
  }
  const servers = (read as { mcpServers?: unknown } | null)?.mcpServers
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return 'must hold `mcpServers`, an object of name → server'
  for (const [name, server] of Object.entries(servers)) {
    const { command, args, ...rest } = (server ?? {}) as Record<string, unknown>
    if (!AGENT_NAME.test(name)) return `names a server \`${name}\`; use lowercase letters, digits and dashes`
    if (typeof command !== 'string' || !command) return `server \`${name}\` needs a \`command\``
    if (args !== undefined && !(Array.isArray(args) && args.every((a) => typeof a === 'string'))) return `server \`${name}\`: \`args\` must be a list of strings`
    if (Object.keys(rest).length) return `server \`${name}\` takes only \`command\` and \`args\``
  }
  return null
}

/** `official` lets the files carry skills and MCP servers. */
export function checkWorkflowFiles(value: unknown, official = false): Checked {
  const fail = (file: string, reason: string, tooLarge = false): Checked => ({ ok: false, file, reason, ...(tooLarge ? { tooLarge } : {}) })
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('files', 'must be an object of path → text')
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > FILE_LIMITS.count) return fail('files', `holds at most ${FILE_LIMITS.count} files`, true)

  let total = 0
  const folders = new Map<string, Map<string, string>>()
  const skills = new Set<string>()
  for (const [file, text] of entries) {
    if (typeof text !== 'string' || text.includes('\u0000')) return fail(file, 'is not a text file')
    if (file.length > FILE_LIMITS.path) return fail(file, `the path is longer than ${FILE_LIMITS.path} characters`)
    const size = bytes(text)
    if (size > FILE_LIMITS.file) return fail(file, `is larger than ${FILE_LIMITS.file / KB} KB`, true)
    total += size
    if (total > FILE_LIMITS.total) return fail('files', `are larger than ${FILE_LIMITS.total / KB / KB} MB together`, true)
    if (file === WORKFLOW_FILE) continue
    if (official && file === MCP_FILE) {
      const problem = mcpProblem(text)
      if (problem) return fail(file, problem)
      continue
    }
    if (official && isAboutFile(file)) continue
    if (official && file.startsWith('skills/')) {
      if (!folderPath(file, 'skills')) return fail(file, 'is not inside skills/<name>/')
      skills.add(file.split('/')[1] as string)
      continue
    }
    const at = folderPath(file, 'agents')
    if (!at) return fail(file, `is neither ${WORKFLOW_FILE} nor inside agents/<name>/`)
    if (!folders.has(at[0])) folders.set(at[0], new Map())
    folders.get(at[0])!.set(at[1], text)
  }

  for (const name of skills) {
    if ((value as WorkflowFiles)[`skills/${name}/SKILL.md`] === undefined) return fail(`skills/${name}/SKILL.md`, 'is missing')
  }

  const source = (value as WorkflowFiles)[WORKFLOW_FILE]
  if (source === undefined) return fail(WORKFLOW_FILE, 'is missing')
  const read = parseWorkflowFile('workflow', source, WORKFLOW_FILE)
  if ('problem' in read) return fail(WORKFLOW_FILE, read.problem.replace(`${WORKFLOW_FILE}: `, ''))
  const def = read.def

  const agents = new Map<string, SpecAgent>()
  for (const [name, own] of folders) {
    const from = `agents/${name}/AGENT.md`
    const text = own.get('AGENT.md')
    if (text === undefined) return fail(from, 'is missing')
    const parsed = parseSpecAgent(text, from, (p) => own.get(p) ?? null, false, () => [...own.keys()].filter((p) => p !== 'AGENT.md'))
    if ('problem' in parsed) return fail(from, parsed.problem.replace(`${from}: `, ''))
    if (parsed.agent.name !== name) return fail(from, `calls itself \`${parsed.agent.name}\`; it must match its folder`)
    agents.set(name, parsed.agent)
  }

  const named: [string, string][] = [
    ...def.previews.map((h): [string, string] => [h.agent, 'it previews with']),
    ...def.land.map((h): [string, string] => [h.agent, 'it lands with']),
    ...def.scheduled.map((s): [string, string] => [s.agent, 'it schedules']),
  ]
  for (const [name, why] of named) {
    if (!agents.has(name)) return fail(WORKFLOW_FILE, `${why} \`${name}\`, which has no agents/${name}/AGENT.md`)
  }
  return { ok: true, def, files: value as WorkflowFiles }
}

/** An official workflow's files as a new own workflow (#444): `WORKFLOW.md` and `agents/`, its
 *  `name` replaced by `name` and its `names` dropped, or else each marked as a copy. Fails on
 *  what an own workflow cannot hold. */
export function cloneFiles(files: WorkflowFiles, name?: string): { files: WorkflowFiles } | { refused: string } {
  const refused = Object.keys(files).find((file) => file === MCP_FILE || file.startsWith('skills/'))
  if (refused) return { refused: refused === MCP_FILE ? MCP_FILE : `${refused.split('/').slice(0, 2).join('/')}/` }
  const kept = Object.fromEntries(Object.entries(files).filter(([file]) => !isAboutFile(file)))
  const source = kept[WORKFLOW_FILE] ?? ''
  const read = parseWorkflowFile('workflow', source, WORKFLOW_FILE)
  if ('problem' in read) return { files: kept }
  const lines = source.split('\n')
  const end = lines.indexOf('---', 1)
  const head: string[] = []
  for (let i = 1; i < end; i++) {
    const line = lines[i] as string
    if (/^names\s*:/.test(line)) {
      while (i + 1 < end && /^\s/.test(lines[i + 1] as string)) i++
      continue
    }
    if (!/^name\s*:/.test(line)) head.push(line)
  }
  const names = name ? {} : Object.fromEntries(Object.entries(read.def.names ?? {}).map(([lang, said]) => [lang, lang === 'zh' ? `${said}（副本）` : `${said} (copy)`]))
  const named = [
    `name: ${JSON.stringify(name ?? `${read.def.name} (copy)`)}`,
    ...(Object.keys(names).length ? ['names:', ...Object.entries(names).map(([lang, said]) => `  ${lang}: ${JSON.stringify(said)}`)] : []),
  ]
  kept[WORKFLOW_FILE] = ['---', ...named, ...head, ...lines.slice(end)].join('\n')
  return { files: kept }
}

export function previewCatalog(files: WorkflowFiles) {
  const read = parseWorkflowFile('workflow', files[WORKFLOW_FILE] ?? '', WORKFLOW_FILE)
  if ('problem' in read) throw new Error(read.problem)
  return read.def.previews.filter((h) => !h.off).map(({ agent: name }) => {
    const text = files[`agents/${name}/AGENT.md`]
    if (text === undefined) throw new Error(`Preview agent ${name} is missing.`)
    const parsed = parseSpecAgent(text, name, () => null, false)
    if ('problem' in parsed) throw new Error(parsed.problem)
    const agent = parsed.agent
    return { agent: name, title: { en: agent.i18n.en?.title, zh: agent.i18n.zh?.title }, when: agent.when ?? '' }
  })
}
