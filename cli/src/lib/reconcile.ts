// ---- board integrity (run after create/run) --------------------------------
//
// A safety net for cards moved, renamed, or removed by hand (Write/Edit/mv instead of
// the script), which leaves the README index and cross-references stale. It NEVER fails
// the command — the id was already handed out and the board change already happened, so
// a broken link must not block it. Warnings go to stderr so `create`'s stdout (the id)
// stays clean for callers. It does two things:
//   • repoints a README link whose target file vanished but whose id still has a card
//     elsewhere on disk (a hand-move/rename) — the only auto-fix, and
//   • warns about what it can't safely repair: an index entry for an id with no card, a
//     top-level card with no index entry, or a blocked_by/related pointing at a task
//     that's no longer on the board.
//
// The same reading is available without the repair (`boardComplaints`), which is what a
// finished run is checked against: an agent that took a card off the board with `rm`
// instead of `akb board archive` leaves exactly this behind, and a run that reports a clean
// `✓ done` over it is the board agreeing that nothing happened.

import fs from 'node:fs'
import path from 'node:path'

import { warn, TODO, README } from './paths'
import { walkMd, walkDirs, idPrefix, locate } from './cards'
import { parseFrontmatter } from './frontmatter'

// A README entry links a card as `[#id title](relpath)`. Grab the id and the path.
const README_LINK = /\[#(\d+)\b[^\]]*\]\(([^)]+)\)/

// Every task id that still has a card on disk (standalone, subtask, or group root).
function liveIds() {
  const ids = new Set()
  for (const file of walkMd(TODO)) {
    const base = path.basename(file)
    if (base === 'README.md') continue
    const id = base === 'root.md' ? idPrefix(path.basename(path.dirname(file))) : idPrefix(base)
    if (id != null) ids.add(id)
  }
  return ids
}

// Cards that OWN a top-level README entry: a group root, or a card directly in a track
// folder. Nested subtasks are only optionally indexed, so they aren't required here.
function indexableCards() {
  const out = []
  for (const dir of walkDirs(TODO)) {
    const id = idPrefix(path.basename(dir))
    if (id != null && fs.existsSync(path.join(dir, 'root.md'))) {
      out.push({ id, rel: path.join(path.relative(TODO, dir), 'root.md').split(path.sep).join('/') })
    }
  }
  for (const file of walkMd(TODO)) {
    const base = path.basename(file)
    if (base === 'README.md' || base === 'root.md') continue
    const relTODO = path.relative(TODO, file)
    const segs = relTODO.split(path.sep)
    if (segs.length !== 2) continue // nested subtask — optional
    if (segs[0] === 'recurring') continue // recurring cards aren't board-index tasks
    const id = idPrefix(base)
    if (id != null) out.push({ id, rel: segs.join('/') })
  }
  return out
}

// What the README index gets wrong, and — when `fix` — the one thing that can be repaired:
// a link whose file moved but whose id still has a card somewhere.
function readmeComplaints(fix: boolean): string[] {
  const said: string[] = []
  const lines = fs.readFileSync(README, 'utf8').split('\n')
  const indexed = new Set()
  let fixed = 0
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(README_LINK)
    if (!m) continue
    const id = Number(m[1])
    const linkPath = m[2]
    indexed.add(id)
    if (fs.existsSync(path.join(TODO, linkPath))) continue // link is live
    const found = locate(id)
    if (!found) {
      said.push(`README links #${id} → ${linkPath}, but no card with that id exists (removed by hand?). Drop the entry or restore the file.`)
      continue
    }
    const want = (found.kind === 'group' ? path.join(found.rel, 'root.md') : found.rel).split(path.sep).join('/')
    if (want === linkPath) continue
    if (!fix) {
      said.push(`README links #${id} → ${linkPath}, which isn't there any more; the card is at ${want}.`)
      continue
    }
    lines[i] = lines[i].replace(`(${linkPath})`, `(${want})`)
    said.push(`README link #${id} pointed at missing ${linkPath} → repointed to ${want}.`)
    fixed++
  }
  if (fixed) fs.writeFileSync(README, lines.join('\n'))
  for (const c of indexableCards()) {
    if (!indexed.has(c.id)) {
      said.push(`card ${c.rel} (#${c.id}) is not in the README index. Add it under its track heading.`)
    }
  }
  return said
}

// blocked_by/related that point at a task no longer on the board.
function crossRefComplaints(): string[] {
  const said: string[] = []
  const live = liveIds()
  for (const file of walkMd(TODO)) {
    const base = path.basename(file)
    if (base === 'README.md') continue
    const ownerId = base === 'root.md' ? idPrefix(path.basename(path.dirname(file))) : idPrefix(base)
    if (ownerId == null) continue
    const { meta } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    if (!meta) continue
    for (const field of ['blocked_by', 'related'] as const) {
      for (const ref of meta[field] || []) {
        if (!live.has(ref)) {
          said.push(`#${ownerId} ${field} #${ref}, which is no longer on the board (archived/rejected?). Fix it with \`update ${ownerId}\`.`)
        }
      }
    }
  }
  return said
}

export function reconcileBoard() {
  if (!fs.existsSync(README)) return
  for (const line of [...readmeComplaints(true), ...crossRefComplaints()]) warn(line)
}

/** Everything the board is inconsistent about right now, in the same words. Reads only —
 *  nothing is repaired and nothing is warned — so it is safe to ask from a watcher that has
 *  already let go of the board's shared files. Empty when the board holds together. */
export function boardComplaints(): string[] {
  if (!fs.existsSync(README)) return []
  try {
    return [...readmeComplaints(false), ...crossRefComplaints()]
  } catch {
    // A board nobody can read is not a complaint this can make sense of, and the run it
    // followed is over either way.
    return []
  }
}
