// The moments worth cheering for (#1331), read off today's landed deliveries. A delivery
// cheers once, for the biggest thing its landing finished: a release, a group, or — as the
// day's first — itself. Anything that never landed a commit cheers for nothing.

import { deliveriesEndedSince } from '../agent/deliveries'
import type { DeliveryRecord } from '../agent/types'
import type { Cheer } from './types'

const RANK: Record<Cheer['kind'], number> = { release: 2, group: 1, first: 0 }

/** Biggest first, then newest. `dayStart` is local midnight on this machine. */
export function cheersOf(deliveries: DeliveryRecord[], dayStart: number): Cheer[] {
  const landed = deliveries
    .filter(
      (d) =>
        d.status === 'finished' &&
        d.cardId !== null &&
        !!d.landing?.commit &&
        !!d.landing.closed &&
        (d.endedAt ?? 0) >= dayStart,
    )
    .sort((a, b) => a.endedAt! - b.endedAt!)
  const cheers = landed.flatMap((d, i): Cheer[] => {
    const { release, group } = d.landing!.closed!
    const base = { key: d.deliveryId, at: d.endedAt! }
    if (release) return [{ ...base, kind: 'release', release: release.id, count: release.done }]
    if (group) return [{ ...base, kind: 'group', id: group.id, title: group.title, count: group.done }]
    if (i === 0) return [{ ...base, kind: 'first', id: d.cardId!, title: d.title }]
    return []
  })
  return cheers.sort((a, b) => RANK[b.kind] - RANK[a.kind] || b.at - a.at)
}

export function readCheers(now: Date = new Date()): Cheer[] {
  const dayStart = new Date(now).setHours(0, 0, 0, 0)
  return cheersOf(deliveriesEndedSince(dayStart), dayStart)
}
