// Which `memory/` files are the workspace's rather than the project's (#2093): the ones each
// agent lists under `akb.memoryFiles.workspace`, built-in and board agents alike. An agent akb
// refuses lists none, so its files stay the project's.

import fs from 'node:fs'
import path from 'node:path'

import { BUNDLED_AGENT_FILES } from './bundled'
import { parseSpecAgent } from './parse'

/** Whether a name under `memory/` is the workspace's. */
export type Shared = (name: string) => boolean

export function sharedMemory(board: string): Shared {
  const declared = new Map<string, string[]>()
  const take = (folder: string, text: string | null, builtIn: boolean) => {
    if (text === null || declared.has(folder)) return
    const read = parseSpecAgent(text, folder, () => null, builtIn)
    if ('agent' in read && read.agent.name === folder) declared.set(folder, read.agent.memoryFiles.workspace)
  }
  for (const [key, text] of Object.entries(BUNDLED_AGENT_FILES)) {
    const at = /^([^/]+)\/AGENT\.md$/.exec(key)
    if (at) take(at[1]!, text, true)
  }
  const root = path.join(board, 'agents')
  let folders: string[] = []
  try {
    folders = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
  } catch {
    // No board agents.
  }
  for (const folder of folders.sort()) {
    let text: string | null = null
    try {
      text = fs.readFileSync(path.join(root, folder, 'AGENT.md'), 'utf8')
    } catch {
      // A working folder, not an agent.
    }
    take(folder, text, false)
  }
  const matches = [...declared].flatMap(([agent, paths]) => paths.map((p) => matcher(`agents/${agent}/${p}`)))
  return (name) => matches.some((m) => m(name))
}

/** A folder ending in `/` holds everything under it; `*` matches within one name. */
function matcher(entry: string): Shared {
  if (entry.endsWith('/')) return (name) => name.startsWith(entry)
  const re = new RegExp(`^${entry.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`)
  return (name) => re.test(name)
}
