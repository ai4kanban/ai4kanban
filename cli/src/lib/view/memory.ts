// ---- the board's memory, read -----------------------------------------------
//
// The four files — what shipped, what was settled, what design mistakes to avoid, what was
// turned down. Every proposal is judged against them and every answer a run settles by
// itself leans on them, so a screen has to be able to show them.
//
// The set exists at two levels: the project's own in `docs/kanban/memory/`, and one copy per
// module in `docs/kanban/memory/<module>/`. Both are read here, by the same call — a module
// is named or it isn't (#130).
//
// A module is offered only when `docs/kanban/modules.md` names it, so an address someone
// typed can't reach a folder the map has never heard of. That holds for the writer too: a
// module the map does not name has no memory folder to write into.
//
// The list is fixed and a file that isn't there keeps its place, so the rows read the same
// on every board — an empty `text` with `written: false` is the answer for a file nobody
// has written, not a missing entry.

import fs from 'node:fs'
import path from 'node:path'

import { RESERVED_MEMORY_DIR } from '../memory'
import { MEMORY, rel } from '../paths'
import { readModules } from './first-run'
import { MEMORY_FILES, type MemoryFile, type MemoryModule, type MemoryName } from './types'

const memoryPath = (name: string, module: string): string =>
  path.join(module ? path.join(MEMORY, module) : MEMORY, `${name}.md`)

const known = (name: string): name is MemoryName =>
  MEMORY_FILES.some((f) => f.name === name)

// The project's own copy, or a module the map names — never `memory/agents/`, which is the
// agents' own and not a module's set however the map spells it (#421).
const openable = (module: string): boolean =>
  !module || (module !== RESERVED_MEMORY_DIR && readModules().includes(module))

/** The modules the panel can open, in the map's order, each saying whether it has a memory
 *  folder yet. A module with none gets one line saying so rather than four dead rows. */
export function readMemoryModules(): MemoryModule[] {
  return readModules()
    .filter(openable)
    .map((name) => ({
      name,
      hasMemory: fs.existsSync(path.join(MEMORY, name)),
    }))
}

/** One memory file, whole — the project's copy, or a module's when `module` names one.
 *
 *  `null` for a name that isn't one of the four, and for a module the map doesn't name: a
 *  caller passing an address someone typed gets an answer it can turn into "no such page". */
export function readMemoryFile(name: string, module = ''): MemoryFile | null {
  if (!known(name)) return null
  if (!openable(module)) return null
  const ref = MEMORY_FILES.find((f) => f.name === name)!
  const file = memoryPath(name, module)
  let text = ''
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    // Not there yet. The row stays and says so; every board then reads the same shape.
  }
  return {
    ...ref,
    module,
    path: file,
    // Repo-relative and always with forward slashes: this is the form pasted to an agent
    // working in the repo, and a Windows board's backslashes would not be that form.
    relPath: rel(file).split(path.sep).join('/'),
    text,
    written: text.trim() !== '',
  }
}

/**
 * Write one memory file whole — the project's copy, or a module's when `module` names one.
 *
 * The only writer there has ever been is the coding agent editing the file as a file, which
 * a board that does not live on this machine has no way to do (#315). So the board gains one,
 * and it is the same four names and the same two levels the reader above answers for: a name
 * that is not one of the four, and a module the map does not name, are both refused rather
 * than written somewhere nobody would look for them.
 *
 * The folder is made on the way, so a module remembering its first thing does not have to be
 * initialised first.
 */
export function writeMemoryFile(name: string, text: string, module = ''): MemoryFile | null {
  if (!known(name)) return null
  if (!openable(module)) return null
  const file = memoryPath(name, module)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text.endsWith('\n') || text === '' ? text : `${text}\n`)
  return readMemoryFile(name, module)
}
