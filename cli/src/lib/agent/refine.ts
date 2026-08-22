// The refinement state machine. Agent sessions decide what a card should say; this file
// decides which session runs next and when the loop stops.

import { allCards, findCard } from '../view/read'
import { byDispatchOrder, canRefine } from '../view/rules'
import type { Card } from '../view/types'
import { startRun } from './start'
import type { AgentAction, AgentRequest, RunRecord } from './types'

export type RefinementStep = 'refine' | 'resolve' | 'done'

export interface BoardMark {
  wrote: string
  reviewed: string
  blocked: boolean
}

export type BoardMarks = Map<number, BoardMark>

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

// The line dividing a card's two halves ("Card format" in `akb guide board`).
const MARKER = /^<!--\s*agent\s*-->$/

// What a pass has to read again, as a bag of lines: sorted, with the boundary marker
// dropped. A refine repairing an old card's shape moves its sections into the two halves
// without touching a word, and that is not a plan to re-approve — compared line for line it
// would send every reshaped `ready` card back to `todo`. The cost is that reordering
// `## Todo` steps also reads as no change; it leaks one way only, leaving a card `ready`
// rather than demoting it for nothing.
const asMoved = (body: string): string[] =>
  body
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !MARKER.test(line.trim()))
    .sort()

const reviewedOf = (card: Card): string =>
  JSON.stringify([
    card.relPath,
    card.title,
    card.track,
    card.priority,
    card.roi,
    card.release,
    card.blocked_by,
    card.related,
    card.questions.map((q) => [q.text, q.mode ?? '', q.options ?? [], q.recommend ?? []]),
    card.modules,
    asMoved(card.isGroup ? subtaskLinesToIds(card.body) : card.body),
  ])

// Whether the loop has another pass to spend is not decided here. Any edit at all reads as a
// change, and a pass that reviewed the card and found the plan sound is the pass that says
// so, by marking it `ready` ("Close the pass" in `akb guide refine`). The board only reports
// a loop that ended without one — a rule guessing which edits were substantive would be a
// second, quieter opinion about a judgment the pass already made.
const wroteOf = (card: Card): string => JSON.stringify([card.status, reviewedOf(card)])

const currentCard = (cardId: number): Card | undefined => {
  try {
    return findCard(cardId) ?? undefined
  } catch {
    return undefined
  }
}

export function markBoard(): BoardMarks {
  try {
    return new Map(
      allCards().map((card) => [
        card.id,
        {
          wrote: wroteOf(card),
          reviewed: reviewedOf(card),
          blocked: card.openBlockers.length > 0,
        },
      ]),
    )
  } catch {
    return new Map()
  }
}

function cardChanged(card: Card, before: BoardMarks): boolean {
  const was = before.get(card.id)
  return !was || was.wrote !== wroteOf(card)
}

export function refinementStep(card: Card): RefinementStep {
  if (!canRefine(card)) return 'done'
  return card.questions.length > 0 ? 'resolve' : 'refine'
}

export function startRefinement(
  req: AgentRequest,
): { run: RunRecord; spawned: boolean } | { error: string } {
  const card = req.id === undefined ? null : currentCard(req.id)
  if (!card) return { error: `task #${req.id} does not exist` }
  const step = refinementStep(card)
  if (step === 'done') return { error: `a refine would not move #${card.id}` }
  return startRun({ ...req, action: step, refineRound: 1 })
}

export function refinementNeedsApproval(cardId: number, before: BoardMarks): boolean {
  const was = before.get(cardId)
  const card = currentCard(cardId)
  return !!was && !!card && card.status === 'ready' && was.reviewed !== reviewedOf(card)
}

/** The next pass in this loop — or `'capped'`, which is a stop with a card still changing
 *  under it and not the same thing as a loop that settled. */
export function refinementAfter(
  action: AgentAction,
  cardId: number,
  round: number | undefined,
  before: BoardMarks,
): AgentRequest | 'capped' | null {
  if (round === undefined || (action !== 'refine' && action !== 'resolve')) return null
  const card = currentCard(cardId)
  if (!card || !cardChanged(card, before)) return null

  const step = refinementStep(card)
  if (step === 'done') return null
  if (round >= MAX_SESSIONS) return 'capped'
  return { action: step, id: card.id, title: card.title, refineRound: round + 1 }
}

const NO_FOLLOW = new Set<AgentAction>(['implement', 'refine', 'setup', 'spec'])

/** Cards that need a new refinement loop after another run changed or unblocked them. */
function refinesAfter(action: AgentAction, before: BoardMarks): AgentRequest[] {
  let cards: Card[]
  try {
    cards = allCards()
  } catch {
    return []
  }
  const follows = !NO_FOLLOW.has(action)
  return cards
    .filter((card) => {
      const was = before.get(card.id)
      const touched = follows && cardChanged(card, before)
      const freed = !!was && was.blocked && card.openBlockers.length === 0
      return touched || freed
    })
    .filter((card) => card.openBlockers.length === 0 && !card.schedule && canRefine(card))
    .sort(byDispatchOrder)
    .map((card) => ({ action: 'refine' as const, id: card.id, title: card.title }))
}

// The loop this run belonged to has ended with its card still worth refining. Nothing else
// picks the card up, so the run itself is where the user is told — an ending nobody reports
// reads exactly like one that settled.
function stalledLine(cardId: number | null, next: AgentRequest | 'capped' | null): string | null {
  if (next !== null && next !== 'capped') return null
  const card = cardId === null ? null : currentCard(cardId)
  if (!card || refinementStep(card) === 'done') return null
  const why =
    next === 'capped'
      ? `${MAX_SESSIONS} refine passes and #${card.id} changed on every one, so the loop stopped there. `
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
      : refinementAfter(run.action, run.cardId, run.refineRound, before)
  const starts = refinesAfter(run.action, before).filter(
    (req) => run.refineRound === undefined || req.id !== run.cardId,
  )
  return {
    runs: typeof next === 'object' && next ? [...starts, next] : starts,
    // Only a run that WAS a refinement pass can leave a loop unfinished.
    stalled: (run.refineRound !== undefined && stalledLine(run.cardId, next)) || undefined,
  }
}
