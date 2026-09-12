// The cards a discussion can be linked to (#628).
//
// Wider than #603's search on purpose. That one takes feedback on a LANDED task, so the
// archive is the whole of it; this one is somebody saying a spec missed what they meant, and
// the card they are looking at is usually still on the board. So both are offered, open
// cards first — a complaint is nearly always about the one in front of you.

import { readArchive } from '../view/archive'
import { allCards } from '../view/read'
import type { ArchivedCard } from '../view/types'

/** How many one search shows. A longer list is a list nobody reads. */
const MATCHES = 8

/**
 * The cards matching what was typed — by number, or by a word in the title.
 *
 * An open card answers with an empty `archived`, which is what the row draws as "still on the
 * board". Read on each search rather than held, so a card archived a moment ago is findable
 * under the same query it was findable under before.
 */
export function searchLinkable(query: string): ArchivedCard[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const number = q.replace(/^#/, '')
  const open: ArchivedCard[] = allCards().map((card) => ({
    id: card.id,
    title: card.title,
    release: card.release,
    archived: '',
    relPath: card.relPath,
  }))
  const matches = (card: ArchivedCard): boolean =>
    (/^\d+$/.test(number) && String(card.id).startsWith(number)) || card.title.toLowerCase().includes(q)
  const seen = new Set<number>()
  const once: ArchivedCard[] = []
  for (const card of [...open.filter(matches), ...readArchive().cards.filter(matches)]) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    once.push(card)
  }
  return once.slice(0, MATCHES)
}
