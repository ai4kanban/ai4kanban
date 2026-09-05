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
//
// And two solutions (#406, #407). `product` is the text below. `marketing` is a second copy
// of the flows that read differently there — the rest it inherits unchanged, because a flow
// copied to say the same thing is a flow that goes stale. Which one a board gets is the one
// `Solution` line in its own `config.md`; a board with no line is `product`.
//
// Whichever text comes out, `docs/kanban` in it is swapped for the board's real path
// (`boardText`), so an agent on `marketing/kanban` writes to `marketing/kanban/memory/`.

import addTask from '../guide/add-task.md'
import board from '../guide/board.md'
import changelog from '../guide/changelog.md'
import conflict from '../guide/conflict.md'
import documentFeature from '../guide/document-feature.md'
import evaluateTask from '../guide/evaluate-task.md'
import extractIdeas from '../guide/extract-ideas.md'
import implement from '../guide/implement.md'
import localUi from '../guide/local-ui.md'
import moduleMap from '../guide/module-map.md'
import nextCard from '../guide/next-card.md'
import planRelease from '../guide/plan-release.md'
import propose from '../guide/propose.md'
import pruneMemory from '../guide/prune-memory.md'
import qaLightweight from '../guide/qa-lightweight.md'
import qaLoop from '../guide/qa-loop.md'
import recurringTask from '../guide/recurring-task.md'
import reject from '../guide/reject.md'
import review from '../guide/review.md'
import releases from '../guide/releases.md'
import resolve from '../guide/resolve.md'
import revise from '../guide/revise.md'
import setup from '../guide/setup.md'
import specAgent from '../guide/spec-agent.md'
import update from '../guide/update.md'
import updateQuestions from '../guide/update-questions.md'
import validateOnReddit from '../guide/validate-on-reddit.md'
import writeAgent from '../guide/write-agent.md'
import writing from '../guide/writing.md'

import marketingBoard from '../guide/marketing/board.md'
import marketingChannel from '../guide/marketing/channel.md'
import marketingImplement from '../guide/marketing/implement.md'
import marketingPruneMemory from '../guide/marketing/prune-memory.md'
import marketingWriting from '../guide/marketing/writing.md'

import { boardText } from './paths'
import { solution, type Solution } from './solution'

/** One flow: the name it is asked for by, the one line the list shows, and the text. */
export interface Guide {
  name: string
  /** What it is for, in one line — this is what the list is read for. */
  when: string
  text: string
}

export const GUIDES: Guide[] = [
  { name: 'board', when: 'how this board works — layout, memory, the rules every flow stands on', text: board },
  { name: 'writing', when: "write a card body — its format, and the rules every card is held to", text: writing },
  { name: 'evaluate-task', when: 'check one task idea before it becomes a card', text: evaluateTask },
  { name: 'add-task', when: 'turn one idea into a card', text: addTask },
  { name: 'next-card', when: 'name which cards already on the board to build now', text: nextCard },
  { name: 'implement', when: 'build a settled card and stop cleanly on an execution blocker', text: implement },
  { name: 'propose', when: 'find the work the board is missing and write it', text: propose },
  { name: 'extract-ideas', when: 'pull task ideas out of an article, a report, or feedback', text: extractIdeas },
  { name: 'update-questions', when: 'classify open questions, answered decisions, and human checks', text: updateQuestions },
  { name: 'qa-loop', when: "settle one task's planning gaps and leave only the user's", text: qaLoop },
  { name: 'qa-lightweight', when: 'check one clear, localized task with a short evidence walk', text: qaLightweight },
  { name: 'revise', when: 'make the one change to a card the user asked for', text: revise },
  { name: 'resolve', when: "apply the user's answers to a card's open questions", text: resolve },
  { name: 'reject', when: 'drop a card, and write down why', text: reject },
  { name: 'review', when: "review and fix a delivery against the approved requirements", text: review },
  { name: 'conflict', when: "resolve the conflict in a delivery's landing rebase", text: conflict },
  { name: 'recurring-task', when: 'run one pass of a job we repeat', text: recurringTask },
  { name: 'releases', when: 'the versions being planned, and how a card joins one', text: releases },
  { name: 'plan-release', when: 'fill a release from its goal', text: planRelease },
  { name: 'changelog', when: "write a closed version's changelog from what its close wrote down", text: changelog },
  { name: 'document-feature', when: 'which docs a change has to update', text: documentFeature },
  { name: 'prune-memory', when: 'compress the memory set back to what helps planning', text: pruneMemory },
  { name: 'spec-agent', when: "fill one part of a card's spec, as the agent that owns it", text: specAgent },
  { name: 'module-map', when: 'write or rebuild docs/kanban/modules.md', text: moduleMap },
  { name: 'setup', when: "setup's own steps, while the checklist is still there", text: setup },
  { name: 'update', when: 'pull a newer version into a project that already has one', text: update },
  { name: 'local-ui', when: 'run the board from buttons instead of the terminal', text: localUi },
  { name: 'validate-on-reddit', when: 'check an idea against what people actually say', text: validateOnReddit },
]

/** The flows one solution says differently. Everything not named here is the text above. */
const OVERRIDES: Record<Solution, Record<string, string>> = {
  product: {},
  marketing: {
    board: marketingBoard,
    implement: marketingImplement,
    'prune-memory': marketingPruneMemory,
    writing: marketingWriting,
  },
}

/** The flows one solution has that the other has no use for. Not an override: a `channel`
 *  flow on a product board would be a page about work that board cannot do. */
const EXTRA: Record<Solution, Guide[]> = {
  product: [],
  marketing: [
    { name: 'channel', when: "repurpose a topic's draft for one channel", text: marketingChannel },
    // A product board has no writer to join, so nothing there could ever ask for one.
    { name: 'write-agent', when: "write part of a topic's draft folder, as the agent asked for it", text: writeAgent },
  ],
}

/** Every flow THIS board reads: the shared list in its solution's words, then the flows that
 *  solution has of its own. */
function guidesHere(): Guide[] {
  const which = solution()
  return [...GUIDES.map((g) => ({ ...g, text: OVERRIDES[which][g.name] ?? g.text })), ...EXTRA[which]]
}

/** The names this board answers to — its solution's, so a topic it has no use for is not
 *  offered and a topic only it has is. */
export const guideNames = (): string[] => guidesHere().map((g) => g.name)

/** Names a flow answered to before it was renamed. Asked for by the old one, the flow still
 *  comes back — every board, card and habit that spells it the old way keeps working. */
const RENAMED: Record<string, string> = { 'spec-skill': 'spec-agent' }

/** One flow as this board reads it: its solution's words, spelling this board's own path. */
export function findGuide(name: string): Guide | null {
  const wanted = RENAMED[name] ?? name
  const guide = guidesHere().find((g) => g.name === wanted)
  return guide ? { ...guide, text: boardText(guide.text) } : null
}

/** The list of flows, one line each — what `akb guide` with no topic prints. */
export function guideList(program: string): string {
  const guides = guidesHere()
  // Wide enough for the longest name plus a gap, worked out rather than typed so adding a
  // longer one can't quietly run the two columns together.
  const col = Math.max(...guides.map((g) => g.name.length)) + 4
  const line = (g: Guide) => `  ${g.name.padEnd(col - 2)}${g.when}`
  const out = [
    `${program} guide <topic> — the board's flows, shipped with this command.`,
    '',
    'A flow is what to do for one kind of board work, in full. You rarely need to ask for',
    `one by name: \`${program} <action> --print\` prints the flow for that action already,`,
    'filled in for the board it was asked about.',
    '',
    'Flows',
    ...guides.map(line),
  ]
  return boardText(out.join('\n'))
}
