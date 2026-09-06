// The comments left on a topic's drafts, waiting for one polish (#458).
//
// A read-through of a draft finds several things at once. Sending each the moment it is
// found costs a rewrite of the whole file per remark, each one unaware of the rest — so a
// comment is SAVED on its passage, and the batch goes to a single polish run together.
//
// One file per card, `docs/kanban/.comments/<id>.json`, keyed by draft name: a tab keeps
// its own batch, and submitting on one never touches another. Never inside the draft — an
// agent and a person write that file byte for byte, and a marker in it would be text the
// next repurpose has to read around.
//
// Dotted and ignored like `.chats/`: a batch is consumed by the next polish and then gone,
// so it is this machine's working state and not the repository's, and it leaves with its
// card. Nothing here re-anchors a comment — the screen drawing the marks does that, and the
// polish run is given the quotes.

import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { COMMENTS } from './paths'
import type { DraftComment } from './view/types'

/** A batch is this machine's record of what the reader wants changed, the same kind of
 *  thing as a conversation — and no more the repo's business than one. */
export const COMMENT_IGNORE_LINE = {
  line: '.comments/',
  comment: '# The comments left on a draft, waiting for the polish that answers them.',
}

/** Every draft's batch on one card, keyed by draft name. */
type Batches = Record<string, DraftComment[]>

const fileOf = (cardId: number): string => path.join(COMMENTS, `${cardId}.json`)

function read(cardId: number): Batches {
  let data: unknown
  try {
    data = JSON.parse(fs.readFileSync(fileOf(cardId), 'utf8'))
  } catch {
    return {}
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const out: Batches = {}
  for (const [draft, rows] of Object.entries(data as Record<string, unknown>)) {
    if (!Array.isArray(rows)) continue
    const kept = rows.map(one).filter((c): c is DraftComment => c !== null)
    if (kept.length) out[draft] = kept
  }
  return out
}

// One row, only if it is whole. A comment with no words or no passage marks nothing and
// says nothing, so it is dropped rather than carried into a polish that cannot use it.
function one(raw: unknown): DraftComment | null {
  const c = raw as Partial<DraftComment>
  if (!c || typeof c.id !== 'string' || !c.id) return null
  if (typeof c.quote !== 'string' || !c.quote) return null
  if (typeof c.words !== 'string' || !c.words.trim()) return null
  return {
    id: c.id,
    quote: c.quote,
    from: Number.isInteger(c.from) ? (c.from as number) : 0,
    to: Number.isInteger(c.to) ? (c.to as number) : 0,
    words: c.words,
    at: typeof c.at === 'number' ? c.at : 0,
  }
}

// Write, then rename: a reader never sees half a file. A card with no comment left on any
// draft has no file at all, which is also what clearing the last batch leaves behind.
function write(cardId: number, batches: Batches): void {
  const file = fileOf(cardId)
  const live = Object.fromEntries(Object.entries(batches).filter(([, rows]) => rows.length))
  if (!Object.keys(live).length) {
    fs.rmSync(file, { force: true })
    return
  }
  fs.mkdirSync(COMMENTS, { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(live, null, 2) + '\n')
  fs.renameSync(tmp, file)
}

/** One draft's batch, oldest first. */
export const readComments = (cardId: number, draft: string): DraftComment[] => read(cardId)[draft] ?? []

/** Leave one comment on a passage and hand the batch back as it now reads. */
export function addComment(
  cardId: number,
  draft: string,
  passage: { quote: string; from: number; to: number; words: string },
): DraftComment[] {
  const batches = read(cardId)
  const comment: DraftComment = {
    id: randomUUID(),
    quote: passage.quote,
    from: passage.from,
    to: passage.to,
    words: passage.words.trim(),
    at: Date.now(),
  }
  batches[draft] = [...(batches[draft] ?? []), comment]
  write(cardId, batches)
  return batches[draft]
}

/** Change what one comment asks for. Its passage stays: the words are what the reader is
 *  editing, and a comment moved to another passage is a different comment. */
export function updateComment(cardId: number, draft: string, commentId: string, words: string): DraftComment[] {
  const batches = read(cardId)
  batches[draft] = (batches[draft] ?? []).map((c) => (c.id === commentId ? { ...c, words: words.trim() } : c))
  write(cardId, batches)
  return batches[draft]
}

/** Take one comment back before the batch is submitted. */
export function deleteComment(cardId: number, draft: string, commentId: string): DraftComment[] {
  const batches = read(cardId)
  batches[draft] = (batches[draft] ?? []).filter((c) => c.id !== commentId)
  write(cardId, batches)
  return batches[draft]
}

/** The batch is answered: the polished draft is the reply, and the comments go with it. */
export function clearComments(cardId: number, draft: string): void {
  const batches = read(cardId)
  if (!batches[draft]) return
  delete batches[draft]
  write(cardId, batches)
}

/** Every batch on a card off the board — nothing left to comment on, and nothing to polish
 *  it into. True when there was a file to forget. */
export function dropComments(cardId: number): boolean {
  try {
    fs.unlinkSync(fileOf(cardId))
    return true
  } catch {
    return false
  }
}
