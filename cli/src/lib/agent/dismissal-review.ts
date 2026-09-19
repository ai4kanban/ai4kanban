// What the dismissal review has to read (#929). Decided here, without a model: a review
// with nothing on either list is never started.
//
//   • new dismissals — the user's own, with a reason, dismissed since the window opened
//   • withdrawn ids — cited in `dismissed.md` but restored since: back in `triage/`, or made
//     into a card from there. An id found nowhere is left alone — a parenthesis in a line
//     the user wrote is not evidence of anything.

import fs from 'node:fs'

import { parseStamp } from '../cadence'
import { PLANNER, agentMemoryFile } from '../memory'
import { rel } from '../paths'
import { readAllDismissed, readArchived, readInbox } from '../signals/inbox'

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
export const dismissedMemoryFile = (): string => agentMemoryFile(PLANNER, 'dismissed.md')

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

// A line's sources are its trailing parenthesis: `- **x**: why (id-1, id-2)`.
const SOURCES = /\(([^()]+)\)\s*$/

/** Every source id `dismissed.md` cites. */
export function citedSources(text: string): string[] {
  const ids = new Set<string>()
  for (const line of text.split('\n')) {
    if (!/^\s*[-*]\s/.test(line)) continue
    const m = line.match(SOURCES)
    for (const id of m?.[1]!.split(',') ?? []) if (id.trim()) ids.add(id.trim())
  }
  return [...ids]
}

/** The ids `dismissed.md` cites whose items have since been restored. */
export function withdrawnSources(): string[] {
  let text: string
  try {
    text = fs.readFileSync(dismissedMemoryFile(), 'utf8')
  } catch {
    return []
  }
  const cited = citedSources(text)
  if (cited.length === 0) return []
  const dismissed = new Set(readAllDismissed().map((s) => s.sourceId))
  const restored = new Set([...readInbox(), ...readArchived()].map((s) => s.sourceId))
  return cited.filter((id) => restored.has(id) && !dismissed.has(id))
}

/** Whether a review would have anything to do. */
export function dismissalWorkWaiting(since: number): boolean {
  return dismissalsToReview(since).length > 0 || withdrawnSources().length > 0
}

/** The memory file, repo-relative, as the flow names it. */
export const dismissedMemoryPath = (): string => rel(dismissedMemoryFile())
