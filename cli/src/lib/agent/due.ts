// When a scheduled agent may start (#1475), as a Runner judges it.
//
// A pass is due once its gap has passed since the later of its clock and its newest attempt
// and there is something new for it to read. The gap is the user's cadence, or
// in `auto` six hours for an agent that reads something and its own default for one that does
// not. Failures in a row double it, up to a day.

import { formatStamp, isAuto, nextDue } from '../cadence'
import type { ScheduleReads } from '../agents/parse'
import type { AutoSchedule, RunStatus, ScheduleReason, ScheduleWait } from './types'

/** The least gap between two passes of an `auto` agent that reads something. */
export const AUTO_GAP = '6h'
const DAY = 86_400_000

export interface DueAsk {
  /** The saved cadence, or `auto`. */
  cadence: string
  /** What an `auto` agent that reads nothing runs on. */
  fallback: string
  /** What new input it runs on. Absent: it runs on its gap alone. */
  reads?: ScheduleReads
  /** Its clock, ms: the last pass that passed, or where it was first looked at. 0 for never. */
  from: number
  /** Its own runs. */
  attempts: { startedAt: number; status: RunStatus }[]
  /** A round that passed with work still listed goes on at once. */
  goesOn?: boolean
  newWork: () => boolean
}

/** When it may next start, and why it is not starting now — null when it is due. */
export interface DueAnswer {
  next: Date
  wait: ScheduleWait | null
  /** The wait as a screen says it (#1476); absent when the next run's time says it. */
  reason?: ScheduleReason
}

/** What `auto` means for one agent, as its cadence list says it (#1543). */
export const autoSchedule = (reads: ScheduleReads | undefined, fallback: string): AutoSchedule =>
  reads ? { every: AUTO_GAP, reads } : { every: fallback }

/** How many of the newest attempts failed in a row. */
const failures = (attempts: DueAsk['attempts']): number => {
  let n = 0
  for (const a of [...attempts].sort((x, y) => y.startedAt - x.startedAt)) {
    if (a.status === 'running') continue
    if (a.status === 'done') break
    n++
  }
  return n
}

export function scheduleDue(ask: DueAsk, now: number = Date.now()): DueAnswer {
  const gap = !isAuto(ask.cadence) ? ask.cadence : autoSchedule(ask.reads, ask.fallback).every
  const from = Math.max(ask.from, ...ask.attempts.map((a) => a.startedAt))
  let next = ask.goesOn ? new Date(0) : from ? nextDue(formatStamp(new Date(from)), gap) ?? new Date(0) : new Date(0)
  const failed = failures(ask.attempts)
  if (!ask.goesOn && from && failed > 1) {
    const base = next.getTime() - from
    next = new Date(from + Math.min(base * 2 ** (failed - 1), Math.max(base, DAY)))
  }
  // Said only after a real failure: a run the user stopped did not fail.
  const newest = ask.attempts.reduce<DueAsk['attempts'][number] | null>((a, r) => (a && a.startedAt >= r.startedAt ? a : r), null)
  const retrying = isAuto(ask.cadence) && newest?.status === 'error'
  const wait: ScheduleWait | null =
    next.getTime() > now
      ? retrying
        ? 'retrying'
        : 'tooSoon'
      : !ask.newWork()
        ? 'nothingNew'
        : null
  const reason = !wait || wait === 'tooSoon' ? undefined : wait === 'nothingNew' ? ask.reads : wait
  return { next, wait, ...(reason ? { reason } : {}) }
}
