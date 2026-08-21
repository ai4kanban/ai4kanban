// One short string that changes when the board does (#243).
//
// A chat now writes the board while it is still writing its reply, so the screen has to
// notice a card that moved without anyone clicking anything. Re-reading the whole board a
// few times a second to find out would be a full parse of every card for an answer that is
// almost always "nothing changed" — so the screen asks this instead, and re-reads only when
// the answer moves.
//
// It is a fingerprint of the files the board is made of: what is there, and when each was
// last written. Never their contents — the point is to be cheap enough to ask often.
//
// What it deliberately leaves out is everything that changes on its own: the run record and
// its logs, the conversations, the lock files. A stamp that moved while a run was talking
// to itself would put the board into a re-read loop that never ends.

import fs from 'node:fs'
import path from 'node:path'

import {
  ARCHIVE_MD,
  CONFIG,
  MEMORY,
  MOCKUPS,
  MODULES_MD,
  NEXT_ID,
  RELEASES,
  SETUP_CHECKLIST,
  TODO,
} from '../paths'

/** How deep the walk goes. A group task is `todo/<group>/<track>/<card>.md`, and the memory
 *  set is one folder deep — nothing the board draws sits below that. */
const MAX_DEPTH = 4

/** A fingerprint of the board as it stands. Two calls that answer the same string mean
 *  nothing a screen draws has changed since the first one. */
export function boardStamp(): string {
  const parts: string[] = []
  for (const dir of [TODO, MEMORY, MOCKUPS]) walk(dir, parts, 0)
  for (const file of [RELEASES, MODULES_MD, ARCHIVE_MD, CONFIG, SETUP_CHECKLIST, NEXT_ID]) {
    stamp(file, parts)
  }
  return hash(parts.join('\n'))
}

function walk(dir: string, parts: string[], depth: number): void {
  if (depth > MAX_DEPTH) return
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    // Not there — a board without mockups or without a memory folder is a board, and its
    // absence is part of the fingerprint by being nothing at all.
    return
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, parts, depth + 1)
    else stamp(full, parts)
  }
}

function stamp(file: string, parts: string[]): void {
  try {
    const s = fs.statSync(file)
    parts.push(`${file}:${s.size}:${Math.round(s.mtimeMs)}`)
  } catch {
    // Gone. Nothing recorded, so the stamp moves the moment a file is deleted.
  }
}

// FNV-1a. Not a security hash — it only has to change when its input does, and be short
// enough to send down to a browser a few times a second.
function hash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36) + text.length.toString(36)
}
