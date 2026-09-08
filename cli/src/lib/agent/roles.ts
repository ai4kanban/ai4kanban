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
// the repurpose `akb channel` starts and the polish a batch of comments asks for. Discussion
// helper, Planner and Reviewer are the same work either way.

import path from 'node:path'

import { specAgentCatalog } from '../agents/catalog'
import { agentLines } from '../agents'
import { agentMemoryFiles } from '../memory'
import { KANBAN, rel } from '../paths'
import { solution } from '../solution'
import { FLOWS } from './flows'
import type { RoleSwitch } from './settings'
import type { AgentKind } from '../agents/parse'

/** One role: an agent the board ships, named by the work rather than by a flow. */
export interface AgentRole {
  /** Its name — the rule file it carries, and the word `akb raw rule` takes. */
  name: string
  /** The key in `ui.config.json` this role is switched on under, when it can be switched
   *  off at all (#447, #493). Almost none can: a board without a planner plans nothing. The
   *  two that can stand in for the user rather than doing a flow's work — the gater judges
   *  a card the way you would, the decider answers what you would have answered — so each
   *  is off until you ask for it, and each reads its own key. */
  switch?: RoleSwitch
  /** One clause of plain words: what it does, for a roster. */
  gloss: string
  /** The flows it runs, by flow name (./flows.ts). `channel` and `polish` are in the
   *  writer's list and are not among them: neither is a flow a person types — one is what
   *  `akb channel` starts, the other what Submit on the card page starts — and both are the
   *  writer's work, so the writer's rule reaches them. */
  flows: string[]
  /** The memory files it owns, board-relative. Nothing moves — these are the files its own
   *  flows already write, listed so a roster can say what a role remembers. */
  memory: string[]
}

// Planning is the flows that write a card, settle it and close it out. The two solutions
// keep their own list, because a marketing board has four of them fewer (#435): its cards
// carry no questions to refine or resolve, and no release to plan or write up.
const PRODUCT_PLANNER_FLOWS = [
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

const MARKETING_PLANNER_FLOWS = ['create', 'revise', 'archive', 'reject', 'setup']

// The two roles the board ships switched OFF (#447, #493). Neither does a flow's work: each
// stands in for the user, so each is off until asked for and each owns no memory — what
// either judged or chose stays on the card it was judging, never in a `decisions.md`.
//
// The gater runs `gate`, the verdict on whether a settled card may build unwatched. It was
// the planner's flow until #493, which cost it a switch and a connector of its own.
const GATER: AgentRole = {
  name: 'gater',
  gloss: 'judges whether a card can build unwatched',
  flows: ['gate'],
  memory: [],
  switch: 'readyGate',
}

// And the decider runs `decide` — the flow that answers a card's `[user]` questions instead
// of stopping for them.
const DECIDER: AgentRole = {
  name: 'decider',
  gloss: 'answers the questions waiting on you',
  flows: ['decide'],
  memory: [],
  switch: 'decider',
}

const REVIEWER: AgentRole = {
  name: 'reviewer',
  gloss: 'checks what was built',
  flows: ['review'],
  memory: [],
}

// The role every conversation is held by (#502) — `akb chat`, the chat rail and Discuss.
// `chat` is in its list the way `channel` is in the writer's: not a flow anyone types under
// `akb card`, and the role's work all the same. It comes first because a discussion comes
// before a card: what it helps with is whether an idea deserves work at all, and a
// discussion that ends in nothing is a discussion that did its job.
const DISCUSSION_HELPER: AgentRole = {
  name: 'discussion-helper',
  gloss: 'helps decide what is worth building',
  flows: ['chat'],
  memory: [],
}

const PRODUCT_ROLES: AgentRole[] = [
  DISCUSSION_HELPER,
  {
    name: 'planner',
    gloss: 'plans and refines cards',
    flows: PRODUCT_PLANNER_FLOWS,
    memory: ['memory/decisions.md', 'memory/rejected.md', 'memory/goal.md'],
  },
  {
    name: 'builder',
    gloss: 'builds them and lands them',
    flows: ['implement', 'conflict', 'run'],
    memory: ['memory/readme.md', 'memory/redesign.md', 'modules.md'],
  },
  REVIEWER,
  // Last, and only on a product board: it has no `gate` flow, and a topic carries no
  // questions to answer.
  GATER,
  DECIDER,
]

const MARKETING_ROLES: AgentRole[] = [
  DISCUSSION_HELPER,
  {
    name: 'planner',
    gloss: 'plans topics',
    flows: MARKETING_PLANNER_FLOWS,
    memory: ['memory/decisions.md', 'memory/rejected.md', 'memory/published.md'],
  },
  {
    name: 'writer',
    gloss: 'writes the drafts, repurposes them and polishes them',
    flows: ['implement', 'conflict', 'run', 'channel', 'polish', 'marketing-fix'],
    memory: ['memory/writing.md', 'memory/writing/'],
  },
  { ...REVIEWER, flows: [...REVIEWER.flows, 'marketing-verify'] },
]

/** The role every conversation is held by — whose runtime a chat runs on and whose rule it
 *  reads. Named here so `akb chat`, the chat rail and Discuss all read the same one. */
export const DISCUSSION_ROLE = DISCUSSION_HELPER.name

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
  /** What it does, in one clause: a role's line, or a specialist's `akb.owns`. */
  gloss: string
  /** When the board calls it — a specialist's own `description`. Empty on a role, which is
   *  called by its flows rather than by a trigger. */
  when: string
  /** `role` for one of the board's own; otherwise the hook the specialist plugs into. */
  kind: 'role' | AgentKind
  /** Whether the command ships it, as opposed to the project adding it. */
  builtIn: boolean
  /** Whether this entry can be switched off. Every specialist can; of the roles, the gater
   *  and the decider (#447, #493). */
  switchable: boolean
  /** A switchable role's own key in `ui.config.json` — what says whether it is on. Absent
   *  on every other entry: a specialist's switch is its `specAgents` entry. */
  setting?: RoleSwitch
  /** A role's flows. Empty on a specialist: it is asked for by name, never by a flow. */
  flows: string[]
  /** The memory files it owns, repo-relative — a role's are the files its own flows already
   *  write, and a specialist that declares `memory: project` owns one of its own. */
  memory: string[]
}

/** Every agent this board has, in the board's order: the roles first, then the specialists
 *  the command ships, then the ones the project added. One list, so `akb raw rule` and the
 *  Agents pane name the same team. */
export function agentRoster(): RosterEntry[] {
  // A specialist's two lines are the ones its own file declares, in the language this
  // machine reads — an agent is user-facing, and its `akb.i18n` block is where it says so.
  const specialists = specAgentCatalog().agents.map((agent) => {
    const said = agentLines(agent)
    return {
      name: agent.name,
      gloss: said.owns,
      when: said.description,
      kind: agent.kind,
      builtIn: agent.builtIn,
      switchable: true,
      flows: [],
      memory: agent.memory ? agentMemoryFiles(agent.name).map(rel) : [],
    }
  })
  return [
    ...roles().map((role) => ({
      name: role.name,
      gloss: role.gloss,
      when: '',
      kind: 'role' as const,
      builtIn: true,
      switchable: role.switch !== undefined,
      ...(role.switch ? { setting: role.switch } : {}),
      flows: role.flows,
      memory: role.memory.map((file) => rel(path.join(KANBAN, file))),
    })),
    ...specialists.filter((a) => a.builtIn),
    ...specialists.filter((a) => !a.builtIn),
  ]
}

/** The names this board answers to, in that order — what a refusal lists. */
export const agentNames = (): string[] => agentRoster().map((entry) => entry.name)
