// The refinement state machine. Agent sessions decide what a card should say; this file
// decides which run comes next and when the loop stops.

import { allCards, findCard } from '../view/read'
import { byDispatchOrder, canRefine } from '../view/rules'
import type { Card } from '../view/types'
import { startRun } from './start'
import type { AgentAction, AgentRequest, CommandRequest, RunRecord } from './types'

export type RefinementStep = 'raise-questions' | 'resolve' | 'writing' | 'done'

export type BoardMarks = Map<number, string>

const MAX_SESSIONS = 6

const subtaskLinesToIds = (body: string): string => {
  const out: string[] = []
  let inSubtask = false
  for (const line of body.split('\n')) {
    const match = line.match(/^[ \t]*[-*]\s+\[[ xX]\]\s*(.*)$/)
    const ids = match ? match[1]!.match(/#\d+/g) : null
    if (ids) {
      out.push(`- [ ] ${ids.join(' ')}`)
      inSubtask = true
      continue
    }
    if (inSubtask && line.trim() && /^[ \t]/.test(line) && !/^[ \t]*[-*]\s/.test(line)) continue
    inSubtask = false
    out.push(line)
  }
  return out.join('\n')
}

// The line dividing a card's two halves (`akb guide writing`).
const MARKER = /^<!--\s*agent\s*-->$/

// The body as a sorted bag of lines, marker dropped: a repair that only moves sections
// between the halves reads as no change, so the loop spends no run on it. The cost is
// that reordering `## Todo` steps reads as no change too.
const asMoved = (body: string): string[] =>
  body
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !MARKER.test(line.trim()))
    .sort()

// Did this run change the card? A resolver that changed nothing cannot move the QA loop,
// while a clean question audit deliberately changes nothing and advances to writing.
// What ENDS the loop is writing reaching `ready`, or questions only the user owns.
// `blocked_by` is omitted:
// entering a blocked episode writes its own refine schedule, and leaving one consumes that
// schedule (or honors its cancellation), so dependency movement is never inferred here.
// Every other edit counts; guessing which was substantive would be a second, quieter
// opinion about the agent session that made it.
const wroteOf = (card: Card): string =>
  JSON.stringify([
    card.status,
    card.relPath,
    card.title,
    card.track,
    card.priority,
    card.roi,
    card.release,
    card.related,
    card.questions.map((q) => [q.text, q.mode ?? '', q.options ?? [], q.recommend ?? []]),
    card.modules,
    asMoved(card.isGroup ? subtaskLinesToIds(card.body) : card.body),
  ])

const currentCard = (cardId: number): Card | undefined => {
  try {
    return findCard(cardId) ?? undefined
  } catch {
    return undefined
  }
}

export function markBoard(): BoardMarks {
  try {
    return new Map(allCards().map((card) => [card.id, wroteOf(card)]))
  } catch {
    return new Map()
  }
}

function cardChanged(card: Card, before: BoardMarks): boolean {
  const was = before.get(card.id)
  return !was || was !== wroteOf(card)
}

export function refinementStep(card: Card): RefinementStep {
  if (!canRefine(card)) return 'done'
  return card.questions.length > 0 ? 'resolve' : 'raise-questions'
}

export function refinementRequest(req: CommandRequest): AgentRequest | { error: string } {
  const card = req.id === undefined ? null : currentCard(req.id)
  if (!card) return { error: `task #${req.id} does not exist` }
  const step = refinementStep(card)
  if (step === 'done') return { error: `a refine would not move #${card.id}` }
  return { action: step, id: card.id, title: card.title, notes: req.notes, refineRound: 1 }
}

export function startRefinement(
  req: CommandRequest,
): { run: RunRecord; spawned: boolean } | { error: string } {
  const next = refinementRequest(req)
  return 'error' in next ? next : startRun(next)
}

/** The next pass in this loop — or `'capped'`, which is a stop with a card still changing
 *  under it and not the same thing as a loop that settled.
 *
 *  `flowId` is the loop the finished pass belonged to; the pass that follows joins it, so
 *  every session of one refinement shares an id. */
export function refinementAfter(
  action: AgentAction,
  cardId: number,
  round: number | undefined,
  before: BoardMarks,
  flowId?: string,
): AgentRequest | 'capped' | null {
  if (
    round === undefined ||
    (action !== 'raise-questions' && action !== 'resolve' && action !== 'writing')
  ) {
    return null
  }
  const card = currentCard(cardId)
  if (!card || action === 'writing') return null
  // A pass that put work in the card's way stops here. The card now carries the one-shot
  // refine schedule written with that blocker, so continuing this loop would do the work
  // early and start it again when the blocker clears.
  if (card.openBlockers.length > 0) return null
  const step = action === 'raise-questions'
    ? card.questions.length > 0
      ? refinementStep(card)
      : 'writing'
    : cardChanged(card, before)
      ? refinementStep(card)
      : 'done'
  if (step === 'done') return null
  if (step !== 'writing' && round >= MAX_SESSIONS) return 'capped'
  return {
    action: step,
    id: card.id,
    title: card.title,
    refineRound: round + 1,
    ...(flowId ? { flowId } : {}),
  }
}

const NO_FOLLOW = new Set<AgentAction>(['implement', 'raise-questions', 'writing', 'setup'])

/** Cards another run changed and left worth refining. A blocked card carries its own
 * one-shot refine schedule, so dependency completion is not inferred here. */
function refinesAfter(action: AgentAction, before: BoardMarks): AgentRequest[] {
  let cards: Card[]
  try {
    cards = allCards()
  } catch {
    return []
  }
  const follows = !NO_FOLLOW.has(action)
  if (!follows) return []
  return cards
    .filter((card) => cardChanged(card, before))
    .filter((card) => card.openBlockers.length === 0 && !card.schedule && canRefine(card))
    .sort(byDispatchOrder)
    .flatMap((card) => {
      const action = refinementStep(card)
      return action === 'done' || action === 'writing'
        ? []
        : [{ action, id: card.id, title: card.title, refineRound: 1 }]
    })
}

// The loop this run belonged to has ended with its card still worth refining. Nothing else
// picks the card up, so the run itself is where the user is told — an ending nobody reports
// reads exactly like one that settled.
function stalledLine(cardId: number | null, next: AgentRequest | 'capped' | null): string | null {
  if (next !== null && next !== 'capped') return null
  const card = cardId === null ? null : currentCard(cardId)
  if (!card || card.schedule || refinementStep(card) === 'done') return null
  const why =
    next === 'capped'
      ? `${MAX_SESSIONS} QA sessions ran and #${card.id} is still unsettled, so the loop stopped there. `
      : ''
  return `${why}#${card.id} is still at todo and nothing else will pick it up — refine it again, or mark it ready yourself.`
}

export interface RefinementFollowUp {
  /** Every refinement session to start after a completed run, with the current loop first
   *  removed from the ordinary changed-card candidates to prevent a duplicate start. */
  runs: AgentRequest[]
  /** One plain line for a loop that ended without settling its card. */
  stalled?: string
}

export function refinementRunsAfter(run: RunRecord, before: BoardMarks): RefinementFollowUp {
  const next =
    run.cardId === null || run.refineRound === undefined
      ? null
      : refinementAfter(run.action, run.cardId, run.refineRound, before, run.flowId)
  const starts = refinesAfter(run.action, before).filter(
    (req) => run.refineRound === undefined || req.id !== run.cardId,
  )
  return {
    runs: typeof next === 'object' && next ? [...starts, next] : starts,
    // Only a run that WAS a refinement pass can leave a loop unfinished.
    stalled: (run.refineRound !== undefined && stalledLine(run.cardId, next)) || undefined,
  }
}
