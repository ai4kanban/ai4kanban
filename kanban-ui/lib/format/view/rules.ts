// Copied from cli/src/lib/view/rules.ts by scripts/sync-format.mjs — do not edit here.
// Edit the original and re-run `node scripts/sync-format.mjs`.

// The board's judgments about a card, as plain functions over what a reader already has.
//
// Nothing here touches a file or a process, and it imports only its sibling types — which
// is what lets it be copied into the board UI (`scripts/sync-format.mjs` →
// `kanban-ui/lib/format/view/rules.ts`) and run in a browser. A card page decides whether
// to offer Refine, and the refine that follows a run decides which cards it is worth
// starting on, from this one set of rules rather than two that agree until they don't.

import type { Card, OptionsQuestion, Question, QuestionTag, ScheduledAction } from './types'

// ---- questions -------------------------------------------------------------

/** The tags a question can carry. `[user]` is a judgment call only the human can make. */
export const QUESTION_TAGS: string[] = ['user']

/** True when this question carries choices to tick rather than a box to type in. */
export function hasOptions(q: Question): q is OptionsQuestion {
  return Array.isArray(q.options) && q.options.length > 0
}

/** Split a question's leading `[user] ` tag off its text. No token means untagged: freshly
 *  raised, not yet triaged. There is no tag for an answered question — answering removes it
 *  from the list. */
export function parseQuestion(raw: unknown): { tag: QuestionTag | null; text: string } {
  const m = String(raw).match(/^\[(user)\]\s+([\s\S]*)$/)
  return m ? { tag: m[1] as QuestionTag, text: m[2]! } : { tag: null, text: String(raw) }
}

/** A tag and a text back as the one line a card carries. */
export function formatQuestion(tag: QuestionTag | string | null, text: string): string {
  return tag ? `[${tag}] ${text}` : text
}

// ---- pick order ------------------------------------------------------------
//
// Which card to start next. `ready` cards lead (vetted, plan concrete), `implementing`
// follows (already in flight), raw `todo` last; then priority, then roi, then id. Unranked
// — an empty or unknown value — sorts after everything ranked.

const STATUS_RANK: Record<string, number> = { ready: 0, implementing: 1, todo: 2 }
const LEVEL_RANK: Record<string, number> = { high: 0, med: 1, low: 2 }

const rank = (table: Record<string, number>, value: string): number =>
  table[value] ?? Object.keys(table).length

export function byPickOrder(a: Card, b: Card): number {
  return (
    rank(STATUS_RANK, a.status) - rank(STATUS_RANK, b.status) ||
    rank(LEVEL_RANK, a.priority) - rank(LEVEL_RANK, b.priority) ||
    rank(LEVEL_RANK, a.roi) - rank(LEVEL_RANK, b.roi) ||
    a.id - b.id
  )
}

/** The order within one track band: the same pick order with one rule ahead of priority,
 *  and only between cards at the same status so the status ranking still decides first — a
 *  card waiting on an open card sinks below the ones you can start. The column promises the
 *  top is startable work. It only moves a card; it never hides or gates one. */
export function byQueueOrder(a: Card, b: Card): number {
  const blocked = (c: Card) => (c.openBlockers.length > 0 ? 1 : 0)
  return (
    rank(STATUS_RANK, a.status) - rank(STATUS_RANK, b.status) ||
    blocked(a) - blocked(b) ||
    byPickOrder(a, b)
  )
}

/** Highest priority first, then roi, then id — the order the board takes cards in when it
 *  starts them itself, refine follow-ups and due recurring jobs alike. Every candidate is
 *  `todo`, so status doesn't enter this one. */
export function byDispatchOrder(a: Card, b: Card): number {
  return (
    rank(LEVEL_RANK, a.priority) - rank(LEVEL_RANK, b.priority) ||
    rank(LEVEL_RANK, a.roi) - rank(LEVEL_RANK, b.roi) ||
    a.id - b.id
  )
}

// ---- would a refine move this card? ----------------------------------------

/**
 * The one rule behind both ways a refine starts — the follow-up a finished run leaves on
 * each card it touched, and a Refine button on a card page — so the button can never offer
 * a run that arrives, finds nothing to do, and leaves the card exactly as it was.
 *
 * The four cases where a refine has nothing to work with:
 *   • the card is recurring — it carries a `## Process`, not a build plan with todo boxes,
 *     and it never reaches `ready` because it is never finished at all. A run owns any new
 *     decision and leaves only the user's questions open;
 *   • the card isn't `todo` — it's `ready` (the plan is already concrete) or being
 *     implemented, and neither is a plan waiting to be sharpened;
 *   • every todo is checked — that card is finished, not rough;
 *   • every open question is `[user]` — those are the judgment calls only the human can
 *     make, so the card waits on them. Resolve is the move that fits there.
 *
 * A card with no questions at all is refinable, and so is one with a freshly raised,
 * untagged question — that one still needs triage.
 *
 * Being blocked is deliberately NOT part of this. The follow-up skips a blocked card
 * because spending a run on a plan whose foundation could still change shape is wasted
 * work — but that is a judgment about where to spend a turn, not a fact about the card. A
 * user who asks to refine a blocked card has asked for it.
 */
export function canRefine(card: Card): boolean {
  if (card.recurring) return false
  if (card.status !== 'todo') return false
  const { total, done } = card.todos
  if (total > 0 && done === total) return false
  if (card.questions.length > 0 && card.questions.every((q) => parseQuestion(q.text).tag === 'user')) {
    return false
  }
  return true
}

// ---- would an implement move this card? ------------------------------------

/**
 * True when building this card is a move that fits it.
 *
 * A recurring card is run, not built — it is a job that repeats and has no end state. A
 * group root is built by finishing its subtasks, so there is nothing on the root itself to
 * do. And a card whose every box is ticked is finished: what it is waiting for is an
 * archive, not another build.
 *
 * Being blocked is not part of this, the same as with `canRefine`: it is a judgment about
 * when to spend a turn, not a fact about the card.
 */
export function canImplement(card: Card): boolean {
  if (card.recurring) return false
  if (card.isGroup) return false
  const { total, done } = card.todos
  return !(total > 0 && done === total)
}

// ---- the action a blocked card is waiting to run ---------------------------

/**
 * Why this card can't be scheduled for `action`, or null when it can.
 *
 * Scheduling is what a card waiting on another card gets INSTEAD of being started now, so
 * the one hard rule is that something must really be in the way: a card you can start today
 * has nothing to wait for, and a schedule on it would never fire. The rest is the same test
 * the button for that action is drawn by — scheduling a run the board would refuse to start
 * is a promise it can't keep.
 */
export function scheduleRefusal(card: Card, action: ScheduledAction): string | null {
  if (card.recurring) {
    return `#${card.id} is a recurring job — it repeats on its cadence and is never blocked.`
  }
  if (card.openBlockers.length === 0) {
    return `#${card.id} is not waiting on anything — start it now instead of scheduling it.`
  }
  if (action === 'refine' && !canRefine(card)) {
    return `a refine would not move #${card.id}, so there is nothing to schedule.`
  }
  if (action === 'implement' && !canImplement(card)) {
    return `#${card.id} is not a card to build${card.isGroup ? ' — a group is built by finishing its subtasks' : ''}.`
  }
  return null
}

/**
 * True when the action this card is scheduled for would no longer do anything.
 *
 * The board checks this at the moment it would fire, not when the schedule was written: a
 * refine scheduled on a rough card is pointless once somebody has taken that card to `ready`
 * themselves, and an implement is pointless once every box is ticked. Then the mark is
 * dropped and no run starts, rather than spending an agent on a card that has moved on.
 */
export function scheduleWouldDoNothing(card: Card): boolean {
  if (!card.schedule) return false
  return card.schedule.action === 'refine' ? !canRefine(card) : !canImplement(card)
}

/** What a scheduled card is waiting to do, in one line: `implement · waiting on #57`. Empty
 *  on a card with no schedule. */
export function scheduleLabel(card: Card): string {
  if (!card.schedule) return ''
  const waiting = card.openBlockers.map((b) => `#${b.id}`).join(', ')
  return `${card.schedule.action} · ${waiting ? `waiting on ${waiting}` : 'nothing left in the way'}`
}
