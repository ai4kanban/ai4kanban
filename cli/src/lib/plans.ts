// Checkout-local plans, numbered with the board and addressed by stable logical paths.

import fs from 'node:fs'
import path from 'node:path'

import { PLANS, PLANS_ARCHIVE, KANBAN, boardPath, die, readNextId, writeNextId } from './paths'
import { legacyProjectStateDir } from './machine/project'
import { slugify } from './validate'

/** One plan file, as a screen draws it. `text` is empty for a path whose file is not there
 *  — a plan named the instant before it is first written, or one mid-rewrite. */
export interface PlanFile {
  /** Where it is, relative to the board folder — the path a card's `## Source` carries. */
  path: string
  text: string
  lines: number
}

/** The prefix of a plan already filed away (#551). */
const ARCHIVED = 'plans/archive/'

/** Whether a path names a plan that has been filed away. */
export const isArchivedPlan = (rel: string): boolean => rel.startsWith(ARCHIVED)

/** That path as an absolute one. Refuses anything that would climb out of `plans/`: the
 *  path reaches here off a conversation's own file, and a plan is only ever one file, in
 *  `plans/` while it is live and in `plans/archive/` once its cards are written. */
export function planFile(rel: string): string | null {
  if (!/^plans\/(archive\/)?[^/\\]+\.md$/.test(rel)) return null
  const dir = isArchivedPlan(rel) ? PLANS_ARCHIVE : PLANS
  const name = rel.replace(/^plans\/(archive\/)?/, '')
  if (!name || name.includes('/') || !name.endsWith('.md')) return null
  return path.join(dir, name)
}

/** Reserve one id; persistence happens through the saving command. */
export function newPlan(title: string, slug?: string): { id: number; path: string } {
  const name = title.trim()
  if (!name) die('--title must not be empty')
  const base = slugify(slug !== undefined ? slug : name)
  const id = readNextId()
  writeNextId(id + 1)
  return { id, path: `plans/${id}-${base}.md` }
}

/** One plan as it stands, or null when the path is not a plan of this board's.
 *
 *  A file that is not there is looked for under its id: an agent that retitles a plan tends
 *  to rename the file with it, and the id is the one part of the name that stays. The path
 *  answered is then the file's, so the screen and the run it hands off to follow the move. */
export function readPlan(rel: string): PlanFile | null {
  const file = planFile(rel)
  if (!file) return null
  let text = ''
  let found = rel
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    const moved = renamedPlan(rel)
    if (moved) {
      found = moved
      text = fs.readFileSync(planFile(moved) as string, 'utf8')
    }
    // Otherwise not written yet, or being rewritten this second. The caller draws the path
    // and whatever it last had, never a blank panel.
  }
  return { path: found, text, lines: text.trim() ? text.trimEnd().split('\n').length : 0 }
}

/** Drop one plan the board is done with, answering whether a file went. The path is followed
 *  through a rename the same way reading one is, and a file no longer there is nothing to do. */
export function dropPlan(rel: string): boolean {
  const file = planFile(rel)
  if (!file) return false
  const target = fs.existsSync(file) ? file : planFile(renamedPlan(rel) ?? '')
  if (!target) return false
  try {
    fs.rmSync(target)
    return true
  } catch {
    return false
  }
}

/** The file a missing plan is really in — the newest `<id>-*.md` under either folder. It
 *  follows a rename, and it follows the move into `plans/archive/`, so a card or a screen
 *  holding the old path still reaches the file (#551). */
function renamedPlan(rel: string): string | null {
  const id = /^(\d+)-/.exec(rel.replace(/^plans\/(archive\/)?/, ''))?.[1]
  if (!id) return null
  const found: { rel: string; at: number }[] = []
  for (const [dir, prefix] of [
    [PLANS, 'plans/'],
    [PLANS_ARCHIVE, ARCHIVED],
  ] as const) {
    let names: string[]
    try {
      names = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const n of names) {
      if (!n.startsWith(`${id}-`) || !n.endsWith('.md')) continue
      found.push({ rel: `${prefix}${n}`, at: fs.statSync(path.join(dir, n)).mtimeMs })
    }
  }
  if (!found.length) return null
  return found.sort((a, b) => b.at - a.at)[0]!.rel
}

/** File one plan away: its run has written its cards, so it moves to `plans/archive/` and
 *  the path answered is what those cards should name in `## Source` (#551).
 *
 *  A plan already filed, or one whose file is no longer there, answers its own path — the
 *  move is done, or there is nothing to move, and either way the caller has nothing to
 *  repoint. Null only when the path is not a plan of this board's. */
export function archivePlan(rel: string): string | null {
  const found = readPlan(rel)
  if (!found) return null
  if (isArchivedPlan(found.path)) return found.path
  const from = planFile(found.path)
  if (!from || !fs.existsSync(from)) return found.path
  const name = path.basename(from)
  try {
    fs.mkdirSync(PLANS_ARCHIVE, { recursive: true })
    fs.renameSync(from, path.join(PLANS_ARCHIVE, name))
  } catch {
    // Left where it is — the cards go on naming a path that still reads, and the next pass
    // over this discussion tries the move again.
    return found.path
  }
  return `${ARCHIVED}${name}`
}

/** An absolute plan path for agents and source references. */
export const planPathInText = (rel: string): string => planFile(rel) ?? rel

/** The board-relative path behind one spelled that way, or null when it is not a plan of
 *  this board's. A run carries the spelled form (`AgentRequest.plan`), and reading the file
 *  it names has to start from a path `planFile` will take. */
export function planFromText(text: string): string | null {
  const legacy = `${legacyProjectStateDir(KANBAN)}/`
  if (text.startsWith(legacy)) text = text.slice(legacy.length)
  const local = `${path.dirname(PLANS)}/`
  if (text.startsWith(local)) text = text.slice(local.length)
  if (text.startsWith(`${KANBAN}/`)) text = text.slice(KANBAN.length + 1)
  const here = `${boardPath()}/`
  const rel = text.startsWith(here) ? text.slice(here.length) : text
  return planFile(rel) ? rel : null
}

/** What a plan is called: its first heading, or its first line when it has none. Empty for a
 *  file with nothing written in it yet — the caller refuses such a plan rather than opening
 *  an untitled delivery on it. */
export function planTitle(text: string): string {
  for (const line of text.split('\n')) {
    const words = line.trim()
    if (!words) continue
    return words.replace(/^#+\s*/, '').trim()
  }
  return ''
}
