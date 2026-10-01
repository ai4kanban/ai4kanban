// Items a card was already made of, found again before the next run judges them (#561).
//
// Writing the card and recording the item are two calls, so a run that died between them
// leaves an item waiting for a card that already exists. Nothing is journalled and nothing
// is locked: the source id `raw create --triage` writes into the card's frontmatter IS the key, and a triage
// run reconciles against it before it judges anything. Judging twice is the failure this
// prevents — two cards for one item, and a second refine scheduled on the duplicate.

import fs from 'node:fs'
import path from 'node:path'

import { idPrefix, walkMd } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { TODO } from '../paths'
import { archiveInboxItem, readInbox } from './inbox'
import { migrateTriage } from './migrate'

/** One item that turned out to be on a card already, and where its file went. */
export interface CardedItem {
  sourceId: string
  cardId: number
  relPath: string
}

// The card's own id, from the name the board gave the file: `<id>-<slug>.md`, `<id>.md`, or
// a group's `root.md` inside `<id>-<slug>/`.
function cardIdOf(file: string): number | null {
  const own = idPrefix(path.basename(file))
  return own ?? idPrefix(path.basename(path.dirname(file)))
}

/** Every open card made of a triage item, by that item's source id. Read once per run. */
function cardedSources(): Map<string, number> {
  const out = new Map<string, number>()
  let files: string[]
  try {
    files = walkMd(TODO)
  } catch {
    return out
  }
  for (const file of files) {
    const id = cardIdOf(file)
    if (id === null) continue
    try {
      const sourceId = parseFrontmatter(fs.readFileSync(file, 'utf8')).meta?.triage
      if (sourceId && !out.has(sourceId)) out.set(sourceId, id)
    } catch {
      continue
    }
  }
  return out
}

/** Archive every waiting item an open card was already made of, and say which. Idempotent: a
 *  second call finds nothing, because the first moved the files out of the list. */
export function reconcileTriage(): CardedItem[] {
  migrateTriage()
  const waiting = readInbox()
  if (waiting.length === 0) return []
  const carded = cardedSources()
  if (carded.size === 0) return []
  const done: CardedItem[] = []
  for (const item of waiting) {
    const cardId = carded.get(item.sourceId)
    if (cardId === undefined) continue
    const moved = archiveInboxItem(item.sourceId, cardId)
    if (moved.ok) done.push({ sourceId: item.sourceId, cardId, relPath: moved.relPath })
  }
  return done
}
