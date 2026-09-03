// ---- list ------------------------------------------------------------------
//
// The open board at a glance, one block per card — id, title, meta, summary line,
// and the file to read for the rest. `--module <m>` narrows it to the cards tagged
// with one module, which is how a propose run sees where a module already has
// effort without grepping frontmatter by hand.

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, TODO, MODULES_MD } from '../lib/paths'
import { say } from '../lib/io'
import { moduleNames } from '../lib/validate'
import { parseFrontmatter } from '../lib/frontmatter'
import { walkMd, idPrefix, trackOf } from '../lib/cards'
import type { MoveResult, Question } from '../lib/types'

// One open card as the list shows it — the frontmatter fields it prints, plus where the
// card lives and the summary read off its body.
interface Row {
  id: number
  file: string
  isRoot: boolean
  title: string
  track: string
  status: string
  priority: string
  roi: string
  release: string
  blocked_by: number[]
  modules: string[]
  cadence: string
  questions: Question[]
  verify: string[]
  summary: string
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

// The card's opening paragraph — the body's first non-heading text, unwrapped
// (bodies hard-wrap, so one paragraph spans several file lines). The body template
// puts the one-line summary there, so this is the card's own pitch.
function summaryLine(body: string): string {
  const lines = body.split('\n')
  let i = 0
  while (i < lines.length && (!lines[i]!.trim() || lines[i]!.trim().startsWith('#'))) i++
  const para: string[] = []
  while (i < lines.length && lines[i]!.trim() && !lines[i]!.trim().startsWith('#')) {
    para.push(lines[i]!.trim())
    i++
  }
  const text = para.join(' ')
  return text.length > 240 ? text.slice(0, 240).replace(/\s+\S*$/, '') + ' …' : text
}

function openRows(): Row[] {
  const rows: Row[] = []
  for (const file of walkMd(TODO)) {
    const base = path.basename(file)
    if (base === 'README.md') continue
    const isRoot = base === 'root.md'
    const id = isRoot ? idPrefix(path.basename(path.dirname(file))) : idPrefix(base)
    if (id == null) continue
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    rows.push({
      id,
      file,
      isRoot,
      title: (meta && meta.title) || base.replace(/^\d+-/, '').replace(/\.md$/, ''),
      track: trackOf(path.relative(TODO, file), (meta && meta.track) || ''),
      status: (meta && meta.status) || 'todo',
      priority: (meta && meta.priority) || 'med',
      roi: (meta && meta.roi) || 'med',
      release: (meta && meta.release) || '',
      blocked_by: (meta && meta.blocked_by) || [],
      modules: (meta && meta.modules) || [],
      cadence: (meta && meta.cadence) || '',
      questions: (meta && meta.questions) || [],
      verify: (meta && meta.verify) || [],
      summary: summaryLine(body),
    })
  }
  return rows.sort((a, b) => a.id - b.id)
}

/** `akb board list`, as its command declares it (lib/cli/board.ts). */
export interface ListOptions {
  module?: string
}

export function cmdList(opts: ListOptions): MoveResult {
  let rows = openRows()
  let scope = 'on the board'
  const mod = opts.module
  if (mod !== undefined) {
    const known = moduleNames()
    if (known === null) die(`no ${rel(MODULES_MD)} yet — the board has no module map to filter by`)
    if (!known.includes(mod)) {
      die(`unknown module "${mod}". known modules: ${known.join(', ') || '(none)'}`)
    }
    rows = rows.filter((r) => r.modules.includes(mod))
    scope = `tagged \`${mod}\``
  }

  // The same rows the prose is printed from, with the file as a board-relative path — this
  // is what the local UI and any other caller read through `--json`.
  const cards = rows.map((r) => ({ ...r, file: rel(r.file) }))

  if (!rows.length) {
    say(`no open cards ${scope}.`)
    return { cards, module: mod === undefined ? null : mod }
  }

  say(`${plural(rows.length, 'open card')} ${scope}:`)
  for (const r of rows) {
    const meta = [r.track, r.status, `priority ${r.priority}`, `roi ${r.roi}`]
    if (r.isRoot) meta.push('group root')
    if (r.release) meta.push(`release ${r.release}`)
    if (r.cadence) meta.push(`every ${r.cadence}`)
    if (r.blocked_by.length) meta.push(`blocked by ${r.blocked_by.map((n) => `#${n}`).join(', ')}`)
    if (r.questions.length) meta.push(plural(r.questions.length, 'open question'))
    if (r.verify.length) meta.push(`${r.verify.length} to check by hand`)
    say('')
    say(`#${r.id} ${r.title}  (${rel(r.file)})`)
    say(`    ${meta.join(' · ')}`)
    if (r.summary) say(`    ${r.summary}`)
  }
  return { cards, module: mod === undefined ? null : mod }
}
