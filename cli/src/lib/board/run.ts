// ---- what a run does around its board (#398) ---------------------------------
//
// The run engine calls these and never learns which kind of board it is on: every one of
// them does nothing on a Local board, where the folder in this checkout IS the record and
// there is nobody else to fence off.
//
// On a Cloud board they are the bracket around a run:
//
//   • **before it starts** — the card's workspace lock is taken, and a run that cannot have
//     it does not start,
//   • **while it goes** — the lock is renewed from the watcher, the one process alive for
//     the whole run, and every `akb board` move the run makes presents the same lease
//     (`board/cloud.ts`),
//   • **at its close** — the card bodies the run is answerable for and the memory,
//     configuration and rule files it wrote are sent to the workspace in one pass, before
//     the close starts any follow-up run.

import { cloudHandle } from './open'
import type { CarryResult } from './cloud'
import type { BoardPayload } from './transfer'
import { stampHolder } from '../cloud/holds'

/**
 * How often a run's hold on its card is renewed, and how soon a renewal that did not land is
 * tried again.
 *
 * Well inside the service's own `CARD_LOCK_SECONDS` (30 minutes), and measured in minutes for
 * the same reason a live claim's lease is (`cloud/requests.ts`): each renewal is one write
 * against a daily budget the whole service shares, so a run of hours must cost tens of them
 * rather than thousands.
 */
const CARD_RENEW_MS = 10 * 60_000
const CARD_RETRY_MS = 60_000

export type RunHold = { ok: true } | { ok: false; error: string }

/** Whether a run may start on this board at all. A Cloud board out of reach refuses one
 *  rather than letting it work the copy already on disk — the machine holding the card would
 *  have its edits written over the moment the workspace came back. */
export function runCanStart(): RunHold {
  const cloud = cloudHandle()
  if (!cloud || !cloud.state().offline) return { ok: true }
  return { ok: false, error: UNREACHABLE }
}

const UNREACHABLE =
  'Cloud could not be reached, so this run was not started — a run works the workspace, ' +
  'never the copy left on this machine. Try again when the board is back.'

/**
 * Hold this run's card before it starts.
 *
 * Three answers, and two of them stop the run before a record is written: another machine is
 * holding the card, and the workspace could not be reached at all. A run has to reach the
 * workspace — working the copy already on disk would write over what the machine holding the
 * card is doing with it.
 */
export async function takeRunCard(sessionId: string, cardId: number | null): Promise<RunHold> {
  const cloud = cloudHandle()
  if (!cloud) return { ok: true }
  // Nothing to lock on a run that holds no card. It still needs the workspace, because its
  // close has edits to send there.
  if (cardId === null) return runCanStart()
  const got = await cloud.holdCard(cardId, sessionId)
  if (got.ok) return { ok: true }
  if (got.takenOver) {
    return {
      ok: false,
      error:
        `#${cardId} is held by another machine on this workspace` +
        `${got.until ? `, until ${got.until}` : ''}. Wait for that hold to run out, or work another card.`,
    }
  }
  // Anything else the workspace never answered: the run does not start on the copy alone,
  // because the machine holding the card would have its edits written over.
  return { ok: false, error: cloud.state().offline ? UNREACHABLE : got.error }
}

/** Give this run's share of its card back. The workspace's lock goes with it when nothing
 *  else on this machine is holding that card. */
export async function dropRunCard(sessionId: string): Promise<void> {
  await cloudHandle()?.freeCard(sessionId)
}

/**
 * Keep the card held for as long as this run is up, and say when it stops being ours.
 *
 * `lost` is the one ending that drops what a run wrote: the lease expired, another machine
 * took the card, and the work on the board this run did was never the workspace's to keep.
 * Everything else is retried while there is still a lease to renew — including a renewal that
 * finds the card free, which takes it back under the same lease.
 */
export function holdRunCard(sessionId: string, cardId: number | null, lost: () => void): () => void {
  const cloud = cloudHandle()
  if (!cloud || cardId === null) return () => {}
  stampHolder(sessionId, process.pid)

  let stopped = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const again = (ms: number) => {
    if (stopped) return
    timer = setTimeout(tick, ms)
    timer.unref?.()
  }
  const tick = async (): Promise<void> => {
    if (stopped) return
    const got = await cloud.holdCard(cardId, sessionId)
    if (stopped) return
    if (got.ok) return again(CARD_RENEW_MS)
    if (got.takenOver) {
      stopped = true
      lost()
      return
    }
    again(CARD_RETRY_MS)
  }
  again(CARD_RENEW_MS)
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}

/** The board as it stands, for the bracket a run takes around its own work. Null on a Local
 *  board, where nothing is uploaded and nothing has to be compared. */
export const boardImage = (): BoardPayload | null => cloudHandle()?.image() ?? null

/** Send what this run wrote to the workspace. A card another live run holds is left out — it
 *  is that run's to upload when it closes. */
export async function carryRunEdits(
  before: BoardPayload | null,
  sessionId: string,
): Promise<CarryResult | null> {
  const cloud = cloudHandle()
  if (!cloud || !before) return null
  return await cloud.carry(before, sessionId)
}

/** Put the machine's copy of one card back to what the workspace holds — what a run whose
 *  lock was taken over ends with. */
export async function rereadRunCard(cardId: number | null): Promise<void> {
  if (cardId === null) return
  await cloudHandle()?.reread(cardId)
}
