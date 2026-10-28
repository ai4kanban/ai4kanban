// docs/kanban/.local.json — what a board used to keep per computer.
//
// Between #443 and #467 it held each agent's model, keyed by agent and then by harness. A
// runtime carries its model now (./runtimes.ts), so nothing is written here any more: the
// upgrade lifts what it finds into runtimes and clears the block behind it.
//
// The file itself stays known, because boards already have one: it keeps its line in the
// board's own .gitignore, and an update reads it once.

import fs from 'node:fs'
import path from 'node:path'

import { configBlock } from './settings'

/** The line the board's .gitignore carries for this file. */
export const LOCAL_IGNORE_LINE = '.local.json'

/** What one board's `.local.json` held, by agent and then by harness — the models #467 turns
 *  into runtimes — and the block cleared behind it, so a second update finds nothing.
 *
 *  It works on an explicit board folder because `akb update` repairs the board it was pointed
 *  at rather than the one this process resolved (commands/install.ts). */
export function takeLocalModels(board: string): Record<string, Record<string, Record<string, string>>> {
  const file = path.join(board, '.local.json')
  let held: Record<string, unknown>
  try {
    held = configBlock(JSON.parse(fs.readFileSync(file, 'utf8')) as unknown)
  } catch {
    return {} // no file, or one nothing can read — an update never rewrites either
  }
  const agents = configBlock(held.agents)
  const out: Record<string, Record<string, Record<string, string>>> = {}
  for (const [agent, byHarness] of Object.entries(agents)) {
    for (const [harness, block] of Object.entries(configBlock(byHarness))) {
      const values: Record<string, string> = {}
      for (const [key, value] of Object.entries(configBlock(block))) {
        if (typeof value === 'string' && value.trim()) values[key] = value.trim()
      }
      if (!Object.keys(values).length) continue
      out[agent] = { ...out[agent], [harness]: values }
    }
  }
  if (!Object.keys(agents).length) return out
  delete held.agents
  fs.writeFileSync(file, JSON.stringify(held, null, 2) + '\n')
  return out
}
