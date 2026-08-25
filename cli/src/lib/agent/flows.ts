// The flows this board can start — the one list, read by everything that needs it.
//
// A flow is a command a person types (`akb implement 12`) and the kind of run it starts.
// The list used to be written down three times: the dispatcher's table of commands, the
// runs table `akb help` prints, and — once flow rules shipped (#306) — the pane that
// writes them. Three copies fall behind each other, and a flow shipped later would take a
// rule only when someone remembered to add it in a second place. So it is written here,
// once, and the three read it.
//
// `command` is also the name of the flow's rule file, because the command is the one name
// the user typed and the one a pane can show — `revise.md` for `akb revise`, whose action
// the board keeps under the name `edit`.

import type { AgentAction } from './types'

export interface Flow {
  /** The word a person types — and the name of this flow's rule file. */
  command: string
  /** The kind of run it starts. */
  action: AgentAction
  /** The usage line, as the runs table lists it. */
  usage: string
  /** One clause of plain words: what the flow is. `plan-release` and `run` name
   *  nothing a user can guess at, so every flow carries one. */
  gloss: string
  /** The rest of what the runs table says about it, already wrapped — so the layout is the
   *  text itself rather than something a wrapper has to guess at. */
  more?: string[]
  /** What this flow's rule is for, read beside that flow rather than in a warning the user
   *  meets before they know which flow they want. Most flows have nothing particular to
   *  say and carry none. */
  ruleNote?: string
}

export const FLOWS: Flow[] = [
  {
    command: 'implement',
    action: 'implement',
    usage: 'implement <id> [note]',
    gloss: 'build the card',
    ruleNote:
      'Each delivery builds in a fresh worktree. This rule is where you say how to prepare one — installing dependencies, seeding a local config.',
  },
  {
    command: 'review',
    action: 'review',
    usage: 'review <id>',
    gloss: 'review and fix what the delivery built against the approved card',
    more: [
      'The board runs this itself after a build; type it to look',
      'again after answering its question',
    ],
    ruleNote: 'Add repository-specific checks here. Review fixes plain failures or stops when it needs you.',
  },
  {
    command: 'conflict',
    action: 'conflict',
    usage: 'conflict <id>',
    gloss: "resolve the conflict its landing's rebase stopped on",
    more: ['The board runs this itself; the result is reviewed from', 'scratch'],
  },
  { command: 'run', action: 'run', usage: 'run <id> [note]', gloss: 'one pass of a recurring card' },
  {
    command: 'refine',
    action: 'refine',
    usage: 'refine <id>',
    gloss: 'sharpen the card until it is ready to build',
  },
  {
    command: 'resolve',
    action: 'resolve',
    usage: 'resolve <id> [note]',
    gloss: 'answer its open questions',
    more: ['(--and-implement carries on)'],
  },
  {
    command: 'revise',
    action: 'edit',
    usage: 'revise <id> "<what>"',
    gloss: 'change the card to say something else',
  },
  {
    command: 'create',
    action: 'create',
    usage: 'create "<what you want>"',
    gloss: 'write the card(s) for it',
    more: ['(--release v1)'],
  },
  {
    command: 'propose',
    action: 'propose',
    usage: 'propose',
    gloss: 'write the next tasks',
    more: ['(--module m, --count n, --boldness safe|normal|bold)'],
  },
  {
    command: 'plan-release',
    action: 'plan-release',
    usage: 'plan-release <version>',
    gloss: 'fill a release from its goal',
  },
  {
    command: 'changelog',
    action: 'changelog',
    usage: 'changelog <version>',
    gloss: "write a closed version's changelog into its summary file",
    more: [
      'It is written from the goal and the cards its close wrote',
      'down — the close starts this itself, so run it only to',
      'rewrite one',
    ],
  },
  {
    command: 'setup',
    action: 'setup',
    usage: 'setup',
    gloss: 'finish setting the board up',
    more: ['Every step still unticked on docs/kanban/setup-checklist.md,', 'in one run'],
  },
  { command: 'archive', action: 'archive', usage: 'archive <id>', gloss: 'finish the card' },
  { command: 'reject', action: 'reject', usage: 'reject <id> "<why>"', gloss: 'drop the card' },
]

/** The word a person types, and the kind of run it starts — the dispatcher's own table. */
export const RUN_COMMANDS: Record<string, AgentAction> = Object.fromEntries(
  FLOWS.map((flow) => [flow.command, flow.action]),
)

export const flowByCommand = (command: string): Flow | undefined =>
  FLOWS.find((flow) => flow.command === command)

export const flowByAction = (action: AgentAction): Flow | undefined =>
  FLOWS.find((flow) => flow.action === action)

/** The delivery flows. Their rules are frozen with the card the delivery
 *  was approved to build, and their runs are the ones that may not be working in the
 *  project folder. `correct` remains only for an old run resumed after upgrade. */
export const DELIVERY_FLOWS = new Set<AgentAction>(['implement', 'review', 'correct', 'conflict'])
