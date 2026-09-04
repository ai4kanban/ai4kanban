// The refinement state machine. Agent sessions decide what a card should say; this file
// decides which run comes next and when the loop stops.
//
// A run that ends can also leave OTHER cards worth refining — a review that writes a
// follow-up card, a propose that writes several. Which ones those are is settled by
// `claimChanges` and nothing else, under one rule: a change belongs to exactly one run.
// Several runs are up at once on this board, and their windows overlap, so a run that
// merely diffed the board against its own start would inherit whatever its neighbours
// wrote — and refine cards their own loops were already handling.

import { createHash } from 'node:crypto'

import { allCards, findCard } from '../view/read'
import { byDispatchOrder, canRefine, parseQuestion } from '../view/rules'
import type { Card } from '../view/types'
import { startRun } from './start'
import { withStore } from './store'
import type { AgentAction, AgentRequest, CommandRequest, RefineEffort, RunRecord } from './types'

export type RefinementStep = 'clarify' | 'writing' | 'done'

export type BoardMarks = Map<number, string>

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

// One card as a mark: change any of this and the mark changes.
// `blocked_by` is omitted:
// entering a blocked episode writes its own refine schedule, and leaving one consumes that
// schedule (or honors its cancellation), so dependency movement is never inferred here.
// Every other edit counts; guessing which was substantive would be a second, quieter
// opinion about the agent session that made it.
//
// Hashed, not kept whole: the shared record holds one of these per card between runs, and a
// board's worth of card bodies in it would make that file unreadable.
const wroteOf = (card: Card): string =>
  createHash('sha1')
    .update(
      JSON.stringify([
        card.status,
        card.relPath,
        card.title,
        card.priority,
        card.roi,
        card.release,
        card.related,
        card.questions.map((q) => [q.text, q.mode ?? '', q.options ?? [], q.recommend ?? []]),
        card.modules,
        asMoved(card.isGroup ? subtaskLinesToIds(card.body) : card.body),
      ]),
    )
    .digest('hex')

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

/**
 * The cards this run is answerable for, and the only way that question is ever answered.
 *
 * A card qualifies when it changed while the run was up AND no earlier close has already
 * accounted for that change AND no other run is holding it. Claiming is what makes the
 * middle clause true: the mark each change was taken at goes into the shared record, so the
 * first close to see an edit takes it and every later one reads its own mark back. Without
 * that, two runs whose windows overlap both inherit each other's edits, and the second one
 * refines cards whose own loop had already finished with them.
 *
 * EVERY close calls this, whatever the run ended as — a change left unclaimed is a change
 * the next unrelated run to close would pick up. What it can't tell apart is a card nobody
 * ran on: an edit made by hand goes to whichever close sees it first. Cards made through
 * the CLI name their creating run explicitly.
 */
export function claimChanges(before: BoardMarks, sessionId: string): number[] {
  const now = markBoard()
  try {
    return withStore((store) => {
      // A card another run is working on is that run's to account for when it closes. A
      // spec run holds nothing — it fills one section while the card's own loop carries on
      // around it — which is the rule `heldByRun` follows too.
      const held = new Set(
        store.runs
          .filter((r) => r.status === 'running' && r.sessionId !== sessionId && r.action !== 'spec')
          .flatMap((r) => [r.cardId, ...(r.createdCardIds ?? [])]),
      )
      const claimed: number[] = []
      // Rebuilt from the board rather than merged into, so a card that has been archived or
      // rejected takes its mark with it.
      const marks: Record<string, string> = {}
      for (const [id, mark] of now) {
        const seen = store.marks[String(id)]
        const mine = !held.has(id) && before.get(id) !== mark && seen !== mark
        if (mine) claimed.push(id)
        const kept = mine ? mark : seen
        if (kept) marks[String(id)] = kept
      }
      store.marks = marks
      return claimed
    })
  } catch {
    // An unreadable record. Claiming nothing costs a refine; claiming everything would
    // start the neighbours' work again, which is the mistake this exists to stop.
    return []
  }
}

export function refinementStep(card: Card): RefinementStep {
  if (!canRefine(card)) return 'done'
  return 'clarify'
}

export function refinementRequest(req: CommandRequest): AgentRequest | { error: string } {
  const card = req.id === undefined ? null : currentCard(req.id)
  if (!card) return { error: `task #${req.id} does not exist` }
  const step = refinementStep(card)
  if (step === 'done') return { error: `a refine would not move #${card.id}` }
  return {
    action: step,
    id: card.id,
    title: card.title,
    notes: req.notes,
    refineRound: 1,
    refineEffort: req.refineEffort ?? 'standard',
  }
}

export async function startRefinement(
  req: CommandRequest,
): Promise<{ run: RunRecord; spawned: boolean } | { error: string }> {
  const next = refinementRequest(req)
  return 'error' in next ? next : await startRun(next)
}

function afterQa(
  card: Card | undefined,
  round: number,
  flowId?: string,
  refineEffort: RefineEffort = 'standard',
): AgentRequest | 'incomplete' | null {
  if (!card || card.openBlockers.length > 0) return null
  if (card.questions.some((q) => parseQuestion(q.text).tag !== 'user')) return 'incomplete'
  if (card.questions.length > 0 || refinementStep(card) === 'done') return null
  return {
    action: 'writing',
    id: card.id,
    title: card.title,
    refineRound: round + 1,
    refineEffort,
    ...(flowId ? { flowId } : {}),
  }
}

/** The next pass after one exhaustive QA session. `flowId` joins the writing pass to it. */
export function refinementAfter(
  action: AgentAction,
  cardId: number,
  round: number | undefined,
  changed: readonly number[],
  flowId?: string,
  refineEffort: RefineEffort = 'standard',
): AgentRequest | 'incomplete' | null {
  if (
    round === undefined ||
    (action !== 'clarify' && action !== 'resolve' && action !== 'writing')
  ) {
    return null
  }
  const card = currentCard(cardId)
  if (!card || action === 'writing') return null
  // A pass that put work in the card's way stops here. The card now carries the one-shot
  // refine schedule written with that blocker, so continuing this loop would do the work
  // early and start it again when the blocker clears.
  if (card.openBlockers.length > 0) return null
  // Old in-flight flows may still finish with a separate resolver. Give a resolver that
  // changed the card one exhaustive QA pass; new flows start with that pass directly.
  if (action === 'resolve') {
    if (!changed.includes(card.id) || refinementStep(card) === 'done') return null
    return {
      action: 'clarify',
      id: card.id,
      title: card.title,
      refineRound: round + 1,
      refineEffort,
      ...(flowId ? { flowId } : {}),
    }
  }
  return afterQa(card, round, flowId, refineEffort)
}

// Actions that follow only the cards they CREATED. Each of them just exercised its own
// judgment on the card it names — a refine pass, a build, a revise, a resolve, a spec skill —
// so a refine of a card one of them merely edited spends a run re-doing what has just
// closed. A card one of them split off is another matter: it is as rough as any other
// newborn card, and nothing else comes for it.
//
// A repurpose is here for the opposite reason: it never touches the plan at all. The one
// write it leaves on the card is the channel's `draft` status, and a refine started over
// that would re-plan a settled topic because a file was written.
const FOLLOWS_CREATED = new Set<AgentAction>([
  'implement',
  'edit',
  'clarify',
  'resolve',
  'writing',
  'spec',
  'channel',
])

/** Cards this run left worth refining — its own claims and no one else's. `before` is the
 * board as the run found it, so a claim it doesn't name is a card the run created. A blocked
 * card carries its own one-shot refine schedule, so dependency completion is not inferred
 * here. */
function refinesAfter(
  action: AgentAction,
  changed: readonly number[],
  before: BoardMarks,
): AgentRequest[] {
  let cards: Card[]
  try {
    cards = allCards()
  } catch {
    return []
  }
  // Setup follows the whole board rather than its own claims: the mark is taken per run and
  // only a finished run follows anything, so a setup that failed part-way and was started
  // again would leave the first attempt's cards unrefined. The setup gate means no card but
  // setup's own can be there to catch.
  const mine =
    action === 'setup'
      ? new Set(cards.map((card) => card.id))
      : new Set(FOLLOWS_CREATED.has(action) ? changed.filter((id) => !before.has(id)) : changed)
  return cards
    .filter((card) => mine.has(card.id))
    .filter((card) => card.openBlockers.length === 0 && !card.schedule && canRefine(card))
    .sort(byDispatchOrder)
    .flatMap((card) => {
      const action = refinementStep(card)
      return action === 'done' || action === 'writing'
        ? []
        : [{ action, id: card.id, title: card.title, refineRound: 1, refineEffort: 'standard' }]
    })
}

// The loop this run belonged to has ended with its card still worth refining. Nothing else
// picks the card up, so the run itself is where the user is told — an ending nobody reports
// reads exactly like one that settled.
function stalledLine(cardId: number | null, next: AgentRequest | 'incomplete' | null): string | null {
  if (next !== null && next !== 'incomplete') return null
  const card = cardId === null ? null : currentCard(cardId)
  if (!card || card.schedule || refinementStep(card) === 'done') return null
  const why =
    next === 'incomplete'
      ? `QA left untagged questions on #${card.id}, so it did not finish. `
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

function qaAfterSpec(run: RunRecord): AgentRequest | null {
  if (run.action !== 'spec' || run.cardId === null) return null
  const card = currentCard(run.cardId)
  if (!card || card.openBlockers.length > 0 || card.schedule || !canRefine(card)) return null
  return {
    action: 'clarify',
    id: card.id,
    title: card.title,
    refineRound: 1,
    refineEffort: run.refineEffort ?? 'standard',
    ...(run.flowId ? { flowId: run.flowId } : {}),
  }
}

export function refinementRunsAfter(
  run: RunRecord,
  changed: readonly number[],
  before: BoardMarks,
  waitingForSpec = false,
): RefinementFollowUp {
  const next =
    waitingForSpec || run.cardId === null
      ? null
      : (run.action === 'resolve' || run.action === 'edit') && run.refineRound === undefined
        ? afterQa(currentCard(run.cardId), 0, run.flowId, run.refineEffort)
        : run.refineRound === undefined
          ? null
          : refinementAfter(run.action, run.cardId, run.refineRound, changed, run.flowId, run.refineEffort)
  const starts = refinesAfter(run.action, changed, before).filter(
    (req) =>
      req.id !== run.cardId || (run.refineRound === undefined && run.action !== 'spec'),
  )
  const resumedQa = qaAfterSpec(run)
  return {
    runs: [...starts, ...(resumedQa ? [resumedQa] : typeof next === 'object' && next ? [next] : [])],
    // A refinement pass or an action's embedded QA can leave the loop unfinished.
    stalled:
      waitingForSpec
        ? undefined
        : ((run.refineRound !== undefined || next === 'incomplete') &&
            stalledLine(run.cardId, next)) ||
          undefined,
  }
}
