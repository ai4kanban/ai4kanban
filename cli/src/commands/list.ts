// ---- list ------------------------------------------------------------------
//
// The open board at a glance, one block per card — id, title, meta, summary line,
// and the file to read for the rest. `--module <m>` narrows it to the cards tagged
// with one module, which is how an extract-ideas run sees where a module already has
// effort without grepping frontmatter by hand.
//
// `--stale` asks a different question: which cards have sat untouched past the board's
// threshold, stalest first, and what is holding each one. Age comes from git (lib/card-age),
// so only this flag pays for the walk.

import fs from 'node:fs'
import path from 'node:path'

import { die, rel, TODO, MODULES_MD } from '../lib/paths'
import { say } from '../lib/io'
import { carriesField } from '../lib/solution'
import { moduleNames } from '../lib/validate'
import { parseFrontmatter } from '../lib/frontmatter'
import { walkMd, idPrefix } from '../lib/cards'
import { cardAges, staleAfter, type Age } from '../lib/card-age'
import { parseQuestion } from '../lib/view/rules'
import type { MoveResult, Question } from '../lib/types'

// One open card as the list shows it — the frontmatter fields it prints, plus where the
// card lives and the summary read off its body.
interface Row {
  id: number
  file: string
  isRoot: boolean
  isRecurring: boolean
  title: string
  status: string
  priority: string
  roi: string
  release: string
  blocked_by: number[]
  modules: string[]
  cadence: string
  questions: Question[]
  verify: string[]
  decided: number
  summary: string
  // `--stale` only: when git last saw the card, and how long ago that was.
  lastTouched?: string
  days?: number
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

// How a card ranks. `med` stands in for a product card whose line was damaged by hand; a
// marketing card carries neither field (#435), and nothing stands in for a field it never
// had.
const level = (value: string | undefined, field: string): string =>
  carriesField(field) ? value || 'med' : ''

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
    const isRecurring = path.relative(TODO, file).split(path.sep)[0] === 'recurring'
    const { meta, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    rows.push({
      id,
      file,
      isRoot,
      isRecurring,
      title: (meta && meta.title) || base.replace(/^\d+-/, '').replace(/\.md$/, ''),
      status: (meta && meta.status) || 'todo',
      priority: level(meta?.priority, 'priority'),
      roi: level(meta?.roi, 'roi'),
      release: (meta && meta.release) || '',
      blocked_by: (meta && meta.blocked_by) || [],
      modules: (meta && meta.modules) || [],
      cadence: (meta && meta.cadence) || '',
      questions: (meta && meta.questions) || [],
      verify: (meta && meta.verify) || [],
      decided: (meta && meta.decided.length) || 0,
      summary: summaryLine(body),
    })
  }
  return rows.sort((a, b) => a.id - b.id)
}

// What is keeping a card where it is, in the order the card reads them. Nothing here is a
// filter: a card waiting on the user is still listed, with its reason, and the sweeper
// decides what to skip.
function heldBy(row: Row, open: Set<number>): string[] {
  const holds: string[] = []
  const blockers = row.blocked_by.filter((id) => open.has(id))
  if (blockers.length) holds.push(`blocked by ${blockers.map((n) => `#${n}`).join(', ')}`)
  // Every question on a card is unanswered — answering takes it off the list.
  if (row.questions.some((q) => parseQuestion(q.text).tag === 'user')) holds.push('waiting on you')
  if (row.status === 'implementing') holds.push('being built')
  return holds
}

// The cards `--stale` reports on. A group root closes itself once its subtasks do and a
// recurring card repeats by design, so neither sits stuck the way a subtask can.
const canGoStale = (row: Row): boolean => !row.isRoot && !row.isRecurring

function cmdStale(rows: Row[], all: Row[], scope: string, mod: string | null): MoveResult {
  const days = staleAfter()
  const ages = cardAges()
  if (ages === null) {
    say(`not a git repository — a card's age is the date git last saw its file, so there is nothing to list.`)
    return { cards: [], module: mod, staleAfter: days }
  }

  const open = new Set(all.map((r) => r.id))
  const stale = rows
    .filter(canGoStale)
    .map((r) => ({ row: r, age: ages.get(r.file) }))
    .filter((r): r is { row: Row; age: Age } => r.age !== undefined && r.age.days >= days)
    .sort((a, b) => b.age.days - a.age.days || a.row.id - b.row.id)

  const cards = stale.map(({ row, age }) => ({ ...row, file: rel(row.file), ...age }))
  if (!stale.length) {
    say(`nothing ${scope} has sat ${days}+ days.`)
    return { cards, module: mod, staleAfter: days }
  }

  say(`${plural(stale.length, 'stale card')} ${scope} — untouched ${days}+ days, stalest first:`)
  for (const { row, age } of stale) {
    const holds = heldBy(row, open)
    say('')
    say(`#${row.id} ${row.title}  (${rel(row.file)})`)
    say(`    sat ${plural(age.days, 'day')} · last touched ${age.lastTouched} · ${holds.join(' · ') || 'nothing holding it'}`)
    if (row.summary) say(`    ${row.summary}`)
  }
  return { cards, module: mod, staleAfter: days }
}

/** `akb raw list`, as its command declares it (lib/cli/board.ts). */
export interface ListOptions {
  module?: string
  stale?: boolean
}

export function cmdList(opts: ListOptions): MoveResult {
  const all = openRows()
  let rows = all
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
  if (opts.stale) return cmdStale(rows, all, scope, mod === undefined ? null : mod)

  // The same rows the prose is printed from, with the file as a board-relative path — this
  // is what the local UI and any other caller read through `--json`.
  const cards = rows.map((r) => ({ ...r, file: rel(r.file) }))

  if (!rows.length) {
    say(`no open cards ${scope}.`)
    return { cards, module: mod === undefined ? null : mod }
  }

  say(`${plural(rows.length, 'open card')} ${scope}:`)
  for (const r of rows) {
    // A card on a board whose cards do not rank has neither (#435) — no word for it, and
    // no `med` stood in for the value it never had.
    const meta = [r.status]
    if (carriesField('priority')) meta.push(`priority ${r.priority}`)
    if (carriesField('roi')) meta.push(`roi ${r.roi}`)
    if (r.isRoot) meta.push('group root')
    if (r.release) meta.push(`release ${r.release}`)
    if (r.cadence) meta.push(`every ${r.cadence}`)
    if (r.blocked_by.length) meta.push(`blocked by ${r.blocked_by.map((n) => `#${n}`).join(', ')}`)
    if (r.questions.length) meta.push(plural(r.questions.length, 'open question'))
    if (r.verify.length) meta.push(`${r.verify.length} to check by hand`)
    if (r.decided) meta.push(`${r.decided} answered for you`)
    say('')
    say(`#${r.id} ${r.title}  (${rel(r.file)})`)
    say(`    ${meta.join(' · ')}`)
    if (r.summary) say(`    ${r.summary}`)
  }
  return { cards, module: mod === undefined ? null : mod }
}
