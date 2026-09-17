// ---- the board's memory, read -----------------------------------------------
//
// What shipped, where the project is going, what was settled, what design mistakes to avoid,
// what was turned down. Every proposal is judged against them and every answer a run settles
// by itself leans on them, so a screen has to be able to show them.
//
// Memory is grouped by WHO owns it (#805): `docs/kanban/memory/` holds the board's own
// record — `readme.md` and `goal.md` — and each agent that keeps memory has a folder of its
// own beside them. A module is a `## <module>` topic inside a file, so there is nothing here
// that opens one.
//
// The board's and the planner's rows are fixed, and a file that isn't there keeps its place.
// A spec agent's rows are the files its folder actually holds (#833).

import fs from 'node:fs'
import path from 'node:path'

import { agentRoster } from '../agent/roles'
import { BOARD_MEMORY_FILES, PLANNER, memoryNamesOf, migrateMemory } from '../memory'
import { AGENT_MEMORY, MEMORY, rel } from '../paths'
import { readGoalBody } from './goal'
import { MEMORY_FILES, type MemoryFile, type MemoryName, type MemoryOwner } from './types'

const memoryPath = (name: string, agent: string): string =>
  path.join(agent ? path.join(AGENT_MEMORY, agent) : MEMORY, `${name}.md`)

const nameOf = (file: string): MemoryName => file.replace(/\.md$/, '') as MemoryName

/** The files one owner may hold, in the panel's order — the board's two, or the agent's own,
 *  the known names first and any other file its prompt keeps after them. */
const filesOf = (agent: string): MemoryName[] => {
  const held = (agent ? memoryNamesOf(agent) : BOARD_MEMORY_FILES).map(nameOf)
  const known = MEMORY_FILES.map((ref) => ref.name).filter((name) => held.includes(name))
  return [...known, ...held.filter((name) => !known.includes(name))]
}

/** Every memory folder on this board — planning's always, whoever leads it (#858), then each
 *  agent's once it has written a file, in the roster's order. */
const owners = (): Array<{ agent: string; title: string }> => [
  { agent: PLANNER, title: '' },
  ...agentRoster()
    .filter((entry) => entry.name !== PLANNER && entry.ownMemory.length > 0)
    .map((entry) => ({ agent: entry.name, title: entry.title })),
]

/** The board's own record, then each agent's folder (#805). The planner is listed before it
 *  has written anything, and the panel says so rather than drawing rows that lead nowhere.
 *  The board's own two are always listed — an empty one still has a page. */
export function readMemoryOwners(): MemoryOwner[] {
  migrateMemory()
  return [
    { agent: '', title: '', files: filesOf('') },
    ...owners().map(({ agent, title }) => ({
      agent,
      title,
      files: filesOf(agent).filter((name) => fs.existsSync(memoryPath(name, agent))),
    })),
  ]
}

/** Whether this owner holds that file at all — the one test a typed address is put to. */
const openable = (name: string, agent: string): name is MemoryName =>
  (filesOf(agent) as string[]).includes(name) && (!agent || owners().some((o) => o.agent === agent))

/** One memory file, whole — the board's own, or one an agent keeps.
 *
 *  `null` for a file that owner does not hold, and for an agent that keeps no memory: a
 *  caller passing an address someone typed gets an answer it can turn into "no such page". */
export function readMemoryFile(name: string, agent = ''): MemoryFile | null {
  migrateMemory()
  if (!openable(name, agent)) return null
  const ref = MEMORY_FILES.find((f) => f.name === name) ?? { name, label: name }
  const file = memoryPath(name, agent)
  let text = ''
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    // Not there yet. The row stays and says so; every board then reads the same shape.
  }
  // The goal's `reviewed:` field is the agent's own bookkeeping, and a file holding nothing
  // but it is a goal nobody has written — the same test the header's star reads.
  const goal = name === 'goal' ? readGoalBody(text) : null
  return {
    ...ref,
    agent,
    path: file,
    // Repo-relative and always with forward slashes: this is the form pasted to an agent
    // working in the repo, and a Windows board's backslashes would not be that form.
    relPath: rel(file).split(path.sep).join('/'),
    text: goal ? goal.body.replace(/^\n+/, '') : text,
    written: goal ? goal.written : text.trim() !== '',
  }
}

/**
 * Write one memory file whole — the board's own, or one an agent keeps.
 *
 * The only writer there has ever been is the coding agent editing the file as a file, which
 * a board that does not live on this machine has no way to do (#315). So the board gains one,
 * and it answers for exactly what the reader above does: a file its owner does not hold is
 * refused rather than written somewhere nobody would look for it.
 *
 * The folder is made on the way, so an agent remembering its first thing does not have to be
 * initialised first.
 */
export function writeMemoryFile(name: string, text: string, agent = ''): MemoryFile | null {
  migrateMemory()
  if (!openable(name, agent)) return null
  // Never the goal: it is the user's own words under a field the board keeps, and `saveGoal`
  // is what writes one without losing either.
  if (name === 'goal') return null
  const file = memoryPath(name, agent)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text.endsWith('\n') || text === '' ? text : `${text}\n`)
  return readMemoryFile(name, agent)
}
