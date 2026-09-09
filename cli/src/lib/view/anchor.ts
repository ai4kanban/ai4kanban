// Where a draft comment's passage sits in the draft as it now reads (#572).
//
// A comment stores no offsets — it stores the passage and enough of the draft around it to
// tell two copies of the same words apart. This is the pair of functions that turns a
// selection into that, and it back into a place: `passageOf` when the comment is left, and
// `anchorOf` every time the editor draws its marks.
//
// Nothing here touches a file or a process, and it imports only its sibling types — which
// is what lets it be copied into the board UI (`scripts/sync-format.mjs` →
// `kanban-ui/lib/format/view/anchor.ts`) and run in a browser, so the editor drawing the
// marks and the store writing the file agree on what a passage is.

import type { DraftComment } from './types'

/** How far either side of a passage is kept with it. Wide enough that two copies of the
 *  same words rarely share one, short enough that the quote stays a quote. */
const CONTEXT = 60

/** How much of a passage's own line goes with it, and where the passage sits inside that.
 *  Never past the passage's own first and last line, and never through a word: a context
 *  that ends mid-word reads as a typo to whoever opens the file. */
export function passageOf(text: string, from: number, to: number): { quote: string; context: string; at: number } {
  const quote = text.slice(from, to)
  let start = Math.max(text.lastIndexOf('\n', from - 1) + 1, from - CONTEXT)
  const lineEnd = text.indexOf('\n', to)
  let end = Math.min(lineEnd < 0 ? text.length : lineEnd, to + CONTEXT)
  while (start > 0 && start < from && !/\s/.test(text[start - 1]!)) start++
  while (end < text.length && end > to && !/\s/.test(text[end]!)) end--
  return { quote, context: text.slice(start, end), at: from - start }
}

/**
 * The offsets a comment's passage occupies in the draft as it now reads, or null when the
 * passage is no longer in it.
 *
 * The context is looked for first, so a passage repeated in the draft is found at the copy
 * it was left on. A draft rewritten around it still answers on the passage alone — the
 * comment keeps pointing at the words it is about, which is what it was left on.
 */
export function anchorOf(text: string, comment: DraftComment): { from: number; to: number } | null {
  const { context, quote, at } = comment
  if (!quote) return null
  const held = context.indexOf(quote, at) === at ? text.indexOf(context) : -1
  if (held >= 0) return { from: held + at, to: held + at + quote.length }
  const alone = text.indexOf(quote)
  return alone < 0 ? null : { from: alone, to: alone + quote.length }
}
