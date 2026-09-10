// Triage, as everything outside it asks for it (#453, #499, #559).
//
// The local UI draws a rail row and a page from these, and `akb triage fetch` writes
// through the same modules. Whether triage is open at all is ./access.ts, asked apart
// from the read because it reaches Cloud and a page read does not.

import { signalConfigGaps } from './config'
import { DISMISSED_DAYS, dismissInboxItem, latestImport, readDismissed, readInbox, triagePath } from './inbox'
import { migrateTriage } from './migrate'
import { sourceTypeKeys } from './sources'
import type { SignalInbox } from '../view/types'

export { addToInbox } from './add'
export { signalsAccess, type SignalsAccess } from './access'
export { fetchSignals, type FetchReport, type SignalFailure } from './fetch'
export { ENDPOINT_SETTING, TOKEN_KEY, sayGap, signalConfigGaps } from './config'
export { checkSource, triageIndex, type TriageCheck, type TriageStatus } from './check'
export { archiveInboxItem } from './inbox'
export { migrateTriage } from './migrate'
export { SOURCE_TYPES, matchSourceType, sourceTypeKeys, type SourceType } from './sources'

/** What triage holds — what is waiting, what was ignored recently, and what is still to be
 *  filled in before it can hold more. Read on every call rather than held: a fetch adds
 *  files behind the page's back. */
export function readSignals(): SignalInbox {
  migrateTriage()
  const signals = readInbox()
  return {
    relPath: triagePath(),
    signals,
    dismissed: readDismissed(),
    dismissedDays: DISMISSED_DAYS,
    sourceTypes: sourceTypeKeys(),
    latestImport: latestImport(signals),
    missing: signalConfigGaps(),
  }
}

/** Ignore one item: its file moves into `triage/dismissed/` and is kept there, so no later
 *  fetch brings it back. Pressed on the page, so the judge is the user and there is no
 *  reason to record — the page never asks for one. */
export function dismissSignal(sourceId: string): { ok: boolean; error?: string } {
  if (!sourceId) return { ok: false, error: 'nothing named' }
  migrateTriage()
  const done = dismissInboxItem(sourceId, 'user')
  return done.ok ? { ok: true } : { ok: false, error: done.error }
}
