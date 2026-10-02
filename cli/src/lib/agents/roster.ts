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

import { agentRun } from '../agent/resolve'
import { agentRoster, ROLE_NAMES } from '../agent/roles'
import { readRule } from '../agent/rules'
import { forgetWorkflowAgent, settleWorkflows } from '../agent/workflows'
import { forgetAgentRuntime, readAgentRuntime } from '../agent/runtimes'
import { configBlock, forgetSpecAgent, specAgentEntries, writeConfig } from '../agent/settings'
import type { AgentSlot, AgentView } from '../agent/types'
import { agentMemoryDir, legacyAgentMemoryFile } from '../memory'
import { AGENTS, LEGACY_AGENTS, rel, RULES } from '../paths'
import type { WriteResult } from '../view/types'
import { BUNDLED_AGENT_FILES } from './bundled'
import { agentFileReader, specAgentCatalog } from './catalog'
import { agentSettingsView, specAgentEnabled, specAgentSettings } from './index'
import { AGENT_NAME, parseSpecAgent } from './parse'

const AGENT_FILE = 'AGENT.md'

/** The team, and every reason an agent is missing from it. One read: the pane draws the
 *  grid and the page from this and asks for nothing else. */
export async function readAgents(): Promise<{ agents: AgentView[]; problems: string[] }> {
  const { agents: specialists, problems } = specAgentCatalog()
  const entries = specAgentEntries()
  const byName = new Map(specialists.map((agent) => [agent.name, agent]))
  const table = readAgentRuntime()
  const agents = agentRoster().map((entry): AgentView => {
    const agent = byName.get(entry.name)
    return {
      name: entry.name,
      title: entry.title,
      gloss: entry.gloss,
      kind: entry.kind,
      ...(entry.stage ? { stage: entry.stage } : {}),
      ...(entry.schedule ? { schedule: true } : {}),
      builtIn: entry.builtIn,
      // No role has a switch (#1208), and no workflow agent (#749) — only a specialist no
      // workflow reaches. An entry with no switch is on, whatever an older key still says.
      switchable: entry.switchable,
      enabled: !entry.switchable || specAgentEnabled(entry.name, entries),
      rule: readRule(entry.name),
      memory: entry.memory,
      settings: agent ? agentSettingsView(agent) : [],
      values: agent ? specAgentSettings(agent, entries).values : {},
      // The runtime it runs, read the way a run reads it (#467) — one row, carrying its
      // harness and its model.
      runs: agentRun(entry.name, table),
      // A bundled agent's file ships inside the command, so there is nothing on disk to
      // point at or write back and its page shows no box.
      ...(agent && !agent.builtIn && agent.dir
        ? { file: { path: agent.from, text: agent.text ?? '' } }
        : {}),
    }
  })
  return { agents, problems }
}

// ---- adding one -------------------------------------------------------------

/** Write a new specialist from the template. The name is checked against everything this
 *  board already answers to and against the folders on disk BEFORE anything is written, so
 *  the pane never creates the clash it would then have to report as a problem.
 *
 *  The agent is created unwritten on purpose: its `description` says so, so a
 *  planning flow reading the roster before the user has filled it in never picks it. */
export function createAgent(asked: string, stage?: AgentSlot): WriteResult & { agent?: string } {
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
  // So it starts in no workflow, for the one it is made in to take (#1095).
  settleWorkflows()
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, agentTemplate(name, stage))
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  return { ok: true, agent: name }
}

// The file a new specialist starts as. It parses — so the tile is in the roster rather than
// in the problems under it — and every line a flow would pick it by says it is unwritten.
//
// It starts as a hook on the stage it was made for, or on `plan` when made for none.
//
// Every other key is one line pointing at `akb guide write-agent` (#935): the constraints —
// what a `reference` has to be — belong in the guide, not
// in a template nobody has read yet.
function agentTemplate(name: string, stage?: AgentSlot): string {
  return [
    '---',
    `name: ${name}`,
    'description: Unwritten — say here when a card needs this agent, and until you do the board asks for it on none.',
    'akb:',
    `  hook: ${stage ?? 'plan'}`,
    '  # `lead` in place of `hook`, output and i18n: `akb guide write-agent`',
    '---',
    '',
    `Unwritten. Write what \`${name}\` does here: what it is given, what it produces, and`,
    'what it must leave alone. It is read fresh on every run.',
    '',
  ].join('\n')
}

// ---- copying one (#1095) ------------------------------------------------------

/** Copy one agent to a free name, as a project agent: its files, rule, memory, settings and
 *  runtime. A workflow never shares an agent, so a duplicated workflow gets copies. `taken`
 *  holds names already handed out in the same pass. */
export function copyAgent(from: string, taken: Set<string> = new Set()): WriteResult & { agent?: string } {
  const catalog = specAgentCatalog().agents
  const agent = catalog.find((a) => a.name === from)
  if (!agent) return { ok: false, error: `"${from}" is not an agent on this board.` }
  const free = (name: string) =>
    !taken.has(name) &&
    !ROLE_NAMES.includes(name) &&
    !catalog.some((a) => a.name === name) &&
    ![AGENTS, LEGACY_AGENTS].some((root) => fs.existsSync(path.join(root, name)))
  const base = from.replace(/-\d+$/, '')
  let name = ''
  for (let n = 2; !name; n++) if (free(`${base}-${n}`)) name = `${base}-${n}`
  taken.add(name)
  const dir = path.join(AGENTS, name)
  try {
    if (agent.dir) fs.cpSync(agent.dir, dir, { recursive: true })
    else {
      for (const [key, text] of Object.entries(BUNDLED_AGENT_FILES)) {
        if (!key.startsWith(`${from}/`)) continue
        const file = path.join(dir, key.slice(from.length + 1))
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, text)
      }
    }
    const file = path.join(dir, agent.dir ? path.basename(agent.from) : AGENT_FILE)
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/^name:.*$/m, `name: ${name}`))
    const rule = path.join(RULES, `${from}.md`)
    if (fs.existsSync(rule)) fs.copyFileSync(rule, path.join(RULES, `${name}.md`))
    if (fs.existsSync(agentMemoryDir(from))) fs.cpSync(agentMemoryDir(from), agentMemoryDir(name), { recursive: true })
  } catch (err) {
    fs.rmSync(dir, { recursive: true, force: true })
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  writeConfig((cfg) => {
    for (const key of ['specAgents', 'agentRuntime']) {
      const block = configBlock(cfg[key])
      if (block[from] === undefined) continue
      block[name] = structuredClone(block[from])
      cfg[key] = block
    }
  })
  return { ok: true, agent: name }
}

// ---- removing one -----------------------------------------------------------

/** Delete one project agent, and everything the board kept for it: its folder, the rule
 *  written for it, what it remembered, and its entry in `ui.config.json`.
 *
 *  Only an agent this project added. A role runs the board's own flows and a bundled agent
 *  ships inside the command — neither has a folder here to remove, and an entry in the
 *  config would come straight back on the next read.
 *
 *  Everything it leaves is reported board-relative, so the pane can say what went rather
 *  than only that something did. A file already gone is not an error: the point of the move
 *  is that none of them are there afterwards. */
export function deleteAgent(name: string): WriteResult & { removed?: string[] } {
  const agent = specAgentCatalog().agents.find((a) => a.name === name)
  if (!agent) return { ok: false, error: `"${name}" is not an agent on this board.` }
  if (agent.builtIn || !agent.dir) {
    return { ok: false, error: `\`${name}\` ships inside the command, so it is not this board's to delete.` }
  }
  const removed: string[] = []
  try {
    for (const file of [agent.dir, path.join(RULES, `${name}.md`), agentMemoryDir(name), legacyAgentMemoryFile(name)]) {
      if (!fs.existsSync(file)) continue
      fs.rmSync(file, { recursive: true, force: true })
      removed.push(rel(file))
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  // Last, and never fatal: the folder is gone, so the agent is gone whatever the config
  // says, and refusing here would leave the pane reporting a failure it cannot undo.
  forgetSpecAgent(name)
  forgetAgentRuntime(name)
  forgetWorkflowAgent(name)
  return { ok: true, removed }
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
