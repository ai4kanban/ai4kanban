// ---- a direct edit to one card ---------------------------------------------
//
// The fields a person changes from a screen rather than by asking an agent: the title, the
// body, priority, roi, the release, and the action a blocked
// card is waiting to run. Everything else about a card — its track, its links, its
// questions — stays with the agents and the commands.
//
// It is one write, in the frontmatter serializer every other writer uses, so a card edited
// from a board and a card edited by `update` come out byte-identical.

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, TODO } from '../paths'
import { locate } from '../cards'
import { parseFrontmatter, serializeFrontmatter } from '../frontmatter'
import { repointReadmeLink } from '../readme'
import { setSubtreeRelease, validRelease } from '../releases'
import { cardCreation } from '../agent/store'
import { normalizeSchedule, SCHEDULED_ACTIONS } from '../schedule'
import { LEVELS, normalizeRelease } from '../validate'
import { findCard } from './read'
import { canRefine, creationRefusal, scheduleRefusal } from './rules'
import type { Meta } from '../types'
import type { CardPatch, CardSchedule } from './types'

/** Apply a direct edit to card `id`. Refuses — by throwing the board's own refusal, which
 *  the surface above turns into a line — when the id is unknown, a level is not one of the
 *  three, or the release is not on the list. */
export function patchCard(id: number, patch: CardPatch): void {
  if (!Number.isInteger(id)) die('a card is edited by its number', 'bad-id')
  const found = locate(id)
  if (!found) die(`no open card #${id}`, { kind: 'card-not-found', id })
  // A card its creator has not finished writing is not one to edit (#564): the run is still
  // typing the plan this edit would be made against.
  const creating = creationRefusal(id, cardCreation(id), 'edit')
  if (creating) die(creating, { kind: 'card-being-created', id })
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

/**
 * Put a scheduled action on card `id`, or take one off with `null`. Answers with the
 * schedule that was there before, so a caller can say which one it replaced.
 *
 * A card holds one at a time: writing a second is what replaces the first, which is why
 * there is no separate "replace" move. Putting one ON is refused only when the action
 * wouldn't move the card (`scheduleRefusal`); taking one OFF is always allowed — a mark the
 * user wants gone must never be stuck on the card.
 *
 * Only the frontmatter is rewritten; the body is put back exactly as it was read.
 */
export function setCardSchedule(id: number, schedule: CardSchedule | null): CardSchedule | null {
  if (!Number.isInteger(id)) die('a card is scheduled by its number', 'bad-id')
  const wanted = normalizeSchedule(schedule)
  if (schedule && !wanted) die(`a schedule names the action to run: ${SCHEDULED_ACTIONS.join(', ')}`, 'bad-schedule')
  if (wanted?.action === 'revise' && !wanted.notes) die('a revise needs notes saying what to revise', 'bad-schedule')
  const found = locate(id)
  if (!found) die(`no open card #${id}`, { kind: 'card-not-found', id })
  // A run queued onto a card still being created would fire on half a plan (#564). Both
  // ways round: taking a mark OFF one is refused too, so a schedule survives its creator.
  const creating = creationRefusal(id, cardCreation(id), 'schedule')
  if (creating) die(creating, { kind: 'card-being-created', id })
  // The board's own rule, read off the whole board — whether the action would still move
  // this card depends on what else is open, not on this file alone.
  if (wanted) {
    const card = findCard(id)
    if (!card) die(`no open card #${id}`, { kind: 'card-not-found', id })
    const refusal = scheduleRefusal(card, wanted.action)
    if (refusal) die(refusal, { kind: 'cannot-schedule', id })
  }
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`, { kind: 'no-frontmatter', id })
  const was = meta.schedule
  meta.schedule = wanted
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  return was
}

/** Ensure a blocked card has a refinement follow-up without replacing an explicit schedule. */
export function scheduleRefineOnBlock(id: number): boolean {
  const card = findCard(id)
  if (!card || card.openBlockers.length === 0 || card.schedule || !canRefine(card)) return false
  setCardSchedule(id, { action: 'refine', notes: '' })
  return true
}
