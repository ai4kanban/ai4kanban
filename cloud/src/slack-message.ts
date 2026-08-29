/**
 * A card, as a Slack message (#320) — and each of its events, as a line in the thread (#359).
 *
 * The whole ask is in the card's message: its facts under the title, the paragraph and the
 * review notes it was published with, and the decision as buttons under a divider. It is
 * rewritten whenever the card moves, so a channel carries one message per piece of work
 * however many times it moves.
 *
 * What the nine states are called, how far a card's own words are cut and where a question's
 * lead ends are ./message.ts's, shared with every other connector. What is Slack's is here:
 * its markup, its blocks, and the modal a whole set of answers is written in.
 *
 * Two rules shape everything below:
 *
 *   • the board's markup is never posted as written — Slack has its own emphasis, links and
 *     code, and a message full of `**` reads as a bug;
 *   • the card link opens the card for READING. A decision is made in the message, and the
 *     link is never how one is made.
 */

import { SLACK_BLOCK_LIMIT, SLACK_SECTION_LIMIT } from './config.ts'
import type { EventRow } from './events.ts'
import {
  RESTORED,
  actionValue as valueFor,
  bound,
  cardUrl,
  cardWords,
  clip,
  readQuestions,
  splitOption,
  stateNote,
  stateOf,
  unwrap,
  type Question,
} from './message.ts'

export { bound, cardUrl, readQuestions, type Question }

/** A Block Kit block. Opaque here: this module composes them and Slack reads them. */
export type Block = Record<string, unknown>

/** The action ids a callback comes back with. Parsed rather than guessed at — see
 *  ./slack-actions.ts, which is the only other place they are named. */
export const ACTION_IMPLEMENT = 'implement'
export const ACTION_ANSWER_OPTION = 'answer_option'
export const ACTION_OPEN_ANSWERS = 'open_answers'
/** What a modal submission is recognised by. */
export const ANSWER_VIEW = 'answers'

/** Slack's own mark for each state name. One glyph is what tells a scrolling reader a
 *  decision from a result; the names themselves are ./message.ts's. */
const MARKS: Record<string, string> = {
  question: ':question:',
  review: ':eyes:',
  actionable: ':bell:',
  accepted: ':ballot_box_with_check:',
  waiting_for_server: ':hourglass_flowing_sand:',
  running: ':hammer_and_wrench:',
  completed: ':white_check_mark:',
  failed: ':x:',
  cancelled: ':no_entry_sign:',
  interrupted: ':warning:',
  stale: ':zzz:',
}

/**
 * The card's own message, drawn from where the card stands now.
 *
 * `text` is the notification line — what a phone shows before the message is opened — and
 * the blocks are the message itself.
 *
 * It is the only message that carries controls (#359): **Implement**, a question's options
 * and the **Answer** button are offered at the top of the thread and nowhere else, so there
 * is one place to act however long the thread grows.
 */
export function messageFor(event: EventRow): { text: string; blocks: Block[] } {
  const open = event.state === 'actionable' && !event.acted
  const { label: heading } = stateOf(event)
  if (event.state === 'stale') {
    return { text: `${heading}: #${event.taskId} ${event.taskTitle}`, blocks: [minimized(event)] }
  }
  const blocks: Block[] = [header(`#${event.taskId} ${event.taskTitle}`), context(facts(event))]

  // The card's own words, cut to what a message is read from rather than what a card holds.
  for (const part of cardWords(event, open, mrkdwn)) blocks.push(section(part))

  if (open) {
    blocks.push({ type: 'divider' })
    blocks.push(...decision(event))
  } else {
    const note = stateNote(event)
    if (note) blocks.push(context(escape(note)))
    blocks.push(linkOnly(event))
  }

  return {
    text: `${heading}: #${event.taskId} ${event.taskTitle}`,
    blocks: blocks.slice(0, SLACK_BLOCK_LIMIT),
  }
}

/**
 * A card nobody is being asked about, as one grey line.
 *
 * `stale` is the only state that asks for nothing AND undoes itself: the board revives this
 * same row the moment the card is actionable again. So the message keeps its place in the
 * channel — deleting it would take the thread's whole log with it — and gives up everything a
 * decision needed. The heading, the card's own words, the facts line and the link as a button
 * are all context for a choice there is no longer a choice to make.
 *
 * What is left is the three things a reader still wants: which card, why it went quiet, and a
 * way back to it. The state name is not one of them — `:zzz:` says it, and the reason says it
 * better.
 */
function minimized(event: EventRow): Block {
  const { key } = stateOf(event)
  const title = escape(`#${event.taskId} ${event.taskTitle}`)
  const why = stateNote(event)
  return context(
    [`${MARKS[key] ?? ''} <${cardUrl(event)}|${title}>`, why && escape(why)]
      .filter(Boolean)
      .join('  ·  '),
  )
}

/**
 * The one line under the title: where this stands, which board it is on, and which release
 * it is promised to.
 *
 * The revision is not on it. It is what a press binds — it travels in the button's value and
 * refuses one made against a card that has moved — but eight opaque characters tell a person
 * reading a channel nothing they can act on.
 */
function facts(event: EventRow): string {
  const { key, label } = stateOf(event)
  const parts = [`${MARKS[key] ?? ''} *${escape(label)}*`, escape(event.boardName || 'this board')]
  if (event.release) parts.push(`release ${escape(event.release)}`)
  return parts.join('  ·  ')
}

/**
 * One event, as a line in the card's thread (#359).
 *
 * The card's message says where the card stands; this says an event arrived, and is never
 * rewritten — the chat's own timestamp is when it happened. So it carries no card words and
 * no controls: both are at the top of the thread, which is the one place to act.
 *
 * A reply pings nobody and nothing is broadcast to the channel, so one recording an event
 * that is asking for a decision names the account Slack was connected as — the one person a
 * press is accepted from. It goes in a section rather than a context, because a mention in a
 * context notifies nobody.
 */
export function logFor(
  event: EventRow,
  actor?: { actorId?: string },
): { text: string; blocks: Block[] } {
  const open = event.state === 'actionable' && !event.acted
  const { key, label } = stateOf(event)
  const said = `${MARKS[key] ?? ''} *${escape(label)}*`
  const actorId = open ? actor?.actorId : undefined
  return {
    text: `${label}: #${event.taskId} ${event.taskTitle}`,
    blocks: [actorId ? section(`${said}  ·  <@${actorId}>`) : context(said)],
  }
}

/**
 * How a delivery ended, as its own line in the card's thread (#359).
 *
 * The top message says where the card stands NOW, so the moment the board raises the card
 * again it stops saying the delivery was refused and why. That reason is the one thing in the
 * chat a person has to act on — a `git stash` fixes one failure and nothing fixes another — so
 * it gets a reply the next rewrite cannot take away.
 *
 * It pings nobody. The fresh ask posted under it is what asks for a decision, and two mentions
 * a second apart read as two things to do.
 */
export function endingFor(event: EventRow): { text: string; blocks: Block[] } {
  const { key, label } = stateOf(event)
  const why = stateNote(event)
  const said = [`${MARKS[key] ?? ''} *${escape(label)}*`, why && escape(why), whatNext(event, why)]
    .filter(Boolean)
    .join('\n')
  return {
    text: [`${label}: #${event.taskId} ${event.taskTitle}`, why].filter(Boolean).join(' — '),
    // A section rather than a context: what to do next is the point of the line, and a context
    // sets it in the grey a reader skips.
    blocks: [why || whatNext(event, why) ? section(said) : context(said)],
  }
}

/**
 * What to do now the delivery is over.
 *
 * A state name and a reason say what went wrong and neither says what happens next, so the
 * line that carries them says it: the card comes back, and the control is the one at the top
 * of this thread rather than a second one down here.
 */
function whatNext(event: EventRow, why: string): string {
  if (!RESTORED.includes(event.state)) return ''
  const first = event.state === 'failed' && why ? 'Fix that and press' : 'Press'
  return `The card is back to *Ready for review*. ${first} *Implement* again at the top of this thread.`
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
    const split = only.options.map(splitOption)
    // The options are written out only when a button could not carry one whole. Saying the
    // same four words twice is what makes a message look padded.
    const spelt = split.some((o) => o.why)
    const asked = `*${escape(only.text)}*`
    const starred = (at: number) => only.recommend.includes(at + 1)
    return [
      section(
        spelt ? `${asked}\n${split.map((o, at) => optionLine(o, at, starred(at))).join('\n')}` : asked,
      ),
      actions([
        ...split.map((option, at) =>
          button(
            starred(at) ? `${STAR} ${option.label}` : option.label,
            `${ACTION_ANSWER_OPTION}:0:${at + 1}`,
            actionValue(event),
          ),
        ),
        link,
      ]),
      context('Leave it alone and the agent researches this one.'),
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
  if (questions.length === 1) return `*${escape(questions[0]?.text ?? '')}*`.slice(0, SLACK_SECTION_LIMIT)
  return questions
    .map((q, at) => `*${at + 1}.* ${escape(q.text)}`)
    .join('\n')
    .slice(0, SLACK_SECTION_LIMIT)
}

/** What the card recommends, on the option itself rather than in a sentence under it. One
 *  mark on the thing you press beats a line naming it again. */
const STAR = ':star:'

/** The option as the message spells it out, numbered to the button under it and starred in
 *  the margin when the card recommends it. A lead the card did not write is not invented
 *  here — that option is its number and its words. */
function optionLine(option: { label: string; why: string }, at: number, starred: boolean): string {
  const said =
    option.why && option.label !== `Option ${at + 1}`
      ? `*${at + 1}. ${escape(option.label)}* — ${escape(option.why)}`
      : `*${at + 1}.* ${escape(option.why || option.label)}`
  return starred ? `${STAR} ${said}` : said
}

// --- the board's markup, as Slack's own ---------------------------------------

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

  out = unwrap(out)
  out = escape(out)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(_all, text: string, url: string) => `<${url}|${text}>`)
  // Bold before italic: `**x**` is two of the character italic uses, so the other order
  // turns every bold run into a pair of empty italics. It is held aside and written back
  // once the italics are done.
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '\u0001$1\u0001')
  out = out.replace(/(?<![\w*])\*([^*\n]+)\*(?![\w*])/g, '_$1_')
  out = out.replace(/\u0001/g, '*')
  // A heading is a line, not a size, in a message that has no headings.
  out = out.replace(/^#{1,6}\s+(.*)$/gm, '*$1*')
  out = out.replace(/^(\s*)[-*+]\s+/gm, '$1• ')
  out = out.replace(/\u0000(\d+)\u0000/g, (_all, at: string) => escape(code[Number(at)] ?? ''))
  return out.trim()
}

/** The three characters Slack reads as markup. Everything a card wrote goes through here. */
export const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// --- blocks -------------------------------------------------------------------

/** The title, as the message's own heading. Plain text — nothing is escaped for it, because
 *  Slack shows an escape as written — and cut at the 150 characters a header holds. */
const header = (text: string): Block => ({
  type: 'header',
  text: { type: 'plain_text', text: text.slice(0, 150), emoji: true },
})

const section = (text: string): Block => ({
  type: 'section',
  text: { type: 'mrkdwn', text: text.slice(0, SLACK_SECTION_LIMIT) },
})

const context = (text: string): Block => ({
  type: 'context',
  elements: [{ type: 'mrkdwn', text: text.slice(0, SLACK_SECTION_LIMIT) }],
})

const actions = (elements: Block[]): Block => ({ type: 'actions', elements })

/** Slack carries a button's value as a string, so what every control carries back is written
 *  out here and read back in ./slack-actions.ts. */
const actionValue = (event: EventRow): string => JSON.stringify(valueFor(event))

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
      ...shown.flatMap((question, at) => questionInput(question, at, shown.length)),
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

function questionInput(question: Question, at: number, of: number): Block[] {
  const label = {
    type: 'plain_text',
    text: (of > 1 ? `${at + 1}. ${question.text}` : question.text).slice(0, 2000),
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
  // Slack refuses an option past 150 characters, so a long one ends at a word rather than
  // wherever the 150th character happens to land. The star is the whole of what the card
  // recommends, on the option itself — the same mark the message shows.
  const options = question.options.map((option, index) => ({
    text: {
      type: 'plain_text',
      text: question.recommend.includes(index + 1)
        ? `${STAR} ${clip(option, 143)}`
        : clip(option, 150),
      emoji: true,
    },
    value: String(index + 1),
  }))
  return [
    {
      type: 'input',
      block_id: answerBlockId(at),
      optional: true,
      label,
      element: {
        type: question.mode === 'multi' ? 'checkboxes' : 'radio_buttons',
        action_id: ANSWER_ACTION,
        options: options.slice(0, 10),
      },
    },
  ]
}
