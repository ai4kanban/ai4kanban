/**
 * One event, as a Lark card (#351).
 *
 * The whole ask is in the card: the card's facts under the title, the paragraph and the
 * review notes it was published with, and the decision as buttons under a rule. Pressing one
 * edits this message in place, so a chat carries one message per piece of work however many
 * times it moves.
 *
 * What the nine states are called, how far a card's own words are cut and where a question's
 * lead ends are ./message.ts's, shared with Slack. What is Lark's is here: `lark_md`, Card
 * Kit's own elements, and the form that submits every answer in one action — Lark has no
 * modal, and Cloud records one action per event, so one press may not spend it on the first
 * question and forfeit the rest.
 */

import { LARK_ELEMENT_LIMIT, LARK_TEXT_LIMIT } from './config.ts'
import type { EventRow } from './events.ts'
import {
  actionValue,
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

/** A Card Kit element. Opaque here: this module composes them and Lark reads them. */
export type Element = Record<string, unknown>

/** What a press carries back in its `value`, beside the event and the revision. Read in
 *  ./lark-actions.ts, which is the only other place these are named. */
export const ACT_IMPLEMENT = 'implement'
export const ACT_OPTION = 'option'
export const ACT_ANSWERS = 'answers'

/** The form a whole set of answers is submitted from, and the key each question's control
 *  comes back under. The index is the question's position in the EVENT — the two sides read
 *  their options from different places, and a position means nothing without its list. */
export const ANSWER_FORM = 'answers'
export const answerField = (at: number): string => `q${at}`

/** Lark's own mark and header colour for each state name. One glyph is what tells a scrolling
 *  reader a decision from a result; the names themselves are ./message.ts's. */
const MARKS: Record<string, [mark: string, template: string]> = {
  question: ['❓', 'orange'],
  review: ['👀', 'blue'],
  actionable: ['🔔', 'blue'],
  accepted: ['☑️', 'wathet'],
  waiting_for_server: ['⏳', 'wathet'],
  running: ['🛠️', 'turquoise'],
  completed: ['✅', 'green'],
  failed: ['❌', 'red'],
  cancelled: ['🚫', 'grey'],
  interrupted: ['⚠️', 'orange'],
  stale: ['💤', 'grey'],
}

/** What the card recommends, on the option itself rather than in a sentence under it. */
const STAR = '⭐'

/**
 * The card for one event, as `im/v1/messages` takes it.
 *
 * `update_multi` is not optional: without it a card posted to a group cannot be edited in
 * place, and one event would leave a chat a message per state it passed through.
 */
export function cardFor(event: EventRow): Record<string, unknown> {
  const open = event.state === 'actionable' && !event.acted
  const { key } = stateOf(event)
  const [, template] = MARKS[key] ?? ['', 'blue']

  const elements: Element[] = [note(facts(event))]

  // The card's own words, cut to what a message is read from rather than what a card holds.
  const review = cardWords(event, open, larkMd)
  for (const part of review.parts) elements.push(text(part))

  if (open) {
    elements.push({ tag: 'hr' })
    elements.push(...decision(event))
  } else {
    const said = stateNote(event)
    if (said) elements.push(note(said))
    elements.push(actions([linkButton(event)]))
  }

  if (review.cut) {
    elements.push(note(`Trimmed to fit Lark — [the card](${cardUrl(event)}) has the rest.`))
  }

  return {
    config: { wide_screen_mode: true, update_multi: true },
    header: {
      title: { tag: 'plain_text', content: `#${event.taskId} ${event.taskTitle}`.slice(0, 150) },
      template,
    },
    elements: elements.slice(0, LARK_ELEMENT_LIMIT),
  }
}

/**
 * The one line under the title: where this stands, which board it is on, and which release
 * it is promised to.
 *
 * The revision is not on it. It is what a press binds — it travels in the control's value and
 * refuses one made against a card that has moved — but eight opaque characters tell a person
 * reading a chat nothing they can act on.
 */
function facts(event: EventRow): string {
  const { key, label } = stateOf(event)
  const [mark] = MARKS[key] ?? ['', '']
  const parts = [`${mark} **${label}**`, event.boardName || 'this board']
  if (event.release) parts.push(`release ${event.release}`)
  return parts.join('  ·  ')
}

// --- the decision -------------------------------------------------------------

/**
 * What the card offers.
 *
 * An **Implement** for the exact ready revision, or — for a question — the controls #319's
 * contract allows: an event carrying exactly one single-choice question is a button per
 * option, and anything else is a form submitting every answer at once.
 */
function decision(event: EventRow): Element[] {
  const link = linkButton(event)
  if (event.decision === 'implement') {
    return [
      actions([button('Implement', { a: ACT_IMPLEMENT, ...actionValue(event) }, 'primary'), link]),
      note(
        event.serverName
          ? `Runs on ${event.serverName} when it is reachable.`
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
    const starred = (at: number) => only.recommend.includes(at + 1)
    const asked = `**${larkMd(only.text)}**`
    return [
      text(spelt ? `${asked}\n${split.map((o, at) => optionLine(o, at, starred(at))).join('\n')}` : asked),
      actions([
        ...split.map((option, at) =>
          button(starred(at) ? `${STAR} ${option.label}` : option.label, {
            a: ACT_OPTION,
            q: 0,
            o: at + 1,
            ...actionValue(event),
          }),
        ),
        link,
      ]),
      note('Leave it alone and the agent researches this one.'),
    ]
  }

  return [...answerForm(event, questions), actions([link])]
}

/** The option as the card spells it out, numbered to the button under it and starred in the
 *  margin when the card recommends it. A lead the card did not write is not invented here —
 *  that option is its number and its words. */
function optionLine(option: { label: string; why: string }, at: number, starred: boolean): string {
  const said =
    option.why && option.label !== `Option ${at + 1}`
      ? `**${at + 1}. ${larkMd(option.label)}** — ${larkMd(option.why)}`
      : `**${at + 1}.** ${larkMd(option.why || option.label)}`
  return starred ? `${STAR} ${said}` : said
}

// --- every answer, in one action ----------------------------------------------

/**
 * Every question the event carries, in one form that submits them all at once.
 *
 * The board's own rule holds here as it does everywhere: a ticked option OR the user's own
 * words, never both, and a question left alone stays open for the agent to research. That is
 * why a question with options gets a picker and a question without one gets a box, and why
 * neither is ever required.
 */
function answerForm(event: EventRow, questions: Question[]): Element[] {
  // A card asking more than one form can hold says so rather than losing the last ones
  // quietly — the unshown ones stay open for the agent, which is what a blank answer means.
  const shown = questions.slice(0, FORM_QUESTIONS)
  const left = questions.length - shown.length
  return [
    {
      tag: 'form',
      name: ANSWER_FORM,
      elements: [
        ...shown.flatMap((question, at) => questionInput(question, at, shown.length)),
        {
          tag: 'button',
          name: 'submit',
          action_type: 'form_submit',
          text: { tag: 'plain_text', content: 'Submit' },
          type: 'primary',
          value: { a: ACT_ANSWERS, ...actionValue(event) },
        },
      ],
    },
    note(
      left > 0
        ? `A question you leave blank stays open for the agent to research — as do the ${left} more on the card.`
        : 'A question you leave blank stays open for the agent to research.',
    ),
  ]
}

/** How many questions one form holds, inside the card's element budget with the line above
 *  each control, the submit button and the lines this card puts around them. */
const FORM_QUESTIONS = Math.floor((LARK_ELEMENT_LIMIT - 8) / 2)

/** One question: the words above it, and the control it is answered in. */
function questionInput(question: Question, at: number, of: number): Element[] {
  const asked = of > 1 ? `**${at + 1}.** ${larkMd(question.text)}` : `**${larkMd(question.text)}**`
  const name = answerField(at)
  if (question.options.length === 0) {
    return [
      text(asked),
      {
        tag: 'input',
        name,
        required: false,
        input_type: 'multiline_text',
        rows: 2,
        placeholder: { tag: 'plain_text', content: 'Your own words, or leave it blank' },
      },
    ]
  }
  // Lark cuts a long option itself, so a long one ends at a word rather than wherever the
  // limit happens to land. The star is the whole of what the card recommends, on the option
  // itself — the same mark the message shows.
  const options = question.options.slice(0, 20).map((option, index) => ({
    text: {
      tag: 'plain_text',
      content: question.recommend.includes(index + 1)
        ? `${STAR} ${clip(option, 143)}`
        : clip(option, 150),
    },
    value: String(index + 1),
  }))
  return [
    text(asked),
    {
      tag: question.mode === 'multi' ? 'multi_select_static' : 'select_static',
      name,
      required: false,
      placeholder: { tag: 'plain_text', content: 'Pick one, or leave it blank' },
      options,
    },
  ]
}

// --- the board's markup, as Lark's own ----------------------------------------

/**
 * The board's Markdown as Lark's `lark_md`.
 *
 * `lark_md` is much of Markdown already — emphasis, links and inline code all read as
 * written — so this fixes only what it does not have: a heading is a line rather than a size,
 * and a list is a bullet character rather than a syntax.
 */
export function larkMd(markdown: string): string {
  const code: string[] = []
  // Fenced and inline code travel unchanged, so nothing below rewrites what a card meant
  // literally. Taken out first and put back last, against a sentinel no card can type.
  let out = markdown.replace(/```[\s\S]*?```|`[^`\n]+`/g, (held) => {
    code.push(held)
    return `\u0000${code.length - 1}\u0000`
  })

  out = unwrap(out)
  // A heading is a line, not a size, in a card that has no headings.
  out = out.replace(/^#{1,6}\s+(.*)$/gm, '**$1**')
  out = out.replace(/^(\s*)[-*+]\s+/gm, '$1• ')
  out = out.replace(/\u0000(\d+)\u0000/g, (_all, at: string) => code[Number(at)] ?? '')
  return out.trim()
}

// --- elements -----------------------------------------------------------------

const text = (content: string): Element => ({
  tag: 'div',
  text: { tag: 'lark_md', content: content.slice(0, LARK_TEXT_LIMIT) },
})

const note = (content: string): Element => ({
  tag: 'note',
  elements: [{ tag: 'lark_md', content: content.slice(0, LARK_TEXT_LIMIT) }],
})

const actions = (elements: Element[]): Element => ({ tag: 'action', actions: elements })

function button(label: string, value: Record<string, unknown>, type = 'default'): Element {
  return {
    tag: 'button',
    // Lark cuts a long label itself, so an option longer than this is cut here rather than
    // costing the whole card.
    text: { tag: 'plain_text', content: label.slice(0, 75) },
    type,
    value,
  }
}

/** The card link. A url button carries no action back, which is exactly right: reading the
 *  whole card and deciding are two different moves. */
const linkButton = (event: EventRow): Element => ({
  tag: 'button',
  text: { tag: 'plain_text', content: 'Open card in app' },
  type: 'default',
  url: cardUrl(event),
})
