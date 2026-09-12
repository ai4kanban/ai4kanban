// One partner submission, end to end (#628).
//
// Three ways in, one way out. The `feedback` agent submits what it found; the screen retries
// a pack that did not land; the screen falls back to the question description alone. All
// three end at the same record, under the same id, so the number the user was shown is the
// number that deletes whatever we ended up holding.

import { partnerFeedbackOn } from '../machine/telemetry'
import { buildCase, textOnlyCase, type CaseFindings } from './collect'
import { sendCase } from './send'
import { closeCase, readCase, readPack, savePack, type CaseRecord } from './state'

export { searchLinkable } from './cards'
export { refinesOf, type CaseClue, type CaseFindings, type CaseRefine } from './collect'
export {
  dropCase,
  openCase,
  readCase,
  type CaseFailure,
  type CaseRecord,
  type CaseStatus,
} from './state'

/** Whether this machine takes part at all. Asked before anything is collected and before the
 *  screen offers to share: the switch is the consent, and nothing is read without it. */
export const caseOffered = (): boolean => partnerFeedbackOn()

/**
 * Build the pack this submission's findings describe, send it, and record how it went.
 *
 * The pack is written to disk BEFORE it is posted, so a submission that fails on the network
 * is one the retry can send again rather than collect again — and so what was sent is on the
 * machine that sent it.
 */
export async function submitCase(discussion: string, found: CaseFindings): Promise<CaseRecord | null> {
  const held = readCase(discussion)
  if (!held) return null
  if (held.status === 'sent') return held
  const built = buildCase(held, found)
  const file = savePack(built.pack)
  const sent = await sendCase(built.pack)
  return closeCase(discussion, {
    status: sent.ok ? 'sent' : 'failed',
    reason: sent.reason,
    gaps: built.gaps,
    packFile: file,
  })
}

/** Post the same pack again, under the same id. The service writes one object per id, so a
 *  retry that arrives after a send that actually landed is the same object, not a second
 *  case. */
export async function retryCase(discussion: string): Promise<CaseRecord | null> {
  const held = readCase(discussion)
  if (!held) return null
  if (held.status === 'sent') return held
  const pack = held.packFile ? readPack(held.packFile) : null
  // Nothing was ever collected — the agent never got as far as submitting — so there is no
  // pack to send again, and the retry is the question description on its own.
  if (!pack) return await sendTextOnlyCase(discussion)
  const sent = await sendCase(pack)
  return closeCase(discussion, { status: sent.ok ? 'sent' : 'failed', reason: sent.reason })
}

/** Send the question description and nothing else — what a pack too large to post leaves the
 *  user able to do without giving up on saying what went wrong. */
export async function sendTextOnlyCase(discussion: string): Promise<CaseRecord | null> {
  const held = readCase(discussion)
  if (!held) return null
  if (held.status === 'sent') return held
  const pack = textOnlyCase(held)
  const sent = await sendCase(pack)
  return closeCase(discussion, {
    status: sent.ok ? 'sent' : 'failed',
    reason: sent.reason,
    gaps: pack.gaps,
  })
}
