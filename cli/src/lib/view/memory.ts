// ---- the project's memory, read ---------------------------------------------
//
// The four files in `docs/kanban/memory/` — what shipped, what was settled, what design
// mistakes to avoid, what was turned down. Every proposal is judged against them and every
// answer a run settles by itself leans on them, so a screen has to be able to show them.
//
// Read-only, and the project-wide copy only: a module's own set is reached by opening its
// folder, and a panel that listed every module's four files would be a file browser.
//
// The list is fixed and a file that isn't there keeps its place, so the rows read the same
// on every board — an empty `text` with `written: false` is the answer for a file nobody
// has written, not a missing entry.

import fs from 'node:fs'
import path from 'node:path'

import { MEMORY, rel } from '../paths'
import { MEMORY_FILES, type MemoryFile, type MemoryName } from './types'

const known = (name: string): name is MemoryName =>
  MEMORY_FILES.some((f) => f.name === name)

/** One memory file, whole. `null` for a name that isn't one of the four — a caller passing
 *  an address someone typed gets an answer it can turn into "no such page". */
export function readMemoryFile(name: string): MemoryFile | null {
  if (!known(name)) return null
  const ref = MEMORY_FILES.find((f) => f.name === name)!
  const file = path.join(MEMORY, `${name}.md`)
  let text = ''
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    // Not there yet. The row stays and says so; every board then reads the same shape.
  }
  return {
    ...ref,
    path: file,
    // Repo-relative and always with forward slashes: this is the form pasted to an agent
    // working in the repo, and a Windows board's backslashes would not be that form.
    relPath: rel(file).split(path.sep).join('/'),
    text,
    written: text.trim() !== '',
  }
}
