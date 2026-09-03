// ---- the cards this machine is holding in a workspace (#398) ----------------
//
// `~/.ai4kanban/holds.json`, beside the sign-in and the copies list. One row per card this
// machine holds a workspace lock over, with the lease the workspace minted and the runs
// here that are holding it.
//
// It is machine-level, not per-process, because a run is not one process: the watcher
// starts the agent, the agent's `akb board` moves are processes of their own, and the app's
// server is another. `cloud.require_lock` refuses a lease that is not the holder's, so a run
// that held its card against the rest of the machine would refuse its own lifecycle moves —
// what fences other MACHINES off has to be one lease every process here presents.
//
// A row is only ever as true as its expiry: the workspace frees a lock that runs out, so a
// row past `expiresAt` is read as no hold at all, and the fallback for a run that never gets
// to give its lease back is that same expiry.

import fs from 'node:fs'
import path from 'node:path'

import { pidAlive } from '../lock'
import { machineHome } from '../machine/home'

/** One run on this machine holding a card. `pid` is its watcher, stamped once that process
 *  is up, so a run whose watcher was killed stops holding the card here. */
export interface Holder {
  sessionId: string
  pid?: number
}

export interface CardHold {
  workspaceId: string
  cardId: number
  /** What the workspace minted, and what every write from this machine presents. */
  leaseId: string
  /** When the workspace's own hold runs out, as an ISO timestamp. */
  expiresAt: string
  holders: Holder[]
}

interface Held {
  version: 1
  holds: CardHold[]
}

export const holdsFile = (): string => path.join(machineHome(), 'holds.json')

function held(): Held {
  try {
    const parsed = JSON.parse(fs.readFileSync(holdsFile(), 'utf8')) as Held
    const holds = parsed?.holds
    if (!Array.isArray(holds)) return { version: 1, holds: [] }
    return {
      version: 1,
      holds: holds.filter(
        (h) => h && typeof h.workspaceId === 'string' && Number.isInteger(h.cardId) && typeof h.leaseId === 'string',
      ).map((h) => ({ ...h, holders: Array.isArray(h.holders) ? h.holders : [] })),
    }
  } catch {
    return { version: 1, holds: [] }
  }
}

function write(next: Held): void {
  try {
    fs.mkdirSync(machineHome(), { recursive: true, mode: 0o700 })
    const file = holdsFile()
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(tmp, file)
  } catch {
    // A machine with no home directory to write to still runs its board: what it loses is
    // presenting one lease from every process, which the workspace answers by refusing the
    // second writer until the first lock expires.
  }
}

const live = (hold: CardHold): boolean => Date.parse(hold.expiresAt) > Date.now()

/** Rows worth keeping: the hold has not run out, and somebody here is still holding it. A
 *  holder whose watcher is gone stops counting, so an interrupted run hands its card back
 *  at the next hold anyone takes rather than at the lease's expiry. */
const kept = (holds: CardHold[]): CardHold[] =>
  holds
    .map((h) => ({ ...h, holders: h.holders.filter((who) => who.pid === undefined || pidAlive(who.pid)) }))
    .filter((h) => live(h) && h.holders.length > 0)

const at = (holds: CardHold[], workspaceId: string, cardId: number): number =>
  holds.findIndex((h) => h.workspaceId === workspaceId && h.cardId === cardId)

/** The lease this machine holds over that card, or `''` when it holds none. What every
 *  write over the card presents, so nothing here is refused by this machine's own hold. */
export function heldLease(workspaceId: string, cardId: number): string {
  const hold = held().holds.find((h) => h.workspaceId === workspaceId && h.cardId === cardId)
  return hold && live(hold) && hold.holders.length ? hold.leaseId : ''
}

/** Write down that `sessionId` holds this card under `lease`, joining a hold this machine
 *  already has rather than replacing it. */
export function rememberHold(
  workspaceId: string,
  cardId: number,
  sessionId: string,
  lock: { leaseId: string; expiresAt: string },
): void {
  const state = held()
  state.holds = kept(state.holds)
  const found = at(state.holds, workspaceId, cardId)
  const holders = found < 0 ? [] : state.holds[found]!.holders
  state.holds = [
    ...state.holds.filter((_, i) => i !== found),
    {
      workspaceId,
      cardId,
      leaseId: lock.leaseId,
      expiresAt: lock.expiresAt,
      holders: holders.some((who) => who.sessionId === sessionId) ? holders : [...holders, { sessionId }],
    },
  ]
  write(state)
}

/** Record the process watching this run, so a watcher that dies stops holding the card. */
export function stampHolder(sessionId: string, pid: number): void {
  const state = held()
  for (const hold of state.holds) {
    const who = hold.holders.find((h) => h.sessionId === sessionId)
    if (who) who.pid = pid
  }
  write(state)
}

/** Let go of one run's share of a card. `free` is true when nothing on this machine is
 *  holding it any more — which is when the workspace's lock is given back. */
export function forgetHolder(sessionId: string): { workspaceId: string; cardId: number; leaseId: string; free: boolean } | null {
  const state = held()
  const hold = state.holds.find((h) => h.holders.some((who) => who.sessionId === sessionId))
  if (!hold) return null
  hold.holders = hold.holders.filter((who) => who.sessionId !== sessionId)
  // Pruned FIRST, then asked: a run whose watcher was killed stops holding the card here,
  // so it must not keep the lease alive for the run that is closing cleanly beside it.
  state.holds = kept(state.holds)
  const free = at(state.holds, hold.workspaceId, hold.cardId) < 0
  write(state)
  return { workspaceId: hold.workspaceId, cardId: hold.cardId, leaseId: hold.leaseId, free }
}

/** Drop the whole row — the card is no longer this machine's, whoever was holding it. */
export function dropHold(workspaceId: string, cardId: number): void {
  const state = held()
  state.holds = state.holds.filter((h) => !(h.workspaceId === workspaceId && h.cardId === cardId))
  write(state)
}
