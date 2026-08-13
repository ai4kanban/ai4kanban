// ---- a direct edit to one card ---------------------------------------------
//
// The fields a person changes from a screen rather than by asking an agent: the title, the
// body, priority, roi, the release, a recurring card's cadence. Everything else about a
// card — its track, its links, its questions — stays with the agents and the commands.
//
// It is one write, in the frontmatter serializer every other writer uses, so a card edited
// from a board and a card edited by `update` come out byte-identical.

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, TODO } from '../paths'
import { CADENCE_FORMS, formatCadence, parseCadence } from '../cadence'
import { locate } from '../cards'
import { parseFrontmatter, serializeFrontmatter } from '../frontmatter'
import { repointReadmeLink } from '../readme'
import { setSubtreeRelease, validRelease } from '../releases'
import { RECURRING } from '../recurring'
import { LEVELS, normalizeRelease } from '../validate'
import type { CardPatch } from './types'

/** Apply a direct edit to card `id`. Refuses — by throwing the board's own refusal, which
 *  the surface above turns into a line — when the id is unknown, a level is not one of the
 *  three, the release is not on the list, or a cadence is asked of a card that never
 *  repeats. */
export function patchCard(id: number, patch: CardPatch): void {
  if (!Number.isInteger(id)) die('a card is edited by its number', 'bad-id')
  const found = locate(id)
  if (!found) die(`no open card #${id}`, { kind: 'card-not-found', id })
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`, { kind: 'no-frontmatter', id })

  let titleChanged = false
  if (patch.title !== undefined) {
    const t = patch.title.trim()
    if (!t) die('the title must not be empty')
    if (t !== meta.title) titleChanged = true
    meta.title = t
  }
  for (const field of ['priority', 'roi'] as const) {
    const value = patch[field]
    if (value === undefined) continue
    if (!LEVELS.includes(value)) die(`${field} must be one of ${LEVELS.join(' | ')}`)
    meta[field] = value
  }
  // A card only moves onto a release that exists, the same check `update` makes — a typo
  // must not quietly invent a version. Empty is always allowed: it means no release, so
  // writing it is how a card comes back out of one.
  if (patch.release !== undefined) meta.release = validRelease(normalizeRelease(patch.release))
  // Only a card that repeats can carry a cadence, and only in a form the schedule can read
  // — a half-parsed line would look like a schedule and never run. Empty clears it, which
  // is how a card goes back to running only when someone asks.
  if (patch.cadence !== undefined) {
    if (path.relative(TODO, file).split(path.sep)[0] !== RECURRING) {
      die(`#${id} is not a recurring card — only a card that repeats can have a cadence`, { kind: 'not-recurring', id })
    }
    const text = patch.cadence.trim()
    const parsed = text ? parseCadence(text) : null
    if (text && !parsed) die(`"${text}" isn't a cadence. Accepted: ${CADENCE_FORMS}`)
    meta.cadence = parsed ? formatCadence(parsed) : ''
  }

  const newBody = patch.body !== undefined ? patch.body : body
  const normalized = newBody.replace(/^\n+/, '').replace(/\s+$/, '')
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n\n' + normalized + '\n')

  // A group root's release is the whole group's: putting the root in a version puts every
  // subtask in it, and taking the root out takes them all out.
  if (patch.release !== undefined && found.kind === 'group') setSubtreeRelease(found.target, meta.release)

  // The index carries the title, so a retitle follows it there. The bullet keeps its place
  // — only the link text changes.
  if (titleChanged) {
    const relFromTodo = path.relative(TODO, file)
    repointReadmeLink(id, relFromTodo, relFromTodo, meta.title)
  }
}
