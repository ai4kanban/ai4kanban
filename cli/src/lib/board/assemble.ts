// The board's own reading rules as plain functions: what a `## Todo` counts, what a group
// folder is. Nothing here touches a filesystem, git or the coding agent.

import type { Card } from '../view/types'
import { subtaskLines } from '../leaving'

/** The number at the front of a card's filename, or of a group folder's name.
 *
 *  The slug after it is optional (#507): a card can be named off its id alone — `507.md`,
 *  `507/`. A slugged name reads exactly as it always did. */
export const idPrefix = (name: string): number | null => {
  const m = name.match(/^(\d+)(?:-|\.md$|$)/)
  return m ? Number(m[1]) : null
}

/** A folder under `todo/` holding a group's `root.md` — recognised by its name alone, so a
 *  group whose subtasks are all finished is still a group. */
export const isGroupFolder = (name: string): boolean => idPrefix(name) !== null

/** Where an older board kept its recurring cards (#1414). Each becomes a scheduled agent
 *  (../recurring.ts); until then nothing reads one as a card. */
export const LEGACY_RECURRING = 'recurring'
export const isLegacyRecurring = (relFromTodo: string): boolean => relFromTodo.split(/[\\/]/)[0] === LEGACY_RECURRING

/** How far a card's `## Todo` got. Every checkbox in the body counts, wherever it sits. */
export function countTodos(body: string): { total: number; done: number } {
  const matches = body.match(/^[ \t]*[-*]\s+\[( |x|X)\]/gm) || []
  const done = matches.filter((l) => /\[[xX]\]/.test(l)).length
  return { total: matches.length, done }
}

export { subtaskLines }

/**
 * Work out what is really blocking each card. A `blocked_by` id counts only when it names a
 * card that is still open — an id no longer on the board was archived or rejected, so that
 * work is done. A card naming itself is skipped: it never clears.
 */
export function attachBlockers(cards: Card[]): void {
  const byId = new Map(cards.map((c) => [c.id, c]))
  for (const card of cards) {
    card.openBlockers = card.blocked_by
      .filter((n) => n !== card.id)
      .map((n) => byId.get(n))
      .filter((b): b is Card => !!b)
      .map((b) => ({ id: b.id, title: b.title }))
  }
}

/** The module map's names — the **bolded name** at the front of each line, nothing else. */
export function moduleNamesFrom(text: string): string[] {
  const names: string[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*[-*]\s+\*\*([^*]+)\*\*/)
    if (m) names.push(m[1]!.trim())
  }
  return names
}
