// The roles the board ships — the agents its own flows are run by (#420).
//
// Every flow the board starts is run by a named agent. The specialists a card asks for are
// files a project writes (lib/agents/); the flows the command ships are these, written here
// because nothing about them is a project's to change: which flows the builder runs is what
// the command does.
//
// A role is a name, one line, the flows it runs and the memory files it owns. It exists so
// a rule is written once per AGENT rather than once per flow (./rules.ts): telling the
// builder one thing used to mean writing the same sentence into `implement.md`,
// `conflict.md` and `run.md`, and nothing in the product said who was being trained.
//
// The set is per solution. A `product` board builds code, so it has a Builder; a
// `marketing` board writes drafts, so the same flows belong to a Writer, which also runs
// the repurpose `akb channel` starts. Planner and Reviewer are the same work either way.

import { specAgentCatalog } from '../agents/catalog'
import { solution } from '../solution'
import { FLOWS } from './flows'
import type { AgentKind } from '../agents/parse'

/** One role: an agent the board ships, named by the work rather than by a flow. */
export interface AgentRole {
  /** Its name — the rule file it carries, and the word `akb raw rule` takes. */
  name: string
  /** One clause of plain words: what it does, for a roster. */
  gloss: string
  /** The flows it runs, by flow name (./flows.ts). `channel` is in the writer's list and is
   *  not one of them: it is an action `akb channel` starts, and it is still the writer's
   *  work, so the writer's rule reaches it. */
  flows: string[]
  /** The memory files it owns, board-relative. Nothing moves — these are the files its own
   *  flows already write, listed so a roster can say what a role remembers. */
  memory: string[]
}

// Planning is the same work on either solution: the flows that write a card, settle it and
// close it out.
const PLANNER_FLOWS = [
  'propose',
  'create',
  'refine',
  'resolve',
  'revise',
  'plan-release',
  'changelog',
  'archive',
  'reject',
  'setup',
]

const REVIEWER: AgentRole = {
  name: 'reviewer',
  gloss: 'checks what was built',
  flows: ['review'],
  memory: [],
}

const PRODUCT_ROLES: AgentRole[] = [
  {
    name: 'planner',
    gloss: 'plans and refines cards',
    flows: PLANNER_FLOWS,
    memory: ['memory/decisions.md', 'memory/rejected.md', 'memory/goal.md'],
  },
  {
    name: 'builder',
    gloss: 'builds them and lands them',
    flows: ['implement', 'conflict', 'run'],
    memory: ['memory/readme.md', 'memory/redesign.md', 'modules.md'],
  },
  REVIEWER,
]

const MARKETING_ROLES: AgentRole[] = [
  {
    name: 'planner',
    gloss: 'plans and refines topics',
    flows: PLANNER_FLOWS,
    memory: ['memory/decisions.md', 'memory/rejected.md', 'memory/published.md'],
  },
  {
    name: 'writer',
    gloss: 'writes the drafts and repurposes them',
    flows: ['implement', 'conflict', 'run', 'channel'],
    memory: ['memory/writing.md', 'memory/writing/'],
  },
  REVIEWER,
]

/** Every role name the board ships, on either solution. Reserved: a rule is keyed by the
 *  agent's name, so a project agent taking one would share that role's rule file
 *  (../agents/catalog.ts refuses it). */
export const ROLE_NAMES: string[] = [...new Set([...PRODUCT_ROLES, ...MARKETING_ROLES].map((r) => r.name))]

/** This board's roles, in the order a roster draws them. */
export const roles = (): AgentRole[] => (solution() === 'marketing' ? MARKETING_ROLES : PRODUCT_ROLES)

/** The role that runs one flow, by flow name. Every flow the board has belongs to exactly
 *  one, so a rule written for a role reaches every flow it runs and no other. */
export const roleForFlow = (flow: string): AgentRole | undefined =>
  flow ? roles().find((role) => role.flows.includes(flow)) : undefined

/** The role of a given name. */
export const roleNamed = (name: string): AgentRole | undefined => roles().find((role) => role.name === name)

/** The flows a role runs, in the order the board declares them (./flows.ts). What the
 *  one-time rule migration concatenates in. */
export function roleFlowsInOrder(role: AgentRole): string[] {
  const order = FLOWS.map((flow) => flow.command)
  return [...role.flows].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

// ---- the roster ------------------------------------------------------------

/** One agent as a roster reads it — a role, or one of the specialists a card asks for. */
export interface RosterEntry {
  name: string
  /** A role's line, or a specialist's own description. */
  gloss: string
  /** `role` for one of the board's own; otherwise the hook the specialist plugs into. */
  kind: 'role' | AgentKind
  /** Whether the command ships it, as opposed to the project adding it. */
  builtIn: boolean
  /** A role's flows. Empty on a specialist: it is asked for by name, never by a flow. */
  flows: string[]
  /** The memory files it owns, board-relative. */
  memory: string[]
}

/** Every agent this board has, in the board's order: the roles first, then the specialists
 *  the command ships, then the ones the project added. One list, so `akb raw rule` and the
 *  Agents pane name the same team. */
export function agentRoster(): RosterEntry[] {
  const specialists = specAgentCatalog().agents.map((agent) => ({
    name: agent.name,
    gloss: agent.description,
    kind: agent.kind,
    builtIn: agent.builtIn,
    flows: [],
    memory: [],
  }))
  return [
    ...roles().map((role) => ({
      name: role.name,
      gloss: role.gloss,
      kind: 'role' as const,
      builtIn: true,
      flows: role.flows,
      memory: role.memory,
    })),
    ...specialists.filter((a) => a.builtIn),
    ...specialists.filter((a) => !a.builtIn),
  ]
}

/** The names this board answers to, in that order — what a refusal lists. */
export const agentNames = (): string[] => agentRoster().map((entry) => entry.name)
