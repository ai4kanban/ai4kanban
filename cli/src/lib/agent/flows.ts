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
// exists yet — `create`, `propose`, `setup`.

import { PROPOSE_MAX, type AgentAction, type CommandAction } from './types'

/** The nouns the commands are grouped under. A flow acts on one of these, or on nothing
 *  yet — see `Flow.group`. */
export type FlowGroup = 'card' | 'delivery' | 'release'

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
  /** What this flow's rule is for, read beside that flow rather than in a warning the user
   *  meets before they know which flow they want. Most flows have nothing particular to
   *  say and carry none. */
  ruleNote?: string
}

const NOTE = 'anything the run should know, in your own words'

export const FLOWS: Flow[] = [
  {
    command: 'implement',
    group: 'card',
    action: 'implement',
    argument: '<id> [note...]',
    argumentNote: NOTE,
    gloss: 'build the card',
    ruleNote:
      'Each delivery builds in a fresh worktree. This rule is where you say how to prepare one — installing dependencies, seeding a local config.',
  },
  {
    command: 'review',
    group: 'delivery',
    action: 'review',
    argument: '<id>',
    gloss: 'review and fix what the delivery built against the approved card',
    more: ['The board runs this itself after a build; type it to look again after answering its question.'],
    ruleNote: 'Add repository-specific checks here. Review fixes plain failures or stops when it needs you.',
  },
  {
    command: 'conflict',
    group: 'delivery',
    action: 'conflict',
    argument: '<id>',
    gloss: "resolve the conflict its landing's rebase stopped on",
    more: ['The board runs this itself; the result is reviewed from scratch.'],
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
    command: 'resolve',
    group: 'card',
    action: 'resolve',
    argument: '<id> [note...]',
    argumentNote: NOTE,
    gloss: "apply the user's answers to its open questions",
    options: [{ flags: '--and-implement', description: 'carry straight on into the build' }],
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
    options: [{ flags: '--release <version>', description: 'the version the new cards ship in' }],
  },
  {
    command: 'propose',
    action: 'propose',
    argument: '',
    gloss: 'write the next tasks',
    options: [
      { flags: '-m, --module <name>', description: 'only look at that part of the project' },
      { flags: '-n, --count <n>', description: 'how many to write', range: [1, PROPOSE_MAX] },
      {
        flags: '--boldness <level>',
        description: 'how far from the beaten path: safe | normal | bold',
        choices: ['safe', 'normal', 'bold'],
      },
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
 *  `propose`. What every message and every doc spells. */
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
