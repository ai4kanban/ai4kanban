// When a scheduled agent may start (#1475) — the board's own and a workflow's alike.
//
// A pass is due once its gap has passed since the later of its clock and its newest attempt,
// there is something new for it to read, nothing it sent to triage is still unhandled, and —
// for a workflow's agent — no build is running or landing. The gap is the user's cadence, or
// in `auto` an hour for an agent that reads something and its own default for one that does
// not. Failures in a row double it, up to a day.

import fs from 'node:fs'

import { formatDay, formatStamp, isAuto, nextDue, parseStamp } from '../cadence'
import { walkMd } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { ARCHIVE, CHATS_DIR, TODO } from '../paths'
import { readArchived, readInbox } from '../signals/inbox'
import type { ScheduleReads } from '../agents/parse'
import { chatOfKey, lastSpoken, readChat } from './chat'
import { dismissalWorkWaiting } from './dismissal-review'
import { commitsSince } from './project'
import type { Store } from './store'
import type { RunStatus, ScheduleReason, ScheduleWait } from './types'

/** The least gap between two passes of an `auto` agent that reads something. */
export const AUTO_GAP = '1h'
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
  backlog: () => boolean
  building?: () => boolean
}

/** When it may next start, and why it is not starting now — null when it is due. */
export interface DueAnswer {
  next: Date
  wait: ScheduleWait | null
  /** The wait as a screen says it (#1476); absent when the next run's time says it. */
  reason?: ScheduleReason
}

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
  const gap = !isAuto(ask.cadence) ? ask.cadence : ask.reads ? AUTO_GAP : ask.fallback
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
        : ask.backlog()
          ? 'unsorted'
          : ask.building?.()
            ? 'building'
            : null
  const reason = !wait || wait === 'tooSoon' ? undefined : wait === 'nothingNew' ? ask.reads : wait
  return { next, wait, ...(reason ? { reason } : {}) }
}

// ---- what is new since a pass began ------------------------------------------

/** Whether what `reads` names has anything new since `since` (ms). */
export function readsNew(reads: ScheduleReads, since: number): boolean {
  switch (reads) {
    case 'archived-cards':
      return archivedSince(since)
    case 'commits':
      return commitsSince(since) === true
    case 'chats':
      return chatsSince(since)
    case 'dismissals':
      return dismissalWorkWaiting(since)
  }
}

// A card filed after `since`, not rejected. The day guards against a fresh clone's mtimes.
function archivedSince(since: number): boolean {
  if (!fs.existsSync(ARCHIVE)) return false
  const day = formatDay(new Date(since))
  for (const file of walkMd(ARCHIVE)) {
    try {
      if (fs.statSync(file).mtimeMs <= since) continue
      const { meta } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
      if (meta && !meta.rejected && (meta.archived ?? '') >= day) return true
    } catch {
      continue
    }
  }
  return false
}

function chatsSince(since: number): boolean {
  let names: string[]
  try {
    names = fs.readdirSync(CHATS_DIR).filter((n) => n.endsWith('.json'))
  } catch {
    return false
  }
  for (const name of names) {
    try {
      if (fs.statSync(`${CHATS_DIR}/${name}`).mtimeMs <= since) continue
    } catch {
      continue
    }
    const target = chatOfKey(name.slice(0, -'.json'.length))
    const chat = target === undefined ? null : readChat(target)
    if (chat && lastSpoken(chat) > since) return true
  }
  return false
}

// ---- what holds a pass back --------------------------------------------------

/** The agents whose triage items are still unhandled: waiting in triage, or made into a card
 *  nobody has started building. Read once per pass over the board. */
export function agentsWithBacklog(): Set<string> {
  const out = new Set<string>()
  const carded = new Map<string, string>()
  try {
    for (const item of readInbox()) if (item.agent) out.add(item.agent)
    for (const item of readArchived()) if (item.agent && !out.has(item.agent)) carded.set(item.sourceId, item.agent)
  } catch {
    return out
  }
  if (!carded.size || !fs.existsSync(TODO)) return out
  for (const file of walkMd(TODO)) {
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
      const agent = meta?.triage ? carded.get(meta.triage) : undefined
      if (agent && meta!.status !== 'implementing') out.add(agent)
    } catch {
      continue
    }
  }
  return out
}

/** Whether a card is being built or landed — what a workflow's scheduled agent waits out. */
export function building(store: Store): boolean {
  const builds = new Set(store.deliveries.filter((d) => d.status === 'active' && !d.scheduled).map((d) => d.deliveryId))
  if (store.deliveries.some((d) => builds.has(d.deliveryId) && d.landing)) return true
  return store.runs.some((r) => r.status === 'running' && r.deliveryId !== undefined && builds.has(r.deliveryId))
}

/** A stamp read as ms, 0 for none. */
export const stampMs = (stamp: string | undefined): number => parseStamp(stamp)?.getTime() ?? 0
