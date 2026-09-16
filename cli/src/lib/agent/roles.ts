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
import { agentMemoryFiles } from '../memory'
import { KANBAN, rel } from '../paths'
import { FLOWS } from './flows'
import { agentForFlow, contractProblems, flowsOfAgent } from './stages'
import type { RoleSwitch } from './settings'
import type { WorkflowStage } from './workflows'
import type { AgentKind } from '../agents/parse'

/** One role: an agent the board ships, named by the work rather than by a flow. */
export interface AgentRole {
  /** Its name — the rule file it carries, and the word `akb raw rule` takes. */
  name: string
  /** The key in `ui.config.json` this role is switched on under, when it can be switched
   *  off at all (#447, #493, #534, #562, #748). Most cannot: a board without a planner plans
   *  nothing, and no WORKFLOW agent has one at all (#749, #783) — a stage assigns it or does
   *  not. Five can, and none of them belongs to a workflow. Four spend a run the user never
   *  asked for — the gater judges a card the way you would, the decider answers what you
   *  would have answered, the proposer reflects on what you just finished, the triager judges
   *  what just arrived — so each is off until you ask for it. One ships on: the memory
   *  reviewer, because nothing else writes down what a conversation settled. Each reads its
   *  own key. */
  switch?: RoleSwitch
  /** The direction this role's switch asks in, when it asks at all (#447, #562, #748). A
   *  property of the role rather than a name a screen keeps. `on` is the usual way round —
   *  the decider stops the board asking you anything, the triager turns items into cards
   *  with a refine each — and going back off never asks. `off` is the memory reviewer, the
   *  one whose cost lands when it stops: it is what turns a conversation into a note, so
   *  going ON is free and going off is what loses something. */
  confirm?: 'on' | 'off'
  /** What has to be open on this board for this role to be on its roster at all (#562).
   *  `triage` is `signalsAccess()` — the answer the Triage rail row and `akb triage fetch`
   *  read. Absent on every role that works wherever its board does. */
  needs?: 'triage'
  /** The workflow stage this agent may be assigned to (#715). A role with one is a
   *  WORKFLOW agent: it can lead or help that stage of any workflow on the board. A role
   *  without one is a BOARD agent — the discussion, the gate, the decider, the pruner and
   *  the rest — which no workflow assigns and every workflow gets. */
  stage?: WorkflowStage
  /** One clause of plain words: what it does, for a roster. */
  gloss: string
  /** The memory files it owns, board-relative. The files its own flows already write, listed
   *  so a roster can say what a role remembers. */
  memory: string[]
  /** Whether this role keeps a memory FOLDER of its own under `memory/agents/<name>/`
   *  (#718) — the two files a spec agent that remembers keeps. Set on the content roles,
   *  whose writing taste is theirs rather than the board's; the rest write into the board's
   *  own set, which `memory` above lists. */
  ownMemory?: boolean
}

// The two roles the board ships switched OFF (#447, #493). Neither does a flow's work: each
// stands in for the user, so each is off until asked for and each owns no memory — what
// either judged or chose stays on the card it was judging, never in a `decisions.md`.
//
// The gater runs `gate`, the verdict on whether a settled card may build unwatched. It was
// the planner's flow until #493, which cost it a switch and a connector of its own.
const GATER: AgentRole = {
  name: 'gater',
  gloss: 'judges whether a card can build unwatched',
  memory: [],
  switch: 'readyGate',
}

// And the decider runs `decide` — the flow that answers a card's `[user]` questions instead
// of stopping for them.
const DECIDER: AgentRole = {
  name: 'decider',
  gloss: 'answers the questions waiting on you',
  memory: [],
  switch: 'decider',
  confirm: 'on',
}

// The role that leads the review stage. It carried a switch of its own until #783: review is
// a paid run per delivery and a board may decline it, but the answer is a DELIVERY setting —
// it is frozen onto each delivery beside automatic commits and diff approval, and it is
// answered where those two are, in Configuration → General → Delivery. A workflow agent
// carrying a second switch on its own page was the last place role configuration and stage
// assignment were mixed (#749).
const REVIEWER: AgentRole = {
  name: 'reviewer',
  stage: 'review',
  gloss: 'checks the code a build delivered',
  memory: [],
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

// The role that keeps the memory readable (#514). It has no switch for the same reason the
// planner has none: a board without it simply never prunes, and Run now on its page is the
// switch — nothing it does happens unasked until a cadence is turned on there. It owns no
// memory file: it rewrites every one of them, and a list of all of them says nothing.
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
// It is the one role that ships ON and asks on the way OFF. Both follow from what it
// replaced: switching it off is the only way a board stops remembering what it decided in a
// conversation, and that is worth one question.
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
  switch: 'memoryReviewer',
  confirm: 'off',
}

// The role that looks back at finished work (#534). Like the gater and the decider it is
// off until asked for — a board that turns it on spends one run per completion — and like
// them it owns no memory: what it proposes goes into the inbox to be triaged, and a
// proposal nobody took up leaves nothing written down. It READS the goal and the planner's
// memory to judge what is worth proposing; owning neither is the point.
//
// `reflect` is an event entry rather than a stage (./stages.ts): no flow a person types, and
// the role's work all the same — a card reaching the archive is what starts one.
const PROPOSER: AgentRole = {
  name: 'proposer',
  gloss: 'proposes the work a finished card leaves behind',
  memory: [],
  switch: 'proposer',
}

// The role that sorts what is waiting in triage (#561, #562). It owns no memory — what it
// judged is on the card it wrote or in the `dismissed/` record that says why it did not.
//
// Its switch is not whether it runs: `akb triage run` is typed by hand whatever the switch
// says. It is whether a batch of new items starts one by ITSELF, which is why turning it on
// asks first — a sort that runs unasked writes cards unasked, and each of those carries a
// refine. And it is on the roster only where triage is open at all (./access), so a board
// that has no Triage row has no agent for it either.
const TRIAGER: AgentRole = {
  name: 'triage',
  gloss: 'sorts what is waiting in triage into cards and ignores',
  memory: [],
  switch: 'autoTriage',
  confirm: 'on',
  needs: 'triage',
}

// The role that hears a complaint about a spec (#628). Its `feedback` is an event entry,
// no flow anyone types, and it has no switch: a user saying "this is not what I meant" in Discuss is what starts it, and
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

// The three the `content` workflow is led by (#715). They ship with the command the way the
// coding three do, and they stand beside them in the same stage pickers: one board plans a
// feature and a newsletter through the same three stages, and which agent leads is the
// workflow's answer rather than the board's.
//
// Each keeps a memory FOLDER of its own, `memory/agents/<name>/` (#718). Writing taste — the
// voice, what a claim has to carry, how a piece is put together — is the three of them
// answering to the user, not a planning note about the product, so it does not belong in the
// board's `decisions.md` beside what a feature settled. All three are HANDED all three
// folders, because taste corrected on a review is taste the writer has to write by; each
// writes only its own.
const CONTENT_ROLES: AgentRole[] = [
  {
    name: 'content-planner',
    stage: 'plan',
    gloss: 'settles what a piece is for, who reads it and what it covers',
    memory: ['memory/decisions.md', 'memory/rejected.md', 'memory/goal.md'],
    ownMemory: true,
  },
  {
    name: 'content-writer',
    stage: 'execute',
    gloss: 'writes the piece into the repository',
    memory: ['memory/readme.md'],
    ownMemory: true,
  },
  {
    name: 'content-reviewer',
    stage: 'review',
    gloss: 'checks the piece against what was planned',
    memory: [],
    ownMemory: true,
  },
]

/** The three content roles, in the order the `content` workflow runs them — whose memory
 *  every content run is handed (#718). */
export const CONTENT_ROLE_NAMES: string[] = CONTENT_ROLES.map((r) => r.name)

const BOARD_ROLES: AgentRole[] = [
  DISCUSSION_HELPER,
  {
    name: 'planner',
    stage: 'plan',
    gloss: 'plans and refines cards',
    memory: ['memory/decisions.md', 'memory/rejected.md', 'memory/goal.md'],
  },
  {
    name: 'builder',
    stage: 'execute',
    gloss: 'builds them and lands them',
    memory: ['memory/readme.md', 'memory/redesign.md', 'modules.md'],
  },
  REVIEWER,
  ...CONTENT_ROLES,
  MEMORY_PRUNER,
  MEMORY_REVIEWER,
  SWEEPER,
  FEEDBACK,
  GATER,
  DECIDER,
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

/** The role that leads the review stage. Named here so a refusal can say where whether a
 *  build is reviewed is actually answered (#783). */
export const REVIEW_ROLE = REVIEWER.name

/** Every role name the board ships. Reserved: a rule is keyed by the agent's name, so a
 *  project agent taking one would share that role's rule file (../agents/catalog.ts refuses
 *  it). */
export const ROLE_NAMES: string[] = BOARD_ROLES.map((r) => r.name)

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
  return name ? roleNamed(name) : undefined
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
  /** What it does, in one clause: a role's line, or a specialist's `akb.owns`. */
  gloss: string
  /** When the board calls it — a specialist's own `description`. Empty on a role, which is
   *  called by its flows rather than by a trigger. */
  when: string
  /** The workflow stage this agent can be assigned to (#715), or absent on a board agent
   *  that no workflow assigns. */
  stage?: WorkflowStage
  /** `role` for one of the board's own; otherwise the hook the specialist plugs into. */
  kind: 'role' | AgentKind
  /** Whether the command ships it, as opposed to the project adding it. */
  builtIn: boolean
  /** Whether this entry can be switched off. A workflow agent cannot (#749): a stage of a
   *  workflow assigns it or does not, and a second switch beside that assignment is two
   *  answers to one question. So: a specialist that declares no stage, and, of the roles,
   *  the gater, the decider (#447, #493), the proposer (#534) and the triager (#562). */
  switchable: boolean
  /** The direction its switch asks in — the role's own `confirm`. Absent on every
   *  specialist: one fills a section of a card and starts nothing on its own. */
  confirm?: 'on' | 'off'
  /** A switchable role's own key in `ui.config.json` — what says whether it is on. Absent
   *  on every other entry: a specialist's switch is its `specAgents` entry. */
  setting?: RoleSwitch
  /** What has to be open on this board for this entry to be offered — a role's own `needs`
   *  (#562). Absent on every entry that works wherever its board does. */
  needs?: 'triage'
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
      title: said.title,
      gloss: said.owns,
      when: said.description,
      kind: agent.kind,
      ...(agent.stage ? { stage: agent.stage } : {}),
      builtIn: agent.builtIn,
      // A stage is the switch (#749): assign it to one in the Workflows pane, or leave it
      // unassigned. Only an agent no workflow can reach keeps one of its own.
      switchable: !agent.stage,
      flows: [],
      memory: agent.memory ? agentMemoryFiles(agent.name).map(rel) : [],
    }
  })
  return [
    ...roles().map((role) => ({
      name: role.name,
      title: '',
      gloss: role.gloss,
      when: '',
      kind: 'role' as const,
      ...(role.stage ? { stage: role.stage } : {}),
      builtIn: true,
      switchable: role.switch !== undefined,
      ...(role.confirm ? { confirm: role.confirm } : {}),
      ...(role.switch ? { setting: role.switch } : {}),
      ...(role.needs ? { needs: role.needs } : {}),
      flows: flowsOfAgent(role.name),
      memory: [
        ...(role.ownMemory ? agentMemoryFiles(role.name).map(rel) : []),
        ...role.memory.map((file) => rel(path.join(KANBAN, file))),
      ],
    })),
    ...specialists.filter((a) => a.builtIn),
    ...specialists.filter((a) => !a.builtIn),
  ]
}

/** The names this board answers to, in that order — what a refusal lists. */
export const agentNames = (): string[] => agentRoster().map((entry) => entry.name)
