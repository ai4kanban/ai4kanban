import type { DeliveryRecord, DeliveryReview } from './types'

export function reviewOf(delivery: DeliveryRecord): DeliveryReview {
  if (!delivery.review) delivery.review = { rounds: [] }
  return delivery.review
}
