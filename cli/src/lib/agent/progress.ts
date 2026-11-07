import { answerOutcome } from './answers'
import { approvedRequirements, openQuestions, syncAudit } from './deliveries'
import { readStore, withStore } from './store'
import type { AgentRequest, DeliveryRecord } from './types'

export function deliveryStep(delivery: DeliveryRecord): number {
  const count = delivery.completions?.length ?? 0
  const last = delivery.completions?.[count - 1]
  const end = delivery.workflow?.land?.length ?? 1
  return last && !last.finished && last.step + 1 >= end ? last.step : count
}

/** Advance recorded workflow steps and applied answers, without inspecting or changing Git. */
export function nextDeliveryRun(deliveryId?: string): AgentRequest | undefined {
  const store = readStore()
  for (const delivery of store.deliveries) {
    if (deliveryId && delivery.deliveryId !== deliveryId) continue
    if (delivery.status !== 'active' || delivery.cardId === null) continue
    if (openQuestions(delivery.cardId) || store.runs.some((r) => r.deliveryId === delivery.deliveryId && r.status === 'running')) continue
    if (answerOutcome(delivery) === 'changed') {
      const superseded = withStore((live) => {
        const row = live.deliveries.find((d) => d.deliveryId === delivery.deliveryId)
        if (!row || row.status !== 'active' || answerOutcome(row) !== 'changed' ||
            live.runs.some((r) => r.deliveryId === row.deliveryId && r.status === 'running')) return false
        row.status = 'cancelled'
        row.endedAt = Date.now()
        row.steps.push({ step: 'superseded', at: row.endedAt })
        for (const answer of row.answers ?? []) if (!answer.actedAt) answer.actedAt = row.endedAt
        return true
      })
      if (!superseded) continue
      syncAudit(delivery.deliveryId)
      return { action: 'implement', id: delivery.cardId, title: delivery.title, session: 'new' }
    }
    const last = store.runs.filter((r) => r.deliveryId === delivery.deliveryId && r.action === 'implement').pop()
    const registered = delivery.completions?.some((c) => c.sessionId === last?.sessionId)
    const answered = delivery.answers?.some((a) => !a.actedAt)
    if (registered || answered) {
      withStore((live) => {
        const row = live.deliveries.find((d) => d.deliveryId === delivery.deliveryId)!
        for (const answer of row.answers ?? []) if (!answer.actedAt) answer.actedAt = Date.now()
      })
      syncAudit(delivery.deliveryId)
      return { action: 'implement', id: delivery.cardId, deliveryId: delivery.deliveryId, title: delivery.title,
        ...(registered ? { session: 'new' as const } : {}) }
    }
  }
  // A failed spawn after superseding still owes the approved card a fresh delivery.
  const owed = store.deliveries.find((d) => d.cardId !== null && d.steps.some((s) => s.step === 'superseded') &&
    !d.steps.some((s) => s.step === 'dropped') && !store.deliveries.some((other) => other.cardId === d.cardId && other.deliveryId !== d.deliveryId && other.startedAt >= (d.endedAt ?? 0)) &&
    !store.runs.some((r) => r.cardId === d.cardId && r.status === 'running') && approvedRequirements(d.cardId!))
  return owed ? { action: 'implement', id: owed.cardId!, title: owed.title, session: 'new' } : undefined
}
