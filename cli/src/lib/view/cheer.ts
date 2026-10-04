// The moments worth cheering for (#1331), read off today's archives (#1515). Every archive
// counts — by a delivery or by hand, committed or not — and cheers once, for the biggest
// thing it finished: a release, a group, or — as the day's first — itself.

import fs from 'node:fs'
import path from 'node:path'

import { BOARD_STATE } from '../paths'
import { archivedCards, endingCards } from '../releases'
import type { Cheer } from './types'

export interface Completion {
  id: number
  title: string
  at: number
  group?: { id: number; title: string; done: number }
  release?: { id: string; done: number }
}

const RANK: Record<Cheer['kind'], number> = { release: 2, group: 1, first: 0 }
// Long enough to cover "today" in any time zone; older entries are dropped on the next write.
const KEEP = 2 * 86_400_000

const completionsFile = (): string => path.join(BOARD_STATE, 'completions.json')

function readCompletions(): Completion[] {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(completionsFile(), 'utf8'))
    return Array.isArray(raw) ? raw.filter((c): c is Completion => Number.isInteger(c?.id) && typeof c?.at === 'number') : []
  } catch {
    return []
  }
}

// The card's release, when this archive left it with no open card. A release of one card is
// not a milestone: every card would be one.
function closedRelease(cardId: number): Completion['release'] {
  try {
    const id = archivedCards().find((card) => card.id === cardId)?.release
    if (!id) return undefined
    const { archived, left } = endingCards(id)
    return left.length === 0 && archived.length >= 2 ? { id, done: archived.length } : undefined
  } catch {
    return undefined
  }
}

/** Note an archived card, after it has moved. Best-effort: a cheer is never worth an error. */
export function recordCompletion(card: { id: number; title: string; group?: Completion['group'] }, now = Date.now()): void {
  try {
    const kept = readCompletions().filter((c) => c.at >= now - KEEP)
    kept.push({ ...card, at: now, release: closedRelease(card.id) })
    fs.mkdirSync(BOARD_STATE, { recursive: true })
    fs.writeFileSync(completionsFile(), JSON.stringify(kept))
  } catch {
    // an unwritable state folder — this archive cheers for nothing
  }
}

/** Biggest first, then newest. `dayStart` is local midnight on this machine. */
export function cheersOf(completions: Completion[], dayStart: number): Cheer[] {
  const today = completions.filter((c) => c.at >= dayStart).sort((a, b) => a.at - b.at)
  const cheers = today.flatMap(({ id, title, at, group, release }, i): Cheer[] => {
    const base = { key: `${id}@${at}`, at }
    if (release) return [{ ...base, kind: 'release', release: release.id, count: release.done }]
    if (group) return [{ ...base, kind: 'group', id: group.id, title: group.title, count: group.done }]
    if (i === 0) return [{ ...base, kind: 'first', id, title }]
    return []
  })
  return cheers.sort((a, b) => RANK[b.kind] - RANK[a.kind] || b.at - a.at)
}

export function readCheers(now: Date = new Date()): Cheer[] {
  const dayStart = new Date(now).setHours(0, 0, 0, 0)
  return cheersOf(readCompletions(), dayStart)
}
