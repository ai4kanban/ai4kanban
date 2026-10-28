// Reading a card's `questions:` block. No filesystem and `.ts` imports, so Cloud's Worker
// reads a card with the same parser (#2064).

import { unquote } from './yaml.ts'
import type { Question } from './types.ts'

export const MODES = ['single', 'multi']

// Read any accepted form — a plain string, or the mapping the block above parses
// into — as one question object. An options list shorter than one entry reads as
// a plain question, so a half-written card still opens.
export function normalizeQuestion(raw: unknown): Question {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const source = raw as Record<string, unknown>
    const text = String(source.question ?? source.text ?? '')
    const extra = {
      ...(typeof source.agent === 'string' && source.agent.trim() ? { agent: source.agent.trim() } : {}),
      ...(source.skipped === true || source.skipped === 'true' ? { skipped: true } : {}),
    }
    const options = (Array.isArray(source.options) ? source.options : [])
      .map((o) => String(o).trim())
      .filter(Boolean)
    if (options.length === 0) return { text, ...extra }
    const mode = (MODES.includes(String(source.mode)) ? String(source.mode) : 'single') as 'single' | 'multi'
    const recommend = (Array.isArray(source.recommend) ? source.recommend : [])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= options.length)
    return { text, mode, options, recommend: mode === 'single' ? recommend.slice(0, 1) : recommend, ...extra }
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
      } else if (key === 'agent') {
        q.agent = unquote(val)
      } else if (key === 'skipped') {
        q.skipped = unquote(val) === 'true'
      }
    }
    out.push(normalizeQuestion(q))
  }
  return out
}
