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

import { forgetWorkflowAgent, landAgents, previewAgents, scheduledMembers, workflows } from '../agent/workflows'
import { forgetAgentRuntime } from '../agent/runtimes'
import { forgetSpecAgent } from '../agent/settings'
import { agentMemoryDir, legacyAgentMemoryFile } from '../memory'
import { rel, RULES } from '../paths'
import type { WriteResult } from '../view/types'
import { specAgentCatalog } from './catalog'

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
