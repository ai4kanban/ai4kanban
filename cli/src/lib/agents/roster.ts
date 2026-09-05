// The whole team, as the Agents pane reads and writes it (#422).
//
// One list: the roles the board ships, then the specialists the command ships, then the
// ones the project added. The pane draws a character per entry, and the page under the grid
// draws whatever that entry carries — its rule, the memory files it owns, the settings it
// declares, and, for a project agent, the whole of its `AGENT.md`.
//
// Everything here is a read or a write on files the rest of the board already owns. What is
// new is that they are answered TOGETHER: the pane opens once and gets the team, so a rule
// and a switch can never be drawn from two different moments.

import fs from 'node:fs'
import path from 'node:path'

import { agentRoster, ROLE_NAMES } from '../agent/roles'
import { readRule } from '../agent/rules'
import { specAgentEntries } from '../agent/settings'
import type { AgentView } from '../agent/types'
import { AGENTS, LEGACY_AGENTS, rel } from '../paths'
import { solution } from '../solution'
import type { WriteResult } from '../view/types'
import { agentFileReader, specAgentCatalog } from './catalog'
import { specAgentEnabled, specAgentSettings } from './index'
import { AGENT_NAME, parseSpecAgent } from './parse'
import type { SpecAgent } from './parse'

const AGENT_FILE = 'AGENT.md'

/** The team, and every reason an agent is missing from it. One read: the pane draws the
 *  grid and the page from this and asks for nothing else. */
export function readAgents(): { agents: AgentView[]; problems: string[] } {
  const { agents: specialists, problems } = specAgentCatalog()
  const entries = specAgentEntries()
  const byName = new Map(specialists.map((agent) => [agent.name, agent]))
  const agents = agentRoster().map((entry): AgentView => {
    const agent = byName.get(entry.name)
    return {
      name: entry.name,
      gloss: entry.gloss,
      when: entry.when,
      kind: entry.kind,
      builtIn: entry.builtIn,
      // A role runs the board's own flows, so there is nothing to switch off: a board
      // without a planner plans nothing.
      switchable: entry.kind !== 'role',
      enabled: entry.kind === 'role' || specAgentEnabled(entry.name, entries),
      rule: readRule(entry.name),
      memory: entry.memory,
      settings: agent ? settingsView(agent) : [],
      values: agent ? specAgentSettings(agent, entries).values : {},
      // A bundled agent's file ships inside the command, so there is nothing on disk to
      // point at or write back and its page shows no box.
      ...(agent && !agent.builtIn && agent.dir
        ? { file: { path: agent.from, text: agent.text ?? '' } }
        : {}),
    }
  })
  return { agents, problems }
}

// The settings an agent declares, as a dialog draws them — the same shape the spec agents'
// own list carries, minus the reference each choice loads, which is the run's business.
const settingsView = (agent: SpecAgent): AgentView['settings'] =>
  agent.settings.map((setting) => ({
    key: setting.key,
    label: setting.label,
    ...(setting.help ? { help: setting.help } : {}),
    choices: setting.choices.map((c) => ({ value: c.value, label: c.label, cost: c.cost })),
    default: setting.default,
  }))

// ---- adding one -------------------------------------------------------------

/** Write a new specialist from the template. The name is checked against everything this
 *  board already answers to and against the folders on disk BEFORE anything is written, so
 *  the pane never creates the clash it would then have to report as a problem.
 *
 *  The agent is created unwritten on purpose: its `description` and `owns` say so, so a
 *  planning flow reading the roster before the user has filled it in never picks it. */
export function createAgent(asked: string): WriteResult & { agent?: string } {
  const name = String(asked ?? '').trim().toLowerCase()
  if (!name) return { ok: false, error: 'an agent needs a name' }
  if (!AGENT_NAME.test(name)) {
    return { ok: false, error: `"${name}" is not a usable agent name — use lower-case words joined by "-"` }
  }
  if (ROLE_NAMES.includes(name)) {
    return { ok: false, error: `\`${name}\` is one of the roles the board ships. Pick another name.` }
  }
  if (specAgentCatalog().agents.some((agent) => agent.builtIn && agent.name === name)) {
    return { ok: false, error: `\`${name}\` is an agent the command ships. Pick another name.` }
  }
  for (const root of [AGENTS, LEGACY_AGENTS]) {
    const dir = path.join(root, name)
    if (fs.existsSync(dir)) return { ok: false, error: `${rel(dir)}/ is already there. Pick another name.` }
  }
  const file = path.join(AGENTS, name, AGENT_FILE)
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, agentTemplate(name))
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  return { ok: true, agent: name }
}

// The file a new specialist starts as. It parses — so the tile is in the roster rather than
// in the problems under it — and every line a flow would pick it by says it is unwritten.
//
// The hook is the one this board has: `spec` on a product board, where a specialist fills
// part of a card's spec, and `write` on a marketing one, where it joins the writer.
function agentTemplate(name: string): string {
  const kind = solution() === 'marketing' ? 'write' : 'spec'
  const owns =
    kind === 'write'
      ? 'unwritten — name the file this agent writes into a topic'
      : "unwritten — name the one part of a card's spec this agent answers for"
  return [
    '---',
    `name: ${name}`,
    'description: Unwritten — say here when a card needs this agent, and until you do the board asks for it on none.',
    'akb:',
    `  kind: ${kind}`,
    `  owns: ${owns}`,
    '---',
    '',
    `Unwritten. Write what \`${name}\` does here: what it is given, what it produces, and`,
    'what it must leave alone. It is read fresh on every run.',
    '',
  ].join('\n')
}

// ---- writing one ------------------------------------------------------------

/** Replace one project agent's `AGENT.md`, whole. The text is read the way the catalog
 *  reads an agent, and a save the catalog would refuse is refused HERE — otherwise the
 *  agent drops out of the roster into the problems list with no way back into it. */
export function saveAgentFile(name: string, text: string): WriteResult {
  const agent = specAgentCatalog().agents.find((a) => a.name === name)
  if (!agent) return { ok: false, error: `"${name}" is not an agent on this board.` }
  if (agent.builtIn || !agent.dir) {
    return { ok: false, error: `\`${name}\` ships inside the command, so its ${AGENT_FILE} is not this board's to edit.` }
  }
  const folder = path.basename(agent.dir)
  const read = parseSpecAgent(String(text ?? ''), agent.from, agentFileReader(agent.dir))
  if ('problem' in read) return { ok: false, error: read.problem }
  if (read.agent.name !== folder) {
    return {
      ok: false,
      error:
        `${agent.from}: its folder is \`${folder}\` but this calls it \`${read.agent.name}\`. ` +
        'An agent is asked for by its folder name — make the two match.',
    }
  }
  if (ROLE_NAMES.includes(read.agent.name)) {
    return {
      ok: false,
      error: `${agent.from}: \`${read.agent.name}\` is one of the roles the board ships, whose rule this agent would then share.`,
    }
  }
  try {
    // Back into the file it was read from, so a folder still using the old `SKILL.md` name
    // is edited in place rather than quietly doubled.
    fs.writeFileSync(path.join(agent.dir, path.basename(agent.from)), String(text))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
