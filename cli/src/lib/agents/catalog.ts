// Every spec agent this board can run, from wherever it comes.
//
// Two sources, one list:
//   - the agents the command ships, inlined into the built file (./bundled.ts),
//   - the agents the project adds, under `docs/kanban/agents/<name>/AGENT.md`.
//
// Built-ins come first, so a board reads the same list whether or not it has added any of
// its own. A project agent taking a built-in's name is refused rather than allowed to
// shadow it: a card would otherwise be planned by instructions nobody at the board could
// see, and the name in the log would say the built-in ran. A role's name is refused for the
// same reason — a rule is keyed by the agent's name (#420), so the two would share one file.
//
// Whatever cannot be used is reported, never dropped in silence — an agent nobody can see
// failing is a specialist that quietly stops being asked for.

import fs from 'node:fs'
import path from 'node:path'

import { ROLE_NAMES } from '../agent/roles'
import { AGENTS, LEGACY_AGENTS, rel } from '../paths'
import { BUNDLED_AGENT_FILES } from './bundled'
import { parseSpecAgent } from './parse'
import type { AgentProblem, SpecAgent } from './parse'

/** The board's agents, and every reason one is missing from them. */
export interface SpecAgentCatalog {
  agents: SpecAgent[]
  /** One line per agent that could not be used, saying which and why. */
  problems: string[]
  /** The project agents left out, each with why — for a caller that says it its own way (#1342). */
  refused: RefusedAgent[]
}

export type RefusedCause = 'oldKeys' | 'noFile' | 'nameTaken' | 'folderName' | 'file'

/** One project agent the board does not use. */
export interface RefusedAgent {
  folder: string
  /** What its file calls itself, when it reads that far. */
  name?: string
  /** Its `AGENT.md`, from the project root. */
  file: string
  cause: RefusedCause
  /** `oldKeys`: the keys to take out, and the line that replaces them when the file names one. */
  keys?: string[]
  line?: string
}

type ReadProblem = AgentProblem & { file?: string; missing?: boolean }

/** Read the catalog. Nothing is cached: an agent added, edited or switched off between two
 *  runs takes effect on the next one, the same way the board's settings do. */
export function specAgentCatalog(): SpecAgentCatalog {
  const agents: SpecAgent[] = []
  const problems: string[] = []
  const refused: RefusedAgent[] = []
  const take = (read: { agent: SpecAgent } | ReadProblem, folder: string): void => {
    if ('problem' in read) {
      // A folder with no agent file is somebody's working folder (#1414), not a broken agent:
      // it is said only where a workflow names it.
      if (!read.missing) problems.push(read.problem)
      if (!read.file) return
      const { file, name, old } = read
      const cause = read.missing ? 'noFile' : old ? 'oldKeys' : 'file'
      refused.push({ folder, file, cause, ...(name ? { name } : {}), ...(old ? { keys: old.keys } : {}), ...(old?.line ? { line: old.line } : {}) })
      return
    }
    const { name, from, builtIn } = read.agent
    const refuse = (cause: RefusedCause, problem: string): void => {
      problems.push(problem)
      if (!builtIn) refused.push({ folder, name, file: from, cause })
    }
    if (ROLE_NAMES.includes(name)) {
      return refuse(
        'nameTaken',
        `${from}: \`${name}\` is one of the roles the board ships, whose rule ` +
          'this agent would then share, so this one is not used. Rename it.',
      )
    }
    const clash = agents.find((a) => a.name === name)
    if (clash) {
      return refuse(
        'nameTaken',
        `${from}: an agent named \`${name}\` is already on this board ` +
          `(${clash.from}), so this one is not used. Rename one of them.`,
      )
    }
    if (name !== folder) {
      return refuse(
        'folderName',
        `${from}: its folder is \`${folder}\` but it calls itself \`${name}\`. ` +
          'An agent is asked for by its folder name — make the two match.',
      )
    }
    agents.push(read.agent)
  }

  for (const folder of bundledFolders()) take(readBundled(folder), folder)
  for (const folder of projectFolders(AGENTS)) {
    const read = readProject(AGENTS, folder)
    take(read, folder)
    // Half moved: the folder is the new one, the filename the old one. It works for the same
    // release the old folder does, and is reported the same way — a spelling that goes on
    // working with nothing said about it is the one that breaks on the release that drops it.
    if ('agent' in read && read.agent.from.endsWith(LEGACY_AGENT_FILE)) {
      problems.push(`${read.agent.from}: rename it to ${AGENT_FILE}`)
    }
  }
  // The folder they used to sit in, read for one release (#419). Anything still there works,
  // and says so: a board that upgrades keeps running until someone moves the folder.
  for (const folder of projectFolders(LEGACY_AGENTS)) {
    take(readProject(LEGACY_AGENTS, folder), folder)
    problems.push(`${rel(path.join(LEGACY_AGENTS, folder))}: move it to ${rel(path.join(AGENTS, folder))}/`)
  }
  return { agents, problems, refused }
}

// ---- the agents the command ships ------------------------------------------

const bundledFolders = (): string[] =>
  [...new Set(Object.keys(BUNDLED_AGENT_FILES).map((key) => key.split('/')[0]!))].sort()

function readBundled(folder: string): { agent: SpecAgent } | { problem: string } {
  const file = (relative: string): string | null => BUNDLED_AGENT_FILES[`${folder}/${relative}`] ?? null
  const text = file('AGENT.md')
  if (text === null) return { problem: `the built-in \`${folder}\` agent has no AGENT.md` }
  const list = (): string[] =>
    ownFiles(Object.keys(BUNDLED_AGENT_FILES).filter((k) => k.startsWith(`${folder}/`)).map((k) => k.slice(folder.length + 1)))
  return parseSpecAgent(text, `the built-in \`${folder}\` agent`, file, true, list)
}

// ---- the agents the project adds -------------------------------------------

function projectFolders(root: string): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort()
}

// `SKILL.md` is read beside `AGENT.md` for the same release the old folder is (#419), so a
// board only has to move its files once and either name works while it does.
const AGENT_FILE = 'AGENT.md'
const LEGACY_AGENT_FILE = 'SKILL.md'
const AGENT_FILES = [AGENT_FILE, LEGACY_AGENT_FILE]

/** Read through one agent's own folder and no further. A reference is agent-relative by
 *  contract (./parse.ts refuses an absolute or climbing one); this is the second lock on it,
 *  so a path that slipped through still cannot reach the rest of the repo. */
export function agentFileReader(dir: string): (relative: string) => string | null {
  return (relative) => {
    const target = path.resolve(dir, relative)
    if (target !== dir && !target.startsWith(dir + path.sep)) return null
    try {
      return fs.readFileSync(target, 'utf8')
    } catch {
      return null
    }
  }
}

/** What an agent offers a run to read (#860): everything in its folder but its own
 *  `AGENT.md`. Dot files and dot folders are housekeeping — an editor's leftovers, a cache —
 *  and are never named. */
const ownFiles = (paths: string[]): string[] =>
  paths.filter((p) => !AGENT_FILES.includes(p) && !p.split('/').some((part) => part.startsWith('.'))).sort()

// One agent's folder, all the way down, as agent-relative paths. No layout is imposed: a
// file sits wherever its agent put it.
function walkFolder(dir: string, prefix: string): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries.flatMap((e) => {
    const here = prefix ? `${prefix}/${e.name}` : e.name
    return e.isDirectory() ? walkFolder(path.join(dir, e.name), here) : [here]
  })
}

function readProject(root: string, folder: string): { agent: SpecAgent } | ReadProblem {
  const dir = path.join(root, folder)
  const file = agentFileReader(dir)
  const found = AGENT_FILES.map((name) => ({ name, text: file(name) })).find((f) => f.text !== null)
  const missing = rel(path.join(dir, AGENT_FILE))
  if (!found) return { problem: `${missing} is missing`, file: missing, missing: true }
  const from = rel(path.join(dir, found.name))
  const read = parseSpecAgent(found.text!, from, file, false, () => ownFiles(walkFolder(dir, '')))
  if ('problem' in read) return { ...read, file: from }
  // Where it lives and what it says, whole — a project agent's file is the box the Agents
  // pane writes it through (#422), and only an agent read off disk has one.
  if ('agent' in read) Object.assign(read.agent, { dir, text: found.text! })
  return read
}
