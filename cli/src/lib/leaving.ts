// ---- what a card leaving the board does to the cards it leaves behind --------
//
// `raw archive` and `reject` rewrite the cards that pointed at the one leaving: the dangling
// `blocked_by`/`related` dropped, the group root's line ticked or struck, and the group closed
// when its pieces are. These are those rules on card text alone, so Cloud applies them to its
// boards too (#2064); the revise a waiting card gets is Cloud's to start (#169), worded here.
// No filesystem, and `.ts` imports, so the Worker and Node's type stripping load this file as
// it is.

import { parseFrontmatter, serializeFrontmatter } from './frontmatter.ts'

/** Which way a card left: archived (it shipped) or rejected (it was dropped). */
export type Fate = 'completed' | 'rejected'

/** A leaving card as a waiting card's revise note names it. */
export interface Leaver {
  id: number
  title: string
  archived: string
}

/** A rejected card's reason, and the when and by whom a rejection review reads. */
export interface Rejection {
  reason: string
  at?: string
  by?: 'user' | 'agent'
}

/** What a leaving card carries out with it: the day it left, `rejected` when it was turned down
 *  rather than finished, and no stage a run was holding — a card can leave mid-run, and the copy
 *  in `.archive/` must not come back saying it is being implemented. */
export function stampLeavingIn(text: string, day: string, rejection: Rejection | null): string {
  const { meta, body } = parseFrontmatter(text)
  if (!meta) return text
  meta.archived = day
  if (rejection) meta.rejected = true
  if (rejection?.reason) meta.rejected_reason = rejection.reason
  if (rejection?.at) meta.rejected_at = rejection.at
  if (rejection?.by) meta.rejected_by = rejection.by
  if (meta.status === 'implementing') meta.status = 'todo'
  return serializeFrontmatter(meta) + '\n' + body
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

/** A struck subtask line put back, as a rejected card restored (#94) needs. Null when no line changed. */
export function unstrikeSubtaskIn(text: string, id: number): string | null {
  const re = new RegExp(`^(\\s*[-*]\\s+(?:\\[[ xX]\\]\\s+)?)~~(.*#${id}\\b.*)~~\\s*$`)
  const lines = text.split('\n')
  const i = lines.findIndex((line) => re.test(line))
  if (i < 0) return null
  lines[i] = lines[i]!.replace(re, '$1$2')
  return lines.join('\n')
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

// ---- closing a group root with its last subtask (#299) ----------------------

/** Whether this root closes now: it lists subtasks, and each is ticked or struck. */
export function groupCloseOf(text: string): boolean {
  const { total, resolved } = subtaskLines(parseFrontmatter(text).body)
  return total > 0 && resolved === total
}
