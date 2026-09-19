// Triage, as everything outside it asks for it (#453, #499, #559).
//
// The local UI draws a rail row and a page from these, and `akb triage fetch` writes
// through the same modules. Whether triage is open at all is ./access.ts, asked apart
// from the read because it reaches Cloud and a page read does not.

import fs from 'node:fs'
import path from 'node:path'

import { idPrefix, walkMd } from '../cards'
import { ARCHIVE, TODO } from '../paths'
import { unquote } from '../yaml'
import { signalConfigGaps } from './config'
import {
  DISMISSED_DAYS,
  dismissInboxItem,
  latestImport,
  readDismissed,
  readInbox,
  readRecentArchived,
  restoreInboxItem,
  triagePath,
} from './inbox'
import { migrateTriage } from './migrate'
import { sourceTypeKeys } from './sources'
import type { Signal, SignalCardRef, SignalInbox } from '../view/types'

export { addToInbox } from './add'
export { signalsAccess, type SignalsAccess } from './access'
export { fetchSignals, type FetchReport, type SignalFailure } from './fetch'
export { ENDPOINT_SETTING, TOKEN_KEY, sayGap, signalConfigGaps } from './config'
export { checkSource, triageIndex, type TriageCheck, type TriageStatus } from './check'
export { reconcileTriage, type CardedItem } from './carded'
export { archiveInboxItem, dismissInboxItem, readInbox, restoreInboxItem, type ArchiveOutcome } from './inbox'
export { migrateTriage } from './migrate'
export { SOURCE_TYPES, matchSourceType, sourceTypeKeys, type SourceType } from './sources'

/** The card an item names as its source — `meta.source: "#706"` — or null. */
export function sourceCard(signal: Signal): number | null {
  const said = signal.meta.find((pair) => pair.key === 'source')?.value.trim() ?? ''
  const m = said.match(/^#(\d+)$/)
  return m ? Number(m[1]) : null
}

// The titles of the named cards, open or archived: one walk of each folder, however many
// items name them.
function cardRefs(ids: Set<number>): Record<number, SignalCardRef> {
  const out: Record<number, SignalCardRef> = {}
  if (ids.size === 0) return out
  for (const [dir, archived] of [
    [TODO, false],
    [ARCHIVE, true],
  ] as const) {
    let files: string[]
    try {
      files = walkMd(dir)
    } catch {
      continue
    }
    for (const file of files) {
      const id = idPrefix(path.basename(file)) ?? idPrefix(path.basename(path.dirname(file)))
      if (id === null || !ids.has(id) || out[id]) continue
      let text = ''
      try {
        text = fs.readFileSync(file, 'utf8')
      } catch {
        continue
      }
      const title = text.match(/^title:\s*(.*)$/m)?.[1]
      if (title !== undefined) out[id] = { title: unquote(title.trim()), archived }
    }
  }
  return out
}

/** What triage holds — what is waiting, what was judged recently, and what is still to be
 *  filled in before it can hold more. Read on every call rather than held: a fetch adds
 *  files behind the page's back. */
export function readSignals(): SignalInbox {
  migrateTriage()
  const signals = readInbox()
  const dismissed = readDismissed()
  const archived = readRecentArchived()
  const ids = new Set<number>()
  for (const signal of [...signals, ...dismissed, ...archived]) {
    const named = sourceCard(signal)
    if (named !== null) ids.add(named)
    if (signal.cardId !== null) ids.add(signal.cardId)
  }
  return {
    relPath: triagePath(),
    signals,
    dismissed,
    archived,
    dismissedDays: DISMISSED_DAYS,
    cards: cardRefs(ids),
    sourceTypes: sourceTypeKeys(),
    latestImport: latestImport(signals),
    missing: signalConfigGaps(),
  }
}

/** Ignore one item from the page, with the user's reason: its file moves into
 *  `triage/dismissed/`, so no later fetch brings it back. */
export function dismissSignal(sourceId: string, reason: string): { ok: boolean; error?: string } {
  if (!sourceId) return { ok: false, error: 'nothing named' }
  if (!reason?.trim()) return { ok: false, error: 'no reason given' }
  migrateTriage()
  const done = dismissInboxItem(sourceId, 'user', reason)
  return done.ok ? { ok: true } : { ok: false, error: done.error }
}

/** Put one ignored item back in the list. Starts no sort. */
export function restoreSignal(sourceId: string): { ok: boolean; error?: string } {
  if (!sourceId) return { ok: false, error: 'nothing named' }
  migrateTriage()
  const done = restoreInboxItem(sourceId)
  return done.ok ? { ok: true } : { ok: false, error: done.error }
}
