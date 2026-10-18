// This board's own notification record (#1817).
//
// The bell and the system notifications read this first, signed in or not. It holds the same
// events Cloud would — one live row per card, retired the same way — so a signed-out machine
// gets the same rail, and a signed-in one pairs each row with its Cloud copy rather than
// drawing it twice. Cloud stays a copy: it is fed from the outbox as before.
//
// Kept in the board's state folder, under its own lock: the board server and a terminal `akb`
// both write it.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { withLock } from '../lock'
import { BOARD_STATE } from '../paths'
import { isFinalEventState, type CloudEvent, type CloudEventState } from './events'
import type { EventSnapshot } from './snapshot'

export interface LocalEvent extends CloudEvent {
  /** What the card was asking — pairs this row with its Cloud copy. */
  fingerprint: string
  /** The Cloud event this row was published as, once the outbox has sent it. */
  cloudId?: string
}

/** Ids a Cloud event can never wear. */
export const LOCAL_PREFIX = 'local:'

export const isLocalEvent = (eventId: string): boolean => eventId.startsWith(LOCAL_PREFIX)

/** Ended events kept, newest first. Live ones are all kept. */
export const KEEP_ENDED = 200

const recordFile = (): string => path.join(BOARD_STATE, 'notifications.json')
const recordLock = (): string => path.join(BOARD_STATE, 'notifications.lock')

export function readLocalEvents(): LocalEvent[] {
  try {
    const held = JSON.parse(fs.readFileSync(recordFile(), 'utf8')) as { events?: unknown }
    return Array.isArray(held.events) ? (held.events as LocalEvent[]).filter((e) => e && typeof e.id === 'string') : []
  } catch {
    return []
  }
}

/** Read, change, write under the lock. `fresh` is true while the record does not exist yet. */
function editLocal(change: (events: LocalEvent[], fresh: boolean) => void): void {
  fs.mkdirSync(BOARD_STATE, { recursive: true })
  withLock(recordLock(), 'writing this board’s notifications', () => {
    const fresh = !fs.existsSync(recordFile())
    const events = readLocalEvents()
    change(events, fresh)
    const file = recordFile()
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify({ version: 1, events: prune(events) }, null, 2)}\n`)
    fs.renameSync(tmp, file)
  })
}

function prune(events: LocalEvent[]): LocalEvent[] {
  const ended = events
    .filter((e) => isFinalEventState(e.state))
    .sort((a, b) => (a.changedAt < b.changedAt ? 1 : -1))
    .slice(0, KEEP_ENDED)
  const kept = new Set(ended)
  return events.filter((e) => !isFinalEventState(e.state) || kept.has(e))
}

const newestFirst = (a: LocalEvent, b: LocalEvent) => (a.changedAt < b.changedAt ? 1 : -1)

function eventOf(s: EventSnapshot, now: string, broughtIn: boolean): LocalEvent {
  return {
    id: `${LOCAL_PREFIX}${crypto.randomUUID()}`,
    boardId: '',
    workspaceId: '',
    boardName: s.boardName,
    taskId: s.taskId,
    taskTitle: s.taskTitle,
    revision: s.revision,
    kind: s.kind,
    decision: s.decision,
    state: 'actionable',
    questions: [],
    summary: '',
    notes: '',
    reason: '',
    serverName: '',
    createdAt: now,
    changedAt: now,
    broughtIn,
    acted: false,
    fingerprint: s.fingerprint,
  }
}

function ask(e: LocalEvent, s: EventSnapshot, now: string): void {
  Object.assign(e, {
    state: 'actionable',
    kind: s.kind,
    decision: s.decision,
    taskTitle: s.taskTitle,
    revision: s.revision,
    fingerprint: s.fingerprint,
    broughtIn: false,
    changedAt: now,
  })
}

/**
 * Bring the record in line with what the board is asking now — the same rules the publisher
 * holds Cloud to: one row asking per card, refreshed in place when the question moves, revived
 * from `stale`, and retired once the card needs nobody. A delivery's row is its own, so a card
 * it carries raises nothing beside it unless the delivery stopped for an answer.
 *
 * `sweep` is false when the board read as empty: a read does that, a board does not.
 */
export function syncLocalEvents(
  snapshots: EventSnapshot[],
  { stopped, sweep, titles }: { stopped: ReadonlySet<number>; sweep: boolean; titles: ReadonlyMap<number, string> },
): void {
  editLocal((events, fresh) => {
    const now = new Date().toISOString()
    const seen = new Set<number>()
    for (const s of snapshots) {
      seen.add(s.taskId)
      const mine = events.filter((e) => e.taskId === s.taskId).sort(newestFirst)
      const asking = mine.find((e) => !e.acted && e.state === 'actionable')
      if (asking) {
        if (asking.fingerprint !== s.fingerprint) ask(asking, s, now)
        else asking.revision = s.revision
        continue
      }
      if (!stopped.has(s.taskId) && mine.some((e) => e.acted && !isFinalEventState(e.state))) continue
      const stale = mine.find((e) => !e.acted && e.state === 'stale')
      if (stale) ask(stale, s, now)
      else events.push(eventOf(s, now, fresh))
    }
    for (const e of events) {
      if (sweep && !e.acted && e.state === 'actionable' && !seen.has(e.taskId)) {
        e.state = 'stale'
        e.changedAt = now
      }
      if (!e.taskTitle) e.taskTitle = titles.get(e.taskId) ?? ''
    }
  })
}

/**
 * Where a delivery on one card has got to. Its start takes over the row asking about the card,
 * or opens one, and its ending is written on that same row. An ending with no row started
 * here says nothing: there is no delivery this record saw begin.
 */
export function recordLocalDelivery(
  taskId: number,
  state: CloudEventState,
  { reason = '', boardName = '', fingerprint = '' }: { reason?: string; boardName?: string; fingerprint?: string } = {},
): void {
  editLocal((events) => {
    const now = new Date().toISOString()
    const mine = events.filter((e) => e.taskId === taskId).sort(newestFirst)
    const live = mine.find((e) => e.acted && !isFinalEventState(e.state))
    if (live) {
      if (live.state === state) return
      Object.assign(live, { state, changedAt: now, ...(isFinalEventState(state) ? { reason } : {}) })
      return
    }
    if (isFinalEventState(state)) return
    const taken = mine.find((e) => !e.acted && (e.state === 'actionable' || e.state === 'stale'))
    if (taken) {
      Object.assign(taken, { acted: true, decision: 'implement', state, changedAt: now, broughtIn: false })
      return
    }
    events.push({
      ...eventOf(
        {
          boardId: '',
          workspaceId: '',
          boardName,
          taskId,
          taskTitle: '',
          revision: '',
          kind: 'ready_for_review',
          decision: 'implement',
          questions: [],
          summary: '',
          notes: '',
          fingerprint,
          broughtIn: false,
          besides: '',
        },
        now,
        false,
      ),
      acted: true,
      state,
    })
  })
}

/** Name the Cloud event a row was published as, so the bell can pair the two. */
export function linkLocalEvent(taskId: number, fingerprint: string, cloudId: string): void {
  const rowOf = (events: LocalEvent[]) =>
    events
      .filter((e) => e.taskId === taskId && e.fingerprint === fingerprint && !isFinalEventState(e.state))
      .sort(newestFirst)[0]
  const held = rowOf(readLocalEvents())
  if (!held || held.cloudId === cloudId) return
  editLocal((events) => {
    const row = rowOf(events)
    if (row) row.cloudId = cloudId
  })
}
