// ---- archive / reject ------------------------------------------------------
//
// Taking a card off the board — archive and reject both move it into .archive/, reject
// marking it `rejected` — and an archive's handoff: the memory note's target, and every prose
// mention of the id that now needs a new sentence. A rejection hands nothing over (#1497).

import fs from 'node:fs'
import path from 'node:path'

import { clearChat, forgetCardChat } from '../lib/agent/chat'
import { heldByDelivery } from '../lib/agent/deliveries'
import { cardCreation, creationOf, readRuns, runIsLive, withStore } from '../lib/agent/store'
import { insideRun } from '../lib/agent/env'
import { withCreationLock } from '../lib/agent/creation-lock'
import { withBoardLock } from '../lib/lock'
import { creationRefusal, planDeliverables, planDeliveryGap } from '../lib/view/rules'
import { findCard } from '../lib/view/read'
import { recordCompletion } from '../lib/view/cheer'
import { formatDay } from '../lib/cadence'
import { die, warn, rel, TODO, MEMORY, ARCHIVE, ASSETS, REPO_ROOT } from '../lib/paths'
import { say } from '../lib/io'
import { bumpMetric } from '../lib/metrics'
import { countBoardEvent } from '../lib/machine/usage'
import { walkMd, walkDirs, idPrefix, subtaskLines, locate, locateArchived, enclosingGroupRoot, markSubtask, archiveDest, dropCrossRefs } from '../lib/cards'
import { groupCloseCall } from '../lib/group-close'
import { stripReadmeRefs } from '../lib/readme'
import { parseFrontmatter, serializeFrontmatter, frontmatterEnd, frontmatterField } from '../lib/frontmatter'
import { memoryTarget } from '../lib/memory'
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

// ---- the ids leaving -------------------------------------------------------

// Every id this removal takes off the board: the card's own, plus a group's subtasks.
// Read before the move — a group's folder is about to stop existing.
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

// Remove board conversations; the agent's own session stays with its CLI. A finished card's
// are kept for the memory review (#1345); a rejected card's go with every copy kept earlier.
function dropChats(ids: number[], finished = false): number[] {
  return ids.filter((id) => (finished ? clearChat(id) : forgetCardChat(id)))
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

// How a card was rejected: the reason, and — for a rejection, not a discard — when and by
// whom, which is what the rejection review reads (#1497).
interface Rejection {
  reason: string
  discard: boolean
}

// What a leaving card carries out with it: the day it left, `rejected` when it was turned
// down rather than finished, and no stage a run was holding — a card can leave mid-run, and
// the copy in .archive/ must not come back saying it is being implemented.
function stampLeaving(cards: { id: number; file: string }[], rejection: Rejection | null): void {
  const day = formatDay()
  const at = new Date().toISOString()
  const by = insideRun() ? 'agent' : 'user'
  for (const card of cards) {
    if (!fs.existsSync(card.file)) continue
    const { meta, body } = parseFrontmatter(fs.readFileSync(card.file, 'utf8'))
    if (!meta) continue
    meta.archived = day
    if (rejection) meta.rejected = true
    if (rejection?.reason) meta.rejected_reason = rejection.reason
    if (rejection && !rejection.discard) {
      meta.rejected_at = at
      meta.rejected_by = by
    }
    if (meta.status === 'implementing') meta.status = 'todo'
    fs.writeFileSync(card.file, serializeFrontmatter(meta) + '\n' + body)
  }
}

export interface RemoveOptions {
  /** This removal is the board closing a group root under its last subtask (#299). The
   *  root's own enclosing group is not chased any further, and no memory note is asked
   *  for: each subtask wrote its own shipped line as it left, and the root's would only
   *  restate them. The sentences still naming the root are reported by the subtask's
   *  receipt instead, in one list with its own. */
  closing?: boolean
  /** This rejection is a plain discard (#601): a backlog clear-out, never learned from. */
  discard?: boolean
  cleanupDiscarded?: boolean
  /** Why the card is rejected, kept on every card that leaves with it. */
  reason?: string
}

// Why a card finishing in planning (#1057) is not ready to archive, or null: the same check its
// Archive button draws from, plus what only this machine can see — the finished file on disk.
function unfinishedDelivery(id: number): string | null {
  const card = findCard(id)
  if (card?.deliversIn !== 'plan') return null
  const gap = planDeliveryGap(card)
  if (gap) {
    const what = {
      questions: 'it still has open questions',
      deliverable: 'no finished deliverable is on the card',
      command: 'no ticked todo records where it was delivered or the command that rebuilds it',
      todos: 'not every todo is ticked',
    }[gap]
    return `#${id} is not finished: ${what}.`
  }
  const missing = planDeliverables(card.body)
    .filter((src) => src.startsWith('.assets/'))
    .find((src) => !fs.existsSync(path.join(ASSETS, src.slice('.assets/'.length))))
  return missing ? `#${id} is not finished: ${missing} is not on this machine.` : null
}

// The top-level bullets under `## Decided by the agent`, and those of them under its
// `### Overruled by the user`.
function agentDecisions(text: string): { stood: number; overruled: number } {
  let section: 'stood' | 'overruled' | null = null
  const counts = { stood: 0, overruled: 0 }
  for (const line of text.split('\n')) {
    if (/^##\s/.test(line)) section = /^##\s+Decided by the agent\s*$/.test(line) ? 'stood' : null
    else if (/^###\s/.test(line) && section) section = /^###\s+Overruled by the user\s*$/.test(line) ? 'overruled' : null
    else if (section && /^[-*]\s/.test(line)) counts[section]++
  }
  return counts
}

export function cmdRemove(id: number, metric: Metric, options: RemoveOptions = {}): MoveResult {
  return withCreationLock(() => removeCard(id, metric, options))
}

function removeCard(id: number, metric: Metric, options: RemoveOptions): MoveResult {
  if (!Number.isInteger(id)) die('need a numeric task id')
  // A card with a delivery in flight doesn't leave the board under it — except at the hands
  // of the delivery itself, whose last step is archiving the card it just built.
  const held = heldByDelivery(id)
  if (held) die(held, { kind: 'card-held' })
  const creating = options.cleanupDiscarded ? null : creationRefusal(id, cardCreation(id, options.discard === true), metric === 'completed' ? 'archive' : 'reject', metric === 'rejected' && options.discard === true)
  if (creating) die(creating, { kind: 'card-being-created' })
  const found = locate(id)
  if (!found) die(`no task with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  const unfinished = metric === 'completed' ? unfinishedDelivery(id) : null
  if (unfinished) die(unfinished, { kind: 'plan-delivery-unfinished' })
  // Either way the card is filed under .archive/. Resolve the destination before anything
  // is written, so a name clash fails with the board untouched rather than half-updated.
  // The one delete left: a discarded card an old conversation wrote back, whose original is
  // already filed.
  const dest = options.cleanupDiscarded && locateArchived(id) ? null : archiveDest(found)
  // Read the card while it is still on the board: its `modules:` picks the memory copy the
  // note goes in.
  const cardFile = found.kind === 'group' ? path.join(found.target, 'root.md') : found.target
  const cardText = fs.existsSync(cardFile) ? fs.readFileSync(cardFile, 'utf8') : ''
  const { meta: cardMeta } = parseFrontmatter(cardText)
  // A group takes its subtasks with it. They're listed by name rather than printed —
  // enough to see what went, without burying the receipt under a folder's worth of cards.
  const alsoRemoved =
    found.kind === 'group'
      ? walkMd(found.target).filter((f) => f !== cardFile).map((f) => rel(f)).sort()
      : []
  // Read while the group's folder is still in `todo/`.
  const leftIds = leavingIds(id, found)
  const leaving = leavingCards(id, found)
  if (options.discard && !options.cleanupDiscarded) {
    const runs = readRuns()
    for (const card of leaving) {
      const refusal = creationRefusal(card.id, creationOf(runs, card.id), 'reject', true) || heldByDelivery(card.id)
      if (refusal) die(refusal, { kind: 'card-being-created' })
      if (runs.some((r) => r.sessionId !== insideRun() && runIsLive(r) && (r.cardId === card.id || r.createdCardIds?.includes(card.id)))) {
        die(`#${card.id} is still being worked on. Wait for that run to finish.`, { kind: 'card-held' })
      }
    }
    withStore((store) => {
      for (const run of store.runs) {
        if (!leaving.some((c) => run.createdCardIds?.includes(c.id))) continue
        const marks = new Map((run.discardedCards ?? []).map((c) => [c.id, c]))
        for (const c of leaving) marks.set(c.id, { id: c.id, path: rel(c.file), pending: true })
        run.discardedCards = [...marks.values()]
      }
    })
  }
  // Persist the resume decision before the move; a remaining card keeps resume blocked.
  if (options.discard) withStore((store) => {
    for (const run of store.runs) for (const card of run.discardedCards ?? []) {
      if (leftIds.includes(card.id)) delete card.pending
    }
  })
  // A subtask's fate is reflected in its group's root.md ## Todo, so the tracking card
  // stays accurate after the subtask has left: archive ticks it done, reject strikes
  // it out. Warn if the subtask isn't listed there, so the stale checklist gets noticed.
  const groupRoot = found.kind === 'file' && !options.closing ? enclosingGroupRoot(found.target) : null
  // The last write the cards get, and it has to happen before the move: after it there is
  // no card under `todo/` left to write.
  if (dest) {
    stampLeaving(leaving, metric === 'rejected' ? { reason: options.reason?.trim() ?? '', discard: options.discard === true } : null)
    fs.mkdirSync(ARCHIVE, { recursive: true })
    fs.renameSync(found.target, dest)
  } else {
    fs.rmSync(found.target, { recursive: true, force: true })
  }
  const removedRefs = stripReadmeRefs(found)
  let marked: 'tick' | 'strike' | null = null
  if (groupRoot) {
    const action = metric === 'completed' ? 'tick' : 'strike'
    if (markSubtask(groupRoot, id, action)) marked = action
    else warn(`#${id} isn't listed in ${rel(groupRoot)} ## Todo — nothing to ${action === 'tick' ? 'tick off' : 'strike out'}.`)
  }
  // The card is off the board now, so every blocked_by/related pointing at it is stale.
  // Runs after the move/delete, so the card's own frontmatter is already out of `todo/`.
  const unlinked = [...new Set(leftIds.flatMap((gone) => dropCrossRefs(gone)))]
  const droppedChats = dropChats(leftIds, metric === 'completed')
  if (!options.cleanupDiscarded) {
    bumpMetric(metric)
    countBoardEvent(metric === 'completed' ? 'cards_completed' : 'cards_rejected')
    if (metric === 'completed') {
      const { stood, overruled } = agentDecisions(cardText)
      countBoardEvent('decisions_stood', stood)
      countBoardEvent('decisions_overruled', overruled)
    }
  }
  const what = found.kind === 'group' ? `folder ${found.rel}/` : `file ${found.rel}`
  const to = dest ? ` → ${rel(dest)}${found.kind === 'group' ? '/' : ''}` : ''
  if (metric === 'completed') say(`archived #${id}: moved ${what}${to}`)
  else if (!dest) say(`discarded #${id}: removed ${what} — already filed in ${rel(ARCHIVE)}`)
  else if (options.discard) say(`discarded #${id}: moved ${what}${to}, marked rejected`)
  else say(`rejected #${id}: moved ${what}${to}, marked rejected`)
  if (removedRefs.length) say(`  dropped ${removedRefs.length} README ${removedRefs.length === 1 ? 'entry' : 'entries'}`)
  else say('  no README entry (subtask or untracked)')
  if (marked) say(`  ${marked === 'tick' ? 'ticked' : 'struck'} #${id} in ${rel(groupRoot!)}`)
  for (const card of unlinked) say(`  unlinked #${id} from ${card}`)
  for (const chatId of droppedChats) say(`  forgot the conversation about #${chatId}`)
  // The group closes with its last subtask (#299). Taken before the mentions below, so a
  // sentence in a root that left with this card is never handed over to be rewritten.
  const closed = groupRoot ? closeGroup(groupRoot) : null
  if (metric === 'completed' && !options.closing && !options.cleanupDiscarded) {
    const group = closed?.archived_to ? { id: closed.id, title: closed.title ?? '', done: closed.done ?? 0 } : undefined
    recordCompletion({ id, title: cardMeta?.title ?? '', group })
  }
  // Everything above is done. What follows is the part no script can do after an archive:
  // the shipped line, and the sentences other cards wrote about an id that just left the
  // board. A rejection hands neither over — the rejection review learns from its reason, and
  // a stale sentence is fixed when its card is next refined (#1497).
  const gone = closed?.archived_to ? [id, closed.id] : [id]
  const handsOver = !options.closing && metric === 'completed'
  const mentions = handsOver ? findMentions(gone) : []
  const note = handsOver ? printHandoff(gone, cardMeta, mentions) : null
  return {
    id,
    action: metric === 'completed' ? 'archived' : 'rejected',
    card: found.rel,
    archived_to: dest ? rel(dest) : null,
    unlinked,
    also_removed: alsoRemoved,
    chats_removed: droppedChats,
    // The group this card's departure closed, or the rule that kept a finished-looking root
    // on the board (#299). Null when the card was in no group, or its group is still open.
    group_close: closed,
    // What an archive still has to do by hand: write the note, rewrite the sentences.
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
  /** A closed root's title and its ticked subtasks — what a cheer says (#1331). */
  title?: string
  done?: number
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
    // Read before the move: the root's folder is about to leave `todo/`.
    const { meta, body } = parseFrontmatter(fs.readFileSync(rootFile, 'utf8'))
    const res = cmdRemove(rootId, 'completed', { closing: true })
    return {
      id: rootId,
      archived_to: (res.archived_to as string | null) ?? null,
      held: null,
      title: meta?.title ?? '',
      done: subtaskLines(body).ticked,
    }
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

// Long lines are quoted for recognition, not for copying — the file:line above each one is
// how you get the real text. Cut on a word so a half-word never reads as the file's.
function quoteLine(text: string, width = 96): string {
  if (text.length <= width) return text
  const cut = text.slice(0, width)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > width / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

function printHandoff(ids: number[], meta: Meta | null, mentions: Mention[]): { what: string; files: string[] } {
  const what = 'record the shipped work'
  const target = memoryTarget('readme.md', meta?.modules[0])
  say(`\nnext — what the script can't do:\n`)
  say(`  1. ${what} — follow "Finish a task" in \`akb guide board\``)
  say(`       file    ${rel(target.file)}`)

  const note = { what, files: [rel(target.file)] }
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

/** Remove files an old conversation wrote back, without counting a second rejection. */
export function cleanupDiscardedCards(sessionId: string): number[] {
  const discarded = readRuns().find((r) => r.sessionId === sessionId)?.discardedCards ?? []
  return withBoardLock(() => {
    for (const card of discarded) {
      if (card.pending) throw new Error(`Discarding #${card.id} did not finish. Retry the discard.`)
      while (locate(card.id)) cmdRemove(card.id, 'rejected', { discard: true, cleanupDiscarded: true })
      dropCrossRefs(card.id)
      stripReadmeRefs({ kind: 'file', rel: path.relative(TODO, path.resolve(REPO_ROOT, card.path)).split(path.sep).join('/') })
      dropChats([card.id])
    }
    return discarded.map((c) => c.id)
  })
}
