// The board's first-run conversation (#280).
//
// The app's first run used to be a form: the project in one screen of boxes,
// the goal in another. It talks now — the agent reads the repo, says what it thinks the
// project is, and the user agrees or says what is wrong. What the agent answers with is not
// prose but one JSON block, because the board writes the answer itself: nothing reaches disk
// until the user presses Yes, and then it is the same move the form's screen called.
//
// The instructions live in `guide/setup.md` and are embedded here rather than pointed at, so
// a turn that never ran `akb guide setup` still knows the shape it has to answer in. One
// source of text, two readers.

import setupGuide from '../../guide/setup.md'
import { readSetupDraft } from '../view/first-run'
import type { SetupProposal } from './types'

/** The guide section the conversation is run from. Named here and in `guide/setup.md`; a
 *  rename in one place without the other leaves the prompt without its instructions, which
 *  the test below is what catches. */
const SECTION = 'The first-run conversation'

/** One `## ` section of a guide, heading and all. Empty when the guide has no such
 *  section — then the prompt carries the subject alone, which is a worse conversation and
 *  not a broken one. */
function section(text: string, title: string): string {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.trim() === `## ${title}`)
  if (start === -1) return ''
  let end = start + 1
  while (end < lines.length && !/^## /.test(lines[end]!)) end++
  return lines.slice(start, end).join('\n').trim()
}

/** What the setup conversation is about, in front of every fresh session: the instructions,
 *  in full. */
export function setupSubject(): string {
  const instructions = section(setupGuide, SECTION)
  return [
    "This is the board app's first run. You are being asked one thing: what this project is.",
    instructions,
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** The board's own opening turn — the first thing said in the conversation, and not the
 *  user's words. It carries what the board already holds so an answer given in the
 *  terminal is stated back rather than guessed at again. */
export function setupOpening(): string {
  let held = ''
  try {
    const draft = readSetupDraft()
    held = [
      draft.project.name ? `The config names the project "${draft.project.name}".` : '',
      draft.project.description ? `It says it is: ${draft.project.description}` : '',
    ]
      .filter(Boolean)
      .join(' ')
  } catch {
    // A board too fresh to read is a board with nothing to state back. The agent reads the
    // repo either way.
  }
  return ['Read this repo and answer with what you think this project is.', held]
    .filter(Boolean)
    .join(' ')
}

/** The line every later turn carries. The session already holds the instructions; what it
 *  drifts away from over a long conversation is the shape of the answer. */
export const SETUP_REMINDER = 'Answer again with the same JSON block, rewritten.'

// ---- reading the answer -----------------------------------------------------

/** The proposal out of one reply, or null when the agent answered with no block this can be
 *  read from. The LAST block wins: an agent that shows its working writes the final answer
 *  last, and one that quotes the example writes its own answer after it. */
export function parseSetupProposal(reply: string): SetupProposal | null {
  for (const block of blocks(reply).reverse()) {
    const parsed = readProposal(block)
    if (parsed) return parsed
  }
  return null
}

/** Every fenced block in a reply, innards only. Any language tag: an agent asked for `json`
 *  sometimes writes the fence bare. */
function blocks(text: string): string[] {
  const out: string[] = []
  const fence = /```[a-zA-Z]*\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = fence.exec(text))) out.push(m[1]!)
  return out
}

function readProposal(text: string): SetupProposal | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const str = (key: string): string => (typeof o[key] === 'string' ? (o[key] as string).trim() : '')
  const name = str('name')
  const summary = str('summary')
  const unsure = o.unsure === true
  // A block with neither a name nor a sentence is not an answer to this question — it is
  // some other JSON the agent happened to print.
  if (!unsure && !name) return null
  if (!summary) return null
  return {
    summary,
    name,
    description: str('description'),
    unsure,
    ask: str('ask'),
  }
}
