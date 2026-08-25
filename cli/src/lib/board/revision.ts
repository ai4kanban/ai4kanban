// ---- what version of a card a caller read ----------------------------------
//
// A Local revision is DERIVED, never stored: a hash of the card file exactly as it is on
// disk. Nothing is added to a card's frontmatter, so a card stays as portable as it was,
// and a card someone edited by hand still gets a revision that moved.
//
// One machine's board is already serialized by the writing lock, so a local write cannot
// lose a race and a solo user will never see a conflict. It is computed anyway because
// this is where it is cheap to get right and cheap to test — the alternative is inventing
// it inside the Cloud work, where the first thing to exercise it would be a real team.

import fs from 'node:fs'
import path from 'node:path'

import { locate } from '../cards'
import { boardStamp } from '../view/stamp'
import { NO_REVISION, type Revision } from './contract'

// FNV-1a over the file's bytes, in the spelling the board already uses for its stamp. Not
// a security hash: it only has to move when the card does, and be short enough to travel.
export function revisionOf(text: string): Revision {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36) + text.length.toString(36)
}

/** Where card `id` is written. A group root is its folder's `root.md`. Null when no open
 *  card carries that id. */
export function cardFile(id: number): string | null {
  const found = locate(id)
  if (!found) return null
  return found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
}

/** The revision card `id` reads at right now, or `NO_REVISION` when there is no such card —
 *  which is also what a `create` expects to find. */
export function cardRevision(id: number): Revision {
  const file = cardFile(id)
  if (!file) return NO_REVISION
  try {
    return revisionOf(fs.readFileSync(file, 'utf8'))
  } catch {
    return NO_REVISION
  }
}

/** The revision of the board as a whole, for the moves that are not about one card — a
 *  release, the project, a setup box. It is the same fingerprint a screen polls. */
export function boardRevision(): Revision {
  try {
    return boardStamp()
  } catch {
    return NO_REVISION
  }
}
