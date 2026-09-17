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
// Whichever text comes out, `docs/kanban` in it is swapped for the board's real path
// (`boardText`), so an agent on a board beside `docs/` writes into that board's own
// `memory/`.

import addTask from '../guide/add-task.md'
import board from '../guide/board.md'
import cardChat from '../guide/card-chat.md'
import changelog from '../guide/changelog.md'
import conflict from '../guide/conflict.md'
import decide from '../guide/decide.md'
import discussIdea from '../guide/discuss-idea.md'
import documentFeature from '../guide/document-feature.md'
import evaluateTask from '../guide/evaluate-task.md'
import extractIdeas from '../guide/extract-ideas.md'
import feedback from '../guide/feedback.md'
import followUp from '../guide/follow-up.md'
import gate from '../guide/gate.md'
import implement from '../guide/implement.md'
import localUi from '../guide/local-ui.md'
import moduleMap from '../guide/module-map.md'
import nextCard from '../guide/next-card.md'
import planRelease from '../guide/plan-release.md'
import pruneMemory from '../guide/prune-memory.md'
import reviewMemory from '../guide/review-memory.md'
import qaLightweight from '../guide/qa-lightweight.md'
import qaLoop from '../guide/qa-loop.md'
import recurringTask from '../guide/recurring-task.md'
import reflect from '../guide/reflect.md'
import reject from '../guide/reject.md'
import review from '../guide/review.md'
import releases from '../guide/releases.md'
import resolve from '../guide/resolve.md'
import revise from '../guide/revise.md'
import setup from '../guide/setup.md'
import specAgent from '../guide/spec-agent.md'
import triage from '../guide/triage.md'
import unstick from '../guide/unstick.md'
import update from '../guide/update.md'
import updateQuestions from '../guide/update-questions.md'
import writing from '../guide/writing.md'

import { boardText } from './paths'

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
  { name: 'follow-up', when: 'place additional work and prepare context for a follow-up card', text: followUp },
  { name: 'discuss-idea', when: 'help decide whether an idea is worth building, and hand what it settled to planning', text: discussIdea },
  { name: 'card-chat', when: "answer a card's conversation, and act on what each turn settles", text: cardChat },
  { name: 'feedback', when: 'understand what a spec got wrong, and collect the case for it', text: feedback },
  { name: 'next-card', when: 'name which cards already on the board to build now', text: nextCard },
  { name: 'implement', when: 'build a settled card and stop cleanly on an execution blocker', text: implement },
  { name: 'extract-ideas', when: 'pull task ideas out of an article, a report, or feedback', text: extractIdeas },
  { name: 'update-questions', when: 'classify open questions, answered decisions, and human checks', text: updateQuestions },
  { name: 'gate', when: 'judge whether a settled card can be built with nobody watching', text: gate },
  { name: 'qa-loop', when: "settle one task's planning gaps and leave only the user's", text: qaLoop },
  { name: 'qa-lightweight', when: 'check one clear, localized task with a short evidence walk', text: qaLightweight },
  { name: 'revise', when: 'make the one change to a card the user asked for', text: revise },
  { name: 'resolve', when: "apply the user's answers to a card's open questions", text: resolve },
  { name: 'decide', when: "answer a card's open questions in the user's place", text: decide },
  { name: 'reject', when: 'drop a card, and write down why', text: reject },
  { name: 'review', when: "review and fix a delivery against the approved requirements", text: review },
  { name: 'conflict', when: "resolve the conflict in a delivery's landing rebase", text: conflict },
  { name: 'recurring-task', when: 'run one pass of a job we repeat', text: recurringTask },
  { name: 'releases', when: 'the versions being planned, and how a card joins one', text: releases },
  { name: 'plan-release', when: 'fill a release from its goal', text: planRelease },
  { name: 'changelog', when: "write a closed version's changelog from what its close wrote down", text: changelog },
  { name: 'document-feature', when: 'which docs a change has to update', text: documentFeature },
  { name: 'prune-memory', when: 'compress the memory set back to what helps planning', text: pruneMemory },
  { name: 'review-memory', when: 'read what the conversations settled, and write it into memory', text: reviewMemory },
  { name: 'reflect', when: 'propose the work a just-completed card leaves behind', text: reflect },
  { name: 'triage', when: 'judge what is waiting in triage: card the worthwhile, ignore the rest', text: triage },
  { name: 'unstick', when: 'settle a card that sat too long: keep it rewritten, or discard it', text: unstick },
  { name: 'spec-agent', when: "fill one part of a card's spec, as the agent that owns it", text: specAgent },
  { name: 'module-map', when: 'write or rebuild docs/kanban/modules.md', text: moduleMap },
  { name: 'setup', when: "setup's own steps, while the checklist is still there", text: setup },
  { name: 'update', when: 'pull a newer version into a project that already has one', text: update },
  { name: 'local-ui', when: 'run the board from buttons instead of the terminal', text: localUi },
]

/** The names this board answers to. */
export const guideNames = (): string[] => GUIDES.map((g) => g.name)

/** Names a flow answered to before it was renamed. Asked for by the old one, the flow still
 *  comes back — every board, card and habit that spells it the old way keeps working. */
const RENAMED: Record<string, string> = {
  'spec-skill': 'spec-agent',
}

/** One flow as this board reads it, spelling this board's own path. */
export function findGuide(name: string): Guide | null {
  const wanted = RENAMED[name] ?? name
  const guide = GUIDES.find((g) => g.name === wanted)
  return guide ? { ...guide, text: boardText(guide.text) } : null
}

/** The list of flows, one line each — what `akb guide` with no topic prints. */
export function guideList(program: string): string {
  const guides = GUIDES
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
