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
import { PLANNER, PROPOSER_MISSED, agentMemoryFile, agentMemoryFiles, memoryNamesOf } from '../memory'
import { KANBAN, rel } from '../paths'
import { FLOWS } from './flows'
import { agentForFlow, contractProblems, flowsOfAgent } from './stages'
import type { WorkflowStage } from './workflows'
import type { AgentKind } from '../agents/parse'

// The planner's three, board-relative — where every planning memory lives (#805). Named
// once here because the two content roles read and write the same files: a board that
// remembered its content decisions somewhere else would be a board whose pruner could only
// ever read half of what it decided.
const [PLANNER_DECISIONS, PLANNER_REJECTED, PLANNER_REDESIGN, PLANNER_DISMISSED] = [
  'decisions.md',
  'rejected.md',
  'redesign.md',
  'dismissed.md',
].map((name) => `memory/agents/${PLANNER}/${name}`) as [string, string, string, string]

/** One role: an agent the board ships, named by the work rather than by a flow. */
export interface AgentRole {
  /** Its name — the rule file it carries, and the word `akb raw rule` takes. */
  name: string
  /** What has to be open on this board for this role to be on its roster at all (#562).
   *  `triage` is `signalsAccess()` — the answer the Triage rail row and `akb triage fetch`
   *  read. Absent on every role that works wherever its board does. */
  needs?: 'triage'
  /** The workflow stage this agent may be assigned to (#715). A role with one is a
   *  WORKFLOW agent: it can lead or help that stage of any workflow on the board. A role
   *  without one is a BOARD agent — the discussion, the pruner and the rest — which no workflow assigns and every workflow gets. */
  stage?: WorkflowStage
  /** One clause of plain words: what it does, for a roster. */
  gloss: string
  /** The memory files it owns, board-relative — the files its own flows read and write,
   *  listed so a roster can say what a role remembers (#805). Empty on every role that only
   *  reads: the builder never opened one at all. */
  memory: string[]
}

// The role every conversation is held by (#502) — `akb chat`, the chat rail and Discuss. It
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
  name: 'memory-reviewer',
  gloss: 'reads back over your conversations and writes down what they settled',
  memory: [],
}

// The role that learns triage taste from dismissal reasons (#929), on its cadence
// (./settings.ts). It writes the planner's `dismissed.md` and nothing else.
const DISMISSAL_REVIEWER: AgentRole = {
  name: 'dismissal-reviewer',
  gloss: 'learns your triage preferences from the reasons you give for dismissing items',
  memory: [PLANNER_DISMISSED],
}

// The role that looks back at finished work (#534), one run per completion. What it
// proposes goes into the inbox to be triaged. It owns one file, the kinds of follow-up it missed, which only the memory review
// writes when the user points one out (#1211).
//
// `reflect` is an event entry rather than a stage (./stages.ts): no flow a person types, and
// the role's work all the same — a card reaching the archive is what starts one.
const PROPOSER: AgentRole = {
  name: 'proposer',
  gloss: 'proposes the work a finished card leaves behind',
  memory: [`memory/agents/proposer/${PROPOSER_MISSED}`],
}

// The role that sorts what is waiting in triage (#561, #562). It owns no memory — what it
// judged is on the card it wrote or in the `dismissed/` record that says why it did not.
//
// A batch of new items starts one by itself; `akb triage run` starts one by hand. It is on
// the roster only where triage is open at all (./access).
const TRIAGER: AgentRole = {
  name: 'triage',
  gloss: 'sorts what is waiting in triage into cards and ignores',
  memory: [],
  needs: 'triage',
}

// The role that hears a complaint about a spec (#628). Its `feedback` is an event entry,
// no flow anyone types: a user saying "this is not what I meant" in Discuss is what starts it, and
// a board that never hears one never runs it. Partner feedback's own switch is a privacy
// answer about the MACHINE (Configuration -> General), not a roster entry — this agent
// understands the problem either way, and only the collecting is gated on it.
//
// It owns no memory. What one user's spec got wrong is that card's business, and the case it
// packs goes to the team rather than into this board's planning notes.
const FEEDBACK: AgentRole = {
  name: 'feedback',
  gloss: 'works out what a spec got wrong, and packs the case for it',
  memory: [],
}

// The role that settles a card nobody has touched in a month (#118). It has no switch, for
// the planner's reason: nothing it does happens unasked — one card at a time, named by
// whoever typed it, until #119's cadence is turned on.
//
// It owns no memory. What it judged is on the card it rewrote, or gone with the card it
// discarded: a card the board has simply moved past earns no lasting no, which is exactly
// why it discards rather than rejects.
const SWEEPER: AgentRole = {
  name: 'sweeper',
  gloss: 'settles the cards that have sat too long',
  memory: [],
}

const BOARD_ROLES: AgentRole[] = [
  DISCUSSION_HELPER,
  {
    name: 'software-planner',
    stage: 'plan',
    gloss: 'plans and refines cards',
    memory: [PLANNER_DECISIONS, PLANNER_REJECTED, PLANNER_REDESIGN],
  },
  // It owns no memory (#805). `readme.md` is the board's record of what shipped rather than
  // anyone's taste, `redesign.md` is read by the planner's revise and by nothing a build
  // runs, and the module map is a map.
  {
    name: 'builder',
    stage: 'execute',
    gloss: 'builds them and lands them',
    memory: [],
  },
  MEMORY_PRUNER,
  MEMORY_REVIEWER,
  SWEEPER,
  DISMISSAL_REVIEWER,
  FEEDBACK,
  PROPOSER,
  TRIAGER,
]

/** The role every conversation is held by — whose runtime a chat runs on and whose rule it
 *  reads. Named here so `akb chat`, the chat rail and Discuss all read the same one. */
export const DISCUSSION_ROLE = DISCUSSION_HELPER.name

/** The role a discussion turn is handed to when the user is reporting a spec that missed
 *  what they meant (#628). The runtime stays the discussion's — this is the same
 *  conversation, answered by a different agent's rule and brief. */
export const FEEDBACK_ROLE = FEEDBACK.name

/** Every role name the board ships. Reserved: a rule is keyed by the agent's name, so a
 *  project agent taking one would share that role's rule file (../agents/catalog.ts refuses
 *  it). `planner` too: the Software planner's old name, and planning memory's folder (#858). */
export const ROLE_NAMES: string[] = [...BOARD_ROLES.map((r) => r.name), PLANNER]

/** This board's roles, in the order a roster draws them. */
export const roles = (): AgentRole[] => BOARD_ROLES

/** The role that runs one flow, by flow name — resolved through the contracts (./stages.ts),
 *  which is the one place a flow is joined to who does it. Every flow the board has belongs
 *  to exactly one agent, so a rule written for a role reaches every flow it runs and no
 *  other.
 *
 *  Undefined when this board has no such flow, and also when the contract names a
 *  SPECIALIST as its lead: a specialist is not a role, and `agentForFlow` is what a caller
 *  that only wants the name should ask. */
export const roleForFlow = (flow: string, workflow?: string): AgentRole | undefined => {
  const name = agentForFlow(flow, workflow)
  return name ? (roleNamed(name) ?? leadRole(name)) : undefined
}

// An agent that may lead runs a stage's flows as a role does (#822, #846): its rule and runtime
// are keyed by its name, and a plan lead keeps the planner's memory.
function leadRole(name: string): AgentRole | undefined {
  const agent = specAgentCatalog().agents.find((a) => a.name === name && a.canLead)
  if (!agent?.stage) return undefined
  return {
    name,
    stage: agent.stage,
    gloss: agent.description,
    memory: agent.stage === 'plan' ? [PLANNER_DECISIONS, PLANNER_REJECTED, PLANNER_REDESIGN] : [],
  }
}

/** The role of a given name. */
export const roleNamed = (name: string): AgentRole | undefined => roles().find((role) => role.name === name)

/** The flows an agent runs, in the order the board declares them (./flows.ts). What the
 *  one-time rule migration concatenates in. */
export function roleFlowsInOrder(name: string, workflow?: string): string[] {
  const order = FLOWS.map((flow) => flow.command)
  return flowsOfAgent(name, workflow).sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

/** Every reason one of this board's contracts names an agent it does not have (./stages.ts).
 *  Read beside the agents' own problems, so a lead nobody answers to is said out loud rather
 *  than found out as a flow with nobody to run it. */
export const stageContractProblems = (): string[] => contractProblems(agentNames())

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
  /** The workflow stage this agent can be assigned to (#715), or absent on a board agent
   *  that no workflow assigns. */
  stage?: WorkflowStage
  /** `role` for one of the board's own; otherwise the hook the specialist plugs into. */
  kind: 'role' | AgentKind
  /** Whether it may lead its stage (#846) — a role with a stage always may. */
  canLead: boolean
  /** Whether the command ships it, as opposed to the project adding it. */
  builtIn: boolean
  /** Whether this entry can be switched off: only a specialist that declares no stage. A
   *  workflow agent's stage assignment is its answer (#749), and no role has one (#1208). */
  switchable: boolean
  /** What has to be open on this board for this entry to be offered — a role's own `needs`
   *  (#562). Absent on every entry that works wherever its board does. */
  needs?: 'triage'
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

// Every memory file a role declares, repo-relative.
const memoryOf = (role: AgentRole): string[] => role.memory.map((file) => rel(path.join(KANBAN, file)))

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
      kind: agent.kind,
      canLead: agent.canLead,
      ...(agent.stage ? { stage: agent.stage } : {}),
      builtIn: agent.builtIn,
      // A stage is the switch (#749): assign it to one in the Workflows pane, or leave it
      // unassigned. Only an agent no workflow can reach keeps one of its own.
      switchable: !agent.stage,
      flows: [],
      memory: agentMemoryFiles(agent.name).map(rel),
      ownMemory: [...memoryNamesOf(agent.name)],
    }
  })
  return [
    ...roles().map((role) => ({
      name: role.name,
      title: '',
      gloss: role.gloss,
      kind: 'role' as const,
      canLead: role.stage !== undefined,
      ...(role.stage ? { stage: role.stage } : {}),
      builtIn: true,
      switchable: false,
      ...(role.needs ? { needs: role.needs } : {}),
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
