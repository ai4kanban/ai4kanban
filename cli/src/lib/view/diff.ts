// ---- what a delivery changed, as the card page reads it (#305) --------------
//
// One read, two sources, because a delivery's code moves once in its life. While it builds
// it is its worktree's working tree against the base (#1537) — the board commits only when
// a run ends, so the branch alone shows nothing mid-run. Review still reads the committed
// branch (`agent/candidate.ts`). Once it lands, the worktree and the branch are gone and
// the squash commit is the only thing left, so the diff is `git diff <onto>..<commit>` read
// in the project. Nothing here recomputes a base: landing repoints it on every rebase
// (#304), so the record is right either way.
//
// A diff can be megabytes and the page cannot hold one, so it is capped here rather than in
// the browser, and what is cut off is said in words. A case this cannot show — no git, a
// worktree someone removed, a commit that is no longer there — is one plain line, never an
// error: this view is for investigating a result, and a blank frame investigates nothing.

import { type Candidate, candidateOf, candidatePatch, candidateStat, untrackedFiles } from '../agent/candidate'
import { findDelivery } from '../agent/deliveries'
import type { DeliveryRecord } from '../agent/types'
import { git, gitDiff, outsideBoard, worktreeExists } from '../agent/worktree'
import { REPO_ROOT } from '../paths'
import type { DeliveryDiff } from './types'

/** How much diff the card page is given. Past this it is cut at a line and the rest is a
 *  command to run — a page holding a megabyte of `<pre>` helps nobody. */
const MAX_DIFF = 120_000

/**
 * What one delivery changed, or null when there is no tab to show.
 *
 * Null means exactly that — no delivery by that id, one that landed having committed
 * nothing, or one that makes files. Everything else answers, with `note` carrying the plain line when the diff
 * itself could not be read.
 */
export function deliveryDiff(deliveryId: string): DeliveryDiff | null {
  const delivery = findDelivery(deliveryId)
  // A `files` delivery commits nothing (#874): its output is the files the card records.
  if (!delivery || delivery.commitMode === 'files') return null
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
  const stat = git(['diff', '--shortstat', range, ...outsideBoard()], REPO_ROOT)?.trim() ?? ''
  return { id, stat, ...cut(diff, command) }
}

// While the delivery still has one: the working tree against its base, files git has never
// seen counted in. In manual commit mode that tree is the user's checkout, so the whole
// snapshot is labelled uncommitted; in a worktree the board commits it at the end of the run.
function buildingDiff(delivery: DeliveryRecord): DeliveryDiff {
  const id = delivery.deliveryId
  if (delivery.worktree && !worktreeExists(delivery.worktree)) {
    return note(id, 'its worktree is gone, so there is nothing left to diff')
  }
  const { base, cwd } = candidateOf(delivery)
  if (!base) return note(id, 'it forked from no commit — this board is not in a git repository')
  const tree: Candidate = { base, cwd }
  const diff = candidatePatch(tree)
  if (diff === null) return note(id, `git could not diff this delivery against ${short(base)}`)
  if (!delivery.worktree) {
    return { id, stat: candidateStat(tree) ?? '', ...cut(diff, `git diff ${short(base)}`), uncommitted: true }
  }
  return { id, stat: treeStat(tree), ...cut(diff, `git -C ${delivery.worktree} diff ${short(base)}`) }
}

// git's own shortstat for the working tree, a new file counting like any other.
function treeStat(tree: Candidate): string {
  const lines = [
    git(['diff', '--numstat', tree.base!, ...outsideBoard()], tree.cwd) ?? '',
    ...untrackedFiles(tree).map((file) => gitDiff(['diff', '--no-index', '--numstat', '--', '/dev/null', file], tree.cwd) ?? ''),
  ]
    .join('\n')
    .split('\n')
    .filter(Boolean)
  if (!lines.length) return ''
  let added = 0
  let removed = 0
  for (const line of lines) {
    const [a, r] = line.split('\t')
    added += Number(a) || 0
    removed += Number(r) || 0
  }
  const n = lines.length
  return [
    `${n} file${n === 1 ? '' : 's'} changed`,
    ...(added ? [`${added} insertion${added === 1 ? '' : 's'}(+)`] : []),
    ...(removed ? [`${removed} deletion${removed === 1 ? '' : 's'}(-)`] : []),
  ].join(', ')
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
