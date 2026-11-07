// ---- global memories (#1575) ------------------------------------------------
//
// A folder of material several agents share, under `memory/<name>/`. Its `MEMORY.md` holds a
// `name`, a `description` and the rules every agent keeping it follows; `README.md` is its
// index. A built-in one's `MEMORY.md` ships inside the command, so its board folder holds the
// index and entries alone. An agent opts in with `akb.memory: [<name>]`.

import fs from 'node:fs'
import path from 'node:path'

import { rawMove } from './agent/command'
import { type SpecAgent } from './agents/parse'
import { parseYamlBlock, splitFrontmatter, type YamlValue } from './agents/yaml'
import { RESERVED_MEMORY_DIR } from './memory'
import { MEMORY } from './paths'
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

// ---- writing one ------------------------------------------------------------

