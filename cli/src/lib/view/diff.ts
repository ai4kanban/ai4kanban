// ---- what a delivery changed, as the card page reads it (#305) --------------
//
// One read, two sources, because a delivery's code moves once in its life. While it builds
// it is `git diff <base>..<branch>` in its own worktree — the candidate, exactly as review
// reads it (`agent/candidate.ts`). Once it lands, the worktree and the branch are gone and
// the squash commit is the only thing left, so the diff is `git diff <onto>..<commit>` read
// in the project. Nothing here recomputes a base: landing repoints it on every rebase
// (#304), so the record is right either way.
//
// A diff can be megabytes and the page cannot hold one, so it is capped here rather than in
// the browser, and what is cut off is said in words. A case this cannot show — no git, a
// worktree someone removed, a commit that is no longer there — is one plain line, never an
// error: this view is for investigating a result, and a blank frame investigates nothing.

import { candidateOf, candidatePatch, candidateStat } from '../agent/candidate'
import { findDelivery } from '../agent/deliveries'
import type { DeliveryRecord } from '../agent/types'
import { git, outsideBoard, worktreeExists } from '../agent/worktree'
import { REPO_ROOT } from '../paths'
import type { DeliveryDiff } from './types'

/** How much diff the card page is given. Past this it is cut at a line and the rest is a
 *  command to run — a page holding a megabyte of `<pre>` helps nobody. */
const MAX_DIFF = 120_000

/**
 * What one delivery changed, or null when there is no tab to show.
 *
 * Null means exactly that — no delivery by that id, or one that landed having committed
 * nothing. Everything else answers, with `note` carrying the plain line when the diff
 * itself could not be read.
 */
export function deliveryDiff(deliveryId: string): DeliveryDiff | null {
  const delivery = findDelivery(deliveryId)
  if (!delivery) return null
  const landed = delivery.landing?.status === 'landed' ? delivery.landing : undefined
  if (!landed) return buildingDiff(delivery)
  if (!landed.commit || !landed.onto) return null
  return landedDiff(deliveryId, landed.onto, landed.commit)
}

// The audit diff: the commit that landed, against the tip it landed onto. Read in the
// project, the only checkout either of them is still in.
function landedDiff(id: string, onto: string, commit: string): DeliveryDiff {
  const range = `${onto}..${commit}`
  const command = `git diff ${short(onto)}..${short(commit)}`
  const diff = git(['diff', range, ...outsideBoard()], REPO_ROOT)
  if (diff === null) return note(id, `${command} can no longer be read here — the commit or the tip it landed on is gone`)
  const stat = git(['diff', '--shortstat', range, ...outsideBoard()], REPO_ROOT)?.trim() || 'nothing changed'
  return { id, stat, ...cut(diff, command) }
}

// The candidate, while the delivery still has one: its branch against its base, or — in
// manual commit mode — the working tree against it, with the files git has never seen
// counted in and the whole snapshot labelled uncommitted.
function buildingDiff(delivery: DeliveryRecord): DeliveryDiff {
  const id = delivery.deliveryId
  if (delivery.worktree && !worktreeExists(delivery.worktree)) {
    return note(id, 'its worktree is gone, so there is nothing left to diff')
  }
  const candidate = candidateOf(delivery)
  if (!candidate.base) return note(id, 'it forked from no commit — this board is not in a git repository')
  const diff = candidatePatch(candidate)
  if (diff === null) return note(id, `git could not diff this delivery against ${short(candidate.base)}`)
  const where = delivery.worktree ? `git -C ${delivery.worktree} diff` : 'git diff'
  const command = candidate.branch ? `${where} ${short(candidate.base)}..${delivery.branch}` : `${where} ${short(candidate.base)}`
  return {
    id,
    stat: candidateStat(candidate) ?? '',
    ...cut(diff, command),
    ...(candidate.branch ? {} : { uncommitted: true }),
  }
}

const short = (commit: string): string => commit.slice(0, 7)

const note = (id: string, why: string): DeliveryDiff => ({ id, stat: '', diff: '', note: why })

// Cut a long diff at a line boundary, and say where the whole of it is: the command that
// prints it, since someone reading this came to investigate.
function cut(diff: string, command: string): { diff: string; truncated?: boolean; whole?: string } {
  if (diff.length <= MAX_DIFF) return { diff }
  const head = diff.slice(0, MAX_DIFF)
  const end = head.lastIndexOf('\n')
  return { diff: end > 0 ? head.slice(0, end + 1) : head, truncated: true, whole: command }
}
