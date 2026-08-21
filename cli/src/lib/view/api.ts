// ---- the board, as a front end asks for it ---------------------------------
//
// One door onto everything a screen does with the board: read it, edit a card, plan and end
// a release, save the goal, tick a setup box, and ask what to start on its own. It is the
// same code every command runs — nothing here is a second implementation of a move — with
// three things done once, on the way through, so no caller has to remember them:
//
//   • a write takes the board's lock, so an edit saved from a screen waits its turn behind
//     whatever an agent is writing at that moment rather than landing on top of it,
//   • a refusal comes back as `{ ok: false, error }` instead of throwing: the caller is a
//     dialog someone is still typing in, and it must be able to say why and stay open,
//   • prose a move would have printed is swallowed. These callers read the value, and a
//     board's stdout is not theirs.
//
// Reads take no lock. Nothing they do can be half-written, and a board someone is mid-write
// on is still readable.

import { quietly } from '../io'
import { withBoardLock } from '../lock'
import { tickSetupStep } from '../setup'
import {
  addRelease,
  closeRelease as closeReleaseMove,
  dropRelease as dropReleaseMove,
  endingCards,
  fillCandidates,
  fillRelease as fillReleaseMove,
  foldGoal,
  readReleases,
  setReleaseGoal as setReleaseGoalMove,
  type CardRow,
} from '../releases'
import { asScheduledAction, SCHEDULED_ACTIONS } from '../schedule'
import { NO_RELEASE, normalizeRelease } from '../validate'
import { patchCard as patchCardWrite, setCardSchedule } from './edit'
import { writeGoalText } from './goal'
import { saveProject as saveProjectWrite } from './first-run'
import type {
  BulkReleaseResult,
  CardPatch,
  ClosePlan,
  DropPlan,
  FillPlan,
  PlanCard,
  SaveProjectResult,
  TrackDraft,
  WriteResult,
} from './types'

export { readBoard, findCard, allCards, readSetupState } from './read'
export { boardStamp } from './stamp'
export { readMetricsView } from './metrics'
export { readModules, readSetupDraft } from './first-run'
export { readGoalText } from './goal'
export { readMemoryFile, readMemoryModules } from './memory'
export { nextWork } from './dispatch'
export { readReleases } from '../releases'

/** Run one write with the board's lock held, and answer with `{ ok }` either way. A refusal
 *  is a BoardError and its message is written to be read; anything else is a bug, whose
 *  message still beats a blank dialog. */
function write<T extends object>(fn: () => T): WriteResult & Partial<T> {
  try {
    return { ok: true, ...quietly(() => withBoardLock(fn)) }
  } catch (e) {
    // A refusal carries none of the move's own fields — there was no move.
    return { ok: false, error: e instanceof Error ? e.message : String(e) } as WriteResult & Partial<T>
  }
}

/** Run one read that may refuse, and answer with the fallback when it does — used where a
 *  screen has somewhere sensible to fall back to: an empty picker, an empty plan. */
function read<T>(fn: () => T, fallback: T): T {
  try {
    return quietly(fn)
  } catch {
    return fallback
  }
}

// ---- a card ----------------------------------------------------------------

/** Apply a direct edit to one card: its title, body, priority, roi, release, cadence. */
export function patchCard(id: number, patch: CardPatch): WriteResult {
  return write(() => {
    patchCardWrite(id, patch)
    return {}
  })
}

/**
 * Schedule an action on a blocked card, so the board runs it by itself once the last card in
 * its way leaves the board.
 *
 * The action is checked here rather than trusted, so a stale screen can't write a mark
 * nothing will ever fire; everything else about whether this card may carry a schedule is
 * the board's own rule, and the refusal comes back as the line it wrote.
 */
export function setSchedule(id: number, action: string, notes = ''): WriteResult {
  const wanted = asScheduledAction(action)
  if (!wanted) {
    return { ok: false, error: `"${action}" isn't an action the board can schedule — ${SCHEDULED_ACTIONS.join(' or ')}.` }
  }
  return write(() => {
    setCardSchedule(id, { action: wanted, notes: typeof notes === 'string' ? notes : '' })
    return {}
  })
}

/** Take a card's schedule off. Nothing fires after this. Silent about a card that had none:
 *  the button and the mark it takes off are drawn from a read that can be a moment old. */
export function clearSchedule(id: number): WriteResult {
  return write(() => {
    setCardSchedule(id, null)
    return {}
  })
}

/**
 * Move several cards into one release, or back out of one.
 *
 * Each card is written on its own, by the very call one card's release picker makes: one
 * bad card must not cost the rest their move, and the card files stay the record either
 * way. The release is checked once, before any card is written — a release that isn't on
 * the list would fail every card for the same reason, and a bar listing that message twenty
 * times says less than one line saying the release doesn't exist.
 */
export function setCardsRelease(ids: number[], release: string): BulkReleaseResult {
  const target = normalizeRelease(release)
  if (target !== NO_RELEASE) {
    const known = read(readReleases, [])
    if (!known.includes(target)) {
      return {
        moved: 0,
        failed: [],
        error: `unknown release "${target}" — releases on the list: ${known.join(', ') || '(none)'}.`,
      }
    }
  }
  const failed: { id: number; error: string }[] = []
  let moved = 0
  for (const id of ids) {
    // A group root is one card here like any other, and moves the way it does on its own
    // page: its root.md is written and then the same release down every subtask, nested
    // groups included. No column ever draws a subtask, so ticking a root is the only way
    // those cards move at all — and a group is one piece of work, so it ships as one.
    const res = patchCard(id, { release: target })
    if (res.ok) moved += 1
    else failed.push({ id, error: res.error || 'could not be moved' })
  }
  return { moved, failed }
}

// ---- releases --------------------------------------------------------------

const planCard = (card: CardRow): PlanCard => ({ id: card.id, title: card.title })

/** What a fill would move right now, and which high-priority cards it would leave, each
 *  with the test it failed. Read as a New release dialog opens, so its toggle carries the
 *  number of cards before the release is made. */
export function fillPlan(): FillPlan {
  return read(
    () => {
      const { fill, skipped } = fillCandidates()
      return { fill: fill.map(planCard), skipped: skipped.map((c) => ({ ...planCard(c), reason: c.reason })) }
    },
    { fill: [], skipped: [] },
  )
}

/** What a close would write down and move. It carries the open cards with every todo
 *  ticked, since a close counts those as not shipped and cannot be undone; seeing them is
 *  what lets someone cancel, archive the card, and close after. */
export function closePlan(id: string): ClosePlan {
  return read(
    () => {
      const { archived, left } = endingCards(id)
      return { left: left.map((c) => ({ ...planCard(c), done: c.done })), shipped: archived.length }
    },
    { left: [], shipped: 0 },
  )
}

/** Which archived cards stay put and which open cards a drop strips of their release. */
export function dropPlan(id: string): DropPlan {
  return read(
    () => {
      const { archived, left } = endingCards(id)
      return { archived: archived.map(planCard), left: left.map(planCard) }
    },
    { archived: [], left: [] },
  )
}

/** How a new release was filled. `fill` is the plain rule, run there and then. `agent` means
 *  the release has a goal, so filling it is a run someone still has to start — the release
 *  is already on the list, and it stands whatever that run does. */
export type ReleaseFill = 'none' | 'fill' | 'agent'

/**
 * Start a release: one line appended to `docs/kanban/releases.md`, in ship order, carrying
 * what the version is for when one was given.
 *
 * `fill` asks for the release to be filled as it is made. Which way that happens is decided
 * here, not by the caller — a goal is what an agent can plan against, and a release without
 * one has nothing for an agent to decide, so it takes the plain rule instead: the
 * high-priority, unblocked, non-root cards in no release go in at once.
 */
export function newRelease(id: string, goal = '', fill = false): WriteResult & { fill?: ReleaseFill } {
  return write(() => {
    const made = addRelease(id, goal)
    if (!fill) return { fill: 'none' as ReleaseFill }
    if (foldGoal(goal)) return { fill: 'agent' as ReleaseFill }
    fillReleaseMove(made)
    return { fill: 'fill' as ReleaseFill }
  })
}

/** Change what a release is for, after it was made. An empty goal clears it — a release
 *  with no goal is a state the board works over, so unsaying it has to be possible too. */
export function setReleaseGoal(id: string, goal: string): WriteResult {
  return write(() => {
    setReleaseGoalMove(id.trim(), goal)
    return {}
  })
}

/** Close a shipped release: one dated section in its summary file, the open cards' release
 *  cleared, the line off the list. Recomputed rather than trusting the plan a dialog
 *  fetched — a second tab may already have taken the release off. */
export function closeRelease(id: string): WriteResult {
  return write(() => {
    closeReleaseMove(id.trim())
    return {}
  })
}

/** Give up on a release: the open cards' release cleared and the line off the list, with no
 *  summary written. */
export function dropRelease(id: string): WriteResult {
  return write(() => {
    dropReleaseMove(id.trim())
    return {}
  })
}

// ---- the goal and setup ----------------------------------------------------

/**
 * Save the project goal in the user's own words.
 *
 * Writing the goal IS setup's goal step, so a save ticks that box — one of the three the
 * board finishes itself. On a board with no checklist the tick is a no-op, which is the
 * whole of the "a goal judged weak long after setup" case.
 */
export function saveGoal(text: string): WriteResult {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'the goal must not be empty' }
  return write(() => {
    writeGoalText(text)
    tickSetupStep('goal')
    return {}
  })
}

/** Save what the project is and what tracks its work falls into, and tick setup's `project`
 *  box. The tracks are folders as well as words, so this is also where a new one is made
 *  and an empty one that was dropped is removed. A track holding cards is kept and named in
 *  the answer rather than deleted. */
export function saveProject(name: string, description: string, tracks: TrackDraft[]): SaveProjectResult {
  return write(() => {
    const result = saveProjectWrite(name, description, tracks)
    // Saying what the project is IS setup's `project` step, so the save ticks that box —
    // the same way saving the goal ticks its own. It matters more than the meter: setup
    // starts at the first unticked box, so a box left open here is a run that comes back
    // and asks the repo what the user already answered.
    tickSetupStep('project')
    return result
  })
}

/** Tick one setup box by name. Silent about a board with no checklist, an unknown step, or
 *  one already ticked: all three mean there is nothing to do, and a setup bar is a nudge,
 *  never something that should fail what the user actually asked for. */
export function finishSetupStep(name: string): WriteResult {
  return write(() => {
    tickSetupStep(name)
    return {}
  })
}
