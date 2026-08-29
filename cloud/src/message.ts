/**
 * One event, as any connector's message — the parts that are not Slack's and not Lark's.
 *
 * A second connector is a second IMPLEMENTATION, not a second copy: the nine state names,
 * the sentence under a settled decision, the card link, the questions an event carries and
 * the budgets a card's own words are cut to all live here, and each connector adds only what
 * its own markup and its own controls need.
 *
 * One rule shapes the cutting, whichever surface reads it: what does not fit is left behind
 * the card link, cut at a bullet or paragraph boundary. The link is on every message, so no
 * message says it was trimmed.
 */

import { API_ORIGIN } from './config.ts'
import type { EventRow } from './events.ts'

/**
 * The nine state names, said once for every surface.
 *
 * They are `cli/src/lib/cloud/events.ts`'s contract, said again here because the Worker
 * cannot import the board's rules. A name invented in one surface would show the user two
 * words for one outcome, so this list is edited only when that one is.
 *
 * Said as what HAPPENED to the card, never as what the machinery calls it. A delivery is
 * this codebase's word for the run behind an **Implement**, and a channel is read by people
 * who never asked for one: what they pressed is a card, and what they get back is that it
 * landed, or did not.
 */
const STATES: Record<string, string> = {
  actionable: 'Actionable',
  accepted: 'Starting',
  waiting_for_server: 'Waiting for a machine',
  running: 'Working on it',
  completed: 'Landed',
  failed: 'Did not land',
  cancelled: 'Stopped',
  interrupted: 'Interrupted',
  stale: 'No longer waiting',
}

/**
 * The endings the BOARD takes the card back from — every one but a delivery that landed.
 *
 * `closeRun` restores the card and the publisher raises it again seconds later; an
 * `interrupted` is the same card freed later rather than a different fate, because Cloud is
 * only ever told one when NOTHING is carrying the card (`writeOffAbandoned` in
 * `cli/src/lib/cloud/publish.ts`).
 *
 * So a surface never draws one of these as where the card stands. It would put a state
 * carrying no control on the one message every control lives on, for a card that is about to
 * offer **Implement** again. The thread says what happened and what to do; the next event
 * redraws the top.
 *
 * `completed` is where a card stopped, and `stale` is not a delivery ending at all.
 */
export const RESTORED = ['failed', 'cancelled', 'interrupted']

/**
 * Where this event stands: the name a reader sees, and the key a connector looks its own
 * mark up by. The glyph is the surface's — Slack takes `:bell:` and Lark takes the character
 * itself — but the name never varies.
 *
 * `actionable` is the only state that reads differently by kind: it is what the message is
 * asking for.
 */
export function stateOf(event: EventRow): { key: string; label: string } {
  if (event.state === 'actionable') {
    return event.kind === 'question'
      ? { key: 'question', label: 'Question waiting' }
      : { key: 'review', label: 'Ready for review' }
  }
  return { key: event.state, label: STATES[event.state] ?? event.state }
}

/**
 * The line under a decision that has been made — and only where there is one to write.
 *
 * The state line already says the state, and the card link already says where to read the
 * rest. What is left is what a state name cannot carry: which machine, why it ended that way,
 * and what to do about it.
 */
export function stateNote(event: EventRow): string {
  switch (event.state) {
    case 'waiting_for_server':
      return event.serverName
        ? `On ${event.serverName}, as soon as that machine is reachable.`
        : 'This board has no machine attached to run it. Attach one in Configuration → Notifications.'
    case 'running':
      return event.serverName ? `On ${event.serverName}.` : ''
    // What the state name cannot carry: a refused approval and a broken build both read
    // `failed`, and only one of them is fixed by a `git stash`.
    case 'failed':
    case 'cancelled':
      return event.reason
    // Cloud is told this one only when nothing is carrying the card, so it says what happened
    // rather than sending anybody to a machine with nothing left on it to resume.
    case 'interrupted':
      return 'The machine that took this on stopped carrying it.'
    // A card goes quiet because a run picked it up, because it left `ready`, because a
    // blocker opened, or because its release did — and three of those four are good news. The
    // board knows which; the state name cannot say it, so the retirement carries it.
    case 'stale':
      return event.reason || 'The board stopped asking about this card.'
    default:
      return ''
  }
}

/** Where the card link goes. An https address the service answers by handing the browser
 *  the app's own URL scheme, because a chat takes an http link and nothing else. */
export const cardUrl = (event: EventRow): string =>
  `${API_ORIGIN}/card/${encodeURIComponent(event.boardId)}/${event.taskId}`

/** What every control carries back: which event it is about, and the revision it was drawn
 *  against, so a press against a card that has moved is refused rather than granted. */
export const actionValue = (event: EventRow): { eventId: string; revision: string } => ({
  eventId: event.id,
  revision: event.revision,
})

// --- the questions an event carries -------------------------------------------

export interface Question {
  text: string
  mode: 'single' | 'multi'
  options: string[]
  recommend: number[]
}

/** The event's questions, read into the shape every surface's controls use. The event is the
 *  authority: an answer is read back against the list it was granted against, never against
 *  whatever the card says now. */
export function readQuestions(event: EventRow): Question[] {
  const held = Array.isArray(event.questions) ? event.questions : []
  return held.map((raw) => {
    const q = (raw ?? {}) as Record<string, unknown>
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o)) : []
    return {
      text: String(q.text ?? ''),
      mode: q.mode === 'multi' ? 'multi' : 'single',
      options,
      recommend: Array.isArray(q.recommend) ? q.recommend.map(Number).filter(Number.isInteger) : [],
    }
  })
}

/** One answer to one question — a ticked option or the user's own words, never both. */
export interface Answer {
  picked: number[]
  text: string
}

/**
 * The last choice on every options question: none of these, I'll say it myself.
 *
 * The local board offers the same row (kanban-ui/lib/questions.ts), so a card is answered the
 * same way wherever it is read. It is a choice, not an option the card wrote — it never
 * reaches the wire as a pick. Taking it is what makes the words in the box the answer.
 */
export const OWN_WORDS = "Something else — I'll type it"

/** The short form of that choice, for a button that has 75 characters and a row to share. */
export const OWN_WORDS_SHORT = 'Something else…'

/** What that choice carries: one past the options the card wrote, so a surface can tell it
 *  apart from a real pick and drop it before the answer is recorded. */
export const ownWordsValue = (question: Question): number => question.options.length + 1

// --- the review text ----------------------------------------------------------

/** What a message spends on the card's own words. A person scrolling a chat reads a few
 *  lines, and the card is one press away. */
const SUMMARY_BUDGET = 700
const SETTLED_BUDGET = 400
/** The review notes get the whole of what a surface holds. A reviewer decides on what was
 *  flagged, and a note cut to its first sentence loses the half that says why. Both surfaces
 *  cap one block at 3000 characters, so this is the ceiling rather than a taste. */
const NOTES_BUDGET = 3000

/** The board's Markdown as one surface's own markup. */
export type Render = (markdown: string) => string

/**
 * The card's opening paragraph and its review notes, as one part per section.
 *
 * An open decision gets both — the paragraph says what the work is, the notes say what was
 * flagged about doing it. A settled one gets the paragraph alone: by then the
 * message is a record of what happened, its own line says where to read the rest, and nobody
 * re-reads seven review notes to learn that a delivery landed.
 *
 * A message never says it was trimmed. The card link is on every one of them, so a line
 * pointing at a button already on the screen reads as filler.
 */
export function cardWords(event: EventRow, open: boolean, render: Render): string[] {
  const parts: string[] = []
  const summary = bound(render((event.summary ?? '').trim()), open ? SUMMARY_BUDGET : SETTLED_BUDGET)
  if (summary.text) parts.push(summary.text)

  if (!open) return parts
  const notes = (event.notes ?? '').trim()
  if (!notes) return parts

  const bullets = noteBullets(notes, render)
  if (bullets) parts.push(bullets)
  return parts
}

/**
 * The review notes as one bullet each, whole.
 *
 * A card writes a note as `- **what**: why`, wrapped over several lines, so the wrapping is
 * what gets taken out — seven notes should arrive as seven lines rather than forty. The words
 * themselves are not cut: the finding and the argument for it are one thought, and a reviewer
 * deciding off the finding alone is deciding off half of it.
 */
export function noteBullets(notes: string, render: Render): string {
  const lines: string[] = []
  let held: string[] | null = null

  const close = () => {
    if (!held) return
    const whole = held.join(' ').replace(/\s+/g, ' ').trim()
    if (whole) lines.push(`• ${render(whole)}`)
    held = null
  }

  for (const raw of notes.split('\n')) {
    const line = raw.trim()
    if (!line) {
      close()
      continue
    }
    if (/^#{1,6}\s/.test(line)) {
      close()
      lines.push(render(line))
      continue
    }
    const bullet = line.match(/^[-*+]\s+(.*)$/)
    if (bullet) {
      close()
      held = [bullet[1] ?? '']
      continue
    }
    // A wrapped line belongs to the note above it; a paragraph of its own is a note too.
    if (held) held.push(line)
    else held = [line]
  }
  close()

  return bound(lines.join('\n'), NOTES_BUDGET).text
}

/** As much of one line as a limit holds, ending at a word rather than mid-syllable. */
export function clip(text: string, limit: number): string {
  if (text.length <= limit) return text
  const head = text.slice(0, limit - 1)
  const space = head.lastIndexOf(' ')
  return `${(space > limit / 2 ? head.slice(0, space) : head).trimEnd()}…`
}

/**
 * Cut text to a limit at the last boundary a reader would recognise — a blank line, or the
 * line before a bullet. A single paragraph longer than the whole limit is cut at its last
 * sentence, and failing that at the limit: something has to give, and a hard cut with the
 * rest behind the link beats a message the chat refuses outright.
 */
export function bound(text: string, limit: number): { text: string; cut: boolean } {
  if (text.length <= limit) return { text, cut: false }
  const head = text.slice(0, limit)
  const at = Math.max(head.lastIndexOf('\n\n'), head.lastIndexOf('\n• '), head.lastIndexOf('\n- '))
  if (at > limit / 3) return { text: head.slice(0, at).trimEnd(), cut: true }
  const sentence = head.lastIndexOf('. ')
  if (sentence > limit / 3) return { text: head.slice(0, sentence + 1), cut: true }
  return { text: head.trimEnd(), cut: true }
}

// --- one question's options ---------------------------------------------------

/** How long a button label reads well. Past it a chat cuts mid-word, which turns a card's
 *  reasoning into nonsense on the one control that acts on it. */
const OPTION_LABEL = 40

/**
 * An option as a button and as a line.
 *
 * A card writes a long option as `Pick — why it is the one to pick`, so the lead is what a
 * button carries and the rest is what the message says above it. An option with no lead to
 * find is numbered rather than cut: `Option 2` beside the whole sentence says more than
 * two-thirds of that sentence on its own.
 */
export function splitOption(option: string, at = 0): { label: string; why: string } {
  if (option.length <= OPTION_LABEL) return { label: option, why: '' }
  const lead = option.match(/^(.{1,40}?)\s*(?:—|–|:|;|\s-\s)\s+(\S.*)$/s)
  if (!lead?.[1] || !lead[2]) return { label: `Option ${at + 1}`, why: option }
  return { label: lead[1].trim(), why: lead[2].trim() }
}

// --- the board's own wrapping -------------------------------------------------

/**
 * A card's own line breaks, taken out of the paragraph they wrap.
 *
 * Markdown folds a wrapped line into the paragraph above it and a chat keeps it, so a card
 * written at 100 columns arrives on a phone broken every eight words. A bullet, a heading, a
 * quote and a table row start a line of their own; anything else continues the one above.
 *
 * The board's own markup rather than any surface's, so every connector's renderer runs it.
 */
export function unwrap(markdown: string): string {
  const out: string[] = []
  for (const line of markdown.split('\n')) {
    const above = out[out.length - 1]
    const starts = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>|\|)/.test(line)
    const closed = above === undefined || !above.trim() || /^\s*(?:#{1,6}\s|\|)/.test(above)
    if (!line.trim() || starts || closed) out.push(line)
    else out[out.length - 1] = `${above.trimEnd()} ${line.trim()}`
  }
  return out.join('\n')
}
