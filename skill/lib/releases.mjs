// ---- the release list ------------------------------------------------------
//
// docs/kanban/releases.md holds the open releases, one line each, in the order they ship.
// A card names one of them in its `release` field; a card that names none sits at `next`,
// which is always last and is never written down.
//
// Closing a release takes its line away (git tags remember what already shipped), so the
// file stays a line or two long. That is why this module only reads the list and appends
// to it: reordering or renaming is an edit of two lines, which a person does faster than
// any command. A version id is never parsed for meaning — it is a name, kept as typed, and
// the ship order is the order of the lines.

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, KANBAN, TODO, ARCHIVE, RELEASES, RELEASE_SUMMARIES } from './paths.mjs'
import { walkMd, idPrefix } from './cards.mjs'
import { parseFrontmatter, serializeFrontmatter } from './frontmatter.mjs'
import { DEFAULT_RELEASE, normalizeRelease } from './validate.mjs'

// The line a fresh list carries instead of releases. Appending removes it.
const EMPTY_MARK = '_(no releases yet — `release new v1` makes the first one.)_'

const TEMPLATE = `# Releases

The versions this board is planning, in the order they ship — one line per release.
\`release new <id>\` adds one to the end. Closing a release takes its line away, so this
file only ever shows what is still ahead.

A card says which release it ships in. A card that says nothing sits at \`next\` — wanted,
but not promised to a version. \`next\` is always last and is never written here.

The order is whatever the lines say, so a hand edit is how you reorder. A note after the
version id is yours to write; nothing reads it.

${EMPTY_MARK}
`

// `release new` refuses a space, but a hand-edited line can hold one — so an id we print
// inside a command someone is meant to retype gets quoted when it does.
export const quoteId = (id) => (/\s/.test(id) ? `"${id}"` : id)

// A version id is free text — `v1`, `0.5.0`, `august` — but closing a release writes a
// summary file named after it, so it has to be usable as a filename: letters, numbers,
// dot, dash and underscore, and never `.` or `..`.
const ID_RE = /^[A-Za-z0-9._-]+$/

function validNewId(raw) {
  const id = String(raw === true ? '' : (raw ?? '')).trim()
  if (!id) die('release new needs a version id, e.g. `release new v1`')
  if (id.toLowerCase() === DEFAULT_RELEASE) {
    die(
      `"${DEFAULT_RELEASE}" is where a card with no release sits — it is always last and is ` +
        `never written down. Pick a version id, e.g. \`release new v1\`.`,
    )
  }
  if (id === '.' || id === '..') die(`"${id}" names a folder, not a release — pick a version id, e.g. \`release new v1\``)
  if (!ID_RE.test(id)) {
    die(
      `a version id can only hold letters, numbers, dot, dash and underscore (got "${id}") — ` +
        `closing a release writes a file named after it.`,
    )
  }
  return id
}

// The release one line of the file names, or null when the line isn't a release at all.
// Both shapes a line can take are read: `- **v1** — a note` (what the script writes) and a
// bare `- v1` (what a hand edit leaves).
function lineId(line) {
  const m = line.match(/^\s*[-*]\s+(.*)$/)
  if (!m) return null
  const head = m[1].split('—')[0].trim()
  const bold = head.match(/^\*\*(.+?)\*\*$/)
  return (bold ? bold[1] : head).trim() || null
}

// Every release on the list, in file order. A missing file reads as an empty list, so a
// board that never planned a version keeps working.
export function readReleases() {
  if (!fs.existsSync(RELEASES)) return []
  const out = []
  for (const line of fs.readFileSync(RELEASES, 'utf8').split('\n')) {
    const id = lineId(line)
    // A duplicate can only come from a hand edit; the first line wins so the order holds.
    if (id && !out.includes(id)) out.push(id)
  }
  return out
}

export function hasReleaseList() {
  return fs.existsSync(RELEASES)
}

// Seed the list. Same contract as the module map: idempotent, and it never touches a file
// that's already there, so `init` can double as the repair step for an older board.
export function writeReleasesIfMissing() {
  if (fs.existsSync(RELEASES)) return false
  fs.mkdirSync(KANBAN, { recursive: true })
  fs.writeFileSync(RELEASES, TEMPLATE)
  return true
}

// Add one release to the end of the list. Returns the id as written.
export function addRelease(raw) {
  const id = validNewId(raw)
  writeReleasesIfMissing()
  const known = readReleases()
  if (known.includes(id)) die(`"${id}" is already on the list in ${rel(RELEASES)} — releases are ${known.join(', ')}`)
  const lines = fs
    .readFileSync(RELEASES, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== EMPTY_MARK)
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
  // The new line joins the list at the end: straight after the last release, or after a
  // blank line when this is the first one.
  if (!/^\s*[-*]\s+/.test(lines[lines.length - 1] || '')) lines.push('')
  lines.push(`- **${id}**`)
  fs.writeFileSync(RELEASES, lines.join('\n') + '\n')
  return id
}

// A card's `--release` must name a release on the list (or `next`, which never is). A
// typo has to fail loudly — quietly inventing a version is how work goes missing.
export function validRelease(id) {
  if (id === DEFAULT_RELEASE) return id
  if (!hasReleaseList()) {
    die(`--release ${id}: this board has no releases yet. Make one first: \`release new ${quoteId(id)}\`.`)
  }
  const known = readReleases()
  if (!known.includes(id)) {
    die(
      `unknown release "${id}". releases on the list: ${known.join(', ') || '(none)'}. ` +
        `Add it with \`release new ${quoteId(id)}\`, or leave the card at \`${DEFAULT_RELEASE}\`.`,
    )
  }
  return id
}

// A checkbox line in a card's body, ticked or not: `- [ ]`, `* [x]`, `+ []`.
const TODO_LINE = /^[ \t]*[-*+][ \t]*\[([ xX]?)\]/

// True when the card has todos and every one is ticked. Such a card looks finished but is
// still open — only `archive` says a card shipped — so a close names it instead of quietly
// counting it as a leftover.
function allTicked(body) {
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
// release it names itself. A card with no frontmatter yet counts at `next`, so nothing goes
// missing from the totals.
function cardRows(dir) {
  if (!fs.existsSync(dir)) return []
  const rows = []
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
      ready: Boolean(meta) && meta.status === 'ready',
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
export function countByRelease() {
  const counts = new Map()
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
// `release new <id> --fill` (and the New release dialog's toggle) puts the high-priority
// cards sitting at `next` into the release the moment it is made. The fill is a rule, not
// a judgment call — a card goes in on three tests: its priority is high, nothing open is
// blocking it, and it is not a group root. Nothing else is looked at. It only ever adds:
// a card already in a release stays where it is.

// The cards the fill would move, and the high-priority cards it would leave at `next`,
// each with the test it failed — so a report can name them and nothing is dropped silently.
export function fillCandidates() {
  const cards = openCards()
  const byId = new Map(cards.map((c) => [c.id, c]))
  const fill = []
  const skipped = []
  for (const card of cards) {
    if (card.release !== DEFAULT_RELEASE || card.priority !== 'high') continue
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
      .filter((b) => b && !b.recurring)
    if (blockers.length) {
      skipped.push({ ...card, reason: `blocked by ${blockers.map((b) => `#${b.id}`).join(', ')}, still open` })
      continue
    }
    fill.push(card)
  }
  return { fill, skipped }
}

// Move every candidate into release `id`. Returns what moved and what stayed, with why.
export function fillRelease(id) {
  const { fill, skipped } = fillCandidates()
  for (const card of fill) setCardRelease(card.file, id)
  return { fill, skipped }
}

// ---- closing a release -----------------------------------------------------
//
// A version ships and the board moves on: write down what the release held, send the cards
// that didn't make it back to `next`, and take the line off the list. Closing is always
// allowed — a version ships when the user says it ships — and there is no second run: after
// it, the id is unknown and no card names it.

export const summaryPath = (id) => path.join(RELEASE_SUMMARIES, `${id}.md`)

const today = () => new Date().toISOString().slice(0, 10)

// Rewrite one card's release field — the fill moves a card in with it, and a close sends
// the leftovers back to `next` the same way.
function setCardRelease(file, release) {
  const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
  if (!meta) return false
  meta.release = release
  fs.writeFileSync(file, serializeFrontmatter(meta) + '\n' + body)
  return true
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

const cardLine = (card) =>
  `- #${card.id} ${card.title}${card.track ? ` (${card.track})` : ''}` +
  (card.done ? ' — every todo ticked, never archived' : '')

// One dated section per close. A version id can be made again after it was closed, so a
// second close appends instead of writing over: the first version's record is the only one
// there is.
function writeSummary(id, shipped, left) {
  fs.mkdirSync(RELEASE_SUMMARIES, { recursive: true })
  const file = summaryPath(id)
  const out = []
  out.push(`## Closed ${today()}`)
  out.push('')
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
      ? `Sent back to \`next\` — ${plural(left.length, 'card')} still open when it closed:`
      : 'Sent back to `next` — nothing was still open.',
  )
  if (left.length) {
    out.push('')
    for (const card of left) out.push(cardLine(card))
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

const HEADING = (id) => `# ${id}

What each close of this release left behind. This is a list of cards, not a changelog — not
every change goes through the board, so only a person can say what the version changed.
`

// The ids an earlier close of this id already listed as shipped. A version id can be made
// again, and an archived card keeps naming it forever — without this, closing the second
// `v1` would claim the first one's cards shipped all over again. A line moved into the
// shipped list by hand counts as well; that hand fix is how a missed card gets there.
function alreadyShipped(file) {
  if (!fs.existsSync(file)) return new Set()
  const ids = new Set()
  let inShipped = false
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('Shipped —')) inShipped = true
    else if (line.startsWith('Sent back') || line.startsWith('## ')) inShipped = false
    const m = inShipped && line.match(/^-\s+#(\d+)\b/)
    if (m) ids.add(Number(m[1]))
  }
  return ids
}

// Take the release off the list. When the last one goes the file gets its empty line back,
// so it reads the way a fresh one does instead of ending in a stray blank.
function removeReleaseLine(id) {
  const kept = []
  let dropped = false
  for (const line of fs.readFileSync(RELEASES, 'utf8').split('\n')) {
    if (!dropped && lineId(line) === id) {
      dropped = true
      continue
    }
    kept.push(line)
  }
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop()
  if (!kept.some((line) => lineId(line))) kept.push('', EMPTY_MARK)
  fs.writeFileSync(RELEASES, kept.join('\n') + '\n')
}

export function closeRelease(raw) {
  const id = String(raw === true ? '' : (raw ?? '')).trim()
  if (!id) die('release close needs a version id, e.g. `release close v1`')
  const known = readReleases()
  if (!known.includes(id)) {
    die(
      `unknown release "${id}". releases on the list: ${known.join(', ') || '(none)'}. ` +
        `A closed release is off the list for good — plan the next version with \`release new <id>\`.`,
    )
  }
  const counted = alreadyShipped(summaryPath(id))
  const shipped = archivedCards().filter((c) => c.release === id && !counted.has(c.id))
  const left = openCards().filter((c) => c.release === id)
  // The summary is written first: it is the only record of what the version was meant to
  // hold, and the next step is what erases that from the cards.
  const summary = writeSummary(id, shipped, left)
  // Back to `next`: the work is not promised to a version nobody has picked yet.
  for (const card of left) setCardRelease(card.file, DEFAULT_RELEASE)
  removeReleaseLine(id)
  return { id, shipped, left, summary, remaining: readReleases() }
}
