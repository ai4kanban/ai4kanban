// The refine that follows a run.
//
// A command does what it was asked and stops. What used to be a second job tacked onto the
// end of the same conversation — "and afterwards, refine the card you just wrote" — is a
// run of its own now: it sits in the runs panel with its own log, and it can be stopped
// like anything else.
//
// Two things earn a card a refine, and they are read the same way for every action: the run
// wrote or changed it, or the run took away the last thing standing in its way. Nothing
// hunts the backlog, so every refine follows something that just happened.
//
// The judgment of whether a refine would move a card at all is the board's own
// (`canRefine`), the same rule a card page shows its Refine button by.

import { allCards } from '../view/read'
import { byDispatchOrder, canRefine } from '../view/rules'
import type { Card } from '../view/types'
import type { AgentAction, AgentRequest } from './types'

/** What one card looked like at a moment in time, in the two ways a follow-up cares
 *  about. */
interface Mark {
  /** Everything a run can write on a card, as one string — so "changed" is a comparison
   *  rather than a guess at which field mattered. */
  wrote: string
  /** Whether the card was waiting on another card. */
  blocked: boolean
}

/** The whole board as a moment, keyed by card id. */
export type BoardMarks = Map<number, Mark>

// A group root's body, with its subtask lines reduced to the ids they point at.
//
// Finishing a subtask leaves marks all over its line on the root: `archive` ticks the box
// and `reject` strikes the text, and the flow's own handoff has the agent rewrite what is
// left — "#7" becomes "#7 (archived)", and the line rewraps. None of that is a change of
// plan; it is the group's progress bar. Counting it would earn the root a refine every
// time one of its subtasks finished, which on a big group is one root refine per subtask.
//
// So the text of a subtask line is dropped and its ids kept. Which subtasks a root has, and
// in what order, is the root's plan — add or drop one and it is refined. How each line is
// worded is the subtask's own card's business, and every subtask card gets its own refine.
//
// A subtask line is a checkbox bullet whose text names a card — the same shape the board
// itself counts a group's progress by. A plain bullet mentioning an id in prose isn't one,
// and is compared as written.
const subtaskLinesToIds = (body: string): string => {
  const out: string[] = []
  let inSubtask = false
  for (const line of body.split('\n')) {
    const m = line.match(/^[ \t]*[-*]\s+\[[ xX]\]\s*(.*)$/)
    const ids = m ? m[1]!.match(/#\d+/g) : null
    if (ids) {
      out.push(`- [ ] ${ids.join(' ')}`)
      inSubtask = true
      continue
    }
    // A wrapped subtask line: indented, not blank, and not a bullet starting something new.
    if (inSubtask && line.trim() && /^[ \t]/.test(line) && !/^[ \t]*[-*]\s/.test(line)) continue
    inSubtask = false
    out.push(line)
  }
  return out.join('\n')
}

// `last_run` and `cadence` are left out on purpose: they are the board's own bookkeeping
// on a recurring card, and a recurring card is never refined anyway.
const wroteOf = (c: Card): string =>
  JSON.stringify([
    c.relPath,
    c.title,
    c.track,
    c.priority,
    c.roi,
    c.status,
    c.release,
    c.blocked_by,
    c.related,
    c.questions.map((q) => [q.text, q.mode ?? '', q.options ?? [], q.recommend ?? []]),
    c.modules,
    c.isGroup ? subtaskLinesToIds(c.body) : c.body,
  ])

/** Read the board as it stands. Taken by a watcher just before its agent starts, and again
 *  once the run has closed, so the difference is what that one run did.
 *
 *  Never throws: a board it can't read marks nothing, and a run that can't be compared
 *  simply starts no follow-up. */
export function markBoard(): BoardMarks {
  try {
    return new Map(allCards().map((c) => [c.id, { wrote: wroteOf(c), blocked: c.openBlockers.length > 0 }]))
  } catch {
    return new Map()
  }
}

// The actions after which a card the run touched is NOT refined.
//
// `implement` is building the plan, not writing it — a refine landing on a card mid-build
// would rewrite the very plan being followed. `auto-refine` is the refine itself, and a
// refine that starts a refine is a loop with no end.
//
// `setup` is the third, for a reason of size rather than of kind: its last step writes the
// board's first ten cards, and ten refine runs firing the moment a user finishes onboarding
// is not what they pressed the button for. Those cards are refined the way every other card
// on the board is — when someone asks.
//
// The other half of the rule — a card whose last blocker just left — applies after every
// action, these three included: an implement run is how a card usually leaves the board, so
// it is how its subtasks and dependants usually come free.
const NO_FOLLOW = new Set<AgentAction>(['implement', 'auto-refine', 'setup'])

/**
 * The refine runs to start now that one run has ended, in the order to start them.
 *
 * A card is picked when the run wrote or changed it, or when it was waiting on another card
 * and now has nothing left in its way. Then the board's own rule decides: a card a refine
 * couldn't move is dropped — one already `ready` or being implemented, a recurring card,
 * one whose todos are all ticked, one whose open questions are all the user's to answer.
 * A card still blocked is dropped too, for the reason the board has always skipped one:
 * building the blocker often changes the plan of what comes after it.
 *
 * A group root is the one card a finished subtask does NOT count as a change to, so a group
 * of ten subtasks doesn't refine its root ten times (`subtaskLinesToIds`).
 *
 * An empty list means nothing follows. It never throws — the run is over either way.
 */
export function refinesAfter(action: AgentAction, before: BoardMarks): AgentRequest[] {
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
      const touched = follows && (!was || was.wrote !== wroteOf(card))
      const freed = !!was && was.blocked && card.openBlockers.length === 0
      return touched || freed
    })
    // A card carrying a schedule is left alone: the user already said what should happen to
    // it the moment it came free, and the dispatcher is about to start exactly that. A
    // refine slipped in first would either be the very run that is queued, twice over, or a
    // rewrite of the plan a scheduled implement is about to follow.
    .filter((card) => card.openBlockers.length === 0 && !card.schedule && canRefine(card))
    .sort(byDispatchOrder)
    .map((card) => ({ action: 'auto-refine' as const, id: card.id, title: card.title }))
}
