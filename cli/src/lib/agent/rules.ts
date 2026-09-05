// One rule per agent, in the user's own words (#306, #420).
//
// Every board wants something slightly different from a flow — run these tests before
// landing, install dependencies this way, ask a second model. The flows themselves ship
// inside the command, so a convention a project depends on had nowhere to live. A rule is
// plain words appended to the END of a run's built-in prompt, after everything else the
// board writes into it, so nothing of the board's follows the user's words. It is not a
// command the board runs: what it actually causes is up to the agent reading it.
//
// The rule is the AGENT's, not the flow's. Every flow the board starts is run by a role
// (./roles.ts) and every specialist is asked for by name, so `docs/kanban/rules/builder.md`
// reaches `implement`, `conflict` and `run` alike — one sentence, written once, and the
// product can say who is being trained. Boards written before this keyed their rules by
// flow; `migrateFlowRules` below folds those files into their role's, once.
//
// The files are versioned in git so a team shares them, and they are inside docs/kanban/,
// which every delivery worktree leaves out — which is why a run is given the WORDS and
// never the path.
//
// Nothing is created up front: a missing or empty file means the run goes unchanged.

import fs from 'node:fs'
import path from 'node:path'

import { rel, RULES } from '../paths'
import { canonicalSpecAgent } from '../spec-agent-names'
import type { WriteResult } from '../view/types'
import { DELIVERY_FLOWS, FLOWS, flowByAction, flowByCommand, flowPath, type Flow } from './flows'
import { agentNames, roleForFlow, roleFlowsInOrder, roles, type AgentRole } from './roles'
import { REFINE_ACTIONS, SPECIALIST_ACTIONS } from './types'
import type { AgentRequest, FlowRuleView } from './types'

const rulePath = (agent: string): string => path.join(RULES, `${agent}.md`)

// One file, as it stands. No migration behind it: the migration itself reads this way.
function ruleFile(agent: string): string {
  if (!agent) return ''
  try {
    return fs.readFileSync(rulePath(agent), 'utf8').trim()
  } catch {
    return ''
  }
}

/** One agent's rule as it stands on disk — empty when there is no file, it can't be read,
 *  or it holds nothing but whitespace. `agent` is a role or a specialist's name. */
export function readRule(agent: string): string {
  migrateFlowRules()
  return ruleFile(agent)
}

/** Save one agent's rule. An empty rule deletes the file rather than leaving a blank one
 *  behind: an agent with no rule and an agent with an empty rule are the same agent. */
export function setAgentRule(agent: string, text: string): WriteResult {
  migrateFlowRules()
  if (!agentNames().includes(agent)) return { ok: false, error: notOnTheRoster(agent) }
  const rule = String(text ?? '').trim()
  try {
    if (!rule) {
      fs.rmSync(rulePath(agent), { force: true })
      return { ok: true }
    }
    fs.mkdirSync(RULES, { recursive: true })
    fs.writeFileSync(rulePath(agent), `${rule}\n`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Why a name is not one this board can be given a rule for, and what it does answer to.
 *  Not `lib/agents`' `notAnAgent`, which answers for the spec hook alone. */
export const notOnTheRoster = (name: string): string =>
  `"${name}" is not an agent on this board. It has: ${agentNames().join(', ')}.`

/** Save the rule of the agent that runs one flow — the older, per-flow door, kept while the
 *  board UI still draws a row per flow. It writes that flow's ROLE, so the two rows for the
 *  flows beside it read the same rule afterwards. */
export function setFlowRule(command: string, text: string): WriteResult {
  if (!flowByCommand(command)) return { ok: false, error: `no flow is started by \`akb ${command}\`` }
  const role = roleForFlow(command)
  if (!role) return { ok: false, error: `no agent on this board runs \`akb ${command}\`` }
  return setAgentRule(role.name, text)
}

/** Every flow the board has, with the rule its agent carries — what the Rules pane draws.
 *  The list is the board's own, so a flow shipped later appears here without further work. */
export function readFlowRules(): FlowRuleView[] {
  migrateFlowRules()
  return FLOWS.map((flow) => ({
    command: flow.command,
    path: flowPath(flow),
    gloss: flow.gloss,
    note: flow.ruleNote,
    rule: ruleFile(roleForFlow(flow.command)?.name ?? ''),
  }))
}

/** The rules a delivery freezes when it starts, keyed by the AGENT that carries each: the
 *  agents a delivery's flows are run by, read once, the way it reads the card it was
 *  approved to build. Editing a rule afterwards changes the next delivery, never one in
 *  flight. */
export function deliveryRules(): Record<string, string> {
  migrateFlowRules()
  const rules: Record<string, string> = {}
  for (const flow of FLOWS) {
    if (flow.action === 'refine' || !DELIVERY_FLOWS.has(flow.action)) continue
    const role = roleForFlow(flow.command)
    if (!role || rules[role.name] !== undefined) continue
    const rule = ruleFile(role.name)
    if (rule) rules[role.name] = rule
  }
  return rules
}

// Which flow a run belongs to. A refinement pass is part of the composite `refine` flow, so
// every pass in it reads the same rule.
const flowForRequest = (req: AgentRequest): Flow | undefined =>
  req.refineRound !== undefined && REFINE_ACTIONS.has(req.action)
    ? flowByCommand('refine')
    : flowByAction(req.action)

// Whose rule a run reads: the specialist it IS on a `spec` or `write` run, and the role that
// runs its flow otherwise. `flow` is what a delivery frozen before rules were keyed by agent
// holds.
interface RuleOwner {
  name: string
  role?: AgentRole
  flow?: string
}

function ownerOf(req: AgentRequest): RuleOwner | null {
  if (SPECIALIST_ACTIONS.has(req.action)) {
    const name = canonicalSpecAgent(req.specAgent ?? '')
    return name ? { name } : null
  }
  // `akb channel` is the writer's work and is not a flow a person types under `akb card`,
  // so it names itself here.
  const flow = req.action === 'channel' ? 'channel' : flowForRequest(req)?.command
  const role = roleForFlow(flow ?? '')
  return role ? { name: role.name, role, flow } : null
}

/** The rule one run is given: the delivery's frozen copy when the run is part of one, and
 *  the file otherwise.
 *
 *  `frozen` is the caller's read of the delivery in flight — the caller's, because a
 *  delivery reads its rules from here and would otherwise read them through itself. A
 *  build that OPENS a delivery has none: the delivery does not exist yet, and the copy it
 *  is about to freeze is this same read. A run whose action has no agent has no rule. */
export function ruleFor(req: AgentRequest, frozen?: Record<string, string>): string {
  const owner = ownerOf(req)
  if (!owner) return ''
  // A delivery started before rules were keyed by agent froze them by flow (#420) — read
  // under both, so a build in flight keeps the rules it was approved with.
  if (frozen && DELIVERY_FLOWS.has(req.action)) return frozen[owner.name] ?? frozen[owner.flow ?? ''] ?? ''
  return readRule(owner.name)
}

/** Whose rule a run reads, as a caption says it out loud: the agent's name, and whether the
 *  rule carries across every flow that agent runs — it does for a role, and a specialist has
 *  no flows. The ask and a printed flow both name it, so they name it the same way. */
export function ruleOwner(req: AgentRequest): { name: string; role: boolean } | null {
  const owner = ownerOf(req)
  return owner ? { name: owner.name, role: Boolean(owner.role) } : null
}

/** How a caption names the agent whose rule follows — the clause both say, without the
 *  "this board's" each one leads with in its own case. */
export const ruleOwnerSays = (owner: { name: string; role: boolean }): string =>
  `\`${owner.name}\` agent carries one rule of its own${owner.role ? ', on every flow it runs' : ''}`

/** The rule as a run is given it: the user's words, and one line of the board's before them
 *  saying whose they are. Empty when the agent has no rule. */
export function ruleBlock(req: AgentRequest, frozen?: Record<string, string>): string {
  const rule = ruleFor(req, frozen)
  if (!rule) return ''
  return [
    `This board's ${ruleOwnerSays(ruleOwner(req)!)}. It is the user's, it applies here, and nothing of the board's follows it:`,
    rule,
  ].join('\n\n')
}

// ---- the one-time move onto the agents (#420) -------------------------------
//
// A board written before this keyed its rules by flow: `implement.md`, `conflict.md`,
// `run.md`. They fold into their role's file in flow order and are deleted, once, on the
// first read after the upgrade — reported in the run log rather than done in silence, since
// what the user typed is now appended to two flows more than it was.
//
// Only the roles of THIS board's solution are folded, and only files named after a flow the
// role runs, so nothing else in the folder is touched.

/** Fold any per-flow rule files into their role's. One line per role it rewrote, empty when
 *  there was nothing to move — which is every call after the first. */
export function migrateFlowRules(): string[] {
  let here: Set<string>
  try {
    here = new Set(fs.readdirSync(RULES))
  } catch {
    return []
  }
  const notes: string[] = []
  for (const role of roles()) {
    const from = roleFlowsInOrder(role).filter((flow) => flow !== role.name && here.has(`${flow}.md`))
    if (!from.length) continue
    const parts = [ruleFile(role.name), ...from.map(ruleFile)].filter(Boolean)
    try {
      if (parts.length) fs.writeFileSync(rulePath(role.name), `${parts.join('\n\n')}\n`)
      for (const flow of from) fs.rmSync(rulePath(flow), { force: true })
    } catch (err) {
      notes.push(`could not move the ${from.join(', ')} rule(s) onto \`${role.name}\`: ${String(err)}`)
      continue
    }
    notes.push(
      `a rule is one per agent now: ${from.map((f) => `${f}.md`).join(', ')} ` +
        `${from.length === 1 ? 'is' : 'are'} ${rel(rulePath(role.name))}, which every flow the ` +
        `\`${role.name}\` runs reads.`,
    )
  }
  return notes
}
