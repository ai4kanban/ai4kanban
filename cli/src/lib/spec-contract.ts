import fs from 'node:fs'
import path from 'node:path'

import { idPrefix, walkMd } from './cards'
import { parseFrontmatter } from './frontmatter'
import { rel, TODO } from './paths'
import { LEVELS, STATUSES } from './validate'

export interface ContractError {
  file: string
  line: number
  rule: string
  message: string
}

export interface CardSource {
  id: number
  text: string
}
export type SpecSnapshot = Map<string, CardSource>

/** Read raw files so malformed frontmatter cannot make a changed card disappear. */
export function snapshotSpecs(): SpecSnapshot {
  const out: SpecSnapshot = new Map()
  if (!fs.existsSync(TODO)) return out
  for (const file of walkMd(TODO)) {
    const id = idPrefix(path.basename(file) === 'root.md' ? path.basename(path.dirname(file)) : path.basename(file))
    if (id !== null) out.set(file, { id, text: fs.readFileSync(file, 'utf8') })
  }
  return out
}

/** Format only: semantic planning decisions remain the agent's responsibility. */
export function validateSpec(file: string, text: string): ContractError[] {
  const errors: ContractError[] = []
  const add = (line: number, rule: string, message: string) => errors.push({ file: rel(file), line, rule, message })
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---')
  if (lines[0]?.trim() !== '---' || end < 0) {
    add(1, 'frontmatter', 'Expected a leading --- frontmatter block and its closing ---. Restore both delimiters.')
    return errors
  }
  const fields = new Map<string, { line: number; value: string }>()
  for (let i = 1; i < end; i++) {
    const line = lines[i]!
    if (!line.trim() || /^\s|^#/.test(line)) continue
    const match = line.match(/^([a-z_]+):\s*(.*)$/)
    if (!match) { add(i + 1, 'frontmatter', `Invalid field ${JSON.stringify(line)}. Use key: value; indent list entries.`); continue }
    const key = match[1]!
    if (fields.has(key)) add(i + 1, 'duplicate-field', `Field ${key} is repeated. Keep one ${key}: entry.`)
    fields.set(key, { line: i + 1, value: match[2]! })
  }
  for (const key of ['title', 'priority', 'roi', 'status', 'release', 'blocked_by', 'related', 'modules', 'questions']) {
    if (!fields.has(key)) add(1, 'missing-field', `Missing ${key}: in frontmatter. Restore it with the board's metadata commands.`)
  }
  const { meta } = parseFrontmatter(text)
  if (typeof meta?.title !== 'string' || !meta.title.trim()) add(fields.get('title')?.line ?? 1, 'title', 'The title is empty. Set a non-empty title with akb raw update.')
  for (const key of ['priority', 'roi', 'status'] as const) {
    const allowed = key === 'status' ? STATUSES : LEVELS
    const value = fields.get(key)
    if (value && !allowed.includes(value.value.replace(/^['"]|['"]$/g, ''))) {
      add(value.line, key, `Invalid ${key} ${JSON.stringify(value.value)}. Expected ${allowed.join(', ')}; use akb raw update.`)
    }
  }
  for (const key of ['blocked_by', 'related', 'modules', 'questions', 'verify']) {
    const field = fields.get(key)
    if (!field) continue
    if (field.value !== '' && !/^\[.*\]$/.test(field.value)) {
      add(field.line, 'list', `${key} must be a list: use [] when empty, [values], or indented list entries.`)
    }
    if (key === 'blocked_by' || key === 'related') {
      const values = field.value.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean)
      if (values.some((s) => !/^[1-9]\d*$/.test(s))) add(field.line, 'task-ids', `${key} must contain positive numeric task IDs, such as [12, 34].`)
    }
  }

  const headings: { title: string; line: number }[] = []
  const markers: number[] = []
  let fence: { char: string; length: number; line: number } | null = null
  let comment = false
  const visible: string[] = []
  for (let i = end + 1; i < lines.length; i++) {
    const line = lines[i]!
    visible[i] = ''
    const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/)
    if (fence) {
      if (delimiter && delimiter[1]![0] === fence.char && delimiter[1]!.length >= fence.length && !delimiter[2]!.trim()) fence = null
      continue
    }
    if (comment) { if (line.includes('-->')) comment = false; continue }
    if (delimiter) { fence = { char: delimiter[1]![0]!, length: delimiter[1]!.length, line: i + 1 }; continue }
    if (/^\s*<!--\s*agent\s*-->\s*$/.test(line)) { markers.push(i + 1); continue }
    if (line.trim().startsWith('<!--')) { comment = !line.includes('-->'); continue }
    visible[i] = line
    const heading = line.match(/^ {0,3}(#{1,2})\s+(.+?)\s*#*\s*$/)
    if (heading?.[1] === '#') add(i + 1, 'heading', 'Do not repeat the card title as an H1. Remove this heading or use ### inside your section.')
    if (heading?.[1] === '##') headings.push({ title: heading[2]!, line: i + 1 })
    if (/^\s*<Mockup\b/.test(line)) {
      if (!/^\s*<Mockup\b[^<>]*\/>\s*$/.test(line) || (lines[i - 1]?.trim() && !/^\s*<Mockup\b/.test(lines[i - 1]!)) || (lines[i + 1]?.trim() && !/^\s*<Mockup\b/.test(lines[i + 1]!))) {
        add(i + 1, 'mockup-block', 'Put the self-closing <Mockup ... /> tag on its own line, with blank lines separating it from prose.')
      }
      if (!/\bsrc="[^"]+"/.test(line) || !/\blabel="[^"]+"/.test(line)) add(i + 1, 'mockup-attributes', 'Add non-empty src="..." and label="..." attributes to the Mockup tag.')
    }
  }
  if (fence) add(fence.line, 'code-fence', `Unclosed code block. Close it with ${fence.char.repeat(fence.length)} on its own line.`)
  if (comment) add(lines.length, 'comment', 'Unclosed HTML comment. Add --> so the rest of the card remains visible.')
  const recurring = file.split(path.sep).includes('recurring')
  const required = recurring ? ['Process'] : ['Worth noting', 'Scope', 'Todo', 'Decided by the agent']
  const human = ['Worth noting', 'Worth noting after implementation']
  const agent = ['Today', 'Scope', 'Scope out', 'Todo', 'Decided by the agent', 'Source']
  const allowed = recurring ? ['Run state', 'Process', 'Source'] : [...human, ...agent]
  const seen = new Set<string>()
  let lastOrder = -1
  for (const heading of headings) {
    const specialist = /^By `[a-z0-9]+(?:-[a-z0-9]+)*` (agent|skill)$/.test(heading.title)
    if (seen.has(heading.title)) add(heading.line, 'duplicate-section', `Duplicate ## ${heading.title}. Merge the content into one section.`)
    seen.add(heading.title)
    if (!allowed.includes(heading.title) && !specialist) add(heading.line, 'section-name', `Unknown ## ${heading.title}. Use ${allowed.map((s) => `## ${s}`).join(', ')}, or ## By \`<agent-name>\` agent. Use ### for a subheading.`)
    if (!recurring && markers.length === 1) {
      const before = heading.line < markers[0]!
      if ((human.includes(heading.title) && !before) || (agent.includes(heading.title) && before)) add(heading.line, 'section-half', `Move ## ${heading.title} ${human.includes(heading.title) ? 'above' : 'below'} <!-- agent -->.`)
      const order = human.includes(heading.title) ? human.indexOf(heading.title) : specialist ? (before ? 2 : 8) : agent.includes(heading.title) ? 3 + agent.indexOf(heading.title) : -1
      // Specialist sections belong between Todo and Decided by the agent.
      const rank = heading.title === 'Decided by the agent' ? 9 : heading.title === 'Source' ? 10 : order
      if (rank >= 0 && rank < lastOrder) add(heading.line, 'section-order', `## ${heading.title} is out of order. Follow the section order in akb guide writing.`)
      lastOrder = Math.max(lastOrder, rank)
    }
  }
  for (const title of required) if (!seen.has(title)) add(end + 2, 'missing-section', `Missing ## ${title}. Restore that section; keep its title in English.`)
  if (!recurring && markers.length !== 1) add(markers[1] ?? end + 2, 'boundary', `Found ${markers.length} <!-- agent --> boundaries; expected exactly one, between the human and agent sections.`)
  const todo = headings.find((h) => h.title === 'Todo')
  if (todo) {
    const next = headings.find((h) => h.line > todo.line)?.line ?? lines.length + 1
    if (!visible.slice(todo.line, next - 1).some((line) => /^\s*[-*+]\s*\[[ xX]?\]/.test(line))) add(todo.line, 'todos', '## Todo needs at least one checkbox step, for example - [ ] Implement the requested behavior.')
  }
  return errors
}

export function formatContractErrors(errors: readonly ContractError[]): string {
  return ['Spec format validation failed. Fix these errors without changing the planned behavior:', ...errors.map((e) => `${e.file}:${e.line} [${e.rule}] ${e.message}`)].join('\n')
}

/** Ignore unrelated cards held by another run; validate this run's target and changed files. */
export function validateRunSpecs(
  before: SpecSnapshot,
  now: SpecSnapshot,
  target: number | null,
  heldElsewhere: ReadonlySet<number> = new Set(),
): ContractError[] {
  return [...now].flatMap(([file, card]) => {
    if (card.id !== target && (heldElsewhere.has(card.id) || before.get(file)?.text === card.text)) return []
    return validateSpec(file, card.text)
  })

}
