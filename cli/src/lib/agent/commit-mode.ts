// Delivery identity and execution context. Git belongs to the executing agent.
import fs from 'node:fs'
import { DELIVERIES, REPO_ROOT } from '../paths'
import { plannedTodos } from './outputs'
import { readStore } from './store'
import type { DeliveryRecord, RunRefusal } from './types'
import { currentBranch, headCommit, worktreeDir } from './worktree'

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const ID_LENGTH = 8

/** Every delivery id the permanent record already holds, so a new one can't collide with a
 *  delivery that ended months ago. */
function recordedIds(): Set<string> {
  try {
    return new Set(
      fs
        .readdirSync(DELIVERIES)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -'.json'.length)),
    )
  } catch {
    return new Set()
  }
}

/** A delivery id nothing else answers to — drawn at random and checked against both
 *  records, the live rows and the files, since a delivery leaves the first long before it
 *  leaves the second. */
export function newDeliveryId(live: DeliveryRecord[] = readStore().deliveries): string {
  const taken = recordedIds()
  for (const d of live) taken.add(d.deliveryId)
  for (;;) {
    let id = ''
    for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]
    if (!taken.has(id)) return id
  }
}

export interface DeliveryStart {
  deliveryId: string
  base?: string
  targetBranch?: string
  planned?: string[]
  worktree?: string
}

export const deliveryCwd = (delivery: { worktree?: string }): string =>
  delivery.worktree && fs.existsSync(worktreeDir(delivery.worktree)) ? worktreeDir(delivery.worktree) : REPO_ROOT

export function prepareDelivery(cardId: number | null): { start: DeliveryStart } | RunRefusal {
  return { start: {
    deliveryId: newDeliveryId(),
    base: headCommit() ?? undefined,
    targetBranch: currentBranch() ?? undefined,
    planned: cardId === null ? [] : plannedTodos(cardId),
  } }
}

export const deliveryName = (delivery: Pick<DeliveryRecord, 'cardId' | 'deliveryId'>): string =>
  delivery.cardId === null ? `delivery ${delivery.deliveryId}` : `#${delivery.cardId}`
