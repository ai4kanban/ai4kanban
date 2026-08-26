// ---- archive / reject ------------------------------------------------------
//
// Taking a card off the board — archive moves it into .archive/, reject deletes it —
// and the receipt's handoff: the memory note's target, and every prose mention of the
// id that now needs a new sentence.

import fs from 'node:fs'
import path from 'node:path'

import { clearChat } from '../lib/agent/chat'
import { heldByDelivery } from '../lib/agent/deliveries'
import { die, warn, rel, TODO, MEMORY, ARCHIVE, MOCKUPS } from '../lib/paths'
import { say } from '../lib/io'
import { bumpMetric } from '../lib/metrics'
import { countDecisions, countsForRecord, originOf, recordFact } from '../lib/record'
import { walkMd, walkDirs, idPrefix, locate, enclosingGroupRoot, markSubtask, archiveDest } from '../lib/cards'
import { groupCloseCall } from '../lib/group-close'
import { stripReadmeRefs } from '../lib/readme'
import { parseFrontmatter, serializeFrontmatter, frontmatterEnd, frontmatterField } from '../lib/frontmatter'
import { memoryTargets } from '../lib/memory'
import type { Found, Meta, MoveResult } from '../lib/types'

// One `#id` a human wrote, and where it sits.
interface Mention {
  file: string
  line: number
  where: string
  text: string
}

// Which way a card leaves the board: archived (it shipped) or rejected (it was dropped).
type Metric = 'completed' | 'rejected'

// ---- drop cross-references -------------------------------------------------

// Remove `id` from every other card's `blocked_by`/`related`. Run when a card leaves the
// board (archive or reject): the id is gone, so a card still listing it is blocked by
// nothing and pointing at nothing. Without this the board keeps a card "blocked" forever
// and reconcileCrossRefs can only warn about it.
//
// Edits the two list lines in place rather than re-serializing the frontmatter, so a card
// this script never wrote keeps whatever else it has. Only the inline `[1, 2]` form the
// script writes is matched — a hand-written block list falls through to the reconcile
// warning instead of being silently missed.
const REF_LIST = /^(blocked_by|related):\s*\[(.*)\]\s*$/

function dropCrossRefs(id: number): string[] {
  const touched: string[] = []
  for (const file of walkMd(TODO)) {
    if (path.basename(file) === 'README.md') continue
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    if (lines[0]!.trim() !== '---') continue
    let end = 1
    while (end < lines.length && lines[end]!.trim() !== '---') end++
    if (end >= lines.length) continue // no closing fence — not frontmatter
    const fields: string[] = []
    for (let i = 1; i < end; i++) {
      const m = lines[i]!.match(REF_LIST)
      if (!m) continue
      const refs = m[2]!.split(',').map((s) => s.trim()).filter(Boolean)
      const kept = refs.filter((s) => Number(s.replace(/^#/, '')) !== id)
      if (kept.length === refs.length) continue
      lines[i] = `${m[1]}: [${kept.join(', ')}]`
      fields.push(m[1])
    }
    if (!fields.length) continue
    fs.writeFileSync(file, lines.join('\n'))
    touched.push(`${path.relative(TODO, file).split(path.sep).join('/')} (${fields.join(', ')})`)
  }
  return touched
}

// ---- drop mockups ----------------------------------------------------------

// Every id this removal takes off the board: the card's own, plus a group's subtasks,
// each of which can have mockups of its own. Read before the move — a group's folder is
// about to stop existing.
function leavingIds(id: number, found: Found): number[] {
  const ids = new Set([id])
  if (found.kind === 'group') {
    const names = [...walkMd(found.target), ...walkDirs(found.target)].map((f) => path.basename(f))
    for (const name of names) {
      const n = idPrefix(name)
      if (n !== null) ids.add(n)
    }
  }
  return [...ids]
}

// A mockup only ever describes the card it is keyed to, and a card off the board has
// nothing left to draw — so its folder goes with it, on archive as on reject. The files
// are not in git, so this is the end of them: what a drawing settled is in the card.
function dropMockups(ids: number[]): { dir: string; files: number }[] {
  const dropped: { dir: string; files: number }[] = []
  for (const id of ids) {
    const dir = path.join(MOCKUPS, String(id))
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir).length
    fs.rmSync(dir, { recursive: true, force: true })
    dropped.push({ dir: rel(dir), files })
  }
  return dropped
}

// A conversation about a card off the board has nothing left to be about, so it goes the
// way that card's mockups do. Only our end of it: the agent's own session stays wherever
// its CLI keeps it, and nothing on this board holds its id any more.
function dropChats(ids: number[]): number[] {
  return ids.filter((id) => clearChat(id))
}

// ---- find prose mentions of a leaving id -----------------------------------

// Every `#id` a human wrote — in a card's body, an open question, or a memory note.
// `dropCrossRefs` above repairs the machine-readable links; these are the sentences, and
// each one needs a new sentence, so the script reports them and edits nothing.
//
// Run this AFTER the cards are gone and cross-refs are dropped: a leaving card can't report
// itself, and a `blocked_by`/`related` the script already fixed can't show up as work.
// What's left is exactly what a person still has to rewrite. `ids` is more than one when a
// group root left with its last subtask (#299) — a sentence in the root would otherwise be
// handed over to be rewritten in a file that is no longer on the board.
//
// The `(?!\d)` guard is the whole reason this beats a grep — `#5` must not match `#58`,
// and searching the bare number matches `158` and every date on the board.
function findMentions(ids: number[]): Mention[] {
  const hits: Mention[] = []
  const re = new RegExp(ids.map((id) => `#${id}(?!\\d)`).join('|'))
  for (const dir of [TODO, MEMORY]) {
    if (!fs.existsSync(dir)) continue
    for (const file of walkMd(dir)) {
      // The script owns the index; a link there is stripped, not rewritten.
      if (path.basename(file) === 'README.md') continue
      const lines = fs.readFileSync(file, 'utf8').split('\n')
      const fmEnd = frontmatterEnd(lines)
      lines.forEach((line, i) => {
        if (!re.test(line)) return
        hits.push({
          file,
          line: i + 1,
          where: i < fmEnd ? frontmatterField(lines, i) : 'body',
          text: line.trim(),
        })
      })
    }
  }
  return hits
}

// ---- what the card leaves behind -------------------------------------------

// Every card this removal takes off the board, with the file it is in: the card itself,
// and — when it is a group — each subtask in its folder, which is its own card and carries
// its own calls.
function leavingCards(id: number, found: Found): { id: number; file: string }[] {
  const own = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const cards = [{ id, file: own }]
  if (found.kind !== 'group') return cards
  for (const file of walkMd(found.target)) {
    if (file === own) continue
    const n = idPrefix(path.basename(file))
    if (n !== null) cards.push({ id: n, file })
  }
  return cards
}

// What the board's score is worked out from, written while the cards are still there:
// where each one came from, and how many of its own calls stood as against how many the
// user overruled. A card with no origin on file was created before any of this existed —
// it is counted neither as a proposal that was built nor as one that was dropped.
function recordLeaving(id: number, found: Found, metric: Metric): void {
  const event = metric === 'completed' ? 'card-archived' : 'card-rejected'
  for (const card of leavingCards(id, found)) {
    if (!countsForRecord(card.file)) continue
    const origin = originOf(card.id)
    if (origin) recordFact(event, card.id, origin)
    const { body } = parseFrontmatter(fs.existsSync(card.file) ? fs.readFileSync(card.file, 'utf8') : '')
    const { stood, overruled } = countDecisions(body)
    recordFact('decisions-stood', card.id, stood)
    recordFact('decisions-overruled', card.id, overruled)
  }
}

export interface RemoveOptions {
  /** This removal is the board closing a group root under its last subtask (#299). The
   *  root's own enclosing group is not chased any further, and no memory note is asked
   *  for: each subtask wrote its own shipped line as it left, and the root's would only
   *  restate them. The sentences still naming the root are reported by the subtask's
   *  receipt instead, in one list with its own. */
  closing?: boolean
}

export function cmdRemove(id: number, metric: Metric, options: RemoveOptions = {}): MoveResult {
  if (!Number.isInteger(id)) die('need a numeric task id')
  // A card with a delivery in flight doesn't leave the board under it — except at the hands
  // of the delivery itself, whose last step is archiving the card it just built.
  const held = heldByDelivery(id)
  if (held) die(held, { kind: 'card-held' })
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  // Archive keeps the card (moved out of todo/), reject deletes it. Resolve the
  // destination before anything is written, so a name clash fails with the board
  // untouched rather than half-updated.
  const dest = metric === 'completed' ? archiveDest(found) : null
  // Read the card while it still exists. Its `modules:` picks the memory copy the note
  // goes in, and on a reject its text is about to stop existing — the receipt carries it
  // out (see `cardEpitaph`), so the note can still be written from the card's own words
  // after the file is gone.
  const cardFile = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const cardText = fs.existsSync(cardFile) ? fs.readFileSync(cardFile, 'utf8') : ''
  const { meta: cardMeta, body: cardBody } = parseFrontmatter(cardText)
  // A group takes its subtasks with it. They're listed by name rather than printed —
  // enough to see what went, without burying the receipt under a folder's worth of cards.
  const alsoRemoved =
    found.kind === 'group'
      ? walkMd(found.target).filter((f) => f !== cardFile).map((f) => rel(f)).sort()
      : []
  // Read while the group's folder is still there; the folders themselves go after the move.
  const mockupIds = leavingIds(id, found)
  const removedRefs = stripReadmeRefs(found)
  // A subtask's fate is reflected in its group's root.md ## Todo, so the tracking card
  // stays accurate after the subtask file is gone: archive ticks it done, reject strikes
  // it out. Warn if the subtask isn't listed there, so the stale checklist gets noticed.
  const groupRoot = found.kind === 'file' && !options.closing ? enclosingGroupRoot(found.target) : null
  let marked: 'tick' | 'strike' | null = null
  if (groupRoot) {
    const action = metric === 'completed' ? 'tick' : 'strike'
    if (markSubtask(groupRoot, id, action)) marked = action
    else warn(`#${id} isn't listed in ${rel(groupRoot)} ## Todo — nothing to ${action === 'tick' ? 'tick off' : 'strike out'}.`)
  }
  // `implementing` is a stage a run holds, not one a card keeps. A card can leave the board
  // mid-run — the agent building it archives it at the end of its own pass — and then the
  // run's close has no card left to put the stage back on. Dropped here instead, so the copy
  // in .archive/ can't come back saying it is being implemented when nothing is running.
  if (dest && cardMeta && cardMeta.status === 'implementing') {
    cardMeta.status = 'todo'
    fs.writeFileSync(cardFile, serializeFrontmatter(cardMeta) + '\n' + cardBody)
  }
  // The last moment the cards still exist: a reject deletes them outright, so what the
  // board's score is worked out from has to be written now, not after the move.
  recordLeaving(id, found, metric)
  if (dest) {
    fs.mkdirSync(ARCHIVE, { recursive: true })
    fs.renameSync(found.target, dest)
  } else if (found.kind === 'group') {
    fs.rmSync(found.target, { recursive: true, force: true })
  } else {
    fs.rmSync(found.target)
  }
  // The card is off the board now, so every blocked_by/related pointing at it is stale.
  // Runs after the move/delete, so the card's own frontmatter is already out of `todo/`.
  const unlinked = dropCrossRefs(id)
  const droppedMockups = dropMockups(mockupIds)
  const droppedChats = dropChats(mockupIds)
  bumpMetric(metric)
  const what = found.kind === 'group' ? `folder ${found.rel}/` : `file ${found.rel}`
  if (dest) say(`archived #${id}: moved ${what} → ${rel(dest)}${found.kind === 'group' ? '/' : ''}`)
  else say(`rejected #${id}: removed ${what}`)
  if (removedRefs.length) say(`  dropped ${removedRefs.length} README ${removedRefs.length === 1 ? 'entry' : 'entries'}`)
  else say('  no README entry (subtask or untracked)')
  if (marked) say(`  ${marked === 'tick' ? 'ticked' : 'struck'} #${id} in ${rel(groupRoot!)}`)
  for (const card of unlinked) say(`  unlinked #${id} from ${card}`)
  for (const m of droppedMockups) {
    say(`  deleted ${m.dir}/ — ${m.files} mockup file(s)`)
  }
  for (const chatId of droppedChats) say(`  forgot the conversation about #${chatId}`)
  // The group closes with its last subtask (#299). Taken before the mentions below, so a
  // sentence in a root that left with this card is never handed over to be rewritten.
  const closed = groupRoot ? closeGroup(groupRoot) : null
  // Everything above is done. What follows is the part no script can do: the memory note,
  // and the sentences other cards wrote about an id that just left the board.
  const gone = closed?.archived_to ? [id, closed.id] : [id]
  const mentions = options.closing ? [] : findMentions(gone)
  // A closing root asks for no note of its own, and its sentences are in the list the
  // subtask's receipt prints — so it hands nothing over.
  const note = options.closing ? null : printHandoff(gone, metric, cardMeta, mentions)
  if (!dest) printEpitaph(id, rel(cardFile), cardText, alsoRemoved)
  return {
    id,
    action: metric === 'completed' ? 'archived' : 'rejected',
    card: found.rel,
    archived_to: dest ? rel(dest) : null,
    unlinked,
    also_removed: alsoRemoved,
    mockups_removed: droppedMockups.map((m) => m.dir),
    chats_removed: droppedChats,
    // The group this card's departure closed, or the rule that kept a finished-looking root
    // on the board (#299). Null when the card was in no group, or its group is still open.
    group_close: closed,
    // What the caller still has to do by hand: write the note, rewrite the sentences.
    note,
    mentions: mentions.map((m) => ({ file: rel(m.file), line: m.line, where: m.where, text: m.text })),
  }
}

// ---- close the group (#299) ------------------------------------------------

/** What became of the group root this subtask has just left. */
interface GroupClose {
  id: number
  /** Where the root's folder moved to, or null when it stayed on the board. */
  archived_to: string | null
  /** The rule that kept it, or null when it left. */
  held: string | null
}

// The root, once its last subtask has gone. Never throws and never fails the run: the
// subtask's archive has already happened, so a root that cannot go is a line in the receipt
// and a card still on the board, archiveable by hand exactly as before.
function closeGroup(rootFile: string): GroupClose | null {
  const rootId = idPrefix(path.basename(path.dirname(rootFile)))
  if (rootId === null) return null
  const call = groupCloseCall(rootFile)
  if (!call.close) {
    if (!call.held) return null
    say(`\nevery subtask line on #${rootId} is resolved, but the group stays on the board: ${call.held}`)
    return { id: rootId, archived_to: null, held: call.held }
  }
  say(`\nevery subtask line on #${rootId} is resolved — closing the group:`)
  try {
    const res = cmdRemove(rootId, 'completed', { closing: true })
    return { id: rootId, archived_to: (res.archived_to as string | null) ?? null, held: null }
  } catch (e) {
    const held = e instanceof Error ? e.message : String(e)
    say(`  #${rootId} could not be archived: ${held}`)
    say(`  it stays on the board — Archive on its page finishes the job.`)
    return { id: rootId, archived_to: null, held }
  }
}

// ---- the receipt's handoff -------------------------------------------------
//
// Everything the script just did is mechanical and finished. What's left needs sentences,
// so it's handed back in one block: where the memory note goes, and which lines other
// cards wrote about this id now say something untrue.
//
// Written to be read by an agent as much as by a person: full repo-relative paths so a
// named file can be opened without joining anything, `file:line` so it can be jumped to,
// and one numbered item per thing that still has to happen. It names the guide that says
// how to write the note rather than restating the rule — one copy of the rule, and it is
// the one the flows read.

// `topics` says whether the target file groups its entries under `## ` headings, so the
// receipt only offers a section to file under where there are sections. `readme.md` is one
// flat list of shipped work by design; `rejected.md` is grouped by topic.
const NOTE_KIND: Record<Metric, { file: string; what: string; guide: string; topics: boolean }> = {
  completed: { file: 'readme.md', what: 'record the shipped work', guide: '"Finish a task" in `akb guide board`', topics: false },
  rejected: { file: 'rejected.md', what: 'write the rejection note', guide: '`akb guide reject`', topics: true },
}

// Long lines are quoted for recognition, not for copying — the file:line above each one is
// how you get the real text. Cut on a word so a half-word never reads as the file's.
function quoteLine(text: string, width = 96): string {
  if (text.length <= width) return text
  const cut = text.slice(0, width)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > width / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

function printHandoff(ids: number[], metric: Metric, meta: Meta | null, mentions: Mention[]): { what: string; files: string[] } {
  const kind = NOTE_KIND[metric]
  const targets = memoryTargets(meta?.modules ?? [], kind.file)
  say(`\nnext — what the script can't do:\n`)

  say(`  1. ${kind.what} — follow ${kind.guide}`)
  for (const t of targets) {
    say(`       file    ${rel(t.file)}`)
    if (!kind.topics) continue
    const topics = t.topics.map((x) => `"${x.name}" (${x.entries})`).join(', ')
    say(`       topics  ${topics || '(none yet — this note starts the first one)'}`)
  }
  if (targets.length > 1) {
    say('       both, because the card named two modules — one note each, in its own words')
  }

  const note = { what: kind.what, files: targets.map((t) => rel(t.file)) }
  const which = ids.map((x) => `#${x}`).join(' or ')
  if (!mentions.length) {
    say(`\n  2. nothing — no other card or note mentions ${which}, so there is nothing to rewrite`)
    return note
  }
  const n = mentions.length
  say(`\n  2. rewrite ${n} mention${n > 1 ? 's' : ''} of ${which} — each line below now points at a card that isn't there:`)
  for (const m of mentions) {
    say(`       ${rel(m.file)}:${m.line}  (${m.where})`)
    say(`         ${quoteLine(m.text)}`)
  }
  if (mentions.some((m) => m.where !== 'body')) {
    say('     A mention in frontmatter is the script\'s to rewrite, not yours:')
    say('     `update-questions <id> --update <n> "..."` (see help).')
  }
  return note
}

// A rejected card is deleted, so the receipt carries its text out — the note about why it
// was turned down usually needs the card's own words, and this is the last copy outside
// git history. Boxed with a `|` gutter because a card body has its own `---` fences and
// headings, which would otherwise blur into the surrounding output.
const EPITAPH_MAX_LINES = 200

function printEpitaph(id: number, relPath: string, text: string, alsoRemoved: string[]): void {
  const lines = text.replace(/\s+$/, '').split('\n')
  const shown = lines.slice(0, EPITAPH_MAX_LINES)
  say(`\n#${id} as it was — the file is gone, so this is the last copy outside git history:\n`)
  say(`  ,-- ${relPath}`)
  for (const line of shown) say(`  | ${line}`)
  if (lines.length > shown.length) {
    say(`  | ... ${lines.length - shown.length} more line(s) — \`git show HEAD:${relPath}\` for the rest`)
  }
  say('  `--')
  if (alsoRemoved.length) {
    say(`\n  the folder took ${alsoRemoved.length} subtask card(s) with it:`)
    for (const f of alsoRemoved) say(`    ${f}`)
    say('    (in git history — `git show HEAD:<path>`)')
  }
}
