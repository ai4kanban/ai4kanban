// The four stages a card goes through, and the flows that are not one of them (#714).
//
// Discussion, planning, execution and review used to be four words in the prose and
// nothing in the program: which agent ran a flow was a list on the ROLE (./roles.ts), so
// the only thing the code knew about a stage was who happened to run it.
//
// A contract says the rest. Each stage declares what it is handed, what it leaves behind,
// when it is over, the agent that leads it and the agents it may call in — as DATA, read by
// the flow, not an interface anything implements. Two of those fields are what the machine
// acts on: `lead` is how a flow finds its agent, and `requires` is what the stage cannot end
// without. `input`, `output` and `done` are written down for the reader and for #715, which
// is where they reach a prompt.
//
// The contract sits ON TOP of the roles rather than replacing them. A lead is a name off the
// roster, and rules, runtimes and switches all still resolve by agent name — so the same two
// solutions run exactly as they did before this file existed.
//
// Everything else the board can start is a shared node: a DECISION the board makes in the
// user's place (the gate, the decider), or an EVENT entry something on the board starts (a
// sort, a sweep, a reflection, a complaint, a prune). Neither belongs to a stage and neither
// is open to be hooked — they are listed here so the classification is a total one: every
// flow this board has is a stage's, a decision or an event, and never two of them.

import { solution } from '../solution'

export const STAGES = ['discuss', 'plan', 'build', 'review'] as const

/** One of the four stages. */
export type Stage = (typeof STAGES)[number]

/** What one stage is answerable for. */
export interface StageContract {
  stage: Stage
  /** The flows that run it, by flow name (./flows.ts). */
  flows: string[]
  /** What the stage is handed. */
  input: string
  /** What it leaves behind. */
  output: string
  /** When it is over. */
  done: string
  /** The agent that runs it and writes the one conclusion. One per call: helpers run one
   *  at a time and the lead resumes to fold their sections into it. */
  lead: string
  /** The agents it may call in, by name. A board's own agents join the stage their hook
   *  belongs to — a `spec` agent the planning stage, a `write` agent the writing one — so
   *  this names only the ones the command ships. */
  helpers: string[]
  /** The helpers this stage cannot end without. The lead is always required and is never
   *  listed here. Empty on everything the command ships: until a board can write its own
   *  contracts (#716), a required helper would change when a card finishes. */
  requires: string[]
}

/** What a flow that is no stage's is. A `decision` is the board choosing in the user's
 *  place; an `event` is work something on the board starts rather than a stage. */
export type NodeKind = 'decision' | 'event'

/** One shared node: a flow, what kind it is, and the agent that runs it. */
export interface FlowNode {
  flow: string
  kind: NodeKind
  agent: string
}

// Planning is the flows that write a card, settle it and close it out. A marketing board
// has four of them fewer (#435): its cards carry no questions to refine or resolve, and no
// release to plan or write up.
const PRODUCT_STAGES: StageContract[] = [
  {
    stage: 'discuss',
    flows: ['chat'],
    input: "an idea in the user's own words, and what the board already knows",
    output: 'a direction worth a card, or the finding that there is nothing to build',
    done: 'the user has what they came for — a card was written, or the idea was let go',
    lead: 'discussion-helper',
    helpers: [],
    requires: [],
  },
  {
    stage: 'plan',
    flows: ['create', 'refine', 'resolve', 'revise', 'plan-release', 'changelog', 'archive', 'reject', 'setup'],
    input: 'the card as it stands, the board goal, and what planning remembers',
    output: 'a card someone can build from without asking anything else',
    done: "nothing is left open on it but the calls that are the user's to make",
    lead: 'planner',
    helpers: ['tech-stack-advisor', 'ui-designer'],
    requires: [],
  },
  {
    stage: 'build',
    flows: ['implement', 'conflict', 'run'],
    input: 'the approved card and the rules its delivery froze',
    output: "the change, committed on the delivery's own branch",
    done: 'the card\'s todos are ticked and the work is committed',
    lead: 'builder',
    helpers: [],
    requires: [],
  },
  {
    stage: 'review',
    flows: ['review'],
    input: "the delivery's diff and the card it was approved to build",
    output: 'a verdict, with the plain mistakes fixed in the same session',
    done: 'the diff answers the card, or the user has been asked the one thing that stops it',
    lead: 'reviewer',
    helpers: [],
    requires: [],
  },
]

const MARKETING_STAGES: StageContract[] = [
  {
    stage: 'discuss',
    flows: ['chat'],
    input: "an idea in the user's own words, and what the board already knows",
    output: 'a topic worth a card, or the finding that there is nothing to say',
    done: 'the user has what they came for — a card was written, or the idea was let go',
    lead: 'discussion-helper',
    helpers: [],
    requires: [],
  },
  {
    stage: 'plan',
    flows: ['create', 'revise', 'archive', 'reject', 'setup'],
    input: 'the topic as it stands, and what planning remembers of what was published',
    output: 'a topic with an angle and channels someone can write to',
    done: 'the angle and the channels are settled',
    lead: 'planner',
    helpers: [],
    requires: [],
  },
  {
    stage: 'build',
    flows: ['conflict', 'run', 'channel', 'polish'],
    input: "the topic, its source and the user's own words",
    output: 'the draft, and the version each channel takes',
    done: 'every channel the topic goes to has its piece',
    lead: 'writer',
    helpers: [],
    requires: [],
  },
  {
    stage: 'review',
    flows: ['review', 'marketing-polish-loop'],
    input: 'the draft and the comments left on it',
    output: 'a verdict, with the plain mistakes fixed in the same session',
    done: 'the draft answers the topic, or the user has been asked what stops it',
    lead: 'reviewer',
    helpers: [],
    requires: [],
  },
]

// The nodes that are no stage's work.
//
// The two DECISIONS stand in for the user: the gate says whether a settled card may build
// unwatched, and the decider answers the questions that were waiting on them. Calling them
// decisions is not a promise about them — both keep the switch and the agent they have
// today, and neither is open to be hooked.
//
// The five EVENTS are started by something happening rather than by a stage reaching them:
// a card finishing, a batch of items arriving, a card going stale, a user saying the spec
// missed, a cadence coming round.
const PRODUCT_NODES: FlowNode[] = [
  { flow: 'gate', kind: 'decision', agent: 'gater' },
  { flow: 'decide', kind: 'decision', agent: 'decider' },
  { flow: 'reflect', kind: 'event', agent: 'proposer' },
  { flow: 'triage', kind: 'event', agent: 'triage' },
  { flow: 'unstick', kind: 'event', agent: 'sweeper' },
  { flow: 'feedback', kind: 'event', agent: 'feedback' },
  { flow: 'prune-memory', kind: 'event', agent: 'memory-pruner' },
]

const MARKETING_NODES: FlowNode[] = [{ flow: 'prune-memory', kind: 'event', agent: 'memory-pruner' }]

/** This board's four stage contracts, in the order a card goes through them. */
export const stageContracts = (): StageContract[] => (solution() === 'marketing' ? MARKETING_STAGES : PRODUCT_STAGES)

/** One stage's contract. */
export const stageContract = (stage: Stage): StageContract => stageContracts().find((c) => c.stage === stage)!

/** This board's shared nodes — everything it can start that is no stage's. */
export const flowNodes = (): FlowNode[] => (solution() === 'marketing' ? MARKETING_NODES : PRODUCT_NODES)

/** The stage a flow belongs to, or undefined when it is a shared node or this board has no
 *  such flow at all. */
export const stageOfFlow = (flow: string): Stage | undefined =>
  flow ? stageContracts().find((c) => c.flows.includes(flow))?.stage : undefined

/** The shared node a flow is, or undefined when it belongs to a stage or to this board not
 *  at all. */
export const nodeOfFlow = (flow: string): FlowNode | undefined =>
  flow ? flowNodes().find((n) => n.flow === flow) : undefined

/** The agent that runs one flow — the one mapping from a flow to who does it. A stage's
 *  flow resolves to its lead; a shared node's to the agent on the node. */
export const agentForFlow = (flow: string): string | undefined => {
  if (!flow) return undefined
  const stage = stageContracts().find((c) => c.flows.includes(flow))
  return stage ? stage.lead : nodeOfFlow(flow)?.agent
}

/** The flows one agent runs here, stages first and then its nodes. */
export const flowsOfAgent = (name: string): string[] => [
  ...stageContracts().filter((c) => c.lead === name).flatMap((c) => c.flows),
  ...flowNodes().filter((n) => n.agent === name).map((n) => n.flow),
]

/** Every reason a contract names somebody this board does not have. `roster` is the names
 *  the board answers to (./roles.ts). Empty when every name on every contract resolves. */
export function contractProblems(roster: readonly string[]): string[] {
  const problems: string[] = []
  const has = (name: string): boolean => roster.includes(name)
  for (const contract of stageContracts()) {
    if (!has(contract.lead)) {
      problems.push(
        `the ${contract.stage} stage is led by \`${contract.lead}\`, and no agent on this board answers to that name.`,
      )
    }
    for (const helper of [...contract.helpers, ...contract.requires]) {
      if (!has(helper)) {
        problems.push(
          `the ${contract.stage} stage calls for \`${helper}\`, and no agent on this board answers to that name.`,
        )
      }
    }
  }
  for (const node of flowNodes()) {
    if (!has(node.agent)) {
      problems.push(`the \`${node.flow}\` ${node.kind} is run by \`${node.agent}\`, and this board has no such agent.`)
    }
  }
  return problems
}
