// Attach cards immediately after the creating command completes.
import { setCardStatusOn } from '../board'
import { adoptDirectCard } from './deliveries'
import { recordCreatedCards } from './store'

export async function recordCards(sessionId: string, ids: number[]): Promise<void> {
  recordCreatedCards(sessionId, ids)
  const id = ids[0]
  if (id === undefined || !adoptDirectCard(sessionId, id)) return
  try {
    await setCardStatusOn(id, 'implementing')
  } catch {
    // the board would not take the write — the delivery holds the card either way
  }
}
