// The board's judgments about a card, as plain functions over what a reader already has.
//
// Nothing here touches a file or a process, and it imports only its sibling types — which
// is what lets it be copied into the board UI (`scripts/sync-format.mjs` →
// `kanban-ui/lib/format/view/rules.ts`) and run in a browser. A card page decides whether
// to offer Refine, and the refine that follows a run decides which cards it is worth
// starting on, from this one set of rules rather than two that agree until they don't.

import type { Card, CardCreation, OptionsQuestion, Question, QuestionTag, ScheduledAction } from './types'

// ---- a card that is not finished being created -----------------------------

/** Unfinished cards permit explicit discard; live creation permits no removal. */
export function creationRefusal(id: number, creation: CardCreation | undefined | null, what: string, discard = false): string | null {
  if (!creation || (creation.state === 'unfinished' && discard)) return null
  const run = creation.runId.slice(0, 8)
  return creation.state === 'creating'
    ? `#${id} is still being created by run ${run} — \`${what}\` is refused until that run finishes.`
    : `#${id} was never finished being created: run ${run} stopped short. \`${what}\` is refused until ` +
      'that run is picked back up from the board and finishes. Use reject --discard to discard it instead.'
}

// ---- questions -------------------------------------------------------------

/** The tags a question can carry. `[user]` is a judgment call only the human can make. */
export const QUESTION_TAGS: string[] = ['user']

/** True when this question carries choices to tick rather than a box to type in. */
export function hasOptions(q: Question): q is OptionsQuestion {
  return Array.isArray(q.options) && q.options.length > 0
}

/** The questions still waiting on an answer — every one but those the user skipped (#831).
 *  Anything that asks "does this card still have an open question" reads this, never the
 *  raw list. */
export const openOf = <Q extends Question>(questions: readonly Q[]): Q[] => questions.filter((q) => !q.skipped)

// ---- a card that finishes in planning (#1057) -------------------------------
//
// A product video, slide deck (#1075), carousel post (#1117) or blog post (#1126) is made while
// the card is planned: the user approves each stage (#1790, #2154), and approving the last one
// archives the card. Nothing is built.

/** The finished files a card finishing in planning delivers: a video, a PowerPoint deck or an
 *  article. */
export const PLAN_DELIVERABLE = /\.(mp4|webm|mov|m4v|pptx|md|mdx)$/i

/** A carousel's rendered pages, one storyboard per ratio: `pages-3x4.json`. */
const PAGES_STORYBOARD = /(^|\/)pages-[^/]*\.json$/i

/** What a card finishing in planning still lacks before it can be archived, or null when it
 *  is done: nothing left to answer, a deliverable in its body, a ticked todo recording where
 *  it went or the command that rebuilds it, and every todo ticked. */
export function planDeliveryGap(card: Pick<Card, 'questions' | 'todos' | 'body'>): 'questions' | 'deliverable' | 'command' | 'todos' | null {
  if (openOf(card.questions).length > 0) return 'questions'
  if (!planDeliverables(card.body).length) return 'deliverable'
  if (!/^[ \t]*[-*]\s+\[[xX]\].*`[^`]+`/m.test(card.body)) return 'command'
  const { total, done } = card.todos
  return total > 0 && done === total ? null : 'todos'
}

/** The `src` of every deliverable in a card's body: a finished file's `<Asset>`, or a
 *  `<Storyboard>` of carousel pages. */
export const planDeliverables = (body: string): string[] => [
  ...[...body.matchAll(/<Asset\s[^>]*src="([^"]+)"/gi)].map((m) => m[1]!).filter((src) => PLAN_DELIVERABLE.test(src)),
  ...[...body.matchAll(/<Storyboard\s[^>]*src="([^"]+)"/gi)].map((m) => m[1]!).filter((src) => PAGES_STORYBOARD.test(src)),
]

/** The stage whose previews wait on the user's Approve (#1790, #2154), or null: a stage before
 *  the last, planned (`ready`), with nothing left to answer. A run in flight is the caller's to
 *  rule out. */
export function awaitingApproval(card: Pick<Card, 'stages' | 'stage' | 'questions' | 'status'>): number | null {
  const { stages, stage } = card
  if (!stages || !stage || stage >= stages || card.status !== 'ready') return null
  return openOf(card.questions).length ? null : stage
}

/** A card finishing in planning with more to do before it is archived. */
const planUnfinished = (card: Card): boolean => card.deliversIn === 'plan' && planDeliveryGap(card) !== null

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

const LEVEL_RANK: Record<string, number> = { high: 0, med: 1, low: 2 }

const rank = (table: Record<string, number>, value: string): number =>
  table[value] ?? Object.keys(table).length

/** Highest priority first, then roi, then id — the order the board takes cards in when it
 *  starts them itself. Every candidate is
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
 *   • the card is a group root — its recursively refined subtasks own the work;
 *   • the card isn't `todo` — it's `ready` (the plan is already concrete) or being
 *     implemented, and neither is a plan waiting to be sharpened;
 *   • every todo is checked — that card is finished, not rough;
 *   • every open question is `[user]` — those are the judgment calls only the human can
 *     make, so the card waits on them. Resolve is the move that fits there.
 *
 * A card with no questions at all is refinable, and so is one with a freshly raised,
 * untagged question — that one still needs triage.
 *
 * A card finishing in planning (#1057) stays refinable, `ready` or ticked, until its file
 * is done: planning is where it is made. A round waiting on Approve (#1790) is not.
 *
 * Being blocked is deliberately NOT part of this. The follow-up skips a blocked card
 * because spending a run on a plan whose foundation could still change shape is wasted
 * work — but that is a judgment about where to spend a turn, not a fact about the card. A
 * user who asks to refine a blocked card has asked for it.
 */
export function canRefine(card: Card): boolean {
  if (card.isGroup) return false
  if (awaitingApproval(card)) return false
  if (card.status !== 'todo' && !planUnfinished(card)) return false
  const { total, done } = card.todos
  if (total > 0 && done === total && !planUnfinished(card)) return false
  const open = openOf(card.questions)
  if (open.length > 0 && open.every((q) => parseQuestion(q.text).tag === 'user')) {
    return false
  }
  return true
}

// ---- would an implement move this card? ------------------------------------

/**
 * True when building this card is a move that fits it.
 *
 * A group root is built by finishing its subtasks, so there is nothing on the root itself to
 * do. And a card whose every box is ticked is finished: what it is waiting for is an
 * archive, not another build.
 *
 * A card whose workflow lands nothing is never built (#1057): approving it archives it.
 *
 * Being blocked is not part of this, the same as with `canRefine`: it is a judgment about
 * when to spend a turn, not a fact about the card.
 */
export function canImplement(card: Card): boolean {
  if (card.isGroup) return false
  if (card.deliversIn === 'plan') return false
  const { total, done } = card.todos
  return !(total > 0 && done === total)
}

// ---- the action a blocked card is waiting to run ---------------------------

/**
 * Why this card can't be scheduled for `action`, or null when it can.
 *
 * A schedule hands the run to the board: it fires on the next tick, or on the first tick
 * after the last card in the way leaves. Being blocked is NOT required — a card queued this
 * way outlives the session that queued it, which a run started by hand does not, and the
 * board still starts only one scheduled run per tick.
 *
 * What is refused is a schedule that would fire and do nothing: the same test the button for
 * that action is drawn by, since scheduling a run the board would refuse to start is a
 * promise it can't keep.
 */
export function scheduleRefusal(card: Card, action: ScheduledAction): string | null {
  if (action === 'refine' && !canRefine(card)) {
    return `a refine would not move #${card.id}, so there is nothing to schedule.`
  }
  if (action === 'implement' && !canImplement(card)) {
    return `#${card.id} is not a card to build${card.isGroup ? ' — a group is built by finishing its subtasks' : ''}.`
  }
  if (action === 'revise' && allTicked(card)) return `#${card.id} is already built, so there is nothing to revise.`
  return null
}

const allTicked = (card: Card): boolean => card.todos.total > 0 && card.todos.done === card.todos.total
