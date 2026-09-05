// How a delivery commits, and everything that follows from it (#303, #346).
//
// With a worktree of its own a delivery builds on a branch of its own, several run at once,
// and the board commits each session's work so review reads a settled tree. Without one it
// takes MANUAL COMMIT MODE: it works in the user's own checkout, one delivery at a time, and
// the user commits after review has passed.
//
// The Implement dialog's tick picks the side, one build at a time (#346). **Allow automatic
// Git commits** is the repository-level default the tick starts from and what a request that
// says nothing falls back to. Where no worktree is possible at all — no git, no commit to
// fork from, or a detached HEAD — manual mode is the only answer and there is nothing to ask.
//
// The mode is decided once, as the delivery starts, and written onto it. Flipping the
// setting changes the next delivery and never one already in flight.
//
// This file decides and prepares; it writes no delivery record. `deliveries.ts` is what
// puts the answer on one.

import fs from 'node:fs'
import path from 'node:path'

import {
  AKB_DIR,
  DELIVERIES,
  ensureAkbDir,
  rel,
  REPO_ROOT,
  ROOT_GITIGNORE,
  writeRootIgnoreIfMissing,
} from '../paths'
import { candidateOf, candidateDiff, candidateMark } from './candidate'
import { aiReviewEnabled, autoCommitAllowed, diffApprovalRequired } from './settings'
import { readStore } from './store'
import type { DeliveryPlan } from '../view/types'
import type { DeliveryCommitMode, DeliveryRecord } from './types'
import {
  addWorktree,
  commitWork,
  currentBranch,
  dirtyPaths,
  headCommit,
  inGitRepo,
  removeWorktree,
  treeMark,
  worktreeDir,
} from './worktree'

// A delivery id is read inside a branch name and typed into `akb delivery cancel`, so it is short
// and unambiguous: eight characters from an alphabet with no look-alike pairs.
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const ID_LENGTH = 8

// How many changed files a refusal names before it stops counting. The point is to say
// which work is in the way, not to print `git status`.
const MAX_NAMED = 5

/** Every delivery id the permanent record already holds, so a new one can't collide with a
 *  delivery that ended months ago. */
function recordedIds(): Set<string> {
  try {
    return new Set(
      fs
        .readdirSync(DELIVERIES)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -'.json'.length)),
    )
  } catch {
    return new Set()
  }
}

/** A delivery id nothing else answers to — drawn at random and checked against both
 *  records, the live rows and the files, since a delivery leaves the first long before it
 *  leaves the second. */
export function newDeliveryId(live: DeliveryRecord[] = readStore().deliveries): string {
  const taken = recordedIds()
  for (const d of live) taken.add(d.deliveryId)
  for (;;) {
    let id = ''
    for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
    if (!taken.has(id)) return id
  }
}

// ---- getting a delivery ready to start --------------------------------------

/** Everything settled before a delivery's first session is written down: which mode it
 *  runs in, where it forks from, where it lands, and the checkout it works in. */
export interface DeliveryStart {
  deliveryId: string
  commitMode: DeliveryCommitMode
  base?: string
  targetBranch?: string
  worktree?: string
  branch?: string
  /** Why it is in manual mode when nothing could have chosen otherwise — no git, no commit
   *  to fork from, or a detached HEAD. Absent when the setting or the dialog's tick chose it. */
  manualWhy?: string
  /** Whether this delivery has to be approved before it lands (#308), read from the setting
   *  here and never again. Only ever true in auto commit mode: in manual mode the board
   *  never commits, so the user's own commit is the approval. */
  needsApproval?: boolean
  /** Whether a fresh session reviews what this delivery builds (#416), read from the
   *  setting or the dialog's tick here and never again. */
  aiReview: boolean
}

/** The checkout a delivery's sessions work in. */
export const deliveryCwd = (delivery: { worktree?: string }): string =>
  delivery.worktree ? worktreeDir(delivery.worktree) : REPO_ROOT

const names = (files: string[]): string =>
  `${files.slice(0, MAX_NAMED).join(', ')}${files.length > MAX_NAMED ? `, and ${files.length - MAX_NAMED} more` : ''}`

/** Why this checkout can give a delivery no worktree of its own, or nothing when it can.
 *  The dialog says it before the click and `prepareDelivery` acts on it after, so what the
 *  sentence promises and what the click does can never disagree (#346). */
function noWorktreeWhy(): string | undefined {
  if (!inGitRepo()) return 'this project is not a git repository, so there is no branch to build on'
  if (!headCommit()) return 'this repository has no commit yet, so there is nothing to fork a branch from'
  if (!currentBranch()) return 'this checkout is on a detached HEAD, so a build has nowhere to land'
  return undefined
}

/** What an Implement click would do right now, without doing any of it (#307): both sides of
 *  the dialog's tick at once (#346) — the branch a build with its own worktree would land on
 *  and whether it would wait for approval, and why one without has nothing to land. Read,
 *  never written. */
export function deliveryPlan(): DeliveryPlan {
  const manualWhy = noWorktreeWhy()
  const aiReview = aiReviewEnabled()
  if (manualWhy) return { commitMode: 'manual', manualWhy, canChooseWorktree: false, aiReview }
  return {
    commitMode: autoCommitAllowed() ? 'auto' : 'manual',
    branch: currentBranch() ?? undefined,
    needsApproval: diffApprovalRequired(),
    canChooseWorktree: true,
    aiReview,
  }
}

/** Get a delivery ready to start on this card: decide the mode, refuse what can't start,
 *  and make its worktree.
 *
 *  `wants` and `wantsReview` are the Implement dialog's two ticks — this one build's
 *  answers (#346, #416). A request that says nothing falls back to **Automatic Git commits**
 *  and **AI review**, which is every other way in: a terminal `akb card implement`, a queued
 *  build, a resolve that carries on.
 *
 *  Called before the record is written and before anything spawns, so a refusal costs
 *  nothing and a delivery is never written down half-made. Whatever it made is undone by
 *  `undoPrepared` when the run is refused after it. */
export function prepareDelivery(
  cardId: number,
  wants?: DeliveryCommitMode,
  wantsReview?: boolean,
): { start: DeliveryStart } | { error: string } {
  const deliveryId = newDeliveryId()
  // The other tick (#416), settled here for the same reason and read from the record
  // afterwards — so a resume follows the policy this build started with.
  const aiReview = wantsReview ?? aiReviewEnabled()
  const base = inGitRepo() ? headCommit() : null
  // No git, no commit to branch from, or a detached HEAD: there is nothing to fork, so the
  // delivery works where it is however it was asked for. A board in an unversioned folder
  // delivers today, and this must not take that away.
  const manualWhy = noWorktreeWhy()
  const wanted: DeliveryCommitMode = manualWhy ? 'manual' : (wants ?? (autoCommitAllowed() ? 'auto' : 'manual'))

  if (wanted === 'manual') {
    const refusal = manualRefusal(cardId, !!base)
    if (refusal) return { error: refusal }
    return {
      start: { deliveryId, commitMode: 'manual', base: base ?? undefined, manualWhy, needsApproval: false, aiReview },
    }
  }

  // `noWorktreeWhy` cleared all three, so the branch and the base are both there.
  const targetBranch = currentBranch() as string
  const dirty = dirtyPaths(false)
  if (dirty.length) {
    return {
      error:
        `you have uncommitted changes in ${names(dirty)}. A delivery forks from your last commit and never copies ` +
        `work you have not committed, so commit or stash these first.`,
    }
  }
  // `.akb/` is where the worktrees go, and it must be ignored before the first one lands.
  // Boards set up before that line existed get it here.
  try {
    writeRootIgnoreIfMissing()
    ensureAkbDir()
  } catch {
    return { error: `couldn't prepare ${rel(AKB_DIR)} — check that ${rel(ROOT_GITIGNORE)} and the project folder are writable.` }
  }
  const made = addWorktree(cardId, deliveryId, base!)
  if (!made.ok) return { error: made.error }
  return {
    start: {
      deliveryId,
      commitMode: 'auto',
      base: base!,
      targetBranch,
      worktree: made.worktree,
      branch: made.branch,
      needsApproval: diffApprovalRequired(),
      aiReview,
    },
  }
}

// Why a manual delivery can't start right now — one at a time, from clean code — or
// nothing when it may. It names the mode, never the setting: the dialog's tick reaches
// manual mode too, and a refusal blaming a switch the user never touched would be a lie.
function manualRefusal(cardId: number, hasBase: boolean): string | undefined {
  const held = readStore().deliveries.find(
    (d) => d.status === 'active' && d.commitMode !== 'auto' && d.cardId !== cardId,
  )
  if (held) {
    return (
      `delivery ${held.deliveryId} is already working in this checkout on #${held.cardId} — a build without a branch ` +
      `of its own works in your project folder, and only one does at a time. Finish or cancel that one first.`
    )
  }
  if (!hasBase) return undefined
  // Untracked files count here, unlike a delivery bound for a worktree: this one works in
  // the very checkout review reads, so a file already sitting there would be read as the
  // delivery's own work.
  const dirty = dirtyPaths(true)
  if (dirty.length) {
    return (
      `you have uncommitted changes in ${names(dirty)}. A build without a branch of its own works in this checkout, ` +
      `so review can only tell its work from yours if you start from a clean tree — commit or stash these first.`
    )
  }
  return undefined
}

/** Undo what `prepareDelivery` made, when the run it was for was refused after all. */
export function undoPrepared(start: DeliveryStart): void {
  if (start.worktree) removeWorktree(start.worktree, start.branch, true)
}

// ---- committing a session's work --------------------------------------------

/** Commit whatever this delivery's session left behind, so its branch IS the candidate.
 *
 *  Nothing to do in manual commit mode: there the commit is the user's, which is the whole
 *  of what the mode means. Returns the reason when the work could not be committed — a
 *  change that reached the board's own files, or a git that refused — and the caller stops
 *  the delivery on it rather than reviewing a tree nobody settled. */
export function commitDeliveryWork(delivery: DeliveryRecord): { ok: true } | { ok: false; why: string } {
  if (!delivery.worktree) return { ok: true }
  const dir = worktreeDir(delivery.worktree)
  if (!fs.existsSync(dir)) {
    return { ok: false, why: `its worktree ${delivery.worktree} is gone, so there is nothing to review` }
  }
  const message = `${delivery.title || `card #${delivery.cardId}`} (#${delivery.cardId})\n\ndelivery ${delivery.deliveryId}`
  const done = commitWork(delivery.worktree, message)
  if (!done.ok) return { ok: false, why: done.error }
  return { ok: true }
}

// ---- manual commit mode: waiting for the user's commit ----------------------

/** Where a passed manual review's diff is kept — beside the worktrees, never in git: it is
 *  a copy of code the repository is about to hold anyway. */
const reviewedDiffPath = (deliveryId: string): string =>
  path.join(AKB_DIR, 'reviewed', `${deliveryId}.diff`)

/** Take the snapshot a passed manual review is remembered by: the fingerprint of the code
 *  as it stands, and the diff itself written beside it. The fingerprint is taken from the
 *  working TREE, so committing it does not change the answer — which is exactly how "you
 *  committed what review passed" is told from "you committed something else". */
export function snapshotReviewed(delivery: DeliveryRecord): DeliveryRecord['reviewed'] {
  if (!delivery.base) return undefined
  const mark = treeMark(delivery.base)
  if (!mark) return undefined
  let where: string | undefined
  const diff = candidateDiff(candidateOf(delivery))
  if (diff) {
    try {
      fs.mkdirSync(path.dirname(reviewedDiffPath(delivery.deliveryId)), { recursive: true })
      fs.writeFileSync(reviewedDiffPath(delivery.deliveryId), diff)
      where = rel(reviewedDiffPath(delivery.deliveryId))
    } catch {
      // an unwritable folder — the fingerprint is what the match is made on
    }
  }
  return { mark, diff: where, at: Date.now() }
}

/** What the user has done with a manual delivery that review passed and that is waiting on
 *  their commit.
 *
 *  `waiting` — the code is still sitting uncommitted in their checkout.
 *  `landed`  — they committed exactly what review passed; the delivery is done.
 *  `changed` — they committed something else, so it goes back through review. */
export function manualState(delivery: DeliveryRecord): 'waiting' | 'landed' | 'changed' {
  if (!delivery.base || !delivery.reviewed) return 'waiting'
  // Still uncommitted work outside the board's own files: they have not finished.
  if (dirtyPaths(true).length) return 'waiting'
  return treeMark(delivery.base) === delivery.reviewed.mark ? 'landed' : 'changed'
}

/** The delivery's current code fingerprint, used by diff approval. */
export const workMark = (delivery: DeliveryRecord): string | undefined =>
  candidateMark(candidateOf(delivery)) ?? undefined
