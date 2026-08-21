// The board's own facts, laid out for an agent to read.
//
// Two things print them: a flow (`akb <action> --print`) and the opening a conversation
// starts with (`akb chat`). Both want the same `label   value` shape and the same one-line
// summary of a card's fields, so the layout lives here rather than once per caller.

import fs from 'node:fs'

import { idPrefix } from '../cards'
import { TODO } from '../paths'
import type { CardSchedule } from '../view/types'

const LABEL = 10

/** `label   text`, with anything after the first line lined up under the text. */
export function field(label: string, text: string | string[]): string[] {
  const body = Array.isArray(text) ? text : [text]
  const pad = ' '.repeat(LABEL)
  return body.map((line, i) => `${i === 0 ? label.padEnd(LABEL) : pad}${line}`)
}

export const numbered = (items: string[]): string[] => items.map((s, i) => `${i + 1}. ${s}`)

/** The fields a card's one-line summary is built from — satisfied by a card's frontmatter
 *  and by the card a board read hands back, so neither side needs a shape of its own. */
export interface MetaBits {
  track: string
  status: string
  priority: string
  roi: string
  release: string
  modules: string[]
  cadence: string
  blocked_by: number[]
  schedule: CardSchedule | null
}

/** A card's meta as one line — the fields a job actually steers by, and nothing it can read
 *  off the file itself in a second. */
export function metaLine(meta: MetaBits): string {
  const bits = [meta.track, meta.status || 'todo', `priority ${meta.priority}`, `roi ${meta.roi}`]
  if (meta.release) bits.push(`release ${meta.release}`)
  if (meta.modules.length) bits.push(`modules ${meta.modules.join(', ')}`)
  if (meta.cadence) bits.push(`every ${meta.cadence}`)
  if (meta.blocked_by.length) bits.push(`blocked by ${meta.blocked_by.map((n) => `#${n}`).join(', ')}`)
  // The board is holding a run for this card already — worth saying, because doing that job
  // here means the queued one has nothing left to do when it fires.
  if (meta.schedule) bits.push(`scheduled to ${meta.schedule.action}`)
  return bits.join(' · ')
}

/** The buckets a card can live in on this board, read off the folders rather than described
 *  in general. Id-prefixed folders are group tasks, not tracks. */
export function trackNames(): string[] {
  try {
    return fs
      .readdirSync(TODO, { withFileTypes: true })
      .filter((e) => e.isDirectory() && idPrefix(e.name) === null)
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}
