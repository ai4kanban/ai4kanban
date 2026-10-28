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
import { forgetFileMemos } from '../file-memo'

import { ROLE_NAMES } from '../agent/roles'
import { forgetWorkflowAgent, landAgents, previewAgents, scheduledMembers, workflows } from '../agent/workflows'
import { forgetAgentRuntime } from '../agent/runtimes'
import { configBlock, forgetSpecAgent, writeConfig } from '../agent/settings'
import { agentMemoryDir, legacyAgentMemoryFile } from '../memory'
import { AGENTS, LEGACY_AGENTS, rel, RULES } from '../paths'
import type { WriteResult } from '../view/types'
import { BUNDLED_AGENT_FILES } from './bundled'
import { specAgentCatalog } from './catalog'

const AGENT_FILE = 'AGENT.md'

// ---- the project's own agents (#1471) ------------------------------------------

const projectAgents = () => specAgentCatalog().agents.filter((agent) => !agent.builtIn && agent.dir)

/** Whether a run's agent is one the project added rather than one the board ships. */
export const isCustomAgent = (name: string | undefined): boolean =>
  !!name && projectAgents().some((agent) => agent.name === name)

/** The project's own agents that are on: on means some workflow runs it. */
export function customAgentsOn(): string[] {
  const running = new Set<string>()
  for (const flow of workflows()) {
    for (const h of [...previewAgents(flow), ...landAgents(flow)]) running.add(h.agent)
    for (const scheduled of scheduledMembers(flow)) if (!scheduled.off) running.add(scheduled.agent)
  }
  return projectAgents().filter((agent) => running.has(agent.name)).map((agent) => agent.name)
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

/** Point the `after` of agents copied together at each other's copies (#2154), so a copied
 *  workflow keeps its approvals. `copied` maps each original to its copy. */
export function renameCopiedAfter(copied: Map<string, string>): void {
  const rename = (list: string): string => list.replace(/[\w-]+/g, (name) => copied.get(name) ?? name)
  for (const copy of copied.values()) {
    const file = [AGENT_FILE, 'SKILL.md'].map((f) => path.join(AGENTS, copy, f)).find((f) => fs.existsSync(f))
    if (!file) continue
    const text = fs.readFileSync(file, 'utf8')
    const next = text
      .replace(/^(\s+after:\s*)\[(.*)\]\s*$/m, (_, key: string, list: string) => `${key}[${rename(list)}]`)
      .replace(/^(\s+after:\s*\n)((?:\s+-\s+.*\n)+)/m, (_, key: string, items: string) => key + rename(items))
    if (next !== text) fs.writeFileSync(file, next)
  }
  forgetFileMemos()
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
    forgetFileMemos()
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
