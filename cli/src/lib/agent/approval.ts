// Diff approval: the tree the user signed off, and what stops it meaning anything (#308).
//
// With **Approve diffs before landing** on, a delivery that review has passed does
// not land until the user has read the diff and approved it. The approval is bound to two
// things as they stood when it was given — the delivery's BASE COMMIT and the candidate's
// FINGERPRINT — and landing re-reads both immediately before it moves the target branch.
// Either one having moved cancels the approval and puts the delivery back to waiting: one
// check that covers a rebase, a review fix, and every other way the tree can change,
// including the ones nobody thought of.
//
// Nothing here is stored twice. `approval.required` is frozen when the delivery starts;
// `approval.granted` is the approval standing right now; `approval.events` is the history
// the permanent record keeps.

import { workMark } from './commit-mode'
import { namedDelivery, syncAudit } from './deliveries'
import { withStore } from './store'
import type { DeliveryRecord } from './types'

/** Whether the approval standing on this delivery still covers the tree that would land.
 *
 *  `moved` says which of the two changed, so the cancellation can say it in the record and
 *  on the card. A delivery that needs no approval always passes. */
export type ApprovalCheck = { ok: true } | { ok: false; moved?: 'base' | 'tree'; why: string }

/** What one approval covers, in the one sentence every screen and every command says it in. */
export const approvalCovers = (base?: string, mark?: string): string =>
  `the tree built on ${base ? base.slice(0, 7) : 'no base commit'}${mark ? `, fingerprint ${mark.slice(0, 8)}` : ''}`

/** Does this delivery still stand approved? Runs git, so never call it inside the record's
 *  lock. */
export function approvalStands(delivery: DeliveryRecord): ApprovalCheck {
  if (!delivery.approval?.required) return { ok: true }
  const granted = delivery.approval.granted
  if (!granted) return { ok: false, why: 'waiting on your approval of the tree it would land' }
  if (granted.base !== delivery.base) {
    return {
      ok: false,
      moved: 'base',
      why: 'the commit it was built on has moved since you approved it, so the approval was cancelled',
    }
  }
  const mark = workMark(delivery)
  if (mark !== granted.mark) {
    return {
      ok: false,
      moved: 'tree',
      why: 'the tree has changed since you approved it, so the approval was cancelled',
    }
  }
  return { ok: true }
}

/** Drop the approval standing on this delivery, saying which of the two moved. Nothing
 *  happens when there is none to drop, so it is safe to call on every pass. */
export function cancelApproval(deliveryId: string, moved?: 'base' | 'tree'): void {
  const dropped = withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === deliveryId)
    const granted = live?.approval?.granted
    if (!live?.approval || !granted) return false
    live.approval.granted = undefined
    live.approval.events.push({ kind: 'cancelled', base: granted.base, mark: granted.mark, moved, at: Date.now() })
    return true
  })
  if (dropped) syncAudit(deliveryId)
}

/** Approve the tree one delivery would land, named by its id, by any prefix of one, or by
 *  the card it is building.
 *
 *  The base and the fingerprint are read HERE, at the moment of approval, so what the user
 *  approved is what the record says they approved. Approving twice is not an error: the
 *  second one covers whatever the tree is now, which is what a user who clicked again meant.
 *
 *  `from` names where it came from — the card page, or `akb delivery approve` — and rides into the
 *  permanent record. */
export function approveDelivery(
  id: string,
  from?: string,
): { ok: true; deliveryId: string; covers: string } | { ok: false; error: string } {
  if (!id.trim()) return { ok: false, error: 'name the delivery to approve' }
  const delivery = namedDelivery(id)
  if (!delivery) return { ok: false, error: `no delivery here answers to "${id}"` }
  if (delivery.status !== 'active') {
    return { ok: false, error: `delivery ${delivery.deliveryId} has already ended, so there is nothing left to approve` }
  }
  if (!delivery.approval?.required) {
    return {
      ok: false,
      error:
        `delivery ${delivery.deliveryId} needs no approval — **Approve diffs before landing** was off when it ` +
        `started, and the setting is frozen on a delivery the way its commit mode is.`,
    }
  }
  // Read outside the lock: it runs git.
  const base = delivery.base
  const mark = workMark(delivery)
  const at = Date.now()
  const written = withStore((store) => {
    const live = store.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
    if (!live?.approval || live.status !== 'active') return false
    live.approval.granted = { base, mark, from, at }
    live.approval.events.push({ kind: 'approved', base, mark, from, at })
    return true
  })
  if (!written) return { ok: false, error: `delivery ${delivery.deliveryId} ended while it was being approved` }
  syncAudit(delivery.deliveryId)
  return { ok: true, deliveryId: delivery.deliveryId, covers: approvalCovers(base, mark) }
}
