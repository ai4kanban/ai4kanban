// Items a card was already made of, found again before the next run judges them (#561).
//
// Writing the card and recording the item are two calls, so a run that died between them
// leaves an item waiting for a card that already exists. Nothing is journalled and nothing
// is locked: the source id the new card writes into its `## Source` IS the key, and a triage
// run reconciles against it before it judges anything. Judging twice is the failure this
// prevents — two cards for one item, and a second refine scheduled on the duplicate.

import fs from 'node:fs'
import path from 'node:path'

import { idPrefix, walkMd } from '../cards'
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

// A card's `## Source` section — the only part of a card a source id counts in. A source id
// quoted anywhere else is somebody writing about the item, not the card made of it.
function sourceSection(text: string): string {
  const at = text.search(/^## Source\s*$/m)
  if (at < 0) return ''
  const rest = text.slice(at)
  const next = rest.slice(1).search(/^## /m)
  return next < 0 ? rest : rest.slice(0, next + 1)
}

// Word-bounded, so `t3_1ab` does not match `t3_1abcdef`. Source ids carry `-` and `_`, which
// `\b` does not fence, so the fence is spelled out.
const holds = (section: string, sourceId: string): boolean =>
  new RegExp(`(^|[^\\w.-])${sourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w.-]|$)`).test(section)

/** Every open card's `## Source`, by the card it belongs to. Read once per run. */
function sourceSections(): { id: number; section: string }[] {
  let files: string[]
  try {
    files = walkMd(TODO)
  } catch {
    return []
  }
  const out: { id: number; section: string }[] = []
  for (const file of files) {
    const id = cardIdOf(file)
    if (id === null) continue
    let section = ''
    try {
      section = sourceSection(fs.readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    if (section) out.push({ id, section })
  }
  return out
}

/** Archive every waiting item an open card already names, and say which. Idempotent: a
 *  second call finds nothing, because the first moved the files out of the list. */
export function reconcileTriage(): CardedItem[] {
  migrateTriage()
  const waiting = readInbox()
  if (waiting.length === 0) return []
  const sections = sourceSections()
  if (sections.length === 0) return []
  const done: CardedItem[] = []
  for (const item of waiting) {
    const card = sections.find((c) => holds(c.section, item.sourceId))
    if (!card) continue
    const moved = archiveInboxItem(item.sourceId, card.id)
    if (moved.ok) done.push({ sourceId: item.sourceId, cardId: card.id, relPath: moved.relPath })
  }
  return done
}
