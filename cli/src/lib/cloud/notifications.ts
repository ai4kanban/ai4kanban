// A board's notifications (#319).
//
// Signed in means on. Notifications are not a setting the user carries: a machine signed in
// to Cloud raises this board's actionable cards, so `ensureBoardNotifications` registers the
// board rather than a switch somebody has to find. What is left to choose is how wide it
// watches — every release, or one — and which machine runs its approvals.
//
// Each move here is whole: enabling registers the board and fills the bell with what it is
// already holding, swapping the release republishes against the new one, and turning them
// off retires this board's live events before the record of them is dropped.
//
// On a Cloud checkout the switch and the release are not this machine's (#328). They belong to
// the MEMBER inside the workspace, so they follow them to every machine they open the board on
// and Cloud can resolve which members are watching a release when a card raises a decision.
// This machine's record becomes the mirror of that answer — every read pulls it down, every
// move writes through — and the first read hands over whatever the record already held.
//
// Every fill is QUIET (#451). What a switch brings into view was already waiting, so it lands
// in the bell read, raises nothing, and costs one summary in the chat instead of a message a
// card. Only a card that starts waiting after the switch is raised.

import { board } from '../board'
import { KANBAN, REPO_ROOT } from '../paths'
import type { WriteResult } from '../view/types'
import {
  ALL_RELEASES,
  cloudBoardFor,
  disableCloudBoard,
  enableCloudBoard,
  mirrorWatch,
  setCloudBoardRelease,
  type CloudBoard,
} from './boards'
import { carryWorkspaceWatch, readWorkspaceWatch, setWorkspaceWatch } from './client'
import { readPointer } from './pointer'
import { publishBoardEvents, retireBoardEvents, startPublishing } from './publish'
import { attachBoardServer, detachBoardServer, readBoardServer, type BoardServer } from './servers'
import { readSession } from './session'

/** What this board's Cloud notifications are set to, and what it can watch. */
export interface BoardNotifications {
  /** Notifications are on for this board. */
  enabled: boolean
  /** What it watches: `ALL_RELEASES`, or one open release. Empty on an enabled board whose
   *  watched release has closed. */
  release: string
  /** The open releases it could narrow to. Empty is a board with no open release — every
   *  card still raises, since watching all of them needs no release to exist. */
  releases: string[]
  /** Nobody is signed in on this machine, so this board raises nothing. */
  signedIn: boolean
  /** Which machine runs this board's work (#318) — an approval taken anywhere else runs
   *  there and nowhere else. */
  server: BoardServer
  /** This board lives in a workspace, so the switch and the release above are this member's
   *  inside it and not this machine's (#328). What a screen says about them is the same
   *  either way; what changes is who else the same answer follows. */
  shared: boolean
}

/** The workspace this checkout's board lives in, or empty on a Local board. */
const workspaceHere = (): string => readPointer(REPO_ROOT)?.workspace ?? ''

/**
 * Pull the workspace's answer down into this machine's record, handing this machine's own over
 * the first time.
 *
 * The publisher is a synchronous pass that cannot reach the network, so it reads the mirror.
 * The carry is once, and the service is what remembers that: a record handed over on every
 * start-up would overwrite a change made in a browser with whatever the last machine to wake
 * up believes.
 *
 * Best effort. A Cloud we cannot reach this second leaves the mirror as it stands, which is
 * the answer the last read wrote.
 */
async function pullWatch(workspaceId: string, held: CloudBoard): Promise<void> {
  const read = await readWorkspaceWatch(workspaceId)
  if (!read.ok) return
  let watch = read.value.watch
  // Only a record the user actually chose is worth carrying. A teammate who has just cloned
  // the repository holds the every-release default a signed-in machine mints for any board,
  // and handing that over would overwrite the narrower default an owner adding them set.
  if (!watch.carried && held.chosen) {
    const carried = await carryWorkspaceWatch(workspaceId, !held.watchOff, held.release)
    if (carried.ok) watch = carried.value.watch
  }
  mirrorWatch(KANBAN, watch)
}

/** Write a move through to the workspace, and mirror what it answers. The workspace is the
 *  authority: a move this machine could not get out is a move that did not happen. */
async function pushWatch(workspaceId: string, notify: boolean, release: string): Promise<WriteResult> {
  const written = await setWorkspaceWatch(workspaceId, notify, release)
  if (!written.ok) return { ok: false, error: written.error }
  mirrorWatch(KANBAN, written.value.watch)
  return { ok: true }
}

/**
 * Turn this board's notifications on because the machine is signed in.
 *
 * Idempotent, and cheap enough for every poll: a board already on reads one small file and
 * returns. It starts on every release — a board yet to cut its first one still has cards that
 * need a person, and narrowing is the choice the user makes, not one made for them. The first
 * fill runs in the background: nothing on screen waits for Cloud.
 */
export async function ensureBoardNotifications(): Promise<void> {
  if (!readSession() || cloudBoardFor(KANBAN)) return
  enableCloudBoard(KANBAN, REPO_ROOT, ALL_RELEASES)
  void startPublishing().catch(() => {})
}

export async function readBoardNotifications(): Promise<BoardNotifications> {
  await ensureBoardNotifications()
  let held = cloudBoardFor(KANBAN)
  const workspace = workspaceHere()
  if (held && workspace) {
    await pullWatch(workspace, held)
    held = cloudBoardFor(KANBAN)
  }
  let releases: string[] = []
  try {
    releases = await board().readReleases()
  } catch {
    // A board we cannot read this second offers no releases; the section says so.
  }
  return {
    // On a Cloud checkout the record is kept while the switch is off, because it is the mirror
    // of an answer that lives in the workspace — so the switch is what it says, not whether
    // the record is there.
    enabled: !!held && !held.watchOff,
    release: held?.release ?? '',
    releases,
    signedIn: !!readSession(),
    server: await readBoardServer(),
    shared: !!workspace,
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
  if (!cloudBoardFor(KANBAN)) return { ok: false, error: 'Notifications are off for this board.' }
  return on ? attachBoardServer(takeOver) : detachBoardServer()
}

/** Every release, or one that is open — the only two answers either move accepts. */
async function watchable(release: string): Promise<boolean> {
  if (release === ALL_RELEASES) return true
  return !!release && (await board().readReleases()).includes(release)
}

const NOT_WATCHABLE = 'Watch every release, or one of this board’s open ones.'

/** Turn them on, watching every release or one open one. The bell fills with whatever this
 *  board is already holding actionable, and nothing is raised for any of it. */
export async function enableBoardNotifications(release: string): Promise<WriteResult> {
  if (!readSession()) return { ok: false, error: 'Sign in to Cloud first.' }
  if (!(await watchable(release))) return { ok: false, error: NOT_WATCHABLE }
  enableCloudBoard(KANBAN, REPO_ROOT, release, true)
  const workspace = workspaceHere()
  if (workspace) {
    const written = await pushWatch(workspace, true, release)
    if (!written.ok) return written
  }
  await startPublishing()
  return { ok: true }
}

/** Watch something else — a narrower release, or every one. What the rail asks for when the
 *  release being watched closed.
 *
 *  Whatever the wider scope brings in was already waiting, so none of it is raised (#451). */
export async function watchRelease(release: string): Promise<WriteResult> {
  const held = cloudBoardFor(KANBAN)
  if (!held || held.watchOff) return { ok: false, error: 'Notifications are off for this board.' }
  if (!(await watchable(release))) return { ok: false, error: NOT_WATCHABLE }
  const workspace = workspaceHere()
  if (workspace) {
    const written = await pushWatch(workspace, true, release)
    if (!written.ok) return written
  } else {
    setCloudBoardRelease(KANBAN, release)
  }
  await publishBoardEvents({ reconcile: true, broughtIn: true })
  return { ok: true }
}

/**
 * Be told about this SHARED board, or not (#328).
 *
 * A Local board has no such switch and never had: signed in means on, and the record's
 * existence is the whole of it (#319). A workspace member has one, because their teammates go
 * on being told either way — so going quiet is theirs to choose and theirs alone.
 *
 * Turning them back on fills the bell with whatever the board is already holding and raises
 * none of it (#451): all of that was waiting before the switch moved.
 */
export async function setBoardNotify(on: boolean): Promise<WriteResult> {
  const held = cloudBoardFor(KANBAN)
  if (!held) return { ok: false, error: 'Notifications are off for this board.' }
  const workspace = workspaceHere()
  if (!workspace) return { ok: false, error: 'Only a board in a workspace carries that switch.' }
  const written = await pushWatch(workspace, on, held.release)
  if (!written.ok) return written
  if (on) await publishBoardEvents({ reconcile: true, broughtIn: true })
  return { ok: true }
}

/** Turn them off. This board's live events are retired first — a board with notifications
 *  off must not leave a row in the bell asking about it. */
export async function disableBoardNotifications(): Promise<WriteResult> {
  const held = cloudBoardFor(KANBAN)
  if (!held) return { ok: true }
  const workspace = workspaceHere()
  // A workspace card's decision belongs to the team, so one member going quiet must not retire
  // it out from under the others. Their switch is turned off and the rest of the audience goes
  // on being told.
  if (!workspace) await retireBoardEvents()
  // A board that raises no events has no approvals to run either, so this machine stops
  // being its server (#318). Whatever is already building here finishes where it is.
  await detachBoardServer()
  if (workspace) return pushWatch(workspace, false, held.release)
  disableCloudBoard(KANBAN)
  return { ok: true }
}
