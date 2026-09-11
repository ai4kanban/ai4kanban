// The flows this board can start — the one list, read by everything that needs it.
//
// A flow is a command a person types (`akb card implement 12`) and the program it starts.
// The list used to be written down three times: the dispatcher's table of commands, the
// runs table `akb help` prints, and — once flow rules shipped (#306) — the pane that
// writes them. Three copies fall behind each other, and a flow shipped later would take a
// rule only when someone remembered to add it in a second place. So it is written here,
// once, and the three read it.
//
// What a flow takes is written here too, in the notation the command tree declares it in
// (lib/cli/agent.ts): `argument` and `options` ARE the flow's command line, and so are its
// help. A flow shipped later is a command, a help entry and a rule at once.
//
// `command` is the flow's NAME, not the line a person types: it names the flow's rule file,
// keys the rules a delivery freezes, and keys which runtime the flow runs on. It stays put
// when the command line is rearranged — `plan-release` is still `plan-release` on disk now
// that it is typed `akb release plan`, so no board loses a rule to a rename and no delivery
// in flight loses the rules it froze.
//
// `group` and `verb` are the line a person types. A flow with a group is typed under that
// noun (`akb card refine`); one without is typed bare, because it acts on nothing that
// exists yet — `create`, `setup`.

import { solution, type Solution } from '../solution'
import type { AgentAction, CommandAction } from './types'

/** The nouns the commands are grouped under. A flow acts on one of these, or on nothing
 *  yet — see `Flow.group`. */
export type FlowGroup = 'card' | 'delivery' | 'release' | 'triage'

/** One option a flow takes, as its command declares it. `flags` is Commander's own
 *  notation, so `--effort <level>` takes a value and `--and-implement` does not. */
export interface FlowOption {
  flags: string
  description: string
  /** The only values accepted, when there is a fixed set of them. */
  choices?: readonly string[]
  /** A whole number in this range, when the value is a count. */
  range?: readonly [min: number, max: number]
}

export interface Flow {
  /** This flow's name: its rule file, its frozen key, its runtime. Never the line typed —
   *  see `group` and `verb`. */
  command: string
  /** The noun it is typed under. None means it is typed bare. */
  group?: FlowGroup
  /** The word typed under that noun, when it is not `command` itself. */
  verb?: string
  /** The public action the command dispatcher receives. */
  action: CommandAction
  /** What follows the command word, in Commander's notation. Empty when it takes nothing. */
  argument: string
  /** What the argument is, for the help. Empty when there is no argument. */
  argumentNote?: string
  /** One clause of plain words: what the flow is. `plan-release` and `run` name
   *  nothing a user can guess at, so every flow carries one. */
  gloss: string
  /** The rest of what the flow's own help says about it. */
  more?: string[]
  /** The options this flow takes, on top of the `--print` and `--follow` every one takes. */
  options?: FlowOption[]
}

const NOTE = 'anything the run should know, in your own words'

// The runtime one run spawns on (#518) — the same pick the create sheet makes, for the two
// flows it starts. It is this run's alone: nothing in Configuration → Agents moves, and the
// next run of the same flow is back on its agent's own runtime.
const RUNTIME_OPTION: FlowOption = {
  flags: '--runtime <id>',
  description: "the runtime to run on, for this run only (default: the flow's own agent's)",
}

export const FLOWS: Flow[] = [
  {
    command: 'implement',
    group: 'card',
    action: 'implement',
    argument: '<id> [note...]',
    argumentNote: NOTE,
    gloss: 'build the card',
    options: [RUNTIME_OPTION],
  },
  {
    command: 'review',
    group: 'delivery',
    action: 'review',
    argument: '<id>',
    gloss: 'review and fix what the delivery built against the approved card',
    more: ['The board runs this itself after a build; type it to look again after answering its question.'],
  },
  {
    command: 'conflict',
    group: 'delivery',
    action: 'conflict',
    argument: '<id>',
    gloss: "resolve the conflict its landing's rebase stopped on",
    more: ['The board runs this itself; the resolution is reviewed before it lands.'],
  },
  {
    command: 'run',
    group: 'card',
    action: 'run',
    argument: '<id> [note...]',
    argumentNote: NOTE,
    gloss: 'one pass of a recurring card',
  },
  {
    command: 'refine',
    group: 'card',
    action: 'refine',
    argument: '<id>',
    gloss: 'sharpen the card until it is ready to build',
    options: [
      {
        flags: '--effort <level>',
        description: 'how hard to look: lightweight | standard',
        choices: ['lightweight', 'standard'],
      },
    ],
  },
  {
    command: 'gate',
    group: 'card',
    action: 'gate',
    argument: '<id>',
    gloss: 'judge whether a ready card is clear enough to build unattended',
    more: [
      'The board runs this itself on each card that reaches `ready`, when the gater is switched on ' +
        '(Configuration → Agents). It passes the card straight into a delivery, or appends ' +
        'the one question that stops it.',
    ],
  },
  {
    command: 'resolve',
    group: 'card',
    action: 'resolve',
    argument: '<id> [note...]',
    argumentNote: NOTE,
    gloss: "apply the user's answers to its open questions",
    options: [{ flags: '--and-implement', description: 'carry straight on into the build' }],
  },
  // The decider's one flow (#447). It is `resolve` with the choosing done for the user, so
  // it takes the same argument and no options of its own — what it may write is the answers
  // and nothing else.
  {
    command: 'decide',
    group: 'card',
    action: 'decide',
    argument: '<id>',
    gloss: "answer the card's open questions for the user",
    more: [
      'The board runs this itself when the decider is switched on (Configuration → Agents); type it to ' +
        'have it answer one card whether or not the switch is on.',
    ],
  },
  {
    command: 'revise',
    group: 'card',
    action: 'edit',
    argument: '<id> <what...>',
    argumentNote: 'what to change about the card',
    gloss: 'change the card to say something else',
  },
  {
    command: 'create',
    action: 'create',
    argument: '<what...>',
    argumentNote: 'what you want, in your own words',
    gloss: 'write the card(s) for it',
    options: [
      { flags: '--release <version>', description: 'the version the new cards ship in' },
      RUNTIME_OPTION,
    ],
  },
  {
    command: 'plan-release',
    group: 'release',
    verb: 'plan',
    action: 'plan-release',
    argument: '<version>',
    argumentNote: 'the version to fill',
    gloss: 'fill a release from its goal',
  },
  {
    command: 'changelog',
    group: 'release',
    action: 'changelog',
    argument: '<version>',
    argumentNote: 'the closed version to write up',
    gloss: "write a closed version's changelog into its summary file",
    more: [
      'It is written from the goal and the cards its close wrote down — the close starts this itself, so ' +
        'run it only to rewrite one.',
    ],
  },
  {
    command: 'setup',
    action: 'setup',
    argument: '',
    gloss: 'finish setting the board up',
    more: ['Every step still unticked on docs/kanban/setup-checklist.md, in one run.'],
  },
  // The memory pruner's one flow (#514). Typed bare, like `setup`: it acts on the memory
  // set rather than on a card, so there is nothing to name.
  {
    command: 'prune-memory',
    action: 'prune-memory',
    argument: '',
    gloss: 'squeeze the memory back down to what helps planning',
    more: [
      'The project, the modules and the agents, in one run. Configuration → Agents → Memory pruner is ' +
        'where it is started and where a recurring pass is switched on.',
    ],
  },
  // The triager's one flow (#561). Typed under `triage`, beside the words that put items
  // there: it acts on what is waiting rather than on a card, so it names nothing.
  {
    command: 'triage',
    group: 'triage',
    verb: 'run',
    action: 'triage',
    argument: '',
    gloss: 'judge what is waiting in triage: card the worthwhile, ignore the rest',
    more: [
      'Product boards with triage open only. One item at a time: a survivor becomes a card with a ' +
        'refine scheduled on it, and everything else moves to `dismissed/` with a reason. Only one ' +
        'of these runs at a time.',
    ],
  },
  { command: 'archive', group: 'card', action: 'archive', argument: '<id>', gloss: 'finish the card' },
  {
    command: 'reject',
    group: 'card',
    action: 'reject',
    argument: '<id> <why...>',
    argumentNote: 'why the card is being dropped',
    gloss: 'drop the card',
  },
]

/** The flow's name and the public action it starts — the dispatcher's table. */
export const RUN_COMMANDS: Record<string, CommandAction> = Object.fromEntries(
  FLOWS.map((flow) => [flow.command, flow.action]),
)

/** The word typed under the flow's noun. */
export const flowVerb = (flow: Flow): string => flow.verb ?? flow.command

/** The line a person types, without the command's own name — `card refine`, `release plan`,
 *  `create`. What every message and every doc spells. */
export const flowPath = (flow: Flow): string => (flow.group ? `${flow.group} ${flowVerb(flow)}` : flowVerb(flow))

/** The same, by flow name, for the places that hold one — a rule file, a runtime setting. */
export const pathOfCommand = (command: string): string => {
  const flow = flowByCommand(command)
  return flow ? flowPath(flow) : command
}

export const flowByCommand = (command: string): Flow | undefined =>
  FLOWS.find((flow) => flow.command === command)

export const flowByAction = (action: AgentAction): Flow | undefined => {
  if (action === 'clarify' || action === 'writing') return flowByCommand('refine')
  return FLOWS.find((flow) => flow.action === action)
}

/** The delivery flows. Their rules are frozen with the card the delivery
 *  was approved to build, and their runs are the ones that may not be working in the
 *  project folder. */
export const DELIVERY_FLOWS = new Set<AgentAction>(['implement', 'review', 'conflict'])

// ---- the flows one solution has no place for (#435) -------------------------
//
// Refused rather than taken out of the command tree: the tree is built from FLOWS before
// anything has opened a board (../cli/agent.ts), so `akb card refine 3` is still a command
// this program knows — it just says, on a marketing board, why there is nothing behind it.

const GONE: Record<Solution, Record<string, string>> = {
  product: {},
  marketing: {
    refine: "a topic carries no questions to sharpen, and its angle is settled in the card's own chat",
    resolve: "a topic carries no questions to answer, and its angle is settled in the card's own chat",
    decide: "a topic carries no questions to answer for you, and its angle is settled in the card's own chat",
    gate: 'a topic carries no questions to turn one down with, and a piece is written when the user asks for it',
    implement: "a topic's source is the user's own words, and the agent's writing starts at the repurpose",
    'plan-release': 'a topic ships to channels, not to a version, and this board plans none',
    changelog: 'a topic ships to channels, not to a version, and this board plans none',
  },
}

/** Why this board has no such flow, or null when it has one. */
export function flowRefusal(command: string, program = 'akb'): string | null {
  const why = GONE[solution()][command]
  if (!why) return null
  const flow = flowByCommand(command)
  return `\`${program} ${flow ? flowPath(flow) : command}\` is not a \`${solution()}\` flow — ${why}.`
}
