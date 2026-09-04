// The shapes the board's own files parse into.
//
// They are deliberately loose in the same places the parsers are: a card written by an
// older version, or hand-edited into a shape nothing writes, still has to open. What the
// parsers guarantee — the lists are lists, the scalars are strings — is what these say.

// One open question. A plain question is just its text; one with options carries the
// choices, how many may be ticked, and which open ticked (1-based). See lib/questions.ts.
// Declared with the shapes a reader is handed (./view/types.ts), because a question is one
// of the few things both sides of the board see — the writers here, and every front end.
export type { Question, QuestionMode } from './view/types'
import type { CardSchedule, Question } from './view/types'

// A question still being built out of the flags that describe it.
export interface QuestionDraft {
  question: string
  options: string[]
  recommended: string[]
  mode?: string
  recommend?: number[]
}

// A card's frontmatter, after parsing. Every field is normalized on the way in, so a
// reader never has to guard for a missing list or a damaged scalar.
export interface Meta {
  title: string
  priority: string
  roi: string
  status: string
  release: string
  blocked_by: number[]
  related: number[]
  modules: string[]
  cadence: string
  last_run: string
  /** The day this card was archived — `YYYY-MM-DD`, written by `board archive` on its way
   *  out. Empty on every open card, and on one archived before the board stamped a date. */
  archived: string
  /** The action waiting to run once nothing is in this card's way, or null on a card nobody
   *  scheduled (./schedule.ts). */
  schedule: CardSchedule | null
  questions: Question[]
  /** The hand-checks a finished build left for the user — a note to read, never a question
   *  to answer (./verify.ts). */
  verify: string[]
}

// Where a card sits on the board: one file, or a folder holding a group's root.md.
export interface Found {
  kind: 'group' | 'file'
  target: string
  rel: string
}

// What a move hands back to the dispatcher: its own fields, which `--json` puts in the
// answer next to the prose it printed.
export interface MoveResult {
  [key: string]: unknown
}
