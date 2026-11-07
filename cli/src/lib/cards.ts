// ---- locate a task by id ---------------------------------------------------
//
// Walking the board's files and folders, resolving an id to its card, and the
// card-shape facts that hang off location (group root, archive slot).

import fs from 'node:fs'
import path from 'node:path'

import { LEGACY_RECURRING, idPrefix, isGroupFolder, isLegacyRecurring, subtaskLines } from './board/assemble'
import { dropRefsIn, markSubtaskIn } from './leaving'
import { die, rel, TODO, ARCHIVE } from './paths'
import type { Found } from './types'

// The board's own reading rules live in `board/assemble.ts` — one copy, so a hosted page
// reading a card over the network and `akb` reading it off disk agree on what it says.
export { LEGACY_RECURRING, idPrefix, isGroupFolder, isLegacyRecurring, subtaskLines }

export function walkMd(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkMd(full, acc)
    else if (entry.name.endsWith('.md')) acc.push(full)
  }
  return acc
}

export function walkDirs(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const full = path.join(dir, entry.name)
    acc.push(full)
    walkDirs(full, acc)
  }
  return acc
}

// ---- what a folder under todo/ is ------------------------------------------
//
// `docs/kanban/todo/` is flat — one card per file:
//
//   todo/<id>-<slug>.md                    a card
//   todo/<id>.md                           a MARKETING topic — the slug is the title's, and
//                                          a topic's title is not decided yet (#507)
//   todo/<id>-<slug>/root.md               a GROUP task — one card
//                    <sub>-<slug>.md       its subtasks
//
// The id prefix is what says a folder is a group. It is the board's own naming: a group
// folder is created as `<id>-<slug>/` and nothing else under todo/ ever is. `isGroupFolder`
// reads it, above.

// Returns { kind: 'group'|'file', target, rel } or null.
//   group  — an id-prefixed folder holding a root.md tracking card; target is the folder.
//   file   — a single card (standalone or a group's subtask); target is the file.
export function locate(id: number): Found | null {
  const groupDir = walkDirs(TODO).find(
    (d) => idPrefix(path.basename(d)) === id && fs.existsSync(path.join(d, 'root.md')),
  )
  if (groupDir) {
    return { kind: 'group', target: groupDir, rel: path.relative(TODO, groupDir) }
  }
  const hit = walkMd(TODO).find((f) => idPrefix(path.basename(f)) === id)
  if (hit) return { kind: 'file', target: hit, rel: path.relative(TODO, hit) }
  return null
}

// The same, in `.archive/` — for the one flow that reads a card AFTER it has left the board
// (#534). The archive keeps the shape `todo/` had, so a group is still a folder holding
// `root.md` and everything else is a file. Null on a board that has archived nothing.
export function locateArchived(id: number): Found | null {
  if (!fs.existsSync(ARCHIVE)) return null
  const groupDir = walkDirs(ARCHIVE).find(
    (d) => idPrefix(path.basename(d)) === id && fs.existsSync(path.join(d, 'root.md')),
  )
  if (groupDir) return { kind: 'group', target: groupDir, rel: path.relative(ARCHIVE, groupDir) }
  const hit = walkMd(ARCHIVE).find((f) => idPrefix(path.basename(f)) === id)
  return hit ? { kind: 'file', target: hit, rel: path.relative(ARCHIVE, hit) } : null
}

/** Every card id the board is holding — one walk, for a caller asking about more than one.
 *  A group root is named by its folder, everything else by its file. */
export function boardCardIds(): Set<number> {
  const ids = new Set<number>()
  const keep = (name: string) => {
    const id = idPrefix(name)
    if (id !== null) ids.add(id)
  }
  for (const dir of walkDirs(TODO)) keep(path.basename(dir))
  for (const file of walkMd(TODO)) keep(path.basename(file))
  return ids
}

// If `file` is a subtask nested inside a group task, return that group's root.md
// (the nearest ancestor folder holding one). Null for a standalone card. Used so
// archiving a subtask can tick it off in the group's tracking card.
export function enclosingGroupRoot(file: string): string | null {
  let dir = path.dirname(file)
  while (dir.startsWith(TODO) && dir !== TODO) {
    const root = path.join(dir, 'root.md')
    if (fs.existsSync(root) && root !== file) return root
    dir = path.dirname(dir)
  }
  return null
}

// Reflect a subtask's fate in its group's root.md ## Todo (see `markSubtaskIn`). Returns true
// if a line changed, false if there's no matching subtask line to mark.
export function markSubtask(rootFile: string, id: number, action: 'tick' | 'strike'): boolean {
  const marked = markSubtaskIn(fs.readFileSync(rootFile, 'utf8'), id, action)
  if (marked === null) return false
  fs.writeFileSync(rootFile, marked)
  return true
}

// Where a finished card goes. It sits next to `todo/`, not inside it: everything that
// walks the board reads every folder under `todo/` without skipping dot-names, so an
// archive folder there would make finished cards look open. Flat, like `todo/` — ids are
// never reused so names never collide. Nothing reads this folder; it is a git history
// store, not part of the memory set.
export function archiveDest(found: Found): string {
  const dest = path.join(ARCHIVE, path.basename(found.target))
  // Only reachable if someone moved a file here by hand. Never overwrite finished work.
  if (fs.existsSync(dest)) die(`${rel(dest)} already exists — move it aside first, then archive again`)
  return dest
}

// Remove `id` from every other card's `blocked_by`/`related`. Run when a card leaves the
// board (archive or reject): the id is gone, so a card still listing it is blocked by
// nothing and pointing at nothing. A hand-written block list falls through to the reconcile
// warning instead of being silently missed.
export function dropCrossRefs(id: number): string[] {
  const touched: string[] = []
  for (const file of walkMd(TODO)) {
    if (path.basename(file) === 'README.md') continue
    const { text, fields } = dropRefsIn(fs.readFileSync(file, 'utf8'), id)
    if (!fields.length) continue
    fs.writeFileSync(file, text)
    touched.push(`${path.relative(TODO, file).split(path.sep).join('/')} (${fields.join(', ')})`)
  }
  return touched
}
