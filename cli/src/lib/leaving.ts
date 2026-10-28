// ---- what a card leaving the board does to the cards it leaves behind --------
//
// `raw archive` and `reject` rewrite the cards that pointed at the one leaving: a revise on
// those waiting for it, the dangling `blocked_by`/`related` dropped, the group root's line
// ticked or struck, and the group closed when its pieces are. These are those rules on card
// text alone, so Cloud applies them to its boards too (#2064). No filesystem, and `.ts`
// imports, so the Worker and Node's type stripping load this file as it is.

import { parseFrontmatter, serializeFrontmatter } from './frontmatter.ts'
import { openOf } from './view/rules.ts'

/** Which way a card left: archived (it shipped) or rejected (it was dropped). */
export type Fate = 'completed' | 'rejected'

/** A leaving card as a waiting card's revise note names it. */
export interface Leaver {
  id: number
  title: string
  archived: string
}

/**
 * A group root's subtask lines — the `## Todo` boxes carrying a `#<subid>` — and how many
 * are settled: ticked (built) or struck through (rejected). `ticked` is the closing rule's
 * alone; no screen draws it.
 *
 * The root keeps these true after the subtask files are gone, so this is what says a group
 * is finished rather than the subtask count.
 */
export function subtaskLines(body: string): { total: number; resolved: number; ticked: number } {
  let total = 0
  let resolved = 0
  let ticked = 0
  for (const line of body.split('\n')) {
    const m = line.match(/^[ \t]*[-*]\s+\[( |x|X)\]\s*(.*)$/)
    if (!m || !/#\d+/.test(m[2]!)) continue
    total++
    const done = /[xX]/.test(m[1]!)
    if (done) ticked++
    if (done || /~~[\s\S]*~~/.test(m[2]!)) resolved++
  }
  return { total, resolved, ticked }
}

// Reflect a subtask's fate in its group root's ## Todo. 'tick' (archive) flips `- [ ] … #id`
// to `- [x]`; 'strike' (reject) wraps the item text in ~~…~~, leaving the box. Matches the
// first bullet whose text references `#id` — `#id\b` keeps #1 from matching #14 — and skips
// a line already in the target state. Null when no line changed.
export function markSubtaskIn(text: string, id: number, action: 'tick' | 'strike'): string | null {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (action === 'tick') {
      const re = new RegExp(`^(\\s*[-*]\\s*\\[) \\](.*#${id}\\b)`)
      if (re.test(line)) {
        lines[i] = line.replace(re, '$1x]$2')
        return lines.join('\n')
      }
    } else {
      const re = new RegExp(`^(\\s*[-*]\\s+(?:\\[[ xX]\\]\\s+)?)(.*#${id}\\b.*)$`)
      const m = line.match(re)
      if (m && !m[2]!.includes('~~')) {
        lines[i] = `${m[1]}~~${m[2]}~~`
        return lines.join('\n')
      }
    }
  }
  return null
}

// Edits the two list lines in place rather than re-serializing the frontmatter, so a card
// the board never wrote keeps whatever else it has. Only the inline `[1, 2]` form the board
// writes is matched.
const REF_LIST = /^(blocked_by|related):\s*\[(.*)\]\s*$/

/** `id` taken out of a card's `blocked_by`/`related`, and which of the two lost it. */
export function dropRefsIn(text: string, id: number): { text: string; fields: string[] } {
  const lines = text.split('\n')
  const fields: string[] = []
  if (lines[0]?.trim() !== '---') return { text, fields }
  let end = 1
  while (end < lines.length && lines[end]!.trim() !== '---') end++
  if (end >= lines.length) return { text, fields }
  for (let i = 1; i < end; i++) {
    const m = lines[i]!.match(REF_LIST)
    if (!m) continue
    const refs = m[2]!.split(',').map((s) => s.trim()).filter(Boolean)
    const kept = refs.filter((s) => Number(s.replace(/^#/, '')) !== id)
    if (kept.length === refs.length) continue
    lines[i] = `${m[1]}: [${kept.join(', ')}]`
    fields.push(m[1]!)
  }
  return { text: fields.length ? lines.join('\n') : text, fields }
}

export function reviseNote(card: Leaver, fate: Fate): string {
  const named = `#${card.id} ${JSON.stringify(card.title)}`
  return fate === 'completed'
    ? `${named} was archived (${card.archived}). Check this card against what it shipped and update whatever it assumed about it; change nothing if the card still holds.`
    : `${named} was rejected (${card.archived}). Remove what this card relied on from it; if the card cannot stand without it, ask the user an open question instead.`
}

/** A revise queued on a card waiting on the leavers, or the notes appended to the run it
 *  already has queued: the action stays, and that run reads the note before anything else. */
export function queueRevisionIn(text: string, on: Leaver[], fate: Fate): { text: string; action: string } | null {
  const { meta, body } = parseFrontmatter(text)
  if (!meta) return null
  const notes = [meta.schedule?.notes, ...on.map((g) => reviseNote(g, fate))].filter(Boolean).join('\n')
  meta.schedule = { action: meta.schedule?.action ?? 'revise', notes }
  return { text: serializeFrontmatter(meta) + '\n' + body, action: meta.schedule.action }
}

/** A card with its schedule taken off: the run it was waiting for has been handed over. */
export function clearScheduleIn(text: string): string {
  const { meta, body } = parseFrontmatter(text)
  if (!meta?.schedule) return text
  meta.schedule = null
  return serializeFrontmatter(meta) + '\n' + body
}

// ---- closing a group root with its last subtask (#299) ----------------------

/** Whether this root closes now. `held` carries a line for the receipt in the one case
 *  worth reporting: the group looks finished and a rule is keeping it on the board anyway.
 *  A group still being worked stays with `held: null` — the ordinary case, and silent. */
export type GroupCloseCall = { close: boolean; held: string | null }

const stay = (held: string | null): GroupCloseCall => ({ close: false, held })

// A todo of the root's own: an unticked box naming no subtask. Work no subtask covers, so
// a person finishes it before the group is over.
const OWN_TODO = /^[ \t]*[-*]\s+\[ \]\s*(.*)$/

export function groupCloseOf(text: string): GroupCloseCall {
  const { meta, body } = parseFrontmatter(text)
  const { total, resolved, ticked } = subtaskLines(body)
  // A root that lists no subtasks is a group only a person closes.
  if (total === 0) return stay(null)
  if (resolved < total) return stay(null)
  // A rejection note is written from the card's own words, so a group that shipped nothing
  // is one a person closes.
  if (ticked === 0) return stay('they were all struck out by reject, so the group shipped nothing')
  if (meta && openOf(meta.questions).length > 0) return stay('it carries an open question of its own')
  const own = body.split('\n').some((line) => {
    const m = line.match(OWN_TODO)
    return !!m && !/#\d+/.test(m[1]!)
  })
  if (own) return stay('it has an unticked todo of its own')
  return { close: true, held: null }
}
