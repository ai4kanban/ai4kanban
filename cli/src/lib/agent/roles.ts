// The roles the board ships — the agents its own flows are run by (#420).
//
// Every flow the board starts is run by a named agent. The specialists a card asks for are
// files a project writes (lib/agents/); the flows the command ships are these, written here
// because nothing about them is a project's to change: which flows the builder runs is what
// the command does.
//
// A role is a name, one line and the memory files it owns. It exists so a rule is written
// once per AGENT rather than once per flow (./rules.ts): telling the builder one thing used
// to mean writing the same sentence into `implement.md`, `conflict.md` and `run.md`, and
// nothing in the product said who was being trained.
//
// WHICH flows a role runs is no longer written here (#714). A stage contract names its lead
// and a shared node names its agent (./stages.ts), and that one table is read both ways —
// `roleForFlow` off it, and a role's own flows off it too. Two lists of the same fact fall
// out of step; one does not.

import path from 'node:path'

import { specAgentCatalog } from '../agents/catalog'
import { agentLines } from '../agents'
import { PLANNER, PROPOSER_MISSED, agentMemoryDir, agentMemoryFile, agentMemoryFiles, memoryNamesOf, plannerCopies } from '../memory'
import { KANBAN, rel } from '../paths'
import { canonicalSpecAgent } from '../spec-agent-names'
import { FLOWS } from './flows'
import { agentForFlow, contractProblems, flowsOfAgent } from './stages'
import type { SpecAgentSetting } from './types'

// The planner's three, board-relative — where every planning memory lives (#805). Named
// once here because the two content roles read and write the same files: a board that
// remembered its content decisions somewhere else would be a board whose pruner could only
// ever read half of what it decided.
const [PLANNER_DECISIONS, PLANNER_REJECTED, PLANNER_REDESIGN] = ['decisions.md', 'rejected.md', 'redesign.md'].map(
  (name) => `memory/agents/${PLANNER}/${name}`,
) as [string, string, string]

/** One role: an agent the board ships, named by the work rather than by a flow. */
export interface AgentRole {
  /** Its name — the rule file it carries, and the word `akb raw rule` takes. */
  name: string
  /** Runs, but is on no roster: no runtime of its own, and no rule. */
  hidden?: true
  /** Whether a workflow may list it under `land` (#2152): it runs the build. Every other role
   *  is a BOARD agent, which no workflow lists and every workflow gets. */
  lands?: true
  /** One clause of plain words: what it does, for a roster. */
  gloss: string
  /** The memory files it owns, board-relative — the files its own flows read and write,
   *  listed so a roster can say what a role remembers (#805). Empty on every role that only
   *  reads: the builder never opened one at all. */
  memory: string[]
  /** The picks its page offers (#1469). A choice's `prompt` is added to every run it does
   *  while that choice is picked. */
  settings?: SpecAgentSetting[]
}

// The role every conversation is held by (#502). It
// leads the discussion stage, and `chat` is that stage's one flow: not a flow anyone types
// under `akb card`, and the role's work all the same. It comes first because a discussion
// comes before a card — what it helps with is whether an idea deserves work at all, and a
// discussion that ends in nothing is a discussion that did its job.
const DISCUSSION_HELPER: AgentRole = {
  name: 'discussion-helper',
  gloss: 'helps decide what is worth building',
  memory: [],
}

// The role that keeps the memory readable (#514), on its cadence (./settings.ts) or Run now.
// It owns no memory file: it rewrites every one of them, and a list of all of them says
// nothing.
const MEMORY_PRUNER: AgentRole = {
  name: 'memory-pruner',
  gloss: 'squeezes the memory back down to what helps planning',
  memory: [],
}

// The role that reads back over the conversations (#748). Chats change cards and plans and
// write no memory at all, so this is the only thing that turns what was SAID into a note: it
// reads each conversation that has said something new right through, once a day, and decides
// from the whole exchange rather than from one turn — which is how a "what if" thrown out
// and taken back stops becoming a decision.
//
// It owns no memory file: it writes into the set the conversation's own card points at — a
// module's, the project's, or a spec agent's own — so a list of all of them says nothing.
//
// `review-memory` is an event entry rather than a stage (./stages.ts): the day coming round
// is what starts one.
const MEMORY_REVIEWER: AgentRole = {
  name: 'chat-reviewer',
  gloss: 'reads back over your conversations and writes down what they settled',
  memory: [],
}

// The role that learns what the user does not want from their rejection and dismissal
// reasons (#929, #1497), on its cadence (./settings.ts). It writes the planner's `rejected.md`
// and nothing else.
const DISMISSAL_REVIEWER: AgentRole = {
  name: 'dismissal-reviewer',
  gloss: 'learns what you do not want from the reasons you give for rejecting cards and dismissing items',
  memory: [PLANNER_REJECTED],
}

// The role that keeps `memory/project.md` — what the project is today (#1268), on its
// cadence (./settings.ts). It writes that file and nothing else.
const PROJECT_WRITER: AgentRole = {
  name: 'project-writer',
  gloss: 'describes what the project is today, for planning and triage to follow',
  memory: ['memory/project.md'],
}

// The role that looks back at finished work (#534), one run per completion. What it
// proposes goes into the inbox to be triaged. It owns one file, the kinds of follow-up it missed, which only the memory review
// writes when the user points one out (#1211).
//
// `reflect` is an event entry rather than a stage (./stages.ts): no flow a person types, and
// the role's work all the same — a card reaching the archive is what starts one.
const SMALL_FIX =
  'A small fix is a small change whose workflow needs none of its previews.'

const PROPOSER: AgentRole = {
  name: 'proposer',
  gloss: 'proposes the work a finished card leaves behind',
  memory: [`memory/agents/proposer/${PROPOSER_MISSED}`],
  settings: [
    {
      key: 'small-fixes',
      label: 'Small fixes',
      help: 'Little things like a copy fix or a missed case.',
      choices: [
        {
          value: 'auto',
          label: 'Just do them',
          cost: 'For speed over quality',
          prompt:
            `${SMALL_FIX} Do each one instead of proposing it: create it with ` +
            '`akb raw create --workflow <workflow> --source "#<finished card id>" --schedule implement`, ' +
            'its Scope and Todo written per `akb guide writing`.',
        },
        { value: 'propose', label: 'Ask me first', cost: 'For balancing speed and quality' },
        {
          value: 'skip',
          label: "Don't suggest",
          cost: 'For focusing on mainline features',
          prompt: `${SMALL_FIX} Do not propose small fixes; list them in your report.`,
        },
      ],
      default: 'propose',
    },
  ],
}

// The role that writes every card (#2152), to its workflow's rules. It runs on the discussion's
// runtime, so planning can carry a discussion's session on (#1316), and it has no rule of its
// own: what a user asks of planning is a workflow's rule.
const PLANNER_ROLE: AgentRole = {
  name: PLANNER,
  gloss: 'plans every card, to its workflow\'s rules',
  memory: [PLANNER_DECISIONS, PLANNER_REJECTED, PLANNER_REDESIGN],
  hidden: true,
}

const BOARD_ROLES: AgentRole[] = [
  DISCUSSION_HELPER,
  PLANNER_ROLE,
  // It owns no memory (#805). `readme.md` is the board's record of what shipped rather than
  // anyone's taste, `redesign.md` is read by the planner's revise and by nothing a build
  // runs, and the module map is a map.
  {
    name: 'builder',
    lands: true,
    gloss: 'builds them and lands them',
    memory: [],
  },
  MEMORY_PRUNER,
  MEMORY_REVIEWER,
  DISMISSAL_REVIEWER,
  PROJECT_WRITER,
  PROPOSER,
]

/** The role every conversation is held by — whose runtime a chat runs on and whose rule it
 *  reads. */
export const DISCUSSION_ROLE = DISCUSSION_HELPER.name

/** Every role name the board ships. Reserved: a rule is keyed by the agent's name, so a
 *  project agent taking one would share that role's rule file (../agents/catalog.ts refuses
 *  it). */
export const ROLE_NAMES: string[] = BOARD_ROLES.map((r) => r.name)

/** The role that plans every card. */
export const PLANNING_ROLE = PLANNER_ROLE.name

/** This board's roles, in the order a roster draws them. */
export const roles = (): AgentRole[] => BOARD_ROLES

/** The role that runs one flow, by flow name — resolved through the contracts (./stages.ts),
 *  which is the one place a flow is joined to who does it. Every flow the board has belongs
 *  to exactly one agent, so a rule written for a role reaches every flow it runs and no
 *  other.
 *
 *  Undefined when this board has no such flow, and also when the contract names a
 *  SPECIALIST — a land agent — as its lead: a specialist is not a role, and `agentForFlow` is
 *  what a caller that only wants the name should ask. */
export const roleForFlow = (flow: string, workflow?: string): AgentRole | undefined => {
  const name = agentForFlow(flow, workflow)
  return name ? (roleNamed(name) ?? landRole(name)) : undefined
}

// A land agent runs the build's flows as a role does (#822, #2152): its rule is keyed by its name.
function landRole(name: string): AgentRole | undefined {
  const agent = specAgentCatalog().agents.find((a) => a.name === name)
  return agent ? { name, gloss: agent.description, memory: [] } : undefined
}

/** The role of a given name. */
export const roleNamed = (name: string): AgentRole | undefined => roles().find((role) => role.name === name)

/** Whether a name is a role the board runs without listing — it reads no runtime pick and no rule. */
export const hiddenRole = (name: string): boolean => roleNamed(name)?.hidden === true

/** The flows an agent runs, in the order the board declares them (./flows.ts). What the
 *  one-time rule migration concatenates in. */
export function roleFlowsInOrder(name: string, workflow?: string): string[] {
  const order = FLOWS.map((flow) => flow.command)
  return flowsOfAgent(name, workflow).sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/** Every reason one of this board's contracts names an agent it does not have (./stages.ts).
 *  Read beside the agents' own problems, so a lead nobody answers to is said out loud rather
 *  than found out as a flow with nobody to run it. */
export const stageContractProblems = (): string[] =>
  contractProblems([...agentNames(), ...roles().filter((role) => role.hidden).map((role) => role.name)])

// ---- the roster ------------------------------------------------------------

/** One agent as a roster reads it — a role, or one of the specialists a card asks for. */
export interface RosterEntry {
  name: string
  /** What it is called in the language this machine reads, or empty. Only a specialist can
   *  say one, in its own `akb.i18n`; a role is a closed set the command ships, so the screen
   *  drawing it names it. Empty means "spell the name out". */
  title: string
  /** What it does: a role's line, or a specialist's own `description`. */
  gloss: string
  /** `role` for one of the board's own; `agent` for one a workflow lists. */
  kind: 'role' | 'agent'
  /** Whether a workflow may list it under `land` (#2152): the builder, or any agent. */
  lands: boolean
  /** Whether the command ships it, as opposed to the project adding it. */
  builtIn: boolean
  /** A role's flows. Empty on a specialist: it is asked for by name, never by a flow. */
  flows: string[]
  /** The memory files it owns, repo-relative — a role's are the files its own flows already
   *  write, and a specialist's are the files it has written in its own folder (#833). */
  memory: string[]
  /** Of those, the ones kept in this agent's OWN folder, by file name (#805). Empty on an
   *  agent whose declared memory is a file somebody else owns, and on one that keeps none.
   *  The memory panel draws one group per folder, so this is what says whether an agent gets
   *  one. */
  ownMemory: string[]
}

// Every memory file a role declares, repo-relative, with each module's copy of a planner
// file (#1484).
const memoryOf = (role: AgentRole): string[] =>
  role.memory.flatMap((file) => {
    const at = path.join(KANBAN, file)
    return path.dirname(at) === agentMemoryDir(PLANNER) ? plannerCopies(path.basename(at)) : [at]
  }).map(rel)

// Which of an agent's declared files live in its own folder — the names, so a screen can
// draw a row per file without re-deriving where it sits.
const ownMemoryOf = (name: string, memory: string[]): string[] =>
  memoryNamesOf(name).filter((file) => memory.includes(rel(agentMemoryFile(name, file))))

/** Every agent this board has, in the board's order: the roles first, then the specialists
 *  the command ships, then the ones the project added. One list, so `akb raw rule` and the
 *  Agents pane name the same team. */
export function agentRoster(): RosterEntry[] {
  // A specialist's words are the ones its own file declares, in the language this
  // machine reads — an agent is user-facing, and its `akb.i18n` block is where it says so.
  const specialists = specAgentCatalog().agents.map((agent) => {
    const said = agentLines(agent)
    return {
      name: agent.name,
      title: said.title,
      gloss: said.description,
      kind: 'agent' as const,
      lands: true,
      builtIn: agent.builtIn,
      flows: [],
      memory: agentMemoryFiles(agent.name).map(rel),
      ownMemory: [...memoryNamesOf(agent.name)],
    }
  })
  return [
    ...roles().filter((role) => !role.hidden).map((role) => ({
      name: role.name,
      title: '',
      gloss: role.gloss,
      kind: 'role' as const,
      lands: role.lands === true,
      builtIn: true,
      flows: flowsOfAgent(role.name),
      memory: memoryOf(role),
      ownMemory: ownMemoryOf(role.name, memoryOf(role)),
    })),
    ...specialists.filter((a) => a.builtIn),
    ...specialists.filter((a) => !a.builtIn),
  ]
}

/** The names this board answers to, in that order — what a refusal lists. */
export const agentNames = (): string[] => agentRoster().map((entry) => entry.name)
