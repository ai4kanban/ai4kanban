// A board's notifications (#319).
//
// Signed in means on. Notifications are not a setting the user carries: a machine signed in
// to Cloud raises this board's actionable cards, so `ensureBoardNotifications` registers the
// board rather than a switch somebody has to find. What is left to choose is which open
// release it watches, and which machine runs its approvals.
//
// Each move here is whole: enabling registers the board and fills the bell with what it is
// already holding, swapping the release republishes against the new one, and turning them
// off retires this board's live events before the record of them is dropped.

import { board } from '../board'
import { REPO_ROOT } from '../paths'
import type { WriteResult } from '../view/types'
import { cloudBoardFor, disableCloudBoard, enableCloudBoard, setCloudBoardRelease } from './boards'
import { publishBoardEvents, retireBoardEvents, startPublishing } from './publish'
import { attachBoardServer, detachBoardServer, readBoardServer, type BoardServer } from './servers'
import { readSession } from './session'

/** What this board's Cloud notifications are set to, and what it can watch. */
export interface BoardNotifications {
  /** Notifications are on for this board. */
  enabled: boolean
  /** The release it watches. Empty on an enabled board whose release has closed. */
  release: string
  /** The open releases it could watch. Empty is a board with no open release — the section
   *  says so rather than picking one that watches nothing. */
  releases: string[]
  /** Nobody is signed in on this machine, so this board raises nothing. */
  signedIn: boolean
  /** Which machine runs this board's work (#318) — an approval taken anywhere else runs
   *  there and nowhere else. */
  server: BoardServer
}

/**
 * Turn this board's notifications on because the machine is signed in.
 *
 * Idempotent, and cheap enough for every poll: a board already on reads one small file and
 * returns. A board with no open release watches nothing and is left alone — the section says
 * so. The first fill runs in the background: nothing on screen waits for Cloud.
 */
export async function ensureBoardNotifications(): Promise<void> {
  if (!readSession() || cloudBoardFor(REPO_ROOT)) return
  let open: string[] = []
  try {
    open = await board().readReleases()
  } catch {
    // A board we cannot read this second is one the next poll reads again.
    return
  }
  if (!open[0]) return
  enableCloudBoard(REPO_ROOT, open[0])
  void startPublishing().catch(() => {})
}

export async function readBoardNotifications(): Promise<BoardNotifications> {
  await ensureBoardNotifications()
  const held = cloudBoardFor(REPO_ROOT)
  let releases: string[] = []
  try {
    releases = await board().readReleases()
  } catch {
    // A board we cannot read this second offers no releases; the section says so.
  }
  return {
    enabled: !!held,
    release: held?.release ?? '',
    releases,
    signedIn: !!readSession(),
    server: await readBoardServer(),
  }
}

/**
 * Run this board's approvals on this machine, or stop.
 *
 * `takeOver` is the user moving the board to the machine in front of them: without it a
 * board another machine already holds is refused and told which one. The refusal is offered
 * with the move rather than on its own, because the case that reaches it is a home directory
 * restored onto a new machine — where the machine holding the board is the one that is gone.
 */
export async function setBoardServer(on: boolean, takeOver = false): Promise<WriteResult> {
  if (!cloudBoardFor(REPO_ROOT)) return { ok: false, error: 'Notifications are off for this board.' }
  return on ? attachBoardServer(takeOver) : detachBoardServer()
}

/** Turn them on, watching one open release. The bell fills with whatever this board is
 *  already holding actionable, and nothing is raised for any of it. */
export async function enableBoardNotifications(release: string): Promise<WriteResult> {
  if (!readSession()) return { ok: false, error: 'Sign in to Cloud first.' }
  const open = await board().readReleases()
  if (!release || !open.includes(release)) {
    return { ok: false, error: 'Pick one of this board’s open releases to watch.' }
  }
  enableCloudBoard(REPO_ROOT, release)
  await startPublishing()
  return { ok: true }
}

/** Watch a different release. What the rail asks for when the last one closed. */
export async function watchRelease(release: string): Promise<WriteResult> {
  if (!cloudBoardFor(REPO_ROOT)) return { ok: false, error: 'Notifications are off for this board.' }
  const open = await board().readReleases()
  if (!release || !open.includes(release)) {
    return { ok: false, error: 'Pick one of this board’s open releases to watch.' }
  }
  setCloudBoardRelease(REPO_ROOT, release)
  await publishBoardEvents({ reconcile: true })
  return { ok: true }
}

/** Turn them off. This board's live events are retired first — a board with notifications
 *  off must not leave a row in the bell asking about it. */
export async function disableBoardNotifications(): Promise<WriteResult> {
  if (!cloudBoardFor(REPO_ROOT)) return { ok: true }
  await retireBoardEvents()
  // A board that raises no events has no approvals to run either, so this machine stops
  // being its server (#318). Whatever is already building here finishes where it is.
  await detachBoardServer()
  disableCloudBoard(REPO_ROOT)
  return { ok: true }
}
