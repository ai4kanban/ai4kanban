// Printing a board action instead of running it.
//
// Every command that starts a run has a second mode: `--print` says what to do and starts
// nothing. It is for the agent that is already in the conversation — asked for a board
// action by the person typing, it does the job itself rather than paying for a second agent
// to do the job it is sitting there to do. The rule for choosing between the two modes is
// written beside each command in `akb help`, so it is read where the choice is made.
//
// What comes out is filled in from THIS board: the card's own path, the steps it has left,
// the memory file its modules point at, the tracks this project uses, the release it is in.
// A page of general advice is a page the reader has to go and look everything up from.
//
// And it is only what the job needs — asking about one card never prints the manual. The
// flows this action needs come out in full (`lib/guide.ts`), because a pointer to a second
// command is a step an agent skips; every other flow is `akb guide <topic>` away.
//
// The words at the top are `buildPrompt`'s, unchanged. That is the point: a job done from a
// printed flow and the same job done by a button are given the same instruction, so both
// land the same result.
//
// One thing a printed flow has to say that a run never does: how the job closes. A run the
// board started is watched, and the watcher does the bookkeeping at the end — putting the
// card's stage back, stamping a recurring run, starting the refines that follow. Nothing is
// watching an agent that followed a printed flow, so every one of these ends by naming the
// command that closes the job, and the action it hands over to when it hands over.

import fs from 'node:fs'
import path from 'node:path'

import { idPrefix, locate } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { say } from '../io'
import { findGuide } from '../guide'
import { die, rel, GOAL, MEMORY, MODULES_MD, SETUP_CHECKLIST, TODO } from '../paths'
import { readReleaseEntries } from '../releases'
import type { Meta, MoveResult } from '../types'
import { moduleNames } from '../validate'
import { buildPrompt } from './prompts'
import { setupInstruction } from './resolve'
import type { AgentAction, AgentRequest } from './types'

/** The variable a run the board started puts on the agent it spawns, holding that run's id.
 *
 *  It is the one case where the mode is not the caller's to pick: an agent working inside a
 *  run that asks for a board action gets the flow printed, so a run can never spawn a copy
 *  of itself. Anywhere else, guessing from the environment would take away the background
 *  run a user deliberately asked for. */
export const RUN_ENV = 'KANBAN_RUN'

/** The run this process is working inside, when the board started it — otherwise null. */
export function insideRun(): string | null {
  const id = process.env[RUN_ENV]
  return id && id.trim() ? id.trim() : null
}

// How many of a card's remaining steps are printed before the rest are counted instead. A
// long card's whole plan is in the file the flow names; the point here is to show what is
// left, not to copy the card.
const MAX_STEPS = 12

// ---- what the board says right now -----------------------------------------

/** One card, as a printed flow reads it. */
interface CardFacts {
  id: number
  /** The card file, repo-relative — the path as it really is, ready to open. */
  file: string
  meta: Meta
  /** The unticked `## Todo` boxes, in order. */
  steps: string[]
  /** How many boxes are already ticked. Ticked boxes are history, so this is what the job
   *  must not touch. */
  ticked: number
  /** The card carries a `## Process` — the run instructions of a recurring card. */
  hasProcess: boolean
  /** The card sits in `todo/recurring/`, so it is a job that repeats and never finishes. */
  recurring: boolean
}

function readCard(id: number): CardFacts {
  const found = locate(id)
  if (!found) {
    die(`no card #${id} on this board. \`akb board list\` says what is open.`, {
      kind: 'card-not-found',
      id,
    })
  }
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  let text: string
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    die(`#${id} is on the board but ${rel(file)} can't be read.`, { kind: 'card-unreadable', id })
  }
  const { meta, body } = parseFrontmatter(text)
  if (!meta) {
    die(`${rel(file)} has no frontmatter — run \`akb board migrate\` before working on it.`, {
      kind: 'card-unreadable',
      id,
    })
  }
  const { steps, ticked } = readTodo(body)
  return {
    id,
    file: rel(file),
    meta,
    steps,
    ticked,
    hasProcess: /^##\s+Process\s*$/im.test(body),
    recurring: found.rel.split(path.sep)[0] === 'recurring',
  }
}

// The `## Todo` boxes: what is left, and how many are ticked. A card body hard-wraps, so a
// step runs over several lines — the continuation lines are folded back onto the box they
// belong to, because half a sentence is not a step.
function readTodo(body: string): { steps: string[]; ticked: number } {
  const steps: string[] = []
  let ticked = 0
  let inTodo = false
  let open = false // the last box read was an unticked one, so a wrapped line belongs to it
  for (const line of body.split('\n')) {
    if (/^##\s/.test(line)) {
      inTodo = /^##\s+Todo\s*$/i.test(line)
      open = false
      continue
    }
    if (!inTodo) continue
    const box = line.match(/^\s*[-*]\s+\[([ xX])\]\s*(.*)$/)
    if (box) {
      if (box[1] === ' ') {
        steps.push(box[2]!.trim())
        open = true
      } else {
        ticked++
        open = false
      }
      continue
    }
    if (open && /^\s+\S/.test(line)) steps[steps.length - 1] += ` ${line.trim()}`
    else if (!line.trim()) open = false
  }
  return { steps, ticked }
}

// The buckets a card can live in on this board, read off the folders rather than described
// in general. Id-prefixed folders are group tasks, not tracks.
function trackNames(): string[] {
  try {
    return fs
      .readdirSync(TODO, { withFileTypes: true })
      .filter((e) => e.isDirectory() && idPrefix(e.name) === null)
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

// Which copy of a memory file a note belongs in — "The memory set" in `akb guide board`, read
// only: the named module's copy, both when the card names two, the project-wide one when it
// names none. It never scaffolds, because printing a flow must not write to the board.
function memoryFiles(modules: string[], name: string): string[] {
  const dirs = modules.length ? modules.map((m) => path.join(MEMORY, m)) : [MEMORY]
  return dirs.map((dir) => rel(path.join(dir, name)))
}

// ---- laying one out --------------------------------------------------------

// A flow is built as sections, then printed. Keeping it as data until the end is what lets
// `--json` hand a caller the same flow the terminal shows.
interface Section {
  head: string
  lines: string[]
}

const LABEL = 10

// `label   text`, with anything after the first line lined up under the text.
function field(label: string, text: string | string[]): string[] {
  const body = Array.isArray(text) ? text : [text]
  const pad = ' '.repeat(LABEL)
  return body.map((line, i) => `${i === 0 ? label.padEnd(LABEL) : pad}${line}`)
}

const numbered = (items: string[]): string[] => items.map((s, i) => `${i + 1}. ${s}`)

// The card's meta as one line — the fields a job actually steers by, and nothing it can
// read off the file itself in a second.
function metaLine(meta: Meta): string {
  const bits = [meta.track, meta.status || 'todo', `priority ${meta.priority}`, `roi ${meta.roi}`]
  if (meta.release) bits.push(`release ${meta.release}`)
  if (meta.modules.length) bits.push(`modules ${meta.modules.join(', ')}`)
  if (meta.cadence) bits.push(`every ${meta.cadence}`)
  if (meta.blocked_by.length) bits.push(`blocked by ${meta.blocked_by.map((n) => `#${n}`).join(', ')}`)
  // The board is holding a run for this card already — worth saying, because doing that job
  // here means the queued one has nothing left to do when it fires.
  if (meta.schedule) bits.push(`scheduled to ${meta.schedule.action}`)
  return bits.join(' · ')
}

// What is left of the plan. The remaining boxes are the job; the ticked ones are history and
// are counted rather than listed, so nobody re-does them.
function stepsField(card: CardFacts): string[] {
  if (!card.steps.length) {
    return field('steps', card.ticked ? `none left — all ${card.ticked} ticked` : 'the card has no ## Todo yet')
  }
  const shown = card.steps.slice(0, MAX_STEPS)
  const head = `${card.steps.length} left${card.ticked ? `, ${card.ticked} ticked already` : ''}:`
  const rest = card.steps.length > shown.length ? [`… and ${card.steps.length - shown.length} more in the card`] : []
  return field('steps', [head, ...numbered(shown).map((s) => `  ${s}`), ...rest])
}

// The same plan, counted rather than listed — for a job that isn't working through the
// steps and only needs to know whether any are left.
function stepsCount(card: CardFacts): string[] {
  if (!card.steps.length) return field('steps', `all ${card.ticked} ticked`)
  return field(
    'steps',
    `${card.steps.length} of ${card.steps.length + card.ticked} still unticked — read them in the card before you go on`,
  )
}

// The open questions, numbered as the board numbers them — the numbers are what
// `update-questions` and `tag` take, so a flow that lists them differently is a flow that
// gets the wrong question answered.
function questionsField(meta: Meta): string[] {
  if (!meta.questions.length) return field('questions', 'none open')
  const lines = meta.questions.map((q, i) => `${i + 1}. ${q.text}${q.options?.length ? ` (${q.options.length} options)` : ''}`)
  return field('questions', [`${meta.questions.length} open:`, ...lines.map((s) => `  ${s}`)])
}

// ---- the flows -------------------------------------------------------------

// One printed flow, before it is printed.
interface Flow {
  /** The line that says what this is and that nothing started. */
  lead: string
  /** What the board says about the job, filled in from this board. */
  facts: string[]
  /** The guides this action is done by, by name — printed in full, in this order. */
  guides: string[]
  /** The steps that close the job, in order — the bookkeeping no watcher will do. */
  close: string[]
  /** The action this job hands over to, and when. */
  next: string[]
}

/** The flows each action is done by. `board` opens every card action, because the card
 *  format, the memory set and the layout are what all of them are written against — the
 *  short note installed in a project no longer carries any of it.
 *
 *  Order matters: the general rules first, then the flow for this one job. */
const GUIDES_FOR: Record<AgentAction, string[]> = {
  implement: ['board', 'document-feature'],
  run: ['board', 'recurring-task'],
  'auto-refine': ['board', 'auto-refine', 'refine', 'resolve'],
  resolve: ['board', 'resolve'],
  edit: ['board', 'refine'],
  create: ['board', 'add-task'],
  propose: ['board', 'propose', 'add-task'],
  'plan-release': ['board', 'releases', 'plan-release', 'add-task'],
  archive: ['board'],
  reject: ['board', 'reject'],
}

/** Build the flow for one action. A `board` command spelled out here is spelled with the
 *  program the caller was typed as, so what is printed can be pasted back. */
function buildFlow(req: AgentRequest, program: string): Flow {
  const board = `${program} board`
  const facts: string[] = []
  const close: string[] = []
  const next: string[] = []
  const card = req.id !== undefined ? readCard(req.id) : null

  // Every card action opens the same way: where the card is, and what it says about itself.
  if (card) {
    facts.push(...field('card', card.file), ...field('meta', metaLine(card.meta)))
  }

  switch (req.action) {
    case 'implement': {
      facts.push(...stepsField(card!))
      if (card!.meta.questions.length) facts.push(...questionsField(card!.meta))
      facts.push(...field('memory', memoryFiles(card!.meta.modules, 'readme.md')))
      close.push(
        'tick each box in ## Todo as you finish it — they are the record of what was built',
        `write the shipped line in the memory file above — "Finish a task" in \`akb guide board\``,
        `${board} archive ${req.id} — once every box is ticked and the card's goal is met`,
      )
      if (card!.meta.questions.length) {
        next.push(
          `${program} resolve ${req.id} --print — first: the card has open questions, and building on a guess is what they are there to stop`,
        )
      }
      break
    }
    case 'run': {
      facts.push(
        ...field('process', card!.hasProcess ? `the job is the card's ## Process — do its steps in order` : `the card has no ## Process — there is nothing to run`),
      )
      close.push(
        `${board} record-run ${req.id} — counts this pass and stamps last_run`,
        `never archive it: a recurring card has no end state`,
      )
      next.push(
        `${program} resolve ${req.id} --print — for any question this pass left on the card; nothing else on the board resolves a recurring card`,
      )
      break
    }
    case 'auto-refine': {
      facts.push(...stepsField(card!), ...questionsField(card!.meta))
      facts.push(...field('tracks', trackNames().join(', ') || '(none)'))
      facts.push(...field('goal', rel(GOAL)))
      close.push(
        `${board} update-questions ${req.id} --append ".." — for each call that is really the user's`,
        `${board} tag ${req.id} <n> user — hand the ones only they can settle over`,
        `${board} update ${req.id} --status ready — only when the plan is concrete and no question is open`,
      )
      if (card!.meta.questions.length) {
        next.push(`${program} resolve ${req.id} --print — first: a card with open questions can't be refined`)
      }
      break
    }
    case 'resolve': {
      facts.push(...questionsField(card!.meta))
      facts.push(...field('memory', memoryFiles(card!.meta.modules, 'decisions.md')))
      close.push(
        `${board} update-questions ${req.id} --drop <n> — take each question you answered off`,
        `${board} tag ${req.id} <n> user — for the ones only the user can settle, worded as they stand`,
        `write what you decided under "## Decided by the agent" on the card, one line each`,
      )
      next.push(
        req.andImplement
          ? `${program} implement ${req.id} --print — carry straight on, but only if nothing real is left for the user`
          : `${program} implement ${req.id} --print — once every question is settled`,
      )
      break
    }
    case 'edit': {
      facts.push(...field('note', req.notes ?? '(none)'))
      facts.push(...stepsCount(card!))
      close.push(
        `${board} update ${req.id} [--title|--priority|--roi|--release|--modules|--track|--blocked-by|--related] — the fields are the command's, never hand-written`,
        'the body is yours to write — the summary, ## Scope and ## Todo',
      )
      next.push(`${program} refine ${req.id} --print — a run would have refined this card afterwards`)
      break
    }
    case 'create':
    case 'propose':
    case 'plan-release': {
      facts.push(...field('tracks', trackNames().join(', ') || '(none)'))
      facts.push(...field('modules', (moduleNames() ?? []).join(', ') || `(none — ${rel(MODULES_MD)})`))
      if (req.action === 'plan-release') {
        const entry = readReleaseEntries().find((e) => e.id === req.release)
        facts.push(
          ...field('release', entry ? `${entry.id} — ${entry.goal || '(no goal on its line)'}` : `${req.release} — not on the release list`),
        )
      } else {
        const releases = readReleaseEntries().map((e) => e.id)
        facts.push(...field('releases', releases.join(', ') || '(none open)'))
      }
      if (req.action === 'propose') facts.push(...field('goal', rel(GOAL)), ...field('memory', rel(MEMORY)))
      close.push(
        `${board} create --title ".." --track <track>${req.release ? ` --release ${req.release}` : ''} — one call per card; it takes the id, writes the fields and indexes it`,
        'then write only the body: the summary line, ## Scope, ## Todo',
      )
      next.push(`${program} refine <id> --print — a run would have refined each new card`)
      break
    }
    case 'archive': {
      facts.push(...stepsCount(card!))
      facts.push(...field('memory', memoryFiles(card!.meta.modules, 'readme.md')))
      close.push(
        'write the shipped line first — one line for what a user can now see or do, nothing for an internal-only change',
        `${board} archive ${req.id} — it files the card, drops it from the index, and prints what still mentions it`,
      )
      next.push(`${program} refine <id> --print — for each card this one was holding up`)
      break
    }
    case 'reject': {
      facts.push(...field('reason', req.reason ?? '(none given)'))
      facts.push(...field('memory', memoryFiles(card!.meta.modules, 'rejected.md')))
      close.push(
        'write the rejection note first — the idea and why we said no',
        `${board} reject ${req.id} — this deletes the card; the receipt prints it out one last time`,
      )
      next.push(`${program} refine <id> --print — for each card this one was holding up`)
      break
    }
  }

  return { lead: leadLine(req, program), facts, guides: GUIDES_FOR[req.action], close, next }
}

// What the flow opens with: the action, what it is on, and — plainly — that nothing started.
function leadLine(req: AgentRequest, program: string): string {
  const what = req.id !== undefined ? `#${req.id}` : req.release ? `"${req.release}"` : ''
  return `${req.action}${what ? ` ${what}` : ''} — printed, not started. Do it here, in this session (${program}).`
}

// ---- printing it -----------------------------------------------------------

/** Print the flow for one action and start nothing. The result is the same flow as data, so
 *  a caller reading `--json` gets what the terminal was shown. */
export function printFlow(req: AgentRequest, program = 'akb'): MoveResult {
  const flow = buildFlow(req, program)
  const prompt = buildPrompt(req)
  const sections: Section[] = [
    { head: 'the ask — the same words a run would have been given:', lines: [prompt] },
  ]
  if (flow.facts.length) sections.push({ head: 'this board:', lines: flow.facts })
  sections.push({
    head: 'closing it — no run is watching this one finish, so the bookkeeping is yours:',
    lines: numbered(flow.close),
  })
  // Named, not left to a guess: a job that hands over part-way is where an agent working
  // without a run to follow it most often stops.
  if (flow.next.length) sections.push({ head: 'handing over — the action to reach for, and when:', lines: flow.next })

  say(flow.lead)
  // The setup gate, when it is up. Not a refusal: setup's own last step is to write the
  // first cards, and refusing would block the one flow that has to run while the checklist
  // is still there.
  if (fs.existsSync(SETUP_CHECKLIST)) {
    say('')
    say(`this board is not set up yet — ${rel(SETUP_CHECKLIST)} is still there.`)
    say(`finish it first: ${setupInstruction()}`)
  }
  for (const section of sections) {
    say('')
    say(section.head)
    say('')
    for (const line of section.lines) say(`  ${line}`)
  }
  // Last, and unindented: the flows themselves, in full. They are markdown and they are
  // long, so they go after the short board-specific part rather than burying it — and they
  // are printed rather than named, because a pointer to a second command is a step that
  // gets skipped, and the job is then done from memory instead of from the flow.
  const guides = flow.guides.map(findGuide).filter((g): g is NonNullable<typeof g> => g !== null)
  if (guides.length) {
    say('')
    say(`the flows this is done by — each one is also \`${program} guide <topic>\`:`)
    for (const guide of guides) {
      say('')
      say(`——— ${program} guide ${guide.name} ———`)
      say('')
      say(guide.text.trimEnd())
    }
  }
  return {
    mode: 'print',
    action: req.action,
    cardId: req.id ?? null,
    prompt,
    guides: flow.guides,
    close: flow.close,
    next: flow.next,
  }
}
