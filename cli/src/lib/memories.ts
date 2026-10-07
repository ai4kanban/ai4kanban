// ---- global memories (#1575) ------------------------------------------------
//
// A folder of material several agents share, under `memory/<name>/`. Its `MEMORY.md` holds a
// `name`, a `description` and the rules every agent keeping it follows; `README.md` is its
// index. A built-in one's `MEMORY.md` ships inside the command, so its board folder holds the
// index and entries alone. An agent opts in with `akb.memory: [<name>]`.

import fs from 'node:fs'
import path from 'node:path'

import { rawMove } from './agent/command'
import type { GlobalMemoryView } from './agent/types'
import { specAgentCatalog } from './agents/catalog'
import { AGENT_NAME, type SpecAgent } from './agents/parse'
import { parseYamlBlock, splitFrontmatter, type YamlValue } from './agents/yaml'
import { readLanguage } from './machine/settings'
import { RESERVED_MEMORY_DIR } from './memory'
import { MEMORY, rel } from './paths'
import type { WriteResult } from './view/types'
import { yamlScalar } from './yaml'
import { BUNDLED_MEMORY_FILES } from '../memories/bundled'

export const GLOBAL_MEMORY_FILE = 'MEMORY.md'

export interface GlobalMemory {
  name: string
  description: string
  i18n: Record<string, { title?: string; description?: string }>
  rules: string
  /** The whole `MEMORY.md`. */
  text: string
  builtIn: boolean
  /** Its board folder, absolute. */
  dir: string
}

function readMemory(text: string, builtIn: boolean, folder: string): GlobalMemory | null {
  const { meta, body } = splitFrontmatter(text)
  if (meta === null) return null
  const front = parseYamlBlock(meta)
  const i18n: GlobalMemory['i18n'] = {}
  const said = front.i18n
  if (said && typeof said === 'object' && !Array.isArray(said)) {
    for (const [tag, lines] of Object.entries(said)) {
      if (!lines || typeof lines !== 'object' || Array.isArray(lines)) continue
      i18n[tag] = { title: str(lines.title) || undefined, description: str(lines.description) || undefined }
    }
  }
  return {
    name: folder,
    description: str(front.description),
    i18n,
    rules: body.trim(),
    text,
    builtIn,
    dir: path.join(MEMORY, folder),
  }
}

const str = (value: YamlValue | undefined): string => (typeof value === 'string' ? value.trim() : '')

/** Every global memory: the built-in ones first, then the board's own. A board folder taking
 *  a built-in's name is the built-in's entries, never a second memory. */
export function globalMemories(): GlobalMemory[] {
  const out: GlobalMemory[] = []
  for (const [name, text] of Object.entries(BUNDLED_MEMORY_FILES)) {
    const memory = readMemory(text, true, name)
    if (memory) out.push(memory)
  }
  let folders: string[] = []
  try {
    folders = fs.readdirSync(MEMORY, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
  } catch {
    // no memory folder yet
  }
  for (const name of folders) {
    if (name in BUNDLED_MEMORY_FILES || name === RESERVED_MEMORY_DIR) continue
    const file = path.join(MEMORY, name, GLOBAL_MEMORY_FILE)
    if (!fs.existsSync(file)) continue
    const memory = readMemory(fs.readFileSync(file, 'utf8'), false, name)
    if (memory) out.push(memory)
  }
  return out
}

export const findGlobalMemory = (name: string): GlobalMemory | null =>
  globalMemories().find((m) => m.name === name) ?? null

/** The global memories an agent keeps, as one line each — rules and index are read on
 *  demand. Empty when it names none that exist. */
export function globalMemoryBlock(agent: SpecAgent): string {
  const all = globalMemories()
  const kept = agent.memory.map((name) => all.find((m) => m.name === name)).filter((m): m is GlobalMemory => !!m)
  if (!kept.length) return ''
  return [
    'Global memories you share with other agents — open one only when the work needs it, and',
    'follow its rules whenever you change it:',
    '',
    ...kept.map((m) => {
      const rules = m.builtIn ? `\`${rawMove(`memory-file ${m.name}`)}\`` : `\`${GLOBAL_MEMORY_FILE}\` in that folder`
      return `- \`${m.name}\` — ${m.description.replace(/[.。]$/, '')}: \`${m.dir}/\`; rules: ${rules}`
    }),
  ].join('\n')
}

/** Every global memory as Configuration → Global memory draws it. */
export function readGlobalMemories(): GlobalMemoryView[] {
  const language = readLanguage()
  const agents = specAgentCatalog().agents
  return globalMemories().map((m) => ({
    name: m.name,
    title: m.i18n[language]?.title || m.name,
    description: m.description,
    gloss: m.i18n[language]?.description || m.description,
    rules: m.rules,
    builtIn: m.builtIn,
    folder: `${rel(m.dir)}/`,
    agents: agents.filter((a) => a.memory.includes(m.name)).map((a) => a.name),
  }))
}

// ---- writing one ------------------------------------------------------------

const memoryText = (name: string, description: string, rules: string): string =>
  ['---', `name: ${name}`, `description: ${yamlScalar(description.trim())}`, '---', '', rules.trim(), ''].join('\n')

/** Create a global memory: its folder and `MEMORY.md`. */
export function createGlobalMemory(asked: string, description: string, rules: string): WriteResult {
  const name = String(asked ?? '').trim().toLowerCase()
  if (!AGENT_NAME.test(name)) return { ok: false, error: `"${name}" is not a usable name — use lower-case words joined by "-"` }
  if (name === RESERVED_MEMORY_DIR || name in BUNDLED_MEMORY_FILES) return { ok: false, error: `\`${name}\` is taken. Pick another name.` }
  const dir = path.join(MEMORY, name)
  if (fs.existsSync(dir)) return { ok: false, error: `${rel(dir)}/ is already there. Pick another name.` }
  if (!String(description ?? '').trim()) return { ok: false, error: 'a global memory needs a description' }
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, GLOBAL_MEMORY_FILE), memoryText(name, description, rules))
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  return { ok: true }
}

const ownMemory = (name: string): GlobalMemory | WriteResult => {
  const memory = findGlobalMemory(name)
  if (!memory) return { ok: false, error: `"${name}" is not a global memory on this board.` }
  if (memory.builtIn) return { ok: false, error: `\`${name}\` ships inside the command, so it is not this board's to change.` }
  return memory
}

/** Replace a custom global memory's description and rules. Its other frontmatter stays. */
export function saveGlobalMemory(name: string, description: string, rules: string): WriteResult {
  const memory = ownMemory(name)
  if (!('dir' in memory)) return memory
  if (!String(description ?? '').trim()) return { ok: false, error: 'a global memory needs a description' }
  const { meta } = splitFrontmatter(memory.text)
  const line = `description: ${yamlScalar(String(description).trim())}`
  const front = /^description:.*$/m.test(meta ?? '') ? meta!.replace(/^description:.*$/m, line) : `${meta ?? `name: ${name}`}\n${line}`
  try {
    fs.writeFileSync(path.join(memory.dir, GLOBAL_MEMORY_FILE), ['---', front, '---', '', String(rules ?? '').trim(), ''].join('\n'))
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  return { ok: true }
}

/** Delete a custom global memory's folder, everything in it included. */
export function deleteGlobalMemory(name: string): WriteResult {
  const memory = ownMemory(name)
  if (!('dir' in memory)) return memory
  try {
    fs.rmSync(memory.dir, { recursive: true, force: true })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  return { ok: true }
}
