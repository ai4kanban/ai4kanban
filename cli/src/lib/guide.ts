// The flows, shipped with the command.
//
// They used to be `references/*.md` inside the folder installed into each project — a
// thousand lines of instructions copied per project, going stale the moment they were
// copied, and only upgradable by re-installing. They live here now: bundled into the one
// built file, so upgrading `akb` upgrades every flow in every project at once, and the
// folder a project holds is a short note that points here.
//
// The markdown is still markdown — the bundler inlines each file as a string
// (`loader: {'.md': 'text'}` in scripts/build.mjs). Edit the `.md`, not a string literal.
//
// Two doors onto the same text:
//   - `akb guide <topic>` — ask for one by name,
//   - a printed flow (`akb <action> --print`) — the guides that action needs, printed in
//     full beside the board's own facts, so the agent needs one command and not two.

import addTask from '../guide/add-task.md'
import board from '../guide/board.md'
import chat from '../guide/chat.md'
import documentFeature from '../guide/document-feature.md'
import extractIdeas from '../guide/extract-ideas.md'
import localUi from '../guide/local-ui.md'
import moduleMap from '../guide/module-map.md'
import planRelease from '../guide/plan-release.md'
import presetIndieHacker from '../guide/preset-indie-hacker.md'
import presetValidateOnReddit from '../guide/preset-validate-on-reddit.md'
import propose from '../guide/propose.md'
import pruneMemory from '../guide/prune-memory.md'
import recurringTask from '../guide/recurring-task.md'
import refine from '../guide/refine.md'
import reject from '../guide/reject.md'
import releases from '../guide/releases.md'
import resolve from '../guide/resolve.md'
import revise from '../guide/revise.md'
import setup from '../guide/setup.md'
import specAgent from '../guide/spec-agent.md'
import uiDesign from '../guide/ui-design.md'
import update from '../guide/update.md'

/** One flow: the name it is asked for by, the one line the list shows, and the text. */
export interface Guide {
  name: string
  /** What it is for, in one line — this is what the list is read for. */
  when: string
  text: string
  /** A bundle for one kind of project rather than a flow every board runs. Listed apart so
   *  the everyday list stays short. */
  preset?: boolean
}

export const GUIDES: Guide[] = [
  { name: 'board', when: 'how this board works — card format, layout, memory, the rules every flow stands on', text: board },
  { name: 'add-task', when: 'turn one idea into a card', text: addTask },
  { name: 'propose', when: 'find the work the board is missing and write it', text: propose },
  { name: 'extract-ideas', when: 'pull task ideas out of an article, a report, or feedback', text: extractIdeas },
  { name: 'refine', when: 'take one card from vague to ready — refine and resolve in a loop', text: refine },
  { name: 'revise', when: 'make the one change to a card the user asked for', text: revise },
  { name: 'resolve', when: "answer a card's open questions, and hand the user's own back", text: resolve },
  { name: 'reject', when: 'drop a card, and write down why', text: reject },
  { name: 'recurring-task', when: 'run one pass of a job we repeat', text: recurringTask },
  { name: 'releases', when: 'the versions being planned, and how a card joins one', text: releases },
  { name: 'plan-release', when: 'fill a release from its goal', text: planRelease },
  { name: 'document-feature', when: 'which docs a change has to update', text: documentFeature },
  { name: 'chat', when: 'hold a conversation about the board or one card — what it opens with, what it changes, and what it starts a run for', text: chat },
  { name: 'prune-memory', when: 'compress the memory set back to what helps planning', text: pruneMemory },
  { name: 'spec-agent', when: "fill one part of a card's spec, as the named agent that owns it", text: specAgent },
  { name: 'ui-design', when: 'plan a card that changes a screen — how to describe it, and how to ask which layout', text: uiDesign },
  { name: 'module-map', when: 'write or rebuild docs/kanban/modules.md', text: moduleMap },
  { name: 'setup', when: "setup's own steps, while the checklist is still there", text: setup },
  { name: 'update', when: 'pull a newer version into a project that already has one', text: update },
  { name: 'local-ui', when: 'run the board from buttons instead of the terminal', text: localUi },
  { name: 'preset-indie-hacker', when: 'extra tracks and reviews for a solo product launch', text: presetIndieHacker, preset: true },
  { name: 'preset-validate-on-reddit', when: 'check an idea against what people actually say', text: presetValidateOnReddit, preset: true },
]

export const GUIDE_NAMES = GUIDES.map((g) => g.name)

export const findGuide = (name: string): Guide | null => GUIDES.find((g) => g.name === name) ?? null

// Wide enough for the longest name plus a gap, worked out rather than typed so adding a
// longer one can't quietly run the two columns together.
const NAME_COL = Math.max(...GUIDES.map((g) => g.name.length)) + 4

/** The list of flows, one line each — what `akb guide` with no topic prints. */
export function guideList(program: string): string {
  const line = (g: Guide) => `  ${g.name.padEnd(NAME_COL - 2)}${g.when}`
  const out = [
    `${program} guide <topic> — the board's flows, shipped with this command.`,
    '',
    'A flow is what to do for one kind of board work, in full. You rarely need to ask for',
    `one by name: \`${program} <action> --print\` prints the flow for that action already,`,
    'filled in for the board it was asked about.',
    '',
    'Flows',
    ...GUIDES.filter((g) => !g.preset).map(line),
    '',
    'Presets — optional bundles for one kind of project; a board uses one only if its',
    'docs/kanban/config.md names it',
    ...GUIDES.filter((g) => g.preset).map(line),
  ]
  return out.join('\n')
}
