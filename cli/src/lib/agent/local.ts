// What each agent runs its model as, on THIS computer (#443).
//
//   docs/kanban/.local.json
//   {
//     "agents": {
//       "builder": { "codex": { "model": "gpt-5.1-codex", "reasoning": "high" } },
//       "planner": { "claude-code": { "model": "claude-opus-5" } }
//     }
//   }
//
// The harness an agent runs is the BOARD's, in ui.config.json, so it travels with the
// repository. The settings that PICK A MODEL are this machine's: a model id is worth
// nothing on a computer whose CLI has never been logged into that provider, and the keys
// behind it already live per machine in docs/kanban/.env.
//
// Keyed by agent first and by harness second, so switching an agent to another tool and back
// finds its model where it left it. Which settings land here rather than in ui.config.json is
// the harness's own answer — `agentOwned` on `HarnessSetting` — so a new connector says it
// once, in its own file.
//
// Dotted and in the board's own .gitignore, the same treatment .env and .sessions.json get.

import fs from 'node:fs'
import path from 'node:path'

import { LOCAL_CONFIG } from '../paths'
import { configBlock } from './settings'

/** The line the board's .gitignore carries for this file. */
export const LOCAL_IGNORE_LINE = '.local.json'

/** The whole file, or nothing when it is missing or won't parse. A machine setting nobody
 *  can read is not a reason to stop a run: the agents fall back to their harness's own
 *  defaults, which is what an unset model already means. */
function readLocal(file = LOCAL_CONFIG): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'))
    return configBlock(parsed)
  } catch {
    return {}
  }
}

/** What one agent has picked for one harness — only the keys the file carries, so a setting
 *  nobody chose is absent and the harness runs its own default. */
export function localAgentValues(agent: string | undefined, harness: string): Record<string, string> {
  if (!agent) return {}
  const block = configBlock(configBlock(configBlock(readLocal().agents)[agent])[harness])
  const values: Record<string, string> = {}
  for (const [key, value] of Object.entries(block)) {
    if (typeof value === 'string' && value.trim()) values[key] = value.trim()
  }
  return values
}

/** Every agent this file says something about — what `akb agent` reads to say which of them
 *  have a model of their own on this computer. */
export function localAgentNames(): string[] {
  return Object.keys(configBlock(readLocal().agents))
}

/** Save one of an agent's model settings, for the harness it is running. An empty value drops
 *  the key, which is how a setting goes back to the harness's own default; an agent or a
 *  harness left with nothing goes too, so clearing never leaves an empty husk behind. */
export function setLocalAgentValue(
  agent: string,
  harness: string,
  key: string,
  value: string,
): { ok: boolean; error?: string } {
  return writeLocal((cfg) => {
    const agents = { ...configBlock(cfg.agents) }
    const byHarness = { ...configBlock(agents[agent]) }
    const block = { ...configBlock(byHarness[harness]) }
    const next = value.trim()
    if (next) block[key] = next
    else delete block[key]
    if (Object.keys(block).length) byHarness[harness] = block
    else delete byHarness[harness]
    if (Object.keys(byHarness).length) agents[agent] = byHarness
    else delete agents[agent]
    if (Object.keys(agents).length) cfg.agents = agents
    else delete cfg.agents
  })
}

/** Drop everything one agent picked, on every harness. Called when the agent itself is
 *  deleted: a model saved for an agent nobody has is a line the user can neither read nor
 *  reach. */
export function forgetLocalAgent(agent: string, legacyNames: string[] = []): { ok: boolean; error?: string } {
  return writeLocal((cfg) => {
    const agents = { ...configBlock(cfg.agents) }
    for (const name of [agent, ...legacyNames]) delete agents[name]
    if (Object.keys(agents).length) cfg.agents = agents
    else delete cfg.agents
  })
}

// Read, change, write — the shared body of every setter. A file that won't parse is
// overwritten rather than refused, unlike ui.config.json: this one is written by the board
// alone and holds nothing the user typed into a file by hand.
function writeLocal(change: (cfg: Record<string, unknown>) => void): { ok: boolean; error?: string } {
  const cfg = readLocal()
  change(cfg)
  try {
    fs.mkdirSync(path.dirname(LOCAL_CONFIG), { recursive: true })
    fs.writeFileSync(LOCAL_CONFIG, JSON.stringify(cfg, null, 2) + '\n')
    return { ok: true }
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `couldn't write ${LOCAL_CONFIG}: ${why}` }
  }
}

// ---- moving an older board's models here (#443) -----------------------------
//
// Before this, a model was the board's: one value per harness in `harnessSettings`,
// committed and shared by every checkout. `akb update` moves those values here once, written
// under every agent this board has, so runs on THIS computer go on using exactly the model
// they used before. Then it deletes them from ui.config.json — which is the one write in the
// whole board that rewrites the user's config file, and the reason it happens on update
// rather than on a read.
//
// It runs on an explicit board folder because `akb update` repairs a board it was pointed at
// rather than the one this process resolved (commands/install.ts).

/** Move every agent-owned setting out of `harnessSettings` and into `.local.json`, under each
 *  of `agents`. Returns the line an update reports, or null when there was nothing to move —
 *  which is every board updated twice, since the keys are gone after the first run. */
export function moveModelsLocal(
  board: string,
  agents: string[],
  agentOwned: (harness: string, key: string) => boolean,
): string | null {
  const uiConfig = path.join(board, 'ui.config.json')
  let cfg: Record<string, unknown>
  try {
    cfg = configBlock(JSON.parse(fs.readFileSync(uiConfig, 'utf8')) as unknown)
  } catch {
    return null // no config, or one nothing can read — an update never rewrites either
  }
  const blocks = { ...configBlock(cfg.harnessSettings) }
  // What each harness had set, and what is left of its block once those keys are taken out.
  const moved: Record<string, Record<string, string>> = {}
  for (const [harness, value] of Object.entries(blocks)) {
    const block = { ...configBlock(value) }
    const mine: Record<string, string> = {}
    for (const [key, v] of Object.entries(block)) {
      if (typeof v !== 'string' || !v.trim() || !agentOwned(harness, key)) continue
      mine[key] = v.trim()
      delete block[key]
    }
    if (!Object.keys(mine).length) continue
    moved[harness] = mine
    if (Object.keys(block).length) blocks[harness] = block
    else delete blocks[harness]
  }
  if (!Object.keys(moved).length) return null

  const local = path.join(board, '.local.json')
  const held = readLocal(local)
  const saved = { ...configBlock(held.agents) }
  for (const agent of agents) {
    const byHarness = { ...configBlock(saved[agent]) }
    for (const [harness, values] of Object.entries(moved)) {
      // Whatever this computer already picked for the agent wins: the move fills in what is
      // missing, and never writes over an answer somebody gave here.
      byHarness[harness] = { ...values, ...configBlock(byHarness[harness]) }
    }
    saved[agent] = byHarness
  }
  held.agents = saved
  fs.writeFileSync(local, JSON.stringify(held, null, 2) + '\n')

  if (Object.keys(blocks).length) cfg.harnessSettings = blocks
  else delete cfg.harnessSettings
  fs.writeFileSync(uiConfig, JSON.stringify(cfg, null, 2) + '\n')

  const names = Object.keys(moved).join(', ')
  return `moved the models set for ${names} into docs/kanban/.local.json, under every agent — they are this computer's now, and the other checkouts start empty`
}
