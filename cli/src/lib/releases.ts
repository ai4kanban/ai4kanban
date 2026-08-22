// ---- the release list ------------------------------------------------------
//
// docs/kanban/releases.md holds the open releases, one line each, in the order they ship.
// A card names one of them in its `release` field; a card that names none is in no
// release — its field is empty.
//
// Closing a release takes its line away (git tags remember what already shipped), so the
// file stays a line or two long. That is why this module only reads the list and appends
// to it: reordering or renaming is an edit of two lines, which a person does faster than
// any command. A version id is never parsed for meaning — it is a name, kept as typed, and
// the ship order is the order of the lines.
//
// A release also says what it is for (#164): the goal sits on the same line, after the em
// dash — `- **v1** — the first version worth showing someone`. One line per release stays
// true, so a goal typed over several lines is folded into one before it is written, and a
// line with nothing after the id is a release with no goal, which every command works over.

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, KANBAN, TODO, ARCHIVE, RELEASES, RELEASE_SUMMARIES } from './paths'
import { formatDay } from './cadence'
import { walkMd, idPrefix } from './cards'
import { parseFrontmatter, serializeFrontmatter } from './frontmatter'
import { NO_RELEASE, normalizeRelease } from './validate'
import { recordFact } from './record'
import type { FlagValue } from './types'

// One release as the list carries it: its id, and what it is for.
export interface ReleaseEntry {
  id: string
  goal: string
}

// One card as the release commands read it — enough to count it, list it and move it.
export interface CardRow {
  id: number
  file: string
  title: string
  track: string
  priority: string
  release: string
  ready: boolean
  done: boolean
  blockedBy: number[]
  root: boolean
  recurring: boolean
}

// A card the fill left out, with the test it failed.
export type SkippedCard = CardRow & { reason: string }

// The line a fresh list carries instead of releases. Appending removes it.
const EMPTY_MARK = '_(no releases yet — `release new v1` makes the first one.)_'

const TEMPLATE = `# Releases

The versions this board is planning, in the order they ship — one line per release.
\`release new <id>\` adds one to the end. Closing a release takes its line away, so this
file only ever shows what is still ahead.

A card says which release it ships in. A card that says nothing is in no release —
wanted, but not promised to a version.

The order is whatever the lines say, so a hand edit is how you reorder. What comes after
the em dash is the release's goal — what this version is for, in your own words.

${EMPTY_MARK}
`

// `release new` refuses a space, but a hand-edited line can hold one — so an id we print
// inside a command someone is meant to retype gets quoted when it does.
export const quoteId = (id: string): string => (/\s/.test(id) ? `"${id}"` : id)

// A version id is free text — `v1`, `0.5.0`, `august` — but closing a release writes a
// summary file named after it, so it has to be usable as a filename: letters, numbers,
// dot, dash and underscore, and never `.` or `..`.
const ID_RE = /^[A-Za-z0-9._-]+$/

// The words are written for whoever is naming the release, wherever they are doing it — a
// terminal or a box in a dialog. Neither can be told to go run the other one's command.
function validNewId(raw: FlagValue | undefined): string {
  const id = String(raw === true ? '' : (raw ?? '')).trim()
  if (!id) die('a release needs a version id, like v1 or 0.5.0')
  if (id === '.' || id === '..') die(`"${id}" names a folder, not a version — pick a version id, like v1.`)
  if (!ID_RE.test(id)) {
    die(
      `a version id can only hold letters, numbers, dot, dash and underscore (you typed "${id}") — ` +
        `closing a release writes a file named after it.`,
    )
  }
  return id
}

// The release one line of the file names and what it says that release is for, or null
// when the line isn't a release at all. Every shape a line can take is read: `- **v1** —
// what it is for` (what the script writes), `- **v1**` (a release with no goal) and a bare
// `- v1` (what a hand edit leaves). Only the FIRST em dash splits the line, so a goal that
// holds one of its own reads back whole.
function lineEntry(line: string): ReleaseEntry | null {
  const m = line.match(/^\s*[-*]\s+(.*)$/)
  if (!m) return null
  const cut = m[1]!.indexOf('—')
  const head = (cut === -1 ? m[1]! : m[1]!.slice(0, cut)).trim()
  const goal = cut === -1 ? '' : m[1]!.slice(cut + 1).trim()
  const bold = head.match(/^\*\*(.+?)\*\*$/)
  const id = (bold ? bold[1]! : head).trim()
  return id ? { id, goal } : null
}

const lineId = (line: string): string | null => lineEntry(line)?.id || null

// A goal as it goes on disk: one line, whatever the user typed. Line breaks and runs of
// spaces fold into single spaces, so the file's shape never depends on how the goal was
// typed into a box. Empty is a release with no goal — always allowed.
export function foldGoal(raw: FlagValue | undefined): string {
  return String(raw === true ? '' : (raw ?? '')).replace(/\s+/g, ' ').trim()
}

// The line the file carries for one release. No goal, no em dash — an older line and a
// hand-written one look the same as what this writes.
const releaseLine = (id: string, goal: string): string => `- **${id}**${goal ? ` — ${goal}` : ''}`

// Every release on the list with its goal, in file order. A missing file reads as an empty
// list, so a board that never planned a version keeps working.
export function readReleaseEntries(): ReleaseEntry[] {
  if (!fs.existsSync(RELEASES)) return []
  const out: ReleaseEntry[] = []
  for (const line of fs.readFileSync(RELEASES, 'utf8').split('\n')) {
    const entry = lineEntry(line)
    // A duplicate can only come from a hand edit; the first line wins so the order holds.
    if (entry && !out.some((e) => e.id === entry.id)) out.push(entry)
  }
  return out
}

// Every release on the list, in file order — ids only, which is what most callers want.
export const readReleases = () => readReleaseEntries().map((e) => e.id)

// What one release is for, or '' when it has no goal (or isn't on the list).
export function releaseGoal(id: string): string {
  const entry = readReleaseEntries().find((e) => e.id === id)
  return entry ? entry.goal : ''
}

export function hasReleaseList(): boolean {
  return fs.existsSync(RELEASES)
}

// Seed the list. Same contract as the module map: idempotent, and it never touches a file
// that's already there, so `init` can double as the repair step for an older board.
export function writeReleasesIfMissing(): boolean {
  if (fs.existsSync(RELEASES)) return false
  fs.mkdirSync(KANBAN, { recursive: true })
  fs.writeFileSync(RELEASES, TEMPLATE)
  return true
}

// Add one release to the end of the list, with the goal it was made for (empty is fine —
// a goal is never required). Returns the id as written.
export function addRelease(raw: FlagValue | undefined, rawGoal: FlagValue | undefined): string {
  const id = validNewId(raw)
  const goal = foldGoal(rawGoal)
  writeReleasesIfMissing()
  const known = readReleases()
  if (known.includes(id)) die(`"${id}" is already on the list in ${rel(RELEASES)} — releases are ${known.join(', ')}`)
  const lines = fs
    .readFileSync(RELEASES, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== EMPTY_MARK)
  while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop()
  // The new line joins the list at the end: straight after the last release, or after a
  // blank line when this is the first one.
  if (!/^\s*[-*]\s+/.test(lines[lines.length - 1] || '')) lines.push('')
  lines.push(releaseLine(id, goal))
  fs.writeFileSync(RELEASES, lines.join('\n') + '\n')
  return id
}

// Change what a release is for, after it was made. An empty goal clears it — a release
// with no goal is a state the board supports, so unsaying it has to be possible too.
// Rewriting the line normalizes it, so a hand-written `- v1` comes back as `- **v1**`.
export function setReleaseGoal(id: string, rawGoal: FlagValue | undefined): { id: string; goal: string } {
  const goal = foldGoal(rawGoal)
  const known = readReleases()
  if (!known.includes(id)) {
    die(
      `unknown release "${id}". releases on the list: ${known.join(', ') || '(none)'}. ` +
        `Add it with \`release new ${quoteId(id)}\`.`,
      { kind: 'unknown-release', release: id, known },
    )
  }
  const lines = fs.readFileSync(RELEASES, 'utf8').split('\n')
  let done = false
  const kept = lines.map((line) => {
    if (done || lineId(line) !== id) return line
    done = true
    return releaseLine(id, goal)
  })
  fs.writeFileSync(RELEASES, kept.join('\n'))
  return { id, goal }
}

// A card's `--release` must name a release on the list (or be empty — no release). A
// typo has to fail loudly — quietly inventing a version is how work goes missing.
export function validRelease(id: string): string {
  if (id === NO_RELEASE) return id
  if (!hasReleaseList()) {
    die(`--release ${id}: this board has no releases yet. Make one first: \`release new ${quoteId(id)}\`.`)
  }
  const known = readReleases()
  if (!known.includes(id)) {
    die(
      `unknown release "${id}". releases on the list: ${known.join(', ') || '(none)'}. ` +
        `Add it with \`release new ${quoteId(id)}\`, or leave the card in no release (--release "").`,
      { kind: 'unknown-release', release: id, known },
    )
  }
  return id
}

// A checkbox line in a card's body, ticked or not: `- [ ]`, `* [x]`, `+ []`.
const TODO_LINE = /^[ \t]*[-*+][ \t]*\[([ xX]?)\]/

// True when the card has todos and every one is ticked. Such a card looks finished but is
// still open — only `archive` says a card shipped — so a close names it instead of quietly
// counting it as a leftover.
function allTicked(body: string): boolean {
  let total = 0
  let ticked = 0
  for (const line of body.split('\n')) {
    const m = line.match(TODO_LINE)
    if (!m) continue
    total++
    if (m[1] !== ' ' && m[1] !== '') ticked++
  }
  return total > 0 && ticked === total
}

// Every card under `dir`, with the release it names. A group root and each of its subtasks
// answer for themselves — the root is a tracking card, so a subtask counts under the
// release it names itself. A card with no frontmatter yet counts as in no release, so
// nothing goes missing from the totals.
function cardRows(dir: string): CardRow[] {
  if (!fs.existsSync(dir)) return []
  const rows: CardRow[] = []
  for (const file of walkMd(dir)) {
    const base = path.basename(file)
    if (base === 'README.md') continue
    const id = base === 'root.md' ? idPrefix(path.basename(path.dirname(file))) : idPrefix(base)
    if (id == null) continue
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    rows.push({
      id,
      file,
      // A card the script never wrote may have no title — its filename says enough.
      title: (meta && meta.title) || base.replace(/^\d+-/, '').replace(/\.md$/, ''),
      track: (meta && meta.track) || '',
      priority: (meta && meta.priority) || '',
      release: normalizeRelease(meta && meta.release),
      ready: Boolean(meta) && meta!.status === 'ready',
      done: allTicked(body),
      blockedBy: (meta && meta.blocked_by) || [],
      root: base === 'root.md',
      recurring: path.relative(dir, file).split(path.sep)[0] === 'recurring',
    })
  }
  return rows.sort((a, b) => a.id - b.id)
}

export const openCards = () => cardRows(TODO)

// The finished cards. Archiving keeps a card's `release` field, so the archive is what says
// which cards a version actually shipped.
export const archivedCards = () => cardRows(ARCHIVE)

// release id → { cards, ready }, counting the open board only. What a release already
// shipped is written down when it closes, not counted here.
export function countByRelease(): Map<string, { cards: number; ready: number }> {
  const counts = new Map<string, { cards: number; ready: number }>()
  for (const card of openCards()) {
    const c = counts.get(card.release) || { cards: 0, ready: 0 }
    c.cards++
    if (card.ready) c.ready++
    counts.set(card.release, c)
  }
  return counts
}

// ---- filling a new release ---------------------------------------------------
//
// `release new <id> --fill` (and the New release dialog's No goal tab) puts the high-priority
// cards in no release into the release the moment it is made. The fill is a rule, not
// a judgment call — a card goes in on three tests: its priority is high, nothing open is
// blocking it, and it is not a group root. Nothing else is looked at. It only ever adds:
// a card already in a release stays where it is.

// The cards the fill would move, and the high-priority cards it would leave out, each
// with the test it failed — so a report can name them and nothing is dropped silently.
export function fillCandidates(): { fill: CardRow[]; skipped: SkippedCard[] } {
  const cards = openCards()
  const byId = new Map(cards.map((c) => [c.id, c]))
  const fill: CardRow[] = []
  const skipped: SkippedCard[] = []
  for (const card of cards) {
    if (card.release !== NO_RELEASE || card.priority !== 'high') continue
    if (card.root) {
      skipped.push({ ...card, reason: 'a group root — each subtask goes in on its own' })
      continue
    }
    // Blocked means blocked by a card that is still open. An id no longer on the board
    // was archived or rejected, so that work is done; a recurring card never closes and
    // a card can't block itself, so neither counts.
    const blockers = card.blockedBy
      .filter((n) => n !== card.id)
      .map((n) => byId.get(n))
      .filter((b): b is CardRow => Boolean(b) && !b!.recurring)
    if (blockers.length) {
      skipped.push({ ...card, reason: `blocked by ${blockers.map((b) => `#${b.id}`).join(', ')}, still open` })
      continue
    }
    fill.push(card)
  }
  return { fill, skipped }
}

// Move every candidate into release `id`. Returns what moved and what stayed, with why.
export function fillRelease(id: string): { fill: CardRow[]; skipped: SkippedCard[] } {
  const { fill, skipped } = fillCandidates()
  for (const card of fill) setCardRelease(card.file, id)
  return { fill, skipped }
}

// ---- closing a release -----------------------------------------------------
//
// A version ships and the board moves on: write down what the release held, clear the
// release off the cards that didn't make it, and take the line off the list. Closing is always
// allowed — a version ships when the user says it ships — and there is no second run: after
// it, the id is unknown and no card names it.

export const summaryPath = (id: string): string => path.join(RELEASE_SUMMARIES, `${id}.md`)

const today = () => formatDay()

// Rewrite one card's release field — the fill moves a card in with it, and a close clears
// the leftovers' field the same way.
function setCardRelease(file: string, release: string): boolean {
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) return false
  meta.release = release
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  return true
}

// A group root's release is the whole group's. Setting it writes the same release down
// every card inside the folder — each subtask, and each subtask of a nested group, all
// the way down — and clearing it clears them the same way. A group is one piece of work
// split up: a root promised to a version whose subtasks name nothing would leave the real
// work out of it, and the subtasks are what `release list` counts and what a close reads.
//
// Only cards move. A file in the folder that isn't a card — a sibling doc, a README, a
// file with no frontmatter — has no release field and is left alone. The root itself is
// skipped: its caller has just written it.
export function setSubtreeRelease(dir: string, release: string): number[] {
  const root = path.join(dir, 'root.md')
  const changed: number[] = []
  for (const file of walkMd(dir)) {
    const base = path.basename(file)
    if (base === 'README.md' || file === root) continue
    const id = base === 'root.md' ? idPrefix(path.basename(path.dirname(file))) : idPrefix(base)
    if (id == null) continue
    if (setCardRelease(file, release)) changed.push(id)
  }
  return changed.sort((a, b) => a - b)
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

const cardLine = (card: CardRow): string => `- #${card.id} ${card.title}${card.track ? ` (${card.track})` : ''}`

// The line for a card that was still open — the ticked-but-never-archived marker only
// makes sense there, so an archived card's line never carries it.
const openCardLine = (card: CardRow): string => cardLine(card) + (card.done ? ' — every todo ticked, never archived' : '')

// One dated section per close. A version id can be made again after it was closed, so a
// second close appends instead of writing over: the first version's record is the only one
// there is.
function writeSummary(id: string, shipped: CardRow[], left: CardRow[], goal: string): string {
  fs.mkdirSync(RELEASE_SUMMARIES, { recursive: true })
  const file = summaryPath(id)
  const out: string[] = []
  out.push(`## Closed ${today()}`)
  out.push('')
  // The goal comes first and only when there is one: the line in releases.md is about to
  // go, so this becomes the only record of what the version was for.
  if (goal) {
    out.push(`What it was for — ${goal}`)
    out.push('')
  }
  out.push(
    shipped.length
      ? `Shipped — ${plural(shipped.length, 'card')}, archived while naming \`${id}\`:`
      : 'Shipped — nothing was archived under this release.',
  )
  if (shipped.length) {
    out.push('')
    for (const card of shipped) out.push(cardLine(card))
  }
  out.push('')
  out.push(
    left.length
      ? `Sent back with no release — ${plural(left.length, 'card')} still open when it closed:`
      : 'Sent back with no release — nothing was still open.',
  )
  if (left.length) {
    out.push('')
    for (const card of left) out.push(openCardLine(card))
  }
  if (left.some((c) => c.done)) {
    out.push('')
    out.push(
      'A card marked *every todo ticked, never archived* may really have shipped. Archive it, ' +
        'then move its line up by hand — closing again cannot fix it.',
    )
  }
  out.push('')
  const section = out.join('\n')
  if (fs.existsSync(file)) fs.appendFileSync(file, `\n${section}`)
  else fs.writeFileSync(file, `${HEADING(id)}\n${section}`)
  return file
}

const HEADING = (id: string): string => `# ${id}

What each close of this release left behind: a changelog an agent wrote from the cards, and
the cards themselves. A change that never went through the board is in neither — only a
person can add that.
`

// The ids an earlier close of this id already accounted for. Legacy summaries may also
// contain `Archived under` lists written by drops before #166; keep reading those so an
// existing board's later close behaves as it did before. A version id can be made again,
// and an archived card keeps naming it forever — without this, closing the second `v1`
// would claim the first one's cards shipped all over again. A line moved into either list
// by hand counts as well; that hand fix is how a missed card gets there. `Sent back` cards
// are NOT counted: they left the version still open, so if one later joins the remade
// version and really ships, the close may claim it.
function alreadyCounted(file: string): Set<number> {
  if (!fs.existsSync(file)) return new Set<number>()
  const ids = new Set<number>()
  let counting = false
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('Shipped —') || line.startsWith('Archived under')) counting = true
    else if (line.startsWith('Sent back') || line.startsWith('## ')) counting = false
    const m = counting && line.match(/^-\s+#(\d+)\b/)
    if (m) ids.add(Number(m[1]))
  }
  return ids
}

// The cards an ending reports, whichever way the release ends: the ones archived under it
// (minus what an earlier close or legacy drop of the same id already listed), and the ones
// still open. Subtasks answer for themselves, like everywhere else releases are counted.
// Read before anything is written, so a confirm dialog can show the move first.
export function endingCards(id: string): { archived: CardRow[]; left: CardRow[] } {
  const counted = alreadyCounted(summaryPath(id))
  return {
    archived: archivedCards().filter((c) => c.release === id && !counted.has(c.id)),
    left: openCards().filter((c) => c.release === id),
  }
}

// Take the release off the list. When the last one goes the file gets its empty line back,
// so it reads the way a fresh one does instead of ending in a stray blank.
function removeReleaseLine(id: string): void {
  const kept: string[] = []
  let dropped = false
  for (const line of fs.readFileSync(RELEASES, 'utf8').split('\n')) {
    if (!dropped && lineId(line) === id) {
      dropped = true
      continue
    }
    kept.push(line)
  }
  while (kept.length && !kept[kept.length - 1]!.trim()) kept.pop()
  if (!kept.some((line) => lineId(line))) kept.push('', EMPTY_MARK)
  fs.writeFileSync(RELEASES, kept.join('\n') + '\n')
}

export function closeRelease(raw: FlagValue | undefined) {
  const id = String(raw === true ? '' : (raw ?? '')).trim()
  if (!id) die('release close needs a version id, e.g. `release close v1`')
  const known = readReleases()
  if (!known.includes(id)) {
    die(
      `unknown release "${id}". releases on the list: ${known.join(', ') || '(none)'}. ` +
        `A closed release is off the list for good — plan the next version with \`release new <id>\`.`,
      { kind: 'unknown-release', release: id, known },
    )
  }
  const { archived: shipped, left } = endingCards(id)
  // Read while the line is still there — removing it is the last step below.
  const goal = releaseGoal(id)
  // The summary is written first: it is the only record of what the version was meant to
  // hold, and the next step is what erases that from the cards.
  const summary = writeSummary(id, shipped, left, goal)
  // The field is cleared: the work is not promised to a version nobody has picked yet.
  for (const card of left) setCardRelease(card.file, NO_RELEASE)
  removeReleaseLine(id)
  // The boundary in the board's own record: everything counted before this line belongs to
  // the version that just shipped. Its place in the file is what separates one version from
  // the next, so two closed on the same day are still told apart.
  recordFact('release-closed', null, id)
  return { id, shipped, left, summary, remaining: readReleases() }
}

// ---- dropping a release ----------------------------------------------------
//
// The team gives up on a version: it comes off the list without a shipped record. The
// open cards' release field is cleared exactly as a close clears it — the work is no
// longer promised to a version. Nothing is written to the release summaries: a release
// that never shipped leaves no release record behind, and a summary left by an earlier
// close of a reused id stays byte-for-byte unchanged.

export function dropRelease(raw: FlagValue | undefined) {
  const id = String(raw === true ? '' : (raw ?? '')).trim()
  if (!id) die('release drop needs a version id, e.g. `release drop v1`')
  const known = readReleases()
  if (!known.includes(id)) {
    die(
      `unknown release "${id}". releases on the list: ${known.join(', ') || '(none)'}. ` +
        `A dropped release is off the list for good — only a release on the list can be dropped.`,
      { kind: 'unknown-release', release: id, known },
    )
  }
  // Cards an earlier close (or a legacy pre-#166 drop) already listed stay theirs, so the
  // on-screen report names only what this incarnation of the release held.
  const { archived, left } = endingCards(id)
  for (const card of left) setCardRelease(card.file, NO_RELEASE)
  removeReleaseLine(id)
  return { id, archived, left, remaining: readReleases() }
}

// ---- the changelog -----------------------------------------------------------
//
// A close writes down which cards shipped. That is a list of ids and titles, and nobody
// reads it to find out what the version changed — so an agent writes a short changelog
// from it, in plain words, and it goes at the top of the section the close just wrote.
//
// The changelog is a `###` section of its own inside the dated one. That heading is what
// makes a second run a rewrite rather than a second changelog: without it nothing in the
// file marks where the changelog ends and the card list begins.
//
// It ends where the bullets end. Everything the changelog holds is a `- ` line, and
// everything after it — `What it was for`, `Shipped`, `Sent back` — is prose, so the first
// line that is neither blank nor a bullet closes the block. `writeChangelog` is the only
// writer, and it refuses anything that isn't bullets, which is what keeps that true.

/** The heading the changelog lives under, inside the dated section. */
export const CHANGELOG_HEADING = '### What changed'

/** The most lines a changelog may carry. Longer than this and it is the card list again. */
export const CHANGELOG_MAX_LINES = 6

const CLOSED_RE = /^##\s+Closed\b/
const GOAL_PREFIX = 'What it was for — '

/** The newest `## Closed` section of one version's summary file — everything a changelog is
 *  written from, and whether one is there already. */
export interface ClosedRecord {
  /** The summary file, repo-relative. */
  file: string
  /** The section's own heading line, e.g. `## Closed 2026-08-22`. */
  heading: string
  /** What the version was for, or '' when the release had no goal. */
  goal: string
  /** The cards that section records as shipped, one line each, as written. */
  shipped: string[]
  /** A changelog is already under the heading, so a run rewrites it. */
  hasChangelog: boolean
}

// Where the newest dated section starts and ends. A version id can be made again, so a
// summary file may hold several — the last one is the close that just happened.
function newestSection(lines: string[]): { start: number; end: number } | null {
  let start = -1
  for (let i = 0; i < lines.length; i++) if (CLOSED_RE.test(lines[i]!)) start = i
  if (start < 0) return null
  let end = start + 1
  while (end < lines.length && !/^##\s/.test(lines[end]!)) end++
  return { start, end }
}

/** Read the newest close of one version, or null when the board holds no closed record of
 *  it. Read straight off the file the close wrote: the release is off the list by then, so
 *  the section is the only place its goal survives. */
export function readNewestClose(id: string): ClosedRecord | null {
  const file = summaryPath(id)
  if (!fs.existsSync(file)) return null
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const at = newestSection(lines)
  if (!at) return null
  const body = lines.slice(at.start, at.end)
  const goalLine = body.find((l) => l.startsWith(GOAL_PREFIX))
  const shipped: string[] = []
  let counting = false
  for (const line of body) {
    if (line.startsWith('Shipped —')) counting = true
    else if (line.startsWith('Sent back')) counting = false
    if (counting && /^-\s+#\d+\b/.test(line)) shipped.push(line.replace(/^-\s+/, '').trim())
  }
  return {
    file: rel(file),
    heading: lines[at.start]!.trim(),
    goal: goalLine ? goalLine.slice(GOAL_PREFIX.length).trim() : '',
    shipped,
    hasChangelog: body.some((l) => l.trim() === CHANGELOG_HEADING),
  }
}

/** Why no changelog can be written for this version, in one line, or nothing when one can.
 *  Asked before a run starts and again by the write, so neither can act on a version the
 *  other would have refused. */
export function changelogRefusal(id: string): string | undefined {
  const record = readNewestClose(id)
  if (!record) {
    return (
      `this board holds no closed record of "${id}" — a changelog is written from what a close wrote down. ` +
      `Close the version first with \`release close ${quoteId(id)}\`.`
    )
  }
  if (!record.shipped.length) {
    return `"${id}" shipped no card, so there is nothing to write a changelog from.`
  }
  return undefined
}

// The lines a changelog is written as: bullets, and nothing else. A heading the agent wrote
// for itself is dropped rather than refused — the move owns the heading, and two of them
// stacked would read as an empty section.
function readChangelogLines(raw: string): string[] {
  const lines = raw
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l !== CHANGELOG_HEADING)
  if (!lines.length) die('the changelog is empty — write one line for each thing the user can now see or do')
  const bullets = lines.map((l) => (/^[-*]\s+/.test(l) ? `- ${l.replace(/^[-*]\s+/, '')}` : `- ${l}`))
  if (bullets.length > CHANGELOG_MAX_LINES) {
    die(
      `a changelog is ${CHANGELOG_MAX_LINES} lines at most (got ${bullets.length}) — ` +
        `keep the ones a user would notice and drop the rest.`,
    )
  }
  return bullets
}

/** Put the changelog at the top of the newest dated section: over the one already there, or
 *  under a heading of its own directly below the section's heading. Every other byte of the
 *  file is left as it was. */
export function writeChangelog(id: string, raw: string): { file: string; lines: string[]; replaced: boolean } {
  const refusal = changelogRefusal(id)
  if (refusal) die(refusal, { kind: 'no-changelog', release: id })
  const bullets = readChangelogLines(raw)
  const file = summaryPath(id)
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const at = newestSection(lines)!
  const block = [CHANGELOG_HEADING, '', ...bullets]
  const found = lines.findIndex((l, i) => i > at.start && i < at.end && l.trim() === CHANGELOG_HEADING)
  let next: string[]
  if (found < 0) {
    next = [...lines.slice(0, at.start + 1), '', ...block, ...lines.slice(at.start + 1)]
  } else {
    // From its heading to the first line that is neither blank nor a bullet — that span is
    // the changelog's, and only that span.
    let end = found + 1
    while (end < at.end && (!lines[end]!.trim() || /^[-*]\s+/.test(lines[end]!.trim()))) end++
    next = [...lines.slice(0, found), ...block, '', ...lines.slice(end)]
  }
  fs.writeFileSync(file, next.join('\n'))
  return { file: rel(file), lines: bullets, replaced: found >= 0 }
}
