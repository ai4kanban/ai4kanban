// Declared dependencies between spec agents on one card (#782).
//
// A guardrail at start, nothing more: an agent whose `akb.dependencies` names another agent
// that is on this card but not ready is refused, with the reason. Nothing is queued, ordered,
// retried or asked for — the planner reads the reason and asks again.

import { findSpecAgent, specAgents, specSection } from '../agents'
import { findCard } from '../view/read'
import type { Card } from '../view/types'
import { readSpecAsks } from './sessions'
import { readRuns, runIsLive } from './store'
import type { RunRecord } from './types'

export interface DependencyScope {
  /** Spec agents asked for in this round and not started yet. */
  queued?: string[]
  /** The run doing the asking — its own record and asks are not someone else's update. */
  self?: string
  /** Agents this round will ask for before this one; they are checked when it starts. */
  deferred?: string[]
}

/** Why `agent` may not start on this card now, or null when nothing it depends on is in the
 *  way. */
export function dependencyRefusal(cardId: number, agentName: string, scope: DependencyScope = {}): string | null {
  const agent = findSpecAgent(agentName)
  if (!agent?.dependencies.length) return null
  let card: Card | null
  try {
    card = findCard(cardId)
  } catch {
    return null
  }
  if (!card) return null

  const runs = readRuns().filter((r) => r.action === 'spec' && r.cardId === cardId && r.sessionId !== scope.self)
  const pending = new Set(scope.queued ?? [])
  for (const run of readRuns()) {
    if (run.sessionId === scope.self || !runIsLive(run)) continue
    for (const ask of readSpecAsks(run.sessionId)) if (ask.cardId === cardId) pending.add(ask.specAgent)
  }
  const joined = (name: string): boolean =>
    pending.has(name) ||
    runs.some((r) => r.specAgent === name) ||
    specSection(card.body, name) !== null ||
    card.questions.some((q) => q.agent === name)

  const cycle = cycleThrough(agent.name, joined)
  if (cycle) {
    return `\`${agent.name}\` can't start on #${cardId}: its dependencies loop back to it (${cycle.join(' → ')}). Remove one of them from \`akb.dependencies\`.`
  }

  const reasons = agent.dependencies
    .filter((dep) => joined(dep) && !scope.deferred?.includes(dep))
    .flatMap((dep) => {
      const why = notReady(dep, card, runs, pending)
      return why ? [`\`${dep}\` ${why}`] : []
    })
  if (!reasons.length) return null
  return `\`${agent.name}\` can't start on #${cardId} yet: ${reasons.join('; ')}. Nothing was started — ask for \`${agent.name}\` again once that is settled.`
}

function notReady(dep: string, card: Card, runs: RunRecord[], pending: Set<string>): string | null {
  const own = runs.filter((r) => r.specAgent === dep)
  if (own.some(runIsLive)) return 'is still updating its section'
  if (pending.has(dep)) return 'has an update waiting to run'
  const last = own.reduce<RunRecord | null>((a, b) => (!a || b.startedAt > a.startedAt ? b : a), null)
  if (last && last.status !== 'done' && last.status !== 'running') {
    const how = last.status === 'error' ? 'failed' : last.status === 'interrupted' ? 'was cut off' : 'was stopped'
    return `did not finish its last run (it ${how})`
  }
  if (!specSection(card.body, dep)) return 'has not written its section yet'
  if (card.questions.some((q) => q.agent === dep)) return 'has an open question waiting for the user'
  return null
}

// A path from `start` through the dependencies of agents on this card back to `start`.
function cycleThrough(start: string, joined: (name: string) => boolean): string[] | null {
  const deps = new Map(specAgents().map((a) => [a.name, a.dependencies]))
  const seen = new Set<string>()
  const walk = (name: string, path: string[]): string[] | null => {
    for (const dep of deps.get(name) ?? []) {
      if (dep === start) return [...path, dep]
      if (seen.has(dep) || !joined(dep)) continue
      seen.add(dep)
      const found = walk(dep, [...path, dep])
      if (found) return found
    }
    return null
  }
  return walk(start, [start])
}
