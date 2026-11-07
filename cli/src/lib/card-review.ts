// What a card on the board asks of the user, read off its frontmatter: Cloud puts a card on
// review with it when the card reaches the board, and the import does the same.

import { openOf } from './view/rules.ts'
import type { Meta } from './types.ts'

export interface CardQuestion {
  question: string
  options: string[]
  position: number
}

/** On review when it waits on the user: `ready`, `implementing`, or an open question; the first
 *  open one with options is what the review asks, as `runner/src/flow.ts` does. Null when a
 *  refine comes first. */
export function reviewOf(meta: Meta): true | CardQuestion | null {
  const questions = meta.questions ?? []
  let open = false
  for (const [i, q] of questions.entries()) {
    if (!openOf([q]).length) continue
    open = true
    if (q.options?.length) return { question: q.text, options: q.options.slice(0, 8), position: i + 1 }
  }
  return open || meta.status === 'ready' || meta.status === 'implementing' ? true : null
}
