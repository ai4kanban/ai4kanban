// ---- questions -------------------------------------------------------------
//
// A question comes in two shapes. A PLAIN one is a single line the user answers
// in a text box — what every card has always written. An OPTIONS one carries
// choices the user ticks instead of reading them out of a sentence:
//
//   questions:
//     - a plain question stays one line
//     - question: Where should the board live?
//       mode: single
//       options:
//         - local files — simple
//         - GitHub Projects — syncs with issues
//       recommend: [1]
//
// `mode: single` lets the user tick one option, `mode: multi` as many as they
// want. `recommend` holds 1-based positions into `options` — the ones the resolve
// dialog opens already ticked; `[]` means nothing is pre-ticked. An option is
// one short line with its reason inside it; there is no note field beside it.
//
// A question `update-questions` hands to the user always carries choices; `single`
// is its default too — see `parseQuestionOps` below.
//
// In memory every question is an object: `{ text }` for a plain one, plus
// `mode`, `options` and `recommend` when it has options. Kept in step with
// kanban-ui/lib/frontmatter.ts and kanban-ui/lib/questions.ts.

import { die, warn } from './paths'
import { unquote } from './yaml'
import type { Typed } from './cli/shared'
import type { Question, QuestionDraft } from './types'

const MODES = ['single', 'multi']

// Reading a question — is it an options one, what tag does it carry — is something a front
// end does too, so those live with the rules a reader shares (./view/rules.ts) and are
// re-exported here for the writers below.
export type { OptionsQuestion } from './view/types'
export { hasOptions, QUESTION_TAGS, parseQuestion, formatQuestion } from './view/rules'
import { QUESTION_TAGS, parseQuestion } from './view/rules'

// Read any accepted form — a plain string, or the mapping the block above parses
// into — as one question object. An options list shorter than one entry reads as
// a plain question, so a half-written card still opens.
export function normalizeQuestion(raw: unknown): Question {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const source = raw as Record<string, unknown>
    const text = String(source.question ?? source.text ?? '')
    const options = (Array.isArray(source.options) ? source.options : [])
      .map((o) => String(o).trim())
      .filter(Boolean)
    if (options.length === 0) return { text }
    const mode = (MODES.includes(String(source.mode)) ? String(source.mode) : 'single') as 'single' | 'multi'
    const recommend = (Array.isArray(source.recommend) ? source.recommend : [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= options.length)
    return { text, mode, options, recommend: mode === 'single' ? recommend.slice(0, 1) : recommend }
  }
  return { text: String(raw) }
}

// Read the indented block under `questions:`. An item is either `- <text>` (plain)
// or `- question: <text>` followed by its `mode:`, `options:` and `recommend:` lines.
export function parseQuestionsBlock(lines: string[]): Question[] {
  const out: Question[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^\s*-\s+([\s\S]*)$/)
    if (!m) continue
    const head = m[1]!
    const opened = head.match(/^question:\s*(.*)$/)
    if (!opened) {
      out.push({ text: unquote(head) })
      continue
    }
    const q: Record<string, unknown> & { options: string[]; recommend: number[] } = {
      question: unquote(opened[1]!),
      options: [],
      recommend: [],
    }
    // Keep reading this question's fields until the next `- ` item. The option
    // lines are `- ` items themselves, so they're consumed as they're found.
    while (i + 1 < lines.length && !/^\s*-\s/.test(lines[i + 1]!)) {
      const field = lines[i + 1]!.match(/^\s*([A-Za-z_]+):\s*(.*)$/)
      i++
      if (!field) continue
      const [, key, val] = field as unknown as [string, string, string]
      if (key === 'options') {
        while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1]!)) {
          q.options.push(unquote(lines[i + 1]!.replace(/^\s*-\s+/, '')))
          i++
        }
      } else if (key === 'recommend') {
        q.recommend = val
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n))
      } else if (key === 'mode') {
        q.mode = unquote(val)
      }
    }
    out.push(normalizeQuestion(q))
  }
  return out
}

// ---- question tags ---------------------------------------------------------
//
// An open question may lead with a `[user] ...` tag token — a judgment call the
// human must make. Splitting it off and putting it back is `parseQuestion` /
// `formatQuestion`, re-exported at the top of this file from ./view/rules.ts.

// Warn (don't fail) when a question leads with a `[...]` token that isn't a known
// tag — almost always a typo like `[users]` that would silently read as text.
export function warnBadQuestionTags(questions: Question[]): void {
  for (const q of questions) {
    const m = String(q.text).match(/^\[([^\]]+)\]\s/)
    if (m && !QUESTION_TAGS.includes(m[1]!.toLowerCase())) {
      warn(`question tag "[${m[1]}]" isn't recognised — use [user] (or no tag). Stored as literal text.`)
    }
  }
}

// A draft is one question under construction while its flags are still being read:
// the text plus the options collected so far. `finalizeDraft` validates the whole
// group once the flags run out and returns the stored shape.
function newDraft(flag: string, value: string): QuestionDraft {
  const text = value.trim()
  if (!text) die(`--${flag} must not be empty`)
  return { question: text, options: [], recommended: [] }
}

// `--recommended-option` IS an `--option` — it declares its choice like any other and
// marks it as the one that opens ticked. So the recommended choice is written once, in
// the same list as its siblings, and the options keep the order they were typed in.
// (Naming an already-declared option instead would mean writing it twice and keeping the
// two spellings in step.)
function addToDraft(q: QuestionDraft, key: string, value: string): void {
  if (key === 'mode') {
    const m = value.toLowerCase()
    if (!MODES.includes(m)) die(`--mode must be single | multi (got "${value}")`)
    q.mode = m
    return
  }
  const text = value.trim()
  if (!text) die(`--${key} must not be empty`)
  if (q.options.includes(text)) die(`"${text}" is listed twice as an option of "${q.question}"`)
  q.options.push(text)
  if (key === 'recommended-option') q.recommended.push(text)
}

function finalizeDraft(q: QuestionDraft): Question {
  if (q.options.length === 0) {
    if (q.mode !== undefined) die(`--mode only applies to a question with options ("${q.question}")`)
    return normalizeQuestion(q)
  }
  if (q.options.length < 2) {
    die(`a question with options needs at least 2 — add another --option ("${q.question}")`)
  }
  q.mode = q.mode || 'single'
  if (q.mode === 'single' && q.recommended.length > 1) {
    die(`--mode single takes at most one --recommended-option ("${q.question}")`)
  }
  // Stored as 1-based positions in the option list. The lookup can't miss: a
  // recommendation was pushed into that list by the branch that read it.
  q.recommend = q.recommended.map((text) => q.options.indexOf(text) + 1).sort((a, b) => a - b)
  return normalizeQuestion(q)
}

// Build the question list from the flags as they were typed: each `--question`
// starts a new one, and every `--option`, `--mode` and `--recommended-option`
// after it belongs to that question. A question with no options stays plain.
export function collectQuestions(order: Typed[]): Question[] {
  const out: QuestionDraft[] = []
  for (const [key, value] of order) {
    if (key === 'question') {
      out.push(newDraft('question', value))
    } else if (key === 'option' || key === 'mode' || key === 'recommended-option') {
      const q = out[out.length - 1]
      if (!q) die(`--${key} must come after the --question it belongs to`)
      addToDraft(q, key, value)
    }
  }
  const questions = out.map(finalizeDraft)
  requireUserQuestionChoices(questions)
  return questions
}

function missingChoices(text: string): never {
  die(
    `"${text}" needs choices to tick — add 2 or more --option "a — why". ` +
      'The user always gets a free-text choice too, so never write one yourself.',
  )
}

// A `[user]` tag makes a question a handoff even when it is written during `create`.
// Keep untagged plain questions for refinement, but never hand the user a text-only prompt.
function requireUserQuestionChoices(questions: Question[]): void {
  const plain = questions.find((q) => parseQuestion(q.text).tag === 'user' && !q.options?.length)
  if (plain) missingChoices(plain.text)
}

// A question handed to the user always carries choices to tick, so `update-questions`
// refuses a bare line — the user should answer by ticking, not by reading a sentence
// for the choices hidden in it. Exclusive is the default, because most decisions are
// "which way"; `--mode multi` opts into "as many as you like". The free-text choice is
// offered by the board itself, last in the list, so "none of these" is a pick like the
// others and no caller has to remember to write it.
function finalizeHandover(q: QuestionDraft): Question {
  if (q.options.length === 0) missingChoices(q.question)
  return finalizeDraft(q)
}

// One op of `update-questions`, as read off argv.
export interface QuestionOp {
  kind: 'append' | 'update' | 'drop' | 'clear' | 'to-verify'
  ns?: string
  n?: number
  draft?: QuestionDraft
  question?: Question
}

/** What `update-questions` was asked for: its ops, in the order they were typed. */
export interface QuestionOpsInput {
  ops?: Typed[]
}

// The ops of `update-questions`, read from the flags in the order they were typed. Every op
// patches the list in place; nothing rewrites it wholesale. `--option`,
// `--recommended-option` and `--mode` attach to the `--append` or `--update` before them,
// the same grammar as create's `--question`.
//
// `--update` is the one that takes two values — the position, then the new text — so it is
// declared variadic and lands here as two entries in a row.
export function readQuestionOps(typed: Typed[]): QuestionOp[] {
  const ops: QuestionOp[] = []
  for (let i = 0; i < typed.length; i++) {
    const [key, value] = typed[i]!
    if (key === 'clear') {
      ops.push({ kind: 'clear' })
    } else if (key === 'drop' || key === 'to-verify') {
      ops.push({ kind: key, ns: value })
    } else if (key === 'append') {
      ops.push({ kind: 'append', draft: newDraft('append', value) })
    } else if (key === 'update') {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1) die('--update takes a 1-based question number, then the new text: --update <n> ".."')
      const next = typed[i + 1]
      if (!next || next[0] !== 'update') die('--update takes a 1-based question number, then the new text: --update <n> ".."')
      i++
      ops.push({ kind: 'update', n, draft: newDraft('update', next[1]) })
    } else {
      const last = ops[ops.length - 1]
      if (!last || !last.draft) die(`--${key} must come after the --append or --update it belongs to`)
      addToDraft(last.draft, key, value)
    }
  }
  if (!ops.length) {
    die('update-questions needs at least one op: --append ".." | --update <n> ".." | --drop n[,n...] | --to-verify n[,n...] | --clear')
  }
  for (const op of ops) {
    if (op.draft) {
      op.question = finalizeHandover(op.draft)
      delete op.draft
    }
  }
  return ops
}

// One or more 1-based question positions (`1` or `1,3`), validated against the
// card's open-question count.
export function parseQuestionPositions(raw: unknown, count: number, flagName: string): number[] {
  const ns = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number)
  if (ns.length === 0 || ns.some((n) => !Number.isInteger(n) || n < 1)) {
    die(`--${flagName} needs one or more 1-based question numbers (e.g. 1 or 1,3)`)
  }
  const over = ns.find((n) => n > count)
  if (over !== undefined) die(`the card has ${count} open question(s) — there's no question ${over}`)
  return ns
}
