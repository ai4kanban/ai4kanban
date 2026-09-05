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
import type { SpecAgent } from './parse'

/** The board's agents, and every reason one is missing from them. */
export interface SpecAgentCatalog {
  agents: SpecAgent[]
  /** One line per agent that could not be used, saying which and why. */
  problems: string[]
}

/** Read the catalog. Nothing is cached: an agent added, edited or switched off between two
 *  runs takes effect on the next one, the same way the board's settings do. */
export function specAgentCatalog(): SpecAgentCatalog {
  const agents: SpecAgent[] = []
  const problems: string[] = []
  const take = (read: { agent: SpecAgent } | { problem: string }, folder: string): void => {
    if ('problem' in read) return void problems.push(read.problem)
    if (ROLE_NAMES.includes(read.agent.name)) {
      problems.push(
        `${read.agent.from}: \`${read.agent.name}\` is one of the roles the board ships, whose rule ` +
          'this agent would then share, so this one is not used. Rename it.',
      )
      return
    }
    const clash = agents.find((a) => a.name === read.agent.name)
    if (clash) {
      problems.push(
        `${read.agent.from}: an agent named \`${read.agent.name}\` is already on this board ` +
          `(${clash.from}), so this one is not used. Rename one of them.`,
      )
      return
    }
    if (read.agent.name !== folder) {
      problems.push(
        `${read.agent.from}: its folder is \`${folder}\` but it calls itself \`${read.agent.name}\`. ` +
          'An agent is asked for by its folder name — make the two match.',
      )
      return
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
  return { agents, problems }
}

// ---- the agents the command ships ------------------------------------------

const bundledFolders = (): string[] =>
  [...new Set(Object.keys(BUNDLED_AGENT_FILES).map((key) => key.split('/')[0]!))].sort()

function readBundled(folder: string): { agent: SpecAgent } | { problem: string } {
  const file = (relative: string): string | null => BUNDLED_AGENT_FILES[`${folder}/${relative}`] ?? null
  const text = file('AGENT.md')
  if (text === null) return { problem: `the built-in \`${folder}\` agent has no AGENT.md` }
  return parseSpecAgent(text, `the built-in \`${folder}\` agent`, file, true)
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

function readProject(root: string, folder: string): { agent: SpecAgent } | { problem: string } {
  const dir = path.join(root, folder)
  // Read through the agent's own folder only. A reference is agent-relative by contract
  // (./parse.ts refuses an absolute or climbing one); this is the second lock on it, so a
  // path that slipped through still cannot reach the rest of the repo.
  const file = (relative: string): string | null => {
    const target = path.resolve(dir, relative)
    if (target !== dir && !target.startsWith(dir + path.sep)) return null
    try {
      return fs.readFileSync(target, 'utf8')
    } catch {
      return null
    }
  }
  const found = AGENT_FILES.map((name) => ({ name, text: file(name) })).find((f) => f.text !== null)
  if (!found) return { problem: `${rel(path.join(dir, AGENT_FILES[0]!))} is missing` }
  return parseSpecAgent(found.text!, rel(path.join(dir, found.name)), file)
}
