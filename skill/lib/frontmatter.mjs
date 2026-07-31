// ---- frontmatter read/write ------------------------------------------------
//
// The card's `--- ... ---` meta block. Only needs to read what this script (and
// `migrate`) write. The questions' shape is documented in ./questions.mjs.

import { STATUSES } from './validate.mjs'
import { yamlScalar, unquote } from './yaml.mjs'
import { hasOptions, normalizeQuestion, parseQuestionsBlock } from './questions.mjs'

export function serializeFrontmatter(m) {
  const out = ['---']
  out.push(`title: ${yamlScalar(m.title)}`)
  out.push(`track: ${yamlScalar(m.track)}`)
  out.push(`priority: ${m.priority}`)
  out.push(`roi: ${m.roi}`)
  out.push(`status: ${STATUSES.includes(m.status) ? m.status : 'todo'}`)
  out.push(`blocked_by: [${(m.blocked_by || []).join(', ')}]`)
  out.push(`related: [${(m.related || []).join(', ')}]`)
  out.push(`modules: [${(m.modules || []).join(', ')}]`)
  if (!m.questions || m.questions.length === 0) out.push('questions: []')
  else {
    out.push('questions:')
    for (const raw of m.questions) {
      const q = normalizeQuestion(raw)
      if (!hasOptions(q)) {
        out.push(`  - ${yamlScalar(q.text)}`)
        continue
      }
      out.push(`  - question: ${yamlScalar(q.text)}`)
      out.push(`    mode: ${q.mode}`)
      out.push('    options:')
      for (const o of q.options) out.push(`      - ${yamlScalar(o)}`)
      out.push(`    recommend: [${q.recommend.join(', ')}]`)
    }
  }
  out.push('---')
  return out.join('\n')
}

// Parse the leading `--- ... ---` block into a meta object; returns the rest as body.
export function parseFrontmatter(text) {
  const lines = text.split('\n')
  if (lines[0].trim() !== '---') return { meta: null, body: text }
  let i = 1
  const fm = []
  while (i < lines.length && lines[i].trim() !== '---') {
    fm.push(lines[i])
    i++
  }
  if (i >= lines.length) return { meta: null, body: text }
  const meta = {}
  for (let j = 0; j < fm.length; j++) {
    const m = fm[j].match(/^([A-Za-z_]+):\s*(.*)$/)
    if (!m) continue
    const key = m[1]
    const val = m[2]
    // `questions:` holds two shapes at once — a plain line and an options block —
    // so it gets its own reader instead of the generic list branch below.
    if (key === 'questions') {
      if (val === '') {
        const block = []
        while (j + 1 < fm.length && /^\s/.test(fm[j + 1]) && fm[j + 1].trim() !== '') {
          block.push(fm[j + 1])
          j++
        }
        meta.questions = parseQuestionsBlock(block)
      } else {
        meta.questions = val.trim() === '[]' ? [] : [normalizeQuestion(unquote(val))]
      }
      continue
    }
    if (val === '') {
      const items = []
      while (j + 1 < fm.length && /^\s*-\s+/.test(fm[j + 1])) {
        items.push(unquote(fm[j + 1].replace(/^\s*-\s+/, '')))
        j++
      }
      meta[key] = items
    } else if (val.startsWith('[')) {
      const inner = val.slice(1, val.lastIndexOf(']'))
      meta[key] = inner.split(',').map((s) => s.trim()).filter(Boolean).map(unquote)
    } else {
      meta[key] = unquote(val)
    }
  }
  for (const k of ['blocked_by', 'related']) {
    if (Array.isArray(meta[k])) {
      meta[k] = meta[k].map((x) => Number(String(x).replace(/^#/, ''))).filter((n) => Number.isInteger(n))
    } else {
      meta[k] = []
    }
  }
  if (!Array.isArray(meta.questions)) meta.questions = meta.questions ? [normalizeQuestion(meta.questions)] : []
  // modules is an optional string list; a card written before this field parses as [].
  if (!Array.isArray(meta.modules)) meta.modules = []
  return { meta, body: lines.slice(i + 1).join('\n') }
}

// Index of the closing `---`, or 0 when the file opens with no frontmatter.
export function frontmatterEnd(lines) {
  if (lines[0]?.trim() !== '---') return 0
  let i = 1
  while (i < lines.length && lines[i].trim() !== '---') i++
  return i >= lines.length ? 0 : i
}

// Which frontmatter field line `i` belongs to — the nearest `key:` at or above it, so a
// mention buried in a wrapped `questions:` entry is reported as `questions`, not as a
// line number the reader has to go identify.
export function frontmatterField(lines, i) {
  for (let j = i; j > 0; j--) {
    const m = lines[j].match(/^([A-Za-z_]+):/)
    if (m) return m[1]
  }
  return 'frontmatter'
}
