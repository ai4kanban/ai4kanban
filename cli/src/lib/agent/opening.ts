// What a conversation opens with.
//
// Someone who types `/kanban #12` into a coding agent gets a session that has read the
// board's rules, knows what the project is for, has the card in front of it, and knows which
// command answers which kind of ask. A chat starts from the same place — otherwise the user
// spends the first three messages explaining their own project.
//
// So `akb chat` builds the opening and sends it, the same way `akb <action> --print` hands a
// run the board's facts and the flow together (agent/flow.ts). Sending the agent off to
// fetch them instead would cost a round trip before every conversation's first answer.
//
// Sent ONCE, in front of the first message. Every message after it lands in the session that
// already has it, so the tenth costs what the first did — which is also why this is a
// snapshot of the board rather than a live view, and why the flow tells the chat to look up
// anything its answer really turns on.
//
// Two things are deliberately not in it. The memory set: the largest thing a chat could
// carry, needed by few messages, so the opening names its folders instead. And the skill: a
// board arrives without one, so an opening that leaned on it would only work for the users
// it exists to spare.

import fs from 'node:fs'
import path from 'node:path'

import { findGuide } from '../guide'
import { CONFIG, GOAL, MEMORY, MODULES_MD, SETUP_CHECKLIST, TODO, rel } from '../paths'
import { readReleaseEntries } from '../releases'
import { readModules } from '../view/first-run'
import { readGoalBody } from '../view/goal'
import { allCards } from '../view/read'
import type { Card } from '../view/types'
import { boardCommand, commandNote } from './command'
import { field, metaLine, trackNames } from './facts'
import { agentManual } from './manual'

/** The opening one conversation starts with — the board as it stands, the chat flow, and the
 *  board's own command list, in that order.
 *
 *  `title` is the card's title as the caller already knows it, so a card the board can no
 *  longer read is still named rather than shown as a bare number. */
export function chatOpening(cardId: number | null, title?: string): string {
  const command = boardCommand()
  const about = cardId === null ? "this project's kanban board" : `task #${cardId} on this project's kanban board`
  const parts = [
    [
      `This is a conversation about ${about}, not a job to go away and do.`,
      `Answer from this project, and keep it short unless I ask for more.`,
      `Change nothing — no card, no file, no code — unless I ask you to.`,
      commandNote(command),
    ]
      .filter(Boolean)
      .join(' '),
    [
      `Below: the board as it stood when we started, the flow a conversation follows, and`,
      `every command the board answers to. You are being sent this once — everything I say`,
      `after it lands in the same session, so it is all still here.`,
    ].join(' '),
    section('the board, when we started', boardFacts()),
  ]
  if (cardId !== null) parts.push(section(`#${cardId} — the card we are talking about`, cardFacts(cardId, title)))
  const config = configText()
  if (config) parts.push(section(`this project's settings — ${rel(CONFIG)}`, config.split('\n')))
  const flow = findGuide('chat')
  if (flow) parts.push(section(`${command} guide chat — the flow this conversation follows`, flow.text.trimEnd().split('\n')))
  parts.push(section(`${command} help — which command answers which ask`, agentManual(command).split('\n')))
  return parts.join('\n\n')
}

const section = (head: string, lines: string[]): string => [`——— ${head} ———`, '', ...lines].join('\n')

// ---- the board -------------------------------------------------------------

function boardFacts(): string[] {
  const out = [...goalField(), ...field('tracks', trackLine()), ...modulesField(), ...memoryField(), ...releasesField(), ...openField()]
  // Said before anything else it changes the meaning of: a half-built board explains a thin
  // module map and a board with three cards on it.
  if (fs.existsSync(SETUP_CHECKLIST)) {
    out.unshift(
      ...field('setup', [
        `unfinished — ${rel(SETUP_CHECKLIST)} is still there, so parts of this board are not written yet.`,
        `Say so once when it matters; \`${boardCommand()} setup\` finishes it.`,
      ]),
    )
  }
  return out
}

// The goal in the user's own words, whole. A board with none says so rather than handing
// over the placeholder a new board ships with — a chat that read that text as the goal would
// answer every question about direction from it.
function goalField(): string[] {
  let text = ''
  try {
    text = fs.readFileSync(GOAL, 'utf8')
  } catch {
    // No file. Same answer as an empty one.
  }
  const { body, written } = readGoalBody(text)
  if (!written) {
    return field('goal', [
      `not written yet — ${rel(GOAL)} is empty.`,
      `Don't invent one, and answer from the cards and the memory instead.`,
    ])
  }
  return field('goal', [`${rel(GOAL)}, in the user's own words:`, ...indent(body)])
}

// The tracks as folders, not as the settings describe them: a folder is what a card really
// lives in.
const trackLine = (): string => trackNames().join(', ') || '(none)'

function modulesField(): string[] {
  const text = readFile(MODULES_MD)
  if (!text) return field('modules', `(none — ${rel(MODULES_MD)} is not written yet)`)
  return field('modules', [`${rel(MODULES_MD)}:`, ...indent(text)])
}

// Where the memory is, not what it says. The flow tells the chat to read it before it
// suggests anything; this is the address.
function memoryField(): string[] {
  const modules = readModules()
  const lines = [
    `not sent — read it before you suggest anything. Four files in each folder:`,
    `  readme.md (what shipped), decisions.md (what was settled),`,
    `  rejected.md (what was turned down), redesign.md (what to avoid)`,
    `${rel(MEMORY)}/ — the project as a whole`,
  ]
  for (const name of modules) {
    const dir = path.join(MEMORY, name)
    lines.push(`${rel(dir)}/ — the ${name} module${fs.existsSync(dir) ? '' : ' (no folder yet)'}`)
  }
  return field('memory', lines)
}

function releasesField(): string[] {
  const entries = readReleaseEntries()
  if (!entries.length) return field('releases', '(none open)')
  return field(
    'releases',
    entries.map((e) => `${e.id}${e.goal ? ` — ${e.goal}` : ''}`),
  )
}

// Every open card, one line each: its number, title, track, status, and whether it has
// questions nobody has answered. Never a card's body — that is what a card chat is for.
function openField(): string[] {
  const cards = [...allCards()].sort((a, b) => a.track.localeCompare(b.track) || a.id - b.id)
  if (!cards.length) return field('open', 'nothing on the board')
  return field('open', [`${cards.length} card${cards.length === 1 ? '' : 's'}:`, ...indent(cards.map(cardLine).join('\n'))])
}

function cardLine(card: Card): string {
  const bits = [card.track, card.status || 'todo']
  if (card.isGroup) bits.push('a group task')
  if (card.recurring) bits.push(card.cadence ? `repeats every ${card.cadence}` : 'repeats when asked')
  if (card.questions.length) bits.push(`${card.questions.length} open question${card.questions.length === 1 ? '' : 's'}`)
  const group = groupOf(card)
  if (group !== null) bits.push(`part of #${group}`)
  return `#${card.id} "${card.title}" — ${bits.join(' · ')}`
}

// The group a subtask belongs to: the id on the folder its file sits in. Null for a
// standalone card, and null for the group's own root — a card is not part of itself.
function groupOf(card: Card): number | null {
  for (const part of card.relPath.split('/').slice(0, -1)) {
    const m = part.match(/^(\d+)-/)
    if (m && Number(m[1]) !== card.id) return Number(m[1])
  }
  return null
}

// ---- the one card ----------------------------------------------------------

// A card chat gets the card whole. A summary would be the board's reading of it, and the
// card is the one thing that conversation is certainly about.
function cardFacts(cardId: number, title?: string): string[] {
  const cards = allCards()
  const card = cards.find((c) => c.id === cardId)
  if (!card) {
    return field('card', `#${cardId}${title ? ` ("${title}")` : ''} is not on the board any more — it was archived or rejected.`)
  }
  const named = (id: number): string => {
    const other = cards.find((c) => c.id === id)
    return other ? `#${id} ("${other.title}")` : `#${id} (not on the board any more)`
  }
  const out = [
    ...field('card', `${rel(path.join(TODO, card.relPath))} — "${card.title}"`),
    ...field('meta', metaLine(card)),
    ...questionsField(card),
  ]
  const group = groupOf(card)
  if (group !== null) out.push(...field('part of', `${named(group)} — the group task this one is a subtask of`))
  if (card.blocked_by.length) out.push(...field('waits on', card.blocked_by.map(named)))
  const related = card.related.filter((id) => id !== group)
  if (related.length) out.push(...field('related', related.map(named)))
  out.push('', 'the card in full, as it stands:', '', ...indent(card.body))
  return out
}

function questionsField(card: Card): string[] {
  if (!card.questions.length) return field('questions', 'none open')
  const lines = card.questions.map((q, i) => {
    const options = q.options?.length ? ` (${q.options.length} options)` : ''
    return `${i + 1}. ${q.text}${options}`
  })
  return field('questions', [`${card.questions.length} open:`, ...indent(lines.join('\n'))])
}

// ---- odds and ends ---------------------------------------------------------

const indent = (text: string | string[]): string[] =>
  (Array.isArray(text) ? text.join('\n') : text)
    .trimEnd()
    .split('\n')
    .map((line) => `  ${line}`)

function readFile(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    return ''
  }
}

const configText = (): string => readFile(CONFIG)
