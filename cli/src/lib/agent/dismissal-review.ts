// What the rejection review has to read (#929, #1497). Decided here, without a model: a
// review with nothing on any list is never started.
//
//   • new rejections — the user's own, with a reason, rejected since the window opened
//   • new dismissals — the user's own, with a reason, dismissed since the window opened
//   • withdrawn ids — cited in `rejected.md` but restored since: back in `triage/`, or made
//     into a card from there. An id found nowhere is left alone — a parenthesis in a line
//     the user wrote is not evidence of anything.

import fs from 'node:fs'

import { parseStamp } from '../cadence'
import { walkMd } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { PLANNER, agentMemoryFile, plannerCopies } from '../memory'
import { ARCHIVE, rel } from '../paths'
import { readAllDismissed, readArchived, readInbox } from '../signals/inbox'
import { archivedId } from '../view/archive'

/** One rejected card the review has to read. */
export interface RejectionToReview {
  id: number
  title: string
  /** The archived card's file, repo-relative. */
  file: string
  reason: string
  rejectedAt: string
}

/** One dismissal the review has to read. */
export interface DismissalToReview {
  sourceId: string
  title: string
  /** The item's file, repo-relative. */
  file: string
  reason: string
  dismissedAt: string
}

/** The planner's file the review writes. */
export const rejectedMemoryFile = (): string => agentMemoryFile(PLANNER, 'rejected.md')

/** The user's rejections with a reason, rejected at or after `since` (a millisecond time;
 *  `0` takes them all). A discard and an agent's rejection are never learned from. */
export function rejectionsToReview(since: number): RejectionToReview[] {
  if (!fs.existsSync(ARCHIVE)) return []
  const found: RejectionToReview[] = []
  for (const file of walkMd(ARCHIVE)) {
    const id = archivedId(file)
    if (id === null) continue
    try {
      const { meta } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
      if (!meta?.rejected || meta.rejected_by !== 'user' || !meta.rejected_reason.trim()) continue
      if ((parseStamp(meta.rejected_at)?.getTime() ?? 0) < since) continue
      found.push({ id, title: meta.title, file: rel(file), reason: meta.rejected_reason.trim(), rejectedAt: meta.rejected_at })
    } catch {
      continue
    }
  }
  return found.sort((a, b) => a.rejectedAt.localeCompare(b.rejectedAt) || a.id - b.id)
}

/** The user's dismissals with a reason, dismissed at or after `since` (a millisecond time;
 *  `0` takes them all). */
export function dismissalsToReview(since: number): DismissalToReview[] {
  return readAllDismissed()
    .filter((s) => s.dismissedBy === 'user' && s.dismissedReason.trim())
    .filter((s) => (parseStamp(s.dismissedAt)?.getTime() ?? 0) >= since)
    .sort((a, b) => a.dismissedAt.localeCompare(b.dismissedAt))
    .map((s) => ({
      sourceId: s.sourceId,
      title: s.title,
      file: s.relPath,
      reason: s.dismissedReason.trim(),
      dismissedAt: s.dismissedAt,
    }))
}

// A line's sources are its trailing parenthesis: `- **x**: why (#12, id-1)`.
const SOURCES = /\(([^()]+)\)\s*$/

/** Every source `rejected.md` cites — a card `#id` or an item's source id. */
export function citedSources(text: string): string[] {
  const ids = new Set<string>()
  for (const line of text.split('\n')) {
    if (!/^\s*[-*]\s/.test(line)) continue
    const m = line.match(SOURCES)
    for (const id of m?.[1]!.split(',') ?? []) if (id.trim()) ids.add(id.trim())
  }
  return [...ids]
}

/** The item ids the `rejected.md` files cite whose items have since been restored. */
export function withdrawnSources(): string[] {
  const cited = [...new Set(plannerCopies('rejected.md').flatMap((file) => {
    try {
      return citedSources(fs.readFileSync(file, 'utf8'))
    } catch {
      return []
    }
  }))]
  if (cited.length === 0) return []
  const dismissed = new Set(readAllDismissed().map((s) => s.sourceId))
  const restored = new Set([...readInbox(), ...readArchived()].map((s) => s.sourceId))
  return cited.filter((id) => restored.has(id) && !dismissed.has(id))
}

/** Whether a review would have anything to do. */
export function rejectionWorkWaiting(since: number): boolean {
  return rejectionsToReview(since).length > 0 || dismissalsToReview(since).length > 0 || withdrawnSources().length > 0
}

/** The memory file, repo-relative, as the flow names it. */
export const rejectedMemoryPath = (): string => rel(rejectedMemoryFile())
