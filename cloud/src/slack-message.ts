/**
 * One event, as a Slack message (#320).
 *
 * The whole ask is in the message: the card's facts under the title, the paragraph and the
 * review notes it was published with, and the decision as buttons under a divider. Pressing
 * one edits this message in place, so a channel carries one message per piece of work
 * however many times it moves.
 *
 * Three rules shape everything here:
 *
 *   • the board's markup is never posted as written — Slack has its own emphasis, links and
 *     code, and a message full of `**` reads as a bug;
 *   • what does not fit is left behind the card link, cut at a bullet or paragraph
 *     boundary, never dropped silently;
 *   • the card link opens the card for READING. A decision is made in the message, and the
 *     link is never how one is made.
 */

import { API_ORIGIN, SLACK_BLOCK_LIMIT, SLACK_SECTION_LIMIT } from './config.ts'
import type { EventRow } from './events.ts'

/** A Block Kit block. Opaque here: this module composes them and Slack reads them. */
export type Block = Record<string, unknown>

/** The action ids a callback comes back with. Parsed rather than guessed at — see
 *  ./slack-actions.ts, which is the only other place they are named. */
export const ACTION_IMPLEMENT = 'implement'
export const ACTION_ANSWER_OPTION = 'answer_option'
export const ACTION_OPEN_ANSWERS = 'open_answers'
/** What a modal submission is recognised by. */
export const ANSWER_VIEW = 'answers'

/**
 * The nine state names, in Slack's words.
 *
 * They are `cli/src/lib/cloud/events.ts`'s contract, said again here because the Worker
 * cannot import the board's rules. A name invented in one surface would show the user two
 * words for one outcome, so this list is edited only when that one is.
 */
function stateLabel(state: string): string {
  switch (state) {
    case 'actionable':
      return 'Actionable'
    case 'accepted':
      return 'Accepted'
    case 'waiting_for_server':
      return 'Waiting for server'
    case 'running':
      return 'Delivery running'
    case 'completed':
      return 'Delivery completed'
    case 'failed':
      return 'Delivery failed'
    case 'cancelled':
      return 'Delivery cancelled'
    case 'interrupted':
      return 'Delivery interrupted'
    case 'stale':
      return 'No longer waiting'
    default:
      return state
  }
}

/** What the message says under the title while it is still asking. */
const ask = (event: EventRow): string =>
  event.kind === 'question' ? 'Question waiting' : 'Ready for review'

/** The line that takes the buttons' place once the decision is made, and what each state
 *  means for the person reading the channel. */
function stateNote(event: EventRow): string {
  switch (event.state) {
    case 'accepted':
      return 'Recorded. The delivery runs on this board’s own machine.'
    case 'waiting_for_server':
      return event.serverName
        ? `Waiting for ${event.serverName}. It runs as soon as that machine is reachable.`
        : 'This board has no machine attached to run it. Attach one in Configuration → Cloud.'
    case 'running':
      return event.serverName ? `Running on ${event.serverName}.` : 'Running.'
    case 'completed':
      return 'It landed. Open the card to read what changed.'
    case 'failed':
      return 'It stopped. Open the card to read why.'
    case 'interrupted':
      return 'The machine running it went away. Resume or cancel it on that machine.'
    case 'cancelled':
      return 'Cancelled on that machine.'
    case 'stale':
      return 'This task stopped needing a person, and nobody acted on it.'
    default:
      return ''
  }
}

/** Where the card link goes. An https address the service answers by handing the browser
 *  the app's own URL scheme, because Slack takes an http link and nothing else. */
export const cardUrl = (event: EventRow): string =>
  `${API_ORIGIN}/card/${encodeURIComponent(event.boardId)}/${event.taskId}`

/**
 * The message for one event, as Slack takes it.
 *
 * `text` is the notification line — what a phone shows before the message is opened — and
 * the blocks are the message itself.
 */
export function messageFor(event: EventRow): { text: string; blocks: Block[] } {
  const heading = event.state === 'actionable' ? ask(event) : stateLabel(event.state)
  const blocks: Block[] = [
    section(`*${escape(heading)}*\n\`#${event.taskId}\` *${escape(event.taskTitle)}*`),
    context(facts(event)),
  ]

  // The review text, in the order the card writes it. Bounded here rather than on the way
  // in: the event carries what the publisher chose to send, and this is what fits in a
  // message.
  const review = boundedReview(event)
  for (const part of review.parts) blocks.push(section(part))

  if (event.state === 'actionable' && !event.acted) {
    blocks.push({ type: 'divider' })
    blocks.push(...decision(event))
  } else {
    const note = stateNote(event)
    if (note) blocks.push(context(escape(note)))
    blocks.push(linkOnly(event))
  }

  if (review.cut) {
    blocks.push(context(`The rest of this card is behind <${cardUrl(event)}|Open card in app>.`))
  }

  return {
    text: `${heading}: #${event.taskId} ${event.taskTitle}`,
    blocks: blocks.slice(0, SLACK_BLOCK_LIMIT),
  }
}

/** The two facts every message carries under its title: which board, and what it binds. */
function facts(event: EventRow): string {
  const parts = [`*${escape(event.boardName || 'this board')}*`]
  if (event.release) parts.push(`release ${escape(event.release)}`)
  parts.push(`\`rev ${escape(event.revision.slice(0, 12))}\``)
  return parts.join('  ·  ')
}

// --- the decision -------------------------------------------------------------

/**
 * What the message offers.
 *
 * An **Implement** for the exact ready revision, or — for a question — the controls #319's
 * contract allows: an event carrying exactly one single-choice question is a button per
 * option, and anything else opens a modal that submits every answer at once. One press may
 * not spend the event's single action on one question and forfeit the rest.
 */
function decision(event: EventRow): Block[] {
  const link = linkButton(event)
  if (event.decision === 'implement') {
    return [
      actions([
        button('Implement', ACTION_IMPLEMENT, actionValue(event), 'primary'),
        link,
      ]),
      context(
        event.serverName
          ? `Runs on ${escape(event.serverName)} when it is reachable.`
          : 'This board has no machine attached to run it yet.',
      ),
    ]
  }

  const questions = readQuestions(event)
  const only = questions.length === 1 ? questions[0] : undefined
  if (only && only.mode === 'single' && only.options.length > 0) {
    return [
      section(`*${escape(only.text)}*`),
      actions([
        ...only.options.map((option, at) =>
          button(option, `${ACTION_ANSWER_OPTION}:0:${at + 1}`, actionValue(event)),
        ),
        link,
      ]),
      context(escape(recommendation(only)) || 'Leave it alone and the agent researches this one.'),
    ]
  }

  return [
    section(questionList(questions)),
    actions([
      button('Answer', ACTION_OPEN_ANSWERS, actionValue(event), 'primary'),
      link,
    ]),
    context('Every question is answered in one go. A blank one stays open for the agent.'),
  ]
}

/** The questions as a message shows them before the modal is opened — one line each, so a
 *  reader knows what they are being asked before they press. */
function questionList(questions: Question[]): string {
  if (questions.length === 0) return '_This event carries no question._'
  return questions
    .map((q, at) => `*${at + 1}.* ${escape(q.text)}`)
    .join('\n')
    .slice(0, SLACK_SECTION_LIMIT)
}

/** Plain words. The two places this is shown want different things — a message's context
 *  line is mrkdwn and escapes it, a modal's hint is plain text and would show the escape. */
const recommendation = (question: Question): string => {
  const picked = question.recommend
    .map((n) => question.options[n - 1])
    .filter((o): o is string => !!o)
  return picked.length > 0 ? `Recommended: ${picked.join(', ')}` : ''
}

// --- the questions an event carries -------------------------------------------

export interface Question {
  text: string
  mode: 'single' | 'multi'
  options: string[]
  recommend: number[]
}

/** The event's questions, read into the shape both the message and the modal use. The
 *  event is the authority: an answer is read back against the list it was granted against,
 *  never against whatever the card says now. */
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

// --- the review text ----------------------------------------------------------

/**
 * The card's opening paragraph and its review notes, as Slack sections.
 *
 * Cut at a bullet or paragraph boundary rather than mid-sentence, and never dropped
 * silently: `cut` is what puts the "rest is on the card" line at the foot of the message.
 */
function boundedReview(event: EventRow): { parts: string[]; cut: boolean } {
  const parts: string[] = []
  let cut = false
  for (const raw of [event.summary, event.notes]) {
    const held = (raw ?? '').trim()
    if (!held) continue
    const bounded = bound(mrkdwn(held), SLACK_SECTION_LIMIT)
    if (bounded.text) parts.push(bounded.text)
    cut = cut || bounded.cut
  }
  return { parts, cut }
}

/**
 * Cut text to a limit at the last boundary a reader would recognise — a blank line, or the
 * line before a bullet. A single paragraph longer than the whole limit is cut at its last
 * sentence, and failing that at the limit: something has to give, and a hard cut with the
 * rest behind the link beats a message Slack refuses outright.
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

/**
 * The board's Markdown as Slack's own mrkdwn.
 *
 * Slack is not Markdown: emphasis is one asterisk, a link is `<url|text>`, and `&<>` are
 * the three characters that have to be escaped before any of that is written. Escaping
 * first is what keeps a card that mentions `<html>` from composing a link.
 */
export function mrkdwn(markdown: string): string {
  const code: string[] = []
  // Fenced and inline code travel unchanged, so nothing below rewrites what a card meant
  // literally. Taken out first and put back last, against a sentinel no card can type.
  let out = markdown.replace(/```[\s\S]*?```|`[^`\n]+`/g, (held) => {
    code.push(held)
    return `\u0000${code.length - 1}\u0000`
  })

  out = escape(out)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_all, text: string, url: string) => `<${url}|${text}>`)
  // Bold before italic: `**x**` is two of the character italic uses, so the other order
  // turns every bold run into a pair of empty italics. It is held aside and written back
  // once the italics are done.
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '\u0001$1\u0001')
  out = out.replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, '_$1_')
  out = out.replace(/\u0001/g, '*')
  // A heading is a line, not a size, in a message that has no headings.
  out = out.replace(/^#{1,6}\s+(.*)$/gm, '*$1*')
  out = out.replace(/^(\s*)[-*+]\s+/gm, '$1\u2022 ')
  out = out.replace(/\u0000(\d+)\u0000/g, (_all, at: string) => escape(code[Number(at)] ?? ''))
  return out.trim()
}

/** The three characters Slack reads as markup. Everything a card wrote goes through here. */
export const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// --- blocks -------------------------------------------------------------------

const section = (text: string): Block => ({
  type: 'section',
  text: { type: 'mrkdwn', text: text.slice(0, SLACK_SECTION_LIMIT) },
})

const context = (text: string): Block => ({
  type: 'context',
  elements: [{ type: 'mrkdwn', text: text.slice(0, SLACK_SECTION_LIMIT) }],
})

const actions = (elements: Block[]): Block => ({ type: 'actions', elements })

/** What every button carries back: which event it is about, and the revision it was drawn
 *  against, so a press against a card that has moved is refused rather than granted. */
const actionValue = (event: EventRow): string =>
  JSON.stringify({ eventId: event.id, revision: event.revision })

function button(text: string, actionId: string, value: string, style?: 'primary'): Block {
  return {
    type: 'button',
    // Slack refuses a button label past 75 characters, so an option longer than that is cut
    // here rather than costing the whole message.
    text: { type: 'plain_text', text: text.slice(0, 75), emoji: true },
    action_id: actionId,
    value,
    ...(style ? { style } : {}),
  }
}

/** The card link. A URL button carries no action back, which is exactly right: reading the
 *  whole card and deciding are two different moves. */
const linkButton = (event: EventRow): Block => ({
  type: 'button',
  text: { type: 'plain_text', text: 'Open card in app', emoji: true },
  url: cardUrl(event),
  action_id: 'open_card',
})

const linkOnly = (event: EventRow): Block => actions([linkButton(event)])

// --- the modal ----------------------------------------------------------------

/**
 * Every question the event carries, in one view that submits them all at once.
 *
 * The board's own rule holds here as it does everywhere: a ticked option OR the user's own
 * words, never both, and a question left alone stays open for the agent to research. That
 * is why a question with options gets a picker and a question without one gets a box, and
 * why neither is ever required.
 */
export function answerView(event: EventRow): Record<string, unknown> {
  const questions = readQuestions(event)
  // Slack takes 50 blocks in a view too. A card asking more than a modal can hold says so
  // rather than losing the last ones quietly — the unshown ones stay open for the agent,
  // which is what a blank answer means anyway.
  const shown = questions.slice(0, MODAL_QUESTIONS)
  const left = questions.length - shown.length
  return {
    type: 'modal',
    callback_id: ANSWER_VIEW,
    private_metadata: actionValue(event),
    title: { type: 'plain_text', text: `Answer #${event.taskId}`.slice(0, 24) },
    submit: { type: 'plain_text', text: 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      context(`*${escape(event.taskTitle)}*`),
      ...shown.flatMap((question, at) => questionInput(question, at)),
      context(
        left > 0
          ? `A question you leave blank stays open for the agent to research — as do the ${left} more on the card.`
          : 'A question you leave blank stays open for the agent to research.',
      ),
    ].slice(0, SLACK_BLOCK_LIMIT),
  }
}

/** How many questions one view holds, inside Slack's 50 blocks with the two context lines
 *  this view puts around them. */
const MODAL_QUESTIONS = SLACK_BLOCK_LIMIT - 2

/** The block ids a submission is read back from. The index is the question's position in
 *  the event, which is what an answer is matched to — the two sides read their options from
 *  different places, and a position means nothing without the list it indexes. */
export const answerBlockId = (at: number) => `q${at}`
export const ANSWER_ACTION = 'answer'

function questionInput(question: Question, at: number): Block[] {
  const label = {
    type: 'plain_text',
    text: `${at + 1}. ${question.text}`.slice(0, 2000),
    emoji: true,
  }
  if (question.options.length === 0) {
    return [
      {
        type: 'input',
        block_id: answerBlockId(at),
        optional: true,
        label,
        element: { type: 'plain_text_input', action_id: ANSWER_ACTION, multiline: true },
      },
    ]
  }
  const options = question.options.map((option, index) => ({
    text: { type: 'plain_text', text: option.slice(0, 150), emoji: true },
    value: String(index + 1),
  }))
  const hint = recommendation(question)
  return [
    {
      type: 'input',
      block_id: answerBlockId(at),
      optional: true,
      label,
      ...(hint ? { hint: { type: 'plain_text', text: hint.slice(0, 150) } } : {}),
      element: {
        type: question.mode === 'multi' ? 'checkboxes' : 'radio_buttons',
        action_id: ANSWER_ACTION,
        options: options.slice(0, 10),
      },
    },
  ]
}
