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
// In memory every question is an object: `{ text }` for a plain one, plus
// `mode`, `options` and `recommend` when it has options. Kept in step with
// kanban-ui/lib/frontmatter.ts and kanban-ui/lib/questions.ts.

import { die, warn } from './paths.mjs'
import { unquote } from './yaml.mjs'

const MODES = ['single', 'multi']

export function hasOptions(q) {
  return Array.isArray(q.options) && q.options.length > 0
}

// Read any accepted form — a plain string, or the mapping the block above parses
// into — as one question object. An options list shorter than one entry reads as
// a plain question, so a half-written card still opens.
export function normalizeQuestion(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const text = String(raw.question ?? raw.text ?? '')
    const options = (Array.isArray(raw.options) ? raw.options : []).map((o) => String(o).trim()).filter(Boolean)
    if (options.length === 0) return { text }
    const mode = MODES.includes(String(raw.mode)) ? String(raw.mode) : 'single'
    const recommend = (Array.isArray(raw.recommend) ? raw.recommend : [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= options.length)
    return { text, mode, options, recommend: mode === 'single' ? recommend.slice(0, 1) : recommend }
  }
  return { text: String(raw) }
}

// Read the indented block under `questions:`. An item is either `- <text>` (plain)
// or `- question: <text>` followed by its `mode:`, `options:` and `recommend:` lines.
export function parseQuestionsBlock(lines) {
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*-\s+([\s\S]*)$/)
    if (!m) continue
    const head = m[1]
    const opened = head.match(/^question:\s*(.*)$/)
    if (!opened) {
      out.push({ text: unquote(head) })
      continue
    }
    const q = { question: unquote(opened[1]), options: [], recommend: [] }
    // Keep reading this question's fields until the next `- ` item. The option
    // lines are `- ` items themselves, so they're consumed as they're found.
    while (i + 1 < lines.length && !/^\s*-\s/.test(lines[i + 1])) {
      const field = lines[i + 1].match(/^\s*([A-Za-z_]+):\s*(.*)$/)
      i++
      if (!field) continue
      const [, key, val] = field
      if (key === 'options') {
        while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
          q.options.push(unquote(lines[i + 1].replace(/^\s*-\s+/, '')))
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
// human must make. No token means untagged: freshly raised, not yet triaged.
// There is no tag for an answered question — answering removes it from the list.
// The tag lives at the front of the question's text, on both shapes; parseQuestion
// splits it off, formatQuestion puts it back. Kept in step with parseQuestion in
// kanban-ui/lib/questions.ts.
export const QUESTION_TAGS = ['user']

export function parseQuestion(raw) {
  const m = String(raw).match(/^\[(user)\]\s+([\s\S]*)$/)
  return m ? { tag: m[1], text: m[2] } : { tag: null, text: String(raw) }
}

export function formatQuestion(tag, text) {
  return tag ? `[${tag}] ${text}` : text
}

// Warn (don't fail) when a question leads with a `[...]` token that isn't a known
// tag — almost always a typo like `[users]` that would silently read as text.
export function warnBadQuestionTags(questions) {
  for (const q of questions) {
    const m = String(q.text).match(/^\[([^\]]+)\]\s/)
    if (m && !QUESTION_TAGS.includes(m[1].toLowerCase())) {
      warn(`question tag "[${m[1]}]" isn't recognised — use [user] (or no tag). Stored as literal text.`)
    }
  }
}

// A draft is one question under construction while its flags are still being read:
// the text plus the options collected so far. `finalizeDraft` validates the whole
// group once the flags run out and returns the stored shape.
function newDraft(flag, value) {
  const text = value === true ? '' : String(value).trim()
  if (!text) die(`--${flag} must not be empty`)
  return { question: text, options: [], recommended: [] }
}

// `--recommended-option` IS an `--option` — it declares its choice like any other and
// marks it as the one that opens ticked. So the recommended choice is written once, in
// the same list as its siblings, and the options keep the order they were typed in.
// (Naming an already-declared option instead would mean writing it twice and keeping the
// two spellings in step.)
function addToDraft(q, key, value) {
  if (key === 'mode') {
    const m = String(value).toLowerCase()
    if (!MODES.includes(m)) die(`--mode must be single | multi (got "${value}")`)
    q.mode = m
    return
  }
  const text = value === true ? '' : String(value).trim()
  if (!text) die(`--${key} must not be empty`)
  if (q.options.includes(text)) die(`"${text}" is listed twice as an option of "${q.question}"`)
  q.options.push(text)
  if (key === 'recommended-option') q.recommended.push(text)
}

function finalizeDraft(q) {
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
export function collectQuestions(order) {
  const out = []
  for (const [key, value] of order) {
    if (key === 'question') {
      out.push(newDraft('question', value))
    } else if (key === 'option' || key === 'mode' || key === 'recommended-option') {
      const q = out[out.length - 1]
      if (!q) die(`--${key} must come after the --question it belongs to`)
      addToDraft(q, key, value)
    }
  }
  return out.map(finalizeDraft)
}

// The ops of `update-questions`, read straight off argv — parseFlags carries one
// value per flag, and `--update` takes two (position, then the new text). Every op
// patches the list in place; nothing rewrites it wholesale. `--option`, `--mode` and
// `--recommended-option` attach to the `--append` or `--update` before them, the
// same grammar as create's `--question`.
export function parseQuestionOps(args) {
  const OPS = ['append', 'update', 'drop', 'clear', 'option', 'mode', 'recommended-option']
  const ops = []
  const take = (flag, v) => {
    if (v === undefined || v.startsWith('--')) die(`--${flag} needs a value`)
    return v
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (!a.startsWith('--')) die(`update-questions takes ops, not positional args (got "${a}")`)
    const key = a.slice(2)
    if (!OPS.includes(key)) die(`unknown option "--${key}". allowed: ${OPS.map((f) => '--' + f).join(', ')}`)
    if (key === 'clear') {
      ops.push({ kind: 'clear' })
    } else if (key === 'drop') {
      ops.push({ kind: 'drop', ns: take('drop', args[++i]) })
    } else if (key === 'append') {
      ops.push({ kind: 'append', draft: newDraft('append', take('append', args[++i])) })
    } else if (key === 'update') {
      const n = Number(take('update', args[++i]))
      if (!Number.isInteger(n) || n < 1) die('--update takes a 1-based question number, then the new text: --update <n> ".."')
      ops.push({ kind: 'update', n, draft: newDraft('update', take('update', args[++i])) })
    } else {
      const last = ops[ops.length - 1]
      if (!last || !last.draft) die(`--${key} must come after the --append or --update it belongs to`)
      addToDraft(last.draft, key, take(key, args[++i]))
    }
  }
  if (!ops.length) die('update-questions needs at least one op: --append ".." | --update <n> ".." | --drop n[,n...] | --clear')
  for (const op of ops) {
    if (op.draft) {
      op.question = finalizeDraft(op.draft)
      delete op.draft
    }
  }
  return ops
}

// One or more 1-based question positions (`1` or `1,3`), validated against the
// card's open-question count.
export function parseQuestionPositions(raw, count, flagName) {
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
