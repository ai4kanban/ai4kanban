// ---- setup's own two answers -----------------------------------------------
//
// What the project is, and what tracks its work falls into. Both live in
// `docs/kanban/config.md`, and both are things only the user knows — the repo can suggest a
// name, nothing can suggest what the project is for or what buckets its work falls into. So
// a guided first run asks, and this reads and writes the two bullets it asks about. Every
// other bullet in that file is left exactly as found, placeholders included: the rest of
// the config is read from the repo by an agent, on setup's own `config` step.
//
// Tracks are folders as well as words. A track the user adds gets its folder under
// `docs/kanban/todo/` and its section in the board index; a track they drop loses both —
// but only while it is empty, since a folder with cards in it is work, not a setting.

import fs from 'node:fs'
import path from 'node:path'

import { trackNames } from '../cards'
import { die, CONFIG, MODULES_MD, README, REPO_ROOT, TODO } from '../paths'
import { readGoalText } from './goal'
import type { SaveProjectResult, SetupDraft, TrackDraft } from './types'

// A track name is a folder name, so it is held to what a folder can be. The two reserved
// names are the board's own: `blockers` gates the milestone and `recurring` holds the jobs
// that repeat, and neither is a track someone picked.
const TRACK_RE = /^[a-z0-9][a-z0-9-]*$/i
const RESERVED = ['blockers', 'recurring']

// The notes prefilled for the tracks a fresh board is scaffolded with. Only these: anything
// else is a name the user chose, and inventing a line about what it is for would put words
// in their mouth.
const DEFAULT_NOTES: Record<string, string> = {
  feature: 'new behavior a user can see.',
  features: 'new behavior a user can see.',
  bug: 'something that is broken.',
  bugs: 'something that is broken.',
  research: 'questions to answer before the work can be planned.',
}

// ---- reading ---------------------------------------------------------------

function readConfig(): string {
  try {
    return fs.readFileSync(CONFIG, 'utf8')
  } catch {
    return ''
  }
}

// A config value that is still `{{PLACEHOLDER}}` has never been answered — the template's
// own text, not the user's.
const unanswered = (value: string): boolean => !value || /\{\{[A-Z_]+\}\}/.test(value)

// One top-level bullet and everything indented under it: `- **Project** — …` plus its
// default note, the track list under `- **Tracks** — …`. The block ends at the next line
// that starts in column one, so a bullet can be replaced whole without disturbing what
// follows.
function bulletBlock(lines: string[], label: string): { start: number; end: number } | null {
  const start = lines.findIndex((l) => l.startsWith(`- **${label}**`))
  if (start === -1) return null
  let end = start + 1
  while (end < lines.length && /^\s+\S/.test(lines[end]!)) end++
  return { start, end }
}

/** The project's name and what it is, from the config. An unfilled bullet gives the repo's
 *  folder name and an empty line — the name is a fair guess, what it is for is not. */
export function readProject(): { name: string; description: string } {
  const fallback = { name: path.basename(REPO_ROOT), description: '' }
  const lines = readConfig().split('\n')
  const block = bulletBlock(lines, 'Project')
  if (!block) return fallback
  const value = lines[block.start]!.replace(/^- \*\*Project\*\*[ \t]*—[ \t]*/, '').trim()
  if (unanswered(value)) return fallback
  const at = value.indexOf(':')
  if (at === -1) return { name: value, description: '' }
  return { name: value.slice(0, at).trim(), description: value.slice(at + 1).trim() }
}

function readmeHeadings(): string[] {
  try {
    return fs
      .readFileSync(README, 'utf8')
      .split('\n')
      .map((l) => l.match(/^##\s+(.+?)\s*$/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => m[1]!)
  } catch {
    return []
  }
}

// The board's tracks (../cards.ts) minus the two the user never picked, in the board
// index's order where it says one. Setup asks about the tracks someone chose, so the two
// reserved folders are not among them — every other reader wants all of them.
function trackFolders(): string[] {
  const order = readmeHeadings()
  return trackNames()
    .filter((name) => !RESERVED.includes(name))
    .sort((a, b) => {
      const ia = order.indexOf(a)
      const ib = order.indexOf(b)
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib)
    })
}

// What each track is for, as the config's list has it: `- \`feature\` 45% — …`. The share
// is read past rather than kept — the flow doesn't ask for one, and a number nobody was
// asked for shouldn't come back on save.
function readTrackNotes(): Record<string, string> {
  const lines = readConfig().split('\n')
  const block = bulletBlock(lines, 'Tracks')
  const notes: Record<string, string> = {}
  if (!block) return notes
  for (const line of lines.slice(block.start + 1, block.end)) {
    const m = line.match(/^\s+-\s+`([^`]+)`(?:\s+\d+%)?\s*(?:—\s*(.*?))?\s*$/)
    if (m) notes[m[1]!] = (m[2] || '').trim()
  }
  return notes
}

export function readTracks(): TrackDraft[] {
  const notes = readTrackNotes()
  return trackFolders().map((name) => ({
    name,
    note: notes[name] ?? DEFAULT_NOTES[name] ?? '',
    was: name,
  }))
}

// Any `.md` at any depth — a card, a group root, a subtask.
function holdsCard(dir: string): boolean {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return false
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (holdsCard(path.join(dir, entry.name))) return true
    } else if (entry.name.endsWith('.md')) {
      return true
    }
  }
  return false
}

const isEmptyTrack = (name: string): boolean => !holdsCard(path.join(TODO, name))

// Which tracks hold cards right now. A folder with work in it can be renamed by hand, but
// the board must never delete it out from under the cards.
const usedTracks = (): string[] => trackFolders().filter((name) => !isEmptyTrack(name))

/** Everything a guided first run opens with, in one read. */
export function readSetupDraft(): SetupDraft {
  return { project: readProject(), tracks: readTracks(), usedTracks: usedTracks(), goal: readGoalText() }
}

/** The module names from `docs/kanban/modules.md` — the bolded name at the front of each
 *  `- **name** — …` line. That is what `--modules` takes and what a propose run focuses on.
 *  A missing or empty map reads as no modules. */
export function readModules(): string[] {
  let text: string
  try {
    text = fs.readFileSync(MODULES_MD, 'utf8')
  } catch {
    return []
  }
  const names: string[] = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s+\*\*(.+?)\*\*/)
    if (m) names.push(m[1]!.trim())
  }
  return names
}

// ---- writing ---------------------------------------------------------------

/**
 * Save the project and its tracks — setup's `project` step, in full.
 *
 * The two config bullets are rewritten and nothing else in that file is touched. Then the
 * folders are brought in line: a new track gets its folder and its section in the board
 * index, a dropped one loses both if it is empty and is kept if it isn't. Nothing that
 * holds a card is ever deleted.
 */
export function saveProject(name: string, description: string, tracks: TrackDraft[]): SaveProjectResult {
  const project = name.trim()
  if (!project) die('the project needs a name')

  const clean: TrackDraft[] = []
  const seen = new Set<string>()
  for (const track of tracks) {
    const id = track.name.trim().toLowerCase()
    if (!id) continue
    if (!TRACK_RE.test(id)) {
      die(`"${track.name}" can't be a track — a track is a folder, so use letters, digits and dashes`)
    }
    if (RESERVED.includes(id)) die(`"${id}" is the board's own folder, not a track you can name`)
    if (seen.has(id)) die(`"${id}" is listed twice`)
    seen.add(id)
    clean.push({ name: id, note: track.note.trim(), was: track.was })
  }
  if (clean.length === 0) die('a board needs at least one track')

  // The folders move first, then the config is written over the result — so a rename that
  // can't happen never leaves the config naming a folder that isn't there.
  const added: string[] = []
  const renamed: { from: string; to: string }[] = []
  const keptBecauseUsed: string[] = []
  for (const track of clean) {
    const from = track.was
    if (from && from !== track.name && fs.existsSync(path.join(TODO, from))) {
      if (fs.existsSync(path.join(TODO, track.name))) {
        die(`there is already a "${track.name}" track to move "${from}" onto`)
      }
      renameTrack(from, track.name)
      renamed.push({ from, to: track.name })
      continue
    }
    const dir = path.join(TODO, track.name)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      added.push(track.name)
    }
    addReadmeSection(track.name)
  }
  for (const gone of trackFolders().filter((t) => !seen.has(t))) {
    if (!isEmptyTrack(gone)) {
      keptBecauseUsed.push(gone)
      continue
    }
    fs.rmSync(path.join(TODO, gone), { recursive: true, force: true })
    dropReadmeSection(gone)
  }

  // A track kept because it holds cards is still a track, so it goes back into the config —
  // the file has to name the folders that exist.
  const notes = readTrackNotes()
  const written = [...clean, ...keptBecauseUsed.map((name) => ({ name, note: notes[name] ?? '' }))]
  writeConfigBullets(project, description.trim(), written)
  return { ok: true, added, renamed, keptBecauseUsed }
}

function cardFiles(dir: string): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  return entries.flatMap((entry) =>
    entry.isDirectory()
      ? cardFiles(path.join(dir, entry.name))
      : entry.name.endsWith('.md')
        ? [path.join(dir, entry.name)]
        : [],
  )
}

// Rename a track: the folder moves, the cards in it say the new name, and the board index
// follows — heading and links both. Setup-time work, and it shows: a subtask parked in a
// group folder is not in this folder and is not touched, which is right on a board that has
// no group tasks yet and is why `update --track` stays the way to move cards on a working
// board.
function renameTrack(from: string, to: string): void {
  fs.renameSync(path.join(TODO, from), path.join(TODO, to))
  for (const file of cardFiles(path.join(TODO, to))) {
    const text = fs.readFileSync(file, 'utf8')
    const next = text.replace(/^track:[ \t]*.*$/m, `track: ${to}`)
    if (next !== text) fs.writeFileSync(file, next)
  }
  if (!fs.existsSync(README)) return
  const lines = fs.readFileSync(README, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim().toLowerCase() === `## ${from}`.toLowerCase()) lines[i] = `## ${to}`
    else lines[i] = lines[i]!.split(`](${from}/`).join(`](${to}/`)
  }
  fs.writeFileSync(README, lines.join('\n'))
}

// A config written from nothing — only reached on a board whose config.md is missing, which
// `init` never leaves behind. It carries the two bullets this module owns and says where
// the rest comes from, rather than inventing the whole template the skill ships.
const CONFIG_HEADER = `# Configuration

This file adapts ai4kanban to your project. The board app writes the project and its
tracks; the rest is filled in from your repo on setup's \`config\` step.

`

// The two bullets, written over whatever was in their place — the template's
// `{{PLACEHOLDER}}` and its default note on a fresh board, the last answer on a second
// pass. A config missing the bullet gains it at the end rather than failing: the file is
// the user's and may have been rewritten by hand.
function writeConfigBullets(name: string, description: string, tracks: TrackDraft[]): void {
  const existing = fs.existsSync(CONFIG) ? fs.readFileSync(CONFIG, 'utf8') : CONFIG_HEADER
  let lines = existing.split('\n')
  lines = replaceBullet(lines, 'Project', [`- **Project** — ${description ? `${name}: ${description}` : name}`])
  lines = replaceBullet(lines, 'Tracks', [
    '- **Tracks** — the buckets a task can live in:',
    ...tracks.map((t) => `  - \`${t.name}\`${t.note ? ` — ${t.note}` : ''}`),
  ])
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true })
  fs.writeFileSync(CONFIG, lines.join('\n'))
}

function replaceBullet(lines: string[], label: string, replacement: string[]): string[] {
  const block = bulletBlock(lines, label)
  const out = [...lines]
  if (!block) {
    while (out.length && out[out.length - 1]!.trim() === '') out.pop()
    out.push(...replacement, '')
    return out
  }
  out.splice(block.start, block.end - block.start, ...replacement)
  return out
}

// The board index gains a section for a new track, so the file lists every track the board
// has. Written only when the heading is missing — an existing section holds cards.
function addReadmeSection(track: string): void {
  if (!fs.existsSync(README)) return
  const lines = fs.readFileSync(README, 'utf8').split('\n')
  if (lines.some((l) => l.trim().toLowerCase() === `## ${track}`.toLowerCase())) return
  while (lines.length && lines[lines.length - 1]!.trim() === '') lines.pop()
  lines.push('', `## ${track}`, '', '_(none)_', '')
  fs.writeFileSync(README, lines.join('\n'))
}

// …and loses it when the track goes. Only ever called for a track whose folder was empty,
// so the section it removes can hold nothing but the `_(none)_` placeholder.
function dropReadmeSection(track: string): void {
  if (!fs.existsSync(README)) return
  const lines = fs.readFileSync(README, 'utf8').split('\n')
  const start = lines.findIndex((l) => l.trim().toLowerCase() === `## ${track}`.toLowerCase())
  if (start === -1) return
  let end = start + 1
  while (end < lines.length && !/^##\s/.test(lines[end]!)) end++
  if (lines.slice(start + 1, end).some((l) => /^\s*-\s/.test(l))) return
  lines.splice(start, end - start)
  fs.writeFileSync(README, lines.join('\n'))
}
