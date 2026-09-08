// The inbox, as everything outside it asks for it (#453, #499).
//
// The local UI draws a rail row and a page from these, and `akb signals fetch` writes
// through the same modules. Whether the inbox is open at all is ./access.ts, asked apart
// from the read because it reaches Cloud and a page read does not.

import { signalConfigGaps } from './config'
import { dropSignal, inboxPath, latestImport, readInbox } from './inbox'
import type { SignalInbox } from '../view/types'

export { addToInbox } from './add'
export { signalsAccess, type SignalsAccess } from './access'
export { fetchSignals, type FetchReport, type SignalFailure } from './fetch'
export { ENDPOINT_SETTING, TOKEN_KEY, sayGap, signalConfigGaps } from './config'
export { markHandled, readHandled } from './inbox'

/** What the inbox holds, and what is still to be filled in before it can hold more. Read on
 *  every call rather than held: a fetch adds files behind the page's back. */
export function readSignals(): SignalInbox {
  const signals = readInbox()
  return {
    relPath: inboxPath(),
    signals,
    latestImport: latestImport(signals),
    missing: signalConfigGaps(),
  }
}

/** Ignore one item: its file goes and its source id is written down, so no later fetch
 *  brings it back. There is no way back — that is what the page says before it is used. */
export function dismissSignal(sourceId: string): { ok: boolean; error?: string } {
  if (!sourceId) return { ok: false, error: 'nothing named' }
  return dropSignal(sourceId) ? { ok: true } : { ok: false, error: `the inbox holds no ${sourceId}` }
}
