// ---- a direct edit to one card ---------------------------------------------
//
// The fields a person changes from a screen rather than by asking an agent: the title, the
// body, priority, roi, the release, a recurring card's cadence, and the action a blocked
// card is waiting to run. Everything else about a card — its track, its links, its
// questions — stays with the agents and the commands.
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
import { normalizeSchedule } from '../schedule'
import { LEVELS, normalizeRelease } from '../validate'
import { findCard } from './read'
import { canRefine, scheduleRefusal } from './rules'
import type { Meta } from '../types'
import type { CardPatch, CardSchedule } from './types'

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
  if (schedule && !wanted) die('a schedule names the action to run: implement or refine', 'bad-schedule')
  const found = locate(id)
  if (!found) die(`no open card #${id}`, { kind: 'card-not-found', id })
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

/** Give a card its default one-shot refine when it enters a blocked episode.
 *
 * `wasBlocked` makes cancellation stick: changing one non-empty blocker list into another
 * must not put back a schedule the user removed. Creation, and an empty → non-empty update,
 * pass false. An explicit implement schedule is never replaced. */
export function scheduleRefineOnBlock(id: number, wasBlocked: boolean): boolean {
  if (wasBlocked) return false
  const card = findCard(id)
  if (!card || card.openBlockers.length === 0 || card.schedule || !canRefine(card)) return false
  setCardSchedule(id, { action: 'refine', notes: '' })
  return true
}

// ---- one hand-check, from a screen (#276) -----------------------------------
//
// The lines under `verify:` — what the user checks by hand once the build is done. A
// screen adds one and crosses one off; `update-verify` is the same two edits from a
// terminal.
//
// Crossing off matches the line by its TEXT, not by its place in the list: a run can add
// or take away hand-checks while the page sits open, and by then the third line is a
// different line. A line no longer there refuses, so the screen can say it has gone
// instead of taking the wrong one off.

function openCard(id: number): { file: string; meta: Meta } {
  if (!Number.isInteger(id)) die('a hand-check is edited by its card number', 'bad-id')
  const found = locate(id)
  if (!found) die(`no open card #${id}`, { kind: 'card-not-found', id })
  const file = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const { meta } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) die(`${rel(file)} has no frontmatter — run \`migrate\` first`, { kind: 'no-frontmatter', id })
  return { file, meta }
}

/** Rewrite only the frontmatter; the body goes back exactly as it was read. */
function writeMeta(file: string, meta: Meta): void {
  const { body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
}

/** Add one hand-check to card `id`, and answer with the list as it now stands. */
export function addVerifyLine(id: number, line: string): string[] {
  const text = String(line ?? '').trim()
  if (!text) die('a hand-check is one line of text', 'empty-verify')
  const { file, meta } = openCard(id)
  meta.verify.push(text)
  writeMeta(file, meta)
  return meta.verify
}

/** Cross one hand-check off card `id`, matched by its text. Refuses when no line reads that
 *  way — it has already gone, and the screen says so rather than taking another one off. */
export function dropVerifyLine(id: number, line: string): string[] {
  const text = String(line ?? '').trim()
  const { file, meta } = openCard(id)
  const at = meta.verify.findIndex((l) => l.trim() === text)
  if (at < 0) die('that hand-check is no longer on the card', { kind: 'verify-not-found', id })
  meta.verify.splice(at, 1)
  writeMeta(file, meta)
  return meta.verify
}
