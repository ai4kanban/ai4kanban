// ---- what the board should start on its own --------------------------------
//
// The jobs that need no user at all: the cards somebody scheduled, whose last blocker has
// now left the board, the cards a refine would move and none has been tried on, the board's
// own scheduled agents and every workflow's (#1401, #1475), and the daily prune of what
// departed cards left in .akb.
// A front end with a timer asks this once a
// tick and starts whatever comes back — it holds the timer, this holds the rules, so a board
// driven from a window and a board driven from anywhere else pick the same cards in the same
// order.
//
// Refining is here once per card (#1366): a card that becomes refinable with nothing coming
// for it — its last `[user]` question answered, say — is started by `dueRefine`. The refine
// that follows a run is still that run's own watcher's (`agent/follow.ts`).
//
// Nothing here reads a clock the caller owns, and one thing here writes: taking the mark off
// a scheduled card, which has to happen in the same pass that hands its run back (see
// `dueScheduled`) — and the list of cards a refine has been tried on (`dueRefine`).

import fs from 'node:fs'
import path from 'node:path'

import { AUTO_CADENCE, formatDay, formatStamp } from '../cadence'
import {
  DEFAULT_CADENCE,
  dismissalReview,
  leftoverPrune,
  MEMORY_REVIEW_CADENCE,
  memoryPrune,
  memoryReview,
  projectDescription,
  reflectQueue,
  scheduleClock,
  setDismissalReview,
  setMemoryPrune,
  setMemoryReview,
  setProjectDescription,
  stampLeftoverPrune,
} from '../agent/settings'
import { agentsWithBacklog, AUTO_GAP, readsNew, scheduleDue, stampMs, type DueAnswer, type DueAsk } from '../agent/due'
import { projectDescribed } from '../agent/project'
import { anyChatToReview } from '../agent/memory-review'
import { nextReflection, REFLECT_BATCH } from '../agent/propose'
import { advanceLanding } from '../agent/landing'
import { refinementStep } from '../agent/refine'
import { proRefusal } from '../agent/start'
import { dueScheduledAgents } from '../agent/scheduled'
import { proAccess, type ProAccess } from '../cloud/pro'
import { pruneLeftovers } from '../leftovers'
import { listRuns } from '../agent/sessions'
import { noteRefineTried, withStore } from '../agent/store'
import type { AgentRequest, BoardScheduleKey, BoardScheduleView, RunView, Saved } from '../agent/types'
import { TODO } from '../paths'
import { allCards } from './read'
import { byDispatchOrder, canRefine, scheduleWouldDoNothing } from './rules'
import type { ScheduleReads } from '../agents/parse'
import type { Card } from './types'

/** How the timer takes a card's mark off. Handed in rather than reached for, because the
 *  write is the board's own operation (lib/board/local.ts) and this file holds the rules,
 *  not the writer. It answers false when the card moved or went away in between. */
export type ClearMark = (id: number) => Promise<boolean>

/** Delete the archived cards past their keep, for a board whose archive lives elsewhere. */
export type PruneArchive = (now: number) => Promise<void>

// ---- the board's own scheduled agents (#514, #748, #929, #1268, #1464, #1475) --
//
// One rule for all five (../agent/due.ts): off starts nothing, none starts while one of its
// own is going, and each is due once its gap has passed, there is something new for it, and
// nothing it sent to triage is unhandled. The proposer has no switch or cadence of its own.

type ScheduleName = BoardScheduleKey | 'proposer'

interface BoardSchedule {
  action: AgentRequest['action']
  agent: string
  /** What new input it runs on — `newWork` is how it is read. Absent: it runs on its gap alone. */
  reads?: ScheduleReads
  /** Null while off. `write` lets the pruner's first look stamp where it counts from. */
  ask: (runs: RunView[], write: boolean) => Omit<DueAsk, 'attempts' | 'backlog' | 'reads'> | null
}

const own = (runs: RunView[], action: AgentRequest['action']): RunView[] => runs.filter((r) => r.action === action)

const newestOf = (runs: RunView[]): RunView | null =>
  runs.reduce<RunView | null>((a, r) => (a && a.startedAt >= r.startedAt ? a : r), null)

const SCHEDULES: Record<ScheduleName, BoardSchedule> = {
  // Counts from the scheduler's first look rather than from never (#1208), so a board's
  // first prune lands a whole cadence after upgrade.
  memoryPrune: {
    action: 'prune-memory',
    agent: 'memory-pruner',
    ask: (_, write) => {
      const schedule = memoryPrune()
      if (!schedule.enabled) return null
      const clock = write ? scheduleClock('memoryPrune') : schedule.lastRun || schedule.since || formatStamp(new Date())
      if (!clock) return null
      return { cadence: schedule.cadence, fallback: DEFAULT_CADENCE.memoryPrune, from: stampMs(clock), newWork: () => true }
    },
  },
  // A batch that passed with conversations still waiting goes on at once: the round lasts
  // until none are (#1322).
  memoryReview: {
    action: 'review-memory',
    agent: 'memory-reviewer',
    reads: 'chats',
    ask: (runs) => {
      const review = memoryReview()
      if (!review.enabled) return null
      const newest = newestOf(own(runs, 'review-memory'))
      const last = Math.max(stampMs(review.lastRun), newest?.startedAt ?? 0)
      const goesOn = review.remainingAt > 0 && review.remainingAt >= last && (!newest || newest.status === 'done')
      return { cadence: review.cadence, fallback: MEMORY_REVIEW_CADENCE, from: stampMs(review.lastRun), goesOn, newWork: anyChatToReview }
    },
  },
  // The window is the last pass, so what a failed one missed is still in it next time.
  dismissalReview: {
    action: 'review-dismissals',
    agent: 'dismissal-reviewer',
    reads: 'dismissals',
    ask: () => {
      const review = dismissalReview()
      if (!review.enabled) return null
      const from = stampMs(review.lastRun)
      return { cadence: review.cadence, fallback: DEFAULT_CADENCE.dismissalReview, from, newWork: () => readsNew('dismissals', from) }
    },
  },
  // Only while `project.md` has no description, or the branch has commits since the last pass.
  projectDescription: {
    action: 'describe-project',
    agent: 'project-writer',
    reads: 'commits',
    ask: () => {
      const schedule = projectDescription()
      if (!schedule.enabled) return null
      const from = stampMs(schedule.lastRun)
      return {
        cadence: schedule.cadence,
        fallback: DEFAULT_CADENCE.projectDescription,
        from,
        newWork: () => !projectDescribed() || readsNew('commits', from),
      }
    },
  },
  // The cards waiting for a reflection (#1467) are what it reads. A full batch that passed
  // goes on at once, since more may be queued behind it.
  proposer: {
    action: 'reflect',
    agent: 'proposer',
    reads: 'archived-cards',
    ask: (runs) => {
      const passed = own(runs, 'reflect').filter((r) => r.status === 'done')
      const newest = newestOf(own(runs, 'reflect'))
      const goesOn = newest?.status === 'done' && (newest.cards?.length ?? 0) >= REFLECT_BATCH
      return { cadence: AUTO_CADENCE, fallback: AUTO_GAP, from: newestOf(passed)?.startedAt ?? 0, goesOn, newWork: () => reflectQueue().length > 0 }
    },
  },
}

/** When one may next start and what holds it, or null while it is off. */
function scheduleAnswer(name: ScheduleName, runs: RunView[], write: boolean, backlog: () => Set<string>): DueAnswer | null {
  const schedule = SCHEDULES[name]
  const ask = schedule.ask(runs, write)
  if (!ask) return null
  return scheduleDue({ ...ask, reads: !!schedule.reads, attempts: own(runs, schedule.action), backlog: () => backlog().has(schedule.agent) })
}

function scheduleDueNow(name: ScheduleName, runs: RunView[], backlog: () => Set<string>): boolean {
  if (runs.some((r) => r.action === SCHEDULES[name].action && r.status === 'running')) return false
  const due = scheduleAnswer(name, runs, true, backlog)
  return !!due && !due.wait
}

/** The board's own scheduled agents as a screen draws them: on or off, how often, when each
 *  runs next, and what holds it now. */
export async function boardSchedules(): Promise<Record<BoardScheduleKey, BoardScheduleView>> {
  let runs: RunView[] = []
  try {
    runs = await listRuns()
  } catch {
    // no record to read — every clock counts from its last pass alone
  }
  const saved = { memoryPrune: memoryPrune(), memoryReview: memoryReview(), dismissalReview: dismissalReview(), projectDescription: projectDescription() }
  let held: Set<string> | undefined
  const backlog = () => (held ??= agentsWithBacklog())
  const view = (key: BoardScheduleKey): BoardScheduleView => {
    const due = scheduleAnswer(key, runs, false, backlog)
    return {
      enabled: saved[key].enabled,
      cadence: saved[key].cadence,
      nextRun: due ? formatStamp(due.next) : '',
      ...(due?.wait === 'nothingNew' ? { nothingNew: true } : {}),
      ...(due?.wait ? { waiting: due.wait } : {}),
    }
  }
  return {
    memoryPrune: view('memoryPrune'),
    memoryReview: view('memoryReview'),
    dismissalReview: view('dismissalReview'),
    projectDescription: view('projectDescription'),
  }
}

/** Save one of them: how often, and whether it is off. */
export function setBoardSchedule(key: BoardScheduleKey, next: { enabled: boolean; cadence: string }): Saved {
  switch (key) {
    case 'memoryPrune':
      return setMemoryPrune(next)
    case 'memoryReview':
      return setMemoryReview(next)
    case 'dismissalReview':
      return setDismissalReview(next)
    case 'projectDescription':
      return setProjectDescription(next)
  }
}

// The action a scheduled card runs, as a request. A card's schedule is written in the same
// words a run is started by, so it carries straight over. The notes typed when it was
// scheduled ride along and reach the agent.
const scheduledRequest = (card: Card): AgentRequest => ({
  action: card.schedule!.action === 'refine' ? refinementStep(card) as 'clarify' : 'implement',
  id: card.id,
  title: card.title,
  notes: card.schedule!.notes || undefined,
  ...(card.schedule!.action === 'refine' ? { refineRound: 1 } : {}),
})

/**
 * The one scheduled run to start right now, and the mark taken off every card this pass
 * settles. Null when nothing is waiting.
 *
 * A card is ready when nothing it waits on is open any more — archived and rejected count
 * the same, since either way that card is off the board and holds nothing up. A card that
 * was never waiting on anything is ready at once, which is what makes a schedule a way to
 * queue a run for the board to start rather than only a dependency's follow-up.
 *
 * At most one starts per tick, in the board's own order, and the rest keep their mark:
 * a scheduled run does real work in the repo, and several at once is a merge nobody asked
 * for.
 *
 * The mark comes OFF here, in the same pass that hands the run back. That is deliberate:
 * this is the only moment the board can be sure of starting it exactly once. Leaving it on
 * until the run had begun would fire the card again next tick whenever a start was refused
 * — and a run that fails or is stopped is not meant to fire again. The card is plain again
 * and the user starts it by hand.
 *
 * A schedule whose action would no longer do anything — a refine on a card someone already
 * took to `ready` — is dropped in the same pass rather than started, and dropping one is not
 * a start, so it never uses up the tick.
 *
 * A card whose Pro workflow this account cannot run keeps its mark and is passed over (#1281),
 * so it starts on the first tick after Pro is on. Cloud is asked at most once per pass.
 */
async function dueScheduled(
  cards: Card[],
  busy: Set<number>,
  clearMark: ClearMark,
  ask: () => Promise<ProAccess>,
): Promise<AgentRequest | null> {
  const ready = cards.filter((c) => c.schedule && !busy.has(c.id) && c.openBlockers.length === 0)
  if (ready.length === 0) return null
  let request: AgentRequest | null = null
  for (const card of ready.sort(byDispatchOrder)) {
    const stale = scheduleWouldDoNothing(card)
    // One start per tick. Everything after it keeps its mark — except a stale one, which
    // is dropped whenever we meet it, since no later tick would do anything else with it.
    if (!stale && request) continue
    if (!stale && (await proRefusal(scheduledRequest(card), ask))) continue
    // The card moved or went away between the read and this write — leave it be.
    if (!(await clearMark(card.id))) continue
    if (!stale) request = scheduledRequest(card)
  }
  return request
}

// How long a card's file has to have been left alone before the board refines it (#1366), so
// it never gets in ahead of a session still writing the card, or of an edit by hand.
const SETTLED_MS = 2 * 60_000

const settled = (card: Card, now: number): boolean => {
  try {
    return now - fs.statSync(path.join(TODO, card.relPath)).mtimeMs >= SETTLED_MS
  } catch {
    return false
  }
}

/**
 * The one card to refine without being asked (#1366): refinable, unblocked, unscheduled, not
 * busy, left alone for two minutes — and never refined before in the state it is in.
 *
 * "Never before" is a list in the run record. Every refine that starts goes on it, however it
 * started, and a card comes off the moment it stops being refinable. So a card that returns
 * to refinable is taken once more, and one whose refine failed or settled nothing is not: it
 * never left.
 *
 * The first pass on a board only writes the list, with every card refinable right then on it:
 * a backlog that was there before this rule is the user's to refine.
 *
 * A card whose Pro workflow this account cannot run is passed over and not listed, the same
 * as a scheduled one.
 */
async function dueRefine(cards: Card[], busy: Set<number>, ask: () => Promise<ProAccess>): Promise<AgentRequest | null> {
  const refinable = cards.filter(canRefine)
  const ids = new Set(refinable.map((c) => c.id))
  const tried = withStore((store) => {
    if (!store.refined) {
      store.refined = [...ids].sort((a, b) => a - b)
      return null
    }
    store.refined = store.refined.filter((id) => ids.has(id))
    return new Set(store.refined)
  })
  if (!tried) return null
  const now = Date.now()
  for (const card of refinable.sort(byDispatchOrder)) {
    if (tried.has(card.id) || busy.has(card.id) || card.schedule || card.openBlockers.length > 0) continue
    if (!settled(card, now)) continue
    const request: AgentRequest = { action: 'clarify', id: card.id, title: card.title, refineRound: 1 }
    if (await proRefusal(request, ask)) continue
    // Listed as it is handed back, like a schedule's mark: a start refused after this must
    // not come round again every tick.
    withStore((store) => noteRefineTried(store, card.id))
    return request
  }
  return null
}

/**
 * The runs the board would start on its own right now, in the order to start them.
 *
 * At most one of each kind, and each kind has a slot of its own: a scheduled card is a run the
 * user already asked for, on a card whose turn has finally come, so it must not sit behind
 * anything else that happens to be due in the same minute.
 *
 * An empty list means there is nothing to do. It never throws — a caller on a timer must
 * survive an unreadable board and try again next tick.
 */
export async function nextWork(clearMark: ClearMark, pruneArchive?: PruneArchive): Promise<AgentRequest[]> {
  let runs: RunView[]
  let cards: Card[]
  try {
    runs = await listRuns()
    // Every card, subtasks included. The columns show a group as its root alone, so reading
    // them would leave a scheduled subtask queued for good — nothing else ever starts one.
    cards = allCards()
  } catch {
    return []
  }
  // A card already in a live run is skipped — opening a second run on it would be refused
  // anyway — so we move on to the next candidate.
  const busy = new Set<number>()
  for (const r of runs) if (r.status === 'running' && r.cardId !== null) busy.add(r.cardId)
  // …and a card its creator has not finished writing (#564). Skipped here rather than left
  // to the refusal at start: `dueScheduled` takes a card's mark off in the pass that hands
  // its run back, and a start refused after that would lose the schedule for good.
  for (const c of cards) if (c.creation) busy.add(c.id)
  // …and a card whose own chat is answering (#633), for the same reason: the requirement is
  // being rewritten, and a schedule taken off in this pass would be lost to a refused start.
  for (const c of cards) if (c.discussing) busy.add(c.id)

  // Cloud is asked at most once per pass, and only when a due card needs Pro (#1281, #1293).
  let asked: Promise<ProAccess> | undefined
  const ask = () => (asked ??= proAccess())

  const work: AgentRequest[] = []
  let scheduled: AgentRequest | null = null
  try {
    scheduled = await dueScheduled(cards, busy, clearMark, ask)
  } catch {
    // The board was busy being written, or a card wouldn't take the write. Every card keeps
    // its mark, and the next tick tries again.
  }
  if (scheduled) {
    work.push(scheduled)
    if (scheduled.id !== undefined) busy.add(scheduled.id)
  }

  try {
    const refine = await dueRefine(cards, busy, ask)
    if (refine) {
      work.push(refine)
      busy.add(refine.id!)
    }
  } catch {
    // The record would not take the write. Nothing is listed, and the next tick tries again.
  }

  // The prune the pruner's own cadence has made due (#514). A slot of its own, like the two
  // above: it touches no card, so nothing it does can queue behind them or they behind it.
  let held: Set<string> | undefined
  const backlog = () => (held ??= agentsWithBacklog())
  if (scheduleDueNow('memoryPrune', runs, backlog)) work.push({ action: 'prune-memory' })

  // What cards off the board for a week still hold in .akb (#1177), and the archived cards
  // past their month (#1335), once a day. Stamped
  // first, so a prune that throws waits for tomorrow rather than retrying every tick.
  try {
    const now = new Date()
    if (!leftoverPrune().startsWith(formatDay(now)) && stampLeftoverPrune(now)) {
      pruneLeftovers(now.getTime(), !pruneArchive)
      await pruneArchive?.(now.getTime())
    }
  } catch {
    // never costs the requests below
  }

  // And the day's review of what the conversations settled (#748). A slot of its own for the
  // same reason: it touches no card, so nothing it does can queue behind a card's run.
  if (scheduleDueNow('memoryReview', runs, backlog)) work.push({ action: 'review-memory' })
  if (scheduleDueNow('dismissalReview', runs, backlog)) work.push({ action: 'review-dismissals' })
  if (scheduleDueNow('projectDescription', runs, backlog)) work.push({ action: 'describe-project' })
  // And the proposer's next batch (#1467): it touches no card either.
  if (scheduleDueNow('proposer', runs, backlog)) {
    const reflect = nextReflection()
    if (reflect) work.push(reflect)
  }

  // And every workflow's scheduled agents whose cadence has come round (#1401), a slot each.
  try {
    work.push(...(await dueScheduledAgents(ask)))
  } catch {
    // unreadable settings — the next tick tries again
  }

  // And the landing queue (#304). A landing is normally moved on by the watcher of the
  // build that just finished; this is what picks up a waiter nothing handed off to,
  // because that process died between the two. `advanceLanding` does the git work itself
  // and hands back only the run it wants started, which is why it isn't gated on the
  // slots above: a conflict run inside a landing is that delivery's own next run.
  const landing = await advanceLanding()
  if (landing) work.push(landing)
  return work
}
