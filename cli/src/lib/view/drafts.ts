// ---- a marketing card's drafts and channels, as a screen asks for them (#411) ----
//
// The board UI draws a marketing topic with a tab strip over `source` and each chosen
// channel, that draft in an editor, the comments left on it under that, and Repurpose and
// Publish beside it. Everything those controls need is here, and almost none of it is new
// behaviour: reading and writing a draft is `content/<id>/<name>.md` (../content.ts),
// repurposing is the `channel` command with all of its own checks, publishing is
// `raw channel-status`, and choosing the channels is `update --channels`. The comments and
// the polish they go to (#458) are the exception — Submit is their only door, so their own
// checks are made at the bottom of this file.
//
// Reading and writing a draft stays OUT of the board's operation contract on purpose. A
// draft is a file beside the board, not a card — a hosted board carries cards alone, and
// its screens answer `product` and never draw this block at all.
//
// A save is last-write-wins. The pane re-reads on focus and keeps what the user has typed,
// so a draft held open in both an editor and the board still loses whichever save landed
// second; a revision check here would refuse the save without giving that draft back.

import fs from 'node:fs'
import path from 'node:path'

import { cmdChannel } from '../../commands/channel'
import { titleOf } from '../agent/sessions'
import { startRun } from '../agent/start'
import type { AgentRequest } from '../agent/types'
import { board, withLease } from '../board'
import { locate } from '../cards'
import { CHANNEL_NAMES } from '../channels'
import { addComment, deleteComment, readComments, updateComment } from '../comments'
import { draftDir, draftFile, SOURCE } from '../content'
import { BoardError } from '../io'
import { die, rel, TODO } from '../paths'
import { solution } from '../solution'
import { UNTITLED } from './types'
import type { CardDraft, CardDrafts, ChannelStatus, DraftComment } from './types'

/** The names a draft may go by: the source, and the four channels. Anything else is a path
 *  nobody would look at, and is refused rather than written. */
const DRAFT_NAMES = [SOURCE, ...CHANNEL_NAMES]

/** The folder this card's drafts live in. Refuses a card the board does not hold — the id
 *  names the folder, so a wrong one writes somewhere no screen reads. */
function folderOf(id: number): { dir: string; cardFile: string } {
  const found = locate(id)
  if (!found || found.kind !== 'file') {
    die(`no topic with id ${id} under ${rel(TODO)}`, { kind: 'card-not-found', id })
  }
  return { dir: draftDir(found.target), cardFile: found.target }
}

function readOne(id: number, cardFile: string, name: string): CardDraft | null {
  const file = draftFile(cardFile, name)
  if (!fs.existsSync(file)) return null
  return { name, path: rel(file), text: fs.readFileSync(file, 'utf8'), comments: readComments(id, name) }
}

/** Refuse a draft nobody could look at. A name off this list is a path no screen reads, so
 *  it is turned away rather than written to or commented on. */
function mustBeADraft(name: string): void {
  if (DRAFT_NAMES.includes(name)) return
  die(`no draft called "${name}". a card's drafts are: ${DRAFT_NAMES.join(', ')}.`, {
    kind: 'unknown-draft',
    draft: name,
    known: DRAFT_NAMES,
  })
}

/** Which drafts this card has, each one whole — `source` first, then the channels in the
 *  order `lib/channels.ts` names them. A card nobody has written for answers with its
 *  folder and an empty list, which is a strip of `source` alone. */
export function readDrafts(id: number): CardDrafts {
  const { dir, cardFile } = folderOf(id)
  const drafts = DRAFT_NAMES.map((name) => readOne(id, cardFile, name)).filter((d): d is CardDraft => d !== null)
  return { dir: rel(dir), drafts, canSetChannels: true, canComment: true }
}

/** Write one draft and hand the set back as it now reads. The folder is created on the way
 *  — the first save on a topic is what makes `content/<id>/`. */
export function saveDraft(id: number, name: string, text: string): CardDrafts {
  mustBeADraft(name)
  const { cardFile } = folderOf(id)
  const file = draftFile(cardFile, name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, text)
  return readDrafts(id)
}

// ---- opening and discarding a topic (#507) ---------------------------------
//
// New topic is one press: it writes the card and the page it opens is the editor. Both moves
// here are `akb raw` moves under a lease, so a screen and a terminal write the same board —
// and neither starts an agent, because a topic that has not been written yet has nothing to
// ask one.

/** What a New topic press gets back: the id its page is at, or why nothing was written. */
export interface TopicResult {
  ok: boolean
  id?: number
  error?: string
}

/** Refuse a move that only a marketing board has. */
function mustBeMarketing(what: string): void {
  if (solution() === 'marketing') return
  die(`${what} is the marketing solution's — this board is \`${solution()}\`, and its cards are built, not written.`, {
    kind: 'wrong-solution',
    solution: solution(),
  })
}

/**
 * Write one blank topic — `raw create --title Untitled`, so the id, the filename and the
 * index entry are the board's own.
 *
 * `Untitled` rather than an empty title: `create` refuses an empty one, and the title is
 * frontmatter the page rewrites in place. Nothing else is asked for — no pillar, no channel
 * — because the point is to be typing a second later.
 */
export async function newTopic(): Promise<TopicResult> {
  try {
    mustBeMarketing('New topic')
    const res = await withLease({ board: true }, (env) =>
      board().runMove('create', { args: [], opts: { title: UNTITLED } }, env),
    )
    if (!res.ok) return { ok: false, error: res.error }
    const id = res.data.id
    return typeof id === 'number' ? { ok: true, id } : { ok: false, error: 'the topic was written without an id' }
  } catch (e) {
    if (e instanceof BoardError) return { ok: false, error: e.message }
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Take one topic off the board — `raw reject`, so every other card's `blocked_by:` and the
 * index are fixed the way they are for any other card that leaves.
 *
 * A press and never a timer: a topic opened and left blank stays where it is, so nothing the
 * user made disappears on its own. The drafts stay behind exactly as an archive leaves them.
 */
export async function discardTopic(id: number): Promise<TopicResult> {
  try {
    mustBeMarketing('Discard')
    folderOf(id) // the topic, or the refusal that names it
    const res = await withLease({ card: id }, (env) =>
      board().runMove('reject', { args: [String(id)], opts: {} }, env),
    )
    return res.ok ? { ok: true, id } : { ok: false, error: res.error }
  } catch (e) {
    if (e instanceof BoardError) return { ok: false, error: e.message }
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** What a Repurpose click gets back. `kind` is the refusal's own name, so the pane can turn
 *  `draft-exists` into a confirmation and show every other refusal as it came. */
export interface RepurposeResult {
  ok: boolean
  sessionId?: string
  error?: string
  kind?: string
}

/** What one repurpose is asked with, beside the channel (#457): the idea the user had while
 *  asking, and a language for this one piece. Both unset by default, and neither is kept
 *  anywhere — they are arguments to one action, not settings on the card. */
export interface RepurposeAsk {
  note?: string
  language?: string
}

/**
 * Start the repurpose run for one channel — `akb channel <name> <id>`, and every check it
 * makes: the board is `marketing`, the name is a channel, the card chose it, `source.md`
 * exists, and an existing draft needs `--again`.
 *
 * It is the command itself and not a run started straight from the request, because those
 * checks are the point of the button: a second copy of them here would drift.
 */
export async function repurposeChannel(
  id: number,
  channel: string,
  again = false,
  ask: RepurposeAsk = {},
): Promise<RepurposeResult> {
  try {
    const res = await cmdChannel({ channel, id, again, notes: ask.note, language: ask.language })
    const sessionId = typeof res.sessionId === 'string' ? res.sessionId : undefined
    return sessionId ? { ok: true, sessionId } : { ok: false, error: 'the repurpose did not start' }
  } catch (e) {
    if (e instanceof BoardError) return { ok: false, error: e.message, kind: e.kind }
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Move one channel along, and record where the piece went up — `raw channel-status`, so
 *  the same write a terminal makes. It posts nothing: `published` says the piece is out and
 *  `url` is the link it is out at. */
export function setChannelStatus(id: number, channel: string, status: ChannelStatus, url = '') {
  return withLease({ card: id }, (env) =>
    board().runMove('channel-status', { args: [String(id), channel, status], opts: { url } }, env),
  )
}

/** Choose the channels this topic goes to — `update --channels`, so the same rules apply:
 *  the whole list is rewritten, no entry leads, and a channel that stays keeps the status
 *  and URL it already had. The page's picker appends one and a tab's cross takes one off;
 *  the draft file is left alone either way. */
export function setChannels(id: number, names: string[]) {
  return withLease({ card: id }, (env) =>
    board().runMove('update', { args: [String(id)], opts: { channels: names } }, env),
  )
}

// ---- the comments left on a draft, and the polish they go to (#458) --------
//
// A comment is SAVED on its passage rather than sent, so a whole read-through is one pass
// over the draft. The batch lives in `docs/kanban/.comments/<id>.json` (../comments.ts) —
// beside the board, never inside the draft, and out of git.
//
// Each write answers with the batch as it now reads, so the page draws from the answer
// rather than reading again. Nothing here re-anchors a comment: the offsets are where the
// passage SAT, and the page re-finds the quote from them.

/** Leave one comment on a passage of a draft. `from`/`to` are the offsets it was selected
 *  at, kept as the place the quote is looked for next time. */
export function commentOnDraft(
  id: number,
  draft: string,
  passage: { quote: string; from: number; to: number; words: string },
): DraftComment[] {
  mustBeADraft(draft)
  folderOf(id) // the card, or the refusal that names it
  if (!passage.quote) die('a comment is left on a passage', { kind: 'needs-input' })
  if (!passage.words.trim()) die('a comment says what to do with the passage', { kind: 'needs-input' })
  return addComment(id, draft, passage)
}

/** Change what one comment asks for, before the batch is submitted. */
export function editDraftComment(id: number, draft: string, commentId: string, words: string): DraftComment[] {
  mustBeADraft(draft)
  folderOf(id)
  if (!words.trim()) die('a comment says what to do with the passage', { kind: 'needs-input' })
  return updateComment(id, draft, commentId, words)
}

/** Take one comment back. */
export function dropDraftComment(id: number, draft: string, commentId: string): DraftComment[] {
  mustBeADraft(draft)
  folderOf(id)
  return deleteComment(id, draft, commentId)
}

/**
 * Submit the batch: one `polish` run over this one draft, told which draft and which
 * comments to read.
 *
 * The checks are here rather than in a command because there is no command — Submit on the
 * card page is the only way in. They are the ones a repurpose makes for the same reasons:
 * the board publishes, the topic exists, the file is there, and — the one this move adds —
 * there is something to answer.
 *
 * The batch is NOT cleared here. The run has to finish for the polished draft to be the
 * answer, so the watcher clears it on a `done` ending (`agent/watch.ts`); one that failed,
 * was stopped or was cut off leaves the comments to submit again.
 */
export async function polishDraft(id: number, draft: string): Promise<RepurposeResult> {
  try {
    if (solution() !== 'marketing') {
      die(`a polish is the marketing solution's — this board is \`${solution()}\`, and its cards are built, not written.`, {
        kind: 'wrong-solution',
        solution: solution(),
      })
    }
    mustBeADraft(draft)
    const { cardFile } = folderOf(id)
    const file = draftFile(cardFile, draft)
    if (!fs.existsSync(file)) {
      die(`#${id} has no ${rel(file)} yet — there is nothing to polish.`, { kind: 'no-draft', id, draft })
    }
    if (!readComments(id, draft).length) {
      die(`no comments are waiting on ${rel(file)} — leave one on a passage first.`, { kind: 'no-comments', id, draft })
    }
    const req: AgentRequest = { action: 'polish', id, title: titleOf(id), draft }
    const started = await startRun(req)
    if ('error' in started) return { ok: false, error: started.error }
    if (!started.spawned) return { ok: false, error: `couldn't start a process to run ${started.run.sessionId}` }
    return { ok: true, sessionId: started.run.sessionId }
  } catch (e) {
    if (e instanceof BoardError) return { ok: false, error: e.message, kind: e.kind }
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
