// The comments left on a topic's drafts, waiting for one polish (#458, #572).
//
// A read-through of a draft finds several things at once. Sending each the moment it is
// found costs a rewrite of the whole file per remark, each one unaware of the rest — so a
// comment is SAVED on its passage, and the batch goes to a single polish run together.
//
// One markdown file per draft, `comments/<id>/<draft>.md` in this board's own folder on the
// machine (#590), so submitting one draft never touches another. Never inside the draft — an
// agent and a person write that file byte for byte, and a marker in it would be text the next
// repurpose has to read around.
//
// The file is the format a person would write by hand: an entry is a quoted passage and
// the change asked for under it. `[[…]]` picks the exact words out of a wider quote, and an
// `<!-- id -->` line above the quote is the only bookkeeping — what the UI names when it
// edits or deletes one. No offsets: `view/anchor.ts` re-finds a passage when the marks are
// drawn.
//
// Anything the reader below cannot make an entry of is kept BYTE FOR BYTE and put back
// where it was, so a half-written comment stays in the file and out of the polish batch.
//
// Machine state like the chats: a batch is consumed by the next polish and then gone, so it
// is this machine's working state and not the repository's, and it leaves with its card.

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { COMMENTS } from './paths'
import type { DraftComment } from './view/types'

const OPEN = '[['
const CLOSE = ']]'
const ID_LINE = /^<!--\s*([0-9a-f]{4,40})\s*-->\s*$/

const dirOf = (cardId: number): string => path.join(COMMENTS, String(cardId))
const fileOf = (cardId: number, draft: string): string => path.join(dirOf(cardId), `${draft}.md`)

/** What a file that has never been written opens with — one line saying what an entry is,
 *  for whoever opens it in an editor instead of the board. Kept as an ordinary chunk of the
 *  file from then on, so an edit to it survives. */
const header = (draft: string): string =>
  `# Comments on the \`${draft}\` draft\n\n` +
  'Quote a passage, then say what to change under it. `[[…]]` marks the exact words when\n' +
  'the quote is wider than them.'

/** The file in order: the entries the UI draws, and every chunk that is put back as read. */
type Block = { kind: 'comment'; comment: DraftComment } | { kind: 'raw'; text: string }

const trimEnds = (text: string): string => text.replace(/^(?:[ \t]*\n)+/, '').replace(/(?:\n[ \t]*)+$/, '')

/** Pull the marked passage out of a quote. An unmarked quote is its own passage — which is
 *  what someone writing an entry by hand leaves. */
function unmark(text: string): { context: string; quote: string; at: number } {
  const open = text.indexOf(OPEN)
  const close = open < 0 ? -1 : text.indexOf(CLOSE, open + OPEN.length)
  if (open < 0 || close < 0) return { context: text, quote: text, at: 0 }
  const quote = text.slice(open + OPEN.length, close)
  return { context: text.slice(0, open) + quote + text.slice(close + CLOSE.length), quote, at: open }
}

/** Put the marks back for writing. A context that already carries them, or that no longer
 *  holds its own passage, is dropped for the passage alone rather than written wrong. */
function mark({ context, quote, at }: DraftComment): string {
  if (quote === context || context.slice(at, at + quote.length) !== quote) return quote
  if (context.includes(OPEN) || context.includes(CLOSE)) return quote
  return context.slice(0, at) + OPEN + quote + CLOSE + context.slice(at + quote.length)
}

/** The key an entry the file does not name goes by — its own content, so a hand-written
 *  comment keeps one id across reads and the row the UI draws for it stays put. */
const idFor = (c: { context: string; words: string }, n: number): string =>
  createHash('sha1').update(`${n}\0${c.context}\0${c.words}`).digest('hex').slice(0, 8)

/** Name every entry, and no two the same: the file's own `<!-- id -->` stands, and anything
 *  else is named for its content and its place. A name already taken is drawn again until
 *  it is free — two entries answering to one id would edit and delete as one. */
function name(comments: DraftComment[]): void {
  const taken = new Set<string>()
  comments.forEach((comment, n) => {
    if (comment.id && !taken.has(comment.id)) {
      taken.add(comment.id)
      return
    }
    let id = idFor(comment, n)
    for (let k = n; taken.has(id); k++) id = idFor(comment, k + comments.length + 1)
    comment.id = id
    taken.add(id)
  })
}

/**
 * Read the file into blocks. An entry is a blockquote and the lines under it, up to the
 * next quote; an `<!-- id -->` line directly above the quote is its key.
 *
 * An entry with no passage or nothing asked for is not one — it goes back as raw text, so
 * a comment somebody is halfway through writing is neither drawn nor polished nor lost.
 */
function parse(text: string): Block[] {
  const lines = text.split('\n')
  const blocks: Block[] = []
  let rawFrom = 0
  let i = 0
  const pushRaw = (to: number): void => {
    const chunk = lines.slice(rawFrom, to).join('\n')
    if (chunk.trim()) blocks.push({ kind: 'raw', text: trimEnds(chunk) })
  }
  while (i < lines.length) {
    if (!lines[i]!.startsWith('>')) {
      i++
      continue
    }
    const quoteAt = i
    let head = quoteAt
    let id = ''
    for (let k = quoteAt - 1; k >= rawFrom; k--) {
      if (!lines[k]!.trim()) continue
      const named = ID_LINE.exec(lines[k]!)
      if (named) {
        id = named[1]!
        head = k
      }
      break
    }
    pushRaw(head)
    while (i < lines.length && lines[i]!.startsWith('>')) i++
    const saidAt = i
    while (i < lines.length && !lines[i]!.startsWith('>') && !ID_LINE.test(lines[i]!)) i++
    const quoted = trimEnds(
      lines
        .slice(quoteAt, saidAt)
        .map((line) => line.replace(/^>[ \t]?/, ''))
        .join('\n'),
    )
    const words = lines.slice(saidAt, i).join('\n').trim()
    const passage = unmark(quoted)
    if (!passage.quote || !words) blocks.push({ kind: 'raw', text: trimEnds(lines.slice(head, i).join('\n')) })
    else blocks.push({ kind: 'comment', comment: { id, ...passage, words } })
    rawFrom = i
  }
  pushRaw(lines.length)
  return blocks
}

const quoteLines = (text: string): string =>
  text
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n')

const render = (blocks: Block[]): string =>
  blocks
    .map((b) =>
      b.kind === 'raw'
        ? b.text
        : `<!-- ${b.comment.id} -->\n${quoteLines(mark(b.comment))}\n\n${b.comment.words}`,
    )
    .join('\n\n') + '\n'

function read(cardId: number, draft: string): Block[] {
  let text: string
  try {
    text = fs.readFileSync(fileOf(cardId, draft), 'utf8')
  } catch {
    return []
  }
  const blocks = parse(text)
  name(commentsIn(blocks))
  return blocks
}

// Write, then rename: a reader never sees half a file. Nothing left to keep means no file
// and no folder, which is also what the polish that answered the last batch leaves behind.
function write(cardId: number, draft: string, blocks: Block[]): void {
  const file = fileOf(cardId, draft)
  if (!blocks.length) {
    fs.rmSync(file, { force: true })
    try {
      fs.rmdirSync(dirOf(cardId))
    } catch {
      // another draft still has a batch
    }
    return
  }
  fs.mkdirSync(dirOf(cardId), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, render(blocks))
  fs.renameSync(tmp, file)
}

const commentsIn = (blocks: Block[]): DraftComment[] =>
  blocks.filter((b): b is { kind: 'comment'; comment: DraftComment } => b.kind === 'comment').map((b) => b.comment)

/** One draft's batch, in the order the file holds it. Read afresh every time, so a comment
 *  added, revised or removed by hand is there the next time anything asks. */
export const readComments = (cardId: number, draft: string): DraftComment[] => commentsIn(read(cardId, draft))

/** Leave one comment on a passage and hand the batch back as it now reads. */
export function addComment(
  cardId: number,
  draft: string,
  passage: { quote: string; context: string; at: number; words: string },
): DraftComment[] {
  const blocks = read(cardId, draft)
  if (!blocks.length) blocks.push({ kind: 'raw', text: header(draft) })
  const comment: DraftComment = {
    id: '',
    quote: passage.quote,
    context: passage.context || passage.quote,
    at: passage.at,
    words: passage.words.trim(),
  }
  blocks.push({ kind: 'comment', comment })
  name(commentsIn(blocks))
  write(cardId, draft, blocks)
  return commentsIn(blocks)
}

/** Change what one comment asks for. Its passage stays: the words are what the reader is
 *  editing, and a comment moved to another passage is a different comment. */
export function updateComment(cardId: number, draft: string, commentId: string, words: string): DraftComment[] {
  const blocks = read(cardId, draft)
  for (const block of blocks) {
    if (block.kind === 'comment' && block.comment.id === commentId) block.comment.words = words.trim()
  }
  write(cardId, draft, blocks)
  return commentsIn(blocks)
}

/** Take one comment back before the batch is submitted. */
export function deleteComment(cardId: number, draft: string, commentId: string): DraftComment[] {
  const blocks = read(cardId, draft).filter((b) => b.kind === 'raw' || b.comment.id !== commentId)
  const left = commentsIn(blocks)
  write(cardId, draft, left.length ? blocks : keepHandWritten(blocks, draft))
  return left
}

/** The batch is answered: the polished draft is the reply, and the comments go with it.
 *  What the polish could not read is not part of the answer, so it stays. */
export function clearComments(cardId: number, draft: string): void {
  write(cardId, draft, keepHandWritten(read(cardId, draft), draft))
}

/** What is left once the entries go: the chunks somebody wrote and this file could not read
 *  as a comment. The header alone is not one of them — a file holding only what we put
 *  there is a file with nothing in it. */
const keepHandWritten = (blocks: Block[], draft: string): Block[] =>
  blocks.filter((b): b is { kind: 'raw'; text: string } => b.kind === 'raw' && b.text !== header(draft))

/** Every batch on a card off the board — nothing left to comment on, and nothing to polish
 *  it into. True when there was a folder to forget. */
export function dropComments(cardId: number): boolean {
  const dir = dirOf(cardId)
  if (!fs.existsSync(dir)) return false
  fs.rmSync(dir, { recursive: true, force: true })
  return true
}
