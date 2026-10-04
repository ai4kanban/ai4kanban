// ---- the archive, read -----------------------------------------------------
//
// The cards in `docs/kanban/.archive` (#380), finished and rejected alike. Archiving is a rename — the card
// keeps its frontmatter and its body, and the board forgets it — so until this there was
// no way back to one that wasn't a file browser.
//
// The folder holds flat files and group folders whose card is `root.md`, so the id is read
// off the file name or, for a root, off the folder. Read on every call rather than held:
// the folder grows one card at a time, and an index would only be a second thing to keep
// true.

import fs from 'node:fs'
import path from 'node:path'

import { listDeliveries } from '../agent/deliveries'
import { cardSources } from '../card-sources'
import { idPrefix, walkMd } from '../cards'
import { parseFrontmatter } from '../frontmatter'
import { ARCHIVE, rel } from '../paths'
import type { Meta } from '../types'
import type { ArchiveList, ArchivedCard, ArchivedCardFile } from './types'

/** An archived card's id: its file name, or — for a group's `root.md` — the folder the
 *  group was archived as. */
export function archivedId(file: string): number | null {
  const own = idPrefix(path.basename(file))
  return own !== null ? own : idPrefix(path.basename(path.dirname(file)))
}

function readFile(file: string): { row: ArchivedCard; body: string; meta: Meta } | null {
  const id = archivedId(file)
  if (id === null) return null
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) return null
  return {
    row: {
      id,
      title: meta.title,
      release: meta.release,
      archived: meta.archived,
      rejected: meta.rejected,
      relPath: rel(file).split(path.sep).join('/'),
    },
    body: body.replace(/^\n+/, '').replace(/\s+$/, ''),
    meta,
  }
}

/** What the archive holds, newest first. A board that has archived nothing — and one whose
 *  `.archive` isn't there yet — answers with the folder named and no cards, which is what
 *  lets a screen say so rather than read as a failed read. */
export function readArchive(): ArchiveList {
  const relPath = rel(ARCHIVE).split(path.sep).join('/')
  if (!fs.existsSync(ARCHIVE)) return { relPath, cards: [] }
  const cards = walkMd(ARCHIVE)
    .map(readFile)
    .filter((found) => found !== null)
    .map((found) => found.row)
  cards.sort((a, b) => b.id - a.id)
  return { relPath, cards }
}

/** One archived card in full. Null when the archive holds none with that id — including on
 *  a board with no archive at all. */
export function readArchivedCard(id: number): ArchivedCardFile | null {
  if (!Number.isInteger(id) || !fs.existsSync(ARCHIVE)) return null
  for (const file of walkMd(ARCHIVE)) {
    const found = readFile(file)
    if (!found || found.row.id !== id) continue
    const sources = cardSources(found.meta, found.body)
    const reason = found.meta.rejected_reason
    const landed = landedDelivery(id)
    return {
      ...found.row,
      body: found.body,
      ...(sources.length ? { sources } : {}),
      ...(reason ? { rejectedReason: reason } : {}),
      ...(landed ? { landed } : {}),
    }
  }
  return null
}

// The card's newest delivery that landed a commit (#1537), so its page can show what landed.
function landedDelivery(cardId: number): ArchivedCardFile['landed'] {
  const last = listDeliveries()
    .filter((d) => d.cardId === cardId && d.status === 'finished' && d.landing?.status === 'landed' && d.landing.commit)
    .pop()
  return last && { id: last.deliveryId, commit: last.landing!.commit!, targetBranch: last.targetBranch }
}
