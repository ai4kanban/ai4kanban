// ---- frontmatter read/write ------------------------------------------------
//
// The card's `--- ... ---` meta block. Only needs to read what this script (and
// `migrate`) write. The questions' shape is documented in ./questions.mjs.

import { STATUSES, normalizeRelease } from './validate.mjs'
import { yamlScalar, unquote } from './yaml.mjs'
import { hasOptions, normalizeQuestion, parseQuestionsBlock } from './questions.mjs'

export function serializeFrontmatter(m) {
  const out = ['---']
  out.push(`title: ${yamlScalar(m.title)}`)
  out.push(`track: ${yamlScalar(m.track)}`)
  out.push(`priority: ${m.priority}`)
  out.push(`roi: ${m.roi}`)
  out.push(`status: ${STATUSES.includes(m.status) ? m.status : 'todo'}`)
  out.push(`release: ${yamlScalar(normalizeRelease(m.release))}`)
  out.push(`blocked_by: [${(m.blocked_by || []).join(', ')}]`)
  out.push(`related: [${(m.related || []).join(', ')}]`)
  out.push(`modules: [${(m.modules || []).join(', ')}]`)
  // How often a recurring card repeats (`30m`, `6h`, `1d at 09:30` — see
  // ./cadence.mjs). Written only when the card carries one; no cadence means the
  // card runs when a human clicks Run and never on its own.
  if (m.cadence) out.push(`cadence: ${yamlScalar(m.cadence)}`)
  // When a recurring card last ran (`run` stamps it). Written only when the card
  // carries one, so a one-shot card's frontmatter is untouched — and re-emitted
  // whenever it is there, so an `update` in between can't erase the stamp.
  if (m.last_run) out.push(`last_run: ${yamlScalar(m.last_run)}`)
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
  // The release the card ships in. Missing, empty or damaged reads as no release, so a
  // card written before this field — or one whose line was blanked by hand — still opens.
  meta.release = normalizeRelease(meta.release)
  // modules is an optional string list; a card written before this field parses as [].
  if (!Array.isArray(meta.modules)) meta.modules = []
  // When this card last ran — recurring cards only, and only once they have run.
  // Anything but text reads as never run, so a blanked or damaged line just means
  // the card has no run to report.
  meta.last_run = typeof meta.last_run === 'string' && meta.last_run.trim() ? meta.last_run.trim() : ''
  // How often the card repeats. Kept as written — whoever reads it parses it
  // (./cadence.mjs); a line that isn't one of the accepted forms means the card
  // has no working cadence and only runs by hand.
  meta.cadence = typeof meta.cadence === 'string' && meta.cadence.trim() ? meta.cadence.trim() : ''
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
