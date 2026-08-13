// ---- locate a task by id ---------------------------------------------------
//
// Walking the board's files and folders, resolving an id to its card, and the
// card-shape facts that hang off location (group root, recurring, archive slot).

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, TODO, ARCHIVE } from './paths'
import type { Found } from './types'

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

export const idPrefix = (name: string): number | null => {
  const m = name.match(/^(\d+)-/)
  return m ? Number(m[1]) : null
}

// Returns { kind: 'group'|'file', target, rel } or null.
//   group  — an id-prefixed folder holding a root.md tracking card; target is the folder.
//            found at any depth, so a recurring folder-task (its card plus sibling docs)
//            resolves the same way a top-level group root does.
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

// Reflect a subtask's fate in its group's root.md ## Todo. `action` is 'tick' (archive:
// flip `- [ ] … #id` to `- [x]`) or 'strike' (reject: wrap the item text in ~~…~~, leaving
// the box). Matches the first bullet whose text references `#id` — `#id\b` keeps #1 from
// matching #14 — and skips a line already in the target state. Returns true if a line
// changed, false if there's no matching subtask line to mark.
export function markSubtask(rootFile: string, id: number, action: 'tick' | 'strike'): boolean {
  const lines = fs.readFileSync(rootFile, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (action === 'tick') {
      const re = new RegExp(`^(\\s*[-*]\\s*\\[) \\](.*#${id}\\b)`)
      if (re.test(line)) {
        lines[i] = line.replace(re, '$1x]$2')
        fs.writeFileSync(rootFile, lines.join('\n'))
        return true
      }
    } else {
      // strike: a bullet (with or without a checkbox) referencing #id, not already struck
      const re = new RegExp(`^(\\s*[-*]\\s+(?:\\[[ xX]\\]\\s+)?)(.*#${id}\\b.*)$`)
      const m = line.match(re)
      if (m && !m[2]!.includes('~~')) {
        lines[i] = `${m[1]}~~${m[2]}~~`
        fs.writeFileSync(rootFile, lines.join('\n'))
        return true
      }
    }
  }
  return false
}

// Where a finished card goes. It sits next to `todo/`, not inside it: everything that
// walks the board reads every folder under `todo/` without skipping dot-names, so an
// archive folder there would show up as a track column and finished cards would look
// open. Flat — no track subfolders — because ids are never reused so names never
// collide, and each card still names its track in its own frontmatter. Nothing reads
// this folder; it is a git history store, not part of the memory set.
export function archiveDest(found: Found): string {
  const dest = path.join(ARCHIVE, path.basename(found.target))
  // Only reachable if someone moved a file here by hand. Never overwrite finished work.
  if (fs.existsSync(dest)) die(`${rel(dest)} already exists — move it aside first, then archive again`)
  return dest
}

// A recurring task never archives — each run bumps "completed" but the card stays,
// so its ## Process can be refined toward less human effort on the next run. Recurring
// cards live in the `recurring/` folder, parallel to the track folders; the guard keys
// off that so a one-shot task can't be run.
export function isRecurringCard(found: Found): boolean {
  return found.rel.split(path.sep)[0] === 'recurring'
}
