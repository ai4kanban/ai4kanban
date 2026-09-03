// ---- the setup checklist ---------------------------------------------------
//
// Setup keeps its own steps in `docs/kanban/setup-checklist.md`. The file's presence is
// the flag: it is there while setup is unfinished, and the tick that closes the last box
// deletes it. So a board with no file is a board that is set up — which is what keeps
// boards made before this file existed quiet. An empty board is not a flag: no checklist
// and no cards means setup finished and the backlog ran out, nothing more.
//
// The script owns the file the way it owns the rest of the board's state: it writes it
// once, when a fresh board is scaffolded, and each setup step ticks its own box by name.
// Nobody hand-edits it, so the local UI can rely on its shape.

import fs from 'node:fs'
import path from 'node:path'

import { CONFIG, rel, SETUP_CHECKLIST, TODO, readNextId, writeNextId } from './paths'
import { serializeFrontmatter, parseFrontmatter } from './frontmatter'
import { addReadmeRef, stripReadmeRefs } from './readme'
import { walkMd, idPrefix } from './cards'
import type { Meta } from './types'

// Who does a setup step: the script itself, an agent run, or the user.
export type StepOwner = 'script' | 'agent' | 'you'

export interface SetupStep {
  name: string
  owner: StepOwner
  text: string
}

/** One line of the checklist as it stands on the board. */
export interface ChecklistStep extends SetupStep {
  done: boolean
}

/** What the questions card became when the last box was ticked. */
export interface QuestionsCardFate {
  id: number | null
  kept: boolean
  questions?: number
}

/** What ticking a box did — see tickSetupStep. */
export interface TickResult {
  missing?: boolean
  unknown?: boolean
  already?: boolean
  ok?: boolean
  done?: number
  total?: number
  finished?: boolean
  questionsCard?: QuestionsCardFate | null
}

// The steps, in the order setup runs them. `owner` says who does the step — `script` is
// already done by the time the file is written, `agent` needs a run that reads the repo and
// thinks, `you` is the user's own. The three `you` steps come first and in one block: they
// are what only the user knows, and the local UI settles them on its guided first run — the
// agent picked, then a conversation, then the goal (#172, #280). It reads the owner to
// decide whether it can ask for a step itself or has to hand it to a coding agent; it never
// learns the names of the steps.
//
// `agent` is a step because a board that ticked every box without one can't run anything:
// the steps below it are agent runs, and so is every button on the board.
export const SETUP_STEPS: SetupStep[] = [
  { name: 'install', owner: 'script', text: 'Install the `akb` command and scaffold the board.' },
  { name: 'config', owner: 'script', text: 'Seed the board with practical default settings.' },
  { name: 'project', owner: 'you', text: 'Say what this project is and what tracks its work falls into, in `docs/kanban/config.md`.' },
  { name: 'goal', owner: 'you', text: 'Write the project goal in `docs/kanban/memory/goal.md`.' },
  { name: 'agent', owner: 'you', text: 'Pick the agent that runs this board, and give it a key.' },
  { name: 'decisions', owner: 'agent', text: 'Settle `docs/kanban/memory/decisions.md` from the goal.' },
  { name: 'modules', owner: 'agent', text: 'Write `docs/kanban/modules.md`, then move each settled call into its module\'s memory.' },
  { name: 'tasks', owner: 'agent', text: 'Create the first tasks.' },
]

// The boxes install itself finishes. They are written ticked, so a user who installs and
// stops there opens the UI onto a bar that says what is actually left.
const DONE_AT_INSTALL = ['install', 'config']

const HEADER = `# Setup checklist

Setup's own steps, in order. Each step ticks its box when it finishes; the tick that closes
the last box deletes this file, so a board without it is a board that is set up.

The guide for each step is \`akb guide setup\` — start at the first unticked box and follow
it in order.

The board writes this file — \`akb raw setup-done <step>\` ticks one box. Don't edit it by
hand: the local board UI reads its shape to show how far setup got and what comes next.

`

const line = (step: SetupStep, done: boolean): string => `- [${done ? 'x' : ' '}] \`${step.name}\` (${step.owner}) — ${step.text}`

const LINE_RE = /^- \[([ xX])\][ \t]+`([a-z][a-z0-9-]*)`[ \t]+\((script|agent|you)\)[ \t]+—[ \t]+(.+?)[ \t]*$/

/** True while setup is unfinished — the one test every flow uses. */
export function setupUnfinished(): boolean {
  return fs.existsSync(SETUP_CHECKLIST)
}

/** The checklist as a list of steps, or null when there is none (setup is done). */
export function readSetupChecklist(): ChecklistStep[] | null {
  if (!setupUnfinished()) return null
  const steps: ChecklistStep[] = []
  for (const raw of fs.readFileSync(SETUP_CHECKLIST, 'utf8').split('\n')) {
    const m = raw.match(LINE_RE)
    if (m) steps.push({ done: m[1] !== ' ', name: m[2]!, owner: m[3] as StepOwner, text: m[4]! })
  }
  return steps
}

// Write the checklist. Only the fresh scaffold calls this: repairing an older board must
// never plant one, or a board set up long ago would start asking to be set up again.
export function writeSetupChecklist(): void {
  const body = SETUP_STEPS.map((s) => line(s, DONE_AT_INSTALL.includes(s.name))).join('\n')
  fs.writeFileSync(SETUP_CHECKLIST, `${HEADER}${body}\n`)
}

/**
 * Tick one box by name. Returns what happened, for the command to report:
 *   { missing: true }                       — no checklist; this board is already set up
 *   { unknown: true }                       — no such step in this board's checklist
 *   { already: true, done, total }          — that box was ticked before
 *   { ok: true, done, total, finished }     — ticked; `finished` means the file is gone,
 *     and `questionsCard` says what became of the questions card ({ id, kept, questions? }
 *     — kept with its open count, or removed because it stayed empty; null if long gone)
 */
export function tickSetupStep(name: string): TickResult {
  if (!setupUnfinished()) return { missing: true }
  const text = fs.readFileSync(SETUP_CHECKLIST, 'utf8')
  const lines = text.split('\n')
  let found: { index: number; done: boolean } | null = null
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(LINE_RE)
    if (!m || m[2] !== name) continue
    found = { index: i, done: m[1] !== ' ' }
    break
  }
  if (!found) return { unknown: true }
  const steps = readSetupChecklist() ?? []
  const total = steps.length
  if (found.done) return { already: true, done: steps.filter((s) => s.done).length, total }
  lines[found.index] = lines[found.index]!.replace(/^- \[ \]/, '- [x]')
  const done = steps.filter((s) => s.done).length + 1
  // The last tick deletes the file rather than leaving a fully ticked list behind: kept,
  // it would be clutter that also contradicts the flag.
  if (done >= total) {
    fs.rmSync(SETUP_CHECKLIST)
    swapConfigGateForDone()
    return { ok: true, done, total, finished: true, questionsCard: dropSetupQuestionsCardIfEmpty() }
  }
  fs.writeFileSync(SETUP_CHECKLIST, lines.join('\n'))
  return { ok: true, done, total, finished: false }
}

// The config's first entry is the setup gate. Left on a finished board it reads wrong —
// a set-up board telling agents to go finish setup — so the tick that finishes setup
// swaps the whole bullet for this line. A config without the bullet is left alone.
const CONFIG_SETUP_DONE = '- **Setup** — this board is set up; plan and create cards freely.'

function swapConfigGateForDone(): void {
  if (!fs.existsSync(CONFIG)) return
  const lines = fs.readFileSync(CONFIG, 'utf8').split('\n')
  const start = lines.findIndex((l) => l.startsWith('- **Setup gate**'))
  if (start === -1) return
  let end = start + 1
  while (end < lines.length && /^\s+\S/.test(lines[end]!)) end++
  lines.splice(start, end - start, CONFIG_SETUP_DONE)
  fs.writeFileSync(CONFIG, lines.join('\n'))
}

// ---- the setup questions card ----------------------------------------------
//
// Setup never stops to ask the user anything but the goal. Every other call it can't
// settle is appended, the moment it comes up, to one card the scaffold creates alongside
// the checklist — created first so it takes the board's first id and sorts on top. The
// tick that finishes setup removes the card again if nothing ever landed on it.

export const SETUP_QUESTIONS_SLUG = 'answer-the-questions-setup-couldnt-settle'
const SETUP_QUESTIONS_TITLE = "Answer the questions setup couldn't settle"

const SETUP_QUESTIONS_BODY = `The calls setup could not settle on its own — each step appends its own here as it runs.
Answer them through the resolve flow: each answer becomes a line in the project-wide
\`docs/kanban/memory/decisions.md\`, and the card is done when no question is left. It
holds no build work, so no todos.
`

// Written by the fresh scaffold, and by init's repair when a mid-setup board lacks it —
// same test as the checklist: while that file exists, this card is expected. Not counted
// in metrics: it is setup furniture, not planned work.
export function writeSetupQuestionsCard(track: string): { id: number; file: string } | null {
  const id = readNextId()
  const fileRel = path.join(track, `${id}-${SETUP_QUESTIONS_SLUG}.md`)
  const file = path.join(TODO, fileRel)
  if (fs.existsSync(file)) return null
  writeNextId(id + 1)
  const meta: Partial<Meta> = { title: SETUP_QUESTIONS_TITLE, track, priority: 'high', roi: 'high', status: 'todo', release: '', blocked_by: [], related: [], modules: [], questions: [] }
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n\n' + SETUP_QUESTIONS_BODY)
  addReadmeRef(track, id, SETUP_QUESTIONS_TITLE, fileRel)
  return { id, file }
}

/** The questions card wherever it sits, with its open-question count. Null when gone. */
export function findSetupQuestionsCard(): { id: number | null; file: string; questions: number } | null {
  const file = walkMd(TODO).find((f) => path.basename(f).endsWith(`-${SETUP_QUESTIONS_SLUG}.md`))
  if (!file) return null
  const { meta } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  return { id: idPrefix(path.basename(file)), file, questions: meta?.questions?.length ?? 0 }
}

// An empty questions card left behind would be the board's first card saying nothing, so
// the final tick clears it when setup settled everything itself. One with questions
// stays — the user answers it through the resolve flow.
function dropSetupQuestionsCardIfEmpty(): QuestionsCardFate | null {
  const card = findSetupQuestionsCard()
  if (!card) return null
  if (card.questions > 0) return { id: card.id, kept: true, questions: card.questions }
  fs.rmSync(card.file)
  stripReadmeRefs({ kind: 'file', rel: path.relative(TODO, card.file) })
  return { id: card.id, kept: false }
}

/** The first unticked step — what setup does next. Null when there is no checklist. */
export function nextSetupStep(): ChecklistStep | null {
  const steps = readSetupChecklist()
  return steps ? steps.find((s) => !s.done) || null : null
}

/** The one line every flow prints when it stops because setup is unfinished. */
export function setupUnfinishedMessage(): string {
  const next = nextSetupStep()
  const where = rel(SETUP_CHECKLIST)
  return next
    ? `setup isn't finished — ${where} is still waiting on \`${next.name}\` (${next.owner}): ${next.text}`
    : `setup isn't finished — see ${where}`
}
