// Has this been seen before? (#559)
//
// The one duplicate check, shared by the three ways in — the endpoint pull, `akb triage add`
// and **Add** on the page. It is a scan of the item files themselves rather than a list kept
// alongside them: where a file sits IS its state, so there is no index to keep in step and
// nothing to lose when a folder is edited by hand.
//
// The three ways in read the same answer differently, and that is the whole of the
// difference between them:
//
//   pull    ──► pending, archived and dismissed all hold it off
//   by hand ──► pending and archived hold it off; dismissed does not
//
// Pasting a link back in is the only way out of a dismissal, so it has to work. What it
// costs is one more file: the `dismissed/` record stays exactly where it was, and the item
// is waiting again beside it.

import { readAllDismissed, readArchived, readInbox } from './inbox'

/** Where triage already holds a source id, or that it does not. */
export type TriageStatus = 'pending' | 'archived' | 'dismissed' | 'unseen'

/** One answer: the state, and the file that says so. `relPath` is empty on `unseen`. */
export interface TriageCheck {
  status: TriageStatus
  relPath: string
}

/** Every source id triage holds, in the order a hit is reported: waiting first, then made
 *  into a card, then ignored. Built in one pass so a whole batch is checked against one scan.
 */
export function triageIndex(): Map<string, TriageCheck> {
  const held = new Map<string, TriageCheck>()
  const put = (status: TriageStatus) => (signal: { sourceId: string; relPath: string }) => {
    if (!held.has(signal.sourceId)) held.set(signal.sourceId, { status, relPath: signal.relPath })
  }
  readInbox().forEach(put('pending'))
  readArchived().forEach(put('archived'))
  readAllDismissed().forEach(put('dismissed'))
  return held
}

/** What triage knows about one source id. */
export const checkSource = (sourceId: string): TriageCheck =>
  triageIndex().get(sourceId) ?? { status: 'unseen', relPath: '' }

/** Why an add was refused, in the words the page shows: what was hit, and where it is. */
export const sayHit = (hit: TriageCheck): string =>
  hit.status === 'archived'
    ? `a card was already made of that — ${hit.relPath}`
    : `that is already waiting in triage — ${hit.relPath}`
